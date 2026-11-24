import { descargarTexto } from '../../../utils/descargas.ts'
import { validarFuente } from '../model/modelo.ts'
import type { TareaFuente } from '../../../types/pcm.ts'
import type { SheetData } from 'read-excel-file/browser'

export const columnasImportacion = [
  'TAREA / PM',
  'N.º de OM',
  'Estado OM',
  'Valor (Gs.)',
  'Descripción',
  'Tiempo (h)',
  'Criticidad',
  'Estado tarea'
]
const normalizar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/gu, '')
const alias = [
  ['tareapm', 'tarea', 'pm', 'idtarea'],
  ['ndeom', 'nodeom', 'nom', 'om', 'numeroom', 'numerodeom'],
  ['estadoom'],
  ['valorgs', 'valor', 'valortotalgs'],
  ['descripcion'],
  ['tiempoh', 'tiempo', 'horas'],
  ['criticidad'],
  ['estadotarea', 'estadopm']
]
export type ResultadoImportacion = { tareas: TareaFuente[]; avisos: string[] }

function numero(valor: string, fila: number, campo: string, positivo = false): number | null {
  if (!valor.trim()) return null
  // Evita interpretar separadores de miles ambiguos. Excel numérico usa su valor original.
  if (!/^\d+(?:[.,]\d+)?$/u.test(valor.trim()))
    throw new Error(`Fila ${fila}: ${campo} debe ser numérico, sin símbolos ni separadores de miles.`)
  const n = Number(valor.replace(',', '.'))
  if (!Number.isFinite(n) || n < 0 || (positivo && n === 0))
    throw new Error(`Fila ${fila}: ${campo} inválido.`)
  return n
}
export function convertirFilas(filas: string[][]): ResultadoImportacion {
  const cabecera = filas[0]?.map(normalizar) ?? []
  const indices = alias.map((nombres) => cabecera.findIndex((c) => nombres.includes(c)))
  const faltantes = indices.flatMap((indice, i) => (indice < 0 ? [columnasImportacion[i]] : []))
  if (faltantes.length)
    throw new Error(`Faltan columnas: ${faltantes.join(', ')}. Descargá la plantilla para ver el formato.`)
  const tareas = new Map<string, TareaFuente>()
  const avisos: string[] = []
  filas.slice(1).forEach((fila, i) => {
    if (fila.every((c) => !c.trim())) return
    const campos = indices.map((indice) => (fila[indice] ?? '').trim())
    const [id, om, estadoOM, valor, descripcion, tiempo, criticidad, estado] = campos
    if (!id || !om) throw new Error(`Fila ${i + 2}: faltan TAREA/PM o número de OM.`)
    const tarea: TareaFuente = {
      id,
      descripcion,
      tiempoOriginal: numero(tiempo, i + 2, 'Tiempo (h)', true),
      criticidad,
      estado,
      ordenes: []
    }
    const anterior = tareas.get(id)
    if (anterior && JSON.stringify({ ...anterior, ordenes: [] }) !== JSON.stringify(tarea))
      throw new Error(`Fila ${i + 2}: los datos de ${id} difieren entre filas. Usá los mismos datos de tarea para todas sus OM.`)
    const orden = { numero: om, estado: estadoOM, valor: numero(valor, i + 2, 'Valor (Gs.)') }
    const previa = anterior?.ordenes.find((o) => o.numero === om)
    if (previa) {
      if (JSON.stringify(previa) !== JSON.stringify(orden))
        throw new Error(`Fila ${i + 2}: ${om} tiene valores o estados distintos. Corregí las filas de esta OM.`)
      avisos.push(`Fila ${i + 2}: ${om} está repetida. Se incluye una sola vez.`)
      return
    }
    if (anterior) anterior.ordenes.push(orden)
    else tareas.set(id, { ...tarea, ordenes: [orden] })
    const vacios = campos.flatMap((c, indice) => (!c ? [columnasImportacion[indice]] : []))
    if (vacios.length)
      avisos.push(`Fila ${i + 2} (${id}): completar ${vacios.join(', ')} en la fuente antes de enviar.`)
  })
  const resultado = [...tareas.values()]
  validarFuente(resultado)
  return { tareas: resultado, avisos }
}

// CSV con comillas, separadores dentro de celdas y saltos de línea. No evalúa fórmulas.
export function leerCSV(texto: string): string[][] {
  const contenido = texto.replace(/^\uFEFF/u, '')
  const primera = contenido.split(/\r?\n/u)[0] ?? ''
  const separador = primera.includes(';') ? ';' : primera.includes('\t') ? '\t' : ','
  const filas: string[][] = []
  let fila: string[] = []
  let celda = ''
  let comillas = false
  for (let i = 0; i < contenido.length; i++) {
    const c = contenido[i]
    if (c === '"') {
      if (comillas && contenido[i + 1] === '"') {
        celda += '"'
        i++
      } else comillas = !comillas
    } else if (!comillas && (c === separador || c === '\n' || c === '\r')) {
      fila.push(celda)
      celda = ''
      if (c !== separador) {
        filas.push(fila)
        fila = []
        if (c === '\r' && contenido[i + 1] === '\n') i++
      }
    } else celda += c
  }
  if (comillas) throw new Error('El CSV tiene comillas sin cerrar.')
  if (celda || fila.length) filas.push([...fila, celda])
  return filas
}

export async function importarArchivo(archivo: File): Promise<ResultadoImportacion> {
  if (archivo.size > 10 * 1024 * 1024)
    throw new Error('El archivo supera 10 MB. Dividilo e importá un archivo más pequeño.')
  if (/\.csv$/iu.test(archivo.name)) return convertirFilas(leerCSV(await archivo.text()))
  if (!/\.xlsx$/iu.test(archivo.name))
    throw new Error('Seleccioná un archivo .xlsx o .csv. Convertí los archivos .xls al formato .xlsx.')
  // Lector específico, cargado bajo demanda. No incorpora herramientas de escritura.
  const { readSheet } = await import('read-excel-file/browser')
  const hoja = await readSheet(archivo)
  return convertirHoja(hoja)
}

export function convertirHoja(hoja: SheetData): ResultadoImportacion {
  if (hoja.length > 20001) throw new Error('La primera hoja supera 20.000 filas de datos. Dividí el archivo.')
  const encabezados = hoja[0]?.map((c) => normalizar(String(c ?? ''))) ?? []
  const ids = alias.slice(0, 2).map((nombres) => encabezados.findIndex((c) => nombres.includes(c)))
  const filas = hoja.map((fila, i) =>
    fila.map((celda, columna) => {
      if (i > 0 && ids.includes(columna) && typeof celda === 'number')
        throw new Error(
          `Fila ${i + 1}: guardá los identificadores como texto para conservar ceros a la izquierda.`
        )
      if (celda instanceof Date || typeof celda === 'boolean')
        throw new Error(`Fila ${i + 1}: no se admiten fechas ni valores lógicos en estas columnas.`)
      return celda === null ? '' : String(celda)
    })
  )
  return convertirFilas(filas)
}

export function descargarPlantilla() {
  descargarTexto('PCM-plantilla.csv', '\uFEFF' + columnasImportacion.join(';') + '\r\n')
}
