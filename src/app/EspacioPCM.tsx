import { useState } from 'react'
import { agregarTareas, erroresEnvio, mostrarFecha, nuevoPlan, registroInicial } from '../features/planificacion/model/modelo'
import type { Rol } from '../types/pcm'
import { actorDemo, cerrarSesion, conectado, iniciarSesion } from '../services/pcm/persistencia'
import { descargarTexto } from '../utils/descargas'
import Catalogos from '../features/catalogos/components/Catalogos'
import Importador from '../features/planificacion/components/Importador'
import ValidacionTaller from '../features/validacion-taller/components/ValidacionTaller'
import TablaPropuesta from '../features/planificacion/components/TablaPropuesta'
import CabeceraPlan from '../features/planificacion/components/CabeceraPlan'
import { useRegistroPCM } from './hooks/useRegistroPCM'
import '../styles/operaciones.css'

export default function EspacioPCM({ vista }: { vista: 'plan' | 'taller' | 'catalogos' }) {
  const {
    registro, setRegistro, actor, setActor, sesion, setSesion, plan, setPlan,
    listo, setListo, ocupado, setOcupado, sucio, setSucio, error, setError,
    mensaje, setMensaje, claveRecuperacion, pcm, editable, cambiar, puedeCambiarPlan, mandar, actualizar
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
    <div className="m1">
      {!conectado ? (
        <div className="m1-modo">
          <strong>Modo demo local</strong>
          <p>
            Guardado en este navegador, sin autenticación ni seguridad real. No se comparte entre equipos.
            Configurá el servidor para trabajar con persistencia multiusuario.
          </p>
          <label>
            Rol simulado (demo)
            <select
              value={actor.rol}
              disabled={ocupado || sucio}
              onChange={(e) =>
                setActor({ ...actor, rol: e.target.value as Rol, nombre: `${e.target.value} demo` })
              }
            >
              {['Planificador', 'Taller', 'Supervisor Taller', 'Administrador', 'Consulta'].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          {sucio && <small>Guardá o limpiá la propuesta antes de cambiar de rol.</small>}
        </div>
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
                      : 'Sesión cerrada en este navegador. No se pudo confirmar la revocación remota.'
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
          <div className="m1-barra">
            <button className="boton-secundario" disabled={ocupado} onClick={actualizar}>
              Actualizar datos
            </button>
            <span className="ayuda">
              {conectado ? 'Persistencia en servidor' : 'Persistencia local de demo'} · {actor.rol}
            </span>
          </div>
          {vista === 'catalogos' && (
            <Catalogos
              catalogos={registro.catalogos}
              administrar={actor.rol === 'Administrador'}
              ocupado={ocupado}
              ejecutar={mandar}
            />
          )}
          {vista === 'taller' && (
            <ValidacionTaller
              registro={registro}
              actor={actor}
              cambiosPCM={sucio}
              ocupado={ocupado}
              ejecutar={mandar}
            />
          )}
          <div hidden={vista !== 'plan'}>
            <div className="selector-planificaciones">
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
                  <option value="">Nueva propuesta sin guardar</option>
                  {registro.planes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.tag} · {p.estado} · {p.planificador}
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
            </div>
            <CabeceraPlan plan={plan} catalogos={catalogos} editable={editable} cambiar={cambiar} />
            <Importador registro={registro} permitido={pcm} ocupado={ocupado} ejecutar={mandar} />
            <section aria-labelledby="propuesta-v13">
              <div className="m1-encabezado">
                <h2 id="propuesta-v13">Tareas propuestas</h2>
                <span className="ayuda">
                  {sucio
                    ? 'Cambios sin guardar · copia de recuperación local'
                    : plan.tag
                      ? 'Propuesta guardada'
                      : 'Nueva propuesta'}
                </span>
              </div>
              {plan.estado !== 'Borrador' && (
                <p className="m1-nota">
                  Propuesta enviada: solo consulta. Los cambios de la fuente y catálogos no reemplazan esta
                  versión.
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
                <label htmlFor="m1-busqueda">TAREA / PM</label>
                <textarea
                  id="m1-busqueda"
                  value={entrada}
                  disabled={!editable}
                  placeholder="Pegá identificadores separados por comas, espacios o saltos de línea"
                  rows={2}
                  onChange={(e) => setEntrada(e.target.value)}
                />
                <button className="boton-secundario" disabled={!editable}>
                  Agregar tareas
                </button>
              </form>
              {!!avisos.length && (
                <ul className="m1-nota" aria-live="polite">
                  {avisos.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              )}
              <TablaPropuesta plan={plan} registro={registro} editable={editable} cambiar={cambiar} />
              <p className="m1-nota">
                Taller definirá posteriormente la secuencia, la duración del conjunto y la asignación de
                técnicos concretos. Tiempo y trabajadores representan una propuesta individual por tarea.
              </p>
              <div className="m1-pie-acciones">
                <button className="boton-secundario" disabled={!editable} onClick={() => setLimpiando(true)}>
                  Limpiar
                </button>
                <div className="m1-acciones">
                  <button
                    className="boton-secundario"
                    disabled={!editable}
                    onClick={() => mandar({ tipo: 'guardar', plan, enviar: false })}
                  >
                    Guardar borrador
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
                    Enviar a Taller
                  </button>
                </div>
              </div>
              {limpiando && (
                <div className="m1-confirmacion" role="group" aria-label="Confirmar limpieza">
                  <p>
                    ¿Limpiar la propuesta en pantalla? Se inicia una nueva propuesta vacía. El borrador
                    guardado, el historial y los datos fuente se conservan.
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
              <p>Los cambios guardados se registrarán aquí con usuario y fecha.</p>
            )}
          </details>
        </>
      )}
    </div>
  )
}
