import { useEffect, useRef, useState } from 'react'
import type { Actor, Comando, DecisionPCM, Plan, Registro } from '../../../types/pcm'
import { finParada, mostrarFecha } from '../../planificacion/model/modelo'
import { nombreReferencia } from '../../validacion-taller/model/bandeja'
import EditorEta from '../../validacion-taller/components/EditorEta'
import { cerradaPCM, conflictosPendientes, erroresConfirmacion, estadoRevision } from '../model/revision'
import TablaRevision from './TablaRevision'

type Props = { plan: Plan; registro: Registro; actor: Actor; ocupado: boolean; cambiosPCM: boolean; error?: string; ejecutar: (c: Comando) => Promise<boolean>; cerrar: () => void }
export default function ModalRevision({ plan, registro, actor, ocupado, cambiosPCM, error, ejecutar, cerrar }: Props) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const enviando = useRef(false)
  const [decisiones, setDecisiones] = useState<DecisionPCM[]>([])
  const [versionBase, setVersionBase] = useState(plan.version)
  const [etaSucia, setEtaSucia] = useState(false)
  const [reconocer, setReconocer] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [confirmarCancelacion, setConfirmarCancelacion] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const sucio = decisiones.length > 0 || etaSucia || Boolean(motivo)
  const pcm = ['Planificador', 'Administrador'].includes(actor.rol)
  const editable = pcm && !cerradaPCM(plan) && !ocupado && !cambiosPCM
  const conflictos = conflictosPendientes(plan)
  const errores = erroresConfirmacion(plan)
  const desactualizada = decisiones.length > 0 && versionBase !== plan.version
  useEffect(() => {
    const dialog = dialogo.current!
    dialog.showModal()
    return () => dialog.close()
  }, [])
  useEffect(() => {
    const salir = (e: BeforeUnloadEvent) => { if (sucio || ocupado) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', salir)
    return () => window.removeEventListener('beforeunload', salir)
  }, [sucio, ocupado])
  function cerrarSeguro() {
    if (ocupado || enviando.current) return
    if (sucio && !window.confirm('Hay cambios sin guardar en la revisión. ¿Descartarlos y cerrar? Los datos guardados se conservan.')) return
    cerrar()
  }
  async function mandar(comando: Comando) {
    if (enviando.current || ocupado) return false
    enviando.current = true
    setMensaje('')
    try {
      const ok = await ejecutar(comando)
      if (ok) {
        setMensaje('Cambios guardados con su historial.')
        setDecisiones([])
        setMotivo('')
        setCancelando(false)
        setConfirmarCancelacion(false)
        setReconocer(false)
      } else setMensaje('No se guardó la operación. Revisá el error; tus cambios siguen en pantalla.')
      return ok
    } finally { enviando.current = false }
  }
  return <dialog ref={dialogo} className="m3-modal" aria-labelledby="m3-modal-titulo" onCancel={(e) => { e.preventDefault(); cerrarSeguro() }}>
    <header className="m3-modal-cabecera"><div><h2 id="m3-modal-titulo">Revisión · {plan.tag}</h2><span className="estado">{estadoRevision(plan)} · v{plan.version}</span></div><button className="boton-secundario" autoFocus disabled={ocupado} onClick={cerrarSeguro}>Cerrar revisión</button></header>
    <div className="m3-modal-contenido">
      <dl className="m1-cabecera m2-datos">{[
        ['Remolcador', nombreReferencia(plan, registro, plan.remolcadorId)], ['Ubicación', nombreReferencia(plan, registro, plan.ubicacionId)],
        ['ETA inicial · solo lectura', mostrarFecha(plan.etaInicial ?? plan.eta)], ['ETA final', mostrarFecha(plan.eta)],
        ['Tiempo de parada', `${plan.horasParada} h`], ['Fin previsto de parada', mostrarFecha(finParada(plan))]
      ].map(([nombre, valor]) => <div key={nombre}><dt>{nombre}</dt><dd>{valor}</dd></div>)}</dl>
      <p className="m1-nota">Fechas en Montevideo. {plan.origenEtaInicial !== 'creacion' ? 'ETA inicial heredada: se muestra el dato histórico disponible, sin inventar la fecha original.' : 'La ETA inicial es inmutable.'}</p>
      {cambiosPCM && <p className="m1-nota">Guardá los cambios pendientes de Planificación antes de resolver esta revisión.</p>}
      {pcm && <EditorEta key={`${plan.id}:${plan.version}`} plan={plan} actor={actor} ocupado={ocupado} cambiosPCM={cambiosPCM || decisiones.length > 0 || cancelando} ejecutar={mandar} onDirtyChange={setEtaSucia} />}
      {!!conflictos.length && <section className="m3-advertencia" aria-label="Advertencias de disponibilidad"><h3>Reprogramación requerida</h3><p>Estas advertencias no rechazan tareas aceptadas. Los solapamientos requieren revisar disponibilidad; aún no hay dotación ni turnos configurados.</p><ul>{conflictos.map((c) => <li key={c.id}>{c.detalle} · {c.estado}{c.reconocimiento && <> · Reconocida por {c.reconocimiento.usuario} el {mostrarFecha(c.reconocimiento.fecha)}</>}</li>)}</ul></section>}
      <h3>Revisión de tareas</h3>
      <TablaRevision plan={plan} registro={registro} editable={editable && !etaSucia && !cancelando} decisiones={decisiones} cambiar={(decision, id) => {
        if (!decisiones.length) setVersionBase(plan.version)
        setDecisiones([...decisiones.filter((d) => d.tareaId !== id), ...(decision ? [decision] : [])])
        setMensaje('')
      }} />
      {desactualizada && <p className="m1-error" role="alert">La versión guardada cambió. Tus decisiones se conservan en pantalla; cerrá y reabrí para revisar la versión vigente antes de aplicarlas.</p>}
      <div role="status" aria-live="polite">{ocupado ? 'Guardando…' : mensaje}</div>
      {error && <p className="m1-error" role="alert">{error}</p>}
      {editable && !cerradaPCM(plan) && <>
        {!!errores.length && <div className="m1-nota"><strong>Para confirmar:</strong><ul>{errores.map((e) => <li key={e}>{e}</li>)}</ul></div>}
        {decisiones.length > 0 && <p className="m1-nota">{decisiones.length} resoluciones sin guardar. Guardá el borrador antes de confirmar; las correcciones se reenviarán a Taller.</p>}
        {etaSucia && <p className="m1-nota">Guardá la ETA final antes de resolver tareas o confirmar.</p>}
        {!!conflictos.length && <label className="m3-check"><input type="checkbox" checked={reconocer} onChange={(e) => setReconocer(e.target.checked)} />Reconozco los conflictos indicados y confirmo con reprogramación pendiente.</label>}
      </>}
      {cancelando && <section className="m3-advertencia" aria-label="Cancelación completa"><h3>Cancelar planificación completa</h3><label className="m1-campo">Motivo de cancelación (obligatorio)<textarea required maxLength={5000} value={motivo} disabled={ocupado} onChange={(e) => setMotivo(e.target.value)} /></label><label className="m3-check"><input type="checkbox" checked={confirmarCancelacion} disabled={ocupado} onChange={(e) => setConfirmarCancelacion(e.target.checked)} />Confirmo cancelar toda la planificación y conservar su historial.</label><div className="m1-acciones"><button className="boton-secundario" disabled={ocupado} onClick={() => { setCancelando(false); setMotivo(''); setConfirmarCancelacion(false) }}>Volver sin cancelar</button><button className="boton-primario" disabled={!editable || !motivo.trim() || !confirmarCancelacion} onClick={() => mandar({ tipo: 'cancelarPCM', planId: plan.id, version: plan.version, motivo, confirmada: confirmarCancelacion })}>Confirmar cancelación</button></div></section>}
      {plan.revisionPCM?.confirmacion && <p className="m1-nota">Confirmada por {plan.revisionPCM.confirmacion.usuario} · {mostrarFecha(plan.revisionPCM.confirmacion.fecha)} · versión {plan.revisionPCM.confirmacion.version}{plan.revisionPCM.confirmacion.conAdvertencias ? ' · con advertencias' : ''}. Tareas internas disponibles para la futura asignación; ejecución externa conservada.</p>}
      {plan.revisionPCM?.cancelacion && <p className="m1-nota">Cancelada por {plan.revisionPCM.cancelacion.usuario} · {mostrarFecha(plan.revisionPCM.cancelacion.fecha)} · Motivo: {plan.revisionPCM.cancelacion.motivo}</p>}
      <details className="historial-taller"><summary>Historial de esta planificación</summary>
        <h3>Cambios de ETA</h3>{!plan.historialEta?.length && <p>Sin cambios registrados.</p>}<ol>{plan.historialEta?.map((c, i) => <li key={i}>{mostrarFecha(c.anterior)} → {mostrarFecha(c.nuevo)} · {c.usuario} · {c.rol ?? 'Rol no registrado en versión anterior'} · {mostrarFecha(c.fecha)} · {c.comentario}</li>)}</ol>
        <h3>Evaluaciones y versiones por tarea</h3>{plan.filas.map((f) => {
          const t = plan.revisionPCM?.tareas[f.id]
          const evaluaciones = t?.evaluaciones ?? (Object.hasOwn(plan.evaluaciones, f.id) ? [plan.evaluaciones[f.id]] : [])
          return <details key={f.id}><summary>{f.id} · {evaluaciones.length} evaluaciones conservadas</summary><ol>{evaluaciones.map((e, i) => <li key={i}>Versión {e.versionTarea ?? 1}: {e.resultado} · {e.motivo || 'Sin observaciones'} · {e.usuario} · {mostrarFecha(e.fecha)}</li>)}</ol><ol>{t?.resoluciones.map((r, i) => <li key={i}>{r.tipo} · versión {r.versionTarea} · {r.usuario} · {mostrarFecha(r.fecha)}</li>)}</ol>{t?.versiones.map((v) => <details key={v.version}><summary>Versión {v.version} · {v.usuario} · {mostrarFecha(v.fecha)} · {v.campos.length ? `Cambios: ${v.campos.join(', ')}` : 'Instantánea incorporada al historial'}</summary><pre>{JSON.stringify(v.fila, null, 2)}</pre></details>)}</details>
        })}
        <h3>Eventos registrados</h3><ol className="m1-lista-historial">{registro.historial.filter((e) => e.planId === plan.id || e.entidad === plan.tag).map((e, i) => <li key={i}><strong>{e.accion}{e.tareaId ? ` · ${e.tareaId}` : ''}</strong> · {e.usuario} · {mostrarFecha(e.fecha)}<details><summary>Valores anteriores y nuevos</summary><pre>{JSON.stringify({ anterior: e.anterior, nuevo: e.nuevo }, null, 2)}</pre></details></li>)}</ol>
      </details>
    </div>
    <footer className="m3-modal-pie">{pcm && !cerradaPCM(plan) ? <>
      <button className="boton-secundario" disabled={!editable || decisiones.length > 0 || etaSucia || cancelando} onClick={() => setCancelando(true)}>Cancelar planificación</button>
      <div className="m1-acciones"><button className="boton-secundario" disabled={!editable || !decisiones.length || etaSucia || cancelando || desactualizada} onClick={() => mandar({ tipo: 'guardarRevision', planId: plan.id, version: versionBase, decisiones })}>Guardar borrador</button><button className="boton-primario" disabled={!editable || errores.length > 0 || sucio || cancelando || (conflictos.length > 0 && !reconocer)} onClick={() => mandar({ tipo: 'confirmarPCM', planId: plan.id, version: plan.version, reconocerConflictos: reconocer })}>Confirmar planificación</button></div>
    </> : <p className="m1-nota">Solo consulta. Las decisiones originales se conservan.</p>}</footer>
  </dialog>
}
