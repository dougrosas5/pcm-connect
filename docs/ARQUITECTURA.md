# Arquitectura de PCM Connect

## Estructura

```text
src/
  main.tsx                         Entrada React y estilos globales
  app/
    App.tsx                        Menú y selección de pestaña
    EspacioPCM.tsx                  Composición de las vistas vigentes
    hooks/useRegistroPCM.ts         Estado compartido, recuperación y ejecución
  components/
    SelectorCatalogo.tsx            Selector reutilizado en cabecera y propuesta
  features/
    planificacion/
      components/                  CabeceraPlan, TablaPropuesta, Importador
      model/                       Modelo, comandos y validación
      services/importacion.ts      Lectura y validación de CSV/XLSX
      data/fuenteFicticia.ts        Ejemplo optativo, sin carga automática
    catalogos/components/          Administración de catálogos
    validacion-taller/
      components/                  Bandeja/detalle y EditorEta
      model/bandeja.ts             Filtros y grupos de estados
      styles/                      Estilos exclusivos de Taller
      legacy/                      Recepción v1.3 conservada, no montada
    archivo-local/
      components/                  Pantallas de la demo histórica
      model/                       Reglas y tipos históricos
      services/                    Persistencia histórica
      data/                        Tareas y remolcadores ficticios históricos
  services/pcm/persistencia.ts      Adaptadores local/HTTP y sesión
  types/pcm.ts                     Contrato compartido de los planes vigentes
  utils/descargas.ts                Descarga de texto desde el navegador
  styles/                          global.css, app.css y operaciones.css
server/pcm.ts                      API autenticada y adaptador Node
api/pcm.mjs                        Función autocontenida generada para Vercel
scripts/build-api.mjs              Empaquetado de la API
supabase/migrations/               Esquema y permisos de servidor
tests/                            Pruebas y fixtures ficticios
docs/                             Documentación técnica permanente
```

No hay carpetas para funcionalidades aún no implementadas. Las pruebas conservan sus nombres históricos para facilitar su seguimiento.

## Navegación y estado React

`App` selecciona la pestaña mediante estado React; no utiliza un router ni modifica la URL. `EspacioPCM` permanece montado al navegar y recibe la vista `plan`, `taller` o `catalogos`. Planificación y Tareas muestran la misma preparación, como en el funcionamiento existente. Personal continúa siendo un aviso de módulo pendiente.

`useRegistroPCM` concentra el estado y los efectos que ya compartían las vistas: carga, sesión, recuperación local, guardado, actualización, bloqueo de solicitudes simultáneas y mensajes de error. Es un hook de aplicación, no una segunda base de datos. Los campos transitorios de los formularios permanecen en los componentes. Separar este hook de JSX permite revisar la persistencia sin recorrer la presentación.

`CabeceraPlan` presenta los campos de un plan sin almacenarlo por su cuenta. `SelectorCatalogo` se reutiliza en cabecera y filas. `EditorEta` contiene el formulario específico de ETA y utiliza la misma operación compartida que el resto del espacio de trabajo.

## Dominio y dependencias

- `types/pcm.ts` define únicamente tipos; es el contrato compartido por UI, servicios y servidor.
- `features/planificacion/model/modelo.ts` contiene creación de registros y funciones puras de fechas, propuestas, importes y elegibilidad.
- `model/comandos.ts` aplica las operaciones existentes y audita los cambios sobre una copia del registro. No depende de React, DOM ni variables Vite.
- `model/validacion.ts` comprueba la forma de los comandos y datos persistidos. La API y la aplicación reutilizan estas validaciones.
- `services/pcm/persistencia.ts` elige el almacenamiento local o la API. El servidor importa el dominio puro, nunca este módulo con `import.meta.env` y APIs de navegador.
- La bandeja de Taller utiliza los planes y tipos de Planificación; no mantiene otra colección.
- Archivo local conserva su contrato independiente. No se convierten sus planes ni se unifican sus reglas históricas con el contrato vigente.
- `legacy/RecepcionTallerV13.tsx` conserva la recepción anterior por tarea. No está conectada a la navegación y no debe reactivarse sin resolver los requisitos pendientes.

Se usan imports relativos explícitos, compatibles con Vite, TypeScript y las pruebas Node. No se requieren aliases, un contenedor de servicios ni reexportaciones globales.

## Persistencia

Claves existentes que deben permanecer estables:

| Clave | Uso |
| --- | --- |
| `pcm-connect.modulo1.v13` | Registro vigente en demo local |
| `pcm-connect.modulo1.recuperacion.<demo\|servidor>.<actorId>` | Copia de cambios sin guardar |
| `pcm-connect.auth.v13` | Sesión de servidor |
| `pcm-connect.planificaciones.v1` | Planes e historial del Archivo local |

La ubicación de los archivos fuente no cambia ninguna clave ni el formato del JSON. La revisión global, la versión de plan y los recibos de solicitud siguen controlando concurrencia e idempotencia. La lectura de datos dañados informa error sin reemplazarlos por registros vacíos.

## Estilos y recursos

`main.tsx` carga `styles/global.css`; `App` carga `styles/app.css`; `EspacioPCM` carga `styles/operaciones.css`; Taller importa su hoja específica. Conservar ese orden y las clases existentes para evitar cambios de cascada. Los estilos Graphite son CSS propio, sin librerías visuales.

El favicon utilizado permanece en `public/favicon.svg`. Los ejemplos de tareas están junto a su funcionalidad, no mezclados con los componentes ni con los datos del otro contrato.

## Build y despliegue

`npm run build` ejecuta `tsc -b`, compila el cliente en `dist/` y genera `api/pcm.mjs` desde `server/pcm.ts`. El bundle de API debe permanecer versionado: es una entrada de despliegue de Vercel, no un residuo prescindible. No editarlo a mano. La prueba del bundle comprueba que corresponda a la fuente y que se ejecute por HTTP.

`vite.config.ts` mantiene el middleware `/api/pcm` de desarrollo. Las variables públicas y secretas continúan separadas como describe `.env.example`. Esta estructura no requiere modificar el proyecto remoto de Vercel ni las migraciones existentes.

## Documentación local de agentes

Los resúmenes de trabajo se entregan en el chat. Si se necesita continuidad o respaldo, se guarda en `.codex-outputs/`, excluida por `.gitignore` y `.vercelignore`. Nunca importar esos archivos desde la aplicación ni enlazarlos como documentación requerida para un clon del repositorio. Las especificaciones, contratos y esta guía sí pertenecen a `docs/`.

`AGENTS.md` y las skills locales se conservan; su exclusión local preexistente no cambia. La política permanente de informes está en `AGENTS.md`.

## Comprobaciones habituales

```sh
npm run build
npm run lint
npm test
git diff --check
git check-ignore .codex-outputs/notes/CONTINUIDAD.md
git ls-files .codex-outputs
```

El último comando debe estar vacío. Probar navegación, guardado/reapertura, recuperación y ETA con datos ficticios. El DOM simulado no reemplaza la inspección visual de escritorio y móvil.
