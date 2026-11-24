import type { Registro } from '../../../types/pcm'
import { mostrarFecha } from '../model/modelo'

export default function HistorialImportaciones({ importaciones }: { importaciones: Registro['importaciones'] }) {
  if (!importaciones.length) return null
  return <details>
    <summary>Historial de importaciones ({importaciones.length})</summary>
    <ol className="m1-lista-historial">{[...importaciones].reverse().map(i => <li key={i.id}>
      <strong>{i.procedencia}</strong> · {mostrarFecha(i.fecha)} · {i.usuario}
      <ul>{i.diferencias.length ? i.diferencias.map((d, n) => <li key={n}>{d}</li>) : <li>Sin cambios en la fuente.</li>}</ul>
    </li>)}</ol>
  </details>
}
