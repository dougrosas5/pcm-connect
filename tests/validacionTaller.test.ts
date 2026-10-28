import test from 'node:test'
import assert from 'node:assert/strict'
import { tareasDemo } from '../src/data/tareas.ts'
import { buscarTareas, resumirCostos } from '../src/features/busquedaTareas.ts'
import { actualizarPreparacion, crearPlanificacion, registroVacio } from '../src/features/planificaciones.ts'
import { clavePlanificaciones, guardarPlanificaciones, leerPlanificaciones } from '../src/features/almacenPlanificaciones.ts'
import { actorPCM, cancelarOMAceptada, corregirOM, datosOM, decidirPCM, enviarATaller, evaluarOM, finalizarEvaluacion, ordenesAsignables, permisos, puedeCorregir, revisionDe, rolesDemo, tallerDe } from '../src/features/validacionTaller.ts'
import type { Actor } from '../src/features/validacionTaller.ts'
import type { RegistroPlanificaciones } from '../src/features/planificaciones.ts'

const taller: Actor = { rol: 'Taller', usuario: 'Evaluador ficticio' }
const datos = { remolcador: 'Demo Norte', fechaParada: '2026-11-01', horasParada: '8' }
const codigo = 'PCM-0001'
const planDe = (registro: RegistroPlanificaciones) => registro.planificaciones[0]
function borrador() {
  let registro = crearPlanificacion(registroVacio(), datos)
  registro = actualizarPreparacion(registro, codigo, { filas: buscarTareas('1001 1003', tareasDemo, []).filas })
  registro = actualizarPreparacion(registro, codigo, { datosPorTarea: { '1001': { duracionPrevista: '3', responsable: 'Douglas', personas: '2' }, '1003': { duracionPrevista: '1.5', responsable: 'Ale', personas: '1' } } })
  return registro
}
function enviado() { return enviarATaller(borrador(), codigo, actorPCM) }
function mixto() {
  let registro = enviado()
  registro = evaluarOM(registro, codigo, 'OM-001', 'Viable', 'Material disponible', 2, taller)
  registro = evaluarOM(registro, codigo, 'OM-002', 'No viable', 'Falta repuesto', 2, taller)
  registro = evaluarOM(registro, codigo, 'OM-004', 'Viable', '', 2, taller)
  return registro
}
function finalizado() { return finalizarEvaluacion(mixto(), codigo, taller) }
function almacenDemo() {
  const mapa = new Map<string, string>()
  return { getItem: (clave: string) => mapa.get(clave) ?? null, setItem: (clave: string, valor: string) => { mapa.set(clave, valor) } }
}

test('no envía vacío ni datos inválidos; PCM envía sin duplicar planes o identidades', () => {
  assert.throws(() => enviarATaller(crearPlanificacion(registroVacio(), datos), codigo, actorPCM), /al menos una OM/u)
  let registro = borrador()
  registro = actualizarPreparacion(registro, codigo, { datosPorTarea: { '1001': { duracionPrevista: '0', responsable: '', personas: '0' } } })
  assert.throws(() => enviarATaller(registro, codigo, actorPCM), /Completá/u)
  const original = borrador()
  const siguiente = enviarATaller(original, codigo, actorPCM)
  assert.equal(siguiente.planificaciones.length, 1)
  assert.equal(siguiente.ultimoNumero, 1)
  assert.equal(planDe(original).estado, 'Borrador')
  assert.equal(planDe(siguiente).estado, 'Pendiente de Taller')
  assert.throws(() => enviarATaller(siguiente, codigo, actorPCM), /disponible/u)
})

test('la evaluación es por OM: aprueba y rechaza dos OM de la misma tarea', () => {
  const registro = mixto()
  assert.equal(revisionDe(planDe(registro), 'OM-001').resultado, 'Viable')
  assert.equal(revisionDe(planDe(registro), 'OM-002').resultado, 'No viable')
  assert.equal(revisionDe(planDe(registro), 'OM-002').motivo, 'Falta repuesto')
  assert.deepEqual(ordenesAsignables(planDe(registro)), [])
  const evento = tallerDe(planDe(registro)).historial.find(item => item.om === 'OM-002' && item.tipo === 'Evaluación de OM')!
  assert.equal(evento.planificacion, codigo)
  assert.equal(evento.usuario, taller.usuario)
  assert.equal(evento.rol, 'Taller')
  assert.ok(Number.isFinite(Date.parse(evento.fecha)))
  assert.match(evento.nuevo!, /Falta repuesto/u)
})

test('rechazar exige motivo; pendientes, OM desconocidas y revisiones obsoletas bloquean finalizar', () => {
  const registro = enviado()
  for (const motivo of ['', '   ']) assert.throws(() => evaluarOM(registro, codigo, 'OM-001', 'No viable', motivo, 2, taller), /obligatorio/u)
  assert.throws(() => evaluarOM(registro, codigo, 'OM-999', 'Viable', '', 1, taller), /ya no está/u)
  assert.throws(() => evaluarOM(registro, codigo, 'OM-001', 'Viable', '', 1, taller), /cambió/u)
  assert.throws(() => finalizarEvaluacion(registro, codigo, taller), /pendientes/u)
  const pendiente = evaluarOM(mixto(), codigo, 'OM-001', 'Pendiente', 'Revisar', 2, taller)
  assert.throws(() => finalizarEvaluacion(pendiente, codigo, taller), /pendientes/u)
})

test('roles centralizados: PCM y tres encargados no evalúan; Taller no crea, envía ni decide', () => {
  const registro = mixto()
  for (const rol of rolesDemo.filter(rol => rol !== 'Taller')) {
    const actor = { rol, usuario: `${rol} ficticio` }
    assert.equal(permisos(actor).evaluar, false)
    assert.throws(() => evaluarOM(registro, codigo, 'OM-001', 'No viable', 'Motivo', 2, actor), /Solo Taller/u)
    assert.throws(() => finalizarEvaluacion(registro, codigo, actor), /Solo Taller/u)
  }
  assert.throws(() => crearPlanificacion(registro, datos, taller), /Solo PCM/u)
  assert.throws(() => actualizarPreparacion(registro, codigo, { entrada: '1003' }, taller), /Solo PCM/u)
  assert.throws(() => enviarATaller(registro, codigo, taller), /Solo PCM/u)
  assert.throws(() => decidirPCM(finalizado(), codigo, 'Continuar', '', false, taller), /Solo PCM/u)
})

test('PCM cambia una OM evaluada: aumenta revisión y solo invalida esa OM; historial previo intacto', () => {
  const original = mixto()
  const historial = tallerDe(planDe(original)).historial
  const datosAnteriores = datosOM(planDe(original), 'OM-001')
  const modificado = corregirOM(original, codigo, 'OM-001', { ...datosAnteriores, duracionPrevista: '5' }, 'Nueva duración', 2, actorPCM)
  const plan = planDe(modificado)
  assert.equal(revisionDe(plan, 'OM-001').revision, 3)
  assert.equal(revisionDe(plan, 'OM-001').resultado, 'Pendiente')
  assert.equal(revisionDe(plan, 'OM-001').evaluada, 2)
  assert.deepEqual(revisionDe(plan, 'OM-002'), revisionDe(planDe(original), 'OM-002'))
  assert.deepEqual(tallerDe(plan).historial.slice(0, historial.length), historial)
  assert.match(tallerDe(plan).historial.at(-1)!.anterior!, /"duracionPrevista":"3"/u)
  assert.match(tallerDe(plan).historial.at(-1)!.nuevo!, /"duracionPrevista":"5"/u)
  assert.throws(() => finalizarEvaluacion(modificado, codigo, taller), /reevaluación/u)
  assert.throws(() => evaluarOM(modificado, codigo, 'OM-001', 'Viable', '', 2, taller), /cambió/u)
  const reevaluado = evaluarOM(modificado, codigo, 'OM-001', 'Viable', '', 3, taller)
  assert.equal(planDe(finalizarEvaluacion(reevaluado, codigo, taller)).estado, 'Pendiente de PCM')
})

test('cambiar datos comunes reevalúa las OM afectadas de esa tarea, sin afectar otras ni costos', () => {
  const original = mixto()
  const plan = planDe(original)
  const registro = actualizarPreparacion(original, codigo, { datosPorTarea: { ...plan.preparacion.datosPorTarea, '1001': { duracionPrevista: '5', responsable: 'Douglas', personas: '2' } } })
  assert.equal(revisionDe(planDe(registro), 'OM-001').resultado, 'Pendiente')
  assert.equal(revisionDe(planDe(registro), 'OM-002').resultado, 'Pendiente')
  assert.deepEqual(revisionDe(planDe(registro), 'OM-004'), revisionDe(plan, 'OM-004'))
  assert.deepEqual(planDe(registro).preparacion.filas, plan.preparacion.filas)
  const soloBusqueda = actualizarPreparacion(original, codigo, { entrada: '1001' })
  assert.deepEqual(tallerDe(planDe(soloBusqueda)), tallerDe(plan))
})

test('finalizar congela viables, bloquea edición ordinaria y evaluaciones repetidas', () => {
  const registro = finalizado()
  const plan = planDe(registro)
  assert.equal(plan.estado, 'Pendiente de PCM')
  assert.ok(revisionDe(plan, 'OM-001').congelada)
  assert.equal(revisionDe(plan, 'OM-002').congelada, false)
  assert.deepEqual(revisionDe(plan, 'OM-001').datos, datosOM(plan, 'OM-001'))
  assert.throws(() => actualizarPreparacion(registro, codigo, { entrada: '' }), /solo lectura/u)
  assert.throws(() => corregirOM(registro, codigo, 'OM-001', { ...datosOM(plan, 'OM-001'), costo: 1 }, 'Cambiar', 2, actorPCM), /autorizada/u)
  assert.throws(() => evaluarOM(registro, codigo, 'OM-001', 'No viable', 'Intento', 2, taller), /disponible/u)
  assert.throws(() => finalizarEvaluacion(registro, codigo, taller), /no está abierta/u)
})

test('Continuar confirma solo viables vigentes y excluye rechazadas; no hay asignables en otros estados', () => {
  const registro = decidirPCM(finalizado(), codigo, 'Continuar', 'Solo viables', false, actorPCM)
  assert.equal(planDe(registro).estado, 'Confirmada')
  assert.deepEqual(ordenesAsignables(planDe(registro)).map(fila => fila.numero), ['OM-001', 'OM-004'])
  assert.throws(() => decidirPCM(registro, codigo, 'Continuar', '', false, actorPCM), /pendiente/u)
  assert.throws(() => actualizarPreparacion(registro, codigo, { entrada: '' }), /solo lectura/u)
  let rechazado = enviado()
  for (const om of ['OM-001', 'OM-002', 'OM-004']) rechazado = evaluarOM(rechazado, codigo, om, 'No viable', 'Sin repuestos', 2, taller)
  rechazado = finalizarEvaluacion(rechazado, codigo, taller)
  assert.throws(() => decidirPCM(rechazado, codigo, 'Continuar', '', false, actorPCM), /No hay OM viables/u)
})

test('Devolver conserva aprobaciones, permite corrección a PCM y Taller y exige reevaluar al reenviar', () => {
  const final = finalizado()
  const devuelto = decidirPCM(final, codigo, 'Devolver a revisión', 'Corregir repuesto', false, actorPCM)
  const aprobado = revisionDe(planDe(devuelto), 'OM-001')
  for (const actor of [actorPCM, taller]) {
    assert.equal(puedeCorregir(planDe(devuelto), 'OM-001', actor), false)
    assert.equal(puedeCorregir(planDe(devuelto), 'OM-002', actor), true)
    const corregido = corregirOM(devuelto, codigo, 'OM-002', { ...datosOM(planDe(devuelto), 'OM-002'), descripcion: 'Repuesto recibido; alinear acoplamiento' }, 'Llegó repuesto', 2, actor)
    assert.equal(revisionDe(planDe(corregido), 'OM-002').resultado, 'Pendiente')
    const reenviado = enviarATaller(corregido, codigo, actorPCM)
    assert.deepEqual(revisionDe(planDe(reenviado), 'OM-001'), aprobado)
    assert.throws(() => finalizarEvaluacion(reenviado, codigo, taller), /pendientes/u)
    const evaluado = evaluarOM(reenviado, codigo, 'OM-002', 'Viable', '', 3, taller)
    const completo = finalizarEvaluacion(evaluado, codigo, taller)
    assert.equal(planDe(completo).estado, 'Pendiente de PCM')
    assert.deepEqual(tallerDe(planDe(completo)).historial.slice(0, tallerDe(planDe(final)).historial.length), tallerDe(planDe(final)).historial)
  }
})

test('reenviar sin cambiar una rechazada exige nueva decisión y nunca la convierte en viable', () => {
  const revision = decidirPCM(finalizado(), codigo, 'Devolver a revisión', '', false, actorPCM)
  const reenviado = enviarATaller(revision, codigo, actorPCM)
  assert.equal(revisionDe(planDe(reenviado), 'OM-002').resultado, 'Pendiente')
  assert.throws(() => finalizarEvaluacion(reenviado, codigo, taller), /pendientes/u)
})

test('cancelar plan requiere confirmación y motivo, conserva aprobaciones e historial y bloquea asignaciones', () => {
  const registro = finalizado()
  assert.throws(() => decidirPCM(registro, codigo, 'Cancelar', '', true, actorPCM), /motivo/u)
  assert.throws(() => decidirPCM(registro, codigo, 'Cancelar', 'Cambio de escala', false, actorPCM), /Confirmá/u)
  const cancelado = decidirPCM(registro, codigo, 'Cancelar', 'Cambio de escala', true, actorPCM)
  const plan = planDe(cancelado)
  assert.equal(plan.estado, 'Cancelada')
  assert.deepEqual(ordenesAsignables(plan), [])
  assert.deepEqual(revisionDe(plan, 'OM-001'), revisionDe(planDe(registro), 'OM-001'))
  assert.equal(tallerDe(plan).historial.at(-1)!.anterior, 'Pendiente de PCM')
  assert.equal(tallerDe(plan).historial.at(-1)!.nuevo, 'Cancelada')
  assert.throws(() => enviarATaller(cancelado, codigo, actorPCM), /disponible/u)
  assert.throws(() => actualizarPreparacion(cancelado, codigo, { filas: [] }), /solo lectura/u)
})

test('quitar OM y tarea en borrador conserva trazas; ninguna OM aceptada se borra y su cancelación está restringida', () => {
  const registro = borrador()
  const sinUna = actualizarPreparacion(registro, codigo, { filas: planDe(registro).preparacion.filas.filter(fila => fila.numero !== 'OM-001') })
  assert.deepEqual(planDe(sinUna).preparacion.filas.map(fila => fila.numero), ['OM-002', 'OM-004'])
  const sinTarea = actualizarPreparacion(registro, codigo, { filas: planDe(registro).preparacion.filas.filter(fila => fila.tarea !== '1001') })
  assert.deepEqual(planDe(sinTarea).preparacion.filas.map(fila => fila.numero), ['OM-004'])
  assert.deepEqual(tallerDe(planDe(sinTarea)).historial.filter(evento => evento.tipo === 'OM quitada').map(evento => evento.om), ['OM-001', 'OM-002'])
  assert.throws(() => actualizarPreparacion(mixto(), codigo, { filas: [] }), /cancelación controlada/u)
  for (const rol of rolesDemo) assert.throws(() => cancelarOMAceptada(finalizado(), codigo, 'OM-001', 'Motivo', { rol, usuario: rol }), /restringida/u)
})

test('migración aditiva conserva planes v1, códigos y contador; todas las etapas y el historial sobreviven al JSON', () => {
  const almacen = almacenDemo()
  const antiguo = borrador()
  delete antiguo.planificaciones[0].taller
  almacen.setItem(clavePlanificaciones, JSON.stringify(antiguo))
  const texto = almacen.getItem(clavePlanificaciones)
  assert.deepEqual(leerPlanificaciones(almacen), antiguo)
  assert.equal(almacen.getItem(clavePlanificaciones), texto)
  const recibido = enviarATaller(leerPlanificaciones(almacen), codigo, actorPCM)
  assert.equal(recibido.activa, codigo)
  assert.equal(recibido.ultimoNumero, 1)
  assert.equal(recibido.planificaciones.length, 1)
  assert.equal(tallerDe(planDe(recibido)).historial[0].tipo, 'Envío a Taller')
  const final = finalizado()
  for (const estado of [borrador(), enviado(), mixto(), final,
    decidirPCM(final, codigo, 'Continuar', '', false, actorPCM),
    decidirPCM(final, codigo, 'Devolver a revisión', '', false, actorPCM),
    decidirPCM(final, codigo, 'Cancelar', 'Cambio de escala', true, actorPCM)]) {
    guardarPlanificaciones(almacen, estado)
    assert.deepEqual(leerPlanificaciones(almacen), estado)
  }
})

test('datos Taller corruptos bloquean lectura sin sobrescritura', () => {
  const almacen = almacenDemo()
  for (const cambio of [
    { revision: 0 }, { resultado: 'Cualquier cosa' }, { motivo: null }, { resultado: 'No viable', motivo: '' },
    { congelada: true, resultado: 'Pendiente' }, { datos: { costo: -1 } }, { cancelada: 'sí' },
  ]) {
    const registro = finalizado()
    Object.assign(planDe(registro).taller!.ordenes['OM-001'], cambio)
    const texto = JSON.stringify(registro)
    almacen.setItem(clavePlanificaciones, texto)
    assert.throws(() => leerPlanificaciones(almacen))
    assert.equal(almacen.getItem(clavePlanificaciones), texto)
  }
})

test('quitar y reincorporar en borrador conserva las revisiones históricas y no reutiliza la revisión', () => {
  const registro = borrador()
  const quitado = actualizarPreparacion(registro, codigo, { filas: planDe(registro).preparacion.filas.filter(fila => fila.numero !== 'OM-001') })
  const reincorporado = actualizarPreparacion(quitado, codigo, { filas: buscarTareas('1001', tareasDemo, planDe(quitado).preparacion.filas).filas })
  assert.equal(revisionDe(planDe(reincorporado), 'OM-001').revision, 3)
  assert.equal(revisionDe(planDe(reincorporado), 'OM-001').resultado, 'Pendiente')
  assert.deepEqual(tallerDe(planDe(reincorporado)).historial.slice(0, tallerDe(planDe(quitado)).historial.length), tallerDe(planDe(quitado)).historial)
})

test('devolver un plan con todas las OM aprobadas conserva su congelamiento y permite volver a PCM', () => {
  const registro = evaluarOM(mixto(), codigo, 'OM-002', 'Viable', 'Repuesto recibido', 2, taller)
  const final = finalizarEvaluacion(registro, codigo, taller)
  const devuelto = decidirPCM(final, codigo, 'Devolver a revisión', 'Consultar aprobación', false, actorPCM)
  const reenviado = enviarATaller(devuelto, codigo, actorPCM)
  assert.deepEqual(tallerDe(planDe(reenviado)).ordenes, tallerDe(planDe(final)).ordenes)
  assert.equal(planDe(finalizarEvaluacion(reenviado, codigo, taller)).estado, 'Pendiente de PCM')
})

test('corregir costo mantiene el cálculo existente, la duración común y el aislamiento por OM y planificación', () => {
  const original = crearPlanificacion(mixto(), datos)
  const registro = corregirOM(original, codigo, 'OM-001', { ...datosOM(planDe(original), 'OM-001'), costo: 400000, duracionPrevista: '5' }, 'Cotización ficticia actualizada', 2, actorPCM)
  assert.equal(resumirCostos(planDe(registro).preparacion.filas).subtotal, 1000000)
  assert.equal(planDe(registro).preparacion.datosPorTarea!['1001'].duracionPrevista, '3')
  assert.equal(datosOM(planDe(registro), 'OM-001').duracionPrevista, '5')
  assert.equal(datosOM(planDe(registro), 'OM-002').duracionPrevista, '3')
  assert.deepEqual(registro.planificaciones[1], original.planificaciones[1])
  const almacen = almacenDemo()
  guardarPlanificaciones(almacen, registro)
  assert.deepEqual(leerPlanificaciones(almacen), registro)
})
