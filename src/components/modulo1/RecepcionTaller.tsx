import { useState } from 'react'
import { finParada, moneda, mostrarFecha, valorTotal } from '../../features/modulo1/modelo'
import type { Comando, Plan, Registro } from '../../features/modulo1/modelo'

function EvaluarFila({
  plan,
  tareaId,
  ejecutar,
  ocupado
}: {
  plan: Plan
  tareaId: string
  ejecutar: (c: Comando) => Promise<boolean>
  ocupado: boolean
}) {
  const evaluacion = Object.hasOwn(plan.evaluaciones, tareaId) ? plan.evaluaciones[tareaId] : undefined
  const [resultado, setResultado] = useState<'Aceptada' | 'Rechazada'>(evaluacion?.resultado ?? 'Aceptada')
  const [motivo, setMotivo] = useState(evaluacion?.motivo ?? '')
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void ejecutar({ tipo: 'evaluar', planId: plan.id, tareaId, resultado, motivo })
      }}
    >
      <label className="m1-campo">
        Evaluación de {tareaId}
        <select value={resultado} onChange={(e) => setResultado(e.target.value as typeof resultado)}>
          <option>Aceptada</option>
          <option>Rechazada</option>
        </select>
      </label>
      <label className="m1-campo">
        Motivo de {tareaId}
        {resultado === 'Rechazada' ? ' (obligatorio)' : ' (opcional)'}
        <textarea
          required={resultado === 'Rechazada'}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          maxLength={5000}
        />
      </label>
      <button className="boton-secundario" disabled={ocupado}>
        Registrar evaluación de {tareaId}
      </button>
    </form>
  )
}
export default function RecepcionTaller({
  registro,
  evaluar,
  ocupado,
  ejecutar
}: {
  registro: Registro
  evaluar: boolean
  ocupado: boolean
  ejecutar: (c: Comando) => Promise<boolean>
}) {
  const [seleccion, setSeleccion] = useState('')
  const recibidas = registro.planes.filter((p) => p.estado !== 'Borrador')
  const plan = recibidas.find((p) => p.id === seleccion) ?? recibidas.at(-1)
  if (!plan)
    return (
      <p className="estado-vacio">
        No hay propuestas v1.3 enviadas a Taller. El planificador debe enviar una planificación para iniciar
        la evaluación.
      </p>
    )
  const abierta = ['Enviado a Taller', 'En evaluación'].includes(plan.estado)
  return (
    <section className="m1-panel">
      <h2>Recepción de propuestas PCM</h2>
      <label className="m1-campo">
        Planificación recibida
        <select value={plan.id} onChange={(e) => setSeleccion(e.target.value)}>
          {recibidas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.tag} · {p.estado}
            </option>
          ))}
        </select>
      </label>
      <p>
        {plan.tag} · v{plan.version} · {plan.estado} · Enviado por {plan.planificador} el{' '}
        {mostrarFecha(plan.enviado ?? '')}
      </p>
      <p>
        {plan.referencias[plan.remolcadorId]?.nombre} · {plan.referencias[plan.ubicacionId]?.nombre} · ETA{' '}
        {mostrarFecha(plan.eta)} · Parada {plan.horasParada} h · Fin {mostrarFecha(finParada(plan))}
      </p>
      <p className="m1-nota">
        La decisión corresponde a la TAREA o PM completa con todas sus OM. Las tareas externas permanecen en
        la propuesta sin requerir evaluación de capacidad interna.
      </p>
      <div
        className="tabla-contenedor"
        tabIndex={0}
        role="region"
        aria-label="Evaluación de tareas completas"
      >
        <table className="m1-taller">
          <thead>
            <tr>
              {['TAREA / PM y OM', 'Propuesta PCM', 'Responsable', 'Resultado', 'Evaluación'].map((t) => (
                <th scope="col" key={t}>
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {plan.filas.map((f) => {
              const responsable = plan.referencias[f.responsableId]
              const decision = Object.hasOwn(plan.evaluaciones, f.id) ? plan.evaluaciones[f.id] : undefined
              return (
                <tr key={f.id}>
                  <th scope="row">
                    {f.id}
                    <span className="m1-original">{f.ordenes.map((o) => o.numero).join(', ')}</span>
                  </th>
                  <td>
                    {f.descripcion}
                    <span className="m1-original">
                      Original: {f.tiempoOriginal ?? 'Sin definir'} h · PCM: {f.tiempoPropuesto} h ·{' '}
                      {f.trabajadores} trabajadores propuestos · {f.criticidad} ·{' '}
                      {moneda(valorTotal(f.ordenes))} Gs.
                    </span>
                  </td>
                  <td>{responsable?.nombre}</td>
                  <td>
                    {responsable?.externo ? (
                      'Ejecución externa · No requiere evaluación interna'
                    ) : decision ? (
                      <>
                        {decision.resultado}
                        <p>{decision.motivo}</p>
                        <small>
                          {decision.usuario} · {mostrarFecha(decision.fecha)}
                        </small>
                      </>
                    ) : (
                      'Pendiente'
                    )}
                  </td>
                  <td>
                    {evaluar && abierta && !responsable?.externo ? (
                      <EvaluarFila
                        key={`${plan.id}:${f.id}`}
                        plan={plan}
                        tareaId={f.id}
                        ejecutar={ejecutar}
                        ocupado={ocupado}
                      />
                    ) : (
                      'Solo consulta'
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {evaluar && abierta && (
        <button
          className="boton-primario"
          disabled={ocupado}
          onClick={() => ejecutar({ tipo: 'finalizar', planId: plan.id })}
        >
          Finalizar evaluación
        </button>
      )}
      {plan.estado === 'Evaluado' && (
        <p className="m1-nota">
          Evaluación finalizada. Los resultados y motivos quedan disponibles para PCM con su historial. La
          respuesta de PCM y la programación posterior pertenecen a la siguiente etapa.
        </p>
      )}
    </section>
  )
}
