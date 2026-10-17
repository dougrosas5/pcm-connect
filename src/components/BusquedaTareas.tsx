import { useState } from 'react'
import { responsablesPreparacion, tareasDemo } from '../data/tareas'
import { agruparPorTarea, buscarTareas, errorDuracion, errorPersonas, errorResponsable, resumirCostos } from '../features/busquedaTareas'
import type { FilaOM } from '../features/busquedaTareas'

type CampoEditable = 'duracionPrevista' | 'responsable' | 'personas'

const campos = {
  duracionPrevista: { etiqueta: 'Duración prevista (h)', validar: errorDuracion },
  responsable: { etiqueta: 'Responsable', validar: errorResponsable },
  personas: { etiqueta: 'Personas', validar: errorPersonas },
}
const formatoCosto = new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 })

export default function BusquedaTareas() {
  const [entrada, setEntrada] = useState('')
  const [filas, setFilas] = useState<FilaOM[]>([])
  const [avisos, setAvisos] = useState<string[]>([])
  const [resumen, setResumen] = useState('')
  const [revisados, setRevisados] = useState<Record<string, boolean>>({})
  const pendientes = filas.filter(fila => errorDuracion(fila.duracionPrevista) || errorResponsable(fila.responsable) || errorPersonas(fila.personas)).length
  const grupos = agruparPorTarea(filas)
  const costos = resumirCostos(filas)

  function actualizar(numero: string, campo: CampoEditable, valor: string) {
    setFilas(previas => previas.map(fila => fila.numero === numero ? { ...fila, [campo]: valor } : fila))
  }

  function campoEditable(fila: FilaOM, campo: CampoEditable) {
    const id = `${fila.numero}-${campo}`
    const error = revisados[id] ? campos[campo].validar(fila[campo]) : ''
    const atributos = {
      id,
      required: true,
      value: fila[campo],
      'aria-label': `${campos[campo].etiqueta} de tarea ${fila.tarea}, OM ${fila.numero}`,
      'aria-invalid': Boolean(error),
      'aria-describedby': error ? `${id}-error` : undefined,
      onBlur: () => setRevisados(previos => ({ ...previos, [id]: true })),
    }
    return (
      <td className={`campo-${campo}`}>
        {campo === 'responsable' ? (
          <select {...atributos} onChange={event => actualizar(fila.numero, campo, event.target.value)}>
            <option value="">Seleccionar responsable</option>
            {responsablesPreparacion.map(responsable => <option key={responsable} value={responsable}>{responsable}</option>)}
          </select>
        ) : (
          <input
            {...atributos} type="number"
            min={campo === 'personas' ? 1 : 0}
            step={campo === 'personas' ? 1 : 'any'}
            onChange={event => actualizar(fila.numero, campo, event.target.value)}
          />
        )}
        {error && <p id={`${id}-error`} className="error-campo">{error}</p>}
      </td>
    )
  }

  return (
    <>
      <p className="introduccion-tareas">Buscá tareas y prepará sus órdenes de mantenimiento abiertas.</p>
      <p className="nota-demo">Demo · Tareas ficticias y costos estimados en guaraníes (Gs.) basados en referencias públicas; no son cotizaciones. Sin conexión a sistemas corporativos. El borrador se conserva al navegar y se pierde al recargar.</p>
      <form className="busqueda" onSubmit={event => {
        event.preventDefault()
        const resultado = buscarTareas(entrada, tareasDemo, filas)
        setFilas(resultado.filas)
        setAvisos(resultado.avisos)
        setResumen(`Búsqueda completada: ${resultado.agregadas} OM agregadas. Total: ${resultado.filas.length}.`)
      }}>
        <div className="entrada-busqueda">
          <label htmlFor="numeros-tarea">Números de tarea</label>
          <textarea id="numeros-tarea" rows={1} value={entrada} onChange={event => setEntrada(event.target.value)} aria-describedby="ayuda-busqueda ejemplos-tareas" placeholder="1001, 1003" />
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
        <h2>OM de la preparación <span className="contador">({filas.length})</span></h2>
        <p className="resumen-costos">
          <span>{costos.sinDefinir > 0 && costos.subtotal !== undefined ? 'Subtotal conocido' : 'Costo total estimado'}: </span>
          <strong>{filas.length === 0 ? 'Sin OM' : costos.subtotal === undefined ? 'Sin definir' : `Gs. ${formatoCosto.format(costos.subtotal)}`}</strong>
          {costos.sinDefinir > 0 && <span className="costo-pendiente">Total pendiente · {costos.sinDefinir} OM sin costo definido</span>}
        </p>
      </div>
      <p id="ayuda-tabla" className="ayuda">Solo OM abiertas. Duración prevista por OM, editable; no equivale a horas-persona ni a horas reales. Personas: 1 por defecto en esta demo, editable.</p>
      {filas.length === 0 ? (
        <div className="estado-vacio">Todavía no hay OM en la tabla. Buscá 1001 para comenzar; los avisos explican las tareas excluidas.</div>
      ) : (
        <>
          <p className="ayuda">{pendientes > 0 ? `${pendientes} OM con datos por completar o corregir.` : 'Todas las OM tienen duración, responsable y cantidad de personas válidos.'}</p>
          <div className="tabla-contenedor" role="region" aria-label="Órdenes de mantenimiento; desplazamiento horizontal" tabIndex={0}>
            <table className="tabla-tareas" aria-describedby="ayuda-tabla">
              <caption>Preparación de tareas · una fila por OM</caption>
              <thead><tr>
                {['N.º tarea', 'N.º OM', 'Descripción del trabajo', 'Duración prevista (h)', 'Criticidad', 'Costo estimado (Gs.)', 'Estado', 'Responsable', 'Personas'].map(columna => <th scope="col" key={columna}>{columna}</th>)}
              </tr></thead>
              {grupos.map(grupo => (
                <tbody key={grupo.tarea}>
                  {grupo.ordenes.map((fila, indice) => (
                    <tr key={fila.numero}>
                      {indice === 0 && <th scope="rowgroup" rowSpan={grupo.ordenes.length} className="tarea-agrupada">{grupo.tarea}</th>}
                      <th scope="row">{fila.numero}</th>
                      <td className="descripcion-trabajo">{fila.descripcion}</td>
                      {campoEditable(fila, 'duracionPrevista')}
                      <td>{fila.criticidad ?? 'Baja'}</td>
                      <td className="numero costo-om">{fila.costo === undefined ? 'Sin definir' : formatoCosto.format(fila.costo)}</td>
                      <td><span className="estado">{fila.estado}</span></td>
                      {campoEditable(fila, 'responsable')}
                      {campoEditable(fila, 'personas')}
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        </>
      )}
    </>
  )
}
