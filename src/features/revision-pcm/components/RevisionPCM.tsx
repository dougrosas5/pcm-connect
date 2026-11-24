import { useRef, useState } from 'react'
import type { Actor, Comando, Registro } from '../../../types/pcm'
import { mostrarFecha } from '../../planificacion/model/modelo'
import { nombreReferencia } from '../../validacion-taller/model/bandeja'
import { cerradaPCM, estadoRevision, evaluacionVigente, filtrarRevision, filtrosRevisionVacios, indicadoresRevision } from '../model/revision'
import type { FiltrosRevision } from '../model/revision'
import ModalRevision from './ModalRevision'
import { etiquetaRevision } from '../../../components/etiquetasEstado'
import '../styles/revision-pcm.css'

type Props = { registro: Registro; actor: Actor; ocupado: boolean; cambiosPCM: boolean; error?: string; ejecutar: (c: Comando) => Promise<boolean> }
export default function RevisionPCM(props: Props) {
  const { registro, actor } = props
  const [filtros, setFiltros] = useState(filtrosRevisionVacios)
  const [historial, setHistorial] = useState(false)
  const [seleccion, setSeleccion] = useState('')
  const retorno = useRef<HTMLButtonElement | null>(null)
  const plan = registro.planes.find((p) => p.id === seleccion)
  const filtradas = filtrarRevision(registro.planes, filtros, historial)
  const pcm = ['Planificador', 'Administrador'].includes(actor.rol)
  function filtrar(campo: keyof FiltrosRevision, valor: string) { setFiltros({ ...filtros, [campo]: valor }) }
  function opciones(campo: 'remolcadorId' | 'ubicacionId') {
    return [...new Map(registro.planes.map((p) => [p[campo], nombreReferencia(p, registro, p[campo])])).entries()]
  }
  return <section className="m3" aria-labelledby="m3-titulo">
    <h2 id="m3-titulo">Bandeja de planificaciones</h2>
    <dl className="m2-indicadores" aria-label="Indicadores de revisión PCM">
      {Object.entries(indicadoresRevision(registro.planes)).map(([nombre, cantidad]) => <div key={nombre}><dt>{nombre}</dt><dd>{cantidad}</dd></div>)}
    </dl>
    <p className="m1-nota">El total de evaluadas incluye las ya confirmadas por PCM.</p>
    <div className="m1-acciones"><button className="boton-secundario" aria-pressed={!historial} onClick={() => setHistorial(false)}>Pendientes de PCM</button><button className="boton-secundario" aria-pressed={historial} onClick={() => setHistorial(true)}>Historial</button></div>
    <section className="m1-panel" aria-label="Filtros de revisión PCM">
      <div className="m1-cabecera">
        <label className="m1-campo">Buscar TAG<input type="search" value={filtros.tag} onChange={(e) => filtrar('tag', e.target.value)} /></label>
        <label className="m1-campo">Remolcador de revisión<select value={filtros.remolcador} onChange={(e) => filtrar('remolcador', e.target.value)}><option value="">Todos</option>{opciones('remolcadorId').map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}</select></label>
        <label className="m1-campo">Ubicación de revisión<select value={filtros.ubicacion} onChange={(e) => filtrar('ubicacion', e.target.value)}><option value="">Todas</option>{opciones('ubicacionId').map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}</select></label>
        <label className="m1-campo">Estado de revisión<select value={filtros.estado} onChange={(e) => filtrar('estado', e.target.value)}><option value="">Todos</option>{['Con rechazos', 'En reevaluación', 'Pendiente de revisión PCM', 'Lista para confirmar', 'Confirmada', 'Cancelada'].map((e) => <option key={e} value={e}>{etiquetaRevision(e)}</option>)}</select></label>
        <label className="m1-campo">ETA final desde<input type="date" value={filtros.desde} onChange={(e) => filtrar('desde', e.target.value)} /></label>
        <label className="m1-campo">ETA final hasta<input type="date" value={filtros.hasta} onChange={(e) => filtrar('hasta', e.target.value)} /></label>
        <label className="m1-campo">Rechazos<select value={filtros.rechazos} onChange={(e) => filtrar('rechazos', e.target.value)}><option value="">Todos</option><option value="si">Con rechazos</option><option value="no">Sin rechazos</option><option value="pendientes">Pendientes de resolución</option></select></label>
      </div>
      <p className="m1-nota">Fechas inclusivas.</p>
      <button className="boton-secundario" onClick={() => setFiltros(filtrosRevisionVacios)}>Limpiar filtros</button>
      {filtros.desde && filtros.hasta && filtros.desde > filtros.hasta && <p role="alert" className="m1-error">La fecha desde no puede ser posterior a la fecha hasta.</p>}
    </section>
    <p role="status">{filtradas.length} {filtradas.length === 1 ? 'planificación' : 'planificaciones'}</p>
    {!filtradas.length ? <p className="estado-vacio">{Object.values(filtros).some(Boolean)
      ? 'No hay coincidencias. Revisá o limpiá los filtros.'
      : historial ? 'No hay planificaciones confirmadas o canceladas.' : 'No hay planificaciones pendientes de revisión.'}</p> :
      <div className="tabla-contenedor" tabIndex={0} role="region" aria-label="Bandeja de revisión PCM; desplazamiento horizontal disponible"><table className="tabla-tareas m3-bandeja">
        <caption>{historial ? 'Historial de revisiones PCM' : 'Planificaciones recibidas de Taller'}</caption>
        <thead><tr>{['TAG', 'Remolcador', 'Ubicación', 'ETA inicial', 'ETA final', 'Parada (h)', 'Tareas', 'Aceptadas', 'Rechazadas', 'Estado', 'Acción'].map((t) => <th scope="col" key={t}>{t}</th>)}</tr></thead>
        <tbody>{filtradas.map((p) => {
          const estado = estadoRevision(p)
          const accion = !pcm || cerradaPCM(p) ? 'Ver' : estado === 'Lista para confirmar' ? 'Confirmar' : 'Revisar'
          return <tr key={p.id}><th scope="row">{p.tag}</th><td>{nombreReferencia(p, registro, p.remolcadorId)}</td><td>{nombreReferencia(p, registro, p.ubicacionId)}</td><td>{mostrarFecha(p.etaInicial ?? p.eta)}</td><td>{mostrarFecha(p.eta)}</td><td>{p.horasParada}</td><td>{p.filas.length}</td><td>{p.filas.filter((f) => evaluacionVigente(p, f.id)?.resultado === 'Aceptada').length}</td><td>{p.filas.filter((f) => evaluacionVigente(p, f.id)?.resultado === 'Rechazada').length}</td><td><span className="estado">{etiquetaRevision(estado)}</span></td><td><button className="boton-secundario" aria-label={`${accion} ${p.tag}`} onClick={(e) => { retorno.current = e.currentTarget; setSeleccion(p.id) }}>{accion}</button></td></tr>
        })}</tbody>
      </table></div>}
    {plan && <ModalRevision key={plan.id} {...props} plan={plan} cerrar={() => { setSeleccion(''); requestAnimationFrame(() => retorno.current?.focus()) }} />}
  </section>
}
