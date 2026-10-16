# Prompt inicial — copiar en Codex (GPT-6 Astra · High)

Quiero que trabajes en **PCM Connect**, dentro del repositorio React + TypeScript + Vite que tengo ABIERTO en VS Code. NO crees otro proyecto y NO reemplacés los archivos actuales por una plantilla.

**Leé primero, en este orden:** `AGENTS.md`, `docs/PCM_REQUISITOS.md`, `docs/DISEÑO_GRAPHITE.md` y los archivos actuales de `src/` / `package.json`. Descubrí las skills locales de `.agents/skills/` y usá las relevantes (`awesome-design-ops`, `taste-ops`, `impeccable-ops`, `playwright-qa`) según las necesidades; son adaptaciones de los ZIP originales. No instales ni ejecutes scripts de terceros automáticamente.

**Contexto:** Somos PCM y Taller. PCM carga números de tarea; el sistema obtiene las OM ligadas desde una base ficticia; cada OM va en una fila diferente, únicamente si está abierta. Luego Taller evalúa viabilidad **por OM** y devuelve las no viables con motivo. PCM confirma continuar solo con las viables, devuelve a revisión o cancela. Solo 3 encargados asignan OM a trabajadores de lista fija, registran finalizaciones y aprueban/corrigen horas reales. Los trabajadores no se loguean. Se requiere trazabilidad. Diseño obligatorio: Graphite `#262626 #E9E9E6 #B65B47 #777774 #FFFFFF`; sobrio, industrial, alta legibilidad, sin AI slop.

**Tu trabajo EN ESTA PRIMERA ITERACIÓN (no intentes desarrollar todos los módulos):**
1. Inspeccioná y describí el estado REAL del repositorio y el estado de Git. Identificá errores de compilación, TypeScript, JSX, lint y estructura actuales; no des por ciertos los errores de una captura antigua.
2. Corregí errores existentes con el mínimo cambio que preserve el diseño y la navegación. Confirmá que compile (ejecutá `npm run build` y el lint disponible; si falta algo, explicá).
3. Construí o completá **solo la primera pantalla operativa**: ingreso de varios números de tarea (separados por coma, espacio o salto de línea), búsqueda en `src/data/tareas.ts` o base mock equivalente, generación de UNA FILA POR CADA OM, exclusión de cerradas, avisos por IDs inexistentes/cerrados, sin duplicar resultados. Campos de responsable y cantidad de personas editables por OM, con validación básica. Respetá las pantallas existentes y agregá tipos/archivos chicos si hace falta.
4. Datos totalmente ficticios, pero realistas; sin backend ni autenticación real en esta fase. Criticidad Baja por defecto y costos «Sin definir» si faltan. No confundir horas de OM y horas-persona.
5. Asegurá experiencia cuidada, accesible y responsive (tablas con scroll horizontal, mensajes de estado, indicadores no dependientes solo de color). Sin bibliotecas pesadas, animaciones gratuitas ni estilos genéricos de IA.
6. Verificá desde el navegador si tenés esa capacidad; de otro modo explicá la prueba manual paso a paso. No instales Playwright sin pedir autorización si todavía no está instalado.
7. Al finalizar, explicame en **español claro**, archivo por archivo: qué cambiaste, para qué sirve, cómo probarlo en `npm run dev`, y qué aprendemos de React/TypeScript en esta iteración.

**Restricciones:** no hacer `git push`; no borrar funcionalidades; no inventar credenciales, OM reales, procedimientos corporativos ni decisiones aún pendientes. Si un requisito afecta el resultado y falta información, preguntame primero; si es secundario, usá un supuesto de demo explícito y reversible.

Después de esta primera iteración, esperá mi aprobación antes de pasar al flujo Taller → respuesta PCM y módulos de asignación/horas. Quiero revisar los cambios paso a paso y aprender a programar.
