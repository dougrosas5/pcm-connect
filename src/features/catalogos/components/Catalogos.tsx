import { useState } from 'react'
import type { Catalogos as DatosCatalogos, Comando, EntradaCatalogo, TipoCatalogo } from '../../../types/pcm'

const nombres: Record<TipoCatalogo, string> = {
  remolcadores: 'Remolcadores',
  ubicaciones: 'Ubicaciones',
  responsables: 'Responsables'
}
export default function Catalogos({
  catalogos,
  administrar,
  ocupado,
  ejecutar,
  tipoInicial = 'remolcadores'
}: {
  catalogos: DatosCatalogos
  administrar: boolean
  ocupado: boolean
  ejecutar: (c: Comando) => Promise<boolean>
  tipoInicial?: TipoCatalogo
}) {
  const [tipo, setTipo] = useState<TipoCatalogo>(tipoInicial)
  const [entrada, setEntrada] = useState<EntradaCatalogo>({
    id: '',
    nombre: '',
    activo: true,
    externo: false
  })
  function limpiar() {
    setEntrada({ id: '', nombre: '', activo: true, externo: false })
  }
  return (
    <section className="m1-panel" aria-labelledby="catalogos-titulo">
      <h2 id="catalogos-titulo">Administración de catálogos</h2>
      <p className="ayuda">
        Las entradas inactivas se conservan en el historial y se excluyen de nuevas selecciones.
      </p>
      <label className="m1-campo">
        Catálogo
        <select
          value={tipo}
          onChange={(e) => {
            setTipo(e.target.value as TipoCatalogo)
            limpiar()
          }}
        >
          {Object.entries(nombres).map(([k, n]) => (
            <option key={k} value={k}>
              {n}
            </option>
          ))}
        </select>
      </label>
      {!administrar && (
        <p className="m1-nota">Solo los administradores pueden editar el catálogo.</p>
      )}
      {administrar && (
        <form
          className="m1-form-catalogo"
          onSubmit={async (e) => {
            e.preventDefault()
            if (
              await ejecutar({
                tipo: 'catalogo',
                catalogo: tipo,
                entrada: { ...entrada, id: entrada.id || crypto.randomUUID() }
              })
            )
              limpiar()
          }}
        >
          <label className="m1-campo">
            Nombre
            <input
              required
              maxLength={160}
              value={entrada.nombre}
              onChange={(e) => setEntrada({ ...entrada, nombre: e.target.value })}
            />
          </label>
          {tipo === 'responsables' && (
            <label className="m1-check">
              <input
                type="checkbox"
                checked={entrada.externo}
                onChange={(e) => setEntrada({ ...entrada, externo: e.target.checked })}
              />
              Ejecución externa
            </label>
          )}
          <button className="boton-primario" disabled={ocupado}>
            {entrada.id ? 'Guardar entrada' : 'Registrar entrada'}
          </button>
          {entrada.id && (
            <button type="button" className="boton-secundario" onClick={limpiar}>
              Cancelar edición
            </button>
          )}
        </form>
      )}
      <div
        className="tabla-contenedor"
        tabIndex={0}
        role="region"
        aria-label={`Catálogo de ${nombres[tipo]}`}
      >
        <table className="m1-catalogo">
          <thead>
            <tr>
              <th scope="col">Nombre</th>
              <th scope="col">Estado</th>
              {tipo === 'responsables' && <th scope="col">Ejecución</th>}
              {administrar && <th scope="col">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {catalogos[tipo].map((e) => (
              <tr key={e.id}>
                <th scope="row">{e.nombre}</th>
                <td>{e.activo ? 'Activa' : 'Inactiva'}</td>
                {tipo === 'responsables' && <td>{e.externo ? 'Externa' : 'Taller interno'}</td>}
                {administrar && (
                  <td className="m1-acciones">
                    <button
                      className="boton-secundario"
                      disabled={ocupado}
                      aria-label={`Editar ${e.nombre}`}
                      onClick={() => setEntrada({ ...e })}
                    >
                      Editar
                    </button>
                    <button
                      className="boton-secundario"
                      disabled={ocupado}
                      aria-label={`${e.activo ? 'Desactivar' : 'Activar'} ${e.nombre}`}
                      onClick={() =>
                        ejecutar({ tipo: 'catalogo', catalogo: tipo, entrada: { ...e, activo: !e.activo } })
                      }
                    >
                      {e.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!catalogos[tipo].length && (
        <p className="estado-vacio">
          No hay registros en este catálogo.
        </p>
      )}
    </section>
  )
}
