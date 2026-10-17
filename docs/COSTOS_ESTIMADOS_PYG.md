# Costos referenciales en guaraníes y responsables

Actualización: 17 de octubre de 2026. El usuario autorizó investigar precios públicos y construir estimaciones propias para las OM ficticias de la demo.

## Referencias consultadas

- [Syopar · sello mecánico Vulcano](https://syopar.com.py/products/sello-mecanico-vulcano): precio publicado Gs. 45.000, con IVA incluido. Se usa como referencia de un sello de bomba pequeño, sin afirmar compatibilidad con un equipo real.
- [Electromer · contactor Elektron CNC1-1811 de 18 A](https://electromer.com.py/product/contactor-cnc1-1811-18a/): precio publicado Gs. 100.000. Se usa como referencia de componente para OM-005.
- [CuantoEs · mano de obra eléctrica](https://www.cuantoes.com.py/costos/electricidad): índice secundario que informa Gs. 450.000 a 600.000 por cambio de tablero y Gs. 350.000 como base de detección de fuga. Sirve para contrastar el orden de magnitud del servicio eléctrico; no es una tarifa industrial por hora ni una cotización de verificación de protecciones.

Los precios publicados corresponden a productos o servicios de referencia. Los totales siguientes son estimaciones propias para demostración, no presupuestos emitidos por esos proveedores.

## Supuestos y desglose

Se supone equipamiento pequeño, acceso normal y trabajo programado. La alineación es convencional, sin contratación de alineación láser para grandes motores. Se adopta como supuesto propio Gs. 100.000/h para mantenimiento general, Gs. 150.000/h para alineación/verificación eléctrica y Gs. 250.000 por un evento de calibración simple. Esas tarifas no se atribuyen a los sitios consultados.

| OM | Mano de obra estimada | Materiales/consumibles estimados | Costo total (Gs.) |
| --- | --- | --- | --- |
| OM-001 · sello de bomba | 3 h × 100.000 = 300.000 | Sello de referencia 45.000 + consumibles supuestos 25.000 | 370.000 |
| OM-002 · alineación | 2 h × 150.000 = 300.000 | Calces/consumibles supuestos 50.000 | 350.000 |
| OM-003 · inspección de rodamientos | 2 h × 100.000 = 200.000 | Consumibles supuestos 20.000 | 220.000 |
| OM-004 · verificación de protecciones | 1,5 h × 150.000 = 225.000 | Consumibles supuestos 25.000 | 250.000 |
| OM-005 · cambio de contactor | 2 h × 100.000 = 200.000 | Contactor de referencia 100.000 + consumibles supuestos 20.000 | 320.000 |
| OM-006 · calibración de transmisor | Evento supuesto 250.000 | Sin repuestos previstos | 250.000 |
| OM-007 · revisión de circuito de agua | 4 h × 100.000 = 400.000 | Consumibles supuestos 50.000 | 450.000 |

Los montos son provisiones globales orientativas; no se agrega automáticamente IVA, traslado, urgencias, certificación metrológica ni repuestos mayores. No se supone un tratamiento impositivo uniforme para las distintas fuentes. No representan un costo operativo real validado.

Cada costo queda fijo por OM en la base ficticia. Editar la duración o la cantidad de personas no recalcula el presupuesto: no se introdujo una nueva regla de horas-persona. Las OM cerradas continúan excluidas de la preparación y del total.

## Responsables y presentación

- Lista única en `src/data/tareas.ts`: Douglas, Ale y Pepe.
- Cada OM comienza sin responsable; el usuario debe seleccionarlo. Se valida que el nombre pertenezca a la lista y se conserva al repetir una búsqueda o navegar.
- El desplegable configura el responsable del borrador; no implementa autenticación ni autorización para asignaciones o validación de horas.
- Importes mostrados como guaraníes enteros, con separador de miles. El modelo sigue admitiendo costo desconocido y la UI mantiene «Sin definir» y subtotal pendiente.
- El botón de Planificación se llama «Búsqueda de tareas» y sigue abriendo Tareas.

## Verificación

Ejecutar `npm run build`, `npm run lint`, `npm test` y `git diff --check`.

En el navegador, entrar a Planificación y usar «Búsqueda de tareas». Buscar `1001`: dos OM y total Gs. 720.000. Elegir Douglas en OM-001 y Ale en OM-002; comprobar independencia, cambiar a Pepe y repetir la búsqueda para verificar conservación de los valores. Volver a «Seleccionar responsable» y salir del campo: aparece el error. Agregar `1003`: total Gs. 970.000. Agregar `0010-A`: total Gs. 1.420.000. Buscar `1002 1004 9999`: no se suman OM cerradas ni inexistentes. Revisar desplegable con teclado y a 375 px de ancho.

El caso de costo ausente se mantiene cubierto por una base de prueba específica; todas las OM de la demo principal tienen ahora un costo referencial.
