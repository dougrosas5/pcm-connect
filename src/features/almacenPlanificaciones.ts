import { codigoPlanificacion, erroresDatosGenerales, registroVacio } from './planificaciones.ts'
import type { Preparacion, RegistroPlanificaciones } from './planificaciones.ts'

export const clavePlanificaciones = 'pcm-connect.planificaciones.v1'
type Almacen = Pick<Storage, 'getItem' | 'setItem'>

function objeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function preparacionValida(valor: unknown): valor is Preparacion {
  if (!objeto(valor) || typeof valor.entrada !== 'string' || typeof valor.resumen !== 'string'
    || !Array.isArray(valor.avisos) || !valor.avisos.every(aviso => typeof aviso === 'string')
    || !objeto(valor.revisados) || !Object.values(valor.revisados).every(item => typeof item === 'boolean')
    || !Array.isArray(valor.filas)) return false
  if (valor.datosPorTarea !== undefined && (!objeto(valor.datosPorTarea)
    || !Object.values(valor.datosPorTarea).every(datos => objeto(datos)
      && ['duracionPrevista', 'responsable', 'personas'].every(campo => typeof datos[campo] === 'string')))) return false
  const numeros = new Set<string>()
  return valor.filas.every(fila => {
    if (!objeto(fila) || !['numero', 'descripcion', 'tarea', 'area', 'duracionPrevista', 'responsable', 'personas'].every(campo => typeof fila[campo] === 'string')
      || fila.estado !== 'Abierta' || typeof fila.horasPrevistas !== 'number' || !Number.isFinite(fila.horasPrevistas)
      || (fila.costo !== undefined && (typeof fila.costo !== 'number' || !Number.isFinite(fila.costo)))
      || (fila.criticidad !== undefined && !['Baja', 'Media', 'Alta'].includes(String(fila.criticidad)))) return false
    const numero = fila.numero as string
    if (numeros.has(numero)) return false
    numeros.add(numero)
    return true
  })
}

// Validar antes de usar el contenido evita reemplazar un guardado dañado por una lista vacía.
function registroValido(valor: unknown): valor is RegistroPlanificaciones {
  if (!objeto(valor) || valor.version !== 1 || !Number.isSafeInteger(valor.ultimoNumero) || Number(valor.ultimoNumero) < 0
    || !Array.isArray(valor.planificaciones) || !preparacionValida(valor.sinPlanificacion)) return false
  const codigos = new Set<string>()
  for (const plan of valor.planificaciones) {
    if (!objeto(plan) || !Number.isSafeInteger(plan.numero) || Number(plan.numero) < 1
      || plan.codigo !== codigoPlanificacion(Number(plan.numero)) || plan.estado !== 'Borrador'
      || typeof plan.remolcador !== 'string' || typeof plan.fechaParada !== 'string'
      || typeof plan.horasParada !== 'number' || !preparacionValida(plan.preparacion)
      || Object.values(erroresDatosGenerales({ remolcador: plan.remolcador, fechaParada: plan.fechaParada, horasParada: String(plan.horasParada) })).some(Boolean)
      || codigos.has(String(plan.codigo))) return false
    codigos.add(String(plan.codigo))
  }
  return valor.activa === null || (typeof valor.activa === 'string' && codigos.has(valor.activa))
}

export function leerPlanificaciones(almacen: Almacen): RegistroPlanificaciones {
  const texto = almacen.getItem(clavePlanificaciones)
  if (texto === null) return registroVacio()
  const valor: unknown = JSON.parse(texto)
  if (!registroValido(valor)) throw new Error('El formato de las planificaciones guardadas no es válido.')
  // Si el contador quedó atrasado, las identidades guardadas siguen siendo la referencia mínima.
  return { ...valor, ultimoNumero: Math.max(valor.ultimoNumero, ...valor.planificaciones.map(plan => plan.numero)) }
}

export function guardarPlanificaciones(almacen: Almacen, registro: RegistroPlanificaciones) {
  almacen.setItem(clavePlanificaciones, JSON.stringify(registro))
}
