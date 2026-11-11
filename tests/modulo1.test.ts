import test from 'node:test'
import assert from 'node:assert/strict'
import { agregarTareas, elegibles, erroresEnvio, etaDesdeInput, finParada, inputDesdeEta, nuevoPlan, registroInicial, valorTotal } from '../src/features/planificacion/model/modelo.ts'
import { aplicarComando } from '../src/features/planificacion/model/comandos.ts'
import type { Actor, Comando, Registro } from '../src/types/pcm.ts'
import { columnasImportacion, convertirFilas, convertirHoja, leerCSV } from '../src/features/planificacion/services/importacion.ts'
import { fuenteFicticia } from '../src/features/planificacion/data/fuenteFicticia.ts'
import { readSheet } from 'read-excel-file/node'
import { fileURLToPath } from 'node:url'
import { validarComando } from '../src/features/planificacion/model/validacion.ts'

const pcm: Actor = { id: 'pcm-ficticio', nombre: 'Planificador ficticio', rol: 'Planificador' }
const admin: Actor = { id: 'admin-ficticio', nombre: 'Administrador ficticio', rol: 'Administrador' }
const taller: Actor = { id: 'taller-ficticio', nombre: 'Taller ficticio', rol: 'Taller' }
const fecha = '2026-11-04T02:30:00.000Z'
let secuencia = 0
function aplicar(r: Registro, c: Comando, a: Actor = pcm, id = `solicitud-prueba-${++secuencia}`) {
  validarComando(c)
  return aplicarComando(r, c, a, id, fecha)
}
function base() {
  let r = aplicar(registroInicial(), {
    tipo: 'importar',
    tareas: structuredClone(fuenteFicticia),
    procedencia: 'Archivo ficticio para pruebas.csv'
  })
  for (const [catalogo, id, nombre] of [
    ['remolcadores', 'demo-remolcador', 'Remolcador FICTICIO'],
    ['ubicaciones', 'demo-ubicacion', 'Ubicación FICTICIA']
  ] as const)
    r = aplicar(
      r,
      { tipo: 'catalogo', catalogo, entrada: { id, nombre, activo: true, externo: false } },
      admin
    )
  return r
}
function propuesta(r: Registro, id = 'plan-ficticio-000001') {
  const plan = agregarTareas(nuevoPlan(pcm, id), 'DEMO-1001 DEMO-PM-02', r).plan
  return {
    ...plan,
    remolcadorId: 'demo-remolcador',
    ubicacionId: 'demo-ubicacion',
    eta: fecha,
    horasParada: '2',
    filas: plan.filas.map((f) => ({ ...f, trabajadores: '2', responsableId: 'responsable-1' }))
  }
}
test('v1.3: fin de parada cruza día y año, usa Montevideo y rechaza fechas imposibles', () => {
  assert.equal(etaDesdeInput('2026-12-31T23:30'), '2027-01-01T02:30:00.000Z')
  assert.equal(
    finParada({ eta: etaDesdeInput('2026-12-31T23:30'), horasParada: '2.5' }),
    '2027-01-01T05:00:00.000Z'
  )
  assert.equal(inputDesdeEta('2027-01-01T02:30:00.000Z'), '2026-12-31T23:30')
  for (const v of ['2026-02-30T10:00', '', '2026-13-01T00:00']) assert.equal(etaDesdeInput(v), '')
  for (const v of ['', '0', '-1', 'Infinity']) assert.equal(finParada({ eta: fecha, horasParada: v }), '')
})
test('v1.3: busca múltiples IDs, agrupa solo Valor aprobado y preserva originales al repetir', () => {
  const r = base()
  const p = nuevoPlan(pcm, 'plan-ficticio-000001')
  assert.equal(agregarTareas(p, '', r).avisos.length, 1)
  const encontrado = agregarTareas(p, 'DEMO-1001,DEMO-PM-02 DEMO-1001 NO-EXISTE', r)
  assert.equal(encontrado.plan.filas.length, 2)
  assert.equal(encontrado.plan.filas[0].ordenes.length, 2)
  assert.equal(valorTotal(encontrado.plan.filas[0].ordenes), 720000)
  assert.equal(encontrado.avisos.length, 2)
  encontrado.plan.filas[0].tiempoPropuesto = '8'
  assert.equal(agregarTareas(encontrado.plan, 'DEMO-1001', r).plan.filas[0].tiempoPropuesto, '8')
  assert.equal(encontrado.plan.filas[0].tiempoOriginal, 3)
  assert.equal(r.fuente[0].tiempoOriginal, 3)
  assert.equal(valorTotal([...encontrado.plan.filas[0].ordenes, ...encontrado.plan.filas[0].ordenes]), 720000)
  assert.equal(valorTotal([{ numero: '1', estado: 'Valor aprobado', valor: null }]), null)
  assert.equal(
    elegibles({ ...r.fuente[0], ordenes: [{ numero: '1', estado: 'Abierta', valor: 1 }] }).length,
    0
  )
})
test('v1.3: borrador incompleto, TAG permanente, recarga y envío idempotente', () => {
  let r = base()
  let plan = nuevoPlan(pcm, 'plan-ficticio-000001')
  plan.eta = fecha
  r = aplicar(r, { tipo: 'guardar', plan, enviar: false })
  plan = r.planes[0]
  assert.equal(plan.tag, 'PCM-000001')
  assert.equal(plan.version, 1)
  r = JSON.parse(JSON.stringify(r)) as Registro
  plan = { ...propuesta(r), tag: plan.tag, version: plan.version }
  const comando: Comando = { tipo: 'guardar', plan, enviar: true }
  r = aplicar(r, comando, pcm, 'envio-idempotente-0001')
  const repetido = aplicar(r, comando, pcm, 'envio-idempotente-0001')
  assert.deepEqual(repetido, r)
  assert.equal(r.contador, 1)
  assert.equal(r.planes[0].tag, 'PCM-000001')
  assert.equal(r.planes[0].estado, 'Enviado a Taller')
  assert.equal(r.planes[0].filas[0].tiempoOriginal, 3)
  assert.equal(r.historial.at(-1)?.anterior && typeof r.historial.at(-1)?.anterior, 'object')
  assert.throws(() => aplicar(r, { ...comando, enviar: false }), /ya fue enviada/u)
})
test('v1.3: valida envío pero permite borrador incompleto y advertencia individual no bloqueante', () => {
  const r = base()
  const p = propuesta(r)
  assert.equal(erroresEnvio(p, r).length, 0) // 3 h y 5 h superan parada de 2 h; no bloquea.
  assert.equal(aplicar(r, { tipo: 'guardar', plan: p, enviar: true }).planes[0].estado, 'Enviado a Taller')
  const vacio = nuevoPlan(pcm, 'plan-ficticio-000002')
  assert.ok(erroresEnvio(vacio, r).length >= 5)
  assert.throws(() => aplicar(r, { tipo: 'guardar', plan: vacio, enviar: false }), /ETA/u)
  vacio.eta = fecha
  assert.throws(() => aplicar(r, { tipo: 'guardar', plan: vacio, enviar: true }), /Agregá al menos/u)
  assert.equal(aplicar(r, { tipo: 'guardar', plan: vacio, enviar: false }).planes.length, 1)
  for (const trabajadores of ['0', '1.5', '-2', '1e2'])
    assert.ok(
      erroresEnvio({ ...p, filas: [{ ...p.filas[0], trabajadores }] }, r).some((e) =>
        e.includes('entero positivo')
      )
    )
})
test('v1.3: conflictos dentro y entre planes identifican el TAG; no duplica por doble envío', () => {
  let r = base()
  const p = propuesta(r)
  assert.throws(
    () => aplicar(r, { tipo: 'guardar', plan: { ...p, filas: [p.filas[0], p.filas[0]] }, enviar: false }),
    /duplicada/u
  )
  r = aplicar(r, { tipo: 'guardar', plan: p, enviar: false })
  const nuevo = { ...p, id: 'plan-ficticio-000002' }
  assert.throws(() => aplicar(r, { tipo: 'guardar', plan: nuevo, enviar: false }), /PCM-000001/u)
  assert.match(agregarTareas(nuevoPlan(pcm, 'plan-ficticio-000002'), 'DEMO-1001', r).avisos[0], /PCM-000001/u)
  assert.equal(r.planes.length, 1)
})
test('v1.3: reimportar detecta valores, estados, vínculos y eliminaciones, conserva planes e historial', () => {
  let r = base()
  r = aplicar(r, { tipo: 'guardar', plan: propuesta(r), enviar: false })
  const antes = structuredClone(r.planes[0])
  const fuente = structuredClone(r.fuente)
  fuente[0].ordenes[0].valor = 123
  fuente[0].ordenes[1].estado = 'Cerrada'
  fuente.pop()
  r = aplicar(r, { tipo: 'importar', tareas: fuente, procedencia: 'Nueva importación FICTICIA.csv' })
  assert.deepEqual(r.planes[0], antes)
  assert.equal(r.importaciones.at(-1)?.diferencias.length, 2)
  assert.ok(erroresEnvio(antes, r).some((e) => e.includes('fuente cambió')))
  const anteriorCantidad = r.fuente.length
  r = aplicar(r, { tipo: 'importar', tareas: fuente, procedencia: 'Reimportación.csv' })
  assert.equal(r.fuente.length, anteriorCantidad)
  assert.equal(r.importaciones.at(-1)?.diferencias.length, 0)
  assert.ok(r.importaciones[0].tareas[0].ordenes[0].valor !== 123)
})
test('v1.3: catálogos desactivados conservan referencias y bloquean nuevas selecciones', () => {
  let r = base()
  const p = propuesta(r)
  r = aplicar(r, { tipo: 'guardar', plan: p, enviar: true })
  const ref = r.catalogos.responsables[0]
  r = aplicar(
    r,
    {
      tipo: 'catalogo',
      catalogo: 'responsables',
      entrada: { ...ref, activo: false, nombre: 'Nombre actualizado' }
    },
    admin
  )
  assert.equal(r.planes[0].referencias[ref.id].nombre, 'TALLER MECÁNICO')
  assert.ok(erroresEnvio(p, r).some((e) => e.includes('responsable activo')))
  assert.throws(
    () =>
      aplicar(r, { tipo: 'catalogo', catalogo: 'responsables', entrada: { ...ref, externo: true } }, admin),
    /tipo de ejecución/u
  )
  assert.throws(
    () => aplicar(r, { tipo: 'catalogo', catalogo: 'ubicaciones', entrada: ref }),
    /Administración/u
  )
})
test('v1.3: Taller evalúa tarea completa, motivo obligatorio, tercerizada sin evaluación interna', () => {
  let r = base()
  const p = propuesta(r)
  p.filas[1].responsableId = 'responsable-7'
  r = aplicar(r, { tipo: 'guardar', plan: p, enviar: true })
  assert.throws(() => aplicar(r, { tipo: 'finalizar', planId: p.id }, taller), /pendientes/u)
  assert.throws(
    () =>
      aplicar(
        r,
        { tipo: 'evaluar', planId: p.id, tareaId: p.filas[0].id, resultado: 'Rechazada', motivo: '' },
        taller
      ),
    /motivo/u
  )
  assert.throws(
    () =>
      aplicar(
        r,
        { tipo: 'evaluar', planId: p.id, tareaId: p.filas[1].id, resultado: 'Aceptada', motivo: '' },
        taller
      ),
    /interno/u
  )
  r = aplicar(
    r,
    {
      tipo: 'evaluar',
      planId: p.id,
      tareaId: p.filas[0].id,
      resultado: 'Rechazada',
      motivo: 'Ejemplo ficticio: falta capacidad'
    },
    taller
  )
  assert.equal(r.planes[0].estado, 'En evaluación')
  assert.equal(Object.keys(r.planes[0].evaluaciones).length, 1)
  assert.equal(r.planes[0].filas[0].ordenes.length, 2)
  r = aplicar(r, { tipo: 'finalizar', planId: p.id }, taller)
  assert.equal(r.planes[0].estado, 'Evaluado')
  assert.equal(r.planes[0].filas.length, 2)
  assert.equal(r.planes[0].evaluaciones['DEMO-PM-02'], undefined)
  assert.throws(() => aplicar(r, { tipo: 'guardar', plan: p, enviar: false }, taller), /Solo Planificador/u)
})
test('v1.3: CSV conserva ceros, comillas y saltos; deduplica idénticas y rechaza contradicciones', () => {
  const csv =
    '\uFEFF' +
    columnasImportacion.join(';') +
    '\r\n0010-A;OM-001;Valor aprobado;12345;"Descripción; con\nsalto";1,5;Alta;Abierta\r\n0010-A;OM-001;Valor aprobado;12345;"Descripción; con\nsalto";1,5;Alta;Abierta'
  const resultado = convertirFilas(leerCSV(csv))
  assert.equal(resultado.tareas[0].id, '0010-A')
  assert.equal(resultado.tareas[0].tiempoOriginal, 1.5)
  assert.equal(resultado.tareas[0].ordenes.length, 1)
  assert.equal(resultado.avisos.length, 1)
  const filas = leerCSV(csv)
  filas[2][3] = '999'
  assert.throws(() => convertirFilas(filas), /contradictorios/u)
  filas[2][0] = 'OTRA-TAREA'
  assert.throws(() => convertirFilas(filas), /vinculada a más de una tarea/u)
  assert.throws(() => convertirFilas([['TAREA']]), /Faltan columnas/u)
  assert.throws(() => leerCSV('a;"b'), /comillas sin cerrar/u)
})
test('v1.3: quitar y reordenar tareas de la propuesta no altera la fuente importada', () => {
  const r = base()
  const p = propuesta(r)
  const original = structuredClone(r.fuente)
  const invertido = { ...p, filas: [...p.filas].reverse() }
  const guardado = aplicar(r, { tipo: 'guardar', plan: invertido, enviar: false })
  assert.equal(guardado.planes[0].filas[0].id, 'DEMO-PM-02')
  const quitado = aplicar(guardado, {
    tipo: 'guardar',
    plan: { ...guardado.planes[0], filas: [guardado.planes[0].filas[1]] },
    enviar: false
  })
  assert.deepEqual(quitado.fuente, original)
  assert.equal(quitado.planes[0].filas.length, 1)
  assert.equal(quitado.historial.at(-1)?.usuario, pcm.nombre)
})
test('v1.3: importa XLSX real ficticio, conserva ceros, agrupa OM y excluye cerradas', async () => {
  const hoja = await readSheet(fileURLToPath(new URL('./fixtures/modulo1-ficticio.xlsx', import.meta.url)))
  const resultado = convertirHoja(hoja)
  assert.equal(resultado.tareas[0].id, '0010-A')
  assert.equal(resultado.tareas[0].tiempoOriginal, 2.5)
  assert.equal(resultado.tareas[0].ordenes.length, 3)
  assert.equal(valorTotal(elegibles(resultado.tareas[0])), 375000)
  hoja[1][0] = 10
  assert.throws(() => convertirHoja(hoja), /identificadores como texto/u)
})
test('v1.3: ETA inválida se rechaza en servidor y IDs con nombres de propiedades no omiten evaluación', () => {
  let r = base()
  const p = propuesta(r)
  assert.ok(erroresEnvio({ ...p, eta: '2026-02-30T00:00:00.000Z' }, r).some((e) => e.startsWith('ETA')))
  r.fuente[0].id = 'toString'
  p.filas = [{ ...p.filas[0], id: 'toString' }]
  r = aplicar(r, { tipo: 'guardar', plan: p, enviar: true })
  assert.throws(() => aplicar(r, { tipo: 'finalizar', planId: p.id }, taller), /pendientes/u)
})
