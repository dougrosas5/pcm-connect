import { inputDesdeEta } from '../../planificacion/model/modelo.ts'
import type { Estado, Plan, Registro } from '../../../types/pcm.ts'
import { evaluacionVigente, tareaInterna } from '../../revision-pcm/model/revision.ts'
import { ajusteVigente } from './evaluacion.ts'

// Solo los tres primeros estados tienen correspondencia acordada y datos existentes.
// Completar estos grupos cuando se definan las transiciones de programación y cierre.
export const gruposTaller: { nombre: string; estados: Estado[] }[] = [
  { nombre: 'Solicitadas', estados: ['Enviado a Taller'] },
  { nombre: 'En evaluación', estados: ['En evaluación', 'En reevaluación'] },
  { nombre: 'Evaluadas', estados: ['Evaluado'] },
  { nombre: 'Programadas', estados: [] },
  { nombre: 'En curso', estados: [] }
]
export const estadosFinalizados: Estado[] = ['Confirmada', 'Cancelada']
export function tonoTaller(estado: Estado) {
  if (estado === 'Enviado a Taller') return 'ejecucion'
  if (estado === 'En evaluación' || estado === 'En reevaluación') return 'pendiente'
  if (estado === 'Evaluado') return 'finalizado'
  if (estado === 'Confirmada') return 'aceptado'
  return 'bloqueado'
}
export type FiltrosTaller = {
  tag: string; remolcador: string; ubicacion: string; estado: string; desde: string; hasta: string
}
export const filtrosVacios: FiltrosTaller = {
  tag: '', remolcador: '', ubicacion: '', estado: '', desde: '', hasta: ''
}
export function nombreReferencia(plan: Plan, registro: Registro, id: string): string {
  return plan.referencias[id]?.nombre ??
    Object.values(registro.catalogos).flat().find((e) => e.id === id)?.nombre ?? 'Sin definir'
}
export function filtrarPlanes(planes: Plan[], filtros: FiltrosTaller, historial: boolean): Plan[] {
  if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) return []
  return planes.filter((p) => {
    const dia = inputDesdeEta(p.eta).slice(0, 10)
    return p.estado !== 'Borrador' && estadosFinalizados.includes(p.estado) === historial &&
      p.tag.toLocaleLowerCase('es').includes(filtros.tag.trim().toLocaleLowerCase('es')) &&
      (!filtros.remolcador || p.remolcadorId === filtros.remolcador) &&
      (!filtros.ubicacion || p.ubicacionId === filtros.ubicacion) &&
      (!filtros.estado || p.estado === filtros.estado) &&
      (!filtros.desde || Boolean(dia && dia >= filtros.desde)) &&
      (!filtros.hasta || Boolean(dia && dia <= filtros.hasta))
  }).sort((a, b) => b.actualizado.localeCompare(a.actualizado) || a.tag.localeCompare(b.tag))
}
export function progresoAnterior(plan: Plan): string {
  if (plan.estado === 'Borrador') return 'Sin enviar'
  if (plan.estado === 'Cancelada') return '—'
  const { decididas, total } = progresoTaller(plan)
  return total ? `${decididas}/${total} tareas` : 'Solo ejecución externa'
}

export function progresoTaller(plan: Plan) {
  const internas = plan.filas.filter((f) => tareaInterna(plan, f))
  const decididas = internas.filter(f => {
    const ajuste = ajusteVigente(plan, f.id)
    return evaluacionVigente(plan, f.id) || (ajuste && ajuste.resultado !== 'Pendiente')
  }).length
  return { decididas, total: internas.length }
}
