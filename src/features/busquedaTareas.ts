import type { OrdenMantenimiento, Tarea } from '../data/tareas.ts'

export type FilaOM = OrdenMantenimiento & {
  tarea: string
  area: string
  responsable: string
  personas: string
}

// Cada búsqueda agrega OM y conserva las ediciones de las filas previas.
export function buscarTareas(entrada: string, base: Tarea[], actuales: FilaOM[]) {
  const ids = entrada.split(/[,\s]+/u).filter(Boolean)
  const filas = [...actuales]
  const avisos: string[] = []
  const tareasVistas = new Set<string>()
  const omIncluidas = new Set(actuales.map(fila => fila.numero))

  if (ids.length === 0) {
    return { filas, avisos: ['Ingresá al menos un número de tarea.'], agregadas: 0 }
  }

  for (const id of ids) {
    if (tareasVistas.has(id)) {
      avisos.push(`Tarea ${id}: ID repetido en la búsqueda; se procesó una sola vez.`)
      continue
    }
    tareasVistas.add(id)
    const tarea = base.find(item => item.numero === id)
    if (!tarea) {
      avisos.push(`Tarea ${id}: no existe en la base ficticia.`)
      continue
    }
    if (tarea.estado === 'Cerrada') {
      avisos.push(`Tarea ${id}: cerrada; sus OM fueron excluidas.`)
      continue
    }
    const abiertas = tarea.ordenesMantenimiento.filter(om => om.estado === 'Abierta')
    const cerradas = tarea.ordenesMantenimiento.filter(om => om.estado === 'Cerrada')
    if (cerradas.length > 0) {
      avisos.push(`Tarea ${id}: OM cerradas excluidas: ${cerradas.map(om => om.numero).join(', ')}.`)
    }
    if (abiertas.length === 0) {
      avisos.push(`Tarea ${id}: no tiene OM abiertas para agregar.`)
    }
    for (const om of abiertas) {
      if (omIncluidas.has(om.numero)) {
        avisos.push(`Tarea ${id}: ${om.numero} ya está en la tabla; se conservaron sus datos.`)
        continue
      }
      filas.push({ ...om, tarea: id, area: tarea.area, responsable: '', personas: '1' })
      omIncluidas.add(om.numero)
    }
  }

  return { filas, avisos, agregadas: filas.length - actuales.length }
}

export function errorResponsable(valor: string) {
  return valor.trim().length === 0 ? 'Ingresá un responsable.'
    : valor.trim().length > 100 ? 'Usá hasta 100 caracteres.' : ''
}

export function errorPersonas(valor: string) {
  return !/^\d+$/u.test(valor) || !Number.isSafeInteger(Number(valor)) || Number(valor) < 1
    ? 'Ingresá un número entero mayor o igual a 1.' : ''
}
