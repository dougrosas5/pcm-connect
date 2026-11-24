import { useState } from 'react'
import type { Actor, AjusteTaller, Comando, Plan, Registro } from '../../../types/pcm'
import { moneda, mostrarFecha, valorTotal } from '../../planificacion/model/modelo'
import { evaluacionVigente, responsableOperativo, tareaInterna } from '../../revision-pcm/model/revision'
import { abiertaTaller, ajusteInicial, errorAjuste, estadoTareaTaller, puedeEvaluar } from '../model/evaluacion'
import Icono from '../../../components/Icono'

type Props = {
  plan: Plan
  registro: Registro
  actor: Actor
  ocupado: boolean
  bloqueado: boolean
  cambiarSucio: (sucio: boolean) => void
  ejecutar: (c: Comando) => Promise<boolean>
}

export default function EvaluacionTareas({ plan, registro, actor, ocupado, bloqueado, cambiarSucio, ejecutar }: Props) {
  const [editados, setEditados] = useState<AjusteTaller[]>([])
  const [error, setError] = useState('')
  const autorizado = abiertaTaller(plan) && puedeEvaluar(actor)
  const editable = autorizado && !bloqueado
  const pendientes = plan.filas.filter(f => tareaInterna(plan, f) && !evaluacionVigente(plan, f.id))
  const restantes = pendientes.filter(f => (editados.find(a => a.tareaId === f.id) ?? ajusteInicial(plan, f)).resultado === 'Pendiente').length

  function editar(ajuste: AjusteTaller, cambios: Partial<AjusteTaller>) {
    setEditados([...editados.filter(a => a.tareaId !== ajuste.tareaId), { ...ajuste, ...cambios }])
    cambiarSucio(true)
    setError('')
  }

  async function guardar(finalizar: boolean) {
    if (!editable || ocupado) return
    for (const ajuste of editados) {
      const mensaje = errorAjuste(ajuste)
      if (mensaje) {
        setError(`${ajuste.tareaId}: ${mensaje}`)
        return
      }
    }
    if (finalizar && restantes) {
      setError('Completá las decisiones de las tareas internas antes de finalizar.')
      return
    }
    if (await ejecutar({ tipo: 'evaluacionTaller', planId: plan.id, version: plan.version, ajustes: editados, finalizar })) {
      setEditados([])
      cambiarSucio(false)
    }
  }

  return <section className="m2-evaluacion-panel" aria-labelledby="m2-tabla-titulo">
    <div className="m2-panel-titulo">
      <h3 id="m2-tabla-titulo"><Icono nombre="herramientas" /> Tareas de la planificación ({plan.filas.length})</h3>
      {autorizado && <span className="ayuda">{restantes} pendientes</span>}
    </div>
    {autorizado && <p className="m2-instruccion-evaluacion">
      Completá las horas y los trabajadores en Ajuste Taller. A la derecha, elegí el resultado y agregá un comentario si rechazás la tarea. Desplazá la tabla horizontalmente para ver todas las columnas.
    </p>}
    <form aria-label="Evaluación de tareas" onSubmit={e => e.preventDefault()}>
      <div className="tabla-contenedor" tabIndex={0} role="region" aria-labelledby="m2-tabla-titulo">
        <table className="tabla-tareas m2-tabla-evaluacion">
          <thead>
            <tr>
              {['TAREA/PM', 'OM', 'Valor total (Gs.)', 'Descripción', 'Criticidad', 'Responsable'].map(t => <th key={t} scope="col" rowSpan={2}>{t}</th>)}
              <th scope="colgroup" colSpan={2} className="m2-grupo-pcm">Propuesta PCM</th>
              <th scope="colgroup" colSpan={2} className="m2-grupo-taller">Ajuste Taller</th>
              <th scope="col" rowSpan={2}>Resultado</th>
              <th scope="col" rowSpan={2}>Comentario de Taller</th>
            </tr>
            <tr>
              <th scope="col" className="m2-grupo-pcm">Horas</th><th scope="col" className="m2-grupo-pcm">Trab.</th>
              <th scope="col" className="m2-grupo-taller">Horas</th><th scope="col" className="m2-grupo-taller">Trab.</th>
            </tr>
          </thead>
          <tbody>{plan.filas.map(fila => {
            const evaluacion = evaluacionVigente(plan, fila.id)
            const interno = tareaInterna(plan, fila)
            const ajuste = editados.find(a => a.tareaId === fila.id) ?? ajusteInicial(plan, fila)
            const editarFila = editable && interno && !evaluacion
            const estado = interno && !evaluacion && ajuste.resultado !== 'Pendiente' ? ajuste.resultado : estadoTareaTaller(plan, fila)
            const tono = estado === 'Aceptada' ? 'aceptado' : estado === 'Rechazada' ? 'rechazado' : interno ? 'pendiente' : 'bloqueado'
            const borrador = plan.borradorTaller?.find(a => a.tareaId === fila.id && a.versionTarea === ajuste.versionTarea)
            return <tr key={fila.id}>
              <th scope="row">{fila.id}<small className="m1-original">v{ajuste.versionTarea}</small></th>
              <td><ul className="m2-lista-om">{fila.ordenes.map(om => <li key={om.numero} title={`Gs. ${moneda(om.valor)}`}>{om.numero}<span className="m1-original">{moneda(om.valor)}</span></li>)}</ul></td>
              <td className="numero">{moneda(valorTotal(fila.ordenes))}</td>
              <td className="m2-descripcion">{fila.descripcion}</td>
              <td><span className="criticidad" data-nivel={fila.criticidad.toLowerCase()}>{fila.criticidad}</span></td>
              <td>{responsableOperativo(plan, fila) === 'Sin definir' ? registro.catalogos.responsables.find(r => r.id === fila.responsableId)?.nombre ?? 'Sin definir' : responsableOperativo(plan, fila)}</td>
              <td className="numero m2-grupo-pcm">{fila.tiempoPropuesto}</td>
              <td className="numero m2-grupo-pcm">{fila.trabajadores}</td>
              <td className="m2-grupo-taller">{editarFila
                ? <input type="number" min="0" step="any" required disabled={ocupado} aria-label={`Horas de Taller para ${fila.id}`} value={ajuste.horas} onChange={e => editar(ajuste, { horas: e.target.value })} />
                : evaluacion ? evaluacion.tiempoAceptado ?? fila.tiempoPropuesto : interno ? borrador?.horas ?? '—' : '—'}</td>
              <td className="m2-grupo-taller">{editarFila
                ? <input type="number" min="1" step="1" required disabled={ocupado} aria-label={`Trabajadores de Taller para ${fila.id}`} value={ajuste.trabajadores} onChange={e => editar(ajuste, { trabajadores: e.target.value })} />
                : evaluacion ? evaluacion.trabajadoresAceptados ?? fila.trabajadores : interno ? borrador?.trabajadores ?? '—' : '—'}</td>
              <td>{editarFila ? <>
                <select className="m2-decision" data-tono={tono} disabled={ocupado} aria-label={`Resultado de ${fila.id}`} value={ajuste.resultado} onChange={e => editar(ajuste, { resultado: e.target.value as AjusteTaller['resultado'] })}>
                  <option>Pendiente</option><option>Aceptada</option><option>Rechazada</option>
                </select>
                {estado !== ajuste.resultado && <small className="m1-original">{estado}</small>}
              </> : <span className="estado" data-tono={tono}>{estado}</span>}</td>
              <td>{editarFila
                ? <textarea disabled={ocupado} required={ajuste.resultado === 'Rechazada'} rows={1} maxLength={5000} aria-label={`Comentario de Taller para ${fila.id}`} placeholder={ajuste.resultado === 'Rechazada' ? 'Obligatorio' : 'Opcional'} value={ajuste.motivo} onChange={e => editar(ajuste, { motivo: e.target.value })} />
                : evaluacion?.motivo || (interno ? borrador?.motivo : '') || '—'}</td>
            </tr>
          })}</tbody>
        </table>
      </div>
      {error && <p role="alert" className="m1-error">{error}</p>}
      <div className="m2-pie-evaluacion">
        <p className="m1-nota">{autorizado
          ? 'Guardar borrador permite continuar después. Finalizar evaluación envía el resultado a PCM.'
          : 'Consulta de la evaluación de Taller. Las tareas de ejecución externa no requieren evaluación interna.'}</p>
        {autorizado && <div className="m1-acciones">
          <button type="button" className="boton-secundario" disabled={!editable || ocupado || !editados.length} onClick={() => guardar(false)}><Icono nombre="guardar" />Guardar borrador</button>
          <button type="button" className="boton-primario" disabled={!editable || ocupado || restantes > 0} onClick={() => guardar(true)}><Icono nombre="correcto" />Finalizar evaluación</button>
        </div>}
      </div>
    </form>
    <details className="m2-historial-tareas">
      <summary>Historial de evaluación</summary>
      {plan.filas.map(fila => {
        const evaluacion = evaluacionVigente(plan, fila.id)
        const historial = Object.hasOwn(plan.revisionPCM?.tareas ?? {}, fila.id) ? plan.revisionPCM!.tareas[fila.id].evaluaciones : evaluacion ? [evaluacion] : []
        return historial.length > 0 && <div key={fila.id}><strong>{fila.id}</strong>
          <ul>{historial.map((h, i) => <li key={i}>v{h.versionTarea ?? 1} · {h.resultado}
            {h.tiempoAceptado && ` · ${h.tiempoAceptado} h`}{h.trabajadoresAceptados && ` · ${h.trabajadoresAceptados} trab.`} · {h.usuario} · {mostrarFecha(h.fecha)}
            {h.motivo && ` · ${h.motivo}`}
          </li>)}</ul>
        </div>
      })}
    </details>
  </section>
}
