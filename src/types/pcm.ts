// Contrato v1.3. Los datos importados se copian a cada propuesta: nunca son referencias mutables.
export type Rol = 'Planificador' | 'Taller' | 'Supervisor Taller' | 'Administrador' | 'Consulta'
export type Actor = { id: string; nombre: string; rol: Rol }
export type TipoCatalogo = 'remolcadores' | 'ubicaciones' | 'responsables'
export type EntradaCatalogo = { id: string; nombre: string; activo: boolean; externo: boolean }
export type Catalogos = Record<TipoCatalogo, EntradaCatalogo[]>
export type Orden = { numero: string; estado: string; valor: number | null }
export type TareaFuente = {
  id: string
  descripcion: string
  tiempoOriginal: number | null
  criticidad: string
  estado: string
  ordenes: Orden[]
}
export type FilaPropuesta = TareaFuente & {
  tiempoPropuesto: string
  trabajadores: string
  responsableId: string
}
export type Estado = 'Borrador' | 'Enviado a Taller' | 'En evaluación' | 'Evaluado' | 'En reevaluación' | 'Confirmada' | 'Cancelada'
export type Evaluacion = {
  resultado: 'Aceptada' | 'Rechazada'
  motivo: string
  usuario: string
  fecha: string
  usuarioId?: string
  versionTarea?: number
  tiempoAceptado?: string
  trabajadoresAceptados?: string
}
export type Firma = { usuarioId: string; usuario: string; rol: Rol; fecha: string }
export type ResolucionPCM = Firma & { tipo: 'Tercerizada' | 'Eliminada' | 'Devuelta a revisión'; versionTarea: number }
export type CorreccionPCM = Pick<FilaPropuesta, 'descripcion' | 'criticidad' | 'tiempoPropuesto' | 'trabajadores' | 'responsableId'>
export type DecisionPCM = { tareaId: string; tipo: ResolucionPCM['tipo']; correccion?: CorreccionPCM; confirmada?: boolean }
export type RevisionTarea = {
  version: number
  responsableOriginalId: string
  resolucion?: ResolucionPCM
  resoluciones: ResolucionPCM[]
  evaluaciones: Evaluacion[]
  versiones: (Firma & { version: number; fila: FilaPropuesta; campos: string[] })[]
}
export type ConflictoPCM = {
  id: string; tareaId: string; otroPlanId?: string; detalle: string; fecha: string
  estado: 'Pendiente de reprogramación'
  reconocimiento?: Firma
}
export type RevisionPCM = {
  esquema: 1
  versionContenido: number
  versionEvaluada: number | null
  tareas: Record<string, RevisionTarea>
  conflictos: ConflictoPCM[]
  confirmacion?: Firma & { version: number; conAdvertencias: boolean }
  cancelacion?: Firma & { motivo: string }
}
export type Plan = {
  id: string
  tag: string
  version: number
  estado: Estado
  remolcadorId: string
  ubicacionId: string
  eta: string
  // eta sigue siendo la ETA final operativa para compatibilidad con todas las vistas.
  etaInicial?: string
  origenEtaInicial?: 'creacion' | 'heredada' | 'sin-dato'
  historialEta?: CambioEta[]
  horasParada: string
  planificador: string
  planificadorId: string
  actualizado: string
  enviado: string | null
  filas: FilaPropuesta[]
  // Nombres congelados al enviar; un catálogo puede editarse o desactivarse después.
  referencias: Record<string, EntradaCatalogo>
  evaluaciones: Record<string, Evaluacion>
  revisionPCM?: RevisionPCM
}
export type CambioEta = {
  fecha: string
  usuarioId: string
  usuario: string
  anterior: string
  nuevo: string
  comentario: string
  revisionDisponibilidad: 'pendiente'
  rol?: Rol
}
export type Evento = {
  fecha: string
  usuario: string
  accion: string
  entidad: string
  anterior: unknown
  nuevo: unknown
  usuarioId?: string
  rol?: Rol
  planId?: string
  tareaId?: string
}
export type Importacion = {
  id: string
  fecha: string
  procedencia: string
  usuario: string
  tareas: TareaFuente[]
  diferencias: string[]
}
export type Registro = {
  esquema: 13
  revision: number
  contador: number
  catalogos: Catalogos
  fuente: TareaFuente[]
  importaciones: Importacion[]
  planes: Plan[]
  historial: Evento[]
  solicitudes: Record<string, number>
}
export type Comando =
  | { tipo: 'guardar'; plan: Plan; enviar: boolean }
  | { tipo: 'cambiarEta'; planId: string; version: number; eta: string; comentario: string }
  | { tipo: 'catalogo'; catalogo: TipoCatalogo; entrada: EntradaCatalogo }
  | { tipo: 'importar'; procedencia: string; tareas: TareaFuente[] }
  | { tipo: 'evaluar'; planId: string; tareaId: string; resultado: 'Aceptada' | 'Rechazada'; motivo: string; version?: number; tiempoAceptado?: string; trabajadoresAceptados?: string }
  | { tipo: 'finalizar'; planId: string; version?: number }
  | { tipo: 'guardarRevision'; planId: string; version: number; decisiones: DecisionPCM[] }
  | { tipo: 'confirmarPCM'; planId: string; version: number; reconocerConflictos: boolean }
  | { tipo: 'cancelarPCM'; planId: string; version: number; motivo: string; confirmada: boolean }
