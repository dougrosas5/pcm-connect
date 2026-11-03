import { useEffect, useRef, useState } from 'react'
import {
  agregarTareas,
  erroresEnvio,
  finParada,
  inputDesdeEta,
  etaDesdeInput,
  mostrarFecha,
  nuevoPlan,
  registroInicial
} from '../../features/modulo1/modelo'
import type { Actor, Comando, Plan, Registro, Rol } from '../../features/modulo1/modelo'
import {
  actorDemo,
  cargar,
  cerrarSesion,
  conectado,
  ejecutar,
  iniciarSesion,
  leerSesion
} from '../../features/modulo1/persistencia'
import { descargarTexto } from '../../features/modulo1/importacion'
import { validarComando } from '../../features/modulo1/validacion'
import Catalogos from './Catalogos'
import Importador from './Importador'
import RecepcionTaller from './RecepcionTaller'
import TablaPropuesta, { SelectorCatalogo } from './TablaPropuesta'
import './modulo1.css'

export default function Modulo1({ vista }: { vista: 'plan' | 'taller' | 'catalogos' }) {
  const [registro, setRegistro] = useState<Registro>(registroInicial)
  const [actor, setActor] = useState<Actor>(actorDemo)
  const [sesion, setSesion] = useState(() => !conectado || Boolean(leerSesion()))
  const [plan, setPlan] = useState<Plan>(() => nuevoPlan(actorDemo, ''))
  const [listo, setListo] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [sucio, setSucio] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [entrada, setEntrada] = useState('')
  const [avisos, setAvisos] = useState<string[]>([])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [limpiando, setLimpiando] = useState(false)
  const [recuperacionBloqueada, setRecuperacionBloqueada] = useState(false)
  const cerrojo = useRef(false)
  const solicitudPendiente = useRef<{ texto: string; id: string } | null>(null)
  const claveRecuperacion = `pcm-connect.modulo1.recuperacion.${conectado ? 'servidor' : 'demo'}.${actor.id}`
  const pcm = actor.rol === 'Planificador' || actor.rol === 'Administrador'
  const editable =
    listo &&
    !ocupado &&
    pcm &&
    plan.estado === 'Borrador' &&
    (plan.planificadorId === actor.id || actor.rol === 'Administrador')

  useEffect(() => {
    if (!sesion) return
    let vigente = true
    void cargar()
      .then((carga) => {
        if (!vigente) return
        setRegistro(carga.registro)
        setActor(carga.actor)
        const clave = `pcm-connect.modulo1.recuperacion.${conectado ? 'servidor' : 'demo'}.${carga.actor.id}`
        let recuperado: Plan | null = null
        try {
          const texto = window.localStorage.getItem(clave)
          if (texto) {
            const datos: unknown = JSON.parse(texto)
            validarComando({ tipo: 'guardar', plan: datos, enviar: false })
            recuperado = datos as Plan
          }
        } catch {
          setRecuperacionBloqueada(true)
          setError(
            'Hay una copia de recuperación ilegible. No se modificó. Descargá un respaldo y revisá la copia antes de continuar.'
          )
          return
        }
        setPlan(recuperado ?? nuevoPlan(carga.actor, crypto.randomUUID()))
        setSucio(Boolean(recuperado))
        setListo(true)
        if (recuperado)
          setMensaje(
            'Se recuperaron cambios sin guardar de este usuario y navegador. Podés guardarlos o compararlos con el plan persistido.'
          )
      })
      .catch((err) => {
        if (vigente) setError(err instanceof Error ? err.message : 'No se pudieron cargar los datos.')
      })
    return () => {
      vigente = false
    }
  }, [sesion])

  useEffect(() => {
    if (!listo) return
    try {
      if (sucio) window.localStorage.setItem(claveRecuperacion, JSON.stringify(plan))
      else window.localStorage.removeItem(claveRecuperacion)
    } catch {
      // El efecto sincroniza almacenamiento externo; este mensaje informa su fallo.
      // oxlint-disable-next-line react/set-state-in-effect
      setError(
        'No se pudo escribir la copia de recuperación. Guardá el borrador o descargá un respaldo antes de salir.'
      )
    }
  }, [plan, sucio, listo, claveRecuperacion])
  useEffect(() => {
    function salir(e: BeforeUnloadEvent) {
      if (sucio || ocupado) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', salir)
    return () => window.removeEventListener('beforeunload', salir)
  }, [sucio, ocupado])

  function cambiar(siguiente: Plan) {
    setPlan(siguiente)
    setSucio(true)
    setMensaje('')
  }
  function puedeCambiarPlan() {
    return (
      !sucio ||
      window.confirm(
        'Hay cambios sin guardar. ¿Descartarlos de la pantalla? Los registros guardados se conservan.'
      )
    )
  }
  async function mandar(comando: Comando): Promise<boolean> {
    if (cerrojo.current || !listo) return false
    cerrojo.current = true
    setOcupado(true)
    setError('')
    setMensaje('')
    const texto = JSON.stringify(comando)
    if (solicitudPendiente.current?.texto !== texto)
      solicitudPendiente.current = { texto, id: crypto.randomUUID() }
    try {
      validarComando(comando)
      const carga = await ejecutar(comando, registro.revision, actor, solicitudPendiente.current.id)
      setRegistro(carga.registro)
      setActor(carga.actor)
      if (comando.tipo === 'guardar') {
        const guardado = carga.registro.planes.find((p) => p.id === comando.plan.id)
        if (!guardado)
          throw new Error('La respuesta no contiene la planificación. Reintentá la misma acción.')
        setPlan(guardado)
        setSucio(false)
        setMensaje(
          comando.enviar
            ? `${guardado.tag} enviada a Taller. Se conservó la propuesta completa.`
            : `${guardado.tag} · Borrador guardado. Podés retomarlo desde el selector.`
        )
      } else
        setMensaje(
          comando.tipo === 'importar'
            ? 'Importación guardada. Las propuestas existentes conservan sus datos.'
            : 'Cambios guardados con su historial.'
        )
      solicitudPendiente.current = null
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar. Reintentá la misma acción.')
      return false
    } finally {
      cerrojo.current = false
      setOcupado(false)
    }
  }
  async function actualizar() {
    if (cerrojo.current || recuperacionBloqueada) return
    cerrojo.current = true
    setOcupado(true)
    setError('')
    try {
      const carga = await cargar(actor)
      setRegistro(carga.registro)
      setActor(carga.actor)
      setListo(true)
      if (!sucio)
        setPlan(
          carga.registro.planes.find((p) => p.id === plan.id) ??
            (plan.id ? plan : nuevoPlan(carga.actor, crypto.randomUUID()))
        )
      setMensaje(
        'Datos actualizados. Los cambios sin guardar se conservan en pantalla; reabrí el plan guardado para comparar versiones.'
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron actualizar los datos.')
    } finally {
      cerrojo.current = false
      setOcupado(false)
    }
  }
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
              {['Planificador', 'Taller', 'Administrador', 'Consulta'].map((r) => (
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
            <RecepcionTaller
              registro={registro}
              evaluar={actor.rol === 'Taller' || actor.rol === 'Administrador'}
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
            <section className="m1-panel" aria-labelledby="cabecera-v13">
              <div className="m1-encabezado">
                <h2 id="cabecera-v13">{plan.tag || 'Nueva planificación'}</h2>
                <span className="estado">{plan.estado}</span>
              </div>
              <p className="ayuda">
                TAG: {plan.tag || 'Se asigna al guardar'} · Versión {plan.version} · Actualización:{' '}
                {mostrarFecha(plan.actualizado)}
              </p>
              <div className="m1-cabecera">
                <label className="m1-campo">
                  Remolcador
                  <SelectorCatalogo
                    etiqueta="Remolcador"
                    entradas={catalogos.remolcadores}
                    valor={plan.remolcadorId}
                    bloqueado={!editable}
                    cambiar={(v) => cambiar({ ...plan, remolcadorId: v })}
                  />
                </label>
                <label className="m1-campo">
                  Ubicación
                  <SelectorCatalogo
                    etiqueta="Ubicación"
                    entradas={catalogos.ubicaciones}
                    valor={plan.ubicacionId}
                    bloqueado={!editable}
                    cambiar={(v) => cambiar({ ...plan, ubicacionId: v })}
                  />
                </label>
                <label className="m1-campo">
                  ETA · hora de Montevideo
                  <input
                    type="datetime-local"
                    value={inputDesdeEta(plan.eta)}
                    disabled={!editable}
                    onChange={(e) => cambiar({ ...plan, eta: etaDesdeInput(e.target.value) })}
                  />
                </label>
                <label className="m1-campo">
                  Tiempo de parada (h)
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={plan.horasParada}
                    disabled={!editable}
                    onChange={(e) => cambiar({ ...plan, horasParada: e.target.value })}
                  />
                </label>
                <label className="m1-campo">
                  Fin de parada · Montevideo
                  <input readOnly value={mostrarFecha(finParada(plan))} />
                </label>
                <label className="m1-campo">
                  Planificador
                  <input readOnly value={plan.planificador} />
                </label>
              </div>
              <p className="ayuda">
                Los catálogos se administran desde Catálogos. Podés guardar un borrador con campos pendientes
                y completarlos antes del envío.
              </p>
            </section>
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
