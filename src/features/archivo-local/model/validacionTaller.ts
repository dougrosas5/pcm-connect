import { tareasDemo } from '../data/tareas.ts'
import { datosDeTarea, errorDuracion, errorPersonas, errorResponsable } from './busquedaTareas.ts'
import type { DatosTarea } from './busquedaTareas.ts'
import type { Planificacion, Preparacion, RegistroPlanificaciones } from './planificaciones.ts'

export type RolDemo = 'PCM' | 'Taller' | 'Encargado Douglas' | 'Encargado Ale' | 'Encargado Pepe'
export type Actor = { rol: RolDemo; usuario: string }
export const rolesDemo: RolDemo[] = ['PCM', 'Taller', 'Encargado Douglas', 'Encargado Ale', 'Encargado Pepe']
export const actorPCM: Actor = { rol: 'PCM', usuario: 'PCM demo' }
export type EstadoPlan = 'Borrador' | 'Pendiente de Taller' | 'Pendiente de PCM' | 'En revisión' | 'Confirmada' | 'Cancelada'
export const estadosPlan: EstadoPlan[] = ['Borrador', 'Pendiente de Taller', 'Pendiente de PCM', 'En revisión', 'Confirmada', 'Cancelada']
export type ResultadoOM = 'Pendiente' | 'Viable' | 'No viable'
export type DatosOM = DatosTarea & { descripcion: string; costo?: number }
export type RevisionOM = {
  revision: number
  resultado: ResultadoOM
  motivo: string
  evaluada?: number
  congelada: boolean
  cancelada: boolean
  // Datos individuales solo cuando hay una corrección; la preparación agrupada se conserva.
  datos?: DatosOM
}
export type EventoTaller = {
  tipo: string; fecha: string; usuario: string; rol: RolDemo; planificacion: string
  om?: string; revision?: number; detalle: string; anterior?: string; nuevo?: string
}
export type TallerPlan = { version: 1; ordenes: Record<string, RevisionOM>; historial: EventoTaller[] }

// Una única frontera de permisos para reemplazar por identidad del servidor en el futuro.
// Estos controles son lógica de demo, no autenticación ni seguridad real.
export function permisos(actor: Actor) {
  return { organizar: actor.rol === 'PCM', evaluar: actor.rol === 'Taller',
    corregir: actor.rol === 'PCM' || actor.rol === 'Taller',
    cancelarAceptada: false }
}
function exigir(condicion: boolean, mensaje: string): asserts condicion {
  if (!condicion) throw new Error(mensaje)
}
export function nuevaRevision(): RevisionOM {
  return { revision: 1, resultado: 'Pendiente', motivo: '', congelada: false, cancelada: false }
}
export function tallerDe(plan: Planificacion): TallerPlan {
  return plan.taller ?? { version: 1, ordenes: {}, historial: [] }
}
export function revisionDe(plan: Planificacion, om: string): RevisionOM {
  return tallerDe(plan).ordenes[om] ?? nuevaRevision()
}
export function datosOM(plan: Planificacion, numero: string): DatosOM {
  const fila = plan.preparacion.filas.find(item => item.numero === numero)
  exigir(fila !== undefined, 'La OM ya no está en esta planificación.')
  const comunes = datosDeTarea(tareasDemo.find(item => item.numero === fila.tarea),
    plan.preparacion.filas.filter(item => item.tarea === fila.tarea), plan.preparacion.datosPorTarea?.[fila.tarea]).datos
  return revisionDe(plan, numero).datos ?? { ...comunes, descripcion: fila.descripcion, ...(fila.costo === undefined ? {} : { costo: fila.costo }) }
}
function validarDatos(datos: DatosOM) {
  const error = errorDuracion(datos.duracionPrevista) || errorPersonas(datos.personas) || errorResponsable(datos.responsable)
  exigir(!error, `Completá los datos del trabajo. ${error}`)
  exigir(datos.descripcion.trim().length > 0, 'Completá la descripción del trabajo.')
  exigir(datos.costo === undefined || (Number.isFinite(datos.costo) && datos.costo >= 0), 'Ingresá un costo mayor o igual a cero, o dejalo sin definir.')
}
function evento(plan: Planificacion, actor: Actor, tipo: string, detalle: string, extra: Partial<EventoTaller> = {}): Planificacion {
  const taller = tallerDe(plan)
  return { ...plan, taller: { ...taller, historial: [...taller.historial, {
    ...extra, tipo, detalle, fecha: new Date().toISOString(), usuario: actor.usuario, rol: actor.rol, planificacion: plan.codigo,
  }] } }
}
export function registrarCreacion(plan: Planificacion, actor: Actor): Planificacion {
  return evento(plan, actor, 'Creación', 'Planificación creada en la demo local.')
}
function conPlan(registro: RegistroPlanificaciones, codigo: string, cambiar: (plan: Planificacion) => Planificacion): RegistroPlanificaciones {
  exigir(registro.planificaciones.some(plan => plan.codigo === codigo), 'La planificación ya no está disponible.')
  return { ...registro, planificaciones: registro.planificaciones.map(plan => plan.codigo === codigo ? cambiar(plan) : plan) }
}
function guardarRevision(plan: Planificacion, om: string, revision: RevisionOM): Planificacion {
  return { ...plan, taller: { ...tallerDe(plan), ordenes: { ...tallerDe(plan).ordenes, [om]: revision } } }
}
export function preparacionEditable(plan: Planificacion, actor: Actor) {
  return permisos(actor).organizar && (plan.estado === 'Borrador' || plan.estado === 'Pendiente de Taller')
}
export function tareaEditable(plan: Planificacion, tarea: string, actor: Actor) {
  return preparacionEditable(plan, actor) && !plan.preparacion.filas.some(fila => fila.tarea === tarea && revisionDe(plan, fila.numero).congelada)
}

// Compara los datos efectivos: un cambio de campos comunes afecta solo las OM de esa tarea.
// Las correcciones individuales y las aprobaciones congeladas mantienen su propia instantánea.
export function reconciliarPreparacion(plan: Planificacion, preparacion: Preparacion, actor: Actor): Planificacion {
  exigir(preparacionEditable(plan, actor), 'La preparación está en solo lectura para este rol o etapa.')
  let siguiente = { ...plan, preparacion }
  for (const fila of plan.preparacion.filas) {
    const revision = revisionDe(plan, fila.numero)
    const vigente = preparacion.filas.find(item => item.numero === fila.numero)
    if (!vigente) {
      exigir(!revision.congelada && revision.resultado !== 'Viable', 'Una OM aceptada requiere cancelación controlada; permisos pendientes de definición.')
      exigir(plan.estado === 'Borrador', 'Solo se quitan trabajos de una planificación en borrador.')
      siguiente = evento(siguiente, actor, 'OM quitada', `Se quitó ${fila.numero} de la preparación.`, { om: fila.numero, anterior: JSON.stringify(datosOM(plan, fila.numero)), nuevo: 'Fuera de preparación' })
      continue
    }
    if (revision.congelada) {
      exigir(JSON.stringify(fila) === JSON.stringify(vigente)
        && JSON.stringify(plan.preparacion.datosPorTarea?.[fila.tarea]) === JSON.stringify(preparacion.datosPorTarea?.[fila.tarea]),
      'Los datos aprobados están congelados. Corregí únicamente las OM no congeladas desde Validación Taller.')
    }
    const anterior = datosOM(plan, fila.numero)
    const nuevo = datosOM(siguiente, fila.numero)
    if (JSON.stringify(anterior) === JSON.stringify(nuevo)) continue
    exigir(!revision.congelada, 'Los datos aprobados están congelados.')
    siguiente = guardarRevision(siguiente, fila.numero, { ...revision, revision: revision.revision + 1, resultado: 'Pendiente', motivo: '' })
    siguiente = evento(siguiente, actor, 'Modificación / reevaluación', 'Datos modificados; se requiere evaluar la revisión vigente.', {
      om: fila.numero, revision: revision.revision + 1, anterior: JSON.stringify(anterior), nuevo: JSON.stringify(nuevo),
    })
  }
  for (const fila of preparacion.filas) {
    if (!plan.preparacion.filas.some(item => item.numero === fila.numero)) {
      const previa = tallerDe(plan).ordenes[fila.numero]
      exigir(!previa?.cancelada && !previa?.congelada, 'Una OM cancelada o congelada no puede reincorporarse.')
      const revision = previa ? previa.revision + 1 : 1
      siguiente = guardarRevision(siguiente, fila.numero, { ...nuevaRevision(), revision })
      siguiente = evento(siguiente, actor, 'OM incorporada', `Tarea ${fila.tarea}: ${fila.numero}.`, { om: fila.numero, revision, nuevo: JSON.stringify(datosOM(siguiente, fila.numero)) })
    }
  }
  return siguiente
}
export function enviarATaller(registro: RegistroPlanificaciones, codigo: string, actor: Actor) {
  exigir(permisos(actor).organizar, 'Solo PCM puede enviar a Taller.')
  return conPlan(registro, codigo, plan => {
    exigir(plan.estado === 'Borrador' || plan.estado === 'En revisión', 'La planificación no está disponible para envío.')
    exigir(plan.preparacion.filas.some(fila => !revisionDe(plan, fila.numero).cancelada), 'Agregá al menos una OM activa antes de enviar.')
    let siguiente = plan
    for (const fila of plan.preparacion.filas) {
      const revision = revisionDe(siguiente, fila.numero)
      if (revision.cancelada) continue
      validarDatos(datosOM(siguiente, fila.numero))
      if (!revision.congelada) {
        siguiente = guardarRevision(siguiente, fila.numero, { ...revision, resultado: 'Pendiente', motivo: '' })
      }
    }
    return evento({ ...siguiente, estado: 'Pendiente de Taller' }, actor, 'Envío a Taller', 'Se enviaron las revisiones vigentes a evaluación.')
  })
}
export function evaluarOM(registro: RegistroPlanificaciones, codigo: string, om: string, resultado: ResultadoOM, motivo: string, revisionEsperada: number, actor: Actor) {
  exigir(permisos(actor).evaluar, 'Solo Taller puede evaluar viabilidad.')
  exigir(['Pendiente', 'Viable', 'No viable'].includes(resultado), 'Resultado inválido.')
  exigir(resultado !== 'No viable' || motivo.trim().length > 0, 'El motivo de rechazo es obligatorio.')
  return conPlan(registro, codigo, plan => {
    const revision = revisionDe(plan, om)
    exigir(plan.estado === 'Pendiente de Taller' && !revision.congelada && !revision.cancelada, 'Esta OM no está disponible para evaluación.')
    exigir(revision.revision === revisionEsperada, 'La OM cambió. Revisá sus datos actuales y volvé a evaluar.')
    const datos = datosOM(plan, om)
    validarDatos(datos)
    const siguiente = guardarRevision(plan, om, { ...revision, resultado, motivo: motivo.trim(), evaluada: resultado === 'Pendiente' ? undefined : revision.revision })
    return evento(siguiente, actor, 'Evaluación de OM', `${resultado}${motivo.trim() ? `: ${motivo.trim()}` : ''}`, {
      om, revision: revision.revision, anterior: revision.resultado, nuevo: JSON.stringify({ resultado, motivo: motivo.trim(), datos }),
    })
  })
}
export function finalizarEvaluacion(registro: RegistroPlanificaciones, codigo: string, actor: Actor) {
  exigir(permisos(actor).evaluar, 'Solo Taller puede finalizar la evaluación.')
  return conPlan(registro, codigo, plan => {
    exigir(plan.estado === 'Pendiente de Taller', 'La evaluación no está abierta.')
    const activas = plan.preparacion.filas.filter(fila => !revisionDe(plan, fila.numero).cancelada)
    exigir(activas.length > 0 && activas.every(fila => {
      const revision = revisionDe(plan, fila.numero)
      return revision.resultado !== 'Pendiente' && revision.evaluada === revision.revision
        && (revision.resultado !== 'No viable' || revision.motivo.trim().length > 0)
    }), 'No se puede finalizar: hay OM pendientes o con reevaluación requerida.')
    let siguiente = plan
    for (const fila of activas) {
      const revision = revisionDe(siguiente, fila.numero)
      if (revision.resultado === 'Viable') siguiente = guardarRevision(siguiente, fila.numero, { ...revision, congelada: true, datos: datosOM(siguiente, fila.numero) })
    }
    return evento({ ...siguiente, estado: 'Pendiente de PCM' }, actor, 'Evaluación finalizada', 'Las OM viables quedaron congeladas. Se requiere decisión de PCM.')
  })
}
export function decidirPCM(registro: RegistroPlanificaciones, codigo: string, decision: 'Continuar' | 'Devolver a revisión' | 'Cancelar', motivo: string, confirmada: boolean, actor: Actor) {
  exigir(permisos(actor).organizar, 'Solo PCM puede decidir sobre la planificación.')
  return conPlan(registro, codigo, plan => {
    exigir(plan.estado === 'Pendiente de PCM', 'La planificación no está pendiente de una decisión de PCM.')
    exigir(['Continuar', 'Devolver a revisión', 'Cancelar'].includes(decision), 'Decisión inválida.')
    if (decision === 'Cancelar') exigir(confirmada && motivo.trim().length > 0, 'Confirmá la cancelación e ingresá un motivo obligatorio.')
    if (decision === 'Continuar') exigir(plan.preparacion.filas.some(fila => {
      const revision = revisionDe(plan, fila.numero)
      return revision.congelada && revision.resultado === 'Viable' && revision.evaluada === revision.revision && !revision.cancelada
    }), 'No hay OM viables vigentes para continuar.')
    const estado = decision === 'Continuar' ? 'Confirmada' : decision === 'Cancelar' ? 'Cancelada' : 'En revisión'
    return evento({ ...plan, estado }, actor, decision, motivo.trim() || decision, { anterior: plan.estado, nuevo: estado })
  })
}
export function puedeCorregir(plan: Planificacion, om: string, actor: Actor) {
  const revision = revisionDe(plan, om)
  return !revision.cancelada && !revision.congelada && ((plan.estado === 'Pendiente de Taller' && permisos(actor).organizar)
    || (plan.estado === 'En revisión' && permisos(actor).corregir))
}
export function corregirOM(registro: RegistroPlanificaciones, codigo: string, om: string, datos: DatosOM, motivo: string, revisionEsperada: number, actor: Actor) {
  return conPlan(registro, codigo, plan => {
    exigir(puedeCorregir(plan, om, actor), 'No está autorizada la corrección de esta OM en esta etapa.')
    const revision = revisionDe(plan, om)
    exigir(revision.revision === revisionEsperada, 'La OM cambió. Cerrá la corrección y revisá sus datos actuales.')
    validarDatos(datos)
    exigir(motivo.trim().length > 0, 'Ingresá el motivo de la modificación.')
    const anterior = datosOM(plan, om)
    exigir(JSON.stringify(anterior) !== JSON.stringify(datos), 'No hay cambios para guardar.')
    // El costo vuelve al mismo arreglo usado por el total existente, sin cambiar su fórmula.
    // La duración individual no reemplaza ni se suma a la duración común de la tarea.
    const preparacion = { ...plan.preparacion, filas: plan.preparacion.filas.map(fila => fila.numero === om
      ? { ...fila, descripcion: datos.descripcion, costo: datos.costo } : fila) }
    const siguiente = guardarRevision({ ...plan, preparacion }, om, { ...revision, revision: revision.revision + 1, resultado: 'Pendiente', motivo: '', datos: { ...datos } })
    return evento(siguiente, actor, 'Corrección / reevaluación', motivo.trim(), { om, revision: revision.revision + 1, anterior: JSON.stringify(anterior), nuevo: JSON.stringify(datos) })
  })
}
export function ordenesAsignables(plan: Planificacion) {
  if (plan.estado !== 'Confirmada') return []
  return plan.preparacion.filas.filter(fila => {
    const revision = revisionDe(plan, fila.numero)
    return revision.congelada && !revision.cancelada && revision.resultado === 'Viable' && revision.evaluada === revision.revision
  })
}
export function cancelarOMAceptada(registro: RegistroPlanificaciones, codigo: string, om: string, motivo: string, actor: Actor) {
  // No se concede este permiso a ningún rol hasta que el propietario defina la política.
  exigir(permisos(actor).cancelarAceptada, 'Cancelación de OM aceptada restringida: permisos pendientes de definición.')
  return conPlan(registro, codigo, plan => {
    const revision = revisionDe(plan, om)
    exigir(revision.congelada && !revision.cancelada && motivo.trim().length > 0 && plan.estado !== 'Cancelada', 'La cancelación requiere una OM aceptada activa y un motivo.')
    return evento(guardarRevision(plan, om, { ...revision, cancelada: true }), actor, 'Cancelación de OM', motivo.trim(), { om, revision: revision.revision, anterior: revision.resultado, nuevo: 'Cancelada' })
  })
}
