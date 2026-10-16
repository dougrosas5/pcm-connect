import assert from 'node:assert/strict'
import test from 'node:test'
import { tareasDemo } from '../src/data/tareas.ts'
import { buscarTareas, errorPersonas, errorResponsable } from '../src/features/busquedaTareas.ts'

test('separa comas, espacios y saltos de línea, preservando ceros y guiones', () => {
  const resultado = buscarTareas('1001,\t1003\n0010-A', tareasDemo, [])
  assert.deepEqual(resultado.filas.map(fila => fila.numero), ['OM-001', 'OM-002', 'OM-004', 'OM-007'])
  assert.equal(resultado.filas.at(-1)?.tarea, '0010-A')
  assert.equal(resultado.agregadas, 4)
})

test('excluye tareas y OM cerradas sin bloquear las abiertas', () => {
  const resultado = buscarTareas('1002 1003 1004 9999', tareasDemo, [])
  assert.deepEqual(resultado.filas.map(fila => fila.numero), ['OM-004'])
  for (const fragmento of ['1002: cerrada', 'OM-005', 'OM-006', '1004: no tiene OM abiertas', '9999: no existe']) {
    assert.ok(resultado.avisos.some(aviso => aviso.includes(fragmento)), fragmento)
  }
})

test('búsqueda vacía o sin coincidencias no inventa OM ni borra el borrador', () => {
  const actuales = buscarTareas('1001', tareasDemo, []).filas
  for (const entrada of ['', ' , \n\t', '9999', '1002 1004']) {
    const resultado = buscarTareas(entrada, tareasDemo, actuales)
    assert.deepEqual(resultado.filas, actuales)
    assert.equal(resultado.agregadas, 0)
    assert.ok(resultado.avisos.length > 0)
  }
  assert.deepEqual(buscarTareas('9999', tareasDemo, []).filas, [])
})

test('repetir IDs o búsquedas conserva las ediciones independientes por OM', () => {
  const primera = buscarTareas('1001,1001', tareasDemo, [])
  assert.equal(primera.filas.length, 2)
  assert.ok(primera.avisos.some(aviso => aviso.includes('ID repetido')))
  const editadas = primera.filas.map((fila, indice) => ({ ...fila, responsable: `Demo ${indice}`, personas: String(indice + 2) }))
  const segunda = buscarTareas('1001 1003', tareasDemo, editadas)
  assert.equal(segunda.filas.length, 3)
  assert.deepEqual(segunda.filas.slice(0, 2), editadas)
  assert.equal(segunda.agregadas, 1)
  assert.equal(segunda.avisos.filter(aviso => aviso.includes('ya está en la tabla')).length, 2)
})

test('la identidad de OM es única incluso si dos tareas la vinculan', () => {
  const base = [tareasDemo[0], { ...tareasDemo[0], numero: 'otra-tarea' }]
  const resultado = buscarTareas('1001 otra-tarea', base, [])
  assert.equal(resultado.filas.length, 2)
  assert.equal(resultado.avisos.length, 2)
})

test('una tarea abierta sin OM informa un estado vacío', () => {
  const resultado = buscarTareas('sin-om', [{ numero: 'sin-om', area: 'Demo', estado: 'Abierta', ordenesMantenimiento: [] }], [])
  assert.equal(resultado.filas.length, 0)
  assert.match(resultado.avisos[0], /no tiene OM abiertas/u)
})

test('responsable obligatorio y personas enteras positivas', () => {
  for (const valor of ['', '   ', 'a'.repeat(101)]) assert.notEqual(errorResponsable(valor), '')
  assert.equal(errorResponsable(' Responsable ficticio '), '')
  for (const valor of ['', ' ', '0', '-1', '1.5', 'abc', '1e2', 'Infinity', '9007199254740992']) {
    assert.notEqual(errorPersonas(valor), '', valor)
  }
  for (const valor of ['1', '2', '10']) assert.equal(errorPersonas(valor), '')
})
