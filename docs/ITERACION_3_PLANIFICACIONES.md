# Iteración 3 · Cabecera y planificaciones locales

Datos totalmente ficticios. Implementación sobre la búsqueda existente; sin dependencias nuevas, backend, aprobaciones, Kanban ni nuevas asignaciones. No se hicieron commits ni push.

## Comportamiento

- **Planificación** muestra el selector de planes guardados, **Nueva planificación** y la sección **Datos generales de la planificación** antes del buscador. **Tareas** y el botón **Búsqueda de tareas** acceden al mismo espacio de trabajo. **Personal** conserva su aviso de módulo pendiente.
- Para crear se exige un remolcador de la lista ficticia, fecha de calendario válida y horas positivas y finitas, admitiendo decimales. Los campos incompletos muestran errores y no consumen números.
- Hasta guardar correctamente, el número dice **Se asigna al crear**. Después se muestra **Planificación 1** y **PCM-0001**, dos representaciones del mismo número. No existe un TAG adicional.
- La cabecera guardada es de consulta. Las OM continúan siendo editables con las validaciones anteriores. Cambiar de planificación cambia su buscador, avisos, filas y ediciones; no modifica el resto de los planes.
- Cada cambio en las tareas se guarda localmente. Volver desde Personal mantiene el espacio de trabajo; recargar recupera el plan seleccionado y sus datos guardados. Los campos de una nueva cabecera todavía no creada son temporales y no reservan números.
- La base ficticia, recuperación de OM, exclusión de cerradas, agrupaciones, descripciones, duraciones y suma de costos no cambiaron.

## Modelo y persistencia

`Preparacion` reúne el estado que antes pertenecía únicamente a `BusquedaTareas`: entrada, filas de OM, avisos, resumen y campos revisados. El componente ahora recibe ese estado y comunica los cambios a su contenedor (un componente controlado de React). Cada planificación tiene su propia `preparacion`.

Se usa exclusivamente la clave `pcm-connect.planificaciones.v1` de `localStorage`, con versión de formato, planes, código activo, borrador sin planificación y `ultimoNumero`. Las demás claves no se borran ni sobrescriben.

El contador histórico es independiente de la lista. El siguiente número supera tanto ese contador como los números existentes. Quitar planes en una futura iteración deberá conservar el contador; esta versión no agrega borrado ni cancelación. Editar, consultar, navegar o recargar no llama a la creación ni reserva números. Una escritura fallida no cambia el estado mostrado ni consume el número guardado.

La lectura comprueba estructura e identidades, incluyendo códigos duplicados. Un guardado dañado o de otra versión bloquea las escrituras y muestra un aviso; no lo reemplaza por una lista vacía. Si el navegador no permite guardar o agota su espacio, informa el fallo.

Este guardado pertenece al navegador y al origen (protocolo, host y puerto). Abrir otro puerto no comparte los datos. No es una base de datos ni una solución definitiva para edición simultánea entre varios usuarios. No garantiza transacciones concurrentes entre pestañas; para la demo conviene editar desde una sola pestaña. Borrar los datos del sitio elimina también el contador.

## Borrador sin planificación

Antes de crear el primer plan se puede seguir usando la búsqueda. Ese borrador sin número también se guarda; al crear la planificación se transfieren sus OM, ediciones, avisos y entrada una sola vez. La interfaz indica cuántas OM se incorporarán. Los planes siguientes empiezan sin OM.

La versión anterior solo tenía datos en memoria y no utilizaba almacenamiento del navegador ni archivos de tareas del usuario. No había una colección persistente previa que migrar. Esta implementación conserva el borrador sin planificación desde su nuevo mecanismo; no puede recuperar datos que una recarga de la versión anterior ya hubiera descartado.

## Archivos

- `src/components/Planificaciones.tsx`: formulario de cabecera, consulta de planes, guardado desde acciones y manejo de errores.
- `src/features/planificaciones.ts`: tipos, validación, numeración y actualización aislada de preparaciones.
- `src/features/almacenPlanificaciones.ts`: lectura, validación y escritura local en una clave propia.
- `src/data/remolcadores.ts`: tres embarcaciones ficticias.
- `src/components/BusquedaTareas.tsx`: adaptación a estado recibido y mensaje de guardado; conserva búsqueda y tabla.
- `src/App.tsx`: incorpora el espacio de planificaciones manteniendo las tres entradas de navegación.
- `src/App.css`: cabecera compacta y responsive con los tokens Graphite existentes.
- `tests/planificaciones.test.ts`: pruebas de validación, identidad, aislamiento y persistencia con un sustituto de la API de almacenamiento.
- `docs/PCM_REQUISITOS.md` y este documento: alcance de esta iteración y guía de comprobación.

## Verificación automatizada

- Antes de los cambios: `npm test` (13 pruebas), `npm run build` (incluye `tsc -b`) y `npm run lint` correctos.
- Después: `npm test` (24 pruebas), `npm run build` y `npm run lint` correctos.
- Las pruebas de persistencia escriben y vuelven a leer JSON mediante un sustituto de almacenamiento. Comprueban múltiples planes, ediciones independientes incluso de una misma OM, recuperación de selección y datos, códigos estables, contador histórico, borrador transferido una sola vez y fallos de almacenamiento sin sobrescritura.
- El navegador integrado no está disponible: el inventario devuelve cero navegadores y abrir `iab` devuelve `Browser is not available: iab`. Playwright no está configurado y el propietario indicó no instalarlo. No se ejecutaron pruebas de interacción ni recarga real en navegador; quedan los pasos manuales siguientes.

## Cómo verificar en el navegador

1. Ejecutar `npm run dev` y abrir la URL indicada por Vite. Mantener el mismo origen para toda la prueba. En **Planificación**, comprobar cabecera antes del buscador, estado Borrador y número pendiente de asignación.
2. Pulsar **Crear planificación** sin completar campos. Deben aparecer errores y no debe crearse un plan. Probar horas `0`, negativas y vacías; corregir a `8.5`. Verificar calendario y remolcador obligatorio.
3. Antes de crear, buscar `1001 1002 9999`: aparecen OM-001 y OM-002 y los avisos de tarea cerrada e inexistente. Editar duración de OM-001 a `4.25`, responsable a Douglas y personas a `2`. Recargar: el borrador sin número debe conservarse. Crear con Demo Norte, fecha válida y `8.5` horas: debe ser **Planificación 1 · PCM-0001**, incorporando esas dos OM y sus ediciones. Costo Gs. 720.000.
4. Pulsar **Nueva planificación**, elegir Demo Sur, otra fecha y `12` horas. Crear: debe ser **Planificación 2 · PCM-0002** sin OM. Buscar `1003 1004`: solo se agrega OM-004, costo Gs. 250.000; las OM cerradas se informan. Editar su duración a `0.75`.
5. En **Consultar planificación**, abrir PCM-0001 y comprobar remolcador, fecha, horas y las dos OM con sus ediciones. Volver a PCM-0002: debe conservar exclusivamente OM-004 y su duración `0.75`. Repetir la búsqueda no duplica las OM ni los costos.
6. En cualquiera de los planes, buscar vacío, inexistentes y repetidos: revisar avisos sin perder filas. Vaciar duración o poner personas `0` y salir del campo: verificar error; cambiar de plan y volver, y comprobar que los errores/valores solo pertenecen a ese plan.
7. Ir a **Tareas**, **Personal**, **Planificación** y usar **Búsqueda de tareas**. El mismo plan y sus OM deben conservarse; Personal sigue mostrando el módulo pendiente.
8. Recargar con PCM-0002 seleccionada: deben volver esa cabecera y sus OM. Crear un tercer plan: debe recibir PCM-0003. Reabrir los anteriores y confirmar que sus códigos no cambiaron.
9. Abrir **Nueva planificación**, escribir algunos campos y volver al plan anterior sin crear. Repetir, completar y crear: el número debe ser el siguiente inmediato, sin saltos por campos editados o formularios abandonados.
10. A 375 px y con zoom 200 %, comprobar campos legibles, controles accesibles con Tab/Shift+Tab, foco visible y desplazamiento horizontal contenido en la tabla. No se añaden animaciones.

La inspección visual, navegación interactiva y recarga real quedan pendientes de estos pasos manuales; no se presentan como pruebas ejecutadas.
