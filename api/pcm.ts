import { aplicarComando } from '../src/features/modulo1/modelo.ts'
import type { Actor, Comando, Registro, Rol } from '../src/features/modulo1/modelo.ts'
import { validarComando } from '../src/features/modulo1/validacion.ts'
import type { IncomingMessage, ServerResponse } from 'node:http'

type Configuracion = { url: string; clave: string }
function respuesta(datos: unknown, estado = 200) {
  return Response.json(datos, {
    status: estado,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
  })
}
// Dependencias explícitas para probar HTTP/autenticación sin llamar a cuentas reales.
export function crearHandler(configuracion: () => Configuracion, solicitar: typeof fetch = fetch) {
  return async (request: Request): Promise<Response> => {
    if (!['GET', 'POST'].includes(request.method)) return respuesta({ message: 'Método no permitido.' }, 405)
    const config = configuracion()
    if (!config.url || !config.clave)
      return respuesta(
        { message: 'Servidor sin configurar: faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.' },
        503
      )
    const token = request.headers.get('Authorization') ?? ''
    if (!/^Bearer \S+$/u.test(token)) return respuesta({ message: 'Iniciá sesión.' }, 401)
    try {
      const usuarioRespuesta = await solicitar(`${config.url}/auth/v1/user`, {
        headers: { apikey: config.clave, Authorization: token },
        signal: AbortSignal.timeout(15000)
      })
      if (!usuarioRespuesta.ok)
        return respuesta({ message: 'La sesión venció o no es válida. Volvé a iniciar sesión.' }, 401)
      const usuario = (await usuarioRespuesta.json()) as { id: string }
      if (!usuario.id) return respuesta({ message: 'Sesión inválida.' }, 401)
      async function db(ruta: string, cuerpo?: unknown): Promise<unknown> {
        const r = await solicitar(`${config.url}/rest/v1/${ruta}`, {
          method: cuerpo === undefined ? 'GET' : 'POST',
          headers: {
            apikey: config.clave,
            Authorization: `Bearer ${config.clave}`,
            'Content-Type': 'application/json'
          },
          ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
          signal: AbortSignal.timeout(15000)
        })
        const datos = (await r.json()) as { code?: string }
        if (!r.ok) {
          if (datos.code === '40001') throw new Error('CONFLICTO')
          // No devolver mensajes de infraestructura, tokens ni consultas al navegador.
          throw new Error(
            'No se pudo acceder al almacenamiento. Revisá la migración y la configuración del servidor.'
          )
        }
        return datos
      }
      const perfiles = (await db(
        `pcm_perfiles?id=eq.${encodeURIComponent(usuario.id)}&select=id,nombre,rol,activo`
      )) as (Actor & { activo: boolean })[]
      const perfil = perfiles[0]
      const roles: Rol[] = ['Planificador', 'Taller', 'Administrador', 'Consulta']
      if (!perfil?.activo || !roles.includes(perfil.rol))
        return respuesta({ message: 'La cuenta no tiene un perfil activo autorizado en PCM Connect.' }, 403)
      const actor: Actor = { id: perfil.id, nombre: perfil.nombre, rol: perfil.rol }
      const filas = (await db('pcm_modulo1?id=eq.1&select=registro')) as { registro: Registro }[]
      const registro = filas[0]?.registro
      if (!registro)
        return respuesta({ message: 'Falta inicializar el Módulo 1. Aplicá la migración SQL.' }, 503)
      if (request.method === 'GET') return respuesta({ registro, actor })
      const texto = await request.text()
      if (texto.length > 3_000_000)
        return respuesta({ message: 'La solicitud es demasiado grande. Reducí la importación.' }, 413)
      let datos: { comando: Comando; revision_esperada: number; solicitud: string }
      try {
        datos = JSON.parse(texto)
      } catch {
        return respuesta({ message: 'JSON inválido.' }, 400)
      }
      if (
        !datos ||
        !Number.isSafeInteger(datos.revision_esperada) ||
        typeof datos.solicitud !== 'string' ||
        !/^[a-zA-Z0-9-]{16,80}$/u.test(datos.solicitud)
      )
        return respuesta({ message: 'Solicitud o versión inválida.' }, 400)
      const solicitud = `${actor.id}:${datos.solicitud}`
      if (registro.solicitudes[solicitud] !== undefined) return respuesta({ registro, actor })
      if (registro.revision !== datos.revision_esperada)
        return respuesta(
          {
            message: 'Los datos cambiaron. Actualizá antes de guardar; conservá tus cambios para compararlos.'
          },
          409
        )
      let siguiente: Registro
      try {
        validarComando(datos.comando)
        siguiente = aplicarComando(registro, datos.comando, actor, solicitud, new Date().toISOString())
      } catch (error) {
        return respuesta({ message: error instanceof Error ? error.message : 'Datos inválidos.' }, 422)
      }
      const guardado = (await db('rpc/pcm_guardar', {
        nuevo: siguiente,
        revision_esperada: registro.revision,
        solicitud
      })) as Registro
      return respuesta({ registro: guardado, actor })
    } catch (error) {
      if (error instanceof Error && error.message === 'CONFLICTO')
        return respuesta(
          {
            message:
              'Otra solicitud guardó cambios simultáneamente. Actualizá los datos; tus cambios siguen en pantalla.'
          },
          409
        )
      return respuesta(
        {
          message:
            error instanceof Error && error.message.startsWith('No se pudo acceder')
              ? error.message
              : 'No se pudo completar la operación. Revisá la conexión y reintentá la misma acción.'
        },
        503
      )
    }
  }
}

const atender = crearHandler(() => ({
  url: (process.env.SUPABASE_URL ?? '').replace(/\/$/u, ''),
  clave: process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
}))

// Adaptador Node tradicional de Vercel. La lógica HTTP de negocio sigue usando Request/Response.
export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  try {
    const headers = new Headers()
    for (const [clave, valor] of Object.entries(req.headers)) {
      if (valor) headers.set(clave, Array.isArray(valor) ? valor.join(',') : valor)
    }
    let cuerpo: string | undefined
    if (!['GET', 'HEAD'].includes(req.method ?? 'GET')) {
      if (req.body !== undefined) cuerpo = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
      else {
        const partes: Buffer[] = []
        let bytes = 0
        for await (const parte of req) {
          const buffer = Buffer.from(parte)
          bytes += buffer.length
          if (bytes > 3_000_000) {
            res.writeHead(413, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ message: 'La solicitud es demasiado grande.' }))
            return
          }
          partes.push(buffer)
        }
        cuerpo = Buffer.concat(partes).toString('utf8')
      }
    }
    const resultado = await atender(
      new Request('http://localhost/api/pcm', {
        method: req.method,
        headers,
        ...(cuerpo === undefined ? {} : { body: cuerpo })
      })
    )
    res.statusCode = resultado.status
    resultado.headers.forEach((valor, clave) => res.setHeader(clave, valor))
    res.end(await resultado.text())
  } catch {
    res.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
    res.end(JSON.stringify({ message: 'No se pudo atender la API. Revisá la configuración del servidor.' }))
  }
}
