import type { DecisionPCM, Plan, Registro } from '../../../types/pcm'
import { moneda, valorTotal } from '../../planificacion/model/modelo'
import { nombreReferencia } from '../../validacion-taller/model/bandeja'
import { estadoProgramacion, evaluacionVigente, resolucionTarea, responsableOperativo } from '../model/revision'

type Props = { plan: Plan; registro: Registro; editable: boolean; decisiones: DecisionPCM[]; cambiar: (decision: DecisionPCM | null, id: string) => void }
export default function TablaRevision({ plan, registro, editable, decisiones, cambiar }: Props) {
  return <div className="tabla-contenedor" tabIndex={0} role="region" aria-label="Tareas en revisión; desplazamiento horizontal disponible">
    <table className="tabla-tareas m3-tabla"><caption>Evaluación de Taller y resoluciones de PCM</caption>
      <thead><tr>{['TAREA/PM', 'OM', 'Valor OM (Gs.)', 'Descripción', 'Responsable original', 'Horas Taller', 'Trabajadores Taller', 'Criticidad', 'Resultado Taller', 'Comentario Taller', 'Resolución PCM', 'Acción'].map((t) => <th scope="col" key={t}>{t}</th>)}</tr></thead>
      <tbody>{plan.filas.map((f) => {
        const e = evaluacionVigente(plan, f.id)
        const resolucion = resolucionTarea(plan, f.id)
        const pendiente = decisiones.find((d) => d.tareaId === f.id)
        const externa = plan.referencias[f.responsableId]?.externo
        const corregir = pendiente?.tipo === 'Devuelta a revisión' ? pendiente.correccion : undefined
        const original = plan.revisionPCM?.tareas[f.id]?.responsableOriginalId ?? f.responsableId
        const resolver = editable && e?.resultado === 'Rechazada' && !resolucion
        return <tr key={f.id}>
          <th scope="row">{f.id}<small className="m1-original">Versión {plan.revisionPCM?.tareas[f.id]?.version ?? 1}</small></th>
          <td>{f.ordenes.map((o) => o.numero).join(', ')}</td><td className="numero">{moneda(valorTotal(f.ordenes))}</td><td>{f.descripcion}</td>
          <td>{nombreReferencia(plan, registro, original)}{(resolucion?.tipo === 'Tercerizada' || original !== f.responsableId) && <strong className="m1-original">Operativo: {responsableOperativo(plan, f)}</strong>}</td>
          <td>{e?.resultado === 'Aceptada' ? e.tiempoAceptado ?? f.tiempoPropuesto : '—'}</td><td>{e?.resultado === 'Aceptada' ? e.trabajadoresAceptados ?? f.trabajadores : '—'}</td><td>{f.criticidad}</td>
          <td>{externa ? 'Ejecución externa' : e?.resultado ?? 'Reevaluación requerida'}</td><td>{e?.motivo || 'Sin observaciones'}</td>
          <td>{resolucion?.tipo ?? (e?.resultado === 'Aceptada' ? 'Aceptada · Solo consulta' : externa ? 'Ejecución externa' : 'Pendiente')}<small className="m1-original">{estadoProgramacion(plan, f)}</small>{pendiente && <strong className="m1-original">{pendiente.tipo} · sin guardar</strong>}</td>
          <td>{resolver ? <>
            <label className="m1-campo">Resolución de {f.id}<select value={pendiente?.tipo ?? ''} onChange={(event) => {
              const tipo = event.target.value as DecisionPCM['tipo'] | ''
              if (!tipo) { cambiar(null, f.id); return }
              if (tipo === 'Eliminada' && !window.confirm(`¿Eliminar ${f.id} de la planificación activa? Sus OM, rechazo e historial se conservarán.`)) return
              cambiar({ tareaId: f.id, tipo, ...(tipo === 'Eliminada' ? { confirmada: true } : {}), ...(tipo === 'Devuelta a revisión' ? { correccion: { descripcion: f.descripcion, criticidad: f.criticidad, tiempoPropuesto: f.tiempoPropuesto, trabajadores: f.trabajadores, responsableId: f.responsableId } } : {}) }, f.id)
            }}><option value="">Pendiente</option><option value="Tercerizada">Tercerizar</option><option value="Eliminada">Eliminar</option><option value="Devuelta a revisión">Corregir y reenviar a Taller</option></select></label>
            {corregir && pendiente && <fieldset className="m3-campos"><legend>Corrección de {f.id}</legend>
              {(['descripcion', 'criticidad', 'tiempoPropuesto', 'trabajadores'] as const).map((campo) => <label className="m1-campo" key={campo}>{({ descripcion: 'Descripción', criticidad: 'Criticidad', tiempoPropuesto: 'Horas propuestas', trabajadores: 'Trabajadores propuestos' })[campo]} de {f.id}<input value={corregir[campo]} type={['tiempoPropuesto', 'trabajadores'].includes(campo) ? 'number' : 'text'} min={campo === 'trabajadores' ? '1' : '0.01'} step={campo === 'trabajadores' ? '1' : 'any'} maxLength={5000} onChange={(event) => cambiar({ ...pendiente, correccion: { ...corregir, [campo]: event.target.value } }, f.id)} /></label>)}
              <label className="m1-campo">Responsable interno de {f.id}<select value={corregir.responsableId} onChange={(event) => cambiar({ ...pendiente, correccion: { ...corregir, responsableId: event.target.value } }, f.id)}>{registro.catalogos.responsables.filter((r) => r.activo && !r.externo).map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}</select></label>
              <p className="m1-nota">Al guardar, la tarea vuelve a Taller. Se conservan sus OM y costos.</p>
            </fieldset>}
          </> : 'Solo consulta'}</td>
        </tr>
      })}</tbody>
    </table>
  </div>
}
