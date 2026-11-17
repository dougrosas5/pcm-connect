import { useState } from 'react'
import type { Actor, Comando, FilaPropuesta, Plan } from '../../../types/pcm'
import { evaluacionVigente, tareaInterna } from '../../revision-pcm/model/revision'
import { mostrarFecha } from '../../planificacion/model/modelo'

type Props = { plan: Plan; actor: Actor; ocupado: boolean; ejecutar: (c: Comando) => Promise<boolean> }
function Formulario({ plan, fila, ocupado, ejecutar }: Omit<Props, 'actor'> & { fila: FilaPropuesta }) {
  const [resultado, setResultado] = useState<'Aceptada' | 'Rechazada'>('Aceptada')
  const [motivo, setMotivo] = useState('')
  const [horas, setHoras] = useState(fila.tiempoPropuesto)
  const [personas, setPersonas] = useState(fila.trabajadores)
  return <form onSubmit={(e) => {
    e.preventDefault()
    void ejecutar({ tipo: 'evaluar', planId: plan.id, version: plan.version, tareaId: fila.id, resultado, motivo, tiempoAceptado: horas, trabajadoresAceptados: personas })
  }} aria-label={`Evaluar ${fila.id}`}>
    <fieldset disabled={ocupado} className="m3-campos">
      <legend>Evaluación de {fila.id}</legend>
      <label className="m1-campo">Resultado de {fila.id}<select value={resultado} onChange={(e) => setResultado(e.target.value as typeof resultado)}><option>Aceptada</option><option>Rechazada</option></select></label>
      <label className="m1-campo">Horas de Taller para {fila.id}<input type="number" min="0.01" step="any" required value={horas} onChange={(e) => setHoras(e.target.value)} /></label>
      <label className="m1-campo">Trabajadores de Taller para {fila.id}<input type="number" min="1" step="1" required value={personas} onChange={(e) => setPersonas(e.target.value)} /></label>
      <label className="m1-campo">Comentario de Taller para {fila.id}{resultado === 'Rechazada' ? ' (obligatorio)' : ''}<textarea maxLength={5000} required={resultado === 'Rechazada'} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label>
      <button className="boton-secundario">Registrar evaluación de {fila.id}</button>
    </fieldset>
  </form>
}
export default function EvaluacionTareas({ plan, actor, ocupado, ejecutar }: Props) {
  const abierta = ['Enviado a Taller', 'En evaluación', 'En reevaluación'].includes(plan.estado)
  const autorizado = ['Taller', 'Supervisor Taller', 'Administrador'].includes(actor.rol)
  const pendientes = plan.filas.filter((f) => tareaInterna(plan, f) && !evaluacionVigente(plan, f.id))
  return <section className="m1-panel" aria-label="Evaluación de tareas completas">
    <h3>Evaluación por TAREA/PM completa</h3>
    <p className="m1-nota">Cada decisión comprende todas las OM de la tarea. Las aceptadas quedan congeladas. Horas y trabajadores de Taller se conservan separados de la propuesta PCM.</p>
    {plan.filas.map((fila) => {
      const e = evaluacionVigente(plan, fila.id)
      const historial = plan.revisionPCM?.tareas[fila.id]?.evaluaciones ?? (e ? [e] : [])
      return <section className="m2-evaluacion" key={fila.id}>
        <h4>{fila.id} · {fila.descripcion}</h4>
        <p>OM: {fila.ordenes.map((o) => o.numero).join(', ')}</p>
        <p>{!tareaInterna(plan, fila) ? 'Sin evaluación interna pendiente · ver resolución PCM' : e ? `${e.resultado} · ${e.motivo || 'Sin observaciones'} · ${e.tiempoAceptado ?? fila.tiempoPropuesto} h · ${e.trabajadoresAceptados ?? fila.trabajadores} trabajadores` : 'Pendiente de evaluación vigente'}</p>
        {abierta && autorizado && pendientes.includes(fila) && <Formulario key={`${fila.id}:${plan.revisionPCM?.tareas[fila.id]?.version ?? 1}`} plan={plan} fila={fila} ocupado={ocupado} ejecutar={ejecutar} />}
        {!!historial.length && <details><summary>Evaluaciones conservadas ({historial.length})</summary><ol>{historial.map((h, i) => <li key={i}>Versión {h.versionTarea ?? 1}: {h.resultado} · {h.motivo || 'Sin observaciones'} · {h.usuario} · {mostrarFecha(h.fecha)}</li>)}</ol></details>}
      </section>
    })}
    {abierta && autorizado && <button className="boton-primario" disabled={ocupado || pendientes.length > 0} onClick={() => ejecutar({ tipo: 'finalizar', planId: plan.id, version: plan.version })}>Finalizar evaluación</button>}
    {abierta && pendientes.length > 0 && <p className="m1-nota">{pendientes.length} tareas internas pendientes. Registrá cada decisión antes de finalizar.</p>}
  </section>
}
