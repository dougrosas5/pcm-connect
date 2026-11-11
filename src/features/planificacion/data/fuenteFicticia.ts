import type { TareaFuente } from '../../../types/pcm.ts'

// Ejemplo optativo, rotulado como ficticio en el control que lo carga y en la procedencia.
export const fuenteFicticia: TareaFuente[] = [
  {
    id: 'DEMO-1001',
    descripcion: 'Ejemplo ficticio · mantenimiento de bomba',
    tiempoOriginal: 3,
    criticidad: 'Alta',
    estado: 'Abierta',
    ordenes: [
      { numero: 'DEMO-OM-001', estado: 'Valor aprobado', valor: 370000 },
      { numero: 'DEMO-OM-002', estado: 'Valor aprobado', valor: 350000 },
      { numero: 'DEMO-OM-003', estado: 'Cerrada', valor: 220000 }
    ]
  },
  {
    id: 'DEMO-PM-02',
    descripcion: 'Ejemplo ficticio · revisión de tablero',
    tiempoOriginal: 5,
    criticidad: 'Media',
    estado: 'Programada',
    ordenes: [{ numero: 'DEMO-OM-004', estado: 'Valor aprobado', valor: 250000 }]
  }
]
