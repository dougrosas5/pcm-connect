import assert from 'node:assert/strict'
import test from 'node:test'
import { responsablesPreparacion, tareasDemo } from '../src/data/tareas.ts'
import { agruparPorTarea, buscarTareas, datosDeTarea, errorDuracion, errorPersonas, errorResponsable, resumirCostos } from '../src/features/busquedaTareas.ts'

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
  const editadas = primera.filas.map((fila, indice) => ({ ...fila, duracionPrevista: String(indice + 0.75), responsable: responsablesPreparacion[indice], personas: String(indice + 2) }))
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
  const resultado = buscarTareas('sin-om', [{ numero: 'sin-om', descripcion: 'Tarea ficticia sin OM', area: 'Demo', estado: 'Abierta', horasPrevistas: 1, ordenesMantenimiento: [] }], [])
  assert.equal(resultado.filas.length, 0)
  assert.match(resultado.avisos[0], /no tiene OM abiertas/u)
})

test('responsable obligatorio y personas enteras positivas', () => {
  for (const valor of ['', '   ', 'a'.repeat(101), 'Otro responsable', 'douglas']) assert.notEqual(errorResponsable(valor), '')
  for (const valor of ['Douglas', 'Ale', 'Pepe']) assert.equal(errorResponsable(valor), '')
  for (const valor of ['', ' ', '0', '-1', '1.5', 'abc', '1e2', 'Infinity', '9007199254740992']) {
    assert.notEqual(errorPersonas(valor), '', valor)
  }
  for (const valor of ['1', '2', '10']) assert.equal(errorPersonas(valor), '')
})

test('recupera descripción, duración y costo por OM sin convertir área en responsable', () => {
  const { filas } = buscarTareas('1001 1003 0010-A', tareasDemo, [])
  assert.deepEqual(filas.map(fila => fila.duracionPrevista), ['3', '2', '1.5', '4'])
  assert.deepEqual(filas.map(fila => fila.costo), [370000, 350000, 250000, 450000])
  assert.notEqual(filas[0].descripcion, filas[1].descripcion)
  for (const fila of filas) {
    const tarea = tareasDemo.find(tarea => tarea.numero === fila.tarea)!
    const original = tarea.ordenesMantenimiento.find(om => om.numero === fila.numero)!
    assert.equal(fila.descripcion, original.descripcion)
    assert.ok(fila.descripcion.length > 0)
    assert.equal(fila.area, tarea.area)
    assert.equal(fila.responsable, '')
  }
})

test('editar duración del borrador no cambia la base ni otra OM y se conserva al buscar de nuevo', () => {
  const baseOriginal = structuredClone(tareasDemo)
  const { filas } = buscarTareas('1001', tareasDemo, [])
  filas[0].duracionPrevista = '4.25'
  filas[0].responsable = 'Douglas'
  const repetida = buscarTareas('1001 1003', tareasDemo, filas)
  assert.equal(repetida.filas[0].duracionPrevista, '4.25')
  assert.equal(repetida.filas[1].duracionPrevista, '2')
  assert.equal(repetida.filas[2].duracionPrevista, '1.5')
  assert.equal(repetida.filas[0].horasPrevistas, 3)
  assert.deepEqual(tareasDemo, baseOriginal)
})

test('duración obligatoria, finita y positiva; admite decimales', () => {
  for (const valor of ['', ' ', '0', '0.0', '-1', '-0.5', 'abc', 'Infinity', 'NaN', '1e309']) {
    assert.notEqual(errorDuracion(valor), '', valor)
  }
  for (const valor of ['1', '0.25', '1.5', '4.75', '100']) assert.equal(errorDuracion(valor), '', valor)
})

test('agrupa tareas aunque sus OM lleguen separadas y mantiene orden e independencia', () => {
  const { filas } = buscarTareas('1001 1003', tareasDemo, [])
  const grupos = agruparPorTarea([filas[0], filas[2], filas[1]])
  assert.deepEqual(grupos.map(grupo => grupo.tarea), ['1001', '1003'])
  assert.deepEqual(grupos[0].ordenes.map(fila => fila.numero), ['OM-001', 'OM-002'])
  assert.equal(grupos[0].ordenes.length, 2)
  assert.equal(grupos[1].ordenes.length, 1)
  assert.equal(grupos[0].ordenes[0], filas[0])
  assert.equal(grupos[0].ordenes[1], filas[1])
  assert.deepEqual(agruparPorTarea([]), [])
})

test('suma costos por OM incorporada, excluye cerradas y no suma duplicados', () => {
  const primera = buscarTareas('1001', tareasDemo, [])
  assert.deepEqual(resumirCostos(primera.filas), { subtotal: 720000, sinDefinir: 0 })
  const segunda = buscarTareas('1001 1002 1003 1004', tareasDemo, primera.filas)
  assert.deepEqual(resumirCostos(segunda.filas), { subtotal: 970000, sinDefinir: 0 })
  const todas = buscarTareas('0010-A', tareasDemo, segunda.filas)
  assert.deepEqual(resumirCostos(todas.filas), { subtotal: 1420000, sinDefinir: 0 })
  assert.equal(resumirCostos(segunda.filas.map(fila => ({ ...fila, costo: 0.1 }))).subtotal, 0.3)
})

test('los costos faltantes dejan el total pendiente y un cero explícito sigue siendo conocido', () => {
  const baseSinCosto = tareasDemo.map(tarea => tarea.numero === '0010-A'
    ? { ...tarea, ordenesMantenimiento: tarea.ordenesMantenimiento.map(om => ({ ...om, costo: undefined })) }
    : tarea)
  const desconocido = buscarTareas('0010-A', baseSinCosto, [])
  assert.deepEqual(resumirCostos(desconocido.filas), { subtotal: undefined, sinDefinir: 1 })
  const mixto = buscarTareas('1001', tareasDemo, desconocido.filas)
  assert.deepEqual(resumirCostos(mixto.filas), { subtotal: 720000, sinDefinir: 1 })
  assert.deepEqual(resumirCostos([]), { subtotal: undefined, sinDefinir: 0 })
  assert.deepEqual(resumirCostos([{ ...desconocido.filas[0], costo: 0 }]), { subtotal: 0, sinDefinir: 0 })
})

test('la duración común viene de la tarea y no se suma ni se toma de sus OM', () => {
  const tarea = { ...tareasDemo[0], horasPrevistas: 7.5 }
  const { filas } = buscarTareas('1001', [tarea], [])
  assert.equal(datosDeTarea(tarea, filas).datos.duracionPrevista, '7.5')
  assert.equal(datosDeTarea(tarea, filas).datos.responsable, '')
  assert.equal(datosDeTarea(tarea, filas).datos.personas, '1')
  assert.deepEqual(datosDeTarea(tarea, filas).conflictos, [])
})

test('cada tarea suma solo sus OM incorporadas; buscar otra vez no duplica costos', () => {
  const primera = buscarTareas('1001 1003 1002', tareasDemo, [])
  const repetida = buscarTareas('1001 1003', tareasDemo, primera.filas)
  const grupos = agruparPorTarea(repetida.filas)
  assert.deepEqual(grupos.map(grupo => resumirCostos(grupo.ordenes)), [
    { subtotal: 720000, sinDefinir: 0 }, { subtotal: 250000, sinDefinir: 0 },
  ])
  assert.equal(resumirCostos(repetida.filas).subtotal, 970000)
})

test('los campos comunes guardados prevalecen sin modificar las OM ni otras tareas', () => {
  const { filas } = buscarTareas('1001 1003', tareasDemo, [])
  const originales = structuredClone(filas)
  const datos = { duracionPrevista: '6.25', responsable: 'Douglas', personas: '2' }
  assert.deepEqual(datosDeTarea(tareasDemo[0], filas.slice(0, 2), datos).datos, datos)
  assert.equal(datosDeTarea(tareasDemo[2], filas.slice(2)).datos.duracionPrevista, '1.5')
  assert.equal(datosDeTarea(tareasDemo[2], filas.slice(2)).datos.responsable, '')
  assert.deepEqual(filas, originales)
})

test('recupera una edición anterior por OM sin perder el guardado original', () => {
  const { filas } = buscarTareas('1001', tareasDemo, [])
  filas[1] = { ...filas[1], duracionPrevista: '4.25', responsable: 'Pepe', personas: '3' }
  const originales = structuredClone(filas)
  const comun = datosDeTarea(tareasDemo[0], filas)
  assert.deepEqual(comun.datos, { duracionPrevista: '4.25', responsable: 'Pepe', personas: '3' })
  assert.deepEqual(comun.conflictos, [])
  assert.deepEqual(filas, originales)
})

test('ediciones antiguas contradictorias no eligen una OM arbitrariamente', () => {
  const { filas } = buscarTareas('1001', tareasDemo, [])
  filas[0] = { ...filas[0], duracionPrevista: '8', responsable: 'Douglas', personas: '2' }
  filas[1] = { ...filas[1], duracionPrevista: '9', responsable: 'Ale', personas: '3' }
  const originales = structuredClone(filas)
  const comun = datosDeTarea(tareasDemo[0], filas)
  assert.deepEqual(comun.datos, { duracionPrevista: '', responsable: '', personas: '' })
  assert.deepEqual(comun.conflictos, ['duración', 'responsable', 'personas'])
  assert.deepEqual(filas, originales)
  const corregidos = { duracionPrevista: '7', responsable: 'Pepe', personas: '4' }
  assert.deepEqual(datosDeTarea(tareasDemo[0], filas, corregidos), { datos: corregidos, conflictos: [] })
})
