import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { Window } from 'happy-dom'
import type { Plan, Registro } from '../src/features/modulo1/modelo.ts'

test('v1.3 React: catálogo, importación, edición, recuperación, reapertura, envío y recepción', async () => {
  const dom = new Window({ url: 'http://localhost:5173' })
  const originales = new Map<string, PropertyDescriptor | undefined>()
  for (const [k, valor] of Object.entries({
    window: dom,
    document: dom.document,
    navigator: dom.navigator,
    HTMLElement: dom.HTMLElement,
    Event: dom.Event,
    IS_REACT_ACT_ENVIRONMENT: true
  })) {
    originales.set(k, Object.getOwnPropertyDescriptor(globalThis, k))
    Object.defineProperty(globalThis, k, { configurable: true, value: valor, writable: true })
  }
  Object.defineProperty(dom.navigator, 'locks', {
    value: { request: async (_nombre: string, fn: () => unknown) => fn() }
  })
  dom.confirm = () => true
  const { act, createElement } = await import('react')
  const { createRoot } = await import('react-dom/client')
  const vite = await createServer({
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: 'custom'
  })
  const contenedor = dom.document.createElement('div')
  dom.document.body.append(contenedor)
  let root = createRoot(contenedor as unknown as Element)
  const estado = () => JSON.parse(dom.localStorage.getItem('pcm-connect.modulo1.v13') ?? '{}') as Registro
  async function esperar(accion: () => void | Promise<void>) {
    await act(async () => {
      await accion()
      await new Promise((resolve) => setImmediate(resolve))
    })
  }
  function boton(nombre: string) {
    const encontrados = [...contenedor.querySelectorAll('button')].filter(
      (e) => e.textContent.trim() === nombre
    )
    assert.equal(encontrados.length, 1, `Botón único: ${nombre}`)
    return encontrados[0]
  }
  async function click(nombre: string) {
    await esperar(() => {
      boton(nombre).click()
    })
  }
  function campo(nombre: string) {
    const aria = [...contenedor.querySelectorAll('input,select,textarea')].find(
      (e) => e.getAttribute('aria-label') === nombre
    )
    if (aria) return aria
    const etiqueta = [...contenedor.querySelectorAll('label')].find(
      (e) => e.childNodes[0]?.textContent === nombre
    )
    const control = etiqueta?.querySelector('input,select,textarea')
    assert.ok(control, `Campo: ${nombre}`)
    return control
  }
  async function cambiar(nombre: string, valor: string) {
    const elemento = campo(nombre) as HTMLInputElement
    await esperar(() => {
      const prototipo =
        elemento.tagName === 'SELECT'
          ? dom.HTMLSelectElement.prototype
          : elemento.tagName === 'TEXTAREA'
            ? dom.HTMLTextAreaElement.prototype
            : dom.HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(prototipo, 'value')!.set!.call(elemento, valor)
      elemento.dispatchEvent(
        new dom.Event(elemento.tagName === 'SELECT' ? 'change' : 'input', {
          bubbles: true
        }) as unknown as Event
      )
    })
  }
  async function enviarFormulario(elemento: Element) {
    await esperar(() => {
      elemento.dispatchEvent(new dom.Event('submit', { bubbles: true, cancelable: true }) as unknown as Event)
    })
  }
  try {
    const { default: App } = await vite.ssrLoadModule('/src/App.tsx')
    await esperar(() => root.render(createElement(App)))
    assert.match(contenedor.textContent, /Sin importaciones/u)
    await click('Enviar a Taller')
    assert.match(contenedor.querySelector('[role=alert]')!.textContent, /Agregá al menos/u)
    await click('Guardar borrador')
    assert.equal(estado().planes.length, 1)
    assert.equal(estado().planes[0].tag, 'PCM-000001')
    await cambiar('Rol simulado (demo)', 'Administrador')
    await click('Catálogos')
    await cambiar('Nombre', 'Remolcador FICTICIO QA')
    await enviarFormulario(contenedor.querySelector('.m1-form-catalogo') as unknown as Element)
    assert.equal(estado().catalogos.remolcadores.length, 1)
    await cambiar('Catálogo', 'ubicaciones')
    await cambiar('Nombre', 'Ubicación FICTICIA QA')
    await enviarFormulario(contenedor.querySelector('.m1-form-catalogo') as unknown as Element)
    assert.equal(estado().catalogos.ubicaciones.length, 1)
    await click('Planificación')
    await click('Preparar ejemplo ficticio')
    await click('Confirmar importación')
    assert.equal(estado().fuente.length, 2)
    // El buscador usa label htmlFor y se identifica por su id público.
    await esperar(() => {
      const buscador = contenedor.querySelector('#m1-busqueda')!
      Object.getOwnPropertyDescriptor(dom.HTMLTextAreaElement.prototype, 'value')!.set!.call(
        buscador,
        'DEMO-1001 DEMO-PM-02 DEMO-1001 NO-EXISTE'
      )
      buscador.dispatchEvent(new dom.Event('input', { bubbles: true }) as unknown as Event)
    })
    await enviarFormulario(contenedor.querySelector('.entrada-busqueda') as unknown as Element)
    assert.equal(contenedor.querySelectorAll('.m1-tabla tbody tr').length, 2)
    assert.match(contenedor.textContent, /720\.000/u)
    assert.match(contenedor.textContent, /NO-EXISTE/u)
    await cambiar('Remolcador', estado().catalogos.remolcadores[0].id)
    await cambiar('Ubicación', estado().catalogos.ubicaciones[0].id)
    await cambiar('ETA · hora de Montevideo', '2026-11-03T23:30')
    await cambiar('Tiempo de parada (h)', '2')
    await cambiar('Tiempo propuesto de DEMO-1001', '4')
    await cambiar('Trabajadores propuestos de DEMO-1001', '2')
    await cambiar('Trabajadores propuestos de DEMO-PM-02', '1')
    await cambiar('Responsable de DEMO-1001', 'responsable-1')
    await cambiar('Responsable de DEMO-PM-02', 'responsable-7')
    assert.match(contenedor.textContent, /no bloquea el envío/u)
    assert.match((campo('Fin de parada · Montevideo') as HTMLInputElement).value, /4\/11\/26/u)
    await click('Guardar borrador')
    assert.equal(estado().planes[0].filas[0].tiempoOriginal, 3)
    assert.equal(estado().planes[0].filas[0].tiempoPropuesto, '4')
    await cambiar('Trabajadores propuestos de DEMO-1001', '3')
    assert.ok(
      [...Array(dom.localStorage.length)]
        .map((_, i) => dom.localStorage.key(i))
        .some((k) => k?.includes('recuperacion'))
    )
    await esperar(() => root.unmount())
    root = createRoot(contenedor as unknown as Element)
    await esperar(() => root.render(createElement(App)))
    assert.equal((campo('Trabajadores propuestos de DEMO-1001') as HTMLInputElement).value, '3')
    assert.equal(estado().planes[0].filas[0].trabajadores, '2')
    await click('Limpiar')
    await click('Conservar cambios')
    assert.equal((campo('Trabajadores propuestos de DEMO-1001') as HTMLInputElement).value, '3')
    await click('Limpiar')
    await click('Confirmar limpieza')
    assert.equal(estado().planes.length, 1)
    assert.equal(contenedor.querySelectorAll('.m1-tabla tbody tr').length, 0)
    await cambiar('Abrir planificación guardada', estado().planes[0].id)
    assert.equal((campo('Trabajadores propuestos de DEMO-1001') as HTMLInputElement).value, '2')
    await esperar(() => {
      boton('Enviar a Taller').click()
      boton('Enviar a Taller').click()
    })
    let persistido: Plan = estado().planes[0]
    assert.equal(persistido.estado, 'Enviado a Taller')
    assert.equal(estado().planes.length, 1)
    assert.equal(persistido.tag, 'PCM-000001')
    assert.equal(persistido.filas.length, 2)
    await cambiar('Rol simulado (demo)', 'Taller')
    await click('Validación Taller')
    assert.match(contenedor.textContent, /Ejecución externa/u)
    assert.equal(contenedor.querySelectorAll('.m1-taller form').length, 1)
    await click('Registrar evaluación de DEMO-1001')
    await click('Finalizar evaluación')
    persistido = estado().planes[0]
    assert.equal(persistido.estado, 'Evaluado')
    assert.equal(Object.keys(persistido.evaluaciones).length, 1)
    assert.equal(persistido.evaluaciones['DEMO-1001'].resultado, 'Aceptada')
    const { leerLocal } = await vite.ssrLoadModule('/src/features/modulo1/persistencia.ts')
    const corrupto = { ...estado(), contador: 0 }
    const texto = JSON.stringify(corrupto)
    dom.localStorage.setItem('pcm-connect.modulo1.v13', texto)
    assert.throws(() => leerLocal(dom.localStorage), /guardado.*dañado/u)
    assert.equal(dom.localStorage.getItem('pcm-connect.modulo1.v13'), texto)
  } finally {
    await act(async () => root.unmount())
    await vite.close()
    await dom.happyDOM.close()
    for (const [k, descriptor] of originales) {
      if (descriptor) Object.defineProperty(globalThis, k, descriptor)
      else Reflect.deleteProperty(globalThis, k)
    }
  }
})
