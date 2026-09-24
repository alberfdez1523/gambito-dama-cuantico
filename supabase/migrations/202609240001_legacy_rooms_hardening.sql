-- Endurecimiento del lobby online heredado (`rooms`).
--
-- 1. Define las RPC que el cliente ya invocaba y no existían en las migraciones:
--    `cleanup_stale_rooms` y `abandon_room`.
-- 2. Unirse a una sala pasa por `join_room_by_code`: las salas en espera dejan de
--    ser legibles por cualquier usuario autenticado (antes se podían enumerar códigos).
-- 3. Un trigger impide que un participante robe asientos, cambie columnas fijas,
--    retroceda la versión, mueva en el turno del rival o elija la semilla de medición.
--
-- Sigue siendo un modelo cliente-autoritativo: el servidor no valida reglas de
-- ajedrez. El online competitivo debe usar `matches` y la API autoritativa.

begin;

-- ---------------------------------------------------------------------------
-- Lectura: solo participantes.
-- ---------------------------------------------------------------------------
drop policy if exists legacy_rooms_read_participant on public.rooms;
create policy legacy_rooms_read_participant on public.rooms for select to authenticated using (
  white_player_id = (select auth.uid()) or black_player_id = (select auth.uid())
);

-- ---------------------------------------------------------------------------
-- Creación: el anfitrión ocupa exactamente su asiento y la sala empieza vacía.
-- ---------------------------------------------------------------------------
drop policy if exists legacy_rooms_create on public.rooms;
create policy legacy_rooms_create on public.rooms for insert to authenticated with check (
  status = 'waiting'
  and version = 0
  and (
    (host_color = 'w' and white_player_id = (select auth.uid()) and black_player_id is null)
    or
    (host_color = 'b' and black_player_id = (select auth.uid()) and white_player_id is null)
  )
);

-- ---------------------------------------------------------------------------
-- Actualización directa: solo participantes; unirse se hace con la RPC.
-- ---------------------------------------------------------------------------
drop policy if exists legacy_rooms_join_or_update on public.rooms;
create policy legacy_rooms_participant_update on public.rooms for update to authenticated using (
  white_player_id = (select auth.uid()) or black_player_id = (select auth.uid())
) with check (
  white_player_id = (select auth.uid()) or black_player_id = (select auth.uid())
);

-- El registro de jugadas solo acepta el color del propio asiento.
drop policy if exists legacy_room_moves_insert on public.room_moves;
create policy legacy_room_moves_insert on public.room_moves for insert to authenticated with check (
  exists (
    select 1 from public.rooms r
    where r.id = room_moves.room_id
      and room_moves.version <= r.version
      and (
        (r.white_player_id = (select auth.uid()) and coalesce(room_moves.actor_color, 'w') = 'w')
        or
        (r.black_player_id = (select auth.uid()) and coalesce(room_moves.actor_color, 'b') = 'b')
      )
  )
);

-- ---------------------------------------------------------------------------
-- Semilla de medición generada por la base de datos, nunca por el anfitrión.
-- ---------------------------------------------------------------------------
create or replace function private.rooms_assign_seed()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.mode = 'quantum' then
    new.measurement_seed := replace(gen_random_uuid()::text, '-', '')
      || replace(gen_random_uuid()::text, '-', '');
  else
    new.measurement_seed := null;
  end if;
  return new;
end;
$$;

drop trigger if exists rooms_assign_seed on public.rooms;
create trigger rooms_assign_seed
  before insert on public.rooms
  for each row execute function private.rooms_assign_seed();

-- ---------------------------------------------------------------------------
-- Guardia de actualizaciones directas desde el cliente.
-- ---------------------------------------------------------------------------
create or replace function private.rooms_guard_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_color text;
  content_changed boolean;
begin
  -- Las RPC `security definer` y el service role no pasan por esta guardia.
  if current_user <> 'authenticated' then
    return new;
  end if;

  actor_color := case
    when old.white_player_id = actor then 'w'
    when old.black_player_id = actor then 'b'
  end;
  if actor_color is null then
    raise exception 'not_a_participant' using errcode = '42501';
  end if;

  if new.id <> old.id or new.code <> old.code or new.mode <> old.mode
     or new.host_color <> old.host_color or new.created_at <> old.created_at then
    raise exception 'immutable_room_column' using errcode = '42501';
  end if;

  if new.white_player_id is distinct from old.white_player_id
     or new.black_player_id is distinct from old.black_player_id then
    raise exception 'seats_are_managed_by_join_room_by_code' using errcode = '42501';
  end if;

  content_changed := new.state is distinct from old.state
    or new.turn is distinct from old.turn
    or new.measurement_seed is distinct from old.measurement_seed;

  if content_changed and new.version <> old.version + 1 then
    raise exception 'version_must_increment' using errcode = '40001';
  end if;
  if not content_changed and new.version not in (old.version, old.version + 1) then
    raise exception 'version_must_not_rewind' using errcode = '40001';
  end if;

  if new.status <> old.status and not (
    (old.status = 'waiting' and new.status = 'playing'
      and new.white_player_id is not null and new.black_player_id is not null)
    or (old.status = 'playing' and new.status = 'finished')
    or (old.status = 'finished' and new.status = 'playing')
  ) then
    raise exception 'invalid_status_transition' using errcode = '42501';
  end if;

  -- La semilla solo se deriva de nuevo al aceptar la revancha.
  if new.measurement_seed is distinct from old.measurement_seed and not (
    old.status = 'finished' and new.status = 'playing'
    and old.measurement_seed is not null
    and new.measurement_seed like old.measurement_seed || ':r%'
  ) then
    raise exception 'measurement_seed_is_immutable' using errcode = '42501';
  end if;

  -- Durante la partida, solo quien tiene el turno puede pasarlo al rival.
  if old.status = 'playing' and new.status = 'playing'
     and new.turn <> old.turn and old.turn <> actor_color then
    raise exception 'not_your_turn' using errcode = '42501';
  end if;

  -- La marca de actividad la pone el servidor: una fecha futura evitaría la limpieza.
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists rooms_guard_update on public.rooms;
create trigger rooms_guard_update
  before update on public.rooms
  for each row execute function private.rooms_guard_update();

-- ---------------------------------------------------------------------------
-- RPC: unirse por código.
-- ---------------------------------------------------------------------------
create or replace function public.join_room_by_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  normalized text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
  room public.rooms%rowtype;
  joined_color text;
begin
  if actor is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if normalized !~ '^[A-Z2-9]{6}$' then
    raise exception 'ROOM_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into room from public.rooms where code = normalized for update;
  if not found then
    raise exception 'ROOM_NOT_FOUND' using errcode = 'P0002';
  end if;
  if room.status = 'finished' then
    raise exception 'ROOM_FINISHED' using errcode = 'P0001';
  end if;

  if room.white_player_id = actor or room.black_player_id = actor then
    joined_color := case when room.white_player_id = actor then 'w' else 'b' end;
    -- Mismo usuario en otra pestaña: ocupa el asiento libre, como hacía el cliente.
    if room.status = 'waiting' and (room.white_player_id is null or room.black_player_id is null) then
      joined_color := case when room.white_player_id is null then 'w' else 'b' end;
    else
      return to_jsonb(room) || jsonb_build_object('client_color', joined_color);
    end if;
  elsif room.status <> 'waiting' then
    raise exception 'ROOM_FULL' using errcode = 'P0001';
  elsif room.white_player_id is null then
    joined_color := 'w';
  elsif room.black_player_id is null then
    joined_color := 'b';
  else
    raise exception 'ROOM_FULL' using errcode = 'P0001';
  end if;

  update public.rooms
  set white_player_id = case when joined_color = 'w' then actor else white_player_id end,
      black_player_id = case when joined_color = 'b' then actor else black_player_id end,
      status = 'playing',
      updated_at = now()
  where id = room.id
  returning * into room;

  return to_jsonb(room) || jsonb_build_object('client_color', joined_color);
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: abandonar (borra la sala si quien llama es participante).
-- ---------------------------------------------------------------------------
create or replace function public.abandon_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  delete from public.rooms
  where id = p_room_id
    and actor is not null
    and (white_player_id = actor or black_player_id = actor);
  if not found then
    raise exception 'room_not_found_or_not_allowed' using errcode = 'P0001';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: limpieza de salas inactivas. Cualquier cliente puede dispararla, así que
-- el umbral nunca baja de 10 minutos de inactividad aunque se pida otro valor.
-- ---------------------------------------------------------------------------
create or replace function public.cleanup_stale_rooms(p_before timestamptz default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  threshold timestamptz := least(coalesce(p_before, now() - interval '15 minutes'), now() - interval '10 minutes');
  removed integer;
begin
  delete from public.rooms where updated_at < threshold;
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.join_room_by_code(text) from public, anon;
revoke all on function public.abandon_room(uuid) from public, anon;
revoke all on function public.cleanup_stale_rooms(timestamptz) from public, anon;
grant execute on function public.join_room_by_code(text) to authenticated;
grant execute on function public.abandon_room(uuid) to authenticated;
grant execute on function public.cleanup_stale_rooms(timestamptz) to authenticated;

create index if not exists rooms_updated_at_idx on public.rooms (updated_at);

commit;
