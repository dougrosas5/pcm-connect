import { etaValida, validarFuente } from './modelo.ts'
import type { Comando } from '../../../types/pcm.ts'
import { validarRevisionPersistida } from '../../revision-pcm/model/validacion.ts'

function texto(valor: unknown, maximo = 5000): valor is string {
  return typeof valor === 'string' && valor.length <= maximo
}
function objeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}
export function validarComando(valor: unknown): asserts valor is Comando {
  if (!objeto(valor)) throw new Error('Comando inválido.')
  if (valor.tipo === 'guardar') {
    const p = valor.plan
    if (
      !objeto(p) ||
      typeof valor.enviar !== 'boolean' ||
      !texto(p.id, 80) ||
      !/^[a-zA-Z0-9-]{16,80}$/u.test(p.id) ||
      !Number.isSafeInteger(p.version) ||
      Number(p.version) < 0 ||
      !['remolcadorId', 'ubicacionId', 'eta', 'horasParada'].every((k) => texto(p[k], 100)) ||
      !Array.isArray(p.filas) ||
      p.filas.length > 500
    )
      throw new Error('La planificación tiene datos inválidos o supera 500 tareas.')
    if (p.filas.length) validarFuente(p.filas)
    if (
      (p.etaInicial !== undefined &&
        (typeof p.etaInicial !== 'string' || (p.etaInicial !== '' && !etaValida(p.etaInicial)))) ||
      (p.origenEtaInicial !== undefined &&
        !['creacion', 'heredada', 'sin-dato'].includes(String(p.origenEtaInicial))) ||
      (p.historialEta !== undefined &&
        (!Array.isArray(p.historialEta) || p.historialEta.some((c) =>
          !objeto(c) ||
          !texto(c.fecha) || !etaValida(c.fecha) ||
          !texto(c.usuarioId, 80) || !texto(c.usuario) ||
          !texto(c.anterior) || (c.anterior !== '' && !etaValida(c.anterior)) ||
          !texto(c.nuevo) || !etaValida(c.nuevo) ||
          !texto(c.comentario) || !c.comentario.trim() ||
          c.revisionDisponibilidad !== 'pendiente'
        )))
    )
      throw new Error('Los datos o el historial de ETA son inválidos; no se modificó el guardado.')
    if (
      p.filas.some(
        (f) =>
          !objeto(f) || !['tiempoPropuesto', 'trabajadores', 'responsableId'].every((k) => texto(f[k], 100))
      )
    )
      throw new Error('Campos de propuesta inválidos.')
    validarRevisionPersistida(p)
  } else if (valor.tipo === 'cambiarEta') {
    if (
      !texto(valor.planId, 80) || !valor.planId ||
      !Number.isSafeInteger(valor.version) || Number(valor.version) < 1 ||
      !texto(valor.eta, 100) || !etaValida(valor.eta) ||
      !texto(valor.comentario) || !valor.comentario.trim()
    )
      throw new Error('Ingresá una ETA final válida y un comentario para registrar el cambio.')
  } else if (valor.tipo === 'catalogo') {
    const e = valor.entrada
    if (
      !['remolcadores', 'ubicaciones', 'responsables'].includes(String(valor.catalogo)) ||
      !objeto(e) ||
      !texto(e.id, 80) ||
      !e.id ||
      !texto(e.nombre, 160) ||
      typeof e.activo !== 'boolean' ||
      typeof e.externo !== 'boolean' ||
      (valor.catalogo !== 'responsables' && e.externo)
    )
      throw new Error('Entrada de catálogo inválida.')
  } else if (valor.tipo === 'importar') {
    if (!texto(valor.procedencia, 250) || !Array.isArray(valor.tareas) || valor.tareas.length > 20000)
      throw new Error('Importación inválida o demasiado grande.')
    validarFuente(valor.tareas)
  } else if (valor.tipo === 'evaluar') {
    if (
      !texto(valor.planId, 80) ||
      !texto(valor.tareaId, 100) ||
      !['Aceptada', 'Rechazada'].includes(String(valor.resultado)) ||
      !texto(valor.motivo)
    )
      throw new Error('Evaluación inválida.')
    if ((valor.version !== undefined && (!Number.isSafeInteger(valor.version) || Number(valor.version) < 1)) ||
      (valor.tiempoAceptado !== undefined && !texto(valor.tiempoAceptado, 100)) ||
      (valor.trabajadoresAceptados !== undefined && !texto(valor.trabajadoresAceptados, 100))) throw new Error('Valores de evaluación inválidos.')
  } else if (valor.tipo === 'finalizar') {
    if (!texto(valor.planId, 80) || (valor.version !== undefined && (!Number.isSafeInteger(valor.version) || Number(valor.version) < 1))) throw new Error('Planificación inválida.')
  } else if (['guardarRevision', 'confirmarPCM', 'cancelarPCM'].includes(String(valor.tipo))) {
    if (!texto(valor.planId, 80) || !valor.planId || !Number.isSafeInteger(valor.version) || Number(valor.version) < 1) throw new Error('Planificación o versión de revisión inválida.')
    if (valor.tipo === 'guardarRevision') {
      if (!Array.isArray(valor.decisiones) || valor.decisiones.length > 500 || valor.decisiones.some((d) =>
        !objeto(d) || !texto(d.tareaId, 100) || !d.tareaId || !['Tercerizada', 'Eliminada', 'Devuelta a revisión'].includes(String(d.tipo)) ||
        (d.confirmada !== undefined && typeof d.confirmada !== 'boolean') ||
        (d.tipo === 'Devuelta a revisión' && (!objeto(d.correccion) ||
          !['descripcion', 'criticidad', 'tiempoPropuesto', 'trabajadores', 'responsableId'].every((k) => texto((d.correccion as Record<string, unknown>)[k])) ||
          Object.keys(d.correccion).some((k) => !['descripcion', 'criticidad', 'tiempoPropuesto', 'trabajadores', 'responsableId'].includes(k))))))
        throw new Error('Resoluciones PCM inválidas.')
    } else if (valor.tipo === 'confirmarPCM') {
      if (typeof valor.reconocerConflictos !== 'boolean') throw new Error('Reconocimiento de conflictos inválido.')
    } else if (!texto(valor.motivo) || typeof valor.confirmada !== 'boolean') throw new Error('Cancelación inválida.')
  } else throw new Error('Acción no reconocida.')
}
