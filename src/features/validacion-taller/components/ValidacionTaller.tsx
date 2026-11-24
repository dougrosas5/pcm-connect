import DetalleTaller from './DetalleTaller'
import { abiertaTaller, puedeEvaluar } from '../model/evaluacion'
import { useRef, useState } from 'react'
import { mostrarFecha } from '../../planificacion/model/modelo'
import type { Actor, Comando, Registro } from '../../../types/pcm'
import { filtrarPlanes, filtrosVacios, gruposTaller, nombreReferencia, progresoAnterior, progresoTaller, tonoTaller } from '../model/bandeja'
import type { FiltrosTaller } from '../model/bandeja'
import Icono from '../../../components/Icono'
import { etiquetaPlan } from '../../../components/etiquetasEstado'
import '../styles/validacion-taller.css'

type Props = {
  registro: Registro
  actor: Actor
  ocupado: boolean
  cambiosPCM: boolean
  ejecutar: (comando: Comando) => Promise<boolean>
  actualizar: () => void
  usarRolTaller?: () => void
}

export default function ValidacionTaller(props: Props) {
  const { registro, actor, ocupado } = props
  const [seleccion, setSeleccion] = useState('')
  const [historial, setHistorial] = useState(false)
  const [filtros, setFiltros] = useState<FiltrosTaller>(filtrosVacios)
  const titulo = useRef<HTMLHeadingElement>(null)
  const retorno = useRef<HTMLButtonElement | null>(null)
  const plan = registro.planes.find((p) => p.id === seleccion)
  const filtradas = filtrarPlanes(registro.planes, filtros, historial)
  function filtrar(campo: keyof FiltrosTaller, valor: string) {
    setFiltros({ ...filtros, [campo]: valor })
  }
  function opciones(campo: 'remolcadorId' | 'ubicacionId') {
    return [...new Map(registro.planes.filter((p) => p.estado !== 'Borrador' && p[campo]).map((p) =>
      [p[campo], nombreReferencia(p, registro, p[campo])])).entries()]
  }
  return <div className="m2">
    <div hidden={Boolean(plan)}>
      <div className="m2-cabecera-bandeja">
        <h2>Bandeja de planificaciones</h2>
        <div className="m1-acciones" aria-label="Vistas de planificaciones">
          <button className="boton-secundario" aria-pressed={!historial} onClick={() => setHistorial(false)}>Activas</button>
          <button className="boton-secundario" aria-pressed={historial} onClick={() => setHistorial(true)}>Historial</button>
          <button className="boton-secundario" disabled={ocupado} onClick={props.actualizar}><Icono nombre="actualizar" />Actualizar datos</button>
        </div>
      </div>
      {!plan && !puedeEvaluar(actor) && <div className="m2-aviso-rol">
        <span>Estás consultando como {actor.rol}. La evaluación la realiza Taller.</span>
        {props.usarRolTaller && <button className="boton-secundario" disabled={ocupado} onClick={props.usarRolTaller}>Usar rol Taller</button>}
        {props.cambiosPCM && <span>Guardá los cambios de Planificación para cambiar de rol.</span>}
      </div>}
      <dl className="m2-indicadores" aria-label="Indicadores de todas las planificaciones">
        {gruposTaller.map((g, i) => (
          <div key={g.nombre} data-tono={(['ejecucion', 'pendiente', 'finalizado', 'aceptado', 'solapamiento'] as const)[i]}>
            <dt>{g.nombre}</dt>
            <dd>{g.estados.length ? registro.planes.filter((p) => g.estados.includes(p.estado)).length : <span title="Sin datos de programación o ejecución">—</span>}</dd>
          </div>
        ))}
      </dl>
      <p className="m2-nota-indicadores ayuda">Programación y ejecución sin datos registrados.</p>
      <section className="m1-panel m2-filtros" aria-label="Filtros de planificaciones">
        <div className="m1-cabecera">
          <label className="m1-campo">Filtrar por TAG
            <input type="search" value={filtros.tag} onChange={(e) => filtrar('tag', e.target.value)} />
          </label>
          <label className="m1-campo">Filtrar por remolcador
            <select value={filtros.remolcador} onChange={(e) => filtrar('remolcador', e.target.value)}>
              <option value="">Todos</option>
              {opciones('remolcadorId').map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
            </select>
          </label>
          <label className="m1-campo">Filtrar por ubicación
            <select value={filtros.ubicacion} onChange={(e) => filtrar('ubicacion', e.target.value)}>
              <option value="">Todas</option>
              {opciones('ubicacionId').map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
            </select>
          </label>
          <label className="m1-campo">Filtrar por estado
            <select value={filtros.estado} onChange={(e) => filtrar('estado', e.target.value)}>
              <option value="">Todos</option>
              {(Object.keys(etiquetaPlan) as (keyof typeof etiquetaPlan)[]).filter(s => s !== 'Borrador').map((s) => <option key={s} value={s}>{etiquetaPlan[s]}</option>)}
            </select>
          </label>
          <label className="m1-campo">ETA final desde
            <input type="date" value={filtros.desde} onChange={(e) => filtrar('desde', e.target.value)} />
          </label>
          <label className="m1-campo">ETA final hasta
            <input type="date" value={filtros.hasta} onChange={(e) => filtrar('hasta', e.target.value)} />
          </label>
        </div>
        <div className="m2-pie-filtros">
          <p className="m1-nota">ETA final · fechas inclusivas.</p>
          <button className="boton-secundario" onClick={() => setFiltros(filtrosVacios)}>Limpiar filtros</button>
        </div>
        {filtros.desde && filtros.hasta && filtros.desde > filtros.hasta && <p role="alert" className="m1-error">La fecha desde no puede ser posterior a la fecha hasta.</p>}
      </section>
      <p className="m2-resultados" role="status">{filtradas.length} {filtradas.length === 1 ? 'planificación' : 'planificaciones'} · {historial ? 'Historial de revisión PCM' : 'Activas'}</p>
      {historial && <p className="m1-nota">Confirmadas o canceladas por PCM. La confirmación no acredita la ejecución del trabajo.</p>}
      {!filtradas.length ? (
        <p className="estado-vacio">{historial
          ? 'No hay planificaciones confirmadas o canceladas por PCM.'
          : Object.values(filtros).some(Boolean)
            ? 'No hay coincidencias. Revisá o limpiá los filtros.'
            : 'No hay planificaciones enviadas a Taller. En Planificación, completá los datos y pulsá Enviar a Taller.'}
        </p>
      ) : (
        <div className="tabla-contenedor" tabIndex={0} role="region" aria-label="Bandeja de Taller; desplazamiento horizontal disponible">
          <table className="tabla-tareas m2-bandeja">
            <caption>Planificaciones recibidas de PCM</caption>
            <thead>
              <tr>{[
                'TAG', 'Remolcador', 'Ubicación', 'ETA inicial', 'ETA final', 'Parada (h)',
                'Tareas', 'Estado', 'Progreso de evaluación', 'Último cambio de ETA', 'Acción'
              ].map((t) => <th scope="col" key={t}>{t}</th>)}</tr>
            </thead>
            <tbody>{filtradas.map((p) => {
              const accion = puedeEvaluar(actor) && abiertaTaller(p) ? (p.estado === 'Enviado a Taller' ? 'Evaluar' : 'Continuar') : 'Ver'
              const progreso = progresoTaller(p)
              const cambioEta = p.historialEta?.at(-1)
              return (
              <tr key={p.id}>
                <th scope="row">{p.tag}</th>
                <td>{nombreReferencia(p, registro, p.remolcadorId)}</td>
                <td>{nombreReferencia(p, registro, p.ubicacionId)}</td>
                <td>
                  {mostrarFecha(p.etaInicial ?? p.eta)}
                  {p.origenEtaInicial !== 'creacion' && <small className="m1-original">Dato histórico</small>}
                </td>
                <td>{mostrarFecha(p.eta)}</td>
                <td className="numero">{p.horasParada || 'Sin definir'}</td>
                <td className="numero">{p.filas.length}</td>
                <td><span className="estado" data-tono={tonoTaller(p.estado)}>{etiquetaPlan[p.estado]}</span></td>
                <td>{progreso.total > 0 && <progress max={progreso.total} value={progreso.decididas} aria-label={`Progreso de ${p.tag}`} />}
                  <small>{progresoAnterior(p)}</small></td>
                <td>{cambioEta ? <>{mostrarFecha(cambioEta.fecha)}<small className="m1-original">{cambioEta.usuario}</small></> : 'Sin cambios'}</td>
                <td>
                  <button className="boton-secundario" aria-label={`${accion} ${p.tag}`} onClick={(e) => {
                    retorno.current = e.currentTarget
                    setSeleccion(p.id)
                    requestAnimationFrame(() => titulo.current?.focus())
                  }}>{accion}</button>
                </td>
              </tr>
              )
            })}</tbody>
          </table>
        </div>
      )}
    </div>
    {plan && <DetalleTaller key={plan.id} {...props} plan={plan} titulo={titulo} volver={() => {
      setSeleccion('')
      requestAnimationFrame(() => retorno.current?.focus())
    }} />}
  </div>
}
