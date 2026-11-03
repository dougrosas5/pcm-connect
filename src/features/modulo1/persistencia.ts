import { aplicarComando, registroInicial } from './modelo.ts'
import type { Actor, Comando, Registro } from './modelo.ts'
import { validarComando } from './validacion.ts'

export const claveModulo1 = 'pcm-connect.modulo1.v13'
const claveSesion = 'pcm-connect.auth.v13'
const url = (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/$/u, '')
const clavePublica = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
export const conectado = Boolean(url && clavePublica)
export const configuracionIncompleta = Boolean(url) !== Boolean(clavePublica)
export type Sesion = { access_token: string; refresh_token: string; expires_at: number }
export type Carga = { registro: Registro; actor: Actor }
export const actorDemo: Actor = { id: 'demo-local', nombre: 'Planificador demo', rol: 'Planificador' }

// Nunca se reemplaza un JSON corrupto por un registro vacío ni se toca la clave v1.
export function validarRegistro(valor: unknown): asserts valor is Registro {
  const r = valor as Registro
  if (
    !r ||
    r.esquema !== 13 ||
    !Number.isSafeInteger(r.revision) ||
    r.revision < 0 ||
    !Number.isSafeInteger(r.contador) ||
    r.contador < 0 ||
    !Array.isArray(r.planes) ||
    !Array.isArray(r.fuente) ||
    !Array.isArray(r.historial) ||
    !Array.isArray(r.importaciones) ||
    !r.catalogos ||
    !['remolcadores', 'ubicaciones', 'responsables'].every((k) =>
      Array.isArray(r.catalogos[k as keyof typeof r.catalogos])
    ) ||
    !r.solicitudes ||
    r.planes.some((p) => !p.id || !p.tag || !Array.isArray(p.filas) || !Number.isSafeInteger(p.version)) ||
    new Set(r.planes.map((p) => p.id)).size !== r.planes.length ||
    new Set(r.planes.map((p) => p.tag)).size !== r.planes.length ||
    r.planes.some((p) => !/^PCM-\d{6,}$/u.test(p.tag) || Number(p.tag.slice(4)) > r.contador)
  )
    throw new Error(
      'El guardado del Módulo 1 está dañado o tiene otra versión. No se sobrescribió; conservá una copia y revisalo.'
    )
  for (const p of r.planes) {
    validarComando({ tipo: 'guardar', plan: p, enviar: false })
    if (
      !p.referencias ||
      !p.evaluaciones ||
      !['Borrador', 'Enviado a Taller', 'En evaluación', 'Evaluado'].includes(p.estado)
    )
      throw new Error('La planificación guardada está incompleta; no se modificó.')
  }
  for (const [catalogo, entradas] of Object.entries(r.catalogos))
    for (const entrada of entradas) validarComando({ tipo: 'catalogo', catalogo, entrada })
  if (r.fuente.length)
    validarComando({ tipo: 'importar', procedencia: 'Validación del guardado', tareas: r.fuente })
}
export function leerLocal(almacen: Pick<Storage, 'getItem'>): Registro {
  const texto = almacen.getItem(claveModulo1)
  if (!texto) return registroInicial()
  const valor: unknown = JSON.parse(texto)
  validarRegistro(valor)
  return valor
}
export function leerSesion(): Sesion | null {
  try {
    return JSON.parse(window.localStorage.getItem(claveSesion) ?? 'null') as Sesion | null
  } catch {
    return null
  }
}
async function pedir(ruta: string, cuerpo?: unknown, sesion?: Sesion): Promise<unknown> {
  const respuesta = await fetch(`${url}${ruta}`, {
    method: cuerpo === undefined ? 'GET' : 'POST',
    headers: {
      apikey: clavePublica,
      'Content-Type': 'application/json',
      ...(sesion ? { Authorization: `Bearer ${sesion.access_token}` } : {})
    },
    ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
    signal: AbortSignal.timeout(30000)
  })
  if (respuesta.status === 204) return null
  const datos = await respuesta.json()
  if (!respuesta.ok)
    throw new Error(
      datos.message ??
        datos.msg ??
        datos.error_description ??
        'No se pudo completar la operación. Volvé a intentar.'
    )
  return datos
}
export async function iniciarSesion(email: string, password: string): Promise<Sesion> {
  const datos = (await pedir('/auth/v1/token?grant_type=password', { email, password })) as Sesion & {
    expires_in: number
  }
  const sesion = {
    access_token: datos.access_token,
    refresh_token: datos.refresh_token,
    expires_at: Date.now() + datos.expires_in * 1000
  }
  window.localStorage.setItem(claveSesion, JSON.stringify(sesion))
  return sesion
}
async function sesionVigente(): Promise<Sesion> {
  let sesion = leerSesion()
  if (!sesion) throw new Error('Iniciá sesión para acceder a las planificaciones.')
  if (sesion.expires_at <= Date.now() + 60000) {
    const datos = (await pedir('/auth/v1/token?grant_type=refresh_token', {
      refresh_token: sesion.refresh_token
    })) as Sesion & { expires_in: number }
    sesion = {
      access_token: datos.access_token,
      refresh_token: datos.refresh_token,
      expires_at: Date.now() + datos.expires_in * 1000
    }
    window.localStorage.setItem(claveSesion, JSON.stringify(sesion))
  }
  return sesion
}
async function pedirAPI(cuerpo?: unknown): Promise<Carga> {
  const sesion = await sesionVigente()
  const r = await fetch('/api/pcm', {
    method: cuerpo === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${sesion.access_token}`, 'Content-Type': 'application/json' },
    ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
    signal: AbortSignal.timeout(30000)
  })
  const datos = await r.json()
  if (!r.ok) throw new Error(datos.message ?? 'No se pudo completar la operación.')
  validarRegistro(datos.registro)
  return datos as Carga
}
export async function cerrarSesion() {
  const sesion = leerSesion()
  let remoto = true
  try {
    if (sesion) await pedir('/auth/v1/logout', {}, sesion)
  } catch {
    remoto = false
  }
  window.localStorage.removeItem(claveSesion)
  return remoto
}
export async function cargar(actor: Actor = actorDemo): Promise<Carga> {
  if (configuracionIncompleta)
    throw new Error('Configuración incompleta: faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY.')
  if (!conectado) return { registro: leerLocal(window.localStorage), actor }
  return pedirAPI()
}
export async function ejecutar(
  comando: Comando,
  revision: number,
  actor: Actor,
  solicitud: string
): Promise<Carga> {
  if (conectado) {
    return pedirAPI({ comando, revision_esperada: revision, solicitud })
  }
  const cambiar = async () => {
    const actual = leerLocal(window.localStorage)
    if (actual.solicitudes[solicitud] !== undefined) return { registro: actual, actor }
    if (actual.revision !== revision)
      throw new Error(
        'Los datos cambiaron en otra pestaña. Actualizá los datos antes de guardar; tus cambios siguen en pantalla.'
      )
    const registro = aplicarComando(actual, comando, actor, solicitud, new Date().toISOString())
    window.localStorage.setItem(claveModulo1, JSON.stringify(registro))
    return { registro, actor }
  }
  // Web Locks serializa las pestañas del mismo navegador. No simula una base multiusuario.
  if (!navigator.locks)
    throw new Error(
      'El navegador no admite guardado local concurrente seguro. Usá un navegador moderno o configurá el servidor.'
    )
  return navigator.locks.request(claveModulo1, cambiar)
}
