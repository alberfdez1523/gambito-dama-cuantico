/**
 * Aplica todas las migraciones de Supabase sobre Postgres embebido (PGlite) y
 * comprueba las reglas de acceso de las salas online heredadas.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const MIGRATIONS_DIR = fileURLToPath(new URL('../../supabase/migrations/', import.meta.url))

// Los tres usuarios comparten los 6 primeros caracteres hex a propósito.
const HOST = 'aaaaaaaa-0000-0000-0000-00000000000a'
const GUEST = 'aaaaaaaa-0000-0000-0000-00000000000b'
const OUTSIDER = 'aaaaaaaa-0000-0000-0000-00000000000c'

let db: PGlite

/** Stubs mínimos de lo que Supabase aporta fuera de nuestras migraciones. */
const SUPABASE_STUBS = `
  create role anon; create role authenticated; create role service_role;
  create schema auth; create schema extensions;
  create table auth.users (id uuid primary key, is_anonymous boolean default false);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  create publication supabase_realtime;
`

type Outcome = { ok: true; rows: Record<string, unknown>[] } | { ok: false; error: string }

async function as(user: string, sql: string): Promise<Outcome> {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${user}', false); set role authenticated;`)
  try {
    const result = await db.query<Record<string, unknown>>(sql)
    return { ok: true, rows: result.rows }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  } finally {
    await db.exec('reset role')
  }
}

function rows(outcome: Outcome) {
  if (!outcome.ok) throw new Error(`Expected success, got: ${outcome.error}`)
  return outcome.rows
}

function error(outcome: Outcome) {
  if (outcome.ok) throw new Error(`Expected failure, got rows: ${JSON.stringify(outcome.rows)}`)
  return outcome.error
}

async function createRoom(code: string, mode: 'classic' | 'quantum' = 'quantum') {
  const [room] = rows(await as(HOST, `
    insert into public.rooms (code, mode, status, host_color, white_player_id, state, version, turn, measurement_seed)
    values ('${code}', '${mode}', 'waiting', 'w', '${HOST}', '{}', 0, 'w', 'chosen-by-host')
    returning id, measurement_seed`))
  return room as { id: string; measurement_seed: string | null }
}

beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } })
  await db.exec(SUPABASE_STUBS)
  for (const file of readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(`${MIGRATIONS_DIR}${file}`, 'utf8'))
  }
  await db.exec(`
    insert into auth.users (id) values ('${HOST}'), ('${GUEST}'), ('${OUTSIDER}');
    grant usage on schema public to authenticated;
  `)
}, 60_000)

afterAll(async () => {
  await db?.close()
})

describe('profiles', () => {
  it('gives unique aliases to users whose UUIDs share a prefix', async () => {
    const result = await db.query<{ alias: string }>('select alias from public.profiles')
    expect(new Set(result.rows.map((row) => row.alias)).size).toBe(3)
  })
})

describe('legacy rooms', () => {
  it('assigns the measurement seed server-side and hides waiting rooms', async () => {
    const room = await createRoom('ABCDEF')
    expect(room.measurement_seed).not.toBe('chosen-by-host')
    expect(room.measurement_seed).toHaveLength(64)
    expect(rows(await as(OUTSIDER, 'select id from public.rooms'))).toHaveLength(0)
    expect((await createRoom('CLASSC', 'classic')).measurement_seed).toBeNull()
  })

  it('rejects rooms whose creator also occupies the rival seat', async () => {
    error(await as(HOST, `
      insert into public.rooms (code, mode, status, host_color, white_player_id, black_player_id, state, version, turn)
      values ('ABCDEG', 'classic', 'waiting', 'w', '${HOST}', '${GUEST}', '{}', 0, 'w')`))
  })

  it('joins only through the RPC and enforces seats, turns and versions', async () => {
    const { id } = await createRoom('JOINME')

    const direct = await as(OUTSIDER, `update public.rooms set black_player_id = '${OUTSIDER}' where id = '${id}' returning id`)
    expect(direct.ok ? direct.rows : []).toHaveLength(0)

    const [{ joined }] = rows(await as(GUEST, `select public.join_room_by_code(' join me ') as joined`)) as [{ joined: { client_color: string; status: string } }]
    expect(joined).toMatchObject({ client_color: 'b', status: 'playing' })
    expect(error(await as(OUTSIDER, `select public.join_room_by_code('JOINME')`))).toContain('ROOM_FULL')
    expect(error(await as(OUTSIDER, `select public.join_room_by_code('ZZZZZZ')`))).toContain('ROOM_NOT_FOUND')

    expect(error(await as(GUEST, `update public.rooms set white_player_id = '${GUEST}' where id = '${id}'`))).toContain('seats')
    expect(error(await as(GUEST, `update public.rooms set state = '{"m":1}', turn = 'b', version = 1 where id = '${id}'`))).toContain('not_your_turn')
    expect(error(await as(HOST, `update public.rooms set state = '{"m":1}', turn = 'b', version = 7 where id = '${id}'`))).toContain('version_must_increment')
    rows(await as(HOST, `update public.rooms set state = '{"m":1}', turn = 'b', version = 1 where id = '${id}' returning id`))

    expect(error(await as(HOST, `update public.rooms set measurement_seed = 'mine', state = '{"m":2}', version = 2 where id = '${id}'`))).toContain('measurement_seed')
    // Una medición pendiente la puede resolver el jugador sin turno si no lo pasa.
    rows(await as(HOST, `update public.rooms set state = '{"pending":true}', version = 2 where id = '${id}' returning id`))
    expect(error(await as(GUEST, `update public.rooms set status = 'waiting' where id = '${id}'`))).toContain('invalid_status_transition')
    rows(await as(GUEST, `update public.rooms set status = 'finished', state = '{"r":1}', version = 3 where id = '${id}' returning id`))

    const [{ measurement_seed: seed }] = (await db.query<{ measurement_seed: string }>(`select measurement_seed from public.rooms where id = '${id}'`)).rows
    rows(await as(HOST, `update public.rooms set status = 'playing', turn = 'w', state = '{}', version = 4, measurement_seed = '${seed}:r4' where id = '${id}' returning id`))

    error(await as(HOST, `insert into public.room_moves (room_id, version, actor_color, mode, state) values ('${id}', 4, 'b', 'quantum', '{}')`))
    rows(await as(HOST, `insert into public.room_moves (room_id, version, actor_color, mode, state) values ('${id}', 4, 'w', 'quantum', '{}') returning version`))
  })

  it('abandons only as a participant and cleans up only inactive rooms', async () => {
    const { id } = await createRoom('LEAVEX')
    expect(error(await as(OUTSIDER, `select public.abandon_room('${id}')`))).toContain('room_not_found_or_not_allowed')

    await db.exec(`update public.rooms set updated_at = now() - interval '5 minutes'`)
    expect(rows(await as(OUTSIDER, `select public.cleanup_stale_rooms(now() + interval '1 day') as removed`))[0].removed).toBe(0)

    rows(await as(HOST, `select public.abandon_room('${id}')`))
    expect(error(await as(HOST, `select public.join_room_by_code('LEAVEX')`))).toContain('ROOM_NOT_FOUND')

    await db.exec(`update public.rooms set updated_at = now() - interval '20 minutes'`)
    expect(rows(await as(OUTSIDER, `select public.cleanup_stale_rooms(now() - interval '15 minutes') as removed`))[0].removed).toBeGreaterThan(0)
  })
})
