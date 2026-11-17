import { aplicarComando } from '../../src/features/planificacion/model/comandos.ts'
import { agregarTareas, nuevoPlan, registroInicial } from '../../src/features/planificacion/model/modelo.ts'
import { validarComando } from '../../src/features/planificacion/model/validacion.ts'
import type { Actor, Comando, Registro } from '../../src/types/pcm.ts'

export const pcm: Actor = { id: 'pcm-m3-ficticio', nombre: 'PCM FICTICIO QA', rol: 'Planificador' }
export const taller: Actor = { id: 'taller-m3-ficticio', nombre: 'Taller FICTICIO QA', rol: 'Taller' }
export const fecha = '2026-11-12T15:00:00.000Z'
let secuencia = 0
export function aplicar(r: Registro, c: Comando, actor = pcm, recibo = `m3-prueba-${++secuencia}`) {
  validarComando(c)
  const nuevo = aplicarComando(r, c, actor, recibo, fecha)
  for (const plan of nuevo.planes) validarComando({ tipo: 'guardar', plan, enviar: false })
  return nuevo
}
export function escenario(evaluar = true, cantidad = 4) {
  let r = registroInicial()
  r.catalogos.remolcadores = [{ id: 'remolcador-qa', nombre: 'Remolcador FICTICIO QA', activo: true, externo: false }]
  r.catalogos.ubicaciones = [{ id: 'ubicacion-qa', nombre: 'Ubicación FICTICIA QA', activo: true, externo: false }]
  r = aplicar(r, { tipo: 'importar', procedencia: 'Prueba ficticia M3', tareas: Array.from({ length: cantidad }, (_, i) => ({
    id: `QA-${i + 1}`, descripcion: `Trabajo FICTICIO ${i + 1}`, criticidad: 'Alta', estado: 'Abierta', tiempoOriginal: 2,
    ordenes: [1, 2].map((n) => ({ numero: `OM-QA-${i + 1}-${n}`, estado: 'Valor aprobado', valor: 50000 + n }))
  })) })
  const plan = agregarTareas(nuevoPlan(pcm, 'plan-ficticio-modulo3'), r.fuente.map((f) => f.id).join(' '), r).plan
  plan.eta = '2026-12-15T12:00:00.000Z'
  plan.horasParada = '8'
  plan.remolcadorId = 'remolcador-qa'
  plan.ubicacionId = 'ubicacion-qa'
  plan.filas = plan.filas.map((f) => ({ ...f, trabajadores: '2', responsableId: 'responsable-1' }))
  r = aplicar(r, { tipo: 'guardar', plan, enviar: true })
  if (evaluar) {
    for (const [i, f] of plan.filas.entries()) r = aplicar(r, {
      tipo: 'evaluar', planId: plan.id, version: r.planes[0].version, tareaId: f.id,
      resultado: i === 0 ? 'Aceptada' : 'Rechazada', motivo: i === 0 ? 'Viabilidad ficticia' : 'Falta repuesto FICTICIO',
      tiempoAceptado: '3', trabajadoresAceptados: '1'
    }, taller)
    r = aplicar(r, { tipo: 'finalizar', planId: plan.id, version: r.planes[0].version }, taller)
  }
  return r
}
