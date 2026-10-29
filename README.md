# PCM Connect

Aplicación de planificación de mantenimiento y coordinación entre PCM y Taller. Permite preparar trabajos, evaluar la viabilidad de cada orden de mantenimiento (OM) y registrar la decisión de PCM con su historial.

## Funciones disponibles

- Búsqueda de varias tareas a la vez, con recuperación de sus OM abiertas, avisos y control de duplicados.
- Preparación agrupada por tarea, con duración, responsable, cantidad de personas y costos estimados en guaraníes.
- Creación y consulta de planificaciones con remolcador, fecha de parada y código incremental.
- Evaluación de Taller por OM, motivos de rechazo, correcciones y revisiones.
- Confirmación de las OM viables, devolución a revisión o cancelación por PCM.
- Guardado de planes e historial en el navegador mediante `localStorage`.

La versión actual es una demo con datos ficticios y roles simulados. No tiene backend ni autenticación real. Los datos pertenecen al navegador y al origen utilizado; se recomienda trabajar desde una sola pestaña. Las asignaciones de personal y la validación de horas reales están pendientes.

## Desarrollo local

Requisitos: Node.js 24 y npm.

```sh
npm ci
npm run dev
```

Abrir la dirección indicada por Vite. Para probar la búsqueda, usar `1001 1003 0010-A`; `1002 1004 9999` permite revisar avisos de trabajos cerrados e inexistentes.

## Verificación

```sh
npm test
npm run lint
npm run build
```

Las pruebas cubren búsqueda, validaciones, persistencia y reglas del flujo PCM–Taller, además del renderizado de componentes. La revisión visual y las interacciones completas en navegador se comprueban manualmente.

## Organización

- `src/components/`: pantallas y formularios.
- `src/features/`: reglas de negocio y almacenamiento local.
- `src/data/`: tareas y remolcadores ficticios.
- `tests/`: pruebas automatizadas.
- `docs/`: requisitos, diseño y documentación del desarrollo.

Desarrollado con React, TypeScript y Vite; CSS propio y Oxlint.

## Documentación

- [Resumen del desarrollo](docs/RESUMEN_DESARROLLO.md)
- [Requisitos funcionales](docs/PCM_REQUISITOS.md)
- [Diseño Graphite](docs/DISEÑO_GRAPHITE.md)
- [Costos estimados y supuestos](docs/COSTOS_ESTIMADOS_PYG.md)
