-- El alias automático usaba solo 6 caracteres hex del UUID. Con unos miles de
-- usuarios dos cuentas acaban compartiendo prefijo y, por el índice único
-- `profiles_alias_casefold_idx`, el alta en auth.users (incluido el inicio de
-- sesión anónimo del online) fallaba. Ahora se alarga el sufijo hasta que es único.

begin;

create or replace function private.handle_new_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  hex text := upper(replace(new.id::text, '-', ''));
  suffix_length integer := 6;
begin
  loop
    begin
      insert into public.profiles (id, alias)
      values (new.id, 'Jugador-' || substr(hex, 1, suffix_length))
      on conflict (id) do nothing;
      return new;
    exception when unique_violation then
      -- 'Jugador-' + 16 caracteres = 24, el máximo permitido por el check.
      if suffix_length >= 16 then
        raise;
      end if;
      suffix_length := suffix_length + 2;
    end;
  end loop;
end;
$$;

revoke all on function private.handle_new_profile() from public, anon, authenticated;

commit;
