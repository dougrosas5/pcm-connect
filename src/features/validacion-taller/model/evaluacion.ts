import type { Actor, AjusteTaller, Evaluacion, FilaPropuesta, Plan, Registro } from '../../../types/pcm.ts'
import { enteroPositivo, mismaFuente, positivo } from '../../planificacion/model/modelo.ts'
import { evaluacionVigente, firma, prepararRevision, resolucionTarea, tareaInterna } from '../../revision-pcm/model/revision.ts'

export function puedeEvaluar(actor: Actor) {
  return actor.rol === 'Taller' || actor.rol === 'Supervisor Taller'
}

export function abiertaTaller(plan: Plan) {
  return ['Enviado a Taller', 'En evaluación', 'En reevaluación'].includes(plan.estado)
}

export function versionTarea(plan: Plan, id: string) {
  const tareas = plan.revisionPCM?.tareas
  return tareas && Object.hasOwn(tareas, id) ? tareas[id].version : 1
}

export function ajusteVigente(plan: Plan, id: string) {
  return plan.borradorTaller?.find(a => a.tareaId === id && a.versionTarea === versionTarea(plan, id))
}

export function ajusteInicial(plan: Plan, fila: FilaPropuesta): AjusteTaller {
  return ajusteVigente(plan, fila.id) ?? {
    tareaId: fila.id, versionTarea: versionTarea(plan, fila.id), resultado: 'Pendiente',
    horas: fila.tiempoPropuesto, trabajadores: fila.trabajadores, motivo: ''
  }
}

export function errorAjuste(a: AjusteTaller) {
  if (!positivo(a.horas)) return 'Ingresá horas mayores que cero.'
  if (!enteroPositivo(a.trabajadores)) return 'Ingresá una cantidad entera de trabajadores mayor que cero.'
  if (a.resultado === 'Rechazada' && !a.motivo.trim()) return 'El rechazo requiere un comentario.'
  return ''
}

export function registrarEvaluacion(plan: Plan, ajuste: AjusteTaller, actor: Actor, fecha: string) {
  if (ajuste.resultado === 'Pendiente') return
  const tarea = prepararRevision(plan, actor, fecha).tareas[ajuste.tareaId]
  const evaluacion: Evaluacion = {
    resultado: ajuste.resultado, motivo: ajuste.motivo.trim(), usuario: actor.nombre,
    fecha, usuarioId: actor.id, versionTarea: tarea.version,
    tiempoAceptado: ajuste.horas, trabajadoresAceptados: ajuste.trabajadores
  }
  Object.defineProperty(plan.evaluaciones, ajuste.tareaId, { enumerable: true, configurable: true, writable: true, value: evaluacion })
  tarea.evaluaciones.push(structuredClone(evaluacion))
  if (tarea.resolucion?.tipo === 'Devuelta a revisión') delete tarea.resolucion
  if (plan.borradorTaller) plan.borradorTaller = plan.borradorTaller.filter(a => a.tareaId !== ajuste.tareaId)
}

export function guardarEvaluacion(plan: Plan, ajustes: AjusteTaller[], finalizar: boolean, actor: Actor, fecha: string) {
  const vistos = new Set<string>()
  for (const a of ajustes) {
    const fila = plan.filas.find(f => f.id === a.tareaId)
    if (!fila || !tareaInterna(plan, fila) || evaluacionVigente(plan, a.tareaId))
      throw new Error(`${a.tareaId}: la tarea no admite cambios de evaluación.`)
    if (vistos.has(a.tareaId) || a.versionTarea !== versionTarea(plan, a.tareaId))
      throw new Error(`${a.tareaId}: versión de tarea desactualizada o duplicada.`)
    vistos.add(a.tareaId)
    const error = errorAjuste(a)
    if (error) throw new Error(`${a.tareaId}: ${error}`)
  }
  // Un borrador parcial modifica solo las filas incluidas.
  const borrador = [...(plan.borradorTaller ?? []).filter(a => !vistos.has(a.tareaId)), ...ajustes]
  if (!finalizar) {
    if (!ajustes.length) throw new Error('No hay ajustes para guardar.')
    plan.borradorTaller = borrador
    if (plan.estado === 'Enviado a Taller') plan.estado = 'En evaluación'
    return
  }
  for (const fila of plan.filas.filter(f => tareaInterna(plan, f))) {
    const previa = evaluacionVigente(plan, fila.id)
    if (previa) {
      const error = errorAjuste({
        tareaId: fila.id, versionTarea: versionTarea(plan, fila.id), resultado: previa.resultado,
        horas: previa.tiempoAceptado ?? fila.tiempoPropuesto, trabajadores: previa.trabajadoresAceptados ?? fila.trabajadores,
        motivo: previa.motivo
      })
      if (error) throw new Error(`${fila.id}: ${error}`)
      continue
    }
    const ajuste = borrador.find(a => a.tareaId === fila.id && a.versionTarea === versionTarea(plan, fila.id))
    if (!ajuste || ajuste.resultado === 'Pendiente') throw new Error(`${fila.id}: hay tareas internas pendientes de evaluación.`)
    const error = errorAjuste(ajuste)
    if (error) throw new Error(`${fila.id}: ${error}`)
    registrarEvaluacion(plan, ajuste, actor, fecha)
  }
  delete plan.borradorTaller
  const revision = prepararRevision(plan, actor, fecha)
  plan.estado = 'Evaluado'
  revision.versionEvaluada = revision.versionContenido
}

export function ajustarPropuestaEnTaller(plan: Plan, propuesta: Plan, registro: Registro, actor: Actor, fecha: string) {
  if (!['Enviado a Taller', 'En evaluación'].includes(plan.estado))
    throw new Error('La edición de la propuesta original está cerrada.')
  const campos = ['tiempoPropuesto', 'trabajadores', 'responsableId'] as const
  if (propuesta.eta !== plan.eta || propuesta.horasParada !== plan.horasParada ||
    propuesta.remolcadorId !== plan.remolcadorId || propuesta.ubicacionId !== plan.ubicacionId)
    throw new Error('La cabecera enviada está bloqueada. Para la ETA final usá Validación Taller.')
  if (propuesta.filas.length !== plan.filas.length) throw new Error('La lista de tareas enviada a Taller no puede cambiar.')
  const revision = prepararRevision(plan, actor, fecha)
  const modificadas = new Set<string>()
  for (const [i, fila] of plan.filas.entries()) {
    const cambio = propuesta.filas[i]
    if (!mismaFuente(fila, cambio)) throw new Error('Las tareas y OM enviadas a Taller se conservan.')
    const distintos = campos.filter(campo => fila[campo] !== cambio[campo])
    if (!distintos.length) continue
    if (!positivo(cambio.tiempoPropuesto) || !enteroPositivo(cambio.trabajadores))
      throw new Error(`${fila.id}: revisá las horas y la cantidad de trabajadores.`)
    if (distintos.includes('responsableId')) {
      const responsable = registro.catalogos.responsables.find(r => r.id === cambio.responsableId && r.activo)
      if (!responsable) throw new Error(`${fila.id}: seleccioná un responsable activo.`)
      Object.defineProperty(plan.referencias, responsable.id, { enumerable: true, configurable: true, writable: true, value: structuredClone(responsable) })
    }
    for (const campo of distintos) fila[campo] = cambio[campo]
    const tarea = revision.tareas[fila.id]
    tarea.version++
    tarea.versiones.push({ ...firma(actor, fecha), version: tarea.version, fila: structuredClone(fila), campos: distintos })
    modificadas.add(fila.id)
  }
  if (!modificadas.size) throw new Error('No hay cambios en las tareas enviadas.')
  revision.versionContenido++
  if (plan.borradorTaller) plan.borradorTaller = plan.borradorTaller.filter(a => !modificadas.has(a.tareaId))
  plan.version++
  plan.actualizado = fecha
}

export function estadoTareaTaller(plan: Plan, fila: FilaPropuesta) {
  if (resolucionTarea(plan, fila.id)?.tipo === 'Eliminada') return 'Eliminada'
  if (plan.referencias[fila.responsableId]?.externo || resolucionTarea(plan, fila.id)?.tipo === 'Tercerizada') return 'Ejecución externa'
  if (plan.estado === 'Cancelada') return evaluacionVigente(plan, fila.id)?.resultado ?? 'Cancelada'
  return evaluacionVigente(plan, fila.id)?.resultado ?? (versionTarea(plan, fila.id) > 1 ? 'Reevaluación requerida' : 'Pendiente')
}
