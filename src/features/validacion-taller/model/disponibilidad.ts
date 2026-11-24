import type { Plan, Registro } from '../../../types/pcm.ts'
import { finParada } from '../../planificacion/model/modelo.ts'
import { evaluacionVigente, tareaInterna } from '../../revision-pcm/model/revision.ts'
import { ajusteVigente } from './evaluacion.ts'

export function compromisosPorEspecialidad(registro: Registro, seleccionado: Plan) {
  const inicio = Date.parse(seleccionado.eta)
  const fin = Date.parse(finParada(seleccionado))
  const filas = new Map<string, { id: string; nombre: string; tareas: number; propias: number; solapadas: number }>()
  for (const r of registro.catalogos.responsables.filter(r => r.activo && !r.externo))
    filas.set(r.id, { id: r.id, nombre: r.nombre, tareas: 0, propias: 0, solapadas: 0 })
  for (const plan of registro.planes) {
    if (plan.estado === 'Cancelada' || plan.estado === 'Borrador') continue
    const propio = plan.id === seleccionado.id
    if (!propio && !(inicio < Date.parse(finParada(plan)) && Date.parse(plan.eta) < fin)) continue
    for (const tarea of plan.filas.filter(t => tareaInterna(plan, t))) {
      const externo = evaluacionVigente(plan, tarea.id)
      const ajuste = ajusteVigente(plan, tarea.id)
      const datos = externo
        ? { resultado: externo.resultado, horas: externo.tiempoAceptado ?? tarea.tiempoPropuesto, personas: externo.trabajadoresAceptados ?? tarea.trabajadores }
        : { resultado: ajuste?.resultado, horas: ajuste?.horas, personas: ajuste?.trabajadores }
      if (datos.resultado !== 'Aceptada') continue
      const horasPersona = Number(datos.horas) * Number(datos.personas)
      if (!Number.isFinite(horasPersona)) continue
      const grupo = filas.get(tarea.responsableId) ?? {
        id: tarea.responsableId, nombre: plan.referencias[tarea.responsableId]?.nombre ?? 'Sin especialidad',
        tareas: 0, propias: 0, solapadas: 0
      }
      if (propio) {
        grupo.tareas++
        grupo.propias += horasPersona
      } else grupo.solapadas += horasPersona
      filas.set(grupo.id, grupo)
    }
  }
  return [...filas.values()]
}
