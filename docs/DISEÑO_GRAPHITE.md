# PCM Connect — Graphite Maritime (v0.2)

## Carácter
Sistema operacional industrial, austero, claro y consistente. Diseñar para evaluar OM, escanear tablas y arrastrar trabajos a empleados. Priorizar densidad útil y confianza.

## Paleta obligatoria
Identidad confirmada por el propietario el 16/11/2026. Sustituye la paleta Graphite v0.1; no modifica reglas funcionales.

- Grafito principal / sidebar: `#262A30`
- Azul acero / acción primaria y selección: `#385875`
- Fondo de aplicación: `#F1F1EE`
- Superficies de tabla/tarjetas: `#FFFFFF`
- Acento terracota: `#B65B47`
- Texto secundario legible: `#626872`
- Divisores neutros discretos, semáforos de estado accesibles con etiquetas + texto, no solo color.

El logo textual actual «PCM Connect.» y su punto cálido se conservan; no se introduce otro logotipo. No hay imágenes de referencia del rediseño en el repositorio al adoptar esta versión: la dirección proviene de los requisitos escritos.

## Tokens y componentes compartidos

`src/styles/tokens.css` es la fuente de valores de color, tipografía, espaciado, radios, ancho lateral y altura de controles. Se importa desde `global.css` antes de las hojas de aplicación. Una variable CSS (token) permite cambiar un valor una sola vez y reutilizarlo en todas las pantallas.

Los nombres históricos `--grafito`, `--fondo`, `--acento`, `--superficie`, `--borde` y los textos secundarios son alias compatibles: los módulos pueden adoptar la identidad sin cambiar su lógica ni su estructura de datos.

| Pieza | Implementación compartida |
| --- | --- |
| Contenedor, navegación y encabezado | `components/layout/AppShell.tsx`, `Sidebar.tsx`, `PageHeader.tsx` |
| Botones | `.boton-primario`, `.boton-secundario`; misma apariencia dentro y fuera de M1 |
| Tablas con desplazamiento | `.tabla-contenedor`, `.tabla-tareas`; cada módulo conserva columnas, caption y relaciones propias |
| Formularios y filtros | Controles nativos, `.m1-campo`, `.m1-cabecera`, `.m1-panel`; se mantienen labels y validaciones |
| Indicadores | `.m2-indicadores`; conserva listas descriptivas e indicadores derivados del registro |
| Estados | `.estado` con `data-tono` opcional; sin interpretación automática de estados del dominio |
| Avisos y vacíos | `.m1-error`, `.m3-advertencia`, `.estado-vacio`; roles y mensajes existentes |
| Modal y confirmaciones | `ModalRevision` conserva `dialog`, foco, descarte y scroll; confirmaciones nativas/en línea existentes |

No crear una biblioteca de tablas genéricas ni reemplazar formularios para cambiar colores. Calendar, WorkCard y WorkerCard se incorporarán cuando existan los módulos que los necesitan. No agregar componentes de carga o confirmación paralelos a los existentes sin una necesidad concreta.

## Estados semánticos

Cada estado tiene tokens `--estado-<tono>-texto`, `-fondo` y `-borde` en `tokens.css`:

| Tono | Significado visual |
| --- | --- |
| `aceptado` | Verde: decisión favorable |
| `rechazado` | Rojo: rechazo o error |
| `pendiente` | Ocre: espera de resolución |
| `ejecucion` | Azul acero: trabajo en ejecución |
| `finalizado` | Verde azulado: trabajo terminado |
| `advertencia` | Ámbar: revisión necesaria |
| `solapamiento` | Ciruela: conflicto de horarios |
| `bloqueado` | Grafito neutro: restricción |

Uso de presentación: `<span className="estado" data-tono="aceptado">Aceptada</span>`. Sin tono explícito se utiliza un neutro; nunca deducir aceptación de una OM abierta ni ejecución de una planificación confirmada. La adopción de tonos por estado de cada módulo queda para su fase visual. Los tokens no introducen nuevos estados persistidos.

## Escritorio, teclado y responsive

- En escritorio, sidebar de 232 px con posición sticky, altura del viewport y scroll propio si es necesario. El contenido se desplaza sin perder la navegación.
- Encabezado compacto y controles de 36 px en escritorio con puntero preciso. Controles de al menos 44 px en pantallas de hasta 760 px o con puntero táctil.
- En pantallas estrechas, navegación superior con todos los destinos existentes, formularios en una o dos columnas y tablas con desplazamiento horizontal propio.
- Foco visible en azul acero, foco cálido sobre sidebar y enlace «Saltar al contenido». Ningún estado depende exclusivamente del color.
- Modal amplio con cabecera y pie visibles y contenido desplazable; conservar Escape, retorno de foco y protección de cambios sin guardar.

## Principios
- Navegación lateral firme y discreta. No sustituir por landing page.
- Tablas compactas, encabezados legibles y columnas alineadas. En Módulo 1 v1.3, una fila por tarea/PM con OM agrupadas; el archivo de la demo conserva sus filas por OM.
- Filtros simples, vista de contenido predecible, estados vacíos/error explícitos y acciones visibles.
- Tarjetas de trabajador escaneables: nombre, legajo, carga asignada, horas validadas, pendientes, OM actuales y alertas.
- Inputs con labels y ayudas, navegación con teclado, foco visible, targets cómodos, contraste y responsive funcional.
- Espaciado consistente, bordes finos, radios moderados (4-8px), sin sombras vistosas, sin gradientes, sin iconos decorativos ni movimiento innecesario.
- Microinteracciones solo para comunicar estado (arrastrando, destino válido, rechazo, confirmación). Respetar prefers-reduced-motion.
- Usar terminología española coherente (PCM, Taller, OM, escala). Mostrar fechas/horas de Paraguay solo cuando sean relevantes y explícitamente definidas.
