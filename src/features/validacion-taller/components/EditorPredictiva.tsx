import { useState } from 'react'
import type { Comando, Plan } from '../../../types/pcm'
import { etaDesdeInput, inputDesdeEta, mostrarFecha } from '../../planificacion/model/modelo'

export default function EditorPredictiva({ plan, bloqueado, ejecutar, cambiarSucio }: {
  plan: Plan
  bloqueado: boolean
  ejecutar: (comando: Comando) => Promise<boolean>
  cambiarSucio: (sucio: boolean) => void
}) {
  const [valor, setValor] = useState(inputDesdeEta(plan.etaPredictiva?.valor ?? ''))
  const [confirmando, setConfirmando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const guardada = plan.etaPredictiva?.valor
  const nueva = etaDesdeInput(valor)
  const puedeConfirmar = Boolean(guardada && !plan.etaPredictiva?.confirmada && guardada !== plan.eta && nueva === guardada)
  return <section className="m2-predictiva" aria-label="Editar ETA predictiva">
    <h3>ETA predictiva</h3>
    <div className="m1-acciones">
      <label className="m1-campo">ETA predictiva
        <input type="datetime-local" value={valor} disabled={bloqueado || confirmando} onChange={e => {
          setValor(e.target.value)
          cambiarSucio(e.target.value !== inputDesdeEta(guardada ?? ''))
        }} />
      </label>
      <button className="boton-secundario" disabled={bloqueado || confirmando || !nueva || nueva === guardada}
        onClick={async () => {
          if (await ejecutar({ tipo: 'guardarPredictiva', planId: plan.id, version: plan.version, eta: nueva })) cambiarSucio(false)
        }}>Guardar predicción</button>
      <button className="boton-secundario" disabled={bloqueado || !puedeConfirmar || confirmando}
        onClick={() => { setConfirmando(true); cambiarSucio(true) }}>Confirmar ETA predictiva</button>
    </div>
    {guardada === plan.eta && !plan.etaPredictiva?.confirmada && <p className="ayuda">La predicción coincide con la ETA final vigente.</p>}
    {confirmando && guardada && <form className="m2-confirmar-eta" onSubmit={async e => {
      e.preventDefault()
      if (!puedeConfirmar || bloqueado || !motivo.trim()) return
      if (await ejecutar({ tipo: 'confirmarPredictiva', planId: plan.id, version: plan.version, eta: guardada, comentario: motivo, confirmada: true })) {
        setConfirmando(false)
        setMotivo('')
        cambiarSucio(false)
      }
    }}>
      <p>ETA final actual: <strong>{mostrarFecha(plan.eta)}</strong> · ETA predictiva: <strong>{mostrarFecha(guardada)}</strong></p>
      <label className="m1-campo">Motivo de confirmación
        <textarea required maxLength={5000} value={motivo} disabled={bloqueado} onChange={e => setMotivo(e.target.value)} />
      </label>
      <div className="m1-acciones">
        <button type="button" className="boton-secundario" disabled={bloqueado} onClick={() => { setConfirmando(false); setMotivo(''); cambiarSucio(false) }}>Volver</button>
        <button className="boton-primario" disabled={bloqueado || !motivo.trim()}>Aplicar a la ETA final</button>
      </div>
    </form>}
  </section>
}
