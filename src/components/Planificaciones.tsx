import { useEffect, useState } from 'react'
import BusquedaTareas from './BusquedaTareas'
import { remolcadoresDemo } from '../data/remolcadores'
import { clavePlanificaciones, guardarPlanificaciones, leerPlanificaciones } from '../features/almacenPlanificaciones'
import { actualizarPreparacion, crearPlanificacion, erroresDatosGenerales, registroVacio } from '../features/planificaciones'
import type { DatosGenerales, Preparacion, RegistroPlanificaciones } from '../features/planificaciones'
import ValidacionTaller from './ValidacionTaller'
import { enviarATaller, permisos, preparacionEditable, revisionDe, rolesDemo, tareaEditable } from '../features/validacionTaller'
import type { Actor, RolDemo } from '../features/validacionTaller'

const datosVacios: DatosGenerales = { remolcador: '', fechaParada: '', horasParada: '' }
const mensajeLectura = 'No se pudieron leer las planificaciones locales. Los datos guardados no se modificaron. Revisá el almacenamiento del navegador y recargá para volver a intentar.'

function cargarRegistro() {
  try {
    return { registro: leerPlanificaciones(window.localStorage), error: '' }
  } catch {
    return { registro: registroVacio(), error: mensajeLectura }
  }
}

function mostrarFecha(fecha: string) {
  const [anio, mes, dia] = fecha.split('-')
  return `${dia}/${mes}/${anio}`
}

export default function Planificaciones({ vistaTaller = false }: { vistaTaller?: boolean }) {
  const [inicial] = useState(cargarRegistro)
  const [registro, setRegistro] = useState(inicial.registro)
  const [bloqueado, setBloqueado] = useState(Boolean(inicial.error))
  const [errorGuardado, setErrorGuardado] = useState(inicial.error)
  const [creando, setCreando] = useState(!inicial.registro.activa)
  const [datos, setDatos] = useState<DatosGenerales>({ ...datosVacios })
  const [validar, setValidar] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [rol, setRol] = useState<RolDemo>('PCM')
  const actor: Actor = { rol, usuario: `${rol} demo` }
  const plan = registro.planificaciones.find(item => item.codigo === registro.activa)
  const preparacion = plan?.preparacion ?? registro.sinPlanificacion
  const errores = erroresDatosGenerales(datos)

  useEffect(() => {
    function sincronizar(event: StorageEvent) {
      if (event.storageArea !== window.localStorage || (event.key !== clavePlanificaciones && event.key !== null)) return
      const carga = cargarRegistro()
      if (!carga.error) setRegistro(carga.registro)
      setBloqueado(Boolean(carga.error))
      setErrorGuardado(carga.error)
    }
    window.addEventListener('storage', sincronizar)
    return () => window.removeEventListener('storage', sincronizar)
  }, [])

  // Guardar en acciones, nunca al montar ni dentro de un actualizador de React.
  // Así StrictMode y las recargas no consumen números ni duplican escrituras.
  function guardar(cambiar: (actual: RegistroPlanificaciones) => RegistroPlanificaciones) {
    if (bloqueado) return false
    let actual: RegistroPlanificaciones
    try {
      actual = leerPlanificaciones(window.localStorage)
    } catch {
      setBloqueado(true)
      setErrorGuardado(mensajeLectura)
      return false
    }
    let siguiente: RegistroPlanificaciones
    try {
      siguiente = cambiar(actual)
    } catch (error) {
      setErrorGuardado(error instanceof Error ? error.message : 'No se pudo aplicar el cambio.')
      return false
    }
    try {
      guardarPlanificaciones(window.localStorage, siguiente)
      setRegistro(siguiente)
      setErrorGuardado('')
      return true
    } catch {
      setErrorGuardado('No se pudo guardar el cambio. No se aplicó ni se asignó un nuevo número. Revisá el espacio y los permisos de almacenamiento del navegador y volvé a intentar.')
      return false
    }
  }

  function cambiarPreparacion(cambios: Partial<Preparacion>) {
    guardar(actual => actualizarPreparacion(actual, plan?.codigo ?? null, cambios, actor))
  }

  function abrir(codigo: string) {
    if (guardar(actual => {
      if (!actual.planificaciones.some(item => item.codigo === codigo)) throw new Error('La planificación ya no está disponible.')
      return { ...actual, activa: codigo }
    })) {
      setCreando(false)
      setMensaje('')
    }
  }

  return (
    <>
      <div className="rol-demo">
        <label htmlFor="rol-demo">Rol simulado (demo)</label>
        <select id="rol-demo" value={rol} onChange={event => setRol(event.target.value as RolDemo)}>{rolesDemo.map(nombre => <option key={nombre}>{nombre}</option>)}</select>
        <p className="ayuda">Simulación local sin autenticación ni seguridad real. Los encargados no tienen permiso de evaluación.</p>
      </div>
      {errorGuardado && <p className="aviso-guardado" role="alert">{errorGuardado}</p>}
      {vistaTaller && <ValidacionTaller registro={registro} actor={actor} guardar={guardar} bloqueado={bloqueado} />}
      <div hidden={vistaTaller}>
      <div className="selector-planificaciones">
        <div className="consulta-planificaciones">
          <label htmlFor="planificacion-guardada">Consultar planificación</label>
          <select id="planificacion-guardada" value={creando ? '' : registro.activa ?? ''} disabled={bloqueado || registro.planificaciones.length === 0} onChange={event => abrir(event.target.value)}>
            <option value="" disabled>{registro.planificaciones.length === 0 ? 'Todavía no hay planificaciones creadas' : 'Seleccionar planificación guardada'}</option>
            {registro.planificaciones.map(item => (
              <option key={item.codigo} value={item.codigo}>Planificación {item.numero} · {item.codigo} · {item.remolcador} · {mostrarFecha(item.fechaParada)}</option>
            ))}
          </select>
        </div>
        <button className="boton-secundario" disabled={bloqueado || creando || !permisos(actor).organizar} onClick={() => {
          setDatos({ ...datosVacios })
          setValidar(false)
          setCreando(true)
          setMensaje('')
        }}>Nueva planificación</button>
      </div>
      <p className="nota-demo">Demo · Remolcadores y tareas ficticios. Guardado local en este navegador; no se comparte entre equipos ni reemplaza una base de datos para varios usuarios.</p>
      <p className="estado-guardado" role="status">{mensaje}</p>

      <section className="datos-planificacion" aria-labelledby="titulo-datos-planificacion">
        <h2 id="titulo-datos-planificacion">Datos generales de la planificación</h2>
        {creando ? (
          <form noValidate onSubmit={event => {
            event.preventDefault()
            setValidar(true)
            if (Object.values(errores).some(Boolean)) return
            if (guardar(actual => crearPlanificacion(actual, datos, actor))) {
              setCreando(false)
              setMensaje('Planificación creada. Los cambios en sus tareas y OM se guardan automáticamente en este navegador.')
            }
          }}>
            <fieldset disabled={bloqueado || !permisos(actor).organizar}>
              <legend className="ayuda">Nueva planificación · Completá los tres campos obligatorios.</legend>
              <div className="campos-planificacion">
                <div>
                  <label htmlFor="remolcador">Remolcador</label>
                  <select id="remolcador" required value={datos.remolcador} aria-invalid={validar && Boolean(errores.remolcador)} aria-describedby={validar && errores.remolcador ? 'remolcador-error' : undefined} onChange={event => setDatos({ ...datos, remolcador: event.target.value })}>
                    <option value="">Seleccionar remolcador</option>
                    {remolcadoresDemo.map(nombre => <option key={nombre} value={nombre}>{nombre}</option>)}
                  </select>
                  {validar && errores.remolcador && <p id="remolcador-error" className="error-campo">{errores.remolcador}</p>}
                </div>
                <div>
                  <label htmlFor="fecha-parada">Fecha de parada</label>
                  <input id="fecha-parada" type="date" required min="0001-01-01" max="9999-12-31" value={datos.fechaParada} aria-invalid={validar && Boolean(errores.fechaParada)} aria-describedby={validar && errores.fechaParada ? 'fecha-parada-error' : undefined} onChange={event => setDatos({ ...datos, fechaParada: event.target.value })} />
                  {validar && errores.fechaParada && <p id="fecha-parada-error" className="error-campo">{errores.fechaParada}</p>}
                </div>
                <div>
                  <label htmlFor="horas-parada">Horas de parada</label>
                  <input id="horas-parada" type="number" required min="0" step="any" value={datos.horasParada} aria-invalid={validar && Boolean(errores.horasParada)} aria-describedby={validar && errores.horasParada ? 'horas-parada-error' : undefined} onChange={event => setDatos({ ...datos, horasParada: event.target.value })} />
                  {validar && errores.horasParada && <p id="horas-parada-error" className="error-campo">{errores.horasParada}</p>}
                </div>
                <div className="dato-sistema"><span>Número de planificación</span><strong>Se asigna al crear</strong></div>
                <div className="dato-sistema"><span>Estado</span><strong className="estado">Borrador</strong></div>
              </div>
              {registro.sinPlanificacion.filas.length > 0 && <p className="ayuda">Las {registro.sinPlanificacion.filas.length} OM preparadas sin planificación se incorporarán a esta planificación, conservando sus ediciones.</p>}
              <div className="acciones-planificacion">
                <button className="boton-primario" type="submit">Crear planificación</button>
                {plan && <button className="boton-secundario" type="button" onClick={() => setCreando(false)}>Volver a {plan.codigo}</button>}
              </div>
            </fieldset>
          </form>
        ) : plan && (
          <dl className="campos-planificacion">
            <div><dt>Remolcador</dt><dd>{plan.remolcador}</dd></div>
            <div><dt>Fecha de parada</dt><dd><time dateTime={plan.fechaParada}>{mostrarFecha(plan.fechaParada)}</time></dd></div>
            <div><dt>Horas de parada</dt><dd>{plan.horasParada.toLocaleString('es-PY')} h</dd></div>
            <div><dt>Número de planificación</dt><dd>Planificación {plan.numero}<span className="codigo-planificacion">{plan.codigo}</span></dd></div>
            <div><dt>Estado</dt><dd><span className="estado">{plan.estado}</span></dd></div>
          </dl>
        )}
      </section>

      {!creando && plan && <>
        <p className="ayuda">{preparacionEditable(plan, actor) ? 'Preparación editable por PCM. Los cambios en datos evaluados requieren reevaluación de las OM afectadas.' : 'Preparación en solo lectura para este rol o etapa. Consultá los resultados y las correcciones autorizadas en Validación Taller.'}</p>
        {(plan.estado === 'Borrador' || plan.estado === 'En revisión') && <button type="button" className="boton-primario" disabled={bloqueado || !permisos(actor).organizar} onClick={() => {
          if (guardar(actual => enviarATaller(actual, plan.codigo, actor))) setMensaje(`${plan.codigo} enviada a Taller. Abrí Validación Taller para evaluarla.`)
        }}>{plan.estado === 'En revisión' ? 'Reenviar a Taller' : 'Enviar a Taller'}</button>}
      </>}

      {/* Sin cabecera aún: se conserva el flujo previo y se incorpora al crear. */}
      {(!creando || !plan) && (
        <section aria-label={plan ? `Tareas y OM de ${plan.codigo}` : 'Tareas y OM sin planificación'}>
          {!plan && <p className="ayuda">Podés preparar tareas antes de crear la planificación. Se guardan como borrador sin número y se incorporan al crearla.</p>}
          <fieldset className="area-tareas" disabled={bloqueado || !permisos(actor).organizar || Boolean(plan && !preparacionEditable(plan, actor))}>
            <BusquedaTareas key={plan?.codigo ?? 'sin-planificacion'} preparacion={preparacion} onChange={cambiarPreparacion}
              puedeEditarTarea={tarea => !plan || tareaEditable(plan, tarea, actor)}
              detalleOM={om => {
                if (!plan) return undefined
                const revision = revisionDe(plan, om)
                return `${revision.cancelada ? 'Cancelada' : revision.resultado} · r${revision.revision}${revision.datos ? ` · Datos individuales: ${revision.datos.duracionPrevista} h, ${revision.datos.responsable}, ${revision.datos.personas} personas. Ver Validación Taller.` : ''}`
              }}
              onQuitar={!plan || plan.estado === 'Borrador' ? ordenes => cambiarPreparacion({ filas: preparacion.filas.filter(fila => !ordenes.includes(fila.numero)) }) : undefined} />
          </fieldset>
        </section>
      )}
      </div>
    </>
  )
}
