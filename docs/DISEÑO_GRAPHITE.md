# PCM Connect — Graphite Design System (v0.1)

## Carácter
Sistema operacional industrial, austero, claro, consistente, sin apariencia de dashboard AI genérico. Diseñar para evaluar OM, escanear tablas y arrastrar trabajos a empleados. Priorizar densidad útil y confianza.

## Paleta obligatoria
- Grafito principal / sidebar: `#262626`
- Fondo de aplicación: `#E9E9E6`
- Acento cálido / acción primaria: `#B65B47`
- Texto secundario: `#777774` (verificar contraste real según fondo)
- Superficies de tabla/tarjetas: `#FFFFFF`
- Divisores neutros discretos, semáforos de estado accesibles con etiquetas + texto, no solo color.

## Principios
- Navegación lateral firme y discreta. No sustituir por landing page.
- Tablas de OM compactas, encabezados legibles y columnas alineadas; filas por OM.
- Filtros simples, vista de contenido predecible, estados vacíos/error explícitos y acciones visibles.
- Tarjetas de trabajador escaneables: nombre, legajo, carga asignada, horas validadas, pendientes, OM actuales y alertas.
- Inputs con labels y ayudas, navegación con teclado, foco visible, targets cómodos, contraste y responsive funcional.
- Espaciado consistente, bordes finos, radios moderados (4-8px), sin sombras vistosas, sin gradientes, sin iconos decorativos ni movimiento innecesario.
- Microinteracciones solo para comunicar estado (arrastrando, destino válido, rechazo, confirmación). Respetar prefers-reduced-motion.
- Usar terminología española coherente (PCM, Taller, OM, escala). Mostrar fechas/horas de Paraguay solo cuando sean relevantes y explícitamente definidas.

## Referencias consultables
Skills locales de `awesome-design-ops`, `taste-ops` e `impeccable-ops` incluyen ejemplos, pero este documento y el usuario prevalecen siempre. Las referencias de marketing o animación cinematográfica NO justifican introducir GSAP ni secciones AIDA en una aplicación de trabajo.
