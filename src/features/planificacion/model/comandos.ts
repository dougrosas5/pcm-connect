import type { Actor, Comando, Registro } from '../../../types/pcm.ts'
import { diferenciasFuente, elegibles, erroresEnvio, etaValida, puedeCambiarEta, validarFuente } from './modelo.ts'

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
    siguiente.historial.push({ fecha, usuario: actor.nombre, accion: comando.tipo, entidad, anterior, nuevo })
  }
  if (comando.tipo === 'guardar') {
    if (!pcm) throw new Error('Solo Planificador o Administrador puede guardar o enviar.')
    const anterior = actual.planes.find((p) => p.id === comando.plan.id)
    if (anterior && anterior.planificadorId !== actor.id && actor.rol !== 'Administrador')
      throw new Error('La planificación pertenece a otro planificador.')
    if (anterior && (anterior.estado !== 'Borrador' || anterior.version !== comando.plan.version))
      throw new Error('La planificación cambió o ya fue enviada. Volvé a abrirla.')
    const plan = structuredClone(comando.plan)
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
              f.id === fila.id ||
              f.ordenes.some((om) => oms.has(om.numero) || fila.ordenes.some((o) => o.numero === om.numero))
          )
      )
      if (conflicto) throw new Error(`${fila.id}: conflicto con la planificación ${conflicto.tag}.`)
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
  } else if (comando.tipo === 'cambiarEta') {
    if (!puedeCambiarEta(actor))
      throw new Error('Solo PCM o un Supervisor de Taller autorizado puede modificar la ETA final.')
    const plan = siguiente.planes.find((p) => p.id === comando.planId)
    if (!plan || plan.version !== comando.version)
      throw new Error('La planificación cambió. Actualizá los datos antes de modificar la ETA final.')
    if (!etaValida(comando.eta)) throw new Error('Ingresá una ETA final válida.')
    if (!comando.comentario.trim()) throw new Error('El cambio de ETA final requiere un comentario.')
    if (comando.eta === plan.eta) throw new Error('La ETA final no cambió; no se registró un evento duplicado.')
    const anterior = structuredClone(plan)
    plan.etaInicial ??= plan.eta
    plan.origenEtaInicial ??= plan.eta ? 'heredada' : 'sin-dato'
    plan.historialEta ??= []
    plan.historialEta.push({
      fecha,
      usuarioId: actor.id,
      usuario: actor.nombre,
      anterior: plan.eta,
      nuevo: comando.eta,
      comentario: comando.comentario.trim(),
      revisionDisponibilidad: 'pendiente'
    })
    plan.eta = comando.eta
    plan.actualizado = fecha
    plan.version++
    auditar(plan.tag, anterior, plan)
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
    if (actor.rol !== 'Taller' && actor.rol !== 'Administrador') throw new Error('Solo Taller puede evaluar.')
    const plan = siguiente.planes.find((p) => p.id === comando.planId)
    if (!plan || !['Enviado a Taller', 'En evaluación'].includes(plan.estado))
      throw new Error('La planificación no está disponible para evaluación.')
    const anterior = structuredClone(plan)
    if (comando.tipo === 'evaluar') {
      const fila = plan.filas.find((f) => f.id === comando.tareaId)
      if (!fila || plan.referencias[fila.responsableId]?.externo)
        throw new Error('La tarea no requiere evaluación de Taller interno.')
      if (
        !['Aceptada', 'Rechazada'].includes(comando.resultado) ||
        (comando.resultado === 'Rechazada' && !comando.motivo.trim())
      )
        throw new Error('El rechazo requiere un motivo.')
      plan.evaluaciones[fila.id] = {
        resultado: comando.resultado,
        motivo: comando.motivo.trim(),
        usuario: actor.nombre,
        fecha
      }
      plan.estado = 'En evaluación'
    } else {
      if (
        plan.filas.some(
          (f) => !plan.referencias[f.responsableId]?.externo && !Object.hasOwn(plan.evaluaciones, f.id)
        )
      )
        throw new Error('Hay tareas internas pendientes de evaluación.')
      plan.estado = 'Evaluado'
    }
    plan.actualizado = fecha
    plan.version++
    auditar(plan.tag, anterior, plan)
  }
  siguiente.revision++
  siguiente.solicitudes[solicitud] = siguiente.revision
  return siguiente
}
