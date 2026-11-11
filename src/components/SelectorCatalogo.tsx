import type { EntradaCatalogo } from '../types/pcm'

export default function SelectorCatalogo({
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
