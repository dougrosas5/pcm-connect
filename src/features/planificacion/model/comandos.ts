import type { Actor, Comando, Registro } from '../../../types/pcm.ts'
import { diferenciasFuente, elegibles, enteroPositivo, erroresEnvio, etaValida, positivo, puedeCambiarEta, validarFuente } from './modelo.ts'
import { aplicarRevision, cerradaPCM, evaluacionVigente, firma, registrarConflictos, tareaActiva, tareaInterna } from '../../revision-pcm/model/revision.ts'
import { abiertaTaller, ajustarPropuestaEnTaller, guardarEvaluacion, puedeEvaluar, registrarEvaluacion, versionTarea } from '../../validacion-taller/model/evaluacion.ts'

export function aplicarComando(
  actual: Registro,
  comando: Comando,
  actor: Actor,
  solicitud: string,
  fecha: string
): Registro {
  if (actual.solicitudes[solicitud] !== undefined) return actual
  const siguiente = structuredClone(actual)
  const pcm = actor.rol === 'Planificador' || actor.rol === 'Administrador'
  function auditar(entidad: string, anterior: unknown, nuevo: unknown) {
    siguiente.historial.push({
      fecha, usuario: actor.nombre, usuarioId: actor.id, rol: actor.rol, accion: comando.tipo, entidad,
      anterior: structuredClone(anterior), nuevo: structuredClone(nuevo),
      ...('planId' in comando ? { planId: comando.planId } : {}),
      ...('tareaId' in comando ? { tareaId: comando.tareaId } : {})
    })
  }
  if (comando.tipo === 'guardar' && !comando.enviar) {
    const vigente = siguiente.planes.find(p => p.id === comando.plan.id)
    if (vigente && ['Enviado a Taller', 'En evaluación'].includes(vigente.estado)) {
      if (!pcm || (vigente.planificadorId !== actor.id && actor.rol !== 'Administrador'))
        throw new Error('Solo el planificador responsable o Administración puede ajustar las tareas enviadas.')
      if (vigente.version !== comando.plan.version) throw new Error('La planificación cambió. Reabrí la versión vigente.')
      const anterior = structuredClone(vigente)
      ajustarPropuestaEnTaller(vigente, comando.plan, siguiente, actor, fecha)
      auditar(vigente.tag, anterior, vigente)
      siguiente.revision++
      siguiente.solicitudes[solicitud] = siguiente.revision
      return siguiente
    }
  }
  if (comando.tipo === 'guardar') {
    if (!pcm) throw new Error('Solo Planificador o Administrador puede guardar o enviar.')
    const anterior = actual.planes.find((p) => p.id === comando.plan.id)
    if (anterior && anterior.planificadorId !== actor.id && actor.rol !== 'Administrador')
      throw new Error('La planificación pertenece a otro planificador.')
    if (anterior && (anterior.estado !== 'Borrador' || anterior.version !== comando.plan.version))
      throw new Error('La planificación cambió o ya fue enviada. Volvé a abrirla.')
    const plan = structuredClone(comando.plan)
    // Las resoluciones y sus firmas solo se escriben mediante comandos de revisión.
    delete plan.revisionPCM
    delete plan.borradorTaller
    delete plan.etaPredictiva
    delete plan.historialPredictiva
    if (anterior?.etaPredictiva) plan.etaPredictiva = structuredClone(anterior.etaPredictiva)
    if (anterior?.historialPredictiva) plan.historialPredictiva = structuredClone(anterior.historialPredictiva)
    if (!anterior && !etaValida(plan.eta))
      throw new Error('ETA: completá una fecha y hora válidas antes de crear la planificación.')
    if (anterior && plan.eta !== anterior.eta)
      throw new Error('La ETA final se modifica desde Validación Taller, con comentario e historial.')
    // El cliente nunca decide la fecha original ni reescribe su auditoría.
    plan.etaInicial = anterior ? anterior.etaInicial ?? anterior.eta : plan.eta
    plan.origenEtaInicial = anterior
      ? anterior.origenEtaInicial ?? (anterior.eta ? 'heredada' : 'sin-dato')
      : 'creacion'
    plan.historialEta = structuredClone(anterior?.historialEta ?? [])
    const tareas = new Set<string>()
    const oms = new Set<string>()
    for (const fila of plan.filas) {
      if (tareas.has(fila.id)) throw new Error(`TAREA/PM ${fila.id} duplicada.`)
      tareas.add(fila.id)
      if (!fila.ordenes.length || elegibles(fila).length !== fila.ordenes.length)
        throw new Error(`${fila.id}: solo se permiten OM con «Valor aprobado».`)
      for (const om of fila.ordenes) {
        if (oms.has(om.numero)) throw new Error(`OM ${om.numero} duplicada.`)
        oms.add(om.numero)
      }
      const conflicto = actual.planes.find(
        (p) =>
          p.id !== plan.id &&
          p.filas.some(
            (f) =>
              tareaActiva(p, f) && (f.id === fila.id ||
              f.ordenes.some((om) => oms.has(om.numero) || fila.ordenes.some((o) => o.numero === om.numero)))
          )
      )
      if (conflicto) throw new Error(`${fila.id}: la tarea o una de sus OM ya figura en ${conflicto.tag}.`)
    }
    if (comando.enviar) {
      const errores = erroresEnvio(plan, actual)
      if (errores.length) throw new Error(errores.join('\n'))
    }
    if (!anterior) siguiente.contador++
    if (!Number.isSafeInteger(siguiente.contador)) throw new Error('Se alcanzó el límite de numeración.')
    plan.tag = anterior?.tag ?? `PCM-${String(siguiente.contador).padStart(6, '0')}`
    plan.version = (anterior?.version ?? 0) + 1
    plan.estado = comando.enviar ? 'Enviado a Taller' : 'Borrador'
    plan.planificador = anterior?.planificador ?? actor.nombre
    plan.planificadorId = anterior?.planificadorId ?? actor.id
    plan.actualizado = fecha
    plan.enviado = comando.enviar ? fecha : null
    plan.evaluaciones = {}
    plan.referencias = Object.fromEntries(
      Object.values(actual.catalogos)
        .flat()
        .map((e) => [e.id, structuredClone(e)])
    )
    siguiente.planes = [...actual.planes.filter((p) => p.id !== plan.id), plan]
    auditar(plan.tag, anterior ?? null, plan)
  } else if (comando.tipo === 'guardarPredictiva') {
    if (!puedeCambiarEta(actor)) throw new Error('No tenés permiso para guardar la ETA predictiva.')
    const plan = siguiente.planes.find(p => p.id === comando.planId)
    if (!plan || plan.version !== comando.version) throw new Error('La planificación cambió. Reabrí la versión vigente.')
    if (cerradaPCM(plan)) throw new Error('La planificación es de solo consulta.')
    if (!etaValida(comando.eta)) throw new Error('Ingresá una ETA predictiva válida.')
    if (plan.etaPredictiva?.valor === comando.eta) throw new Error('La ETA predictiva no cambió.')
    const anterior = structuredClone(plan)
    plan.historialPredictiva ??= []
    plan.historialPredictiva.push({ ...firma(actor, fecha), anterior: plan.etaPredictiva?.valor ?? '', nuevo: comando.eta })
    plan.etaPredictiva = { valor: comando.eta, confirmada: false }
    plan.actualizado = fecha
    plan.version++
    auditar(plan.tag, anterior, plan)
  } else if (comando.tipo === 'cambiarEta' || comando.tipo === 'confirmarPredictiva') {
    if (!puedeCambiarEta(actor))
      throw new Error('Solo PCM o un Supervisor de Taller autorizado puede modificar la ETA final.')
    const plan = siguiente.planes.find((p) => p.id === comando.planId)
    if (!plan || plan.version !== comando.version)
      throw new Error('La planificación cambió. Actualizá los datos antes de modificar la ETA final.')
    if (cerradaPCM(plan)) throw new Error('La planificación confirmada o cancelada es de solo consulta.')
    if (comando.tipo === 'confirmarPredictiva' &&
      (!comando.confirmada || !plan.etaPredictiva || plan.etaPredictiva.confirmada || plan.etaPredictiva.valor !== comando.eta))
      throw new Error('La ETA predictiva cambió o ya fue confirmada. Revisá la predicción vigente.')
    if (!etaValida(comando.eta)) throw new Error('Ingresá una ETA final válida.')
    if (!comando.comentario.trim()) throw new Error('Indicá el motivo del cambio de ETA final.')
    if (comando.eta === plan.eta) throw new Error('La ETA final coincide con la vigente. No se registró un cambio.')
    const anterior = structuredClone(plan)
    plan.etaInicial ??= plan.eta
    plan.origenEtaInicial ??= plan.eta ? 'heredada' : 'sin-dato'
    plan.historialEta ??= []
    plan.historialEta.push({
      fecha,
      usuarioId: actor.id,
      usuario: actor.nombre,
      rol: actor.rol,
      anterior: plan.eta,
      nuevo: comando.eta,
      comentario: comando.comentario.trim(),
      revisionDisponibilidad: 'pendiente',
      ...(comando.tipo === 'confirmarPredictiva' ? { origen: 'predictiva' } : {})
    })
    if (comando.tipo === 'confirmarPredictiva') plan.etaPredictiva!.confirmada = true
    plan.eta = comando.eta
    plan.actualizado = fecha
    plan.version++
    registrarConflictos(siguiente, plan, actor, fecha)
    // Una ETA puede afectar también trabajos aceptados en otras planificaciones.
    for (const otro of siguiente.planes) {
      if (otro.id === plan.id || ['Cancelada', 'Borrador'].includes(otro.estado)) continue
      const antes = structuredClone(otro)
      const candidato = structuredClone(otro)
      const cantidad = otro.revisionPCM?.conflictos.length ?? 0
      registrarConflictos(siguiente, candidato, actor, fecha)
      if ((candidato.revisionPCM?.conflictos.length ?? 0) > cantidad) {
        otro.revisionPCM = candidato.revisionPCM
        otro.version++
        otro.actualizado = fecha
        auditar(otro.tag, antes, structuredClone(otro))
      }
    }
    auditar(plan.tag, anterior, plan)
  } else if (comando.tipo === 'guardarRevision' || comando.tipo === 'confirmarPCM' || comando.tipo === 'cancelarPCM') {
    aplicarRevision(siguiente, comando, actor, fecha)
  } else if (comando.tipo === 'catalogo') {
    if (actor.rol !== 'Administrador') throw new Error('Solo Administración puede modificar catálogos.')
    const entrada = { ...comando.entrada, nombre: comando.entrada.nombre.trim() }
    if (!entrada.nombre) throw new Error('Ingresá el nombre de la entrada.')
    if (
      actual.catalogos[comando.catalogo].some(
        (e) =>
          e.id !== entrada.id && e.nombre.toLocaleUpperCase('es') === entrada.nombre.toLocaleUpperCase('es')
      )
    )
      throw new Error('Ese nombre ya existe en el catálogo.')
    const anterior = actual.catalogos[comando.catalogo].find((e) => e.id === entrada.id) ?? null
    if (
      anterior &&
      anterior.externo !== entrada.externo &&
      actual.planes.some((p) => p.filas.some((f) => f.responsableId === entrada.id))
    )
      throw new Error(
        'No se puede cambiar el tipo de ejecución de un responsable utilizado; creá una entrada nueva.'
      )
    siguiente.catalogos[comando.catalogo] = [
      ...actual.catalogos[comando.catalogo].filter((e) => e.id !== entrada.id),
      entrada
    ]
    auditar(entrada.id, anterior, entrada)
  } else if (comando.tipo === 'importar') {
    if (!pcm) throw new Error('Solo PCM puede importar datos.')
    validarFuente(comando.tareas)
    if (!comando.procedencia.trim()) throw new Error('Indicá la procedencia del archivo.')
    const diferencias = diferenciasFuente(actual.fuente, comando.tareas)
    siguiente.fuente = structuredClone(comando.tareas)
    siguiente.importaciones.push({
      id: solicitud,
      fecha,
      usuario: actor.nombre,
      procedencia: comando.procedencia,
      tareas: structuredClone(comando.tareas),
      diferencias
    })
    auditar('Fuente Excel', actual.fuente, comando.tareas)
  } else {
    if (!puedeEvaluar(actor)) throw new Error('Solo Taller puede evaluar.')
    const plan = siguiente.planes.find((p) => p.id === comando.planId)
    if (!plan || !abiertaTaller(plan))
      throw new Error('La planificación no está disponible para evaluación.')
    if (comando.version !== undefined && comando.version !== plan.version) throw new Error('La planificación cambió. Reabrí la versión vigente.')
    const anterior = structuredClone(plan)
    if (comando.tipo === 'evaluar') {
      const fila = plan.filas.find((f) => f.id === comando.tareaId)
      if (!fila || !tareaInterna(plan, fila))
        throw new Error('La tarea no requiere evaluación de Taller interno.')
      if (evaluacionVigente(plan, fila.id)) throw new Error('La tarea ya fue evaluada en esta versión; su decisión está congelada.')
      if (
        !['Aceptada', 'Rechazada'].includes(comando.resultado) ||
        (comando.resultado === 'Rechazada' && !comando.motivo.trim())
      )
        throw new Error('El rechazo requiere un motivo.')
      const tiempoAceptado = comando.tiempoAceptado ?? fila.tiempoPropuesto
      const trabajadoresAceptados = comando.trabajadoresAceptados ?? fila.trabajadores
      if (!positivo(tiempoAceptado) || !enteroPositivo(trabajadoresAceptados)) throw new Error('Las horas deben ser positivas y los trabajadores enteros positivos.')
      registrarEvaluacion(plan, { tareaId: fila.id, versionTarea: versionTarea(plan, fila.id),
        resultado: comando.resultado, motivo: comando.motivo, horas: tiempoAceptado, trabajadores: trabajadoresAceptados }, actor, fecha)
      if (plan.estado === 'Enviado a Taller') plan.estado = 'En evaluación'
    } else {
      guardarEvaluacion(plan, comando.tipo === 'evaluacionTaller' ? comando.ajustes : [],
        comando.tipo === 'finalizar' || comando.finalizar, actor, fecha)
    }
    plan.actualizado = fecha
    plan.version++
    auditar(plan.tag, anterior, plan)
  }
  siguiente.revision++
  siguiente.solicitudes[solicitud] = siguiente.revision
  return siguiente
}
