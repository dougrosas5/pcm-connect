import test from 'node:test'
import assert from 'node:assert/strict'
import type { AjusteTaller, Comando, Plan } from '../src/types/pcm.ts'
import { aplicar, escenario, pcm, taller } from './helpers/revisionFixtures.ts'
import { finParada } from '../src/features/planificacion/model/modelo.ts'
import { conflictosPendientes, evaluacionVigente, filtrarRevision, filtrosRevisionVacios } from '../src/features/revision-pcm/model/revision.ts'
import { ajusteInicial } from '../src/features/validacion-taller/model/evaluacion.ts'
import { compromisosPorEspecialidad } from '../src/features/validacion-taller/model/disponibilidad.ts'

const supervisor = { ...taller, rol: 'Supervisor Taller' as const }
const ajuste = (plan: Plan, i: number, cambios: Partial<AjusteTaller> = {}) => ({
  ...ajusteInicial(plan, plan.filas[i]), ...cambios
})
function evaluar(p: Plan, ajustes: AjusteTaller[], finalizar = false): Comando {
  return { tipo: 'evaluacionTaller', planId: p.id, version: p.version, ajustes, finalizar }
}

test('Taller: borrador por tarea, persistencia, validaciones, compromiso y cierre atómico', () => {
  let r = escenario(false, 3)
  const p = r.planes[0]
  p.filas[2].responsableId = 'responsable-7'
  const om = structuredClone(p.filas)
  const aceptada = ajuste(p, 0, { resultado: 'Aceptada', horas: '6', trabajadores: '2' })
  const rechazada = ajuste(p, 1, { resultado: 'Rechazada' })
  assert.throws(() => aplicar(r, evaluar(p, [aceptada]), pcm), /Solo Taller/u)
  assert.throws(() => aplicar(r, evaluar(p, [aceptada]), { ...pcm, rol: 'Administrador' }), /Solo Taller/u)
  assert.throws(() => aplicar(r, evaluar(p, [rechazada]), taller), /comentario/u)
  assert.throws(() => aplicar(r, evaluar(p, [{ ...aceptada, horas: '0' }]), taller), /horas mayores/u)
  assert.throws(() => aplicar(r, evaluar(p, [{ ...aceptada, trabajadores: '1.5' }]), taller), /entera/u)
  assert.throws(() => aplicar(r, evaluar(p, [ajuste(p, 2)]), taller), /no admite/u)
  const guardar = evaluar(p, [aceptada])
  r = aplicar(r, guardar, taller, 'borrador-repetido-qa')
  assert.strictEqual(aplicar(r, guardar, taller, 'borrador-repetido-qa'), r)
  r = JSON.parse(JSON.stringify(r))
  const borrador = r.planes[0]
  assert.equal(borrador.estado, 'En evaluación')
  assert.deepEqual(borrador.borradorTaller, [aceptada])
  assert.deepEqual(borrador.evaluaciones, {})
  assert.deepEqual(filtrarRevision(r.planes, filtrosRevisionVacios, false), [])
  assert.equal(compromisosPorEspecialidad(r, borrador).find(g => g.id === 'responsable-1')?.propias, 12)
  assert.throws(() => aplicar(r, evaluar(borrador, [], true), taller), /pendientes/u)
  assert.throws(() => aplicar(r, evaluar(p, [], true), taller), /versión vigente/u)
  assert.equal(r.planes[0].borradorTaller?.length, 1)
  r = aplicar(r, evaluar(borrador, [{ ...rechazada, motivo: 'Repuesto sin disponibilidad' }], true), taller)
  const final = r.planes[0]
  assert.equal(final.estado, 'Evaluado')
  assert.equal(final.revisionPCM?.versionEvaluada, final.revisionPCM?.versionContenido)
  assert.equal(evaluacionVigente(final, aceptada.tareaId)?.tiempoAceptado, '6')
  assert.equal(evaluacionVigente(final, rechazada.tareaId)?.motivo, 'Repuesto sin disponibilidad')
  assert.equal(Object.keys(final.evaluaciones).length, 2)
  assert.equal(final.borradorTaller, undefined)
  assert.deepEqual(final.filas, om)
  assert.equal(filtrarRevision(r.planes, filtrosRevisionVacios, false)[0]?.tag, p.tag)
  assert.equal(r.historial.at(-1)?.usuarioId, taller.id)
  assert.throws(() => aplicar(r, evaluar(final, [aceptada]), taller), /no está disponible/u)
  assert.throws(() => aplicar(r, { tipo: 'guardar', plan: final, enviar: false }), /ya fue enviada/u)
})

test('Taller: un ajuste de PCM invalida solo la tarea modificada y conserva el historial', () => {
  let r = escenario(false, 3)
  let p = r.planes[0]
  r = aplicar(r, { tipo: 'evaluar', planId: p.id, version: p.version, tareaId: p.filas[0].id, resultado: 'Aceptada', motivo: '' }, taller)
  p = r.planes[0]
  r = aplicar(r, evaluar(p, [ajuste(p, 1, { resultado: 'Aceptada' }), ajuste(p, 2, { resultado: 'Aceptada' })]), taller)
  p = r.planes[0]
  const propuesta = { ...p, filas: p.filas.map((f, i) => i < 2 ? { ...f, tiempoPropuesto: '4' } : f) }
  r = aplicar(r, { tipo: 'guardar', plan: propuesta, enviar: false })
  const vigente = r.planes[0]
  assert.equal(vigente.id, p.id)
  assert.equal(vigente.tag, p.tag)
  assert.equal(evaluacionVigente(vigente, 'QA-1'), undefined)
  assert.equal(vigente.revisionPCM?.tareas['QA-1'].evaluaciones[0]?.resultado, 'Aceptada')
  assert.deepEqual(vigente.borradorTaller?.map(a => a.tareaId), ['QA-3'])
  assert.equal(ajuste(vigente, 1).versionTarea, 2)
  assert.throws(() => aplicar(r, evaluar(vigente, [ajuste(p, 1)], true), taller), /desactualizada/u)
  assert.deepEqual(filtrarRevision(r.planes, filtrosRevisionVacios, false), [])
})

test('ETA predictiva: guardar, confirmar, rechazar la repetición y conservar compromisos e inicial', () => {
  let r = escenario(false, 2)
  let p = r.planes[0]
  r = aplicar(r, evaluar(p, [ajuste(p, 0, { resultado: 'Aceptada', horas: '10' })]), taller)
  p = r.planes[0]
  const eta = '2026-12-16T13:00:00.000Z'
  const guardar = { tipo: 'guardarPredictiva' as const, planId: p.id, version: p.version, eta }
  assert.throws(() => aplicar(r, guardar, taller), /permiso/u)
  r = aplicar(r, guardar, supervisor)
  const prevista = r.planes[0]
  assert.equal(prevista.eta, p.eta)
  assert.equal(finParada(prevista), finParada(p))
  assert.equal(prevista.historialEta?.length, 0)
  assert.equal(prevista.historialPredictiva?.[0]?.nuevo, eta)
  const confirmar = { tipo: 'confirmarPredictiva' as const, planId: p.id, version: prevista.version, eta, comentario: 'ETA confirmada por operaciones', confirmada: true }
  assert.throws(() => aplicar(r, { ...confirmar, confirmada: false }, supervisor), /confirmación/u)
  assert.throws(() => aplicar(r, confirmar, taller), /Supervisor/u)
  assert.throws(() => aplicar(r, { ...confirmar, version: p.version }, supervisor), /reabrí|Reabrí|Actualizá/u)
  r = aplicar(r, confirmar, supervisor, 'confirmar-repetido-qa')
  const final = r.planes[0]
  assert.equal(final.eta, eta)
  assert.equal(final.etaInicial, p.etaInicial)
  assert.equal(finParada(final), '2026-12-16T21:00:00.000Z')
  assert.deepEqual(final.borradorTaller, p.borradorTaller)
  assert.equal(final.historialEta?.[0]?.origen, 'predictiva')
  assert.equal(final.historialEta?.[0]?.anterior, p.eta)
  assert.equal(final.historialEta?.[0]?.rol, supervisor.rol)
  assert.match(conflictosPendientes(final)[0]?.detalle ?? '', /10 h mayor/u)
  assert.strictEqual(aplicar(r, confirmar, supervisor, 'confirmar-repetido-qa'), r)
  assert.throws(() => aplicar(r, { ...confirmar, version: final.version }, supervisor), /confirmada/u)
})
