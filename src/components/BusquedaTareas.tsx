import { responsablesPreparacion, tareasDemo } from '../data/tareas'
import { agruparPorTarea, buscarTareas, datosDeTarea, errorDuracion, errorPersonas, errorResponsable, resumirCostos } from '../features/busquedaTareas'
import type { DatosTarea } from '../features/busquedaTareas'
import type { Preparacion } from '../features/planificaciones'

type CampoEditable = 'duracionPrevista' | 'responsable' | 'personas'

const campos = {
  duracionPrevista: { etiqueta: 'Duración prevista (h)', validar: errorDuracion },
  responsable: { etiqueta: 'Responsable', validar: errorResponsable },
  personas: { etiqueta: 'Personas', validar: errorPersonas },
}
const formatoCosto = new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 })

export default function BusquedaTareas({ preparacion, onChange, puedeEditarTarea = () => true, onQuitar, detalleOM }: {
  preparacion: Preparacion
  onChange: (cambios: Partial<Preparacion>) => void
  puedeEditarTarea?: (tarea: string) => boolean
  onQuitar?: (ordenes: string[]) => void
  detalleOM?: (om: string) => string | undefined
}) {
  const { entrada, filas, avisos, resumen, revisados, datosPorTarea = {} } = preparacion
  const grupos = agruparPorTarea(filas).map(grupo => {
    const tarea = tareasDemo.find(tarea => tarea.numero === grupo.tarea)
    return { ...grupo, original: tarea, ...datosDeTarea(tarea, grupo.ordenes, datosPorTarea[grupo.tarea]), costos: resumirCostos(grupo.ordenes) }
  })
  const pendientes = grupos.filter(({ datos }) => errorDuracion(datos.duracionPrevista) || errorResponsable(datos.responsable) || errorPersonas(datos.personas)).length
  const costos = resumirCostos(filas)

  function actualizar(tarea: string, datos: DatosTarea, campo: CampoEditable, valor: string) {
    onChange({ datosPorTarea: { ...datosPorTarea, [tarea]: { ...datos, [campo]: valor } } })
  }

  function campoEditable(tarea: string, datos: DatosTarea, campo: CampoEditable) {
    const id = `${tarea}-${campo}`
    const error = revisados[id] ? campos[campo].validar(datos[campo]) : ''
    const atributos = {
      id,
      required: true,
      disabled: !puedeEditarTarea(tarea),
      value: datos[campo],
      'aria-label': `${campos[campo].etiqueta} de tarea ${tarea}`,
      'aria-invalid': Boolean(error),
      'aria-describedby': error ? `${id}-error` : undefined,
      onBlur: () => onChange({ revisados: { ...revisados, [id]: true } }),
    }
    return (
      <td className={`campo-${campo}`}>
        {campo === 'responsable' ? (
          <select {...atributos} onChange={event => actualizar(tarea, datos, campo, event.target.value)}>
            <option value="">Seleccionar responsable</option>
            {responsablesPreparacion.map(responsable => <option key={responsable} value={responsable}>{responsable}</option>)}
          </select>
        ) : (
          <input
            {...atributos} type="number"
            min={campo === 'personas' ? 1 : 0}
            step={campo === 'personas' ? 1 : 'any'}
            onChange={event => actualizar(tarea, datos, campo, event.target.value)}
          />
        )}
        {error && <p id={`${id}-error`} className="error-campo">{error}</p>}
      </td>
    )
  }

  return (
    <>
      <p className="introduccion-tareas">Buscá tareas y prepará sus órdenes de mantenimiento abiertas.</p>
      <p className="nota-demo">Demo · Tareas ficticias y costos estimados en guaraníes (Gs.) basados en referencias públicas; no son cotizaciones. Sin conexión a sistemas corporativos. Los cambios se guardan localmente al editar.</p>
      <form className="busqueda" onSubmit={event => {
        event.preventDefault()
        const resultado = buscarTareas(entrada, tareasDemo, filas)
        onChange({ filas: resultado.filas, avisos: resultado.avisos, resumen: `Búsqueda completada: ${resultado.agregadas} OM agregadas. Total: ${resultado.filas.length}.` })
      }}>
        <div className="entrada-busqueda">
          <label htmlFor="numeros-tarea">Números de tarea</label>
          <textarea id="numeros-tarea" rows={1} value={entrada} onChange={event => onChange({ entrada: event.target.value })} aria-describedby="ayuda-busqueda ejemplos-tareas" placeholder="1001, 1003" />
          <button className="boton-primario" type="submit">Buscar tareas</button>
        </div>
        <p id="ayuda-busqueda" className="ayuda">Separá por comas, espacios o saltos de línea. Cada búsqueda agrega OM sin duplicar las existentes.</p>
        <p id="ejemplos-tareas" className="ayuda">Ejemplos: 1001 (dos OM), 1002 (cerrada), 1003 (mixta), 1004 (OM cerrada), 0010-A.</p>
      </form>

      <div className="avisos">
        <p role="status" aria-live="polite" aria-atomic="true">{resumen}{resumen && avisos.length > 0 && ` ${avisos.length} avisos para revisar.`}</p>
        {avisos.length > 0 && (
          <details>
            <summary>Ver {avisos.length} avisos · tareas excluidas, repetidas o sin OM nuevas</summary>
            <ul tabIndex={0} aria-label="Detalle de avisos de búsqueda">{avisos.map(aviso => <li key={aviso}>{aviso}</li>)}</ul>
          </details>
        )}
      </div>

      <div className="cabecera-preparacion">
        <h2>Tareas de la preparación <span className="contador">({grupos.length})</span></h2>
        <p className="resumen-costos">
          <span>{costos.sinDefinir > 0 && costos.subtotal !== undefined ? 'Subtotal conocido' : 'Costo total estimado'}: </span>
          <strong>{filas.length === 0 ? 'Sin OM' : costos.subtotal === undefined ? 'Sin definir' : `Gs. ${formatoCosto.format(costos.subtotal)}`}</strong>
          {costos.sinDefinir > 0 && <span className="costo-pendiente">Total pendiente · {costos.sinDefinir} OM sin costo definido</span>}
        </p>
      </div>
      <p id="ayuda-tabla" className="ayuda">Una fila por tarea con sus OM abiertas. Duración prevista, responsable y personas comunes a la tarea; el costo suma sus OM. La duración no equivale a horas-persona ni a horas reales.</p>
      {filas.length === 0 ? (
        <div className="estado-vacio">Todavía no hay OM en la tabla. Buscá 1001 para comenzar; los avisos explican las tareas excluidas.</div>
      ) : (
        <>
          <p className="ayuda">{pendientes > 0 ? `${pendientes} tareas con datos por completar o corregir.` : 'Todas las tareas tienen duración, responsable y cantidad de personas válidos.'}</p>
          <div className="tabla-contenedor" role="region" aria-label="Órdenes de mantenimiento; desplazamiento horizontal" tabIndex={0}>
            <table className="tabla-tareas" aria-describedby="ayuda-tabla">
              <caption>Preparación de tareas · una fila por tarea</caption>
              <thead><tr>
                {['N.º tarea', 'N.º OM', 'Descripción de la tarea', 'Duración prevista (h)', 'Criticidad', 'Costo estimado (Gs.)', 'Estado', 'Responsable', 'Personas'].map(columna => <th scope="col" key={columna}>{columna}</th>)}
              </tr></thead>
              {grupos.map(grupo => (
                <tbody key={grupo.tarea}>
                  <tr>
                    <th scope="row" className="tarea-agrupada">{grupo.tarea}</th>
                    <td>{grupo.ordenes.map(om => <div key={om.numero}>{om.numero}{detalleOM?.(om.numero) && <small className="detalle-om">{detalleOM(om.numero)}</small>}{onQuitar && <button type="button" className="boton-quitar" aria-label={`Quitar ${om.numero}`} onClick={() => onQuitar([om.numero])}>Quitar</button>}</div>)}
                      {onQuitar && <button type="button" className="boton-quitar" onClick={() => {
                        const ordenes = grupo.ordenes.map(om => om.numero)
                        if (window.confirm(`Quitar tarea ${grupo.tarea}. Se quitarán: ${ordenes.join(', ')}.`)) onQuitar(ordenes)
                      }}>Quitar tarea {grupo.tarea}</button>}
                    </td>
                    <td className="descripcion-trabajo">
                      {grupo.original?.descripcion}
                      {grupo.conflictos.length > 0 && <p className="error-campo">Hay ediciones anteriores distintas por OM. Definí un valor común de {grupo.conflictos.join(', ')} para esta tarea.</p>}
                    </td>
                    {campoEditable(grupo.tarea, grupo.datos, 'duracionPrevista')}
                    <td>{grupo.ordenes[0].criticidad ?? 'Baja'}</td>
                    <td className="numero costo-om">
                      {grupo.costos.subtotal === undefined ? 'Sin definir' : formatoCosto.format(grupo.costos.subtotal)}
                      {grupo.costos.sinDefinir > 0 && grupo.costos.subtotal !== undefined && <span className="costo-pendiente">Subtotal · total pendiente</span>}
                    </td>
                    <td><span className="estado">{grupo.original?.estado ?? 'Abierta'}</span></td>
                    {campoEditable(grupo.tarea, grupo.datos, 'responsable')}
                    {campoEditable(grupo.tarea, grupo.datos, 'personas')}
                  </tr>
                </tbody>
              ))}
            </table>
          </div>
        </>
      )}
    </>
  )
}
