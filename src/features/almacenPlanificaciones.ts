import { codigoPlanificacion, erroresDatosGenerales, registroVacio } from './planificaciones.ts'
import type { Preparacion, RegistroPlanificaciones } from './planificaciones.ts'
import { estadosPlan, rolesDemo } from './validacionTaller.ts'

export const clavePlanificaciones = 'pcm-connect.planificaciones.v1'
type Almacen = Pick<Storage, 'getItem' | 'setItem'>

function objeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function datosOMValidos(valor: unknown) {
  return objeto(valor) && ['descripcion', 'duracionPrevista', 'responsable', 'personas'].every(campo => typeof valor[campo] === 'string')
    && (valor.costo === undefined || (typeof valor.costo === 'number' && Number.isFinite(valor.costo) && valor.costo >= 0))
}

function tallerValido(valor: unknown): boolean {
  if (!objeto(valor) || valor.version !== 1 || !objeto(valor.ordenes) || !Array.isArray(valor.historial)) return false
  return Object.values(valor.ordenes).every(revision => objeto(revision)
    && Number.isSafeInteger(revision.revision) && Number(revision.revision) > 0
    && ['Pendiente', 'Viable', 'No viable'].includes(String(revision.resultado))
    && typeof revision.motivo === 'string' && (revision.resultado !== 'No viable' || revision.motivo.trim().length > 0)
    && typeof revision.congelada === 'boolean' && typeof revision.cancelada === 'boolean'
    && (revision.evaluada === undefined || (Number.isSafeInteger(revision.evaluada) && Number(revision.evaluada) > 0 && Number(revision.evaluada) <= Number(revision.revision)))
    && (!revision.congelada || (revision.resultado === 'Viable' && revision.evaluada === revision.revision && objeto(revision.datos)))
    && (revision.datos === undefined || datosOMValidos(revision.datos)))
    && valor.historial.every(evento => objeto(evento)
      && ['tipo', 'fecha', 'usuario', 'rol', 'planificacion', 'detalle'].every(campo => typeof evento[campo] === 'string')
      && Number.isFinite(Date.parse(String(evento.fecha))) && rolesDemo.includes(evento.rol as typeof rolesDemo[number])
      && ['om', 'anterior', 'nuevo'].every(campo => evento[campo] === undefined || typeof evento[campo] === 'string')
      && (evento.revision === undefined || (Number.isSafeInteger(evento.revision) && Number(evento.revision) > 0)))
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
      || plan.codigo !== codigoPlanificacion(Number(plan.numero)) || !estadosPlan.includes(plan.estado as typeof estadosPlan[number])
      || (plan.taller === undefined ? plan.estado !== 'Borrador' : !tallerValido(plan.taller))
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
  // Migración aditiva: los registros v1 sin Taller siguen siendo borradores válidos.
  // No se inventan eventos históricos ni se reescribe el guardado al leer.
  return { ...valor, ultimoNumero: Math.max(valor.ultimoNumero, ...valor.planificaciones.map(plan => plan.numero)) }
}

export function guardarPlanificaciones(almacen: Almacen, registro: RegistroPlanificaciones) {
  almacen.setItem(clavePlanificaciones, JSON.stringify(registro))
}
