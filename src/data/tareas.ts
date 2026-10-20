type Estado = 'Abierta' | 'Cerrada'

export const responsablesPreparacion = ['Douglas', 'Ale', 'Pepe'] as const

export type OrdenMantenimiento = {
  numero: string
  descripcion: string
  estado: Estado
  horasPrevistas: number
  criticidad?: 'Baja' | 'Media' | 'Alta'
  // Guaraníes (PYG); ausente significa costo desconocido, no cero.
  costo?: number
}

export type Tarea = {
  numero: string
  descripcion: string
  area: string
  estado: Estado
  horasPrevistas: number
  ordenesMantenimiento: OrdenMantenimiento[]
}

// Datos totalmente ficticios. La duración común procede de la tarea;
// no representan horas-persona ni una regla del sistema corporativo.
// Las horas históricas de las OM se conservan para leer borradores anteriores.
// Costos referenciales en guaraníes (PYG), no cotizaciones de las OM ficticias.
// Fuentes y supuestos: docs/COSTOS_ESTIMADOS_PYG.md (17/10/2026).
export const tareasDemo: Tarea[] = [
  {
    numero: '1001', area: 'Taller mecánico', estado: 'Abierta', horasPrevistas: 3,
    descripcion: 'Mantenimiento de bomba hidráulica',
    ordenesMantenimiento: [
      { numero: 'OM-001', descripcion: 'Reemplazar sello de bomba auxiliar', estado: 'Abierta', horasPrevistas: 3, costo: 370000 },
      { numero: 'OM-002', descripcion: 'Alinear acoplamiento del motor', estado: 'Abierta', horasPrevistas: 2, costo: 350000 },
    ],
  },
  {
    numero: '1002', area: 'Taller mecánico', estado: 'Cerrada', horasPrevistas: 2,
    descripcion: 'Mantenimiento del ventilador auxiliar',
    ordenesMantenimiento: [
      { numero: 'OM-003', descripcion: 'Inspeccionar rodamientos del ventilador', estado: 'Cerrada', horasPrevistas: 2, costo: 220000 },
    ],
  },
  {
    numero: '1003', area: 'Taller eléctrico', estado: 'Abierta', horasPrevistas: 1.5,
    descripcion: 'Inspección del tablero eléctrico',
    ordenesMantenimiento: [
      { numero: 'OM-004', descripcion: 'Verificar protecciones del tablero eléctrico', estado: 'Abierta', horasPrevistas: 1.5, costo: 250000 },
      { numero: 'OM-005', descripcion: 'Cambiar contactor del circuito auxiliar', estado: 'Cerrada', horasPrevistas: 2, costo: 320000 },
    ],
  },
  {
    numero: '1004', area: 'Instrumentación', estado: 'Abierta', horasPrevistas: 1,
    descripcion: 'Revisión de instrumentación de presión',
    ordenesMantenimiento: [
      { numero: 'OM-006', descripcion: 'Calibrar transmisor de presión', estado: 'Cerrada', horasPrevistas: 1, costo: 250000 },
    ],
  },
  {
    numero: '0010-A', area: 'Servicios auxiliares', estado: 'Abierta', horasPrevistas: 4,
    descripcion: 'Mantenimiento del circuito de agua de servicio',
    ordenesMantenimiento: [
      { numero: 'OM-007', descripcion: 'Revisar circuito de agua de servicio', estado: 'Abierta', horasPrevistas: 4, costo: 450000 },
    ],
  },
]
