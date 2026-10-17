# Iteración 2 · Preparación compacta por OM

Actualización posterior: los costos ahora se expresan en guaraníes y el responsable se elige entre Douglas, Ale y Pepe. Véase [costos, fuentes y supuestos](COSTOS_ESTIMADOS_PYG.md).

## Alcance

Cambios locales sobre el proyecto existente, según la solicitud de esta iteración. La duración se puede editar por OM; esto actualiza el acuerdo inicial que solo permitía editar responsable y personas. Se conserva Graphite, la navegación y el borrador en memoria. No se agregaron dependencias ni módulos nuevos de negocio.

## Archivos modificados

- `src/data/tareas.ts`: descripción obligatoria y costo numérico opcional por OM. Tareas ficticias con costos estimados en guaraníes a partir de referencias públicas y supuestos documentados. Lista de responsables: Douglas, Ale y Pepe.
- `src/features/busquedaTareas.ts`: inicialización y validación de la duración editable, agrupación de filas por tarea y suma de costos conocidos con conteo de costos pendientes. Se conservan exclusiones y deduplicación por OM.
- `src/components/BusquedaTareas.tsx`: buscador compacto, avisos desplegables completos, descripción inmediatamente después de OM, celda de tarea con `rowSpan`, duración editable y resumen de costos. Área deja de mostrarse; responsable sigue vacío inicialmente y editable por OM.
- `src/App.css`: densidad del formulario y de la tabla, lista de avisos con altura limitada y desplazamiento, estilos de agrupación y adaptación del formulario a pantallas estrechas. Navegación sin cambios.
- `tests/busquedaTareas.test.ts`: se amplían los casos existentes y se agregan pruebas de descripción/costos independientes, duración, base original intacta, agrupación, suma y valores desconocidos.
- Este documento: decisiones y pasos de comprobación.

## Datos y estado

| Tarea | OM abierta | Descripción | Duración inicial (h) | Costo (Gs.) |
| --- | --- | --- | --- | --- |
| 1001 | OM-001 | Reemplazar sello de bomba auxiliar | 3 | 370.000 |
| 1001 | OM-002 | Alinear acoplamiento del motor | 2 | 350.000 |
| 1003 | OM-004 | Verificar protecciones del tablero eléctrico | 1,5 | 250.000 |
| 0010-A | OM-007 | Revisar circuito de agua de servicio | 4 | 450.000 |

`horasPrevistas` conserva la estimación original de la base. `duracionPrevista` es el texto del input controlado por React: admite un campo temporalmente vacío para poder editar y mostrar el error. Solo es válido si representa un número finito mayor que cero. No se calculan horas-persona ni horas reales.

Los grupos solo ordenan la presentación: cada OM mantiene su propia fila, identidad y campos. El número de tarea usa un encabezado `scope="rowgroup"` que abarca las filas de su `tbody`. El área se conserva en el modelo y en el borrador, sin copiarla a responsable.

Si todos los costos están definidos, se muestra el total. Si alguno falta, se muestra el subtotal conocido y se indica que el total está pendiente. Si no hay ningún costo conocido, se muestra «Sin definir»; un costo explícitamente igual a cero sí se considera conocido. Repetir una búsqueda conserva las ediciones y no duplica filas ni costos.

## Comprobaciones ejecutadas

- Antes de editar: `npm run build`, `npm run lint` y `npm test` correctos (7 pruebas).
- Después de implementar: `npm run build` correcto, incluida comprobación TypeScript con `tsc -b`; `npm run lint` correcto con Oxlint; `npm test` correcto (13 pruebas).
- `git diff --check`: sin errores de espacios; Git advierte su conversión habitual LF/CRLF.
- `npm run dev -- --host 127.0.0.1`: Vite inicia; la página y el componente transformado responden HTTP 200.
- La herramienta de interfaz devuelve un inventario de navegadores vacío y rechaza abrir el navegador integrado como no disponible. No se ejecutaron pruebas de interacción real ni inspección visual. Playwright no está instalado y no se instalaron dependencias.

## Cómo verificar en el navegador

1. Ejecutar `npm run dev`, abrir la URL de Vite y entrar a **Tareas**. Verificar formulario compacto, estado vacío y costo «Sin OM». Buscar sin texto: aparece un aviso desplegable sin agregar filas. Enter en el textarea sigue permitiendo pegar/escribir varias líneas.
2. Buscar `1001`: deben aparecer dos filas de OM, con la tarea 1001 una sola vez y su celda extendida verticalmente. La columna «Descripción del trabajo» aparece inmediatamente después de «N.º OM». Las duraciones son 3 y 2, y los costos 370.000 y 350.000; total Gs. 720.000. No aparece columna Área y ambos responsables comienzan sin seleccionar.
3. Cambiar duración de OM-001 a `4.25`, seleccionar Douglas, Ale o Pepe como responsable y editar personas. OM-002 debe conservar sus valores. Probar duración vacía, `0` y `-1`, y salir del campo: se informa el error. Corregir a `0.25`: desaparece. Responsable sin seleccionar y personas `0`, negativas o decimales siguen siendo inválidos.
4. Buscar otra vez `1001`: se mantienen dos filas, las ediciones y el mismo total. Ir a Planificación/Personal y volver: se conserva el borrador. Recargar reinicia la demo, con duraciones originales.
5. Agregar `1003`: solo se incorpora OM-004; OM-005 se informa como cerrada en los avisos. El total pasa a Gs. 970.000.
6. Agregar `0010-A`: OM-007 muestra Gs. 450.000; el total pasa a Gs. 1.420.000. El caso de costo desconocido sigue cubierto en las pruebas con una base específica sin costo.
7. Buscar `1002 1004 9999 1001 1001`: los avisos completos distinguen tarea cerrada, OM cerrada, tarea sin OM abiertas, inexistente y repetida. Abrir/cerrar el detalle con teclado y comprobar que una lista larga se desplaza dentro de su bloque. Los costos y filas previos se conservan.
8. A 375 px y con zoom de 200 %, revisar legibilidad, foco visible y que el desplazamiento horizontal quede dentro de la tabla. Recorrer campos con Tab/Shift+Tab y verificar etiquetas y errores por OM.

## Pendiente

Revisión visual y de interacción en navegador por el propietario. No se hicieron commits ni push. La persistencia sigue siendo solo en memoria; no se implementaron aprobaciones, Kanban ni asignación drag-and-drop.
