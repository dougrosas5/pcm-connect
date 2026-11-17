# Sistema de ETA — especificación definitiva

Decisión funcional del propietario del **17/11/2026**. Este contrato reemplaza toda indicación anterior que deje pendiente la definición de ETA Predictiva o la relación entre las tres ETA. Es una especificación aprobada, **todavía no implementada**: no autoriza desarrollar lógica, cambiar tipos, servicios, componentes ni datos durante la Fase 1 de diseño. La implementación requiere autorización expresa posterior.

## Tres campos independientes

| Campo | Registro y edición | Efecto operativo |
| --- | --- | --- |
| **ETA Inicial** | Se registra al crear la planificación; inmutable durante todo el ciclo de vida y de solo lectura para todos los usuarios. | Conserva la llegada originalmente registrada; ningún cambio de ETA Final o Predictiva la reemplaza. |
| **ETA Final** | Inicialmente igual a la Inicial; PCM y Taller la editan según sus permisos. | Fecha y hora operativas vigentes para programación, disponibilidad y cálculos operativos. |
| **ETA Predictiva** | Fecha y hora probable de llegada, ingresada manualmente y modificable de forma independiente; puede quedar pendiente de confirmación. | Guardar o editar la predicción no cambia la Final, la ventana operativa ni sus cálculos, y no ejecuta una confirmación implícita. |

El fin previsto de parada se calcula desde **ETA Final + horas de parada**. La Predictiva guardada debe distinguirse de la ETA operativa confirmada, tanto en pantalla como en el historial.

## Acción explícita: Confirmar ETA predictiva

La acción **Confirmar ETA predictiva** está disponible exclusivamente para usuarios autorizados. Antes de aplicarla, mostrar juntas la **ETA Final actual** y la **ETA Predictiva propuesta**, solicitar confirmación explícita y exigir el **motivo del cambio**. La actualización de la Final debe utilizar la predicción que el usuario revisó; una versión obsoleta no puede aplicarse silenciosamente.

Una confirmación válida debe:

1. Copiar la ETA Predictiva a la ETA Final.
2. Mantener intacta la ETA Inicial.
3. Registrar la ETA Final anterior y la nueva en el historial.
4. Registrar usuario, rol, fecha, hora y motivo.
5. Actualizar la ventana operativa de parada.
6. Recalcular la disponibilidad y los compromisos afectados.
7. Revisar las asignaciones existentes.
8. Detectar los solapamientos resultantes.
9. Crear o actualizar las alertas correspondientes.
10. Actualizar los calendarios y módulos relacionados con la nueva ETA Final.

Estos efectos pertenecen a la confirmación explícita; **nunca se ejecutan automáticamente al editar o guardar una predicción**. Confirmar una ETA no equivale a confirmar una planificación, finalizar una evaluación de Taller ni cerrar una programación.

La confirmación debe ser **idempotente**: un doble clic, reintento o solicitud concurrente de la misma confirmación no puede repetir cambios de ETA, versiones, eventos históricos ni alertas. Se deben conservar los controles existentes de versión, concurrencia y recibos, sin introducir una segunda lógica de actualización de ETA por módulo. Un error no debe dejar una ETA Final actualizada sin su auditoría y seguimiento de los efectos correspondientes.

## Conflictos y continuidad operativa

Si la confirmación produce conflictos:

- Conservar las tareas aceptadas, sus evaluaciones y los ajustes aprobados por Taller en su estado original.
- Generar alertas grandes, visibles y persistentes, identificando la planificación, los trabajos y los trabajadores realmente afectados cuando existan asignaciones.
- Mantener los conflictos pendientes de reprogramación; cerrar un aviso o navegar a otra pantalla no los resuelve ni elimina.
- Permitir consultar y continuar las operaciones no bloqueadas, conservando las restricciones operativas obligatorias aplicables.
- No eliminar ni rechazar trabajos automáticamente como consecuencia del cambio de ETA.

La revisión debe distinguir entre duplicación de tareas, solapamiento de ventanas de parada y solapamiento real de horarios de técnicos. Actualizar alertas conserva su trazabilidad; no debe ocultar un conflicto pendiente mediante una sobrescritura silenciosa.

## Historial

Conservar por separado y con trazabilidad:

- **Predicción guardada o modificada:** valor anterior y nuevo de ETA Predictiva, usuario, rol y fecha/hora del registro. No constituye una actualización de ETA Final.
- **Predicción confirmada como operativa:** predicción utilizada, ETA Final anterior y nueva, usuario, rol, fecha/hora, motivo y referencia de la confirmación para evitar repeticiones.

Las modificaciones posteriores de la Predictiva no cambian la Final que ya fue confirmada. Una nueva actualización operativa requiere otra acción explícita autorizada. Conservar todos los registros anteriores; no sobrescribir silenciosamente el historial.

## Permisos

La Final sigue siendo editable por PCM y Taller **según sus permisos**, sin conceder acceso a todos los perfiles de Taller. La documentación de [Validación Taller](VALIDACION_TALLER.md) describe los permisos actualmente implementados. Esta decisión documental no amplía esos permisos ni cambia las restricciones de edición de planes confirmados o cancelados.

Guardar una predicción y confirmar su aplicación operativa son acciones distintas. La segunda exige autorización explícita; no se debe deducir ese permiso de poder consultar un plan, editar una predicción, evaluar tareas o asignar personal. La matriz concreta de autorización para las acciones nuevas deberá quedar acordada al autorizar su desarrollo; esta especificación no asigna usuarios ni roles adicionales. En demo, los roles simulados deben seguir identificados como tales, sin presentarlos como seguridad real.

## Integración y compatibilidad — desarrollo pendiente de autorización

- **Tipos compartidos:** extender el contrato de `src/types/pcm.ts` cuando se autorice, representando la predicción y su trazabilidad de forma independiente. Actualmente `Plan.eta` representa la Final; esta especificación no renombra ni modifica el campo implementado.
- **Dominio compartido:** integrar el guardado de predicciones y su confirmación en las operaciones y validaciones de ETA existentes. Reutilizar el recorrido de actualización de la Final para auditoría, ventana operativa y conflictos, sin copiar esa lógica entre Planificación, Taller, Revisión PCM y calendarios.
- **Servicios y persistencia:** conservar el almacenamiento actual, TAG, identificadores, contador, planes, OM, evaluaciones, resoluciones, asignaciones e historiales. Cualquier ampliación futura debe ser compatible y no destructiva; no crear una base externa para esta funcionalidad.
- **Datos anteriores:** una predicción ausente permanece sin dato hasta que se registre; no inventarla a partir de la Inicial o Final. Conservar la procedencia de las ETA iniciales históricas heredadas o sin dato; no afirmar que se conoce su valor original de creación.
- **Componentes compartidos:** adaptar el editor de ETA existente para presentar los tres campos y la comparación previa a confirmar. Usar los tokens de [Graphite Maritime](DISEÑO_GRAPHITE.md), mantener accesibilidad, confirmación explícita, validaciones y estados de guardado claramente diferenciados.
- **Módulos relacionados:** conectar disponibilidad, compromisos, asignaciones y calendarios a la misma ETA Final vigente. Actualmente existen advertencias de ventanas y duración, pero todavía no hay asignaciones nominales, turnos, capacidad real ni calendarios implementados. La integración futura debe revisar datos reales de esos módulos cuando existan, sin inventar técnicos, horarios o compromisos para simular el resultado.

No modificar el Archivo local histórico ni convertir sus planes de forma implícita. Las limitaciones actuales de persistencia y seguridad permanecen documentadas en [Arquitectura](ARQUITECTURA.md).

## Criterios de aceptación para la futura implementación

1. Crear un plan conserva Inicial y Final iguales; la Inicial permanece inmutable ante todas las operaciones posteriores.
2. Guardar y volver a editar una predicción conserva la Final, su ventana operativa y las aprobaciones de Taller. Tras recargar, la predicción y su historial se mantienen y se reconoce que todavía no se aplicó a la operación.
3. La confirmación compara ambos valores, exige motivo y permiso; cancelar la confirmación no modifica la Final. Ausencia de predicción válida, falta de autorización o versión obsoleta impiden aplicar el cambio sin sobrescribir datos.
4. Confirmar actualiza la Final, el fin de parada y los módulos afectados, conserva la Inicial y genera un registro auditado diferenciable del guardado de predicción.
5. Doble clic, reintento, concurrencia y recarga no duplican la confirmación ni sus efectos históricos; los fallos conservan la consistencia de los datos.
6. Un conflicto mantiene las aceptaciones, identifica trabajos y trabajadores existentes, persiste al cerrar el aviso o recargar y permite operar sobre lo no bloqueado.
7. Los registros anteriores sin predicción siguen siendo legibles; no se pierden TAG, evaluaciones, asignaciones ni historia.

Estos criterios son requisitos para pruebas futuras; **no describen pruebas ejecutadas ni funcionalidad disponible actualmente**. La Fase 1 de diseño y esta actualización documental no habilitan implementar la lógica de ETA ni continuar a otra fase.
