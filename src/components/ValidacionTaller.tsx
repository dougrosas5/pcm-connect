import { useState } from 'react'
import { responsablesPreparacion } from '../data/tareas'
import { corregirOM, datosOM, decidirPCM, evaluarOM, finalizarEvaluacion, ordenesAsignables, permisos, puedeCorregir, revisionDe, tallerDe } from '../features/validacionTaller'
import type { Actor, DatosOM, ResultadoOM } from '../features/validacionTaller'
import type { Planificacion, RegistroPlanificaciones } from '../features/planificaciones'

export type GuardarRegistro = (cambiar: (actual: RegistroPlanificaciones) => RegistroPlanificaciones) => boolean
const fechaHora = (fecha: string) => new Date(fecha).toLocaleString('es-UY', { timeZone: 'America/Montevideo' })

function DatosRegistrados({ valor }: { valor?: string }) {
  if (!valor) return <span>Sin registro</span>
  let datos: unknown
  try {
    datos = JSON.parse(valor)
  } catch {
    datos = valor
  }
  if (typeof datos !== 'object' || datos === null || Array.isArray(datos)) return <span>{valor}</span>
  const registro = datos as Record<string, unknown>
  const campos = typeof registro.datos === 'object' && registro.datos !== null ? { ...registro, ...registro.datos } : registro
  const etiquetas: Record<string, string> = { resultado: 'Evaluación', motivo: 'Motivo', descripcion: 'Trabajo', duracionPrevista: 'Duración prevista (h)', responsable: 'Responsable', personas: 'Personas', costo: 'Costo previsto (Gs.)' }
  return <ul className="datos-historicos">{Object.entries(etiquetas).filter(([campo]) => campos[campo] !== undefined).map(([campo, etiqueta]) => <li key={campo}><strong>{etiqueta}:</strong> {campo === 'costo' && typeof campos[campo] === 'number' ? campos[campo].toLocaleString('es-PY') : String(campos[campo]) || 'Sin observaciones'}</li>)}</ul>
}

function EvaluacionOM({ plan, om, actor, guardar }: { plan: Planificacion; om: string; actor: Actor; guardar: GuardarRegistro }) {
  const revision = revisionDe(plan, om)
  const [resultado, setResultado] = useState<ResultadoOM>(revision.resultado)
  const [motivo, setMotivo] = useState(revision.motivo)
  const editable = permisos(actor).evaluar && plan.estado === 'Pendiente de Taller' && !revision.congelada && !revision.cancelada
  return <>
    <td><span className="estado">{revision.cancelada ? 'Cancelada' : revision.resultado}</span>
      <small className="detalle-om">Revisión {revision.revision} · {revision.congelada ? 'Aprobada / solo lectura' : revision.evaluada !== undefined && revision.evaluada !== revision.revision ? 'Reevaluación requerida' : editable ? 'Editable por Taller' : 'Sin edición en este rol o etapa'}</small>
      {editable && <select aria-label={`Evaluación de ${om}`} value={resultado} onChange={event => setResultado(event.target.value as ResultadoOM)}>
        {(['Pendiente', 'Viable', 'No viable'] as const).map(valor => <option key={valor}>{valor}</option>)}
      </select>}
    </td>
    <td>{editable ? <>
      <textarea aria-label={`Observación o motivo de ${om}`} value={motivo} rows={2} required={resultado === 'No viable'} onChange={event => setMotivo(event.target.value)} />
      {resultado === 'No viable' && !motivo.trim() && <p className="error-campo">Motivo de rechazo obligatorio.</p>}
      <button type="button" className="boton-secundario" onClick={() => guardar(actual => evaluarOM(actual, plan.codigo, om, resultado, motivo, revision.revision, actor))}>Guardar evaluación de {om}</button>
    </> : <span>{revision.motivo || 'Sin observaciones'}</span>}</td>
  </>
}

function CorreccionOM({ plan, om, actor, guardar, cerrar }: { plan: Planificacion; om: string; actor: Actor; guardar: GuardarRegistro; cerrar: () => void }) {
  const [datos, setDatos] = useState<DatosOM>(() => ({ ...datosOM(plan, om) }))
  const [motivo, setMotivo] = useState('')
  const [revision] = useState(revisionDe(plan, om).revision)
  return <form className="datos-planificacion correccion-om" noValidate onSubmit={event => {
    event.preventDefault()
    if (guardar(actual => corregirOM(actual, plan.codigo, om, datos, motivo, revision, actor))) cerrar()
  }}>
    <h2>Corregir {om} · revisión {revision}</h2>
    <p className="ayuda">Solo cambia esta OM. Guardar exige una nueva evaluación y conserva el resultado anterior en el historial. La duración común de tarea permanece en Preparación.</p>
    <label>Descripción del trabajo<input required value={datos.descripcion} onChange={event => setDatos({ ...datos, descripcion: event.target.value })} /></label>
    <div className="campos-correccion">
      <label>Duración prevista de esta OM (h)<input required type="number" min="0" step="any" value={datos.duracionPrevista} onChange={event => setDatos({ ...datos, duracionPrevista: event.target.value })} /></label>
      <label>Costo previsto (Gs.; vacío = sin definir)<input type="number" min="0" step="any" value={datos.costo ?? ''} onChange={event => setDatos({ ...datos, costo: event.target.value === '' ? undefined : Number(event.target.value) })} /></label>
      <label>Responsable<select required value={datos.responsable} onChange={event => setDatos({ ...datos, responsable: event.target.value })}>
        <option value="">Seleccionar responsable</option>{responsablesPreparacion.map(nombre => <option key={nombre}>{nombre}</option>)}
      </select></label>
      <label>Personas<input required type="number" min="1" step="1" value={datos.personas} onChange={event => setDatos({ ...datos, personas: event.target.value })} /></label>
    </div>
    <label>Motivo de la modificación (obligatorio)<textarea required value={motivo} onChange={event => setMotivo(event.target.value)} rows={2} /></label>
    <div className="acciones-planificacion"><button className="boton-primario" type="submit">Guardar corrección</button><button className="boton-secundario" type="button" onClick={cerrar}>Cerrar corrección</button></div>
  </form>
}

function DecisionPCM({ plan, actor, guardar }: { plan: Planificacion; actor: Actor; guardar: GuardarRegistro }) {
  const [motivo, setMotivo] = useState('')
  const [confirmada, setConfirmada] = useState(false)
  return <section className="datos-planificacion" aria-label="Decisión de PCM">
    <h2>Respuesta de PCM</h2>
    <p className="ayuda">Continuar confirma únicamente las OM viables vigentes. Devolver habilita correcciones de las rechazadas y conserva las aprobaciones congeladas.</p>
    <label htmlFor="motivo-pcm">Observación / motivo obligatorio al cancelar</label>
    <textarea id="motivo-pcm" value={motivo} onChange={event => setMotivo(event.target.value)} rows={2} />
    <label className="confirmacion-cancelacion"><input type="checkbox" checked={confirmada} onChange={event => setConfirmada(event.target.checked)} />Confirmo cancelar {plan.codigo} completa; ninguna OM podrá asignarse.</label>
    <div className="acciones-planificacion">
      {(['Continuar', 'Devolver a revisión', 'Cancelar'] as const).map(decision => <button key={decision} className={decision === 'Continuar' ? 'boton-primario' : 'boton-secundario'} type="button" onClick={() => guardar(actual => decidirPCM(actual, plan.codigo, decision, motivo, confirmada, actor))}>{decision === 'Cancelar' ? 'Cancelar planificación' : decision}</button>)}
    </div>
  </section>
}

export default function ValidacionTaller({ registro, actor, guardar, bloqueado }: { registro: RegistroPlanificaciones; actor: Actor; guardar: GuardarRegistro; bloqueado: boolean }) {
  const recibidas = registro.planificaciones.filter(plan => plan.estado !== 'Borrador')
  const [seleccion, setSeleccion] = useState('')
  const [corrigiendo, setCorrigiendo] = useState<string | null>(null)
  const plan = recibidas.find(item => item.codigo === seleccion) ?? recibidas[0]
  if (!plan) return <div className="estado-vacio">No hay planificaciones recibidas. PCM debe crear una planificación, completar sus tareas y usar «Enviar a Taller» en Planificación.</div>
  const filas = plan.preparacion.filas
  const activas = filas.filter(fila => !revisionDe(plan, fila.numero).cancelada)
  const pendientes = activas.filter(fila => revisionDe(plan, fila.numero).resultado === 'Pendiente').length
  const viables = activas.filter(fila => revisionDe(plan, fila.numero).resultado === 'Viable').length
  const rechazadas = activas.filter(fila => revisionDe(plan, fila.numero).resultado === 'No viable').length
  const historial = tallerDe(plan).historial
  return <>
    <div className="consulta-planificaciones selector-taller"><label htmlFor="plan-taller">Planificaciones recibidas</label>
      <select id="plan-taller" value={plan.codigo} onChange={event => { setSeleccion(event.target.value); setCorrigiendo(null) }}>
        {recibidas.map(item => <option value={item.codigo} key={item.codigo}>{item.codigo} · {item.remolcador} · {item.estado}</option>)}
      </select>
    </div>
    <section className="datos-planificacion" aria-label="Resumen de planificación">
      <dl className="campos-planificacion">
        <div><dt>Planificación</dt><dd>{plan.codigo}</dd></div><div><dt>Remolcador</dt><dd>{plan.remolcador}</dd></div>
        <div><dt>Fecha de parada</dt><dd>{plan.fechaParada.split('-').reverse().join('/')}</dd></div>
        <div><dt>Duración prevista de parada</dt><dd>{plan.horasParada} h</dd></div><div><dt>Estado</dt><dd><span className="estado">{plan.estado}</span></dd></div>
      </dl>
    </section>
    <p className="resumen-validacion" role="status"><strong>{pendientes}</strong> pendientes · <strong>{viables}</strong> viables · <strong>{rechazadas}</strong> no viables · {filas.length - activas.length} canceladas</p>
    <p className="ayuda">Cada OM se evalúa por separado. Hasta finalizar, PCM puede editar trabajos no congelados; cada cambio invalida únicamente las evaluaciones afectadas. Los valores comunes provienen de la tarea salvo corrección individual indicada.</p>
    <fieldset disabled={bloqueado} className="area-tareas">
      <div className="tabla-contenedor" role="region" aria-label="Evaluación individual de OM; desplazamiento horizontal" tabIndex={0}>
        <table className="tabla-tareas tabla-validacion">
          <caption>{plan.codigo} · evaluación de la revisión vigente por OM</caption>
          <thead><tr>{['Tarea', 'OM / trabajo', 'Datos vigentes', 'Evaluación', 'Observación / rechazo', 'Corrección'].map(nombre => <th scope="col" key={nombre}>{nombre}</th>)}</tr></thead>
          <tbody>{filas.map(fila => {
            const revision = revisionDe(plan, fila.numero)
            const datos = datosOM(plan, fila.numero)
            return <tr key={fila.numero}>
              <td>{fila.tarea}</td><th scope="row">{fila.numero}<span className="detalle-om descripcion-om">{datos.descripcion}</span></th>
              <td>{datos.duracionPrevista} h · {datos.personas} personas<span className="detalle-om">{datos.responsable || 'Sin responsable'}</span><span className="detalle-om">{datos.costo === undefined ? 'Costo sin definir' : `Gs. ${datos.costo.toLocaleString('es-PY')}`}</span><small>{revision.datos ? 'Datos individuales de OM' : 'Valores comunes de tarea'}</small></td>
              <EvaluacionOM key={`${plan.codigo}-${revision.revision}-${revision.resultado}-${revision.motivo}-${actor.rol}`} plan={plan} om={fila.numero} actor={actor} guardar={guardar} />
              <td>{puedeCorregir(plan, fila.numero, actor) ? <button type="button" className="boton-secundario" onClick={() => setCorrigiendo(fila.numero)}>Corregir {fila.numero}</button> : 'Solo lectura'}
                {revision.congelada && <><button type="button" className="boton-secundario" disabled>Cancelar {fila.numero}</button><small className="detalle-om">Cancelación restringida: permisos pendientes.</small></>}
              </td>
            </tr>
          })}</tbody>
        </table>
      </div>
      {corrigiendo && puedeCorregir(plan, corrigiendo, actor) && <CorreccionOM key={`${plan.codigo}-${corrigiendo}-${actor.rol}`} plan={plan} om={corrigiendo} actor={actor} guardar={guardar} cerrar={() => setCorrigiendo(null)} />}
      {plan.estado === 'Pendiente de Taller' && permisos(actor).evaluar && <div className="acciones-planificacion"><button type="button" className="boton-primario" onClick={() => guardar(actual => finalizarEvaluacion(actual, plan.codigo, actor))}>Finalizar evaluación</button><span className="ayuda">{pendientes > 0 ? `${pendientes} OM requieren revisión antes de finalizar.` : 'Todas las OM activas tienen una evaluación guardada.'}</span></div>}
      {plan.estado === 'Pendiente de PCM' && permisos(actor).organizar && <DecisionPCM key={plan.codigo} plan={plan} actor={actor} guardar={guardar} />}
    </fieldset>
    {plan.estado === 'En revisión' && <p className="ayuda">PCM o Taller pueden corregir las OM no congeladas. Luego PCM debe reenviar desde Planificación.</p>}
    {plan.estado === 'Confirmada' && <p className="aviso-guardado">Confirmada · elegibles para futura asignación: {ordenesAsignables(plan).map(fila => fila.numero).join(', ')}. Las rechazadas quedan excluidas. La asignación aún no está implementada.</p>}
    {plan.estado === 'Cancelada' && <p className="aviso-guardado">Planificación cancelada. No permite nuevas evaluaciones, cambios ni asignaciones.</p>}
    <details className="historial-taller"><summary>Decisiones e historial · {historial.length} eventos</summary>
      <p className="ayuda">Fechas y horas de Montevideo. Se conservan resultados y datos de cada revisión.</p>
      {historial.length === 0 && <p>No hay eventos disponibles para este registro anterior.</p>}
      <ol>{[...historial].reverse().map((evento, indice) => <li key={`${evento.fecha}-${indice}`}>
        <strong>{evento.tipo}</strong> · {evento.planificacion}{evento.om && ` · ${evento.om}`}{evento.revision && ` · revisión ${evento.revision}`}
        <small className="detalle-om"><time dateTime={evento.fecha}>{fechaHora(evento.fecha)}</time> · {evento.usuario} · {evento.rol}</small>
        <p>{evento.detalle}</p>{(evento.anterior || evento.nuevo) && <details><summary>Ver datos registrados</summary><dl><dt>Anterior</dt><dd><DatosRegistrados valor={evento.anterior} /></dd><dt>Nuevo</dt><dd><DatosRegistrados valor={evento.nuevo} /></dd></dl></details>}
      </li>)}</ol>
    </details>
  </>
}
