import { useEffect, useState, type Ref } from 'react'
import type { Actor, Comando, Plan, Registro } from '../../../types/pcm'
import { finParada, mostrarFecha, puedeCambiarEta } from '../../planificacion/model/modelo'
import { cerradaPCM, conflictosPendientes } from '../../revision-pcm/model/revision'
import { etiquetaPlan } from '../../../components/etiquetasEstado'
import Icono from '../../../components/Icono'
import { nombreReferencia, tonoTaller } from '../model/bandeja'
import EditorEta from './EditorEta'
import EditorPredictiva from './EditorPredictiva'
import DisponibilidadTaller from './DisponibilidadTaller'
import EvaluacionTareas from './EvaluacionTareas'
import { abiertaTaller, puedeEvaluar } from '../model/evaluacion'

type Props = {
  plan: Plan
  registro: Registro
  actor: Actor
  ocupado: boolean
  cambiosPCM: boolean
  ejecutar: (comando: Comando) => Promise<boolean>
  volver: () => void
  titulo: Ref<HTMLHeadingElement>
  usarRolTaller?: () => void
}

export default function DetalleTaller({ plan, registro, actor, ocupado, cambiosPCM, ejecutar, volver, titulo, usarRolTaller }: Props) {
  const [sucio, setSucio] = useState(false)
  const [etaSucia, setEtaSucia] = useState(false)
  const [predictivaSucia, setPredictivaSucia] = useState(false)
  const pendiente = sucio || etaSucia || predictivaSucia
  const conflictos = conflictosPendientes(plan)
  const editableEta = puedeCambiarEta(actor) && !cerradaPCM(plan)
  const predictiva = plan.etaPredictiva
  useEffect(() => {
    if (!pendiente) return
    function salir(evento: BeforeUnloadEvent) { evento.preventDefault() }
    window.addEventListener('beforeunload', salir)
    return () => window.removeEventListener('beforeunload', salir)
  }, [pendiente])
  return <section aria-labelledby="m2-detalle" className="m2-detalle">
    <div className="m2-cabecera-bandeja">
      <h2 id="m2-detalle" tabIndex={-1} ref={titulo}>Evaluación · {plan.tag}</h2>
      <button className="boton-secundario" disabled={ocupado} onClick={() => {
        if (!pendiente || window.confirm('¿Volver a la bandeja y descartar los cambios sin guardar?')) volver()
      }}>Volver a la bandeja</button>
    </div>
    {abiertaTaller(plan) && !puedeEvaluar(actor) && <div className="m2-aviso-rol">
      <span>Vista de consulta. Para registrar las decisiones, ingresá con el rol Taller.</span>
      {usarRolTaller && <button className="boton-secundario" disabled={ocupado || pendiente} onClick={usarRolTaller}>Usar rol Taller</button>}
    </div>}
    <div className="m2-ficha">
      <div className="m2-ficha-principal">
        <div className="m2-ficha-titulo"><Icono nombre="barco" /><strong>{nombreReferencia(plan, registro, plan.remolcadorId)}</strong>
          <span className="estado" data-tono={tonoTaller(plan.estado)}>{etiquetaPlan[plan.estado]}</span></div>
        <dl className="m2-resumen-plan">{[
          ['Ubicación', nombreReferencia(plan, registro, plan.ubicacionId)],
          ['ETA inicial · solo lectura', mostrarFecha(plan.etaInicial ?? plan.eta)],
          ['ETA final · vigente', mostrarFecha(plan.eta)],
          ['ETA predictiva', predictiva ? mostrarFecha(predictiva.valor) : 'Sin definir'],
          ['Tiempo de parada', plan.horasParada ? `${plan.horasParada} h` : 'Sin definir'],
          ['Fin previsto', mostrarFecha(finParada(plan))]
        ].map(([nombre, valor]) => <div key={nombre}><dt>{nombre}</dt><dd>{valor}</dd></div>)}</dl>
        {(plan.origenEtaInicial !== 'creacion' || predictiva) && <p className="ayuda">
          {plan.origenEtaInicial !== 'creacion' && 'ETA inicial según el registro histórico disponible'}
          {predictiva && <span>{plan.origenEtaInicial !== 'creacion' && ' · '}{predictiva.confirmada ? 'Predicción aplicada a la ETA final' : 'Predicción sin confirmar'}</span>}
        </p>}
        {editableEta
          ? <details className="m2-gestionar-eta"><summary>Gestionar ETA</summary>
            <EditorEta key={`final:${plan.version}`} plan={plan} actor={actor} ocupado={ocupado} cambiosPCM={cambiosPCM || sucio || predictivaSucia} ejecutar={ejecutar} onDirtyChange={setEtaSucia} />
            <EditorPredictiva key={`predictiva:${plan.version}`} plan={plan} bloqueado={ocupado || cambiosPCM || sucio || etaSucia} ejecutar={ejecutar} cambiarSucio={setPredictivaSucia} />
          </details>
          : <p className="ayuda">ETA final en consulta.</p>}
      </div>
      <DisponibilidadTaller plan={plan} registro={registro} />
    </div>
    {conflictos.length > 0 && <section className="m3-advertencia" aria-label="Alertas de reprogramación">
      <h3>Reprogramación requerida</h3>
      <ul>{conflictos.map(c => <li key={c.id}>{c.detalle}</li>)}</ul>
    </section>}
    {cambiosPCM && <p className="m1-nota">Guardá los cambios pendientes de PCM antes de evaluar o cambiar la ETA.</p>}
    {(etaSucia || predictivaSucia) && <p className="m1-nota">Guardá o revertí los cambios de ETA antes de continuar la evaluación.</p>}
    <EvaluacionTareas plan={plan} registro={registro} actor={actor} ocupado={ocupado}
      bloqueado={cambiosPCM || etaSucia || predictivaSucia} cambiarSucio={setSucio} ejecutar={ejecutar} />
    <details className="m1-panel m2-historial-eta" aria-label="Historial de ETA">
      <summary>Historial de ETA ({(plan.historialEta?.length ?? 0) + (plan.historialPredictiva?.length ?? 0)})</summary>
      <h3>ETA final</h3>
      {!plan.historialEta?.length && <p>Sin cambios registrados.</p>}
      <ol className="m1-lista-historial">{[...(plan.historialEta ?? [])].reverse().map((c, i) => <li key={i}>
        <strong>{c.origen === 'predictiva' ? 'Predicción confirmada' : 'Cambio de ETA final'}</strong> · {mostrarFecha(c.fecha)} · {c.usuario}{c.rol && ` · ${c.rol}`}
        <p>{mostrarFecha(c.anterior)} → {mostrarFecha(c.nuevo)} · {c.comentario}</p>
      </li>)}</ol>
      <h3>Predicciones guardadas</h3>
      {!plan.historialPredictiva?.length && <p>Sin predicciones registradas.</p>}
      <ol className="m1-lista-historial">{[...(plan.historialPredictiva ?? [])].reverse().map((c, i) => <li key={i}>
        {mostrarFecha(c.fecha)} · {c.usuario} · {c.rol}<p>{mostrarFecha(c.anterior)} → {mostrarFecha(c.nuevo)}</p>
      </li>)}</ol>
    </details>
  </section>
}
