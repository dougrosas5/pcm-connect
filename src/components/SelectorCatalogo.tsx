import type { EntradaCatalogo } from '../types/pcm'

export default function SelectorCatalogo({
  etiqueta,
  entradas,
  valor,
  cambiar,
  id,
  bloqueado = false
}: {
  etiqueta: string
  entradas: EntradaCatalogo[]
  valor: string
  cambiar: (valor: string) => void
  id?: string
  bloqueado?: boolean
}) {
  return (
    <select
      id={id}
      aria-label={etiqueta}
      value={valor}
      disabled={bloqueado}
      onChange={(e) => cambiar(e.target.value)}
    >
      <option value="">{entradas.some(e => e.activo) ? 'Seleccionar' : 'Sin opciones activas'}</option>
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
