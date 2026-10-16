# PCM Connect — alcance acordado (versión inicial)

> Documento de trabajo. Datos ficticios para desarrollo. No contiene conexiones reales a sistemas PCM, ERP ni Taller.

## Propósito
Interconectar planificación de mantenimiento (PCM) y Taller, gestionar la viabilidad por OM, las decisiones de PCM, la distribución del trabajo y la validación de horas, en una herramienta clara y trazable.

## Actores
- **PCM / organizador**: arma propuestas, ingresa números de tarea, consulta OM y revisa la respuesta de Taller. Decide confirmar, devolver a revisión o cancelar.
- **Taller / evaluador**: indica viabilidad de **cada OM**, registrando motivo para las no viables.
- **Tres encargados de asignación**: personas concretas autorizadas para asignar empleados a OM, registrar finalización comunicada y aprobar/corregir horas. Solo esas tres personas realizan asignaciones.
- **Trabajadores**: recursos en lista fija ficticia; sin usuario de aplicación en el alcance actual.

## Flujo acordado
1. PCM inicia borrador de planificación/escala. Ingresa uno o varios IDs de tarea (por comas, líneas o pegado múltiple). Solo los IDs de tarea, responsables y cantidad de personas se introducen manualmente en la preparación inicial, según el último acuerdo.
2. La base simulada relaciona tarea -> una o varias OM. Para cada OM se genera **fila independiente**. Traer área, horas estimadas, criticidad (Baja inicialmente), costos cuando existan y estado disponible. Excluir tareas/OM cerradas del plan; informar IDs inexistentes y cerrados con mensajes claros, sin bloquear la búsqueda de otros IDs.
3. PCM envía una propuesta a Taller. Taller evalúa cada OM como viable/no viable. Para no viable, registrar motivo, quién evaluó y cuándo.
4. PCM recibe devolución: puede **confirmar continuar con solo OM viables**, **devolver a revisión** para modificar y reenviar, o **cancelar** toda la planificación. Conservar decisiones/versiones y evaluaciones antiguas; no borrar ni transformar OM no viable en viable por decisión de PCM.
5. Tres encargados asignan OM confirmadas a trabajadores desde una lista fija mediante drag and drop (o alternativa de teclado/clic). Una OM puede asignarse a varias personas; una persona puede recibir diversas OM sin superposición horaria. Mostrar carga y avisos de conflictos.
6. Encargado registra la finalización informada por los trabajadores. El sistema propone horas estimadas como punto de partida, pero un encargado revisa/rectifica y **valida** las horas individuales por trabajador. Solo al validar pasan al registro de horas reales. Guardar auditoría de quién/ cuándo/ horas originales y validadas.
7. Mostrar historial por trabajador: OM realizadas, pendientes, asignadas, horas planificadas y horas aprobadas. Diferenciar estados claramente.

## Pantallas previstas en bocetos
- Cronograma / preparación de escala y búsqueda múltiple de números de tarea.
- Agenda de arribos (ETA y ETA(F) por aclarar, junto con campos precisos de arribos).
- Revisión/aprobación de OM por Taller y confirmación PCM.
- Asignaciones con tarjetas de trabajador, drag-and-drop y detalle de OM; carga y tiempo.
- Kanban semanal de OM y estado de trabajo.
- Disponibilidad y ausencias: módulo **pospuesto** para fase futura; no construir administración de personal todavía.

El usuario estableció que en la secuencia de los seis bocetos originales se invierten el #2 y el #3. Verificar orden de navegación final antes de implementarlo.

## Estados sugeridos, sujetos a validación
- Planificación: borrador -> pendiente_taller -> pendiente_pcm -> confirmada / en_revision / cancelada.
- Viabilidad individual de OM: sin_evaluar / viable / no_viable.
- Ejecución: pendiente_asignacion / asignada / en_curso / finalizacion_informada / horas_validadas.
- Historial: conservar versión de propuesta, decisión, marca temporal y usuario.
No equiparar estado de PCM Connect con cierre oficial de OM en el ERP externo.

## Reglas de datos
- IDs de tarea y OM como string para conservar guiones y ceros a la izquierda.
- La identidad de una OM dentro de la planificación debe ser estable y única; no duplicar por reingresar el mismo ID de tarea sin aviso.
- Una tarea puede tener múltiples OM, y cada OM puede tener viabilidad, motivo, responsable/asignación y estado propios.
- Las horas previstas de un trabajo NO se multiplican automáticamente por el número de OM del mismo número de tarea. Distinguir duración de una OM de horas-persona por empleado.
- Datos de ejemplo no son hechos ni datos operativos de empresa. Costos faltantes se muestran «Sin definir», nunca un falso 0.

## Decisiones pendientes que no se deben adivinar
- ETA vs ETA(F) y campos exactos de agenda de arribos.
- Forma en que los tres encargados se identifican/autentican en producción. En demo, roles simulados claramente marcados.
- Duración por tarea vs duración específica de cada OM si difieren.
- Cuándo comienza/termina el cómputo de una jornada, turnos y reglas laborales de horas.
- Reglas definitivas de horario, descansos, especialidad, personal tercerizado y distribución de OM con varias personas.
- Mecanismo de cambio de estado de OM respecto al sistema corporativo original.
- Si un encargado puede aprobar su propia corrección de horas (no imponer separación de funciones no solicitada).
- Qué datos exactos se ven en tarjeta y ficha completa de trabajador y si el Kanban admite drag and drop.

## Secuencia recomendada de implementación
**Fase 0:** inspeccionar repositorio actual, reparar errores reales, preservar estética y hacer que build/lint pasen.
**Fase 1:** búsqueda múltiple por ID de tarea + tabla de filas por OM con demo data; responsable y cantidad editables por OM; estados y avisos.
**Fase 2:** versiones de planificación, envío a Taller, viabilidad individual por OM, motivos y decisión final PCM.
**Fase 3:** tres encargados simulados, trabajadores ficticios, asignaciones drag and drop accesibles, horario y prevención de conflictos.
**Fase 4:** registrar finalización, revisar/aprobar horas y legajo histórico por empleado.
**Fase 5:** agenda de arribos, Kanban semanal, reportes, autenticación real y backend cuando se acuerden; gestión de ausencias después.
