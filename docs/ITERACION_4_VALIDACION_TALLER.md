# Validación Taller · 28 de octubre de 2026

Módulo funcional sobre las planificaciones existentes. Datos ficticios, roles simulados y persistencia local. Sin nuevas dependencias, commits, push, backend, Kanban, Gráficos ni asignaciones.

## Integración y reglas

- **Planificación / Tareas** conservan el mismo espacio de preparación y su agrupación por tarea. **Validación Taller** tiene su propio selector de planes recibidos, pero consulta y modifica el mismo registro. No crea copias de los planes.
- PCM crea el borrador, agrega tareas y completa los datos comunes antes de **Enviar a Taller**. El envío exige al menos una OM activa y datos válidos.
- Estado: **Borrador → Pendiente de Taller → Pendiente de PCM → Confirmada / En revisión / Cancelada**. En revisión, PCM puede reenviar a Taller.
- Taller guarda **Pendiente / Viable / No viable** por OM. No viable exige motivo. Finalizar exige una evaluación guardada y vigente de todas las OM activas. Una elección aún sin guardar no cambia el resultado persistido.
- Durante la evaluación PCM conserva la edición de trabajos no congelados. Una modificación relevante aumenta la revisión y vuelve la OM afectada a Pendiente. No invalida otras OM independientes.
- Cambiar duración, responsable o personas **comunes a una tarea** afecta a todas sus OM que sigan usando esos valores comunes. Para modificar solo una OM, PCM utiliza **Corregir OM** en Validación Taller. La pantalla distingue datos comunes de datos individuales.
- Al finalizar, las viables guardan una instantánea de sus datos aprobados y quedan congeladas. La preparación ordinaria pasa a solo lectura; las decisiones históricas siguen disponibles.
- PCM puede **Continuar** solo si existe alguna viable vigente: confirma únicamente las viables. **Devolver a revisión** conserva las aprobaciones congeladas y permite a PCM o Taller corregir las no congeladas. Cada corrección exige motivo y nueva evaluación. Reenviar una rechazada sin cambios también vuelve a exigir evaluación; nunca la convierte automáticamente en viable.
- Si se devuelve un plan con todas sus OM ya aprobadas, conserva el congelamiento. Se puede reenviar y Taller puede finalizar nuevamente para devolverlo a PCM, sin alterar aprobaciones.
- **Cancelar planificación** exige marcar la confirmación explícita e ingresar motivo. Conserva OM, aprobaciones e historial. No permite nuevos cambios, evaluaciones ni futuras asignaciones.
- `ordenesAsignables` centraliza la elegibilidad para el futuro módulo: solo plan Confirmada, OM viable, congelada, revisión evaluada igual a la vigente y no cancelada. En los demás estados devuelve una lista vacía. No se implementó asignación de personal en esta iteración.

## Quitar trabajos y permisos pendientes

En borrador se puede quitar una OM o toda una tarea. Antes de quitar una tarea se muestran explícitamente todas las OM afectadas. Las bajas de una preparación con código dejan un evento por OM; el borrador sin cabecera todavía no tiene identidad ni historial propio. Reincorporar una OM previamente quitada no reutiliza su número de revisión.

Una OM aceptada no se borra. La política de quién puede cancelarla individualmente **no está definida**: la acción se muestra deshabilitada y todos los roles quedan denegados en la función de dominio. Existe la operación controlada para una futura política, con motivo, responsable, fecha, OM y estados anterior/nuevo; no se concede permiso arbitrariamente. Cancelar un plan completo por decisión de PCM sí está autorizado en Pendiente de PCM y funciona.

## Roles y persistencia de demo

El selector **Rol simulado (demo)** ofrece PCM, Taller y tres encargados ficticios (Douglas, Ale y Pepe). PCM organiza y decide; Taller evalúa y corrige en revisión; los encargados solo consultan en este módulo. Ser responsable de preparación no concede permiso de evaluación. Las comprobaciones están centralizadas en `permisos` y se aplican también en las funciones de negocio, además de la interfaz.

Esto **no es autenticación ni seguridad real**. El rol se reinicia a PCM al recargar. Un usuario con acceso al navegador puede alterar el código y el almacenamiento. No se implementa identidad real, servidor, concurrencia transaccional ni auditoría inmutable. Trabajar desde una sola pestaña; evaluaciones y correcciones verifican además la revisión esperada para detectar datos obsoletos.

Se mantiene la clave `pcm-connect.planificaciones.v1`. El campo opcional `taller`, con su propia versión 1, agrega revisiones e historial al plan. La migración es aditiva: un plan anterior sin ese campo continúa como Borrador, conserva código, número, tareas, OM, valores originales y contador. Leer no escribe ni inventa acontecimientos antiguos; al realizar acciones se agregan eventos nuevos. No se borran ni reinician registros. Una versión desconocida o estructura dañada bloquea escrituras.

Los eventos contienen acción, planificación, OM cuando corresponde, revisión, fecha ISO, usuario y rol simulados, observación y datos anteriores/nuevos. El historial se agrega sin sobrescribir los eventos previos. La interfaz presenta esos datos con etiquetas y las fechas en horario de Montevideo.

La corrección de costo actualiza la fila original usada por `resumirCostos`; se conserva la fórmula de suma existente. La duración individual permanece diferenciada de la duración común de la tarea, sin sumarla ni transformarla en horas-persona o reales. Preparación identifica las evaluaciones y los datos individuales junto a cada OM.

## Archivos cambiados

| Archivo | Motivo |
| --- | --- |
| `src/features/validacionTaller.ts` | Estados, permisos, revisiones, instantáneas, eventos, envío, evaluación, decisiones, correcciones y elegibilidad. |
| `src/features/planificaciones.ts` | Tipo de plan ampliado, creación con autor e integración de cambios de preparación con revisiones. |
| `src/features/almacenPlanificaciones.ts` | Lectura compatible y validación de las estructuras nuevas. |
| `src/components/ValidacionTaller.tsx` | Tabla por OM, resumen, observaciones, correcciones, decisiones e historial. |
| `src/components/Planificaciones.tsx` | Estado compartido, rol simulado, envío/reenvío y edición según permisos/etapa. |
| `src/components/BusquedaTareas.tsx` | Quitar OM/tarea en borrador, lectura de campos congelados y señales de datos individuales. |
| `src/App.tsx` | Nueva entrada de navegación conservando las existentes. |
| `src/App.css` | Controles y tabla Graphite, desplazamiento horizontal, formularios adaptables e historial. |
| `tests/validacionTaller.test.ts` | Reglas críticas, permisos, revisiones, aislamiento, decisiones, bajas y persistencia/migración. |
| `tests/interfazTaller.test.ts` | Render de los componentes reales con React y Vite: navegación, vacío, roles y estados. |
| `docs/PCM_REQUISITOS.md` | Referencia al alcance funcional nuevo. |
| Este documento | Decisiones, límites y guía de verificación. |

Una **revisión** identifica los datos vigentes de una OM; una **instantánea** conserva los datos que Taller aprobó. Las funciones de negocio devuelven un registro nuevo sin modificar el anterior, lo que permite comprobar cada transición mediante pruebas independientes de React. Los componentes controlan formularios y llaman a esas funciones; el guardado se realiza solo después de una acción válida.

## Comprobaciones ejecutadas y pendientes

- Base inicial: 30 pruebas, build (TypeScript + Vite) y Oxlint correctos.
- Resultado: `npm test`, 48 pruebas correctas, incluidas 17 nuevas de reglas y una de renderizado React. `npm run build`, `npm run lint` y `git diff --check` correctos.
- Las pruebas recorren casos normales, vacíos, erróneos y repetidos, aprobaciones mixtas de una tarea, rechazos sin motivo, revisiones obsoletas, cambios individuales y comunes, congelamiento, tres decisiones PCM, conservación del historial, bajas y reincorporación, aislamiento entre planes y lectura/escritura JSON de todas las etapas. También leen un registro anterior sin Taller sin modificarlo.
- Vite inicia en `http://127.0.0.1:5173/`. Se comprueba respuesta HTTP del servidor y transformación de los módulos nuevos.
- Playwright no está instalado ni configurado y no se agregaron dependencias. La automatización nativa de Brave se detuvo porque la herramienta no pudo determinar con suficiente confianza la URL activa. No se ejecutaron interacciones ni inspección visual en navegador. El render de React comprueba el marcado generado, **no** sustituye esos pasos. Teclado, responsive, recarga y navegación interactiva quedan pendientes de la guía siguiente.

## Cómo probar en el navegador

1. Ejecutar `npm run dev` y abrir siempre el mismo origen/puerto, conservando los datos del sitio. En **Consultar planificación**, comprobar que los planes anteriores siguen disponibles. No borrar `localStorage`. En Validación Taller, antes del primer envío, comprobar el mensaje vacío.
2. Con rol PCM, crear un plan con remolcador ficticio, fecha válida y 8 horas. Intentar enviar vacío: debe aparecer un aviso sin cambiar de estado. Buscar `1001 1003 1002 9999`: se incorporan OM-001, OM-002 y OM-004, con avisos de cerrada e inexistente. Repetir `1001`: no duplica OM. Completar los responsables y personas comunes y **Enviar a Taller**. El mismo código aparece en Validación Taller.
3. Seleccionar **Taller**. En OM-001 elegir Viable y guardar. En OM-002 elegir No viable, dejar motivo vacío y guardar: debe exigir motivo. Escribir «Falta repuesto ficticio» y guardar. Intentar **Finalizar evaluación** con OM-004 pendiente: debe bloquear. Marcar OM-004 viable y guardar.
4. Antes de finalizar, cambiar a PCM y usar **Corregir OM-001**: duración 5 h y motivo obligatorio. Solo OM-001 vuelve a Pendiente, con nueva revisión; OM-002 y OM-004 conservan sus resultados. Volver a Taller, reevaluar OM-001 y guardar. En el historial, revisar la duración anterior y la vigente. Alternativamente, cambiar una duración común desde Preparación y comprobar que se invalidan las OM dependientes de esa tarea, sin afectar otras tareas.
5. Con Taller, **Finalizar evaluación**: estado Pendiente de PCM. Las viables dicen Aprobada / solo lectura; no permiten corrección. En Planificación, la preparación queda deshabilitada. Repetir finalizar no debe estar disponible. Cambiar a un encargado: no aparecen controles para evaluar ni decidir.
6. Con PCM, **Devolver a revisión**. Corregir OM-002 y guardar motivo, con PCM o Taller. OM-001 y OM-004 permanecen congeladas. Con PCM ir a Planificación y **Reenviar a Taller**. Taller debe evaluar nuevamente OM-002 antes de finalizar. También se puede reenviar sin modificar la rechazada: vuelve a Pendiente y exige guardar una evaluación nueva.
7. Para probar **Continuar**, finalizar un plan mixto y elegir esa decisión con PCM. Debe quedar Confirmada y listar solo las OM viables como elegibles para una futura asignación. Las rechazadas permanecen en consulta e historial; no pasan a asignación.
8. Para probar **Cancelar planificación**, preparar otro plan y finalizar su evaluación. Con PCM intentar cancelar sin motivo o sin confirmar: debe bloquear. Ingresar motivo y marcar la confirmación: estado Cancelada, historial conservado y ninguna OM asignable. Las OM aceptadas mantienen su aprobación histórica. La cancelación individual de una aceptada sigue deshabilitada con explicación de permisos pendientes.
9. En otro borrador, buscar 1001. Quitar solo OM-001: OM-002 debe permanecer. Reincorporar 1001 y luego **Quitar tarea 1001**: el diálogo debe listar ambas OM; rechazar el diálogo no quita nada. Aceptarlo quita únicamente las indicadas. Si el borrador tiene código, el historial registra cada baja cuando se consulte posteriormente el plan enviado.
10. Recargar en las distintas etapas y volver al código correspondiente: estados, motivos, revisiones, correcciones, costos e historial deben persistir. El rol vuelve a PCM por ser una simulación. Crear otro plan debe usar el siguiente número sin reutilizar códigos.
11. Navegar por Planificación, Tareas, Validación Taller y Personal. Comprobar el mismo registro compartido y que Personal conserva su aviso. Recorrer controles con Tab/Shift+Tab y revisar foco y etiquetas. A 375 px y zoom 200 %, verificar que los campos se adapten y las tablas se desplacen dentro de su contenedor, sin ensanchar toda la página.
