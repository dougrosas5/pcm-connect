import type { Actor, Orden, Plan, Registro, TareaFuente } from '../../../types/pcm.ts'

export const zonaHoraria = 'America/Montevideo'
export const responsablesIniciales = [
  'TALLER MECÁNICO',
  'TALLER ELECTRICISTA',
  'TALLER SOLDADOR',
  'TALLER REFRIGERACIÓN',
  'TALLER ELECTRÓNICO',
  'TALLER ELECTROMECÁNICO',
  'TERCERIZADO'
]
export function registroInicial(): Registro {
  return {
    esquema: 13,
    revision: 0,
    contador: 0,
    catalogos: {
      remolcadores: [],
      ubicaciones: [],
      responsables: responsablesIniciales.map((nombre, i) => ({
        id: `responsable-${i + 1}`,
        nombre,
        activo: true,
        externo: nombre === 'TERCERIZADO'
      }))
    },
    fuente: [],
    importaciones: [],
    planes: [],
    historial: [],
    solicitudes: {}
  }
}
export function nuevoPlan(actor: Actor, id: string): Plan {
  return {
    id,
    tag: '',
    version: 0,
    estado: 'Borrador',
    remolcadorId: '',
    ubicacionId: '',
    eta: '',
    horasParada: '',
    planificador: actor.nombre,
    planificadorId: actor.id,
    actualizado: '',
    enviado: null,
    filas: [],
    referencias: {},
    evaluaciones: {}
  }
}
// Montevideo usa UTC−03:00. Se fija el desplazamiento al ingresar, sin depender del equipo.
export function etaDesdeInput(valor: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/u.test(valor)) return ''
  const fecha = new Date(`${valor}:00-03:00`)
  return Number.isFinite(fecha.getTime()) && inputDesdeEta(fecha.toISOString()) === valor
    ? fecha.toISOString()
    : ''
}
export function inputDesdeEta(eta: string): string {
  const fecha = new Date(eta)
  return Number.isFinite(fecha.getTime())
    ? new Date(fecha.getTime() - 3 * 3600000).toISOString().slice(0, 16)
    : ''
}
export function finParada(plan: Pick<Plan, 'eta' | 'horasParada'>): string {
  const fecha = Date.parse(plan.eta) + Number(plan.horasParada) * 3600000
  return plan.eta && positivo(plan.horasParada) && Number.isFinite(fecha) && Math.abs(fecha) <= 8.64e15
    ? new Date(fecha).toISOString()
    : ''
}
export function etaValida(eta: string): boolean {
  const tiempo = Date.parse(eta)
  return Number.isFinite(tiempo) && new Date(tiempo).toISOString() === eta
}
export function mostrarFecha(fecha: string): string {
  return fecha && Number.isFinite(Date.parse(fecha))
    ? new Intl.DateTimeFormat('es-UY', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: zonaHoraria
      }).format(new Date(fecha))
    : 'Sin definir'
}
export function positivo(valor: string) {
  return valor.trim() !== '' && Number.isFinite(Number(valor)) && Number(valor) > 0
}
export function enteroPositivo(valor: string) {
  return /^\d+$/u.test(valor) && Number.isSafeInteger(Number(valor)) && Number(valor) > 0
}
export function elegibles(tarea: TareaFuente): Orden[] {
  return tarea.ordenes.filter((om) => om.estado.trim().toLocaleLowerCase('es') === 'valor aprobado')
}
export function valorTotal(ordenes: Orden[]): number | null {
  const unicas = [...new Map(ordenes.map((om) => [om.numero, om])).values()]
  return unicas.length && unicas.every((om) => om.valor !== null)
    ? Math.round(unicas.reduce((suma, om) => suma + om.valor!, 0) * 100) / 100
    : null
}
export function instantaneaFuente(tarea: TareaFuente): TareaFuente {
  return {
    id: tarea.id,
    descripcion: tarea.descripcion,
    tiempoOriginal: tarea.tiempoOriginal,
    criticidad: tarea.criticidad,
    estado: tarea.estado,
    ordenes: tarea.ordenes
      .map((o) => ({ numero: o.numero, estado: o.estado, valor: o.valor }))
      .sort((a, b) => a.numero.localeCompare(b.numero))
  }
}
export function mismaFuente(a: TareaFuente, b: TareaFuente): boolean {
  return JSON.stringify(instantaneaFuente(a)) === JSON.stringify(instantaneaFuente(b))
}
export function moneda(valor: number | null): string {
  return valor === null
    ? 'Sin definir'
    : new Intl.NumberFormat('es-PY', { maximumFractionDigits: 2 }).format(valor)
}
export function diferenciasFuente(anterior: TareaFuente[], nueva: TareaFuente[]): string[] {
  const cambios: string[] = []
  for (const tarea of anterior)
    if (!nueva.some((t) => t.id === tarea.id)) cambios.push(`${tarea.id}: ya no está en la importación.`)
  for (const tarea of nueva) {
    const previa = anterior.find((t) => t.id === tarea.id)
    if (!previa) cambios.push(`${tarea.id}: nueva tarea/PM.`)
    else if (!mismaFuente(previa, tarea))
      cambios.push(`${tarea.id}: cambiaron datos, valores, estados o vínculos de OM.`)
  }
  return cambios
}
export function agregarTareas(
  plan: Plan,
  entrada: string,
  registro: Registro
): { plan: Plan; avisos: string[] } {
  const filas = [...plan.filas]
  const avisos: string[] = []
  const vistos = new Set<string>()
  const ids = entrada.split(/[,;\s]+/u).filter(Boolean)
  if (!ids.length) avisos.push('Ingresá al menos un código de TAREA/PM.')
  for (const id of ids) {
    if (vistos.has(id) || filas.some((f) => f.id === id)) {
      avisos.push(`${id}: ya está en la propuesta. Se conservan los cambios.`)
      continue
    }
    vistos.add(id)
    const tarea = registro.fuente.find((t) => t.id === id)
    if (!tarea) {
      avisos.push(`${id}: no se encontró en la última importación.`)
      continue
    }
    const ordenes = elegibles(tarea)
    if (!ordenes.length) {
      avisos.push(`${id}: no tiene OM con estado «Valor aprobado».`)
      continue
    }
    const conflicto = registro.planes.find(
      (p) =>
        p.id !== plan.id &&
        p.filas.some(
          (f) => p.estado !== 'Cancelada' && p.revisionPCM?.tareas[f.id]?.resolucion?.tipo !== 'Eliminada' &&
            (f.id === id || f.ordenes.some((om) => ordenes.some((o) => o.numero === om.numero)))
        )
    )
    if (conflicto) {
      avisos.push(`${id}: la tarea o una de sus OM ya figura en ${conflicto.tag}.`)
      continue
    }
    if (filas.some((f) => f.ordenes.some((om) => ordenes.some((o) => o.numero === om.numero)))) {
      avisos.push(`${id}: tiene OM ya incluidas en otra tarea de la propuesta.`)
      continue
    }
    filas.push({
      ...structuredClone(tarea),
      ordenes: structuredClone(ordenes),
      tiempoPropuesto: tarea.tiempoOriginal === null ? '' : String(tarea.tiempoOriginal),
      trabajadores: '',
      responsableId: ''
    })
  }
  return { plan: { ...plan, filas }, avisos }
}
export function erroresEnvio(plan: Plan, registro: Registro): string[] {
  const errores: string[] = []
  for (const [tipo, id, etiqueta] of [
    ['remolcadores', plan.remolcadorId, 'Remolcador'],
    ['ubicaciones', plan.ubicacionId, 'Ubicación']
  ] as const) {
    if (!registro.catalogos[tipo].some((e) => e.id === id && e.activo))
      errores.push(`${etiqueta}: seleccioná una entrada activa.`)
  }
  if (!etaValida(plan.eta)) errores.push('ETA: completá una fecha y hora válidas.')
  if (!positivo(plan.horasParada) || !finParada(plan))
    errores.push('Tiempo de parada: ingresá una duración positiva válida.')
  if (!plan.filas.length) errores.push('Agregá al menos una TAREA o PM.')
  for (const fila of plan.filas) {
    if (!positivo(fila.tiempoPropuesto)) errores.push(`${fila.id}: ingresá horas previstas mayores que cero.`)
    if (!enteroPositivo(fila.trabajadores))
      errores.push(`${fila.id}: ingresá una cantidad entera de trabajadores, como mínimo 1.`)
    if (!registro.catalogos.responsables.some((e) => e.id === fila.responsableId && e.activo))
      errores.push(`${fila.id}: seleccioná un responsable activo.`)
    if (
      !fila.descripcion ||
      !fila.criticidad ||
      !fila.estado ||
      fila.tiempoOriginal === null ||
      valorTotal(fila.ordenes) === null
    )
      errores.push(
        `${fila.id}: completá descripción, criticidad, estado, tiempo original y valores en la fuente y reimportá.`
      )
    const fuente = registro.fuente.find((t) => t.id === fila.id)
    if (!fuente || !mismaFuente({ ...fuente, ordenes: elegibles(fuente) }, fila))
      errores.push(
        `${fila.id}: la fuente cambió; revisá y actualizá explícitamente esta fila antes de enviar.`
      )
  }
  return errores
}
export function validarFuente(tareas: TareaFuente[]) {
  if (!Array.isArray(tareas) || !tareas.length) throw new Error('La importación no contiene tareas.')
  const ids = new Set<string>()
  const ordenes = new Set<string>()
  for (const t of tareas) {
    if (!t.id?.trim() || ids.has(t.id)) throw new Error(`TAREA/PM duplicada o vacía: ${t.id}.`)
    ids.add(t.id)
    if (
      typeof t.descripcion !== 'string' ||
      typeof t.criticidad !== 'string' ||
      typeof t.estado !== 'string' ||
      (t.tiempoOriginal !== null && (!Number.isFinite(t.tiempoOriginal) || t.tiempoOriginal <= 0)) ||
      !Array.isArray(t.ordenes) ||
      !t.ordenes.length
    )
      throw new Error(`${t.id}: datos de tarea inválidos.`)
    for (const om of t.ordenes) {
      if (!om.numero?.trim() || ordenes.has(om.numero))
        throw new Error(`OM duplicada o vinculada a más de una tarea: ${om.numero}.`)
      if (
        typeof om.estado !== 'string' ||
        (om.valor !== null && (!Number.isFinite(om.valor) || om.valor < 0))
      )
        throw new Error(`${om.numero}: estado o valor inválidos.`)
      ordenes.add(om.numero)
    }
  }
}
export function puedeCambiarEta(actor: Actor): boolean {
  return ['Planificador', 'Administrador', 'Supervisor Taller'].includes(actor.rol)
}
