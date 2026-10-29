# Resumen del desarrollo

## Trabajo realizado

Se implementó la búsqueda múltiple de tareas sobre una base ficticia, recuperando sus OM abiertas y mostrando avisos para tareas inexistentes, cerradas o repetidas. La preparación se organiza por tarea y conserva la identidad de cada OM para su evaluación posterior. Incluye duración común, responsable, cantidad de personas y suma de costos estimados en guaraníes; los importes desconocidos se identifican como pendientes.

Se incorporó la creación y consulta de planificaciones con remolcador, fecha de parada, horas y código incremental. Cada plan conserva su preparación de forma independiente. El guardado local recupera el plan seleccionado, mantiene el contador y comprueba los datos antes de permitir escrituras.

El flujo de Taller permite evaluar cada OM, exigir un motivo de rechazo y registrar correcciones con revisiones. Al finalizar, las OM viables conservan los datos aprobados. PCM puede continuar con las viables, devolver el plan a revisión o cancelarlo con motivo y confirmación. Las decisiones y los cambios quedan registrados en el historial.

La interfaz utiliza la paleta Graphite, tablas compactas, etiquetas de estado, foco de teclado y desplazamiento horizontal en tablas. El código separa componentes, reglas de negocio, datos ficticios y almacenamiento. Se consolidó la documentación del proyecto en este resumen y se preparó un README con instrucciones de instalación y uso.

## Validación

La suite automatizada cubre búsqueda, datos vacíos e inválidos, duplicados, costos, aislamiento entre planes, numeración, persistencia, roles simulados, revisiones, decisiones e historial. Se dispone de `npm test`, `npm run lint` y `npm run build` para comprobar el proyecto.

Para revisar el flujo manualmente: ejecutar `npm run dev`, crear una planificación y buscar `1001 1003`. Completar los datos comunes, enviar a Taller y evaluar cada OM con el selector de rol simulado. Probar un rechazo sin motivo, guardar una evaluación válida y finalizar. Volver a PCM, continuar con las viables y recargar para comprobar la persistencia. Repetir la búsqueda no debe duplicar trabajos. Revisar también teclado y pantalla estrecha.

## Alcance pendiente

La demo usa datos ficticios, roles simulados y `localStorage`; no ofrece autenticación ni seguridad de servidor, almacenamiento compartido o auditoría inmutable. Quedan pendientes el backend, las asignaciones de personal, la validación de horas reales, la agenda de arribos y el Kanban. La cancelación individual de una OM aprobada requiere definir permisos. La verificación visual e interactiva completa en navegador sigue siendo manual.
