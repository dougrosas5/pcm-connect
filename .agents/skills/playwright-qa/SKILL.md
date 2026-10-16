---
name: playwright-qa
description: Probar PCM Connect en navegador con Playwright Test: búsqueda múltiple, filas por OM, estados cerrados, permisos simulados, aprobaciones, drag and drop, validación de horas y responsive.
---

# Playwright QA para PCM Connect

Skill de pruebas construida a partir de la documentación compartida de Playwright. El ZIP entregado contiene el monorepo completo de Playwright, no una skill portátil para probar PCM; **no copiarlo ni ejecutarlo**.

1. Inspeccionar `package.json` y scripts antes de instalar algo. Si ya hay Playwright, reutilizarlo.
2. Si falta y el usuario aprueba instalar herramientas, añadir `@playwright/test` como dependencia de desarrollo y navegador (`npx playwright install chromium`).
3. Crear pruebas legibles por comportamiento y accesibles por roles/selectores estables (`getByRole`, `getByLabel`, etc.), no CSS frágil. Configurar `webServer` de Vite si corresponde.
4. Casos básicos: buscar múltiples tareas, mostrar OM en filas separadas, evitar duplicados, mensajes de IDs desconocidos y OM cerradas, modificar responsable/personas sin afectar otra OM, guardar/reabrir según implementación.
5. Para aprobación: Taller puede evaluar por OM, rechazos requieren motivo y PCM no asigna OM no viable. Para asignación: solo perfil encargado, sin superposición horaria. Para horas: propuesta pendiente no cuenta como validada.
6. Capturar fallos y reportar test, navegador, entorno, resultado y pasos reproducibles; no declarar pruebas que no se hayan ejecutado.
7. Respetar datos ficticios; pruebas no tocan datos empresariales.

Documentación de referencia resumida: `references/playwright-notes.md`.
