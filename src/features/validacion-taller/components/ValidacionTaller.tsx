import EditorEta from './EditorEta'
import { useRef, useState } from 'react'
import { finParada, mostrarFecha } from '../../planificacion/model/modelo'
import type { Actor, Comando, Registro } from '../../../types/pcm'
import { filtrarPlanes, filtrosVacios, gruposTaller, nombreReferencia, progresoAnterior } from '../model/bandeja'
import type { FiltrosTaller } from '../model/bandeja'
import TablaPropuesta from '../../planificacion/components/TablaPropuesta'
import '../styles/validacion-taller.css'

type Props = {
  registro: Registro
  actor: Actor
  ocupado: boolean
  cambiosPCM: boolean
  ejecutar: (comando: Comando) => Promise<boolean>
}

export default function ValidacionTaller(props: Props) {
  const { registro, actor, ocupado, ejecutar } = props
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
    return [...new Map(registro.planes.filter((p) => p[campo]).map((p) =>
      [p[campo], nombreReferencia(p, registro, p[campo])])).entries()]
  }
  return <div className="m2">
    <div hidden={Boolean(plan)}>
      <h2>Bandeja de planificaciones</h2>
      <dl className="m2-indicadores" aria-label="Indicadores de todas las planificaciones">
        {gruposTaller.map((g) => (
          <div key={g.nombre}>
            <dt>{g.nombre}</dt>
            <dd>{g.estados.length
              ? registro.planes.filter((p) => g.estados.includes(p.estado)).length
              : 'Por configurar'}
            </dd>
          </div>
        ))}
      </dl>
      <p className="m1-nota">Indicadores del total guardado. Programación, ejecución y cierre pendientes de definición. Los borradores se muestran en consulta.</p>
      <div className="m1-acciones" aria-label="Vistas de planificaciones">
        <button className="boton-secundario" aria-pressed={!historial} onClick={() => setHistorial(false)}>Activas</button>
        <button className="boton-secundario" aria-pressed={historial} onClick={() => setHistorial(true)}>Historial</button>
      </div>
      <section className="m1-panel" aria-label="Filtros de planificaciones">
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
              {['Borrador', 'Enviado a Taller', 'En evaluación', 'Evaluado'].map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label className="m1-campo">ETA final desde
            <input type="date" value={filtros.desde} onChange={(e) => filtrar('desde', e.target.value)} />
          </label>
          <label className="m1-campo">ETA final hasta
            <input type="date" value={filtros.hasta} onChange={(e) => filtrar('hasta', e.target.value)} />
          </label>
        </div>
        <p className="m1-nota">Fechas inclusivas · hora de Montevideo.</p>
        <button className="boton-secundario" onClick={() => setFiltros(filtrosVacios)}>Limpiar filtros</button>
        {filtros.desde && filtros.hasta && filtros.desde > filtros.hasta && <p role="alert" className="m1-error">La fecha desde no puede ser posterior a la fecha hasta.</p>}
      </section>
      <p role="status">{filtradas.length} planificaciones</p>
      {historial && <p className="m1-nota">Historial reservado para planificaciones finalizadas. «Evaluado» no significa trabajo finalizado; todavía no existe una transición de cierre.</p>}
      {!filtradas.length ? (
        <p className="estado-vacio">{historial
          ? 'No hay planificaciones finalizadas.'
          : registro.planes.length
            ? 'No hay coincidencias. Revisá o limpiá los filtros.'
            : 'No hay planificaciones guardadas. Creá una desde Planificación.'}
        </p>
      ) : (
        <div className="tabla-contenedor" tabIndex={0} role="region" aria-label="Bandeja de Taller; desplazamiento horizontal disponible">
          <table className="tabla-tareas m2-bandeja">
            <caption>Planificaciones compartidas con PCM · fechas en Montevideo</caption>
            <thead>
              <tr>{[
                'TAG', 'Remolcador', 'Ubicación', 'ETA inicial', 'ETA final', 'Parada (h)',
                'Tareas', 'Estado', 'Progreso de evaluación', 'Última actualización de ETA', 'Acción'
              ].map((t) => <th scope="col" key={t}>{t}</th>)}</tr>
            </thead>
            <tbody>{filtradas.map((p) => (
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
                <td><span className="estado">{p.estado}</span></td>
                <td>{progresoAnterior(p)}</td>
                <td>{p.historialEta?.length ? mostrarFecha(p.historialEta.at(-1)!.fecha) : 'Sin cambios registrados'}</td>
                <td>
                  <button className="boton-secundario" aria-label={`Consultar ${p.tag}`} onClick={(e) => {
                    retorno.current = e.currentTarget
                    setSeleccion(p.id)
                    requestAnimationFrame(() => titulo.current?.focus())
                  }}>Consultar</button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
    {plan && <section aria-labelledby="m2-detalle">
      <button className="boton-secundario" onClick={() => {
        setSeleccion('')
        requestAnimationFrame(() => retorno.current?.focus())
      }}>Volver a la bandeja</button>
      <div className="m1-panel">
        <div className="m1-encabezado">
          <h2 id="m2-detalle" tabIndex={-1} ref={titulo}>Evaluación · {plan.tag}</h2>
          <span className="estado">{plan.estado}</span>
        </div>
        <dl className="m1-cabecera m2-datos">{[
          ['TAG', plan.tag],
          ['Remolcador', nombreReferencia(plan, registro, plan.remolcadorId)],
          ['Ubicación', nombreReferencia(plan, registro, plan.ubicacionId)],
          ['ETA inicial · solo lectura', mostrarFecha(plan.etaInicial ?? plan.eta)],
          ['ETA final · vigente', mostrarFecha(plan.eta)],
          ['Tiempo de parada', plan.horasParada ? `${plan.horasParada} h` : 'Sin definir'],
          ['Fin previsto de parada', mostrarFecha(finParada(plan))],
          ['Estado', plan.estado],
          ['Planificador responsable', plan.planificador]
        ].map(([nombre, valor]) => <div key={nombre}><dt>{nombre}</dt><dd>{valor}</dd></div>)}</dl>
        <p className="m1-nota">Fechas en Montevideo. {plan.origenEtaInicial !== 'creacion' ? 'Plan anterior al Módulo 2: la ETA inicial refleja el dato disponible al incorporar el historial; si estaba vacío, permanece sin definir.' : 'La ETA inicial quedó fijada al crear esta planificación.'}</p>
        <EditorEta
          key={`${plan.id}:${plan.version}:${actor.rol}`}
          plan={plan}
          actor={actor}
          ocupado={ocupado}
          cambiosPCM={props.cambiosPCM}
          ejecutar={ejecutar}
        />
        {Boolean(plan.historialEta?.length) && <p className="m1-nota">Disponibilidad pendiente de revisión por cambio de ETA. No se confirmó capacidad ni se modificaron decisiones previas. La detección de conflictos pertenece a una próxima iteración.</p>}
      </div>
      <section className="m1-panel" aria-label="Historial de ETA">
        <h3>Historial de cambios de ETA</h3>
        {!plan.historialEta?.length ? <p>Sin cambios de ETA registrados.</p> : (
          <ol className="m1-lista-historial">{[...plan.historialEta].reverse().map((c, i) => (
            <li key={`${c.fecha}:${i}`}>
              <strong>{mostrarFecha(c.fecha)} · {c.usuario}</strong>
              <p>{mostrarFecha(c.anterior)} → {mostrarFecha(c.nuevo)}</p>
              <p>{c.comentario}</p>
            </li>
          ))}</ol>
        )}
      </section>
      <p className="m1-nota">Consulta de la propuesta original. La evaluación por tarea u OM y la resolución de rechazos están pendientes de decisión; esta iteración no registra aceptaciones ni rechazos.</p>
      <TablaPropuesta plan={plan} registro={registro} editable={false} cambiar={() => {}} />
      {Object.keys(plan.evaluaciones).length > 0 && (
        <section className="m1-panel">
          <h3>Evaluaciones anteriores · v1.3</h3>
          <ul>{Object.entries(plan.evaluaciones).map(([id, e]) => (
            <li key={id}>{id}: {e.resultado} · {e.motivo || 'Sin observaciones'} · {e.usuario} · {mostrarFecha(e.fecha)}</li>
          ))}</ul>
        </section>
      )}
    </section>}
  </div>
}
