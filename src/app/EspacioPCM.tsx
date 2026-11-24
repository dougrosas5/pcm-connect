import { useState } from 'react'
import { agregarTareas, erroresEnvio, mostrarFecha, nuevoPlan, registroInicial } from '../features/planificacion/model/modelo'
import type { Rol, TipoCatalogo } from '../types/pcm'
import { actorDemo, cerrarSesion, conectado, iniciarSesion } from '../services/pcm/persistencia'
import { descargarTexto } from '../utils/descargas'
import Catalogos from '../features/catalogos/components/Catalogos'
import Importador from '../features/planificacion/components/Importador'
import ValidacionTaller from '../features/validacion-taller/components/ValidacionTaller'
import RevisionPCM from '../features/revision-pcm/components/RevisionPCM'
import TablaPropuesta from '../features/planificacion/components/TablaPropuesta'
import CabeceraPlan from '../features/planificacion/components/CabeceraPlan'
import { useRegistroPCM } from './hooks/useRegistroPCM'
import Icono from '../components/Icono'
import { etiquetaPlan } from '../components/etiquetasEstado'
import '../styles/operaciones.css'

export default function EspacioPCM({ vista, catalogoInicial = 'remolcadores', abrirUbicaciones }: {
  vista: 'plan' | 'taller' | 'catalogos' | 'revision'
  catalogoInicial?: TipoCatalogo
  abrirUbicaciones?: () => void
}) {
  const {
    registro, setRegistro, actor, setActor, sesion, setSesion, plan, setPlan,
    listo, setListo, ocupado, setOcupado, sucio, setSucio, error, setError,
    mensaje, setMensaje, claveRecuperacion, pcm, editable, puedeAjustarEnTaller, cambiar, puedeCambiarPlan, mandar, actualizar
  } = useRegistroPCM()
  const [entrada, setEntrada] = useState('')
  const [avisos, setAvisos] = useState<string[]>([])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [limpiando, setLimpiando] = useState(false)
  const catalogos =
    plan.estado === 'Borrador'
      ? registro.catalogos
      : {
          remolcadores: Object.values(plan.referencias).filter((e) => e.id === plan.remolcadorId),
          ubicaciones: Object.values(plan.referencias).filter((e) => e.id === plan.ubicacionId),
          responsables: registro.catalogos.responsables
        }

  return (
    <div className={`m1 ${vista === 'plan' ? 'espacio-plan-naval' : ''}`}>
      {!conectado ? (
        <details className="m1-modo sesion-naval">
          <summary><Icono nombre="usuario" /><span>{actor.rol} <small>· Local</small></span><Icono nombre="bajar" /></summary>
          <strong>Modo local</strong>
          <p>
            Los datos quedan en este navegador. Los roles son simulados, sin autenticación ni seguridad real.
          </p>
          <label>
            Rol simulado
            <select
              value={actor.rol}
              disabled={ocupado}
              onChange={(e) =>
                setActor({ ...actor, rol: e.target.value as Rol, nombre: `${e.target.value} demo` })
              }
            >
              {['Planificador', 'Taller', 'Supervisor Taller', 'Administrador', 'Consulta'].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          {sucio && <small>Los cambios pendientes de Planificación se conservan al cambiar de rol. Volvé a PCM para guardarlos.</small>}
        </details>
      ) : (
        <div className="m1-modo">
          <strong>Servidor · {listo ? `${actor.nombre} · ${actor.rol}` : 'Inicio de sesión'}</strong>
          {sesion && (
            <button
              className="boton-secundario"
              disabled={ocupado}
              onClick={async () => {
                if (!puedeCambiarPlan()) return
                try {
                  const remoto = await cerrarSesion()
                  setListo(false)
                  setSesion(false)
                  setRegistro(registroInicial())
                  setPlan(nuevoPlan(actorDemo, ''))
                  setSucio(false)
                  setMensaje(
                    remoto
                      ? 'Sesión cerrada.'
                      : 'La sesión se cerró en este navegador. No se pudo confirmar el cierre en el servidor.'
                  )
                  setError('')
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'No se pudo cerrar sesión.')
                }
              }}
            >
              Cerrar sesión
            </button>
          )}
        </div>
      )}
      {conectado && !sesion && (
        <form
          className="m1-panel m1-login"
          onSubmit={async (e) => {
            e.preventDefault()
            setOcupado(true)
            setError('')
            try {
              await iniciarSesion(email, password)
              setPassword('')
              setSesion(true)
            } catch (err) {
              setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.')
            } finally {
              setOcupado(false)
            }
          }}
        >
          <h2>Iniciar sesión</h2>
          <label className="m1-campo">
            Correo
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="m1-campo">
            Contraseña
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="boton-primario" disabled={ocupado}>
            Ingresar
          </button>
        </form>
      )}
      <div aria-live="polite" role="status">
        {ocupado ? 'Procesando…' : mensaje}
      </div>
      {error && (
        <div className="m1-error" role="alert">
          <p>{error}</p>
          <div className="m1-acciones">
            <button className="boton-secundario" disabled={ocupado} onClick={actualizar}>
              Actualizar datos
            </button>
            {!conectado && (
              <button
                className="boton-secundario"
                onClick={() =>
                  descargarTexto(
                    'PCM-respaldo-local.json',
                    JSON.stringify(
                      {
                        modulo1: window.localStorage.getItem('pcm-connect.modulo1.v13'),
                        recuperacion: window.localStorage.getItem(claveRecuperacion),
                        archivoV1: window.localStorage.getItem('pcm-connect.planificaciones.v1')
                      },
                      null,
                      2
                    ),
                    'application/json'
                  )
                }
              >
                Descargar respaldo local
              </button>
            )}
          </div>
        </div>
      )}
      {!listo && sesion && !error && <p>Cargando planificaciones…</p>}
      {listo && (
        <>
          <div className="m1-barra" hidden={vista === 'plan' || vista === 'taller'}>
            <button className="boton-secundario" disabled={ocupado} onClick={actualizar}>
              Actualizar datos
            </button>
            <span className="ayuda">
              {conectado ? 'Conectado al servidor' : 'Modo local'} · {actor.rol}
            </span>
          </div>
          {vista === 'catalogos' && (
            <Catalogos
              key={catalogoInicial}
              tipoInicial={catalogoInicial}
              catalogos={registro.catalogos}
              administrar={actor.rol === 'Administrador'}
              ocupado={ocupado}
              ejecutar={mandar}
            />
          )}
          {vista === 'revision' && <RevisionPCM registro={registro} actor={actor} ocupado={ocupado} cambiosPCM={sucio} error={error} ejecutar={mandar} />}
          {vista === 'taller' && (
            <ValidacionTaller
              registro={registro}
              actor={actor}
              cambiosPCM={sucio}
              ocupado={ocupado}
              ejecutar={mandar}
              actualizar={actualizar}
              usarRolTaller={!conectado && !sucio ? () => setActor({ ...actor, rol: 'Taller', nombre: 'Taller demo' }) : undefined}
            />
          )}
          <div className="planificacion-visual" hidden={vista !== 'plan'}>
            <CabeceraPlan plan={plan} catalogos={catalogos} editable={editable} cambiar={cambiar} abrirUbicaciones={abrirUbicaciones} selector={<div className="selector-planificaciones">
              <label className="m1-campo consulta-planificaciones">
                Abrir planificación guardada
                <select
                  value={registro.planes.some((p) => p.id === plan.id) ? plan.id : ''}
                  disabled={ocupado}
                  onChange={(e) => {
                    const seleccionada = registro.planes.find((p) => p.id === e.target.value)
                    if (seleccionada && puedeCambiarPlan()) {
                      setPlan(structuredClone(seleccionada))
                      setSucio(false)
                      setAvisos([])
                      setLimpiando(false)
                    }
                  }}
                >
                  <option value="">Sin planificación guardada</option>
                  {registro.planes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.tag} · {etiquetaPlan[p.estado]}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="boton-secundario"
                disabled={!pcm || ocupado}
                onClick={() => {
                  if (puedeCambiarPlan()) {
                    setPlan(nuevoPlan(actor, crypto.randomUUID()))
                    setSucio(false)
                    setAvisos([])
                    setEntrada('')
                    setLimpiando(false)
                    setError('')
                  }
                }}
              >
                Nueva planificación
              </button>
            </div>} />
            <section className="propuesta-naval" aria-labelledby="propuesta-v13">
              <div className="propuesta-naval-titulo">
                <h2 id="propuesta-v13"><Icono nombre="herramientas" />Tareas propuestas</h2>
                <Importador registro={registro} permitido={pcm} ocupado={ocupado} ejecutar={mandar} compacto />
              </div>
              {plan.estado !== 'Borrador' && (
                <p className="m1-nota">
                  {puedeAjustarEnTaller
                    ? 'Podés ajustar horas, trabajadores y responsable. Taller deberá reevaluar las tareas modificadas.'
                    : 'Solo consulta. Se conservan los datos de la versión enviada.'}
                </p>
              )}
              <form
                className="busqueda entrada-busqueda"
                onSubmit={(e) => {
                  e.preventDefault()
                  const resultado = agregarTareas(plan, entrada, registro)
                  setAvisos(resultado.avisos)
                  if (resultado.plan.filas.length !== plan.filas.length) cambiar(resultado.plan)
                }}
              >
                <label htmlFor="m1-busqueda">Buscar TAREA/PM</label>
                <div className="campo-busqueda-naval"><Icono nombre="buscar" />
                <textarea
                  id="m1-busqueda"
                  value={entrada}
                  disabled={!editable}
                  placeholder="Ej.: PM-204, TAREA-1001"
                  title="Separá los códigos con comas, espacios o saltos de línea."
                  rows={2}
                  aria-label="TAREA/PM"
                  onChange={(e) => setEntrada(e.target.value)}
                />
                </div>
                <button className="boton-primario" disabled={!editable}>
                  <Icono nombre="mas" />
                  Agregar tareas
                </button>
                <span className="estado-propuesta ayuda">
                  {sucio ? 'Cambios sin guardar' : plan.tag ? 'Guardada' : 'Sin guardar'}
                  {' · '}{plan.filas.length} {plan.filas.length === 1 ? 'tarea' : 'tareas'}
                </span>
              </form>
              {!!avisos.length && (
                <ul className="m1-nota" aria-live="polite">
                  {avisos.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              )}
              <TablaPropuesta plan={plan} registro={registro} editable={editable || puedeAjustarEnTaller} cambiar={cambiar} />
              <div className="m1-pie-acciones">
              <p className="nota-planificacion">
                <Icono nombre="informacion" /><span>
                Las horas y la cantidad de trabajadores se proponen por tarea.
                </span>
              </p>
              <div className="acciones-envio-naval">
                <button className="boton-secundario" disabled={!editable} onClick={() => setLimpiando(true)}>
                  Limpiar
                </button>
                <div className="m1-acciones">
                  <button
                    className="boton-secundario"
                    disabled={!editable && (!puedeAjustarEnTaller || !sucio)}
                    onClick={() => mandar({ tipo: 'guardar', plan, enviar: false })}
                  >
                    <Icono nombre="guardar" />
                    {puedeAjustarEnTaller ? 'Guardar ajustes' : 'Guardar borrador'}
                  </button>
                  <button
                    className="boton-primario"
                    disabled={!editable}
                    onClick={() => {
                      const errores = erroresEnvio(plan, registro)
                      if (errores.length) {
                        setError(errores.join('\n'))
                        return
                      }
                      void mandar({ tipo: 'guardar', plan, enviar: true })
                    }}
                  >
                    <Icono nombre="enviar" />
                    Enviar a Taller
                  </button>
                </div>
              </div>
              </div>
              {limpiando && (
                <div className="m1-confirmacion" role="group" aria-label="Confirmar limpieza">
                  <p>
                    ¿Abrir una propuesta vacía? Se descartarán los cambios sin guardar. El borrador guardado, la fuente y el historial se conservan.
                  </p>
                  <div className="m1-acciones">
                    <button className="boton-secundario" onClick={() => setLimpiando(false)}>
                      Conservar cambios
                    </button>
                    <button
                      className="boton-primario"
                      onClick={() => {
                        setPlan(nuevoPlan(actor, crypto.randomUUID()))
                        setSucio(false)
                        setEntrada('')
                        setAvisos([])
                        setError('')
                        setLimpiando(false)
                      }}
                    >
                      Confirmar limpieza
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>
          <details className="historial-taller">
            <summary>Historial de cambios ({registro.historial.length})</summary>
            <ol className="m1-lista-historial">
              {[...registro.historial].reverse().map((e, i) => (
                <li key={i}>
                  <strong>
                    {e.accion} · {e.entidad}
                  </strong>{' '}
                  · {e.usuario} · {mostrarFecha(e.fecha)}
                  <details>
                    <summary>Valores anteriores y nuevos</summary>
                    <pre>{JSON.stringify({ anterior: e.anterior, nuevo: e.nuevo }, null, 2)}</pre>
                  </details>
                </li>
              ))}
            </ol>
            {!registro.historial.length && (
              <p>Sin cambios registrados.</p>
            )}
          </details>
        </>
      )}
    </div>
  )
}
