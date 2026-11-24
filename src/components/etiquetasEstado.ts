import type { Estado } from '../types/pcm'

// Etiquetas de pantalla. Los filtros y registros usan los estados originales.
export const etiquetaPlan: Record<Estado, string> = {
  Borrador: 'Borrador',
  'Enviado a Taller': 'Solicitada',
  'En evaluación': 'En evaluación',
  Evaluado: 'Evaluada',
  'En reevaluación': 'En reevaluación',
  Confirmada: 'Confirmada',
  Cancelada: 'Cancelada'
}

export function etiquetaRevision(estado: string) {
  if (estado === 'Pendiente de revisión PCM') return 'En revisión'
  return Object.hasOwn(etiquetaPlan, estado) ? etiquetaPlan[estado as Estado] : estado
}
