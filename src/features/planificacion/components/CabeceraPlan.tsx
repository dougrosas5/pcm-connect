import type { ReactNode } from 'react'
import { finParada, inputDesdeEta, etaDesdeInput, mostrarFecha } from '../model/modelo'
import type { Catalogos, Plan } from '../../../types/pcm'
import SelectorCatalogo from '../../../components/SelectorCatalogo'
import Icono from '../../../components/Icono'
import { etiquetaPlan } from '../../../components/etiquetasEstado'

function cerrarMetadatos(detalles: HTMLDetailsElement) {
  detalles.open = false
  detalles.querySelector('summary')?.focus()
}

export default function CabeceraPlan({ plan, catalogos, editable, cambiar, selector, abrirUbicaciones }: {
  plan: Plan
  catalogos: Catalogos
  editable: boolean
  cambiar: (plan: Plan) => void
  selector?: ReactNode
  abrirUbicaciones?: () => void
}) {
  const remolcador = catalogos.remolcadores.find(e => e.id === plan.remolcadorId)?.nombre
  return (
    <section className="m1-panel cabecera-naval" aria-labelledby="cabecera-v13">
      <div className="cabecera-naval-titulo">
        <h2 id="cabecera-v13"><Icono nombre="documento" />{plan.tag || 'Nueva planificación'}</h2>
        <details className="metadatos-plan" onKeyDown={e => {
          if (e.key === 'Escape') cerrarMetadatos(e.currentTarget)
        }}>
          <summary aria-label="Datos de autoría, ETA inicial y catálogos"><Icono nombre="informacion" /></summary>
          <div>
            <label className="m1-campo">Planificador<input readOnly value={plan.planificador} /></label>
            <p className="ayuda">
              Versión {plan.version} · ETA inicial (solo lectura): {mostrarFecha(plan.etaInicial ?? plan.eta)}.
              {plan.tag && ' Para actualizar la ETA final, abrí Validación Taller.'}
            </p>
            <p className="ayuda">
              La ETA inicial es obligatoria para guardar por primera vez. Completá los demás datos antes de enviar a Taller.
            </p>
            <button className="boton-secundario" onClick={e => {
              const detalles = e.currentTarget.closest('details')
              if (detalles) cerrarMetadatos(detalles)
            }}>Cerrar</button>
          </div>
        </details>
        {selector}
        <span className="estado">{etiquetaPlan[plan.estado]}</span>
        {plan.actualizado && <span className="actualizacion-plan">Actualizado {mostrarFecha(plan.actualizado)}</span>}
      </div>
      <div className="cabecera-naval-cuerpo">
        <div className="campos-naval">
          <label className="m1-campo campo-tag">
            TAG de planificación
            <input readOnly value={plan.tag || 'Se asigna al guardar'} />
          </label>
          <label className="m1-campo">
            Remolcador
            <SelectorCatalogo etiqueta="Remolcador" entradas={catalogos.remolcadores}
              valor={plan.remolcadorId} bloqueado={!editable}
              cambiar={v => cambiar({ ...plan, remolcadorId: v })} />
          </label>
          <div className="m1-campo">
            <label htmlFor="ubicacion-plan">Ubicación</label>
            <SelectorCatalogo id="ubicacion-plan" etiqueta="Ubicación" entradas={catalogos.ubicaciones}
              valor={plan.ubicacionId} bloqueado={!editable}
              cambiar={v => cambiar({ ...plan, ubicacionId: v })} />
            {!catalogos.ubicaciones.some(e => e.activo) && plan.estado === 'Borrador' && (
              <small className="ayuda">No hay ubicaciones activas. Un administrador debe registrarlas en Catálogos.</small>
            )}
            {abrirUbicaciones && plan.estado === 'Borrador' && <button type="button" className="enlace-catalogo" onClick={abrirUbicaciones}>Administrar ubicaciones</button>}
            {plan.estado !== 'Borrador' && <small className="ayuda">Ubicación fijada en la planificación enviada.</small>}
          </div>
          <label className="m1-campo">
            {plan.tag ? 'ETA final' : 'ETA inicial'}
            <input type="datetime-local" value={inputDesdeEta(plan.eta)}
              disabled={!editable || Boolean(plan.tag)}
              onChange={e => cambiar({ ...plan, eta: etaDesdeInput(e.target.value) })} />
          </label>
          <label className="m1-campo">
            Tiempo de parada (h)
            <input type="number" min="0" step="any" value={plan.horasParada} disabled={!editable}
              onChange={e => cambiar({ ...plan, horasParada: e.target.value })} />
          </label>
          <label className="m1-campo">
            Fin de parada
            <input readOnly value={mostrarFecha(finParada(plan))} />
          </label>
        </div>
        <aside className="resumen-remolcador" aria-label="Resumen de la ventana de parada">
          <div className="tarjeta-remolcador">
            <Icono nombre="barco" />
            <strong title={remolcador}>{remolcador || 'Sin remolcador'}</strong>
            <span>Parada: {plan.horasParada ? `${plan.horasParada} horas` : 'Sin definir'}</span>
          </div>
          <dl>
            <div><Icono nombre="calendario" /><dt>{plan.tag ? 'ETA final:' : 'ETA inicial:'}</dt><dd>{mostrarFecha(plan.eta)}</dd></div>
            <div><Icono nombre="reloj" /><dt>Fin de parada:</dt><dd>{mostrarFecha(finParada(plan))}</dd></div>
          </dl>
        </aside>
      </div>
    </section>
  )
}
