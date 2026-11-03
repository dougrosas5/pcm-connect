import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import nodeHandler, { crearHandler } from '../server/pcm.ts'
import { createServer } from 'node:http'
import { nuevoPlan } from '../src/features/modulo1/modelo.ts'
import type { Actor, Comando, Registro } from '../src/features/modulo1/modelo.ts'

test('adaptador Node de Vercel responde por HTTP sin configuración y sin sesión', async () => {
  const urlAnterior = process.env.SUPABASE_URL
  const claveAnterior = process.env.SUPABASE_SERVICE_ROLE_KEY
  delete process.env.SUPABASE_URL
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  const servidor = createServer((req, res) => {
    void nodeHandler(req, res)
  })
  await new Promise<void>((resolve) => servidor.listen(0, '127.0.0.1', resolve))
  try {
    const direccion = servidor.address() as { port: number }
    const url = `http://127.0.0.1:${direccion.port}/api/pcm`
    const sinConfig = await fetch(url)
    assert.equal(sinConfig.status, 503)
    assert.match((await sinConfig.json()).message, /SUPABASE_URL/u)
    process.env.SUPABASE_URL = 'https://base-ficticia.invalid'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'clave-ficticia'
    const sinSesion = await fetch(url, { method: 'POST', body: '{}' })
    assert.equal(sinSesion.status, 401)
    assert.match((await sinSesion.json()).message, /Iniciá sesión/u)
  } finally {
    await new Promise<void>((resolve, reject) =>
      servidor.close((error) => (error ? reject(error) : resolve()))
    )
    if (urlAnterior === undefined) delete process.env.SUPABASE_URL
    else process.env.SUPABASE_URL = urlAnterior
    if (claveAnterior === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
    else process.env.SUPABASE_SERVICE_ROLE_KEY = claveAnterior
  }
})

// PostgreSQL real compilado a WASM. Solo Supabase Auth/REST se sustituye por un transporte de pruebas.
test('v1.3 servidor y migración: permisos, persistencia, concurrencia e idempotencia', async (t) => {
  const db = new PGlite()
  const sql = await readFile(
    new URL('../supabase/migrations/202611030001_modulo1.sql', import.meta.url),
    'utf8'
  )
  const pcm: Actor = {
    id: '00000000-0000-0000-0000-000000000001',
    nombre: 'PCM ficticio',
    rol: 'Planificador'
  }
  const consulta: Actor = {
    id: '00000000-0000-0000-0000-000000000002',
    nombre: 'Consulta ficticia',
    rol: 'Consulta'
  }
  const actores = [pcm, consulta]
  await db.exec(
    'create schema auth; create table auth.users(id uuid primary key); create role anon; create role authenticated; create role service_role bypassrls;'
  )
  for (const a of actores) await db.query('insert into auth.users(id) values($1)', [a.id])
  await db.exec(sql)
  for (const a of actores)
    await db.query('insert into public.pcm_perfiles(id,nombre,rol) values($1,$2,$3)', [a.id, a.nombre, a.rol])
  const transporte = (async (input, init) => {
    const url = new URL(String(input))
    const headers = new Headers(init?.headers)
    if (url.pathname === '/auth/v1/user') {
      const actor = actores.find((a) => `Bearer ${a.id}` === headers.get('Authorization'))
      return Response.json(actor ? { id: actor.id } : { message: 'Inválido' }, { status: actor ? 200 : 401 })
    }
    assert.equal(headers.get('Authorization'), 'Bearer clave-ficticia-servidor')
    if (url.pathname.endsWith('/pcm_perfiles')) {
      const id = url.searchParams.get('id')?.slice(3)
      return Response.json((await db.query('select * from public.pcm_perfiles where id=$1', [id])).rows)
    }
    if (url.pathname.endsWith('/pcm_modulo1'))
      return Response.json((await db.query('select registro from public.pcm_modulo1 where id=1')).rows)
    if (url.pathname.endsWith('/rpc/pcm_guardar')) {
      const cuerpo = JSON.parse(String(init?.body)) as {
        nuevo: Registro
        revision_esperada: number
        solicitud: string
      }
      try {
        const r = await db.query<{ registro: Registro }>(
          'select public.pcm_guardar($1::jsonb,$2,$3) as registro',
          [JSON.stringify(cuerpo.nuevo), cuerpo.revision_esperada, cuerpo.solicitud]
        )
        return Response.json(r.rows[0].registro)
      } catch (e) {
        return Response.json({ code: (e as { code: string }).code }, { status: 409 })
      }
    }
    throw new Error(`Ruta inesperada: ${url.pathname}`)
  }) as typeof fetch
  const handler = crearHandler(
    () => ({ url: 'https://base-ficticia.invalid', clave: 'clave-ficticia-servidor' }),
    transporte
  )
  let secuencia = 0
  async function leer() {
    const r = await handler(
      new Request('https://pcm-ficticio.invalid/api/pcm', { headers: { Authorization: `Bearer ${pcm.id}` } })
    )
    assert.equal(r.status, 200)
    return (await r.json()).registro as Registro
  }
  function enviar(
    comando: Comando,
    revision: number,
    actor = pcm,
    solicitud = `prueba-servidor-${++secuencia}`
  ) {
    return handler(
      new Request('https://pcm-ficticio.invalid/api/pcm', {
        method: 'POST',
        headers: { Authorization: `Bearer ${actor.id}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ comando, revision_esperada: revision, solicitud })
      })
    )
  }
  try {
    await t.test(
      'API exige identidad verificada; ignora autor inventado y rechaza rol Consulta',
      async () => {
        assert.equal((await handler(new Request('https://pcm-ficticio.invalid/api/pcm'))).status, 401)
        assert.equal(
          (
            await handler(
              new Request('https://pcm-ficticio.invalid/api/pcm', {
                headers: { Authorization: 'Bearer inventado' }
              })
            )
          ).status,
          401
        )
        const p = nuevoPlan(pcm, 'plan-servidor-000001')
        p.planificador = 'Autor falsificado'
        p.planificadorId = 'id-falsificado'
        assert.equal((await enviar({ tipo: 'guardar', plan: p, enviar: false }, 0, consulta)).status, 422)
        assert.equal((await enviar({ tipo: 'guardar', plan: p, enviar: false }, 0)).status, 200)
        assert.equal((await leer()).planes[0].planificadorId, pcm.id)
      }
    )
    await t.test('borrador persiste, TAG permanente y envío inválido no guarda parcialmente', async () => {
      const r = await leer()
      const p = r.planes[0]
      assert.equal(p.tag, 'PCM-000001')
      assert.equal(
        (await enviar({ tipo: 'guardar', plan: { ...p, horasParada: '3.5' }, enviar: false }, r.revision))
          .status,
        200
      )
      const guardado = await leer()
      assert.equal(guardado.planes[0].horasParada, '3.5')
      assert.equal(guardado.planes[0].tag, p.tag)
      assert.equal(
        (await enviar({ tipo: 'guardar', plan: guardado.planes[0], enviar: true }, guardado.revision)).status,
        422
      )
      assert.deepEqual(await leer(), guardado)
      await db.exec(sql) // Reaplicar la migración no borra datos.
      assert.deepEqual(await leer(), guardado)
    })
    await t.test('dos solicitudes concurrentes no reutilizan TAG ni pierden una actualización', async () => {
      const actual = await leer()
      const p1 = nuevoPlan(pcm, 'plan-servidor-000002')
      const p2 = nuevoPlan(pcm, 'plan-servidor-000003')
      const resultados = await Promise.all([
        enviar({ tipo: 'guardar', plan: p1, enviar: false }, actual.revision),
        enviar({ tipo: 'guardar', plan: p2, enviar: false }, actual.revision)
      ])
      assert.deepEqual(resultados.map((r) => r.status).sort(), [200, 409])
      let r = await leer()
      assert.equal(r.planes.length, 2)
      const pendiente = r.planes.some((p) => p.id === p1.id) ? p2 : p1
      assert.equal(
        (await enviar({ tipo: 'guardar', plan: pendiente, enviar: false }, r.revision)).status,
        200
      )
      r = await leer()
      assert.equal(new Set(r.planes.map((p) => p.tag)).size, 3)
      assert.equal(r.contador, 3)
    })
    await t.test('reintento con el mismo recibo no agrega plan, versión ni historial', async () => {
      const actual = await leer()
      const comando: Comando = {
        tipo: 'guardar',
        plan: nuevoPlan(pcm, 'plan-servidor-000004'),
        enviar: false
      }
      const id = 'solicitud-idempotente-servidor'
      const resultados = await Promise.all([
        enviar(comando, actual.revision, pcm, id),
        enviar(comando, actual.revision, pcm, id)
      ])
      assert.deepEqual(
        resultados.map((r) => r.status),
        [200, 200]
      )
      const despues = await leer()
      assert.equal(despues.planes.length, actual.planes.length + 1)
      assert.equal(despues.historial.length, actual.historial.length + 1)
      assert.equal((await enviar(comando, actual.revision, pcm, id)).status, 200)
      assert.deepEqual(await leer(), despues)
    })
    await t.test(
      'anon y authenticated no leen ni escriben tablas o invocan la transacción directamente',
      async () => {
        for (const rol of ['anon', 'authenticated']) {
          await db.exec(`set role ${rol}`)
          try {
            await assert.rejects(db.query('select registro from public.pcm_modulo1'), /permission denied/u)
            await assert.rejects(
              db.query('update public.pcm_modulo1 set actualizado=now()'),
              /permission denied/u
            )
            await assert.rejects(
              db.query('select public.pcm_guardar($1::jsonb,0,$2)', ['{}', 'solicitud-invalida']),
              /permission denied/u
            )
            await assert.rejects(db.query('select * from public.pcm_perfiles'), /permission denied/u)
          } finally {
            await db.exec('reset role')
          }
        }
      }
    )
    await t.test('servidor sin credenciales devuelve bloqueo concreto sin exponer secretos', async () => {
      const sinConfig = crearHandler(() => ({ url: '', clave: '' }))
      const r = await sinConfig(new Request('https://pcm-ficticio.invalid/api/pcm'))
      assert.equal(r.status, 503)
      assert.match((await r.json()).message, /SUPABASE_URL/u)
      const r2 = await handler(new Request('https://pcm-ficticio.invalid/api/pcm', { method: 'DELETE' }))
      assert.equal(r2.status, 405)
    })
  } finally {
    await db.close()
  }
})
