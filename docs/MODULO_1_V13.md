# Módulo 1 — Planificación de tareas v1.3

> **Actualización funcional de ETA (17/11/2026):** el [contrato definitivo de ETA](ETA.md) incorpora una Predictiva manual independiente y su confirmación explícita como Final, preservando la Inicial, el historial y las evaluaciones. La predicción y su confirmación se gestionan desde Validación Taller.

> Guía del contrato v1.3. Para la bandeja actual, ETA y evaluación consultar [Validación Taller](VALIDACION_TALLER.md). La primera creación exige ETA. El [Módulo 3](REVISION_PCM.md) habilita evaluación por tarea, resoluciones de PCM y reevaluaciones sobre los mismos planes. La ubicación y responsabilidad del código están en [Arquitectura](ARQUITECTURA.md). Los apartados posteriores describen el alcance original v1.3; el contrato M3 actualiza sus etapas posteriores.

Esta especificación y el pedido v1.3 del propietario reemplazan las reglas anteriores que contradigan el nuevo Módulo 1. La demo anterior permanece en **Archivo local**, con sus datos y pruebas originales, sin mezclar evaluaciones ni convertir automáticamente OM abiertas en OM con valor aprobado.

## Funcionamiento

- Cabecera: TAG permanente asignado al primer guardado, remolcador, ubicación, ETA con hora, parada positiva, fin automático, planificador, estado, versión y actualización.
- Fechas persistidas en UTC ISO, visualizadas en `America/Montevideo`. Los campos de ingreso utilizan UTC−03:00, correspondiente a la configuración actual de Montevideo. No dependen del huso del equipo.
- Estados nuevos exactos: `Borrador`, `Enviado a Taller`, `En evaluación`, `Evaluado`. Son independientes del estado importado de tarea/PM. No se convierten estados v1.
- Nueve columnas: TAREA/PM, OM, valor en Gs., descripción, tiempo propuesto, trabajadores propuestos, criticidad, responsable y estado de tarea. Acciones auxiliares para quitar, subir y bajar.
- Cada tarea agrupa exclusivamente OM con `Valor aprobado` (comparación sin distinguir mayúsculas). El valor suma sus OM únicas. Los valores faltantes se presentan sin inventar ceros.
- Tiempo original y tiempo propuesto son campos separados; editar la propuesta no modifica la fuente.
- No se suman duraciones ni trabajadores para deducir duración del conjunto, dotación o fin de los trabajos. El fin de parada depende exclusivamente de ETA + parada. Una tarea más larga que la parada genera una advertencia que no bloquea el envío.
- Un borrador puede estar incompleto. Al enviar se exigen cabecera, tareas, campos importados necesarios, responsable activo, tiempo positivo y trabajadores enteros positivos.
- Se detectan duplicaciones dentro del plan y con otros planes del nuevo flujo. Los cuatro estados siguen en el proceso de mantenimiento, por lo que conservan sus reservas; no se inventó una cancelación o un cierre posterior.
- Enviar guarda la cabecera, fuente incorporada, propuesta, catálogos referenciados, autor, fecha y versión en una sola operación. Tras el envío la propuesta queda en consulta.
- Taller recibe cada tarea completa; una decisión abarca sus OM. Rechazar exige motivo. Los responsables externos se conservan y no requieren una decisión interna. El cambio a Evaluado exige resolver todas las tareas internas. La respuesta posterior de PCM y la asignación nominal continúan fuera de este alcance.
- Limpiar pide confirmación e inicia una propuesta nueva en pantalla; no elimina el plan guardado ni la fuente.

## Catálogos y permisos

Administración puede registrar, editar, desactivar y reactivar remolcadores, ubicaciones y responsables. Los siete responsables iniciales son los del pedido. Remolcadores y ubicaciones comienzan vacíos: no se inventa un catálogo operativo. Los planes enviados conservan los nombres y tipo de ejecución al momento del envío. Un responsable utilizado no puede cambiar su condición interno/externo: debe crearse otra entrada.

En servidor los roles se leen de `pcm_perfiles`, después de verificar el token con Supabase Auth. El cliente no elige su rol. Planificador y Administrador pueden importar y preparar; solo Administrador modifica catálogos; Taller y Administrador evalúan. Consulta solo lee. Un planificador edita sus propios borradores; Administración puede editar los borradores. No se introducen permisos de asignación o validación de horas.

## Excel y CSV

Se importa la primera hoja `.xlsx` o CSV UTF-8 delimitado por `;`, coma o tabulación. Columnas:

| Columna | Contenido |
| --- | --- |
| TAREA / PM | Identificador como texto, conservando ceros y guiones |
| N.º de OM | Identificador como texto |
| Estado OM | Incluye `Valor aprobado` para las OM elegibles |
| Valor (Gs.) | Número sin símbolos ni separadores de miles |
| Descripción | Descripción común de la tarea |
| Tiempo (h) | Tiempo original individual de la tarea |
| Criticidad | Clasificación importada |
| Estado tarea | Estado importado de tarea/PM |

Los datos comunes deben coincidir entre filas de la misma tarea. Las filas de OM idénticas se deduplican; contradicciones o una OM vinculada a más de una tarea se informan como error. Los campos faltantes se muestran en la revisión y bloquean el envío cuando son necesarios. Los IDs numéricos en XLSX deben convertirse a texto para evitar perder ceros de formato. Exportar fórmulas como valores antes de importar: el lector utiliza el resultado guardado del libro, no recalcula Excel.

Antes de confirmar se muestran tareas nuevas, eliminadas y cambios en datos, estados, valores o vínculos. Se guardan procedencia, fecha, usuario, diferencias e instantánea de cada importación. Reimportar reemplaza la fuente vigente sin duplicar registros ni modificar planes existentes. Una fila desactualizada se actualiza con una acción explícita y confirmación, conservando sus campos propuestos. Los planes enviados permanecen congelados. No hay carga automática de datos de ejemplo: el control **Preparar ejemplo ficticio** requiere confirmar y registra su procedencia ficticia.

Límites: 10 MB por archivo, 20.000 filas de datos, 500 tareas por propuesta y aproximadamente 3 MB por solicitud al servidor. Si un archivo produce una solicitud mayor se informa el error sin modificar el guardado.

## Persistencia

Hay dos modos claramente identificados:

1. **Demo local** sin variables de Supabase. Clave nueva `pcm-connect.modulo1.v13`; preserva `pcm-connect.planificaciones.v1`. Web Locks serializa escrituras de pestañas del mismo origen y una revisión detecta guardados obsoletos. No ofrece identidad real ni sincronización entre equipos.
2. **Servidor** con Supabase y Vercel. `/api/pcm` autentica y aplica las mismas reglas tipadas que utiliza la demo. La fuente es `server/pcm.ts`; `npm run build` genera `api/pcm.mjs` con Vite como función JavaScript autocontenida. Este archivo generado se versiona para que Vercel detecte la ruta y se comprueba contra sus fuentes en las pruebas; no debe editarse manualmente. Las tablas no se exponen a los roles anon/authenticated. La función SQL `pcm_guardar` bloquea la fila y compara la revisión antes de persistir contador, TAG, propuesta, recibo y auditoría juntos. Solo la API con `service_role` puede invocarla. Dos solicitudes distintas con la misma revisión producen un guardado y un conflicto; el mismo recibo se procesa una vez.

Las modificaciones de plan y fuente se auditan con usuario, fecha, valores anteriores y nuevos. El estado se almacena como documento JSON transaccional de una única organización PCM. Esta estructura simplifica la migración inicial y la validación compartida; un uso de gran volumen requerirá normalizar tablas y paginar el historial. Ningún historial se purga automáticamente.

La pantalla mantiene además una copia local de recuperación de los cambios sin guardar, separada por usuario y modo. Esa copia no equivale a un borrador guardado en el servidor. Al recargar se ofrece el contenido recuperado; la versión persistida puede abrirse desde el selector. Ante un conflicto se conserva la pantalla y se permite actualizar/reabrir, sin sobrescribir cambios ajenos. Los guardados ilegibles se bloquean y se permite descargar respaldo.

## Habilitar servidor en el proyecto existente

No se creó un proyecto Vercel ni una base externos durante esta iteración. Proyecto existente identificado mediante el estado de GitHub: `douglas-nomad/pcm-connect`.

1. El propietario confirmó preparar Supabase. Identificar/configurar su proyecto autorizado; todavía no se proporcionaron sus variables ni credenciales. No crear servicios externos adicionales sin definir la cuenta de destino.
2. En el proyecto Supabase autorizado, aplicar `supabase/migrations/202611030001_modulo1.sql`. Es una migración aditiva e idempotente, sin modificar datos v1.
3. Crear o identificar las cuentas en Supabase Auth. Registrar sus UUID, nombre y rol en `public.pcm_perfiles` desde una conexión de administración. No hay autorregistro ni selección de permisos desde la aplicación.
4. Configurar las cuatro variables de `.env.example` en Vercel, usando los mismos valores de URL para cliente y servidor. `VITE_SUPABASE_ANON_KEY` es pública; `SUPABASE_SERVICE_ROLE_KEY` es exclusivamente secreta de servidor, sin prefijo `VITE_`.
5. Para trabajar localmente, copiar `.env.example` a `.env.local` y completar la configuración fuera de Git. `npm run dev` sirve también `/api/pcm` mediante el middleware de desarrollo. Para demo local, dejar las variables sin configurar.
6. Conectar Vercel o iniciar sesión en la CLI. Vincular únicamente el proyecto existente y desplegar después de aplicar la migración y variables. La integración GitHub→Vercel ya tenía un estado de despliegue exitoso en el HEAD inicial.
7. Comprobar login real, perfil autorizado, persistencia desde otro navegador y despliegue de `/api/pcm`. Sin credenciales estas verificaciones remotas quedan pendientes y no deben declararse completas.

Referencias de implementación: [funciones de Vercel](https://vercel.com/docs/functions/runtimes/node-js), [seguridad de funciones de Supabase](https://supabase.com/docs/guides/database/functions), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [lector XLSX](https://github.com/catamphetamine/read-excel-file).

## Verificación y recorrido manual

Ejecutar `npm ci`, `npm test`, `npm run lint`, `npm run build` y `npm audit`. Node 24 es el entorno verificado. Las pruebas existentes de la demo histórica permanecen.

Para probar desde el navegador en modo demo:

1. `npm run dev -- --host 127.0.0.1 --port 5173 --strictPort`; abrir `http://127.0.0.1:5173/`.
2. Seleccionar rol Administrador, abrir Catálogos y crear un remolcador y ubicación **ficticios**.
3. En Planificación, guardar un borrador vacío y comprobar su TAG. En el importador, revisar/confirmar el ejemplo ficticio o usar `tests/fixtures/modulo1-ficticio.xlsx`.
4. Buscar `DEMO-1001 DEMO-PM-02 DEMO-1001 NO-EXISTE` si se cargó el ejemplo. Comprobar dos filas, aviso de repetido/inexistente y valor 720.000 para la primera. La OM cerrada no aparece.
5. Completar cabecera, trabajadores y responsables; elegir TERCERIZADO para la segunda. Modificar tiempo propuesto, reordenar, guardar y recargar. Comprobar original, TAG, valores y orden.
6. Ingresar ETA a las 23:30 y dos horas de parada: el fin debe estar en el día siguiente. Una tarea con duración mayor debe advertir y permitir enviar.
7. Enviar dos veces; debe persistir una propuesta. Cambiar a Taller y abrir Validación Taller. Evaluar la tarea interna completa; la externa no exige evaluación. Finalizar y revisar historial.
8. Abrir otro borrador y buscar una tarea reservada: debe informar el TAG relacionado. Reimportar datos modificados y verificar que la propuesta enviada conserva su contenido.

Las pruebas de interacción usan happy-dom (DOM simulado, sin diseño visual); la migración y concurrencia usan PGlite (PostgreSQL WASM). La autenticación HTTP en esas pruebas se simula expresamente. La prueba XLSX lee un archivo real completamente ficticio. La revisión visual en navegador y la autenticación/persistencia contra una cuenta real necesitan verificaciones adicionales.
