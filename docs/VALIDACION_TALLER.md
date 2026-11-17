# Validación Taller — contrato vigente

## Alcance

Validación Taller utiliza los mismos planes v1.3 de Planificación. Muestra bandeja, filtros, cabecera detallada, propuesta vigente, evaluaciones históricas e historial de ETA. Desde el Módulo 3, registra aceptaciones o rechazos de la **TAREA/PM completa**, con motivo obligatorio al rechazar y horas/trabajadores separados de la propuesta. Las decisiones quedan congeladas por versión. Consultar el [contrato de Revisión PCM](REVISION_PCM.md).

La bandeja incluye TAG, remolcador, ubicación, ETA inicial y final, parada, cantidad de tareas, estado, progreso histórico, última modificación de ETA y acción de consulta. Los filtros se combinan por TAG, remolcador, ubicación, estado y fechas inclusivas de ETA final en Montevideo. Un rango invertido informa error.

Los indicadores existentes corresponden a Enviado a Taller, En evaluación (incluye reevaluación) y Evaluado. Programadas y En curso permanecen «Por configurar». Historial contiene confirmadas o canceladas por PCM; ninguno de esos estados equivale a trabajo ejecutado. La configuración está en `src/features/validacion-taller/model/bandeja.ts`.

## ETA y auditoría

**Especificación posterior aprobada (17/11/2026), pendiente de implementación autorizada:** [Sistema definitivo de ETA](ETA.md). Distingue Inicial inmutable, Final operativa y Predictiva manual independiente; solo **Confirmar ETA predictiva**, con permiso, comparación previa, confirmación y motivo, aplica la predicción a la Final. No se altera la evaluación de Taller ni se duplican confirmaciones. Los párrafos siguientes describen el comportamiento ya implementado, sin Predictiva todavía.

`Plan.eta` es la ETA final operativa, conservando el nombre del contrato anterior. El fin de parada se calcula exclusivamente como ETA final más horas de parada, sin sumar duraciones de tareas. Las fechas se guardan en UTC ISO y se muestran en Montevideo.

La creación persistida de planes nuevos exige una ETA válida. El primer guardado fija `etaInicial`; los demás campos pueden permanecer incompletos en borrador. Después, la final se modifica desde Validación Taller mediante el comando `cambiarEta` con comentario obligatorio. Guardar una propuesta no permite modificar su ETA ni la auditoría original.

El comando valida permisos, fecha, comentario y versión. Conserva plan, TAG, tareas, OM, valores, duraciones, evaluaciones y estado. Actualiza la versión y registra fecha, ID/nombre del actor, valor anterior, valor nuevo y comentario, además de la instantánea anterior/posterior en el historial general. Repetir el mismo recibo no duplica eventos.

`revisionDisponibilidad: pendiente` conserva el seguimiento de cada cambio. El Módulo 3 registra advertencias concretas de solapamientos y duración en `revisionPCM.conflictos`, sin afirmar capacidad confirmada ni rechazar trabajos aceptados. La confirmación con advertencias exige reconocimiento PCM.

## Compatibilidad con registros anteriores

Los campos `etaInicial`, `origenEtaInicial` e `historialEta` son opcionales para leer registros anteriores sin reescribirlos al cargar. El valor de ETA existente se presenta como dato histórico disponible. Al modificar el plan se incorpora con origen `heredada`, sin afirmar que se conoce su valor original de creación. Si estaba vacío, la inicial permanece vacía con origen `sin-dato`; la final puede completarse mediante un cambio auditado.

No se migran los planes del Archivo local ni se cambia `pcm-connect.planificaciones.v1`. Las evaluaciones v1.3 se conservan en consulta y se incorporan de forma aditiva a los historiales de Revisión PCM al escribir. No se pierden decisiones previas.

## Permisos y servidor

PCM (Planificador/Administrador conforme al contrato existente) y Supervisor Taller pueden modificar ETA final en planes abiertos. Taller común y Consulta solo leen la ETA. Taller, Supervisor y Administrador pueden evaluar; PCM Planificador no aprueba en nombre de Taller. Si hay cambios PCM sin guardar, deben guardarse antes de modificar ETA.

En modo demo los roles son simulados, sin autenticación ni seguridad real. En servidor, la API obtiene el perfil autenticado y aplica las mismas reglas del dominio. El rol Supervisor Taller requiere la migración `supabase/migrations/202611100001_supervisor_taller.sql` y asignación explícita a las cuentas autorizadas. La migración no concede ese rol automáticamente.

La configuración y verificación de Supabase se describe en [Módulo 1 v1.3](MODULO_1_V13.md). No dar por aplicada una migración ni por verificado un entorno remoto basándose en las pruebas locales.

## Recorrido de comprobación

1. Crear un plan con ETA inicial y parada; guardar y comprobar TAG y fecha inicial.
2. Abrir Validación Taller; probar filtros combinados, un TAG inexistente, limpiar filtros y rango de fechas invertido.
3. Consultar un plan y cambiar la final con comentario usando PCM o Supervisor Taller. Comprobar inicial fija, fin recalculado e historial.
4. Volver a Planificación, reabrir y recargar: confirmar que se conservan los datos y la nueva ETA.
5. Cambiar a Taller o Consulta: el editor no debe estar disponible. Un comentario vacío, misma fecha o versión obsoleta no registra cambios.
6. Evaluar cada tarea interna y finalizar. Confirmar que Evaluado pasa a Revisión PCM; solo una confirmación o cancelación PCM la lleva a Historial.

## Pendiente de definición e implementación

Programación, ejecución y cierre; cupos por especialidad, turnos, compromisos nominales y resolución efectiva de la reprogramación. El Módulo 3 resolvió la evaluación por tarea completa, tercerización/eliminación/corrección y reenvío, y la separación de valores aceptados por Taller.
