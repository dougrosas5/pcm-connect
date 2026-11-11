import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { registroInicial } from '../src/features/planificacion/model/modelo.ts'

test('v1.3 sesión: identidad, renovación, cierre HTTP 204 y errores sin fallback local', async () => {
  const fetchOriginal = globalThis.fetch
  const windowOriginal = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const urlOriginal = process.env.VITE_SUPABASE_URL
  const claveOriginal = process.env.VITE_SUPABASE_ANON_KEY
  process.env.VITE_SUPABASE_URL = 'https://supabase-ficticio.invalid'
  process.env.VITE_SUPABASE_ANON_KEY = 'clave-publica-ficticia'
  const almacenamiento = new Map<string, string>()
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (k: string) => almacenamiento.get(k) ?? null,
        setItem: (k: string, v: string) => almacenamiento.set(k, v),
        removeItem: (k: string) => almacenamiento.delete(k)
      }
    }
  })
  let renovaciones = 0
  let errorAPI = false
  let errorLogout = false
  globalThis.fetch = (async (input, opciones) => {
    const ruta = String(input)
    if (ruta.includes('/token?grant_type=')) {
      if (ruta.includes('refresh_token')) renovaciones++
      return Response.json({
        access_token: 'token-ficticio',
        refresh_token: 'refresh-ficticio',
        expires_in: 3600
      })
    }
    if (ruta.endsWith('/logout'))
      return errorLogout
        ? Response.json({ message: 'Sin conexión de prueba' }, { status: 503 })
        : new Response(null, { status: 204 })
    assert.equal(ruta, '/api/pcm')
    assert.equal(new Headers(opciones?.headers).get('Authorization'), 'Bearer token-ficticio')
    if (errorAPI) return Response.json({ message: 'Error de servidor de prueba' }, { status: 503 })
    return Response.json({
      registro: registroInicial(),
      actor: { id: 'usuario-ficticio', nombre: 'Usuario ficticio', rol: 'Consulta' }
    })
  }) as typeof fetch
  const vite = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: 'custom'
  })
  try {
    const repositorio = await vite.ssrLoadModule('/src/services/pcm/persistencia.ts')
    assert.equal(repositorio.conectado, true)
    await repositorio.iniciarSesion('usuario@example.invalid', 'contraseña-completamente-ficticia')
    assert.equal((await repositorio.cargar()).actor.rol, 'Consulta')
    const sesion = repositorio.leerSesion()
    sesion.expires_at = 0
    almacenamiento.set('pcm-connect.auth.v13', JSON.stringify(sesion))
    await repositorio.cargar()
    assert.equal(renovaciones, 1)
    errorAPI = true
    await assert.rejects(repositorio.cargar(), /Error de servidor de prueba/u)
    assert.equal(await repositorio.cerrarSesion(), true)
    assert.equal(repositorio.leerSesion(), null)
    await assert.rejects(repositorio.cargar(), /Iniciá sesión/u)
    await repositorio.iniciarSesion('usuario@example.invalid', 'contraseña-completamente-ficticia')
    errorLogout = true
    assert.equal(await repositorio.cerrarSesion(), false)
    assert.equal(repositorio.leerSesion(), null)
    assert.equal(almacenamiento.has('pcm-connect.modulo1.v13'), false)
  } finally {
    await vite.close()
    globalThis.fetch = fetchOriginal
    if (windowOriginal) Object.defineProperty(globalThis, 'window', windowOriginal)
    else Reflect.deleteProperty(globalThis, 'window')
    if (urlOriginal === undefined) delete process.env.VITE_SUPABASE_URL
    else process.env.VITE_SUPABASE_URL = urlOriginal
    if (claveOriginal === undefined) delete process.env.VITE_SUPABASE_ANON_KEY
    else process.env.VITE_SUPABASE_ANON_KEY = claveOriginal
  }
})
