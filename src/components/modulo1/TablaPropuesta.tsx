import { elegibles, mismaFuente, moneda, positivo, valorTotal } from '../../features/modulo1/modelo'
import type { EntradaCatalogo, FilaPropuesta, Plan, Registro } from '../../features/modulo1/modelo'

export function SelectorCatalogo({
  etiqueta,
  entradas,
  valor,
  cambiar,
  bloqueado = false
}: {
  etiqueta: string
  entradas: EntradaCatalogo[]
  valor: string
  cambiar: (valor: string) => void
  bloqueado?: boolean
}) {
  return (
    <select
      aria-label={etiqueta}
      value={valor}
      disabled={bloqueado}
      onChange={(e) => cambiar(e.target.value)}
    >
      <option value="">Seleccionar</option>
      {entradas
        .filter((e) => e.activo || e.id === valor)
        .map((e) => (
          <option key={e.id} value={e.id} disabled={!e.activo}>
            {e.nombre}
            {e.activo ? '' : ' (inactiva)'}
          </option>
        ))}
    </select>
  )
}
export default function TablaPropuesta({
  plan,
  registro,
  editable,
  cambiar
}: {
  plan: Plan
  registro: Registro
  editable: boolean
  cambiar: (plan: Plan) => void
}) {
  function editar(id: string, datos: Partial<FilaPropuesta>) {
    cambiar({ ...plan, filas: plan.filas.map((f) => (f.id === id ? { ...f, ...datos } : f)) })
  }
  function mover(i: number, delta: number) {
    const filas = [...plan.filas]
    ;[filas[i], filas[i + delta]] = [filas[i + delta], filas[i]]
    cambiar({ ...plan, filas })
  }
  if (!plan.filas.length)
    return (
      <p className="estado-vacio">
        La propuesta está vacía. Importá una fuente y agregá identificadores de TAREA o PM. Solo se incorporan
        OM con «Valor aprobado».
      </p>
    )
  return (
    <div
      className="tabla-contenedor"
      tabIndex={0}
      role="region"
      aria-label="Tareas propuestas; desplazamiento horizontal disponible"
    >
      <table className="tabla-tareas m1-tabla">
        <caption>
          Propuesta PCM · {plan.filas.length} tareas/PM · Los valores monetarios corresponden a las OM
          incluidas.
        </caption>
        <thead>
          <tr>
            {[
              'TAREA / PM',
              'N.º de OM',
              'Valor total (Gs.)',
              'Descripción',
              'Tiempo (h)',
              'Trabajadores',
              'Criticidad',
              'Responsable',
              'Estado',
              'Acciones'
            ].map((t) => (
              <th key={t} scope="col">
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {plan.filas.map((f, i) => {
            const fuente = registro.fuente.find((t) => t.id === f.id)
            const cambioFuente = !fuente || !mismaFuente({ ...fuente, ordenes: elegibles(fuente) }, f)
            const responsable =
              plan.referencias[f.responsableId] ??
              registro.catalogos.responsables.find((e) => e.id === f.responsableId)
            const supera = positivo(plan.horasParada) && Number(f.tiempoPropuesto) > Number(plan.horasParada)
            return (
              <tr key={f.id}>
                <th scope="row">{f.id}</th>
                <td>
                  <ul className="m1-oms">
                    {f.ordenes.map((o) => (
                      <li key={o.numero}>{o.numero}</li>
                    ))}
                  </ul>
                </td>
                <td className="numero">{moneda(valorTotal(f.ordenes))}</td>
                <td className="descripcion-trabajo">
                  {f.descripcion || 'Completar en la fuente'}
                  {cambioFuente && (
                    <p className="m1-advertencia">
                      La fuente cambió. Esta fila conserva la versión incorporada.
                    </p>
                  )}
                </td>
                <td>
                  <input
                    aria-label={`Tiempo propuesto de ${f.id}`}
                    type="number"
                    min="0"
                    step="any"
                    value={f.tiempoPropuesto}
                    disabled={!editable}
                    aria-invalid={f.tiempoPropuesto !== '' && !positivo(f.tiempoPropuesto)}
                    onChange={(e) => editar(f.id, { tiempoPropuesto: e.target.value })}
                  />
                  <small className="m1-original">Original: {f.tiempoOriginal ?? 'Sin definir'} h</small>
                  {supera && (
                    <p className="m1-advertencia">Supera la parada. Advertencia; no bloquea el envío.</p>
                  )}
                </td>
                <td>
                  <input
                    aria-label={`Trabajadores propuestos de ${f.id}`}
                    type="number"
                    min="1"
                    step="1"
                    value={f.trabajadores}
                    disabled={!editable}
                    onChange={(e) => editar(f.id, { trabajadores: e.target.value })}
                  />
                </td>
                <td>{f.criticidad || 'Sin definir'}</td>
                <td>
                  {editable ? (
                    <SelectorCatalogo
                      etiqueta={`Responsable de ${f.id}`}
                      entradas={registro.catalogos.responsables}
                      valor={f.responsableId}
                      cambiar={(v) => editar(f.id, { responsableId: v })}
                    />
                  ) : (
                    (responsable?.nombre ?? 'Sin definir')
                  )}
                  {responsable?.externo && <small className="m1-original">Ejecución externa</small>}
                </td>
                <td>
                  <span className="estado">{f.estado || 'Sin definir'}</span>
                </td>
                <td>
                  <div className="m1-acciones-fila">
                    <button
                      className="boton-secundario"
                      disabled={!editable || i === 0}
                      aria-label={`Subir ${f.id}`}
                      onClick={() => mover(i, -1)}
                    >
                      Subir
                    </button>
                    <button
                      className="boton-secundario"
                      disabled={!editable || i === plan.filas.length - 1}
                      aria-label={`Bajar ${f.id}`}
                      onClick={() => mover(i, 1)}
                    >
                      Bajar
                    </button>
                    <button
                      className="boton-secundario"
                      disabled={!editable}
                      aria-label={`Quitar ${f.id}`}
                      onClick={() => cambiar({ ...plan, filas: plan.filas.filter((t) => t.id !== f.id) })}
                    >
                      Quitar
                    </button>
                  </div>
                  {cambioFuente && editable && fuente && elegibles(fuente).length > 0 && (
                    <button
                      className="boton-secundario"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Actualizar ${f.id} con la última fuente? Se conservarán el tiempo propuesto, trabajadores y responsable. El tiempo original y las OM se actualizarán. Los valores anteriores permanecen en el historial guardado.`
                          )
                        )
                          editar(f.id, {
                            ...structuredClone(fuente),
                            ordenes: structuredClone(elegibles(fuente))
                          })
                      }}
                    >
                      Actualizar fuente de {f.id}
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
