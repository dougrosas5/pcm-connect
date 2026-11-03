import { validarFuente } from './modelo.ts'
import type { Comando } from './modelo.ts'

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
      p.filas.some(
        (f) =>
          !objeto(f) || !['tiempoPropuesto', 'trabajadores', 'responsableId'].every((k) => texto(f[k], 100))
      )
    )
      throw new Error('Campos de propuesta inválidos.')
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
  } else if (valor.tipo === 'finalizar') {
    if (!texto(valor.planId, 80)) throw new Error('Planificación inválida.')
  } else throw new Error('Acción no reconocida.')
}
