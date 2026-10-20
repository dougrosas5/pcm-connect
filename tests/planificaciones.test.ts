import assert from 'node:assert/strict'
import test from 'node:test'
import { tareasDemo } from '../src/data/tareas.ts'
import { remolcadoresDemo } from '../src/data/remolcadores.ts'
import { buscarTareas, datosDeTarea, resumirCostos } from '../src/features/busquedaTareas.ts'
import { clavePlanificaciones, guardarPlanificaciones, leerPlanificaciones } from '../src/features/almacenPlanificaciones.ts'
import { actualizarPreparacion, crearPlanificacion, erroresDatosGenerales, registroVacio } from '../src/features/planificaciones.ts'
import type { DatosGenerales } from '../src/features/planificaciones.ts'

const datos: DatosGenerales = { remolcador: remolcadoresDemo[0], fechaParada: '2026-11-20', horasParada: '8.5' }

// Sustituto de la API de almacenamiento, sin modificar los datos del navegador del usuario.
function almacenDemo() {
  const valores = new Map<string, string>()
  return {
    getItem: (clave: string) => valores.get(clave) ?? null,
    setItem: (clave: string, valor: string) => { valores.set(clave, valor) },
  }
}

test('registro vacío y lecturas repetidas no reservan números ni escriben datos', () => {
  const almacen = almacenDemo()
  assert.deepEqual(leerPlanificaciones(almacen), registroVacio())
  assert.deepEqual(leerPlanificaciones(almacen), registroVacio())
  assert.equal(almacen.getItem(clavePlanificaciones), null)
})

test('no crea planes incompletos, con remolcadores desconocidos, fechas imposibles u horas inválidas', () => {
  const registro = registroVacio()
  const casos = [
    { remolcador: '', fechaParada: '', horasParada: '' },
    { ...datos, remolcador: 'Embarcación ajena a la demo' },
    ...['', 'no es fecha', '2026-02-29', '2026-04-31', '0000-01-01', '2026-1-1', '2026-13-01'].map(fechaParada => ({ ...datos, fechaParada })),
    ...['', ' ', '0', '-1', 'abc', 'Infinity', 'NaN', '1e309'].map(horasParada => ({ ...datos, horasParada })),
  ]
  for (const caso of casos) {
    assert.ok(Object.values(erroresDatosGenerales(caso)).some(Boolean), JSON.stringify(caso))
    assert.throws(() => crearPlanificacion(registro, caso))
  }
  assert.deepEqual(registro, registroVacio())
  for (const fechaParada of ['2024-02-29', '2026-01-01', '0001-01-01', '9999-12-31']) {
    assert.ok(Object.values(erroresDatosGenerales({ ...datos, fechaParada })).every(error => error === ''))
  }
  assert.equal(crearPlanificacion(registro, { ...datos, horasParada: '0.25' }).planificaciones[0].horasParada, 0.25)
})

test('cada creación asigna un único número incremental; las ediciones y recargas conservan códigos', () => {
  const almacen = almacenDemo()
  let registro = crearPlanificacion(leerPlanificaciones(almacen), datos)
  guardarPlanificaciones(almacen, registro)
  registro = actualizarPreparacion(leerPlanificaciones(almacen), 'PCM-0001', { entrada: '1001' })
  guardarPlanificaciones(almacen, registro)
  assert.equal(leerPlanificaciones(almacen).ultimoNumero, 1)
  registro = crearPlanificacion(leerPlanificaciones(almacen), { ...datos, remolcador: remolcadoresDemo[1] })
  guardarPlanificaciones(almacen, registro)
  registro = crearPlanificacion(leerPlanificaciones(almacen), datos)
  assert.deepEqual(registro.planificaciones.map(plan => [plan.numero, plan.codigo]), [[1, 'PCM-0001'], [2, 'PCM-0002'], [3, 'PCM-0003']])
  assert.equal(new Set(registro.planificaciones.map(plan => plan.codigo)).size, 3)
  assert.equal(registro.activa, 'PCM-0003')
  assert.ok(registro.planificaciones.every(plan => plan.estado === 'Borrador'))
})

test('la marca histórica no reutiliza números aunque ya no queden planes en la lista', () => {
  const almacen = almacenDemo()
  const creado = crearPlanificacion(crearPlanificacion(registroVacio(), datos), datos)
  // Simula una futura eliminación: esta iteración no agrega controles de borrado/cancelación.
  guardarPlanificaciones(almacen, { ...creado, activa: null, planificaciones: [] })
  const siguiente = crearPlanificacion(leerPlanificaciones(almacen), datos)
  assert.equal(siguiente.planificaciones[0].codigo, 'PCM-0003')
  assert.equal(crearPlanificacion({ ...registroVacio(), ultimoNumero: 9999 }, datos).activa, 'PCM-10000')
})

test('un contador atrasado no modifica códigos existentes ni causa duplicados', () => {
  const almacen = almacenDemo()
  const original = crearPlanificacion(crearPlanificacion(registroVacio(), datos), datos)
  guardarPlanificaciones(almacen, { ...original, ultimoNumero: 0 })
  const leido = leerPlanificaciones(almacen)
  assert.equal(leido.ultimoNumero, 2)
  assert.deepEqual(leido.planificaciones, original.planificaciones)
  assert.equal(crearPlanificacion(leido, datos).activa, 'PCM-0003')
})

test('incorpora el borrador sin planificación una sola vez, con OM, ediciones y avisos intactos', () => {
  const almacen = almacenDemo()
  const resultado = buscarTareas('1001 1002 9999', tareasDemo, [])
  resultado.filas[0].duracionPrevista = '4.25'
  resultado.filas[0].responsable = 'Douglas'
  resultado.filas[0].personas = '2'
  const conBorrador = actualizarPreparacion(registroVacio(), null, {
    entrada: '1001 1002 9999', filas: resultado.filas, avisos: resultado.avisos,
    resumen: 'Búsqueda completada', revisados: { 'OM-001-duracionPrevista': true },
  })
  guardarPlanificaciones(almacen, conBorrador)
  const primero = crearPlanificacion(leerPlanificaciones(almacen), datos)
  assert.deepEqual(primero.planificaciones[0].preparacion, conBorrador.sinPlanificacion)
  assert.equal(primero.sinPlanificacion.filas.length, 0)
  const segundo = crearPlanificacion(primero, datos)
  assert.equal(segundo.planificaciones[1].preparacion.filas.length, 0)
  assert.deepEqual(segundo.planificaciones[0].preparacion, conBorrador.sinPlanificacion)
  assert.equal(conBorrador.planificaciones.length, 0)
})

test('dos planes aíslan OM, búsquedas, campos editables y costos incluso después de guardar y reabrir', () => {
  const almacen = almacenDemo()
  let registro = crearPlanificacion(registroVacio(), datos)
  const primera = buscarTareas('1001 1002', tareasDemo, [])
  registro = actualizarPreparacion(registro, 'PCM-0001', { entrada: '1001 1002', filas: primera.filas, avisos: primera.avisos })
  registro = crearPlanificacion(registro, { ...datos, fechaParada: '2026-12-01', horasParada: '12' })
  const segunda = buscarTareas('1003 1004', tareasDemo, [])
  registro = actualizarPreparacion(registro, 'PCM-0002', { entrada: '1003 1004', filas: segunda.filas, avisos: segunda.avisos })
  guardarPlanificaciones(almacen, registro)

  registro = leerPlanificaciones(almacen)
  const original = structuredClone(registro.planificaciones[1])
  const filas = registro.planificaciones[0].preparacion.filas.map((fila, indice) => indice === 0
    ? { ...fila, duracionPrevista: '4.75', responsable: 'Pepe', personas: '3' } : fila)
  registro = actualizarPreparacion(registro, 'PCM-0001', { filas })
  guardarPlanificaciones(almacen, { ...registro, activa: 'PCM-0001' })

  const recargado = leerPlanificaciones(almacen)
  const [uno, dos] = recargado.planificaciones
  assert.equal(recargado.activa, 'PCM-0001')
  assert.deepEqual(recargado.planificaciones, registro.planificaciones)
  assert.deepEqual(dos, original)
  assert.deepEqual(uno.preparacion.filas.map(fila => fila.numero), ['OM-001', 'OM-002'])
  assert.deepEqual(dos.preparacion.filas.map(fila => fila.numero), ['OM-004'])
  assert.equal(uno.preparacion.filas[1].duracionPrevista, '2')
  assert.equal(resumirCostos(uno.preparacion.filas).subtotal, 720000)
  assert.equal(resumirCostos(dos.preparacion.filas).subtotal, 250000)
  assert.equal(dos.fechaParada, '2026-12-01')
  assert.equal(dos.horasParada, 12)
  const repetida = buscarTareas('1001', tareasDemo, uno.preparacion.filas)
  assert.equal(repetida.agregadas, 0)
  assert.deepEqual(repetida.filas, uno.preparacion.filas)
  assert.equal(recargado.ultimoNumero, 2)
})

test('la misma OM en dos planificaciones conserva ediciones y validaciones independientes', () => {
  let registro = crearPlanificacion(crearPlanificacion(registroVacio(), datos), datos)
  for (const codigo of ['PCM-0001', 'PCM-0002']) {
    registro = actualizarPreparacion(registro, codigo, { filas: buscarTareas('1001', tareasDemo, []).filas })
  }
  const filas = registro.planificaciones[0].preparacion.filas.map(fila => ({ ...fila, duracionPrevista: '', personas: '0' }))
  registro = actualizarPreparacion(registro, 'PCM-0001', { filas, revisados: { 'OM-001-personas': true } })
  const almacen = almacenDemo()
  guardarPlanificaciones(almacen, registro)
  const [uno, dos] = leerPlanificaciones(almacen).planificaciones
  assert.equal(uno.preparacion.filas[0].duracionPrevista, '')
  assert.equal(uno.preparacion.filas[0].personas, '0')
  assert.equal(dos.preparacion.filas[0].duracionPrevista, '3')
  assert.equal(dos.preparacion.filas[0].personas, '1')
  assert.deepEqual(dos.preparacion.revisados, {})
  assert.throws(() => actualizarPreparacion(registro, 'PCM-9999', { entrada: '1003' }))
})

test('persistir no borra otras claves; reabrir no regenera el identificador ni resetea campos pendientes', () => {
  const almacen = almacenDemo()
  almacen.setItem('otro-modulo', 'no tocar')
  const registro = crearPlanificacion(registroVacio(), datos)
  guardarPlanificaciones(almacen, registro)
  for (let intento = 0; intento < 3; intento += 1) assert.deepEqual(leerPlanificaciones(almacen), registro)
  assert.equal(almacen.getItem('otro-modulo'), 'no tocar')
})

test('datos corruptos, códigos duplicados o identidades alteradas fallan sin sobrescribir el contenido', () => {
  const almacen = almacenDemo()
  const registro = crearPlanificacion(registroVacio(), datos)
  const casos = [
    '{json inválido', 'null', '{}',
    JSON.stringify({ ...registro, planificaciones: [...registro.planificaciones, ...registro.planificaciones] }),
    JSON.stringify({ ...registro, planificaciones: [{ ...registro.planificaciones[0], codigo: 'PCM-0002' }] }),
    JSON.stringify({ ...registro, ultimoNumero: -1 }),
    JSON.stringify({ ...registro, activa: 'PCM-9999' }),
    JSON.stringify({ ...registro, sinPlanificacion: { ...registro.sinPlanificacion, filas: [{}] } }),
    JSON.stringify({ ...registro, version: 2 }),
  ]
  for (const texto of casos) {
    almacen.setItem(clavePlanificaciones, texto)
    assert.throws(() => leerPlanificaciones(almacen))
    assert.equal(almacen.getItem(clavePlanificaciones), texto)
  }
})

test('un fallo de almacenamiento se informa y no consume el contador guardado', () => {
  const almacen = almacenDemo()
  const original = crearPlanificacion(registroVacio(), datos)
  guardarPlanificaciones(almacen, original)
  const siguiente = crearPlanificacion(leerPlanificaciones(almacen), datos)
  assert.throws(() => guardarPlanificaciones({
    ...almacen, setItem: () => { throw new Error('Cuota agotada') },
  }, siguiente), /Cuota agotada/u)
  assert.deepEqual(leerPlanificaciones(almacen), original)
  assert.equal(crearPlanificacion(leerPlanificaciones(almacen), datos).activa, 'PCM-0002')
  assert.throws(() => leerPlanificaciones({
    ...almacen, getItem: () => { throw new Error('Acceso denegado') },
  }), /Acceso denegado/u)
})

test('los datos comunes de tarea sobreviven al guardado y son independientes por planificación', () => {
  const almacen = almacenDemo()
  let registro = crearPlanificacion(crearPlanificacion(registroVacio(), datos), datos)
  for (const codigo of ['PCM-0001', 'PCM-0002']) {
    registro = actualizarPreparacion(registro, codigo, { filas: buscarTareas('1001', tareasDemo, []).filas })
  }
  const comunes = { duracionPrevista: '5.5', responsable: 'Douglas', personas: '2' }
  registro = actualizarPreparacion(registro, 'PCM-0001', { datosPorTarea: { '1001': comunes } })
  guardarPlanificaciones(almacen, registro)
  const [uno, dos] = leerPlanificaciones(almacen).planificaciones
  assert.deepEqual(datosDeTarea(tareasDemo[0], uno.preparacion.filas, uno.preparacion.datosPorTarea?.['1001']).datos, comunes)
  assert.equal(datosDeTarea(tareasDemo[0], dos.preparacion.filas, dos.preparacion.datosPorTarea?.['1001']).datos.duracionPrevista, '3')
  assert.equal(dos.preparacion.datosPorTarea, undefined)
  assert.deepEqual(uno.preparacion.filas, dos.preparacion.filas)
  assert.equal(uno.codigo, 'PCM-0001')
  assert.equal(dos.codigo, 'PCM-0002')
})
