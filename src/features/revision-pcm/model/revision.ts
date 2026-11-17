import type { Actor, Comando, DecisionPCM, Evaluacion, FilaPropuesta, Firma, Plan, Registro, RevisionPCM } from '../../../types/pcm.ts'
import { enteroPositivo, etaValida, finParada, inputDesdeEta, positivo } from '../../planificacion/model/modelo.ts'

export function cerradaPCM(plan: Plan) {
  return plan.estado === 'Confirmada' || plan.estado === 'Cancelada'
}
export function resolucionTarea(plan: Plan, id: string) {
  return Object.hasOwn(plan.revisionPCM?.tareas ?? {}, id) ? plan.revisionPCM!.tareas[id].resolucion : undefined
}
export function tareaActiva(plan: Plan, fila: FilaPropuesta) {
  return plan.estado !== 'Cancelada' && resolucionTarea(plan, fila.id)?.tipo !== 'Eliminada'
}
export function tareaInterna(plan: Plan, fila: FilaPropuesta) {
  return tareaActiva(plan, fila) && !plan.referencias[fila.responsableId]?.externo && resolucionTarea(plan, fila.id)?.tipo !== 'Tercerizada'
}
export function responsableOperativo(plan: Plan, fila: FilaPropuesta) {
  return resolucionTarea(plan, fila.id)?.tipo === 'Tercerizada' ? 'TERCERIZADO' : plan.referencias[fila.responsableId]?.nombre ?? 'Sin definir'
}
export function evaluacionVigente(plan: Plan, id: string): Evaluacion | undefined {
  const e = Object.hasOwn(plan.evaluaciones, id) ? plan.evaluaciones[id] : undefined
  const version = Object.hasOwn(plan.revisionPCM?.tareas ?? {}, id) ? plan.revisionPCM!.tareas[id].version : 1
  return e && (e.versionTarea ?? 1) === version ? e : undefined
}
// Migración aditiva al escribir: la lectura no modifica registros antiguos.
export function prepararRevision(plan: Plan, actor: Actor, fecha: string): RevisionPCM {
  plan.revisionPCM ??= {
    esquema: 1, versionContenido: 1, versionEvaluada: plan.estado === 'Evaluado' ? 1 : null,
    tareas: {}, conflictos: []
  }
  for (const fila of plan.filas) {
    if (Object.hasOwn(plan.revisionPCM.tareas, fila.id)) continue
    const anterior = Object.hasOwn(plan.evaluaciones, fila.id) ? plan.evaluaciones[fila.id] : undefined
    Object.defineProperty(plan.revisionPCM.tareas, fila.id, { enumerable: true, configurable: true, writable: true, value: {
      version: 1, responsableOriginalId: fila.responsableId, resoluciones: [],
      evaluaciones: anterior ? [structuredClone(anterior)] : [],
      // La instantánea se incorpora ahora; no se inventa una fecha histórica de creación.
      versiones: [{ ...firma(actor, fecha), version: 1, fila: structuredClone(fila), campos: [] }]
    } })
  }
  return plan.revisionPCM
}
export function firma(actor: Actor, fecha: string): Firma {
  return { usuarioId: actor.id, usuario: actor.nombre, rol: actor.rol, fecha }
}
export function rechazosPendientes(plan: Plan) {
  return plan.filas.filter((f) => evaluacionVigente(plan, f.id)?.resultado === 'Rechazada' &&
    !['Tercerizada', 'Eliminada'].includes(resolucionTarea(plan, f.id)?.tipo ?? ''))
}
export function conflictosPendientes(plan: Plan) {
  return (plan.revisionPCM?.conflictos ?? []).filter((c) => plan.filas.some((f) => f.id === c.tareaId && tareaInterna(plan, f)))
}
export function erroresConfirmacion(plan: Plan): string[] {
  const errores: string[] = []
  if (plan.estado !== 'Evaluado') errores.push('Taller debe finalizar la evaluación vigente antes de confirmar.')
  if (plan.revisionPCM && plan.revisionPCM.versionEvaluada !== plan.revisionPCM.versionContenido)
    errores.push('Hay tareas pendientes de reevaluación de la versión actual.')
  if (!/^PCM-\d{6,}$/u.test(plan.tag)) errores.push('El TAG no es válido.')
  if (!etaValida(plan.eta) || !finParada(plan)) errores.push('La ETA final o el tiempo de parada no es válido.')
  if (!plan.filas.some((f) => tareaActiva(plan, f))) errores.push('Debe existir al menos una tarea activa.')
  for (const f of plan.filas.filter((f) => tareaInterna(plan, f))) {
    const e = evaluacionVigente(plan, f.id)
    if (!e) errores.push(`${f.id}: pendiente de evaluación vigente.`)
    else if (e.resultado === 'Rechazada') errores.push(`${f.id}: rechazo sin resolver.`)
  }
  return errores
}
export function estadoRevision(plan: Plan): string {
  if (cerradaPCM(plan)) return plan.estado
  if (plan.estado === 'En reevaluación' || (plan.revisionPCM && plan.revisionPCM.versionEvaluada !== plan.revisionPCM.versionContenido && plan.revisionPCM.versionContenido > 1)) return 'En reevaluación'
  if (plan.estado !== 'Evaluado') return plan.estado
  if (rechazosPendientes(plan).length) return 'Con rechazos'
  return erroresConfirmacion(plan).length ? 'Pendiente de revisión PCM' : 'Lista para confirmar'
}
export function indicadoresRevision(planes: Plan[]) {
  return {
    Evaluadas: planes.filter((p) => p.estado === 'Evaluado' || (p.revisionPCM?.versionEvaluada != null && p.revisionPCM.versionEvaluada === p.revisionPCM.versionContenido)).length,
    'Con rechazos': planes.filter((p) => !cerradaPCM(p) && rechazosPendientes(p).length).length,
    'Listas para confirmar': planes.filter((p) => !erroresConfirmacion(p).length).length,
    Confirmadas: planes.filter((p) => p.estado === 'Confirmada').length
  }
}
export type FiltrosRevision = { tag: string; remolcador: string; ubicacion: string; estado: string; desde: string; hasta: string; rechazos: string }
export const filtrosRevisionVacios: FiltrosRevision = { tag: '', remolcador: '', ubicacion: '', estado: '', desde: '', hasta: '', rechazos: '' }
export function filtrarRevision(planes: Plan[], filtros: FiltrosRevision, historial: boolean) {
  if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) return []
  return planes.filter((p) => {
    const dia = inputDesdeEta(p.eta).slice(0, 10)
    const recibida = ['Evaluado', 'En reevaluación', 'Confirmada', 'Cancelada'].includes(p.estado) || (p.revisionPCM?.versionContenido ?? 1) > 1
    return recibida && cerradaPCM(p) === historial &&
      p.tag.toLowerCase().includes(filtros.tag.trim().toLowerCase()) &&
      (!filtros.remolcador || p.remolcadorId === filtros.remolcador) &&
      (!filtros.ubicacion || p.ubicacionId === filtros.ubicacion) &&
      (!filtros.estado || estadoRevision(p) === filtros.estado) &&
      (!filtros.desde || Boolean(dia && dia >= filtros.desde)) &&
      (!filtros.hasta || Boolean(dia && dia <= filtros.hasta)) &&
      (!filtros.rechazos || (filtros.rechazos === 'pendientes' ? rechazosPendientes(p).length > 0 :
        p.filas.some((f) => evaluacionVigente(p, f.id)?.resultado === 'Rechazada') === (filtros.rechazos === 'si')))
  }).sort((a, b) => b.actualizado.localeCompare(a.actualizado) || a.tag.localeCompare(b.tag))
}
// Contrato para asignación futura: ninguna persona ni horario se asigna en M3.
export function tareasInternasAsignables(plan: Plan) {
  return plan.estado === 'Confirmada' ? plan.filas.filter((f) => tareaInterna(plan, f) && evaluacionVigente(plan, f.id)?.resultado === 'Aceptada') : []
}
export function estadoProgramacion(plan: Plan, fila: FilaPropuesta) {
  if (!tareaActiva(plan, fila)) return 'Fuera de planificación activa'
  if (conflictosPendientes(plan).some((c) => c.tareaId === fila.id)) return 'Reprogramación requerida'
  return plan.estado === 'Confirmada' ? 'Pendiente de programación' : 'Sin asignar'
}

export function registrarConflictos(registro: Registro, plan: Plan, actor: Actor, fecha: string) {
  if (['Borrador', 'Cancelada'].includes(plan.estado)) return
  const revision = prepararRevision(plan, actor, fecha)
  const agregar = (tareaId: string, detalle: string, otroPlanId?: string) => {
    const id = `${tareaId}:${otroPlanId ?? 'parada'}:${plan.eta}`
    if (!revision.conflictos.some((c) => c.id === id)) revision.conflictos.push({
      id, tareaId, otroPlanId, detalle, fecha, estado: 'Pendiente de reprogramación'
    })
  }
  const inicio = Date.parse(plan.eta), fin = Date.parse(finParada(plan))
  for (const fila of plan.filas.filter((f) => tareaInterna(plan, f))) {
    const horas = evaluacionVigente(plan, fila.id)?.tiempoAceptado ?? fila.tiempoPropuesto
    if (Number(horas) > Number(plan.horasParada)) agregar(fila.id, `${fila.id}: duración de ${horas} h mayor que la parada de ${plan.horasParada} h.`)
    for (const otro of registro.planes) {
      if (otro.id === plan.id || ['Cancelada', 'Borrador'].includes(otro.estado)) continue
      if (!(inicio < Date.parse(finParada(otro)) && Date.parse(otro.eta) < fin)) continue
      const afectadas = otro.filas.filter((f) => tareaInterna(otro, f) && (f.responsableId === fila.responsableId || otro.remolcadorId === plan.remolcadorId))
      if (afectadas.length) agregar(fila.id, `${fila.id}: ventana solapada con ${otro.tag} (${afectadas.map((f) => f.id).join(', ')}), por remolcador o responsable compartido. Verificar disponibilidad.`, otro.id)
    }
  }
}
function resolver(plan: Plan, decision: DecisionPCM, registro: Registro, actor: Actor, fecha: string) {
  const fila = plan.filas.find((f) => f.id === decision.tareaId)
  if (!fila || evaluacionVigente(plan, fila.id)?.resultado !== 'Rechazada' || resolucionTarea(plan, fila.id))
    throw new Error(`${decision.tareaId}: solo se pueden resolver rechazos pendientes; las aceptadas están congeladas.`)
  const revision = prepararRevision(plan, actor, fecha)
  const tarea = revision.tareas[fila.id]
  const resolucion = { ...firma(actor, fecha), tipo: decision.tipo, versionTarea: tarea.version }
  if (decision.tipo === 'Eliminada' && !decision.confirmada) throw new Error('Confirmá la eliminación lógica de la tarea.')
  if (decision.tipo === 'Devuelta a revisión') {
    const cambios = decision.correccion
    if (!cambios || !cambios.descripcion.trim() || !cambios.criticidad.trim() || !positivo(cambios.tiempoPropuesto) || !enteroPositivo(cambios.trabajadores))
      throw new Error('Completá la corrección: descripción, criticidad, horas positivas y trabajadores enteros positivos.')
    const responsable = registro.catalogos.responsables.find((r) => r.id === cambios.responsableId && r.activo && !r.externo)
    if (!responsable) throw new Error('La reevaluación requiere un responsable interno activo; para ejecución externa elegí Tercerizar.')
    const campos = (Object.keys(cambios) as (keyof typeof cambios)[]).filter((k) => fila[k] !== cambios[k])
    if (!campos.length) throw new Error('Modificá al menos un campo antes de reenviar a Taller.')
    // Asignación explícita: nunca aceptar IDs, OM, costos ni evaluaciones enviados por el cliente.
    fila.descripcion = cambios.descripcion.trim()
    fila.criticidad = cambios.criticidad.trim()
    fila.tiempoPropuesto = cambios.tiempoPropuesto
    fila.trabajadores = cambios.trabajadores
    fila.responsableId = cambios.responsableId
    plan.referencias[responsable.id] = structuredClone(responsable)
    tarea.version++
    tarea.versiones.push({ ...firma(actor, fecha), version: tarea.version, fila: structuredClone(fila), campos })
    revision.versionContenido++
    plan.estado = 'En reevaluación'
  }
  tarea.resolucion = resolucion
  tarea.resoluciones.push(resolucion)
}
export function aplicarRevision(registro: Registro, comando: Extract<Comando, { tipo: 'guardarRevision' | 'confirmarPCM' | 'cancelarPCM' }>, actor: Actor, fecha: string) {
  if (!['Planificador', 'Administrador'].includes(actor.rol)) throw new Error('Solo PCM autorizado puede revisar, confirmar o cancelar.')
  const plan = registro.planes.find((p) => p.id === comando.planId)
  if (!plan || plan.version !== comando.version) throw new Error('La planificación cambió. Actualizá y reabrí antes de guardar.')
  if (cerradaPCM(plan)) throw new Error('La planificación está confirmada o cancelada; solo permite consulta.')
  const anterior = structuredClone(plan)
  const revision = prepararRevision(plan, actor, fecha)
  if (comando.tipo === 'guardarRevision') {
    if (!['Evaluado', 'En reevaluación'].includes(plan.estado)) throw new Error('Taller debe finalizar la evaluación antes de la revisión PCM.')
    if (!comando.decisiones.length) throw new Error('No hay resoluciones nuevas para guardar.')
    if (new Set(comando.decisiones.map((d) => d.tareaId)).size !== comando.decisiones.length) throw new Error('Hay resoluciones duplicadas.')
    for (const decision of comando.decisiones) {
      resolver(plan, decision, registro, actor, fecha)
      registro.historial.push({ ...firma(actor, fecha), accion: decision.tipo, entidad: plan.tag, planId: plan.id, tareaId: decision.tareaId, anterior: anterior.filas.find((f) => f.id === decision.tareaId), nuevo: structuredClone(revision.tareas[decision.tareaId]) })
    }
  } else if (comando.tipo === 'confirmarPCM') {
    const errores = erroresConfirmacion(plan)
    if (errores.length) throw new Error(errores.join('\n'))
    const conflictos = conflictosPendientes(plan)
    if (conflictos.length && !comando.reconocerConflictos) throw new Error('Reconocé explícitamente los conflictos pendientes de reprogramación.')
    for (const c of conflictos) c.reconocimiento = firma(actor, fecha)
    if (conflictos.length) registro.historial.push({ ...firma(actor, fecha), accion: 'Reconocer alertas', entidad: plan.tag, planId: plan.id, anterior: null, nuevo: structuredClone(conflictos) })
    plan.estado = 'Confirmada'
    revision.confirmacion = { ...firma(actor, fecha), version: plan.version + 1, conAdvertencias: conflictos.length > 0 }
  } else {
    if (!comando.confirmada || !comando.motivo.trim()) throw new Error('La cancelación requiere motivo y confirmación explícita.')
    plan.estado = 'Cancelada'
    revision.cancelacion = { ...firma(actor, fecha), motivo: comando.motivo.trim() }
  }
  plan.version++
  plan.actualizado = fecha
  registro.historial.push({ ...firma(actor, fecha), accion: comando.tipo, entidad: plan.tag, planId: plan.id, anterior, nuevo: structuredClone(plan) })
}
