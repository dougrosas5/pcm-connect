# PCM Connect — sistema visual naval operativo (v0.4)

## Dirección vigente

Pedido del propietario del 17/11/2026: reproducir la apariencia de las fotografías de `design-reference/`, con componentes reales e interactivos. Esta dirección sustituye las paletas Graphite y Graphite Maritime anteriores. El nombre de este archivo se conserva para no romper enlaces de documentación; las reglas funcionales se mantienen en sus contratos actuales.

El refinamiento posterior del propietario prioriza una aplicación empresarial de uso diario: conservar la composición naval y reducir saturación, decoración, radios y textos de presentación. Los títulos principales llevan solo el nombre funcional (Planificación, Tareas, Validación Taller, Revisión PCM), sin números de módulo ni roles.

La carpeta local `design-reference/` contiene el prompt de reconstrucción, la guía y 16 imágenes. Se conserva fuera de Git y Vercel, sin importar sus imágenes en el producto. Referencia principal de Planificación: `referencias/02_modulo_1_planificacion.jpeg`, 1600 × 900. La bandeja de Taller sigue la referencia 04, con los estados y datos realmente implementados. Las demás pantallas se abordan una por una.

## Paleta y geometría

- Sidebar: azul naval `#102F4C`, siempre visible al desplazar en escritorio.
- Topbar: azul `#123E67`, con la marca en un único lugar y contexto secundario discreto.
- Acciones principales y selección: azul `#1E5B94`, sólido. Los títulos no llevan bandas coloreadas.
- Fondo: `#F3F5F7`; superficies blancas; paneles secundarios `#F0F3F6`; texto principal `#243447`.
- Tablas: encabezados azul claro, divisores finos, controles compactos, criticidad alta roja/media amarilla/baja verde. Las etiquetas muestran los estados reales; no convertir «Abierta» a «Planificable» solo porque aparezca así en la foto.
- Tokens centralizados en `src/styles/tokens.css`; conservar los alias históricos para los módulos que todavía no se reconstruyeron.
- Escritorio: topbar de 50 px, sidebar de 184 px y margen de contenido de 20 px. Cabecera y propuesta en dos paneles compactos, bordes finos y radios de 4–6 px. Sombras reservadas a desplegables, sin elevación ornamental de paneles.

## Componentes y alcance

`AppShell`, `Sidebar` y `PageHeader` forman el shell naval compartido. `Icono` usa SVG propios de trazo consistente, sin dependencias. No se recibió un archivo vectorial independiente del barco/logotipo de las fotografías ni una fuente tipográfica original: se conserva el nombre PCM Connect y se usa un pictograma naval de interfaz, sin afirmar que sea el logo exacto.

M1 reorganiza la cabecera en seis campos y un resumen de parada derivado del mismo plan. Mantiene el selector de planes guardados y la creación de propuestas en la cabecera. Los datos de autoría, ETA inicial e indicaciones de catálogos se consultan con el control de información. El TAG real se conserva; no copiar numeraciones de muestra.

La propuesta presenta búsqueda múltiple, importación con vista previa e historial, tabla agrupada por TAREA/PM y OM, advertencias y acciones Guardar/Enviar. Los valores originales de duración se conservan y se consultan mediante el título/descripción accesible del campo en escritorio; en móvil se muestran también debajo. Las acciones de fila mantienen nombres accesibles y ordenamiento/quitar existentes.

La sesión y el rol simulado se consultan desde el menú superior, con la advertencia explícita de demo sin autenticación ni seguridad real. El historial general sigue disponible debajo de la propuesta. Se conservan los siete destinos existentes y se retiran del menú los accesos decorativos a futuras pantallas. Los datos ficticios conservan su identificación; no ocultarla para aparentar un sistema productivo.

Validación Taller reutiliza los controles compartidos, mantiene filtros, consulta, evaluación e historial, y muestra solo indicadores con estados implementados. El historial de ETA se despliega a demanda. La maquetación del formulario de evaluación pertenece a `validacion-taller.css`, sin depender de estilos específicos de Revisión PCM. No se alteran permisos, cálculos, decisiones ni persistencia.

El bloque de «Especificaciones para el programador» de la fotografía es documentación de referencia, no parte de la interfaz operativa. No copiarlo al producto. Tampoco copiar contadores de notificaciones, usuarios o estadísticas ficticias como datos reales.

## Accesibilidad y responsive

Mantener labels, foco visible, navegación por teclado y enlace de salto. En móvil reorganizar cabecera, menú y acciones; garantizar scroll propio para la tabla completa. Controles táctiles de al menos 44 px. Los desplegables de importación y metadatos deben permitir consultar y cerrar su contenido sin perder acceso a las acciones.

Comparar capturas a 1600 × 900 y verificar también 1366 × 768 y 1920 × 1080, además de una vista móvil. La comparación evalúa estructura, tamaños y colores con datos ficticios marcados, sin afirmar fidelidad porcentual no medida. Preservar persistencia, roles, validaciones, costos faltantes, TAG y trazabilidad. La reconstrucción visual no autoriza implementar ETA Predictiva ni alterar su contrato.
