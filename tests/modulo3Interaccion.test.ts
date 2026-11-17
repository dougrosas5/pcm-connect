import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { Window } from 'happy-dom'
import { escenario } from './helpers/revisionFixtures.ts'
import type { Registro } from '../src/types/pcm.ts'

test('M3 React: modal, borrador, recarga, reenvío a Taller, ETA, advertencias, confirmación y cancelación', async () => {
  const dom = new Window({ url: 'http://localhost:5175' })
  const originales = new Map<string, PropertyDescriptor | undefined>()
  for (const [k, value] of Object.entries({ window: dom, document: dom.document, navigator: dom.navigator, HTMLElement: dom.HTMLElement, Event: dom.Event,
    requestAnimationFrame: (fn: () => void) => dom.requestAnimationFrame(fn), IS_REACT_ACT_ENVIRONMENT: true })) {
    originales.set(k, Object.getOwnPropertyDescriptor(globalThis, k))
    Object.defineProperty(globalThis, k, { configurable: true, writable: true, value })
  }
  Object.defineProperty(dom.navigator, 'locks', { value: { request: async (_: string, fn: () => unknown) => fn() } })
  dom.confirm = () => true
  const { act, createElement } = await import('react')
  const { createRoot } = await import('react-dom/client')
  const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
  const contenedor = dom.document.createElement('div')
  dom.document.body.append(contenedor)
  let root = createRoot(contenedor as unknown as Element)
  const clave = 'pcm-connect.modulo1.v13'
  const estado = () => JSON.parse(dom.localStorage.getItem(clave)!) as Registro
  const ambito = () => contenedor.querySelector('dialog[open]') ?? contenedor
  const visibles = (selector: string) => [...ambito().querySelectorAll(selector)].filter((e) => !e.closest('[hidden]'))
  async function esperar(fn: () => void | Promise<void>) { await act(async () => { await fn(); await new Promise((r) => setImmediate(r)) }) }
  function boton(nombre: string) {
    const encontrados = visibles('button').filter((e) => e.textContent.trim() === nombre)
    assert.equal(encontrados.length, 1, `Botón visible único: ${nombre}`)
    return encontrados[0]
  }
  const click = (nombre: string) => esperar(() => { boton(nombre).click() })
  function campo(nombre: string) {
    const etiqueta = visibles('label').find((e) => [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('') === nombre)
    const control = etiqueta?.querySelector('input,select,textarea')
    assert.ok(control, `Campo visible: ${nombre}`)
    return control
  }
  async function cambiar(nombre: string, valor: string) {
    const control = campo(nombre)
    await esperar(() => {
      const proto = control.tagName === 'SELECT' ? dom.HTMLSelectElement.prototype : control.tagName === 'TEXTAREA' ? dom.HTMLTextAreaElement.prototype : dom.HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(control, valor)
      control.dispatchEvent(new dom.Event(control.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
    })
  }
  async function marcar(texto: string) {
    const etiqueta = visibles('label').find((e) => e.textContent.includes(texto))
    assert.ok(etiqueta, texto)
    await esperar(() => { etiqueta.querySelector('input')!.click() })
  }
  try {
    const { default: App } = await vite.ssrLoadModule('/src/app/App.tsx')
    const { leerLocal } = await vite.ssrLoadModule('/src/services/pcm/persistencia.ts')
    dom.localStorage.setItem(clave, JSON.stringify(escenario()))
    dom.localStorage.setItem('pcm-connect.planificaciones.v1', 'Archivo histórico ficticio intacto')
    await esperar(() => root.render(createElement(App)))
    await click('Revisión PCM')
    await cambiar('Buscar TAG', 'NO-EXISTE')
    assert.match(contenedor.textContent, /No hay coincidencias/u)
    await click('Limpiar filtros')
    await cambiar('ETA final desde', '2026-12-20')
    await cambiar('ETA final hasta', '2026-12-01')
    assert.match(contenedor.textContent, /no puede ser posterior/u)
    await click('Limpiar filtros')
    await click('Revisar')
    assert.ok(contenedor.querySelector('dialog[open]'))
    assert.equal(boton('Confirmar planificación').hasAttribute('disabled'), true)
    assert.equal(visibles('label').some((e) => e.textContent.includes('Resolución de QA-1')), false)
    await cambiar('Resolución de QA-2', 'Tercerizada')
    dom.confirm = () => false
    await click('Cerrar revisión')
    assert.ok(contenedor.querySelector('dialog[open]'), 'Cierre descartado conserva el modal')
    await cambiar('Resolución de QA-3', 'Eliminada')
    assert.equal((campo('Resolución de QA-3') as unknown as HTMLSelectElement).value, '', 'Eliminar exige confirmación')
    dom.confirm = () => true
    await cambiar('Resolución de QA-3', 'Eliminada')
    await esperar(() => { boton('Guardar borrador').click(); boton('Guardar borrador').click() })
    assert.equal(estado().planes[0].revisionPCM?.tareas['QA-2'].resoluciones.length, 1)
    assert.equal(estado().planes[0].revisionPCM?.tareas['QA-3'].resoluciones.length, 1)
    assert.equal(estado().planes[0].estado, 'Evaluado')
    assert.equal(boton('Confirmar planificación').hasAttribute('disabled'), true)
    await click('Cerrar revisión')
    await esperar(() => root.unmount())
    root = createRoot(contenedor as unknown as Element)
    await esperar(() => root.render(createElement(App)))
    await click('Revisión PCM')
    await click('Revisar')
    assert.match(ambito().textContent, /Operativo: TERCERIZADO/u)
    assert.match(ambito().textContent, /Fuera de planificación activa/u)
    await cambiar('Resolución de QA-4', 'Devuelta a revisión')
    await cambiar('Horas propuestas de QA-4', '0')
    await click('Guardar borrador')
    assert.match(ambito().textContent, /horas positivas/u)
    assert.equal(estado().planes[0].estado, 'Evaluado')
    await cambiar('Horas propuestas de QA-4', '5')
    await click('Guardar borrador')
    assert.equal(estado().planes[0].estado, 'En reevaluación')
    assert.equal(estado().planes[0].filas.flatMap((f) => f.ordenes).length, 8)
    assert.equal(boton('Confirmar planificación').hasAttribute('disabled'), true)
    await click('Cerrar revisión')
    await cambiar('Rol simulado (demo)', 'Taller')
    await click('Validación Taller')
    await click('Consultar')
    assert.equal(visibles('form[aria-label]').length, 1, 'Solo la tarea corregida vuelve a Taller')
    await cambiar('Horas de Taller para QA-4', '10')
    await esperar(() => { ambito().querySelector('form[aria-label="Evaluar QA-4"]')!.dispatchEvent(new dom.Event('submit', { bubbles: true, cancelable: true })) })
    await click('Finalizar evaluación')
    assert.equal(estado().planes[0].estado, 'Evaluado')
    await cambiar('Rol simulado (demo)', 'Planificador')
    await click('Revisión PCM')
    await click('Confirmar')
    assert.equal(boton('Confirmar planificación').hasAttribute('disabled'), false)
    await cambiar('Nueva ETA final · Montevideo', '2026-12-16T09:00')
    await cambiar('Comentario del cambio (obligatorio)', 'Arribo ficticio postergado')
    assert.equal(boton('Confirmar planificación').hasAttribute('disabled'), true)
    await esperar(() => { ambito().querySelector('.m2-editor')!.dispatchEvent(new dom.Event('submit', { bubbles: true, cancelable: true })) })
    assert.equal(estado().planes[0].etaInicial, '2026-12-15T12:00:00.000Z')
    assert.equal(estado().planes[0].historialEta?.length, 1)
    assert.match(ambito().textContent, /Reprogramación requerida/u)
    assert.equal(boton('Confirmar planificación').hasAttribute('disabled'), true)
    await marcar('Reconozco los conflictos')
    await esperar(() => { boton('Confirmar planificación').click(); boton('Confirmar planificación').click() })
    assert.equal(estado().planes[0].estado, 'Confirmada')
    assert.equal(estado().historial.filter((e) => e.accion === 'confirmarPCM').length, 1)
    assert.equal(estado().planes[0].revisionPCM?.conflictos.length, 1)
    assert.match(ambito().textContent, /con advertencias/u)
    assert.equal(visibles('button').some((e) => e.textContent === 'Guardar borrador'), false)
    await click('Cerrar revisión')
    await click('Historial')
    await click('Ver')
    assert.match(ambito().textContent, /Arribo ficticio postergado/u)
    assert.match(ambito().textContent, /Falta repuesto FICTICIO/u)
    assert.deepEqual(leerLocal(dom.localStorage), estado())
    assert.equal(dom.localStorage.getItem('pcm-connect.planificaciones.v1'), 'Archivo histórico ficticio intacto')
    await click('Cerrar revisión')
    // Otro registro aislado comprueba la cancelación y permisos sin mutar archivos del usuario.
    await esperar(() => root.unmount())
    dom.localStorage.setItem(clave, JSON.stringify(escenario(true, 1)))
    root = createRoot(contenedor as unknown as Element)
    await esperar(() => root.render(createElement(App)))
    await cambiar('Rol simulado (demo)', 'Consulta')
    await click('Revisión PCM')
    await click('Ver')
    assert.equal(visibles('button').some((e) => e.textContent === 'Cancelar planificación'), false)
    await click('Cerrar revisión')
    await cambiar('Rol simulado (demo)', 'Planificador')
    await click('Confirmar')
    await click('Cancelar planificación')
    assert.equal(boton('Confirmar cancelación').hasAttribute('disabled'), true)
    await cambiar('Motivo de cancelación (obligatorio)', 'Cancelación FICTICIA de QA')
    await marcar('Confirmo cancelar toda')
    await click('Confirmar cancelación')
    assert.equal(estado().planes[0].estado, 'Cancelada')
    assert.equal(estado().planes[0].revisionPCM?.cancelacion?.motivo, 'Cancelación FICTICIA de QA')
    await click('Cerrar revisión')
    await click('Historial')
    await click('Ver')
    assert.match(ambito().textContent, /Cancelación FICTICIA de QA/u)
    const { ejecutar } = await vite.ssrLoadModule('/src/services/pcm/persistencia.ts')
    const guardado = estado()
    // Otro escritor o un fallo de almacenamiento jamás se convierte en éxito local.
    await assert.rejects(ejecutar({ tipo: 'cancelarPCM', planId: guardado.planes[0].id, version: guardado.planes[0].version, motivo: 'QA', confirmada: true }, guardado.revision - 1, { id: 'demo-local', nombre: 'QA', rol: 'Planificador' }, 'recibo-obsoleto-local'), /otra pestaña/u)
    assert.deepEqual(estado(), guardado)
    const dañado = structuredClone(guardado)
    dañado.planes[0].revisionPCM!.tareas['QA-1'].version = 99
    const textoDañado = JSON.stringify(dañado)
    dom.localStorage.setItem(clave, textoDañado)
    assert.throws(() => leerLocal(dom.localStorage), /guardada inválida/u)
    assert.equal(dom.localStorage.getItem(clave), textoDañado)
    dom.localStorage.setItem(clave, JSON.stringify(guardado))
  } finally {
    await act(async () => root.unmount())
    await vite.close()
    await dom.happyDOM.close()
    for (const [k, d] of originales) { if (d) Object.defineProperty(globalThis, k, d); else Reflect.deleteProperty(globalThis, k) }
  }
})
