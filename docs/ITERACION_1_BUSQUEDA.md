# Iteración 1 · Búsqueda de tareas y OM

## Estado inicial real

- React + TypeScript + Vite, con Oxlint. `npm run build` y `npm run lint` ya pasaban; no había errores de compilación, JSX o importaciones que reparar.
- No existían script de pruebas ni Playwright instalado.
- La tabla de Tareas mostraba OM de tareas abiertas, pero cada OM era solo un string: no podía excluir una OM cerrada dentro de una tarea abierta.
- Los campos de responsable/personas no estaban conectados al estado de React; no había búsqueda ni avisos.
- El CSS contenía un color inválido (`B8B8B5` sin `#`, ocultado por otra regla), fondos ajenos a Graphite y ninguna regla para la tabla o responsive.
- Git partía sin cambios en archivos versionados. `.agents/`, `AGENTS.md`, `LEEME_PRIMERO.txt`, `PROMPT_INICIAL_CODEX.md` y `docs/` ya estaban sin seguimiento. Se conservaron; no se hicieron commits, push ni cambios de remotos.

## Archivos de esta iteración

- `src/data/tareas.ts`: tipos de tarea/OM, estado y duración por OM; casos ficticios abiertos, cerrados, mixtos y un ID con ceros y guion.
- `src/features/busquedaTareas.ts`: búsqueda por comas/espacios/saltos de línea, exclusión de cerradas, avisos y deduplicación por número de OM. Validaciones de responsable y personas.
- `src/components/BusquedaTareas.tsx`: formulario, estado vacío, avisos, tabla y campos editables independientes por OM. Los errores aparecen al salir del campo y luego se actualizan al corregirlo.
- `src/App.tsx`: integración en Tareas, acceso desde Planificación y navegación conservada. El componente permanece montado y oculto al navegar para conservar el borrador en memoria.
- `src/App.css`: estilos de formulario/tabla, estados, scroll horizontal y navegación adaptable a pantallas estrechas.
- `src/index.css`: colores Graphite, foco de teclado y controles consistentes. El texto pequeño usa un gris más oscuro para mejorar contraste sobre el fondo.
- `index.html`: idioma español y título PCM Connect.
- `tests/busquedaTareas.test.ts`: siete pruebas de comportamiento con el ejecutor nativo de Node, sin dependencias nuevas.
- `package.json`: comando `npm test`.
- Este documento: decisiones de demo y guía de verificación.

## Supuestos explícitos de demo

- Cada búsqueda agrega OM a la preparación actual. Repetir una búsqueda conserva los valores editados y genera avisos; no duplica filas.
- Los IDs se comparan exactamente como strings: se conservan ceros, guiones y mayúsculas/minúsculas.
- Las duraciones ficticias se definen por OM para poder probar la pantalla; no resuelven la decisión pendiente sobre duración por tarea en producción. No se calculan horas-persona ni horas reales.
- Responsable empieza vacío; cantidad de personas empieza en 1, editable. El responsable debe tener entre 1 y 100 caracteres tras quitar espacios de los extremos; personas debe ser un entero positivo seguro.
- Criticidad ausente: Baja. Costo ausente: Sin definir. No se inventan monedas ni costos cero.
- Solo hay estado en memoria: se conserva al navegar, se pierde al recargar. No hay guardado persistente ni envío a Taller en esta iteración.

## Comprobaciones ejecutadas

- `npm run build`: correcto, antes y después de los cambios.
- `npm run lint`: correcto, antes y después de los cambios.
- `npm test`: siete pruebas aprobadas con Node 24.21.0 (ejecución nativa de TypeScript). Incluyen múltiples separadores, IDs con ceros/guiones, exclusión de tarea y OM cerradas, IDs inexistentes, vacío, repetición con conservación de ediciones, identidad única por OM y validación de campos.
- `npm run dev -- --host 127.0.0.1`: Vite inició correctamente; peticiones HTTP a la página y al componente de búsqueda transformado por Vite devolvieron 200. Esto verifica el servidor, no reemplaza la prueba de interacción en navegador.
- `git diff --check`: sin errores de espacios; Git informa su conversión habitual LF/CRLF en Windows.
- No se instalaron dependencias ni se ejecutaron scripts de los ZIP originales.
- La herramienta de interfaz devolvió un inventario de navegadores vacío y rechazó abrir el navegador integrado como no disponible. Las pruebas anteriores son de lógica, compilación y lint; la interacción real, teclado y apariencia responsive quedan para revisión manual.

## Cómo verificar en el navegador

1. Ejecutar `npm run dev` y abrir la URL que indique Vite. Entrar a Tareas o usar Buscar tareas y OM desde Planificación.
2. Verificar el estado inicial vacío. Buscar sin texto o con comas/espacios solamente: debe pedir al menos un número sin agregar filas.
3. Pegar `1001, 1002 1003` y en otra línea `1004 9999 0010-A 1001`. Deben aparecer exactamente cuatro filas: OM-001, OM-002, OM-004 y OM-007. Todas abiertas; criticidad Baja y costos Sin definir. Debe haber avisos de tarea cerrada, OM cerradas, ID inexistente y tarea repetida.
4. Editar responsable y personas de OM-001. Los valores de OM-002 deben permanecer independientes. Repetir la búsqueda: las cuatro filas y las ediciones se conservan.
5. Dejar responsable vacío o con espacios y salir del campo: debe aparecer un error. Corregirlo. Probar personas vacío, 0, -1 y 1.5: error; corregir a 2: desaparece. Ninguno de estos cambios debe modificar otra OM.
6. Ir a Planificación y volver a Tareas: se conserva el borrador. Recargar: vuelve al estado inicial, como advierte la pantalla.
7. Con la página recién recargada, buscar solo `9999`, luego `1002 1004`: la tabla permanece vacía y aparecen los avisos correspondientes.
8. Recorrer con Tab y Shift+Tab: foco visible, campos identificados por tarea y OM y región de tabla accesible. En el textarea, Enter agrega otra línea; el botón ejecuta la búsqueda.
9. A 375 px de ancho, comprobar navegación en la parte superior y desplazamiento horizontal dentro de la tabla, sin desplazar horizontalmente toda la página. Revisar también con zoom de 200 %.

## React y TypeScript en esta iteración

`useState` guarda el texto de búsqueda y las filas del borrador. Un input controlado recibe su `value` del estado y lo actualiza con `onChange`: React conoce lo que se escribió. Al editar usamos `map` para crear un nuevo arreglo y cambiar solo la OM indicada, sin modificar las demás.

Los tipos `Tarea`, `OrdenMantenimiento` y `FilaOM` describen qué datos existen y ayudan a detectar usos incorrectos al compilar. `Set` permite reconocer IDs y OM ya incluidos. La lógica de búsqueda es una función independiente de la interfaz, lo que permite probar las reglas sin instalar un navegador.

## Pendiente de aprobación

Revisión manual de la pantalla y decisiones de siguientes fases. No se desarrollaron evaluación de Taller, respuesta PCM, asignaciones, validación de horas, autenticación ni backend.
