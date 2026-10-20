import { remolcadoresDemo } from '../data/remolcadores.ts'
import type { DatosTarea, FilaOM } from './busquedaTareas.ts'

export type Preparacion = {
  entrada: string
  filas: FilaOM[]
  avisos: string[]
  resumen: string
  revisados: Record<string, boolean>
  // Opcional para seguir leyendo los guardados anteriores sin migrarlos ni borrarlos.
  datosPorTarea?: Record<string, DatosTarea>
}

export type DatosGenerales = {
  remolcador: string
  fechaParada: string
  horasParada: string
}

export type Planificacion = {
  numero: number
  codigo: string
  remolcador: string
  fechaParada: string
  horasParada: number
  estado: 'Borrador'
  preparacion: Preparacion
}

export type RegistroPlanificaciones = {
  version: 1
  // Marca histórica independiente de la lista: nunca se reduce al quitar un plan.
  ultimoNumero: number
  activa: string | null
  planificaciones: Planificacion[]
  sinPlanificacion: Preparacion
}

export function preparacionVacia(): Preparacion {
  return { entrada: '', filas: [], avisos: [], resumen: '', revisados: {} }
}

export function registroVacio(): RegistroPlanificaciones {
  return { version: 1, ultimoNumero: 0, activa: null, planificaciones: [], sinPlanificacion: preparacionVacia() }
}

export function codigoPlanificacion(numero: number) {
  return `PCM-${String(numero).padStart(4, '0')}`
}

export function erroresDatosGenerales(datos: DatosGenerales) {
  const fecha = /^\d{4}-\d{2}-\d{2}$/u.test(datos.fechaParada) ? new Date(`${datos.fechaParada}T00:00:00Z`) : null
  return {
    remolcador: remolcadoresDemo.some(nombre => nombre === datos.remolcador) ? '' : 'Seleccioná un remolcador de la lista ficticia.',
    fechaParada: fecha && Number.isFinite(fecha.getTime()) && fecha.toISOString().slice(0, 10) === datos.fechaParada && datos.fechaParada >= '0001-01-01'
      ? '' : 'Seleccioná una fecha de parada válida.',
    horasParada: datos.horasParada.trim() !== '' && Number.isFinite(Number(datos.horasParada)) && Number(datos.horasParada) > 0
      ? '' : 'Ingresá horas mayores que 0; se admiten decimales.',
  }
}

export function crearPlanificacion(registro: RegistroPlanificaciones, datos: DatosGenerales): RegistroPlanificaciones {
  if (Object.values(erroresDatosGenerales(datos)).some(Boolean)) throw new Error('Completá los datos generales antes de crear la planificación.')
  const numero = Math.max(registro.ultimoNumero, ...registro.planificaciones.map(plan => plan.numero)) + 1
  if (!Number.isSafeInteger(numero)) throw new Error('Se alcanzó el límite de numeración local.')
  const plan: Planificacion = {
    numero, codigo: codigoPlanificacion(numero), remolcador: datos.remolcador,
    fechaParada: datos.fechaParada, horasParada: Number(datos.horasParada), estado: 'Borrador',
    // El borrador sin cabecera se incorpora una sola vez, sin reconstruir sus OM.
    preparacion: registro.sinPlanificacion,
  }
  return {
    ...registro, ultimoNumero: numero, activa: plan.codigo,
    planificaciones: [...registro.planificaciones, plan], sinPlanificacion: preparacionVacia(),
  }
}

export function actualizarPreparacion(registro: RegistroPlanificaciones, codigo: string | null, cambios: Partial<Preparacion>): RegistroPlanificaciones {
  if (codigo === null) return { ...registro, sinPlanificacion: { ...registro.sinPlanificacion, ...cambios } }
  if (!registro.planificaciones.some(plan => plan.codigo === codigo)) throw new Error('La planificación ya no está disponible. Volvé a abrirla.')
  return {
    ...registro,
    planificaciones: registro.planificaciones.map(plan => plan.codigo === codigo
      ? { ...plan, preparacion: { ...plan.preparacion, ...cambios } } : plan),
  }
}
