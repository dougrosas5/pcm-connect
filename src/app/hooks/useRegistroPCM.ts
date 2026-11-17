import { useEffect, useRef, useState } from 'react'
import { nuevoPlan, registroInicial } from '../../features/planificacion/model/modelo'
import type { Actor, Comando, Plan, Registro } from '../../types/pcm'
import { actorDemo, cargar, conectado, ejecutar, leerSesion } from '../../services/pcm/persistencia'
import { validarComando } from '../../features/planificacion/model/validacion'

// Un único estado compartido por las pestañas: conserva recuperación, bloqueo y recibos existentes.
export function useRegistroPCM() {
  const [registro, setRegistro] = useState<Registro>(registroInicial)
  const [actor, setActor] = useState<Actor>(actorDemo)
  const [sesion, setSesion] = useState(() => !conectado || Boolean(leerSesion()))
  const [plan, setPlan] = useState<Plan>(() => nuevoPlan(actorDemo, ''))
  const [listo, setListo] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [sucio, setSucio] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
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
      if ('planId' in comando && !sucio && comando.planId === plan.id) {
        const actualizado = carga.registro.planes.find((p) => p.id === plan.id)
        if (actualizado) setPlan(actualizado)
      }
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

  return {
    registro, setRegistro, actor, setActor, sesion, setSesion, plan, setPlan,
    listo, setListo, ocupado, setOcupado, sucio, setSucio, error, setError,
    mensaje, setMensaje, claveRecuperacion, pcm, editable, cambiar, puedeCambiarPlan, mandar, actualizar
  }
}
