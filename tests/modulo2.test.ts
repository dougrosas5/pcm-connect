import test from 'node:test'
import assert from 'node:assert/strict'
import { aplicarComando } from '../src/features/planificacion/model/comandos.ts'
import { finParada, nuevoPlan, registroInicial } from '../src/features/planificacion/model/modelo.ts'
import type { Actor, Comando, Plan, Registro } from '../src/types/pcm.ts'
import { validarComando } from '../src/features/planificacion/model/validacion.ts'
import { filtrarPlanes, filtrosVacios, progresoAnterior } from '../src/features/validacion-taller/model/bandeja.ts'

const pcm: Actor = { id: 'pcm-ficticio', nombre: 'PCM ficticio', rol: 'Planificador' }
const supervisor: Actor = { id: 'supervisor-ficticio', nombre: 'Supervisor ficticio', rol: 'Supervisor Taller' }
const original = '2026-12-31T23:00:00.000Z'
const nueva = '2027-01-01T02:30:00.000Z'
const fecha = '2026-11-10T15:00:00.000Z'
let secuencia = 0
function aplicar(r: Registro, comando: Comando, actor = pcm, solicitud = `prueba-eta-${++secuencia}`) {
  validarComando(comando)
  return aplicarComando(r, comando, actor, solicitud, fecha)
}
function base() {
  return aplicar(registroInicial(), {
    tipo: 'guardar', enviar: false,
    plan: { ...nuevoPlan(pcm, 'plan-eta-ficticio-001'), eta: original, horasParada: '2.5' }
  })
}
function comando(plan: Plan): Comando {
  return { tipo: 'cambiarEta', planId: plan.id, version: plan.version, eta: nueva, comentario: 'Arribo ficticio reprogramado' }
}

test('M2: fija ETA inicial, protege auditoría y exige operación explícita para ETA final', () => {
  const r = base()
  const p = r.planes[0]
  assert.equal(p.etaInicial, original)
  assert.equal(p.origenEtaInicial, 'creacion')
  const guardado = aplicar(r, { tipo: 'guardar', enviar: false, plan: { ...p, etaInicial: nueva, historialEta: [] } })
  assert.equal(guardado.planes[0].etaInicial, original)
  assert.throws(() => aplicar(r, { tipo: 'guardar', enviar: false, plan: { ...p, eta: nueva } }), /historial/u)
  assert.equal(r.planes[0].version, 1)
})

test('M2: cambio conserva identificadores, propuesta, costos, decisiones y estado; calcula fin desde ETA final', () => {
  const r = base()
  const p = r.planes[0]
  p.estado = 'Evaluado'
  p.filas = [{ id: 'TAREA-FICTICIA', descripcion: 'Trabajo ficticio', tiempoOriginal: 2, tiempoPropuesto: '3',
    trabajadores: '2', criticidad: 'Alta', estado: 'Abierta', responsableId: 'responsable-1',
    ordenes: [{ numero: 'OM-FICTICIA', estado: 'Valor aprobado', valor: 120000 }] }]
  p.evaluaciones = { 'TAREA-FICTICIA': { resultado: 'Aceptada', motivo: '', usuario: 'Taller ficticio', fecha } }
  const antes = structuredClone(r)
  const c = comando(p)
  const despues = aplicar(r, c, supervisor, 'recibo-eta-ficticio')
  const nuevo = despues.planes[0]
  assert.deepEqual(r, antes)
  assert.equal(nuevo.id, p.id)
  assert.equal(nuevo.tag, p.tag)
  assert.equal(nuevo.etaInicial, original)
  assert.equal(nuevo.eta, nueva)
  assert.equal(finParada(nuevo), '2027-01-01T05:00:00.000Z')
  assert.equal(nuevo.estado, 'Evaluado')
  assert.deepEqual(nuevo.evaluaciones, p.evaluaciones)
  assert.deepEqual(nuevo.filas, p.filas)
  assert.deepEqual(nuevo.historialEta, [{ fecha, usuarioId: supervisor.id, usuario: supervisor.nombre, rol: supervisor.rol,
    anterior: original, nuevo: nueva, comentario: 'Arribo ficticio reprogramado', revisionDisponibilidad: 'pendiente' }])
  assert.equal(despues.historial.at(-1)?.accion, 'cambiarEta')
  assert.deepEqual(aplicar(despues, c, supervisor, 'recibo-eta-ficticio'), despues)
  assert.throws(() => aplicar(despues, c), /cambió/u)
  assert.throws(() => aplicar(despues, comando(nuevo)), /no cambió/u)
})

test('M2: permisos, fecha inválida y comentario vacío no modifican el registro', () => {
  const r = base()
  const c = comando(r.planes[0])
  for (const rol of ['Taller', 'Consulta'] as const)
    assert.throws(() => aplicar(r, c, { ...pcm, rol }), /Supervisor/u)
  for (const rol of ['Planificador', 'Administrador', 'Supervisor Taller'] as const)
    assert.equal(aplicar(r, c, { ...pcm, rol }).planes[0].eta, nueva)
  for (const datos of [{ eta: '' }, { eta: '2026-02-30T00:00:00.000Z' }, { comentario: '  ' }, { version: -1 }])
    assert.throws(() => validarComando({ ...c, ...datos }), /válida/u)
  assert.equal(r.historial.length, 1)
  assert.equal(r.planes[0].eta, original)
})

test('M2: registro antiguo conserva ETA disponible, ausencias y evaluaciones sin mutar la fuente', () => {
  for (const eta of [original, '']) {
    const r = base()
    const p = r.planes[0]
    delete p.etaInicial
    delete p.origenEtaInicial
    delete p.historialEta
    p.eta = eta
    const texto = JSON.stringify(r)
    const nuevo = aplicar(r, comando(p)).planes[0]
    assert.equal(nuevo.etaInicial, eta)
    assert.equal(nuevo.origenEtaInicial, eta ? 'heredada' : 'sin-dato')
    assert.equal(JSON.stringify(r), texto)
    assert.equal(nuevo.historialEta?.[0].anterior, eta)
  }
})

test('M2: filtros combinados, fechas inclusivas Montevideo, vacíos y progreso histórico sin inventar cierre', () => {
  const p = base().planes[0]
  p.remolcadorId = 'remolcador-ficticio'
  p.ubicacionId = 'ubicacion-ficticia'
  p.eta = nueva // 31/12 a las 23:30 en Montevideo.
  const filtros = { ...filtrosVacios, tag: ' pcm-000001 ', remolcador: p.remolcadorId,
    ubicacion: p.ubicacionId, estado: 'Borrador', desde: '2026-12-31', hasta: '2026-12-31' }
  assert.equal(filtrarPlanes([p], filtros, false).length, 1)
  for (const datos of [{ tag: 'INEXISTENTE' }, { remolcador: 'otro' }, { ubicacion: 'otra' },
    { estado: 'Evaluado' }, { desde: '2027-01-01' }, { hasta: '2026-12-30' }])
    assert.equal(filtrarPlanes([p], { ...filtros, ...datos }, false).length, 0)
  assert.equal(filtrarPlanes([{ ...p, eta: '' }], filtros, false).length, 0)
  assert.deepEqual(filtrarPlanes([], filtros, false), [])
  assert.deepEqual(filtrarPlanes([{ ...p, estado: 'Evaluado' }], filtrosVacios, true), [])
  assert.equal(progresoAnterior(p), 'Sin enviar')
})
