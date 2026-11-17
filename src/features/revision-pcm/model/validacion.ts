import { etaValida, validarFuente } from '../../planificacion/model/modelo.ts'

const objeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const texto = (v: unknown): v is string => typeof v === 'string'
const positivo = (v: unknown) => Number.isSafeInteger(v) && Number(v) > 0
function firma(v: unknown) {
  return objeto(v) && texto(v.usuarioId) && texto(v.usuario) && texto(v.fecha) && etaValida(v.fecha) &&
    ['Planificador', 'Taller', 'Supervisor Taller', 'Administrador', 'Consulta'].includes(String(v.rol))
}
function evaluacion(v: unknown) {
  return objeto(v) && ['Aceptada', 'Rechazada'].includes(String(v.resultado)) && texto(v.motivo) &&
    texto(v.usuario) && texto(v.fecha) && etaValida(v.fecha) &&
    (v.versionTarea === undefined || positivo(v.versionTarea)) &&
    (v.tiempoAceptado === undefined || (texto(v.tiempoAceptado) && Number.isFinite(Number(v.tiempoAceptado)) && Number(v.tiempoAceptado) > 0)) &&
    (v.trabajadoresAceptados === undefined || (texto(v.trabajadoresAceptados) && /^\d+$/u.test(v.trabajadoresAceptados) && positivo(Number(v.trabajadoresAceptados))))
}
function resolucion(v: unknown) {
  return objeto(v) && firma(v) && positivo(v.versionTarea) && ['Tercerizada', 'Eliminada', 'Devuelta a revisión'].includes(String(v.tipo))
}
// Se rechaza un documento dañado sin eliminarlo ni reemplazarlo por un registro vacío.
export function validarRevisionPersistida(p: Record<string, unknown>) {
  if (p.evaluaciones !== undefined && (!objeto(p.evaluaciones) || !Object.values(p.evaluaciones).every(evaluacion)))
    throw new Error('Evaluaciones guardadas inválidas; se conservó el contenido original.')
  const r = p.revisionPCM
  if (r === undefined) {
    if (['Confirmada', 'Cancelada', 'En reevaluación'].includes(String(p.estado))) throw new Error('Falta la trazabilidad de revisión PCM; se conservó el contenido original.')
    return
  }
  const fallar = () => { throw new Error('Revisión PCM guardada inválida; se conservó el contenido original.') }
  if (!objeto(r) || r.esquema !== 1 || !positivo(r.versionContenido) ||
    !(r.versionEvaluada === null || (positivo(r.versionEvaluada) && Number(r.versionEvaluada) <= Number(r.versionContenido))) ||
    !objeto(r.tareas) || !Array.isArray(r.conflictos)) return fallar()
  const ids = (p.filas as { id: string }[]).map((f) => f.id)
  if (Object.keys(r.tareas).length !== ids.length) return fallar()
  for (const [id, t] of Object.entries(r.tareas)) {
    if (!ids.includes(id) || !objeto(t) || !positivo(t.version) || !texto(t.responsableOriginalId) ||
      !Array.isArray(t.resoluciones) || !t.resoluciones.every(resolucion) ||
      (t.resolucion !== undefined && (!resolucion(t.resolucion) || JSON.stringify(t.resolucion) !== JSON.stringify(t.resoluciones.at(-1)))) ||
      !Array.isArray(t.evaluaciones) || !t.evaluaciones.every(evaluacion) ||
      !Array.isArray(t.versiones) || t.versiones.length !== t.version) return fallar()
    for (const [indice, v] of t.versiones.entries()) {
      if (!objeto(v) || !firma(v) || v.version !== indice + 1 || !objeto(v.fila) || v.fila.id !== id ||
        !Array.isArray(v.campos) || !v.campos.every(texto)) return fallar()
      validarFuente([v.fila as never])
    }
  }
  if (r.conflictos.some((c) => !objeto(c) || !texto(c.id) || !ids.includes(String(c.tareaId)) || !texto(c.detalle) ||
    !texto(c.fecha) || !etaValida(c.fecha) || c.estado !== 'Pendiente de reprogramación' ||
    (c.reconocimiento !== undefined && !firma(c.reconocimiento)))) return fallar()
  if (r.confirmacion !== undefined && (!objeto(r.confirmacion) || !firma(r.confirmacion) || !positivo(r.confirmacion.version) || typeof r.confirmacion.conAdvertencias !== 'boolean')) return fallar()
  if (r.cancelacion !== undefined && (!objeto(r.cancelacion) || !firma(r.cancelacion) || !texto(r.cancelacion.motivo) || !r.cancelacion.motivo.trim())) return fallar()
  if ((p.estado === 'Confirmada' && !r.confirmacion) || (p.estado === 'Cancelada' && !r.cancelacion)) return fallar()
}
