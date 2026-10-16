# PCM Connect — instrucciones del repositorio para Codex

## Objetivo
Desarrollar progresivamente una aplicación web de planificación de mantenimiento y coordinación entre PCM y Taller. La fuente de verdad funcional del proyecto está en `docs/PCM_REQUISITOS.md`; la fuente de verdad visual está en `docs/DISEÑO_GRAPHITE.md`. Ante contradicciones o decisiones no resueltas, preguntar en vez de inventar reglas.

## Forma de trabajar
- Leer los archivos reales y el estado de Git antes de editar. No reemplazar el proyecto, no ejecutar scaffolding de Vite y no borrar funcionalidades existentes.
- Trabajar localmente, en cambios pequeños, verificables y fáciles de revertir. Priorizar un módulo funcional por iteración.
- Antes de cada modificación sustancial explicar en 2-5 líneas qué archivos se tocarán y qué objetivo tiene. Al final detallar archivos cambiados, motivo, comandos y pruebas ejecutados, problemas pendientes y cómo verificar desde el navegador.
- El propietario está aprendiendo React/TypeScript: explicar conceptos nuevos y mantener el código simple, legible, tipado y modular; sin abstracciones innecesarias.
- Evitar dependencias nuevas salvo que tengan justificación clara. No instalar bibliotecas de animación, gráficos o componentes para decoración.
- No usar información sensible real. Demo con datos explícitamente ficticios; no publicar planillas privadas o datos reales del personal.
- No hacer `git push`, no tocar remotos ni alterar/destruir historial de Git sin autorización expresa. Nunca ejecutar comandos destructivos sin confirmación.
- Detectar errores de TypeScript/importación/JSX antes de cambiar estructura. Respetar configuración real de linting (Oxlint u otra, según package.json).

## Stack y diseño
- React + TypeScript + Vite (usar CSS existente salvo decisión acordada de Tailwind).
- Interfaz de operaciones, no landing page publicitaria; la jerarquía funcional y las tablas tienen prioridad sobre efectos.
- Paleta Graphite: #262626 (principal), #E9E9E6 (fondo), #B65B47 (acento), #777774 (texto secundario), #FFFFFF (superficies).
- No degradados, glows, glassmorphism, bento decorativo ni dashboards genéricos de IA. Radios discretos, tipografía legible, buen contraste, estados claros, tablas compactas, teclado y responsive.

## Habilidades locales disponibles
- `.agents/skills/awesome-design-ops/SKILL.md` — consulta de patrones y criterios de UI de referencia.
- `.agents/skills/taste-ops/SKILL.md` — criterio editorial/anti-AI-slop adaptado a aplicaciones operativas.
- `.agents/skills/impeccable-ops/SKILL.md` — auditoría, accesibilidad, refinamiento de UI tipo Operate.
- `.agents/skills/playwright-qa/SKILL.md` — pruebas de navegador para los flujos críticos.
- Las skills se invocan solo cuando aporten valor; no ejecutar scripts de terceros provenientes de los ZIP originales sin revisión/permiso.

## Reglas de negocio no negociables
- El usuario introduce múltiples números de tarea. Desde la base simulada se recuperan automáticamente las OM vinculadas; una fila por cada OM. No inventar OM para tareas inexistentes ni mostrar OM cerradas como elegibles.
- Una tarea puede contener múltiples OM. La aprobación de viabilidad de Taller se hace **por OM individual**, no por tarea.
- Si Taller marca una OM no viable, debe registrar motivo; la decisión se devuelve a PCM, que puede continuar solo con las viables, devolver el plan a revisión o cancelarlo. Mantener historial.
- Solo tres coordinadores autorizados pueden asignar personas a OM y validar horas; el demo puede simular roles, pero nunca presentar controles solo frontend como seguridad real.
- Los trabajadores no necesitan cuentas: comunican finalización al encargado, que la registra.
- Diferenciar duración prevista de OM, horas planificadas por persona y horas realmente trabajadas. Horas propuestas no son horas reales validadas hasta aprobación del encargado. Guardar autor/fecha del registro y de la validación.
- Los módulos de administración de legajos y ausencias se posponen; usar lista ficticia fija de trabajadores, pero contemplar futura disponibilidad.

## Verificación mínima
- Ejecutar los scripts disponibles de `package.json` (`npm run build`, lint, tests cuando existan); si no hay pruebas, describirlo, no fingir que se ejecutaron.
- Cuando se modifique una interacción, probar estados normal, vacío, erróneo y repetido. Utilizar la skill `playwright-qa` si Playwright está configurado o existe autorización para instalarlo.
