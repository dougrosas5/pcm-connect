import { finParada, inputDesdeEta, etaDesdeInput, mostrarFecha } from '../model/modelo'
import type { Catalogos, Plan } from '../../../types/pcm'
import SelectorCatalogo from '../../../components/SelectorCatalogo'

export default function CabeceraPlan({ plan, catalogos, editable, cambiar }: {
  plan: Plan
  catalogos: Catalogos
  editable: boolean
  cambiar: (plan: Plan) => void
}) {
  return (
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
          {plan.tag ? 'ETA final · hora de Montevideo' : 'ETA inicial · hora de Montevideo'}
          <input
            type="datetime-local"
            value={inputDesdeEta(plan.eta)}
            disabled={!editable || Boolean(plan.tag)}
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
      {plan.tag && (
        <p className="m1-nota">
          ETA inicial (solo lectura): {mostrarFecha(plan.etaInicial ?? plan.eta)}.
          Para cambiar la ETA final con historial, abrí Validación Taller.
        </p>
      )}
      <p className="ayuda">
        Los catálogos se administran desde Catálogos. Completá la ETA antes del primer guardado;
        los demás campos pendientes pueden completarse antes del envío.
      </p>
    </section>
  )
}
