import type { OrdenMantenimiento, Tarea } from '../data/tareas.ts'
import { responsablesPreparacion } from '../data/tareas.ts'

export type FilaOM = OrdenMantenimiento & {
  tarea: string
  area: string
  // Texto editable para permitir vaciar el input y mostrar errores sin perder el original.
  duracionPrevista: string
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
      filas.push({ ...om, tarea: id, area: tarea.area, duracionPrevista: String(om.horasPrevistas), responsable: '', personas: '1' })
      omIncluidas.add(om.numero)
    }
  }

  return { filas, avisos, agregadas: filas.length - actuales.length }
}

export function errorResponsable(valor: string) {
  return responsablesPreparacion.some(responsable => responsable === valor)
    ? '' : 'Seleccioná Douglas, Ale o Pepe.'
}

export function errorPersonas(valor: string) {
  return !/^\d+$/u.test(valor) || !Number.isSafeInteger(Number(valor)) || Number(valor) < 1
    ? 'Ingresá un número entero mayor o igual a 1.' : ''
}

export function errorDuracion(valor: string) {
  return valor.trim() === '' || !Number.isFinite(Number(valor)) || Number(valor) <= 0
    ? 'Ingresá una duración mayor que 0; admite decimales.' : ''
}

// Las OM conservan su identidad en el guardado; la tabla presenta una tarea común.
export function agruparPorTarea(filas: FilaOM[]) {
  const grupos = new Map<string, FilaOM[]>()
  for (const fila of filas) {
    const grupo = grupos.get(fila.tarea)
    if (grupo) grupo.push(fila)
    else grupos.set(fila.tarea, [fila])
  }
  return Array.from(grupos, ([tarea, ordenes]) => ({ tarea, ordenes }))
}

export type DatosTarea = Pick<FilaOM, 'duracionPrevista' | 'responsable' | 'personas'>

export function datosDeTarea(tarea: Tarea | undefined, ordenes: FilaOM[], guardados?: DatosTarea) {
  if (guardados) return { datos: guardados, conflictos: [] as string[] }
  const conflictos: string[] = []
  // Recupera ediciones del formato anterior sin sumar duraciones de OM ni
  // sobrescribir los originales. Las ediciones distintas requieren un valor común.
  function recuperar(campo: keyof DatosTarea, inicial: string, etiqueta: string) {
    const editados = [...new Set(ordenes
      .filter(om => om[campo] !== (campo === 'duracionPrevista' ? String(om.horasPrevistas) : campo === 'personas' ? '1' : ''))
      .map(om => om[campo]))]
    if (editados.length > 1) {
      conflictos.push(etiqueta)
      return ''
    }
    return editados[0] ?? inicial
  }
  return {
    datos: {
      duracionPrevista: recuperar('duracionPrevista', tarea ? String(tarea.horasPrevistas) : '', 'duración'),
      responsable: recuperar('responsable', '', 'responsable'),
      personas: recuperar('personas', '1', 'personas'),
    },
    conflictos,
  }
}

export function resumirCostos(filas: FilaOM[]) {
  let subtotal: number | undefined
  let sinDefinir = 0
  for (const fila of filas) {
    if (fila.costo === undefined) sinDefinir += 1
    else subtotal = (subtotal ?? 0) + fila.costo
  }
  return {
    // Sin costos conocidos, el subtotal queda indefinido: no representa un cero real.
    subtotal: subtotal === undefined ? undefined : Math.round(subtotal * 100) / 100,
    sinDefinir,
  }
}
