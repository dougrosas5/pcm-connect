import { useRef, useState } from 'react'
import { etaDesdeInput, inputDesdeEta, puedeCambiarEta } from '../../planificacion/model/modelo'
import type { Actor, Comando, Plan } from '../../../types/pcm'

type Props = {
  plan: Plan
  actor: Actor
  ocupado: boolean
  cambiosPCM: boolean
  ejecutar: (comando: Comando) => Promise<boolean>
  onDirtyChange?: (dirty: boolean) => void
}

export default function EditorEta({ plan, actor, ocupado, cambiosPCM, ejecutar, onDirtyChange }: Props) {
  const [eta, setEta] = useState(inputDesdeEta(plan.eta))
  const [comentario, setComentario] = useState('')
  const [error, setError] = useState('')
  const enviando = useRef(false)
  async function guardar() {
    if (enviando.current || ocupado || cambiosPCM) return
    const nueva = etaDesdeInput(eta)
    if (!nueva || !comentario.trim() || nueva === plan.eta) {
      setError('Ingresá una ETA final diferente y válida. Indicá el motivo del cambio.')
      return
    }
    setError('')
    enviando.current = true
    try {
      if (await ejecutar({ tipo: 'cambiarEta', planId: plan.id, version: plan.version, eta: nueva, comentario })) onDirtyChange?.(false)
    } finally {
      enviando.current = false
    }
  }
  if (plan.estado === 'Confirmada' || plan.estado === 'Cancelada') return <p className="m1-nota">ETA final en consulta. La planificación está confirmada o cancelada.</p>
  if (!puedeCambiarEta(actor)) {
    return <p className="m1-nota">ETA final en consulta. Solo PCM o un supervisor de Taller puede modificarla.</p>
  }
  return <form className="m2-editor" onSubmit={(e) => {
    e.preventDefault()
    void guardar()
  }}>
    <h3>Actualizar ETA final</h3>
    {cambiosPCM && <p className="m1-nota">Guardá los cambios pendientes antes de modificar la ETA final.</p>}
    <div className="m1-cabecera">
      <label className="m1-campo">Nueva ETA final
        <input type="datetime-local" required value={eta} disabled={ocupado || cambiosPCM} onChange={(e) => { setEta(e.target.value); onDirtyChange?.(e.target.value !== inputDesdeEta(plan.eta) || Boolean(comentario)) }} />
      </label>
      <label className="m1-campo">Motivo del cambio (obligatorio)
        <textarea required maxLength={5000} value={comentario} disabled={ocupado || cambiosPCM} onChange={(e) => { setComentario(e.target.value); onDirtyChange?.(eta !== inputDesdeEta(plan.eta) || Boolean(e.target.value)) }} />
      </label>
    </div>
    {error && <p role="alert" className="m1-error">{error}</p>}
    <button className="boton-primario" disabled={ocupado || cambiosPCM}>Guardar ETA final</button>
  </form>
}
