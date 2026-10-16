export type Tarea = {
    numero: string
    area: string
    horas: number
    criticidad: 'Baja' | 'Media' | 'Alta'
    estado: 'Abierta' | 'Cerrada'
    ordenesMantenimiento: string[]
}

export const tareasDemo: Tarea[] = [
    {
        numero: '1001',
        area: 'Taller mecanico',
        horas: 3,
        criticidad: 'Baja',
        estado: 'Abierta',
        ordenesMantenimiento: ['OM-001', 'OM-002'],
    },
    {
        numero: '1002',
        area: 'Taller mecanico',
        horas: 2,
        criticidad: 'Baja',
        estado: 'Cerrada',
        ordenesMantenimiento: ['OM-003'],
    },
]
