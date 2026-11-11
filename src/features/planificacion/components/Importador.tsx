import { useState } from 'react'
import { diferenciasFuente, mostrarFecha } from '../model/modelo'
import type { Comando, Registro, TareaFuente } from '../../../types/pcm'
import { descargarPlantilla, importarArchivo } from '../services/importacion'
import { fuenteFicticia } from '../data/fuenteFicticia'

export default function Importador({
  registro,
  permitido,
  ocupado,
  ejecutar
}: {
  registro: Registro
  permitido: boolean
  ocupado: boolean
  ejecutar: (c: Comando) => Promise<boolean>
}) {
  const [previa, setPrevia] = useState<{
    tareas: TareaFuente[]
    avisos: string[]
    procedencia: string
  } | null>(null)
  const [error, setError] = useState('')
  const [leyendo, setLeyendo] = useState(false)
  const ultima = registro.importaciones.at(-1)
  return (
    <section className="m1-panel m1-importacion" aria-label="Fuente de tareas y PM">
      <div className="m1-encabezado">
        <div>
          <h2>Base de tareas y PM</h2>
          <p className="ayuda">
            {ultima
              ? `Última importación: ${mostrarFecha(ultima.fecha)} · ${ultima.procedencia} · ${ultima.usuario}`
              : 'Sin importaciones. Cargá una fuente para buscar tareas o PM.'}
          </p>
        </div>
        <button className="boton-secundario" onClick={descargarPlantilla}>
          Descargar plantilla CSV
        </button>
      </div>
      {permitido && (
        <details>
          <summary>Actualizar desde Excel o CSV</summary>
          <p className="ayuda">
            Primera hoja del .xlsx, hasta 20.000 filas y 10 MB. Una fila por OM; datos comunes iguales para
            cada tarea. Identificadores como texto; números sin separadores de miles. La plantilla indica las
            ocho columnas necesarias.
          </p>
          <div className="m1-acciones">
            <label className="m1-campo">
              Archivo de origen
              <input
                type="file"
                accept=".xlsx,.csv"
                disabled={ocupado || leyendo}
                onChange={async (e) => {
                  const archivo = e.target.files?.[0]
                  if (!archivo) return
                  setLeyendo(true)
                  setError('')
                  setPrevia(null)
                  try {
                    setPrevia({ ...(await importarArchivo(archivo)), procedencia: archivo.name })
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'No se pudo leer el archivo.')
                  } finally {
                    setLeyendo(false)
                    e.target.value = ''
                  }
                }}
              />
            </label>
            <button
              className="boton-secundario"
              disabled={ocupado || leyendo}
              onClick={() => {
                setError('')
                setPrevia({
                  tareas: structuredClone(fuenteFicticia),
                  avisos: ['Estos datos son completamente ficticios.'],
                  procedencia: 'EJEMPLO FICTICIO · Sin datos operativos'
                })
              }}
            >
              Preparar ejemplo ficticio
            </button>
          </div>
          {leyendo && <p role="status">Leyendo archivo…</p>}
          {error && (
            <p className="m1-error" role="alert">
              {error}
            </p>
          )}
          {previa && (
            <div className="m1-preview">
              <h3>Revisar importación · {previa.procedencia}</h3>
              <p>
                {previa.tareas.length} tareas/PM. Las propuestas guardadas y enviadas conservan sus
                instantáneas.
              </p>
              <ul>
                {previa.avisos.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
                {diferenciasFuente(registro.fuente, previa.tareas).map((a, i) => (
                  <li key={`d${i}`}>{a}</li>
                ))}
              </ul>
              {!diferenciasFuente(registro.fuente, previa.tareas).length && (
                <p>Sin diferencias. Reimportar registra la procedencia y no duplica tareas ni OM.</p>
              )}
              <div className="m1-acciones">
                <button
                  className="boton-primario"
                  disabled={ocupado}
                  onClick={async () => {
                    if (
                      await ejecutar({
                        tipo: 'importar',
                        procedencia: previa.procedencia,
                        tareas: previa.tareas
                      })
                    )
                      setPrevia(null)
                  }}
                >
                  Confirmar importación
                </button>
                <button className="boton-secundario" onClick={() => setPrevia(null)} disabled={ocupado}>
                  Cancelar importación
                </button>
              </div>
            </div>
          )}
        </details>
      )}
      {!!registro.importaciones.length && (
        <details>
          <summary>Historial de importaciones ({registro.importaciones.length})</summary>
          <ol className="m1-lista-historial">
            {[...registro.importaciones].reverse().map((i) => (
              <li key={i.id}>
                <strong>{i.procedencia}</strong> · {mostrarFecha(i.fecha)} · {i.usuario}
                <ul>
                  {i.diferencias.length ? (
                    i.diferencias.map((d, n) => <li key={n}>{d}</li>)
                  ) : (
                    <li>Sin diferencias respecto de la fuente anterior.</li>
                  )}
                </ul>
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  )
}
