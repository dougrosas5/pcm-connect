import test from 'node:test'
import assert from 'node:assert/strict'
import { aplicar, escenario, pcm, taller } from './helpers/revisionFixtures.ts'
import { agregarTareas, nuevoPlan } from '../src/features/planificacion/model/modelo.ts'
import { validarComando } from '../src/features/planificacion/model/validacion.ts'
import { conflictosPendientes, erroresConfirmacion, estadoRevision, evaluacionVigente, filtrarRevision, filtrosRevisionVacios, indicadoresRevision, resolucionTarea, tareaActiva, tareaInterna, tareasInternasAsignables } from '../src/features/revision-pcm/model/revision.ts'
import type { Comando, DecisionPCM, Plan, Registro } from '../src/types/pcm.ts'

const guardar = (r: Registro, decisiones: DecisionPCM[]) => aplicar(r, { tipo: 'guardarRevision', planId: r.planes[0].id, version: r.planes[0].version, decisiones })
const confirmar = (r: Registro, reconocerConflictos = false) => aplicar(r, { tipo: 'confirmarPCM', planId: r.planes[0].id, version: r.planes[0].version, reconocerConflictos })
const correccion = (p: Plan, id = 'QA-2'): DecisionPCM => {
  const f = p.filas.find((f) => f.id === id)!
  return { tareaId: id, tipo: 'Devuelta a revisión', correccion: { descripcion: 'Corrección FICTICIA', criticidad: f.criticidad, tiempoPropuesto: '4', trabajadores: '1', responsableId: f.responsableId } }
}
test('M3: bandeja, indicadores y filtros combinados calculados del registro', () => {
  const r = escenario()
  const p = r.planes[0]
  assert.deepEqual(indicadoresRevision(r.planes), { Evaluadas: 1, 'Con rechazos': 1, 'Listas para confirmar': 0, Confirmadas: 0 })
  assert.equal(estadoRevision(p), 'Con rechazos')
  const filtros = { tag: ' pcm-000001 ', remolcador: p.remolcadorId, ubicacion: p.ubicacionId, estado: 'Con rechazos', desde: '2026-12-15', hasta: '2026-12-15', rechazos: 'si' }
  assert.equal(filtrarRevision(r.planes, filtros, false).length, 1)
  for (const cambio of [{ tag: 'no existe' }, { remolcador: 'otro' }, { ubicacion: 'otra' }, { estado: 'Confirmada' }, { rechazos: 'no' }, { desde: '2026-12-16' }, { hasta: '2026-12-14' }])
    assert.equal(filtrarRevision(r.planes, { ...filtros, ...cambio }, false).length, 0)
  assert.deepEqual(filtrarRevision([], filtrosRevisionVacios, false), [])
  assert.deepEqual(filtrarRevision(escenario(false).planes, filtrosRevisionVacios, false), [])
  assert.deepEqual(filtrarRevision(r.planes, filtrosRevisionVacios, true), [])
})
test('M3: borrador parcial, tercerización y eliminación lógica preservan OM, evaluación y autoría', () => {
  const original = escenario()
  let r = guardar(original, [{ tareaId: 'QA-2', tipo: 'Tercerizada' }])
  r = JSON.parse(JSON.stringify(r))
  assert.equal(r.planes[0].estado, 'Evaluado')
  assert.equal(erroresConfirmacion(r.planes[0]).length, 2)
  assert.equal(resolucionTarea(r.planes[0], 'QA-2')?.usuarioId, pcm.id)
  assert.equal(tareaInterna(r.planes[0], r.planes[0].filas[1]), false)
  assert.equal(tareaActiva(r.planes[0], r.planes[0].filas[1]), true)
  assert.throws(() => guardar(r, [{ tareaId: 'QA-3', tipo: 'Eliminada' }]), /Confirmá/u)
  r = guardar(r, [{ tareaId: 'QA-3', tipo: 'Eliminada', confirmada: true }])
  assert.equal(tareaActiva(r.planes[0], r.planes[0].filas[2]), false)
  assert.deepEqual(r.planes[0].filas, original.planes[0].filas)
  assert.deepEqual(r.planes[0].evaluaciones, original.planes[0].evaluaciones)
  assert.equal(r.planes[0].revisionPCM?.tareas['QA-2'].responsableOriginalId, 'responsable-1')
  assert.equal(original.planes[0].revisionPCM?.tareas['QA-2'].resoluciones.length, 0)
  assert.throws(() => confirmar(r), /QA-4: rechazo sin resolver/u)
  assert.deepEqual(tareasInternasAsignables(r.planes[0]), [])
})
test('M3: corrección versionada, reenvío sin duplicar OM y conservación de aceptadas', () => {
  const original = escenario(true, 2)
  let r = guardar(original, [correccion(original.planes[0])])
  assert.equal(r.planes.length, 1)
  assert.equal(r.contador, 1)
  assert.equal(r.planes[0].tag, original.planes[0].tag)
  assert.equal(estadoRevision(r.planes[0]), 'En reevaluación')
  assert.equal(evaluacionVigente(r.planes[0], 'QA-2'), undefined)
  assert.equal(r.planes[0].evaluaciones['QA-2'].resultado, 'Rechazada')
  assert.deepEqual(r.planes[0].filas[0], original.planes[0].filas[0])
  assert.deepEqual(r.planes[0].filas[1].ordenes, original.planes[0].filas[1].ordenes)
  assert.throws(() => confirmar(r), /reevaluación/u)
  assert.throws(() => aplicar(r, { tipo: 'finalizar', planId: r.planes[0].id }, taller), /pendientes/u)
  assert.throws(() => aplicar(r, { tipo: 'evaluar', planId: r.planes[0].id, tareaId: 'QA-1', resultado: 'Rechazada', motivo: 'No' }, taller), /congelada/u)
  r = aplicar(r, { tipo: 'evaluar', planId: r.planes[0].id, tareaId: 'QA-2', resultado: 'Aceptada', motivo: 'Corrección viable', tiempoAceptado: '5', trabajadoresAceptados: '2' }, taller)
  assert.throws(() => confirmar(r), /finalizar/u)
  r = aplicar(r, { tipo: 'finalizar', planId: r.planes[0].id }, taller)
  r = confirmar(r)
  const p = r.planes[0]
  assert.equal(p.estado, 'Confirmada')
  assert.equal(p.revisionPCM?.tareas['QA-2'].evaluaciones.length, 2)
  assert.equal(p.revisionPCM?.tareas['QA-2'].evaluaciones[0].resultado, 'Rechazada')
  assert.deepEqual(p.revisionPCM?.tareas['QA-2'].versiones[1].campos, ['descripcion', 'tiempoPropuesto', 'trabajadores'])
  assert.equal(tareasInternasAsignables(p).length, 2)
  assert.equal(new Set(p.filas.flatMap((f) => f.ordenes.map((o) => o.numero))).size, 4)
  assert.equal(p.revisionPCM?.confirmacion?.version, p.version)
  assert.equal(p.evaluaciones['QA-2'].tiempoAceptado, '5')
  assert.equal(p.filas[1].tiempoPropuesto, '4')
})
test('M3: Taller puede rechazar de nuevo y PCM resolver sin perder decisiones anteriores', () => {
  let r = escenario(true, 2)
  r = guardar(r, [correccion(r.planes[0])])
  r = aplicar(r, { tipo: 'evaluar', planId: r.planes[0].id, tareaId: 'QA-2', resultado: 'Rechazada', motivo: 'Nuevo rechazo ficticio' }, taller)
  r = aplicar(r, { tipo: 'finalizar', planId: r.planes[0].id }, taller)
  assert.equal(resolucionTarea(r.planes[0], 'QA-2'), undefined)
  assert.equal(estadoRevision(r.planes[0]), 'Con rechazos')
  r = guardar(r, [{ tareaId: 'QA-2', tipo: 'Tercerizada' }])
  r = confirmar(r)
  assert.equal(r.planes[0].revisionPCM?.tareas['QA-2'].evaluaciones.length, 2)
  assert.equal(r.planes[0].revisionPCM?.tareas['QA-2'].resoluciones.length, 2)
  assert.equal(tareasInternasAsignables(r.planes[0]).length, 1)
})
test('M3: confirmación exige datos válidos, tareas activas, versión y resolución de todos los rechazos', () => {
  const original = escenario(true, 2)
  assert.throws(() => confirmar(original), /rechazo/u)
  let r = guardar(original, [{ tareaId: 'QA-2', tipo: 'Eliminada', confirmada: true }])
  for (const cambios of [{ eta: '' }, { tag: 'inválido' }, { filas: [] }, { revisionPCM: { ...r.planes[0].revisionPCM!, versionEvaluada: null } }]) {
    const copia = structuredClone(r)
    Object.assign(copia.planes[0], cambios)
    assert.throws(() => confirmar(copia))
  }
  r = confirmar(r)
  assert.equal(tareasInternasAsignables(r.planes[0]).length, 1)
  assert.equal(filtrarRevision(r.planes, filtrosRevisionVacios, true).length, 1)
  assert.equal(filtrarRevision(r.planes, filtrosRevisionVacios, false).length, 0)
  assert.deepEqual(indicadoresRevision(r.planes), { Evaluadas: 1, 'Con rechazos': 0, 'Listas para confirmar': 0, Confirmadas: 1 })
  assert.throws(() => confirmar(r), /solo permite consulta/u)
})
test('M3: ETA detecta solapamientos, reconoce advertencias y mantiene alertas y aprobaciones', () => {
  let r = escenario(true, 1)
  const otro = structuredClone(r.planes[0])
  otro.id = 'plan-ficticio-segundo'
  otro.tag = 'PCM-000002'
  otro.eta = '2026-12-16T12:00:00.000Z'
  otro.filas[0].id = 'QA-OTRA'
  otro.filas[0].ordenes = [{ numero: 'OM-OTRA', estado: 'Valor aprobado', valor: 1 }]
  otro.evaluaciones = { 'QA-OTRA': { ...otro.evaluaciones['QA-1'] } }
  delete otro.revisionPCM
  r.planes.push(otro)
  const sinSolapamiento = { ...structuredClone(otro), id: 'plan-ficticio-sin-solapamiento', tag: 'PCM-000003', eta: '2027-01-01T12:00:00.000Z' }
  r.planes.push(sinSolapamiento)
  r.contador = 3
  const etaInicial = r.planes[0].etaInicial
  const evaluaciones = structuredClone(r.planes[0].evaluaciones)
  r = aplicar(r, { tipo: 'cambiarEta', planId: r.planes[0].id, version: r.planes[0].version, eta: '2026-12-16T13:00:00.000Z', comentario: 'Arribo ficticio cambiado' })
  assert.equal(conflictosPendientes(r.planes[0]).length, 1)
  assert.equal(conflictosPendientes(r.planes[1]).length, 1)
  assert.deepEqual(r.planes[2], sinSolapamiento, 'Sin modificaciones ni migración en planes no afectados')
  assert.match(conflictosPendientes(r.planes[0])[0].detalle, /PCM-000002/u)
  assert.equal(r.planes[0].etaInicial, etaInicial)
  assert.equal(r.planes[0].historialEta?.[0].rol, 'Planificador')
  assert.deepEqual(r.planes[0].evaluaciones, evaluaciones)
  assert.throws(() => confirmar(r), /Marcá la casilla de conflictos/u)
  r = confirmar(r, true)
  assert.equal(r.planes[0].revisionPCM?.confirmacion?.conAdvertencias, true)
  assert.equal(conflictosPendientes(r.planes[0])[0].estado, 'Pendiente de reprogramación')
  assert.equal(conflictosPendientes(r.planes[0])[0].reconocimiento?.usuarioId, pcm.id)
  assert.equal(tareasInternasAsignables(r.planes[0]).length, 1)
  assert.ok(r.historial.some((e) => e.accion === 'Reconocer alertas'))
})
test('M3: cancelación controlada conserva historia y libera reservas para nuevos planes', () => {
  const r = escenario()
  const p = r.planes[0]
  const c: Comando = { tipo: 'cancelarPCM', planId: p.id, version: p.version, motivo: 'Cambio de escala FICTICIO', confirmada: true }
  assert.throws(() => aplicar(r, { ...c, motivo: '' }), /motivo/u)
  assert.throws(() => aplicar(r, { ...c, confirmada: false }), /confirmación/u)
  const cancelada = aplicar(r, c)
  assert.equal(cancelada.planes.length, 1)
  assert.equal(cancelada.planes[0].estado, 'Cancelada')
  assert.deepEqual(cancelada.planes[0].filas, p.filas)
  assert.deepEqual(cancelada.planes[0].evaluaciones, p.evaluaciones)
  assert.deepEqual(tareasInternasAsignables(cancelada.planes[0]), [])
  assert.equal(cancelada.planes[0].revisionPCM?.cancelacion?.usuarioId, pcm.id)
  assert.equal(agregarTareas(nuevoPlan(pcm, 'plan-nuevo-ficticio'), 'QA-1', cancelada).plan.filas.length, 1)
  assert.throws(() => aplicar(cancelada, { tipo: 'cambiarEta', planId: p.id, version: cancelada.planes[0].version, eta: '2027-01-01T12:00:00.000Z', comentario: 'No permitido' }), /consulta/u)
})
test('M3: eliminación libera solo sus OM; tercerizadas conservan reserva externa', () => {
  let r = escenario(true, 3)
  r = guardar(r, [{ tareaId: 'QA-2', tipo: 'Eliminada', confirmada: true }, { tareaId: 'QA-3', tipo: 'Tercerizada' }])
  const nuevas = agregarTareas(nuevoPlan(pcm, 'plan-nuevo-ficticio'), 'QA-1 QA-2 QA-3', r)
  assert.deepEqual(nuevas.plan.filas.map((f) => f.id), ['QA-2'])
  const nuevo = { ...nuevas.plan, eta: r.planes[0].eta }
  r = aplicar(r, { tipo: 'guardar', plan: nuevo, enviar: false })
  assert.equal(r.planes.length, 2)
})
test('M3: permisos, estados congelados, comandos erróneos y guardado atómico', () => {
  const r = escenario()
  const p = r.planes[0]
  const c: Comando = { tipo: 'guardarRevision', planId: p.id, version: p.version, decisiones: [{ tareaId: 'QA-2', tipo: 'Tercerizada' }] }
  for (const rol of ['Taller', 'Supervisor Taller', 'Consulta'] as const) assert.throws(() => aplicar(r, c, { ...pcm, rol }), /Solo PCM/u)
  assert.throws(() => guardar(r, [{ tareaId: 'QA-1', tipo: 'Eliminada', confirmada: true }]), /congeladas/u)
  assert.throws(() => guardar(r, []), /No hay/u)
  assert.throws(() => guardar(r, [{ tareaId: 'NO-EXISTE', tipo: 'Tercerizada' }]), /pendientes/u)
  assert.throws(() => guardar(r, [c.decisiones[0], c.decisiones[0]]), /duplicadas/u)
  const antes = JSON.stringify(r)
  assert.throws(() => guardar(r, [c.decisiones[0], { tareaId: 'QA-1', tipo: 'Eliminada', confirmada: true }]))
  assert.equal(JSON.stringify(r), antes)
  assert.throws(() => validarComando({ ...c, decisiones: [{ tipo: 'Inventada' }] }), /inválidas/u)
  const corregir = correccion(p)
  assert.throws(() => guardar(r, [{ ...corregir, correccion: { ...corregir.correccion!, trabajadores: '1.5' } }]), /enteros/u)
  assert.throws(() => validarComando({ ...c, decisiones: [{ ...corregir, correccion: { ...corregir.correccion!, ordenes: [] } }] }), /inválidas/u)
})
test('M3: recibos idempotentes, versión obsoleta y datos históricos compatibles', () => {
  let r = escenario(true, 2)
  // Simula documento v1.3 anterior a la ampliación, conservando sus evaluaciones.
  delete r.planes[0].revisionPCM
  for (const e of Object.values(r.planes[0].evaluaciones)) { delete e.versionTarea; delete e.tiempoAceptado; delete e.trabajadoresAceptados; delete e.usuarioId }
  const original = structuredClone(r)
  const p = r.planes[0]
  const c: Comando = { tipo: 'guardarRevision', planId: p.id, version: p.version, decisiones: [{ tareaId: 'QA-2', tipo: 'Tercerizada' }] }
  r = aplicar(r, c, pcm, 'recibo-unico-revision')
  assert.deepEqual(aplicar(r, c, pcm, 'recibo-unico-revision'), r)
  assert.throws(() => aplicar(r, c), /cambió/u)
  assert.deepEqual(r.planes[0].evaluaciones, original.planes[0].evaluaciones)
  assert.equal(r.planes[0].revisionPCM?.tareas['QA-2'].evaluaciones.length, 1)
  assert.equal(r.planes[0].tag, original.planes[0].tag)
  const confirmarComando: Comando = { tipo: 'confirmarPCM', planId: p.id, version: r.planes[0].version, reconocerConflictos: false }
  r = aplicar(r, confirmarComando, pcm, 'recibo-unico-confirmacion')
  assert.deepEqual(aplicar(r, confirmarComando, pcm, 'recibo-unico-confirmacion'), r)
  const corrupta = structuredClone(r.planes[0])
  corrupta.revisionPCM!.tareas['QA-2'].version = 999
  assert.throws(() => validarComando({ tipo: 'guardar', plan: corrupta, enviar: false }), /guardada inválida/u)
})

test('M3: planes solo externos se confirman; eliminar todas las rechazadas bloquea confirmar', () => {
  let r = escenario(false, 1)
  r.planes[0].filas[0].responsableId = 'responsable-7'
  r = aplicar(r, { tipo: 'finalizar', planId: r.planes[0].id }, taller)
  r = confirmar(r)
  assert.equal(r.planes[0].estado, 'Confirmada')
  assert.deepEqual(tareasInternasAsignables(r.planes[0]), [])
  let todas = escenario(false, 1)
  todas = aplicar(todas, { tipo: 'evaluar', planId: todas.planes[0].id, tareaId: 'QA-1', resultado: 'Rechazada', motivo: 'Rechazo ficticio' }, taller)
  todas = aplicar(todas, { tipo: 'finalizar', planId: todas.planes[0].id }, taller)
  todas = guardar(todas, [{ tareaId: 'QA-1', tipo: 'Eliminada', confirmada: true }])
  assert.throws(() => confirmar(todas), /al menos una tarea activa/u)
  assert.equal(todas.planes[0].filas.length, 1)
})
