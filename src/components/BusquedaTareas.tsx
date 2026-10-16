import { useState } from 'react'
import { tareasDemo } from '../data/tareas'
import { buscarTareas, errorPersonas, errorResponsable } from '../features/busquedaTareas'
import type { FilaOM } from '../features/busquedaTareas'

type CampoEditable = 'responsable' | 'personas'

export default function BusquedaTareas() {
  const [entrada, setEntrada] = useState('')
  const [filas, setFilas] = useState<FilaOM[]>([])
  const [avisos, setAvisos] = useState<string[]>([])
  const [resumen, setResumen] = useState('')
  const [revisados, setRevisados] = useState<Record<string, boolean>>({})
  const pendientes = filas.filter(fila => errorResponsable(fila.responsable) || errorPersonas(fila.personas)).length

  function actualizar(numero: string, campo: CampoEditable, valor: string) {
    setFilas(previas => previas.map(fila => fila.numero === numero ? { ...fila, [campo]: valor } : fila))
  }

  return (
    <>
      <p>Buscá tareas y prepará sus órdenes de mantenimiento abiertas.</p>
      <p className="nota-demo">Demo · Datos ficticios, sin conexión a sistemas corporativos. El borrador se conserva al navegar y se pierde al recargar.</p>
      <form className="busqueda" onSubmit={event => {
        event.preventDefault()
        const resultado = buscarTareas(entrada, tareasDemo, filas)
        setFilas(resultado.filas)
        setAvisos(resultado.avisos)
        setResumen(`Búsqueda completada: ${resultado.agregadas} OM agregadas. Total: ${resultado.filas.length}.`)
      }}>
        <label htmlFor="numeros-tarea">Números de tarea</label>
        <p id="ayuda-busqueda" className="ayuda">Separá por comas, espacios o saltos de línea. Cada búsqueda agrega OM sin duplicar las existentes.</p>
        <textarea id="numeros-tarea" rows={3} value={entrada} onChange={event => setEntrada(event.target.value)} aria-describedby="ayuda-busqueda ejemplos-tareas" placeholder="1001, 1003" />
        <div className="acciones-busqueda">
          <button className="boton-primario" type="submit">Buscar tareas</button>
          <p id="ejemplos-tareas" className="ayuda">Ejemplos: 1001 (dos OM), 1002 (cerrada), 1003 (mixta), 1004 (OM cerrada), 0010-A.</p>
        </div>
      </form>

      <div className="avisos" role="status" aria-live="polite" aria-atomic="true">
        {resumen && <p>{resumen}</p>}
        {avisos.length > 0 && <ul>{avisos.map(aviso => <li key={aviso}>{aviso}</li>)}</ul>}
      </div>

      <h2>OM de la preparación <span className="contador">({filas.length})</span></h2>
      <p id="ayuda-tabla" className="ayuda">Solo OM abiertas. Duración prevista por OM; no equivale a horas-persona ni a horas reales. Personas: 1 por defecto en esta demo, editable.</p>
      {filas.length === 0 ? (
        <div className="estado-vacio">Todavía no hay OM en la tabla. Buscá 1001 para comenzar; los avisos explican las tareas excluidas.</div>
      ) : (
        <>
          <p className="ayuda">{pendientes > 0 ? `${pendientes} OM con datos por completar o corregir.` : 'Todas las OM tienen responsable y cantidad de personas válidos.'}</p>
          <div className="tabla-contenedor" role="region" aria-label="Órdenes de mantenimiento; desplazamiento horizontal" tabIndex={0}>
            <table className="tabla-tareas" aria-describedby="ayuda-tabla">
              <caption>Preparación de tareas · una fila por OM</caption>
              <thead><tr>
                {['N.º tarea', 'N.º OM', 'Área', 'Duración prevista (h)', 'Criticidad', 'Costo estimado', 'Estado', 'Responsable', 'Personas'].map(columna => <th scope="col" key={columna}>{columna}</th>)}
              </tr></thead>
              <tbody>{filas.map(fila => (
                <tr key={fila.numero}>
                  <td>{fila.tarea}</td>
                  <th scope="row">{fila.numero}</th>
                  <td>{fila.area}</td>
                  <td className="numero">{fila.horasPrevistas.toLocaleString('es-UY')}</td>
                  <td>{fila.criticidad ?? 'Baja'}</td>
                  <td>{fila.costo ?? 'Sin definir'}</td>
                  <td><span className="estado">{fila.estado}</span></td>
                  {(['responsable', 'personas'] as const).map(campo => {
                    const id = `${fila.numero}-${campo}`
                    const error = revisados[id] ? (campo === 'responsable' ? errorResponsable(fila[campo]) : errorPersonas(fila[campo])) : ''
                    return (
                      <td key={campo} className={`campo-${campo}`}>
                        <input
                          id={id} type={campo === 'personas' ? 'number' : 'text'}
                          min={campo === 'personas' ? 1 : undefined} step={campo === 'personas' ? 1 : undefined}
                          required value={fila[campo]}
                          aria-label={`${campo === 'responsable' ? 'Responsable' : 'Personas'} de tarea ${fila.tarea}, OM ${fila.numero}`}
                          aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
                          onChange={event => actualizar(fila.numero, campo, event.target.value)}
                          onBlur={() => setRevisados(previos => ({ ...previos, [id]: true }))}
                        />
                        {error && <p id={`${id}-error`} className="error-campo">{error}</p>}
                      </td>
                    )
                  })}
                </tr>
              ))}</tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}
