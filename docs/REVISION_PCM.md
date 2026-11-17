# Módulo 3 — Revisión y Confirmación de Planificación

Contrato vigente desde el pedido del 12/11/2026. Las decisiones se aplican a la **TAREA/PM completa**, con sus OM individuales conservadas para costos y trazabilidad. Sustituye las definiciones pendientes del Módulo 2. El Archivo local conserva su contrato histórico por OM y su almacenamiento independiente.

## Recorrido operativo

1. Planificación crea y envía la propuesta habitual; se conserva su ID y TAG.
2. Taller, Supervisor Taller o Administrador registran una decisión por tarea interna. El rechazo exige motivo; horas y trabajadores aceptados se guardan separados de la propuesta. Una decisión registrada queda congelada para esa versión.
3. Taller finaliza cuando todas las tareas internas vigentes tienen evaluación. Las inicialmente externas están exentas. La bandeja **Revisión PCM**, después de Validación Taller, recibe la misma planificación.
4. PCM resuelve cada rechazo: tercerizar, eliminar lógicamente o corregir y reenviar. **Guardar borrador** persiste todas las decisiones parciales seleccionadas; si contienen correcciones, envía esas versiones a Taller en esa misma operación. El botón nunca confirma el plan.
5. Al reevaluar se muestran formularios únicamente para las versiones pendientes. Las aceptadas no vuelven a editarse. Un nuevo rechazo vuelve a PCM sin resolver automáticamente.
6. PCM confirma cuando la evaluación está finalizada y corresponde al contenido vigente, no quedan rechazos internos pendientes, la ETA y TAG son válidos y existe al menos una tarea activa. La UI exige guardar decisiones y ETA antes de confirmar.
7. Confirmadas y canceladas se consultan en Historial, sin edición ordinaria. Confirmar no significa ejecutar o finalizar el mantenimiento. No se asignan técnicos ni horarios.

## Datos y compatibilidad

Se conservan `Registro.esquema = 13`, la clave `pcm-connect.modulo1.v13`, contador, TAG, IDs, filas y OM. Se añade opcionalmente `Plan.revisionPCM` con subesquema `1`. La lectura no reescribe registros anteriores. La primera operación que requiere trazabilidad incorpora los campos adicionales y copia sus evaluaciones existentes.

`Plan.estado` mantiene los estados originales y añade `En reevaluación`, `Confirmada` y `Cancelada`. La bandeja deriva `Con rechazos`, `Pendiente de revisión PCM` y `Lista para confirmar` a partir de evaluaciones y resoluciones; no almacena estados redundantes que puedan contradecirse. El indicador Evaluadas cuenta evaluaciones vigentes finalizadas, incluso si PCM ya confirmó o canceló después. Los otros indicadores cuentan rechazos pendientes en planes abiertos, planes confirmables y confirmaciones.

Cada tarea tiene una versión de contenido, responsable original, instantáneas de sus versiones, historial de evaluaciones y de resoluciones PCM. `Plan.evaluaciones` contiene la última decisión registrada; su `versionTarea` determina si todavía es vigente. La decisión anterior permanece tanto en el historial de la tarea como en los eventos del registro. Una evaluación anterior sin versión corresponde a la versión 1; sus horas/personas aceptadas se muestran usando la propuesta histórica cuando no tenía campos separados. No se inventa una fecha de creación de tarea: la primera instantánea señala su incorporación al historial.

La revisión separa la versión general del plan de `versionContenido` y `versionEvaluada`: cambiar ETA incrementa la versión del plan pero no invalida aprobaciones de tareas. Corregir una rechazada incrementa su versión y la de contenido; solo finalizar Taller vuelve a igualar contenido y evaluación. Se permiten correcciones de descripción, criticidad, duración propuesta, trabajadores propuestos y responsable interno activo; nunca de ID, OM, costos o evaluaciones.

La tercerización conserva `fila.responsableId` y el rechazo original. La resolución persistida `Tercerizada` determina el responsable operativo `TERCERIZADO` mediante `responsableOperativo`, y excluye la demanda interna mediante `tareaInterna`. Así no se depende del nombre editable de un catálogo para reconocer la ejecución externa. Eliminar conserva la fila y sus OM, pero `tareaActiva` la excluye de la planificación activa. Una cancelación excluye todas sus tareas. Se liberan las reservas de duplicados solo de tareas eliminadas o planes cancelados; una tercerizada permanece reservada como trabajo externo activo.

## ETA y advertencias

**Actualización de especificación del 17/11/2026:** el [Sistema definitivo de ETA](ETA.md) agrega el guardado independiente de predicciones y la acción autorizada **Confirmar ETA predictiva**. Esta confirmación aplica la predicción a la Final con motivo y trazabilidad, sin cambiar la Inicial ni las aprobaciones; revisa disponibilidad, compromisos, asignaciones y calendarios según existan, y conserva conflictos pendientes. No equivale a confirmar la planificación. La lógica está definida, pero su desarrollo requiere autorización posterior; no forma parte de la Fase 1 de diseño ni del comportamiento actual que sigue.

Se reutiliza el comando compartido `cambiarEta` y `EditorEta`. La inicial permanece inmutable. Cada cambio de la final conserva anterior/nueva, ID y nombre del actor, rol, fecha y comentario. Las versiones antiguas sin rol lo indican explícitamente.

Al cambiar ETA se revisan ventanas de parada superpuestas en planes enviados, evaluados o confirmados con remolcador o responsable interno compartido. Se identifican TAG y tareas afectadas en ambos planes. También se advierte si la duración aceptada de una tarea supera su parada. Son **advertencias de disponibilidad**, no una comprobación de exceso de capacidad: todavía no existen cupos, turnos, ausencias ni asignaciones nominales. No se inventan esos datos.

Las alertas se persisten como `Pendiente de reprogramación`. No se borran al confirmar ni por volver a mover ETA. Las correspondientes a trabajos eliminados, tercerizados o a planes cancelados se conservan como historia y ya no forman parte de su demanda interna activa. La confirmación exige reconocimiento explícito de todas las advertencias activas, registra el autor y el evento de reconocimiento y marca `conAdvertencias`. Las aprobaciones de Taller permanecen intactas.

No existe una entidad de compromisos preliminares nominales en este contrato. Se conservan reservas de trabajos y se calcula la demanda interna mediante los selectores compartidos. La futura asignación debe utilizar `tareasInternasAsignables`, que devuelve únicamente tareas internas aceptadas de planes confirmados; las advertencias conservadas requieren reprogramación. No leer todas las filas como si fueran asignables. `estadoProgramacion` distingue Sin asignar, Pendiente de programación y Reprogramación requerida; Programada quedará a cargo del módulo que efectivamente asigne horarios.

## Persistencia, permisos y errores

Comandos nuevos: `guardarRevision`, `confirmarPCM`, `cancelarPCM`. Todos exigen versión de plan y permiso PCM (Planificador o Administrador). La cancelación requiere motivo y confirmación explícita; registra autor, fecha y conserva el historial. Los planes confirmados/cancelados no aceptan nuevas operaciones de revisión ni cambios de ETA en este módulo.

Se mantienen los recibos idempotentes, el bloqueo de doble envío en UI, la revisión global y Web Locks del adaptador local. Fallar en una decisión de un lote no guarda parcialmente las otras. Un fallo de almacenamiento conserva las decisiones en pantalla y el documento anterior. Cerrar el modal o la página con cambios sin guardar muestra advertencia. La recarga recupera los **borradores guardados**; no hay una segunda copia automática de decisiones del modal sin guardar.

La API reutiliza estos comandos y obtiene al actor de la sesión autenticada. La transacción SQL existente compara la revisión y serializa el guardado del documento completo; no necesita un cambio de tabla para los campos JSON adicionales. Las pruebas con PGlite verifican la API y la transacción, pero no prueban una instancia remota real. La infraestructura de Supabase debe configurarse aparte.

LocalStorage y los roles demo no proporcionan seguridad, autorización real, transacciones de base de datos ni sincronización entre equipos. La configuración de servidor sigue descrita en [Módulo 1 v1.3](MODULO_1_V13.md). La validación de lectura rechaza datos inválidos sin reemplazar ni borrar el original.

## Comprobación

Ejecutar `npm run build`, `npm run lint` y `npm test`. Las pruebas de M3 cubren estados vacíos/erróneos/repetidos, filtros, indicadores, borradores, reenvíos, conservación de OM y evaluaciones, permisos, cancelación, advertencias, idempotencia y persistencia. Las pruebas React/happy-dom recorren UI y recarga; no reemplazan la inspección visual en un navegador real. No se añadió Playwright ni dependencias.

Para probar manualmente: usar catálogos y fuente ficticios, enviar dos tareas internas, aceptar una y rechazar otra con Taller, finalizar, cambiar a PCM y abrir Revisión PCM. Elegir una resolución, guardar, cerrar/reabrir y confirmar. Para reevaluación, elegir Corregir y reenviar, modificar un campo y guardar; volver a Taller y finalizar la nueva evaluación. Para advertencias, mover ETA hasta solapar la ventana de otro plan interno del mismo responsable o remolcador; confirmar solo después de reconocerlas. Probar cancelación en otra planificación abierta y consultar el motivo en Historial.
