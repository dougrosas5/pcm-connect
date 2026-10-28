import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { actualizarPreparacion, crearPlanificacion, registroVacio } from '../src/features/planificaciones.ts'
import { buscarTareas } from '../src/features/busquedaTareas.ts'
import { tareasDemo } from '../src/data/tareas.ts'
import { actorPCM, decidirPCM, enviarATaller, evaluarOM, finalizarEvaluacion, rolesDemo } from '../src/features/validacionTaller.ts'

// Render real de los componentes con Vite/React, sin agregar un emulador de DOM.
// Comprueba la interfaz generada; no sustituye pruebas de interacción en navegador.
test('React renderiza navegación, vacío, permisos, resumen, decisiones e historial sin errores', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' })
  try {
    const { default: ValidacionTaller } = await vite.ssrLoadModule('/src/components/ValidacionTaller.tsx')
    const { default: App } = await vite.ssrLoadModule('/src/App.tsx')
    const vacio = renderToStaticMarkup(createElement(ValidacionTaller, { registro: registroVacio(), actor: actorPCM, guardar: () => true, bloqueado: false }))
    assert.match(vacio, /No hay planificaciones recibidas/u)

    let registro = crearPlanificacion(registroVacio(), { remolcador: 'Demo Norte', fechaParada: '2026-11-01', horasParada: '8' })
    registro = actualizarPreparacion(registro, 'PCM-0001', { filas: buscarTareas('1001', tareasDemo, []).filas })
    registro = actualizarPreparacion(registro, 'PCM-0001', { datosPorTarea: { '1001': { duracionPrevista: '3', responsable: 'Douglas', personas: '1' } } })
    registro = enviarATaller(registro, 'PCM-0001', actorPCM)
    const taller = { rol: 'Taller' as const, usuario: 'Taller ficticio' }
    for (const rol of rolesDemo) {
      const html = renderToStaticMarkup(createElement(ValidacionTaller, { registro, actor: { rol, usuario: rol }, guardar: () => true, bloqueado: false }))
      assert.match(html, /PCM-0001/u)
      assert.match(html, /OM-001/u)
      assert.match(html, /OM-002/u)
      assert.equal(html.includes('aria-label="Evaluación de OM-001"'), rol === 'Taller')
      assert.equal(html.includes('Finalizar evaluación'), rol === 'Taller')
      assert.equal(html.includes('Corregir OM-001'), rol === 'PCM')
    }
    registro = evaluarOM(registro, 'PCM-0001', 'OM-001', 'Viable', '', 2, taller)
    registro = evaluarOM(registro, 'PCM-0001', 'OM-002', 'No viable', 'Falta repuesto', 2, taller)
    registro = finalizarEvaluacion(registro, 'PCM-0001', taller)
    const pendiente = renderToStaticMarkup(createElement(ValidacionTaller, { registro, actor: actorPCM, guardar: () => true, bloqueado: false }))
    for (const texto of ['Continuar', 'Devolver a revisión', 'Cancelar planificación', 'Falta repuesto', 'Aprobada / solo lectura', 'Decisiones e historial']) assert.ok(pendiente.includes(texto), texto)
    assert.ok(!pendiente.includes('aria-label="Evaluación de OM-001"'))
    const cancelada = decidirPCM(registro, 'PCM-0001', 'Cancelar', 'Cambio de escala', true, actorPCM)
    const htmlCancelada = renderToStaticMarkup(createElement(ValidacionTaller, { registro: cancelada, actor: actorPCM, guardar: () => true, bloqueado: false }))
    assert.match(htmlCancelada, /Planificación cancelada/u)
    assert.match(htmlCancelada, /Cambio de escala/u)
    assert.ok(!htmlCancelada.includes('Corregir OM-002'))

    // Render de App carga el guardado por su interfaz de almacenamiento habitual.
    Object.assign(globalThis, { window: { localStorage: { getItem: () => JSON.stringify(registro) } } })
    const app = renderToStaticMarkup(createElement(App))
    for (const pagina of ['Planificación', 'Tareas', 'Validación Taller', 'Personal']) assert.ok(app.includes(`>${pagina}</button>`), pagina)
    assert.match(app, /Rol simulado \(demo\)/u)
    assert.match(app, /sin autenticación ni seguridad real/u)
  } finally {
    Reflect.deleteProperty(globalThis, 'window')
    await vite.close()
  }
})
