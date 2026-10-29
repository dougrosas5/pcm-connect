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

## Cómo descargar y ejecutar en tu computadora

Estos pasos están pensados para Windows. Necesitás conexión a Internet para descargar el proyecto e instalar sus dependencias por primera vez. No necesitás instalar Git, Visual Studio Code ni una base de datos.

### 1. Instalar Node.js

1. Entrá a la [página oficial de descarga de Node.js](https://nodejs.org/en/download).
2. Seleccioná la versión **24.x LTS**, Windows y el instalador **`.msi`** para tu equipo (x64 en la mayoría de las PC; ARM64 si tu equipo usa esa arquitectura). Esta es la versión principal utilizada para verificar el proyecto.
3. Ejecutá el instalador y mantené las opciones predeterminadas, incluyendo **npm** y la incorporación de Node.js al **PATH**. No hacen falta herramientas adicionales de compilación para esta demo.
4. Si tenías una terminal abierta, cerrala y abrila de nuevo después de instalar.

### 2. Descargar PCM Connect

1. Abrí [el repositorio en GitHub](https://github.com/dougrosas5/pcm-connect).
2. Pulsá el botón **Code** y elegí **Download ZIP**.
3. Buscá el ZIP descargado, hacé clic derecho y elegí **Extraer todo**. Elegí una carpeta fácil de encontrar, por ejemplo dentro de Documentos.
4. Abrí la carpeta extraída `pcm-connect-main`. La carpeta correcta contiene `package.json`, `package-lock.json`, `index.html` y `src`. Si ves otra carpeta `pcm-connect-main` adentro, entrá en ella.

No ejecutes el proyecto dentro del ZIP ni abras `index.html` con doble clic: la aplicación necesita el servidor local del siguiente paso. Si GitHub muestra un error de acceso, pedile al propietario que te dé acceso al repositorio con tu cuenta.

### 3. Abrir la terminal en la carpeta del proyecto

En el Explorador de archivos, dentro de la carpeta que contiene `package.json`, hacé clic en la barra de direcciones, escribí **`cmd`** y presioná Enter. Se abre el Símbolo del sistema ubicado en esa carpeta.

Comprobá que Node.js y npm estén instalados ejecutando estos comandos, uno por vez:

```bat
node --version
npm --version
```

El primero debe mostrar `v24.x.x` y el segundo un número de versión de npm.

### 4. Instalar y arrancar

En esa misma terminal ejecutá:

```bat
npm ci
```

Esperá a que termine la instalación y vuelva a aparecer el cursor. Este comando descarga las dependencias definidas en el proyecto. Después ejecutá:

```bat
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Cuando aparezca el mensaje de Vite con la dirección local, abrí **[http://127.0.0.1:5173/](http://127.0.0.1:5173/)** en tu navegador. Dejá la terminal abierta mientras uses la aplicación.

Para detenerla, volvé a la terminal y presioná **Ctrl + C**. Si Windows pide confirmar, aceptá.

### 5. Volver a abrirla otro día

Abrí `cmd` desde la misma carpeta y ejecutá solamente:

```bat
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Después entrá a **http://127.0.0.1:5173/**. No hace falta repetir `npm ci` cada vez; ejecutalo si descargás una nueva versión o falta la carpeta `node_modules`.

### Primera prueba

Creá una planificación desde **Planificación**, completando remolcador ficticio, fecha y horas. Buscá `1001 1003 0010-A` para incorporar trabajos abiertos. Podés buscar `1002 1004 9999` para revisar avisos de tareas cerradas o inexistentes. Completá los campos de preparación y usá **Enviar a Taller**. En **Validación Taller**, cambiá el selector de rol simulado para probar la evaluación por OM y la respuesta de PCM.

**Cada compañero tendrá sus propios datos locales.** Las planificaciones no se sincronizan entre computadoras ni entre navegadores. Usá siempre la misma dirección, navegador y perfil para recuperar lo guardado. Evitá el modo incógnito y no borres los datos del sitio si querés conservar las planificaciones.

### Si algo no funciona

| Mensaje o problema | Qué hacer |
| --- | --- |
| `node` o `npm` no se reconoce | Instalá Node.js con npm y PATH habilitados; cerrá la terminal y abrí una nueva. |
| Error al encontrar `package.json` / `ENOENT` | Abrí la terminal dentro de la carpeta que contiene `package.json`, no en la carpeta superior. |
| PowerShell bloquea `npm.ps1` | Usá el Símbolo del sistema (`cmd`) como indican los pasos anteriores. |
| `npm ci` no termina correctamente | Revisá la conexión a Internet, comprobá que usás Node.js 24 y repetí el comando. Si persiste, compartí el mensaje de error con el propietario. |
| El puerto 5173 está ocupado | Detené con Ctrl + C otra instancia de PCM Connect que esté abierta. Si lo usa otro programa, pedí ayuda al propietario antes de cambiar la dirección, porque el guardado depende de ella. |
| El navegador no conecta | Comprobá que el comando de arranque siga ejecutándose y usá la dirección exacta `http://127.0.0.1:5173/`. |

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
