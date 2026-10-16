type Estado = 'Abierta' | 'Cerrada'

export type OrdenMantenimiento = {
  numero: string
  estado: Estado
  horasPrevistas: number
  criticidad?: 'Baja' | 'Media' | 'Alta'
  costo?: string
}

export type Tarea = {
  numero: string
  area: string
  estado: Estado
  ordenesMantenimiento: OrdenMantenimiento[]
}

// Datos totalmente ficticios. Duraciones por OM solo para esta demo;
// no representan horas-persona ni una regla del sistema corporativo.
export const tareasDemo: Tarea[] = [
  {
    numero: '1001', area: 'Taller mecánico', estado: 'Abierta',
    ordenesMantenimiento: [
      { numero: 'OM-001', estado: 'Abierta', horasPrevistas: 3 },
      { numero: 'OM-002', estado: 'Abierta', horasPrevistas: 2 },
    ],
  },
  {
    numero: '1002', area: 'Taller mecánico', estado: 'Cerrada',
    ordenesMantenimiento: [
      { numero: 'OM-003', estado: 'Cerrada', horasPrevistas: 2 },
    ],
  },
  {
    numero: '1003', area: 'Taller eléctrico', estado: 'Abierta',
    ordenesMantenimiento: [
      { numero: 'OM-004', estado: 'Abierta', horasPrevistas: 1.5 },
      { numero: 'OM-005', estado: 'Cerrada', horasPrevistas: 2 },
    ],
  },
  {
    numero: '1004', area: 'Instrumentación', estado: 'Abierta',
    ordenesMantenimiento: [
      { numero: 'OM-006', estado: 'Cerrada', horasPrevistas: 1 },
    ],
  },
  {
    numero: '0010-A', area: 'Servicios auxiliares', estado: 'Abierta',
    ordenesMantenimiento: [
      { numero: 'OM-007', estado: 'Abierta', horasPrevistas: 4 },
    ],
  },
]
