import type { Plan, Registro } from '../../../types/pcm'
import { compromisosPorEspecialidad } from '../model/disponibilidad'
import Icono from '../../../components/Icono'

const horas = new Intl.NumberFormat('es-PY', { maximumFractionDigits: 2 })

export default function DisponibilidadTaller({ plan, registro }: { plan: Plan; registro: Registro }) {
  const grupos = compromisosPorEspecialidad(registro, plan)
  return <aside className="m2-capacidad" aria-labelledby="m2-capacidad-titulo">
    <h3 id="m2-capacidad-titulo"><Icono nombre="personas" /> Disponibilidad de Taller</h3>
    <p className="ayuda">Sin cupos confirmados. Compromisos preliminares por ETA final en horas-persona.</p>
    <table>
      <thead><tr><th scope="col">Especialidad</th><th scope="col">Este plan</th><th scope="col">Otros planes con solapamiento</th></tr></thead>
      <tbody>{grupos.map(g => <tr key={g.id}>
        <th scope="row">{g.nombre.replace(/^TALLER /u, '').toLocaleLowerCase('es-PY')}</th>
        <td title={`${g.tareas} tareas aceptadas`}>{horas.format(g.propias)}</td><td>{horas.format(g.solapadas)}</td>
      </tr>)}</tbody>
    </table>
  </aside>
}
