import { useState } from 'react'
import { diferenciasFuente, mostrarFecha } from '../model/modelo'
import type { Comando, Registro, TareaFuente } from '../../../types/pcm'
import { descargarPlantilla, importarArchivo } from '../services/importacion'
import { fuenteFicticia } from '../data/fuenteFicticia'
import Icono from '../../../components/Icono'
import HistorialImportaciones from './HistorialImportaciones'

export default function Importador({
  registro,
  permitido,
  ocupado,
  ejecutar,
  compacto = false
}: {
  registro: Registro
  permitido: boolean
  ocupado: boolean
  ejecutar: (c: Comando) => Promise<boolean>
  compacto?: boolean
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
    <section className={compacto ? 'm1-importacion importador-compacto' : 'm1-panel m1-importacion'} aria-label="Fuente de tareas">
      <div className="m1-encabezado">
        <div>
          {!compacto && <h2>Fuente de tareas</h2>}
          {compacto && <strong className="fuente-excel"><span aria-hidden="true">X</span> Excel / CSV</strong>}
          <p className="ayuda">
            {ultima
              ? `Última importación: ${mostrarFecha(ultima.fecha)} · ${ultima.procedencia} · ${ultima.usuario}`
              : 'Sin importaciones. Importá un archivo para buscar tareas.'}
          </p>
        </div>
        {!compacto && <button className="boton-secundario" onClick={descargarPlantilla}>
          Descargar plantilla CSV
        </button>}
      </div>
      {permitido && (
        <details>
          <summary><Icono nombre="actualizar" />Importar archivo</summary>
          <p className="ayuda">
            Usá la plantilla de ocho columnas. Cargá una fila por OM y repetí los datos comunes de cada TAREA/PM.
            Indicá los códigos como texto y los números sin separadores de miles. Máximo 10 MB y 20.000 filas.
            En Excel se lee la primera hoja.
          </p>
          <div className="m1-acciones">
            {compacto && <button className="boton-secundario" onClick={descargarPlantilla}>Descargar plantilla CSV</button>}
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
                  avisos: ['Datos ficticios para pruebas.'],
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
              <h3>Vista previa · {previa.procedencia}</h3>
              <p>
                {previa.tareas.length} {previa.tareas.length === 1 ? 'tarea' : 'tareas'}. La importación no modifica las propuestas guardadas.
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
                <p>Sin cambios en la fuente. Si confirmás, se registra la importación sin duplicar tareas ni OM.</p>
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
          <HistorialImportaciones importaciones={registro.importaciones} />
        </details>
      )}
      {!permitido && <HistorialImportaciones importaciones={registro.importaciones} />}
    </section>
  )
}
