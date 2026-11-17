// Generado por scripts/build-api.mjs. Editar server/pcm.ts, src/types/pcm.ts y src/features/planificacion/model; ejecutar npm run build.
//#region src/features/planificacion/model/modelo.ts
function finParada(plan) {
	const fecha = Date.parse(plan.eta) + Number(plan.horasParada) * 36e5;
	return plan.eta && positivo$1(plan.horasParada) && Number.isFinite(fecha) && Math.abs(fecha) <= 864e13 ? new Date(fecha).toISOString() : "";
}
function etaValida(eta) {
	const tiempo = Date.parse(eta);
	return Number.isFinite(tiempo) && new Date(tiempo).toISOString() === eta;
}
function positivo$1(valor) {
	return valor.trim() !== "" && Number.isFinite(Number(valor)) && Number(valor) > 0;
}
function enteroPositivo(valor) {
	return /^\d+$/u.test(valor) && Number.isSafeInteger(Number(valor)) && Number(valor) > 0;
}
function elegibles(tarea) {
	return tarea.ordenes.filter((om) => om.estado.trim().toLocaleLowerCase("es") === "valor aprobado");
}
function valorTotal(ordenes) {
	const unicas = [...new Map(ordenes.map((om) => [om.numero, om])).values()];
	return unicas.length && unicas.every((om) => om.valor !== null) ? Math.round(unicas.reduce((suma, om) => suma + om.valor, 0) * 100) / 100 : null;
}
function instantaneaFuente(tarea) {
	return {
		id: tarea.id,
		descripcion: tarea.descripcion,
		tiempoOriginal: tarea.tiempoOriginal,
		criticidad: tarea.criticidad,
		estado: tarea.estado,
		ordenes: tarea.ordenes.map((o) => ({
			numero: o.numero,
			estado: o.estado,
			valor: o.valor
		})).sort((a, b) => a.numero.localeCompare(b.numero))
	};
}
function mismaFuente(a, b) {
	return JSON.stringify(instantaneaFuente(a)) === JSON.stringify(instantaneaFuente(b));
}
function diferenciasFuente(anterior, nueva) {
	const cambios = [];
	for (const tarea of anterior) if (!nueva.some((t) => t.id === tarea.id)) cambios.push(`${tarea.id}: ya no está en la importación.`);
	for (const tarea of nueva) {
		const previa = anterior.find((t) => t.id === tarea.id);
		if (!previa) cambios.push(`${tarea.id}: nueva tarea/PM.`);
		else if (!mismaFuente(previa, tarea)) cambios.push(`${tarea.id}: cambiaron datos, valores, estados o vínculos de OM.`);
	}
	return cambios;
}
function erroresEnvio(plan, registro) {
	const errores = [];
	for (const [tipo, id, etiqueta] of [[
		"remolcadores",
		plan.remolcadorId,
		"Remolcador"
	], [
		"ubicaciones",
		plan.ubicacionId,
		"Ubicación"
	]]) if (!registro.catalogos[tipo].some((e) => e.id === id && e.activo)) errores.push(`${etiqueta}: seleccioná una entrada activa.`);
	if (!etaValida(plan.eta)) errores.push("ETA: completá una fecha y hora válidas.");
	if (!positivo$1(plan.horasParada) || !finParada(plan)) errores.push("Tiempo de parada: ingresá una duración positiva válida.");
	if (!plan.filas.length) errores.push("Agregá al menos una TAREA o PM.");
	for (const fila of plan.filas) {
		if (!positivo$1(fila.tiempoPropuesto)) errores.push(`${fila.id}: el tiempo individual debe ser positivo.`);
		if (!enteroPositivo(fila.trabajadores)) errores.push(`${fila.id}: trabajadores debe ser un entero positivo.`);
		if (!registro.catalogos.responsables.some((e) => e.id === fila.responsableId && e.activo)) errores.push(`${fila.id}: seleccioná un responsable activo.`);
		if (!fila.descripcion || !fila.criticidad || !fila.estado || fila.tiempoOriginal === null || valorTotal(fila.ordenes) === null) errores.push(`${fila.id}: completá descripción, criticidad, estado, tiempo original y valores en la fuente y reimportá.`);
		const fuente = registro.fuente.find((t) => t.id === fila.id);
		if (!fuente || !mismaFuente({
			...fuente,
			ordenes: elegibles(fuente)
		}, fila)) errores.push(`${fila.id}: la fuente cambió; revisá y actualizá explícitamente esta fila antes de enviar.`);
	}
	return errores;
}
function validarFuente(tareas) {
	if (!Array.isArray(tareas) || !tareas.length) throw new Error("La importación no contiene tareas.");
	const ids = /* @__PURE__ */ new Set();
	const ordenes = /* @__PURE__ */ new Set();
	for (const t of tareas) {
		if (!t.id?.trim() || ids.has(t.id)) throw new Error(`TAREA/PM duplicada o vacía: ${t.id}.`);
		ids.add(t.id);
		if (typeof t.descripcion !== "string" || typeof t.criticidad !== "string" || typeof t.estado !== "string" || t.tiempoOriginal !== null && (!Number.isFinite(t.tiempoOriginal) || t.tiempoOriginal <= 0) || !Array.isArray(t.ordenes) || !t.ordenes.length) throw new Error(`${t.id}: datos de tarea inválidos.`);
		for (const om of t.ordenes) {
			if (!om.numero?.trim() || ordenes.has(om.numero)) throw new Error(`OM duplicada o vinculada a más de una tarea: ${om.numero}.`);
			if (typeof om.estado !== "string" || om.valor !== null && (!Number.isFinite(om.valor) || om.valor < 0)) throw new Error(`${om.numero}: estado o valor inválidos.`);
			ordenes.add(om.numero);
		}
	}
}
function puedeCambiarEta(actor) {
	return [
		"Planificador",
		"Administrador",
		"Supervisor Taller"
	].includes(actor.rol);
}
//#endregion
//#region src/features/revision-pcm/model/revision.ts
function cerradaPCM(plan) {
	return plan.estado === "Confirmada" || plan.estado === "Cancelada";
}
function resolucionTarea(plan, id) {
	return Object.hasOwn(plan.revisionPCM?.tareas ?? {}, id) ? plan.revisionPCM.tareas[id].resolucion : void 0;
}
function tareaActiva(plan, fila) {
	return plan.estado !== "Cancelada" && resolucionTarea(plan, fila.id)?.tipo !== "Eliminada";
}
function tareaInterna(plan, fila) {
	return tareaActiva(plan, fila) && !plan.referencias[fila.responsableId]?.externo && resolucionTarea(plan, fila.id)?.tipo !== "Tercerizada";
}
function evaluacionVigente(plan, id) {
	const e = Object.hasOwn(plan.evaluaciones, id) ? plan.evaluaciones[id] : void 0;
	const version = Object.hasOwn(plan.revisionPCM?.tareas ?? {}, id) ? plan.revisionPCM.tareas[id].version : 1;
	return e && (e.versionTarea ?? 1) === version ? e : void 0;
}
function prepararRevision(plan, actor, fecha) {
	plan.revisionPCM ??= {
		esquema: 1,
		versionContenido: 1,
		versionEvaluada: plan.estado === "Evaluado" ? 1 : null,
		tareas: {},
		conflictos: []
	};
	for (const fila of plan.filas) {
		if (Object.hasOwn(plan.revisionPCM.tareas, fila.id)) continue;
		const anterior = Object.hasOwn(plan.evaluaciones, fila.id) ? plan.evaluaciones[fila.id] : void 0;
		Object.defineProperty(plan.revisionPCM.tareas, fila.id, {
			enumerable: true,
			configurable: true,
			writable: true,
			value: {
				version: 1,
				responsableOriginalId: fila.responsableId,
				resoluciones: [],
				evaluaciones: anterior ? [structuredClone(anterior)] : [],
				versiones: [{
					...firma$1(actor, fecha),
					version: 1,
					fila: structuredClone(fila),
					campos: []
				}]
			}
		});
	}
	return plan.revisionPCM;
}
function firma$1(actor, fecha) {
	return {
		usuarioId: actor.id,
		usuario: actor.nombre,
		rol: actor.rol,
		fecha
	};
}
function conflictosPendientes(plan) {
	return (plan.revisionPCM?.conflictos ?? []).filter((c) => plan.filas.some((f) => f.id === c.tareaId && tareaInterna(plan, f)));
}
function erroresConfirmacion(plan) {
	const errores = [];
	if (plan.estado !== "Evaluado") errores.push("Taller debe finalizar la evaluación vigente antes de confirmar.");
	if (plan.revisionPCM && plan.revisionPCM.versionEvaluada !== plan.revisionPCM.versionContenido) errores.push("Hay tareas pendientes de reevaluación de la versión actual.");
	if (!/^PCM-\d{6,}$/u.test(plan.tag)) errores.push("El TAG no es válido.");
	if (!etaValida(plan.eta) || !finParada(plan)) errores.push("La ETA final o el tiempo de parada no es válido.");
	if (!plan.filas.some((f) => tareaActiva(plan, f))) errores.push("Debe existir al menos una tarea activa.");
	for (const f of plan.filas.filter((f) => tareaInterna(plan, f))) {
		const e = evaluacionVigente(plan, f.id);
		if (!e) errores.push(`${f.id}: pendiente de evaluación vigente.`);
		else if (e.resultado === "Rechazada") errores.push(`${f.id}: rechazo sin resolver.`);
	}
	return errores;
}
function registrarConflictos(registro, plan, actor, fecha) {
	if (["Borrador", "Cancelada"].includes(plan.estado)) return;
	const revision = prepararRevision(plan, actor, fecha);
	const agregar = (tareaId, detalle, otroPlanId) => {
		const id = `${tareaId}:${otroPlanId ?? "parada"}:${plan.eta}`;
		if (!revision.conflictos.some((c) => c.id === id)) revision.conflictos.push({
			id,
			tareaId,
			otroPlanId,
			detalle,
			fecha,
			estado: "Pendiente de reprogramación"
		});
	};
	const inicio = Date.parse(plan.eta), fin = Date.parse(finParada(plan));
	for (const fila of plan.filas.filter((f) => tareaInterna(plan, f))) {
		const horas = evaluacionVigente(plan, fila.id)?.tiempoAceptado ?? fila.tiempoPropuesto;
		if (Number(horas) > Number(plan.horasParada)) agregar(fila.id, `${fila.id}: duración de ${horas} h mayor que la parada de ${plan.horasParada} h.`);
		for (const otro of registro.planes) {
			if (otro.id === plan.id || ["Cancelada", "Borrador"].includes(otro.estado)) continue;
			if (!(inicio < Date.parse(finParada(otro)) && Date.parse(otro.eta) < fin)) continue;
			const afectadas = otro.filas.filter((f) => tareaInterna(otro, f) && (f.responsableId === fila.responsableId || otro.remolcadorId === plan.remolcadorId));
			if (afectadas.length) agregar(fila.id, `${fila.id}: ventana solapada con ${otro.tag} (${afectadas.map((f) => f.id).join(", ")}), por remolcador o responsable compartido. Verificar disponibilidad.`, otro.id);
		}
	}
}
function resolver(plan, decision, registro, actor, fecha) {
	const fila = plan.filas.find((f) => f.id === decision.tareaId);
	if (!fila || evaluacionVigente(plan, fila.id)?.resultado !== "Rechazada" || resolucionTarea(plan, fila.id)) throw new Error(`${decision.tareaId}: solo se pueden resolver rechazos pendientes; las aceptadas están congeladas.`);
	const revision = prepararRevision(plan, actor, fecha);
	const tarea = revision.tareas[fila.id];
	const resolucion = {
		...firma$1(actor, fecha),
		tipo: decision.tipo,
		versionTarea: tarea.version
	};
	if (decision.tipo === "Eliminada" && !decision.confirmada) throw new Error("Confirmá la eliminación lógica de la tarea.");
	if (decision.tipo === "Devuelta a revisión") {
		const cambios = decision.correccion;
		if (!cambios || !cambios.descripcion.trim() || !cambios.criticidad.trim() || !positivo$1(cambios.tiempoPropuesto) || !enteroPositivo(cambios.trabajadores)) throw new Error("Completá la corrección: descripción, criticidad, horas positivas y trabajadores enteros positivos.");
		const responsable = registro.catalogos.responsables.find((r) => r.id === cambios.responsableId && r.activo && !r.externo);
		if (!responsable) throw new Error("La reevaluación requiere un responsable interno activo; para ejecución externa elegí Tercerizar.");
		const campos = Object.keys(cambios).filter((k) => fila[k] !== cambios[k]);
		if (!campos.length) throw new Error("Modificá al menos un campo antes de reenviar a Taller.");
		fila.descripcion = cambios.descripcion.trim();
		fila.criticidad = cambios.criticidad.trim();
		fila.tiempoPropuesto = cambios.tiempoPropuesto;
		fila.trabajadores = cambios.trabajadores;
		fila.responsableId = cambios.responsableId;
		plan.referencias[responsable.id] = structuredClone(responsable);
		tarea.version++;
		tarea.versiones.push({
			...firma$1(actor, fecha),
			version: tarea.version,
			fila: structuredClone(fila),
			campos
		});
		revision.versionContenido++;
		plan.estado = "En reevaluación";
	}
	tarea.resolucion = resolucion;
	tarea.resoluciones.push(resolucion);
}
function aplicarRevision(registro, comando, actor, fecha) {
	if (!["Planificador", "Administrador"].includes(actor.rol)) throw new Error("Solo PCM autorizado puede revisar, confirmar o cancelar.");
	const plan = registro.planes.find((p) => p.id === comando.planId);
	if (!plan || plan.version !== comando.version) throw new Error("La planificación cambió. Actualizá y reabrí antes de guardar.");
	if (cerradaPCM(plan)) throw new Error("La planificación está confirmada o cancelada; solo permite consulta.");
	const anterior = structuredClone(plan);
	const revision = prepararRevision(plan, actor, fecha);
	if (comando.tipo === "guardarRevision") {
		if (!["Evaluado", "En reevaluación"].includes(plan.estado)) throw new Error("Taller debe finalizar la evaluación antes de la revisión PCM.");
		if (!comando.decisiones.length) throw new Error("No hay resoluciones nuevas para guardar.");
		if (new Set(comando.decisiones.map((d) => d.tareaId)).size !== comando.decisiones.length) throw new Error("Hay resoluciones duplicadas.");
		for (const decision of comando.decisiones) {
			resolver(plan, decision, registro, actor, fecha);
			registro.historial.push({
				...firma$1(actor, fecha),
				accion: decision.tipo,
				entidad: plan.tag,
				planId: plan.id,
				tareaId: decision.tareaId,
				anterior: anterior.filas.find((f) => f.id === decision.tareaId),
				nuevo: structuredClone(revision.tareas[decision.tareaId])
			});
		}
	} else if (comando.tipo === "confirmarPCM") {
		const errores = erroresConfirmacion(plan);
		if (errores.length) throw new Error(errores.join("\n"));
		const conflictos = conflictosPendientes(plan);
		if (conflictos.length && !comando.reconocerConflictos) throw new Error("Reconocé explícitamente los conflictos pendientes de reprogramación.");
		for (const c of conflictos) c.reconocimiento = firma$1(actor, fecha);
		if (conflictos.length) registro.historial.push({
			...firma$1(actor, fecha),
			accion: "Reconocer alertas",
			entidad: plan.tag,
			planId: plan.id,
			anterior: null,
			nuevo: structuredClone(conflictos)
		});
		plan.estado = "Confirmada";
		revision.confirmacion = {
			...firma$1(actor, fecha),
			version: plan.version + 1,
			conAdvertencias: conflictos.length > 0
		};
	} else {
		if (!comando.confirmada || !comando.motivo.trim()) throw new Error("La cancelación requiere motivo y confirmación explícita.");
		plan.estado = "Cancelada";
		revision.cancelacion = {
			...firma$1(actor, fecha),
			motivo: comando.motivo.trim()
		};
	}
	plan.version++;
	plan.actualizado = fecha;
	registro.historial.push({
		...firma$1(actor, fecha),
		accion: comando.tipo,
		entidad: plan.tag,
		planId: plan.id,
		anterior,
		nuevo: structuredClone(plan)
	});
}
//#endregion
//#region src/features/planificacion/model/comandos.ts
function aplicarComando(actual, comando, actor, solicitud, fecha) {
	if (actual.solicitudes[solicitud] !== void 0) return actual;
	const siguiente = structuredClone(actual);
	const pcm = actor.rol === "Planificador" || actor.rol === "Administrador";
	function auditar(entidad, anterior, nuevo) {
		siguiente.historial.push({
			fecha,
			usuario: actor.nombre,
			usuarioId: actor.id,
			rol: actor.rol,
			accion: comando.tipo,
			entidad,
			anterior,
			nuevo,
			..."planId" in comando ? { planId: comando.planId } : {},
			..."tareaId" in comando ? { tareaId: comando.tareaId } : {}
		});
	}
	if (comando.tipo === "guardar") {
		if (!pcm) throw new Error("Solo Planificador o Administrador puede guardar o enviar.");
		const anterior = actual.planes.find((p) => p.id === comando.plan.id);
		if (anterior && anterior.planificadorId !== actor.id && actor.rol !== "Administrador") throw new Error("La planificación pertenece a otro planificador.");
		if (anterior && (anterior.estado !== "Borrador" || anterior.version !== comando.plan.version)) throw new Error("La planificación cambió o ya fue enviada. Volvé a abrirla.");
		const plan = structuredClone(comando.plan);
		delete plan.revisionPCM;
		if (!anterior && !etaValida(plan.eta)) throw new Error("ETA: completá una fecha y hora válidas antes de crear la planificación.");
		if (anterior && plan.eta !== anterior.eta) throw new Error("La ETA final se modifica desde Validación Taller, con comentario e historial.");
		plan.etaInicial = anterior ? anterior.etaInicial ?? anterior.eta : plan.eta;
		plan.origenEtaInicial = anterior ? anterior.origenEtaInicial ?? (anterior.eta ? "heredada" : "sin-dato") : "creacion";
		plan.historialEta = structuredClone(anterior?.historialEta ?? []);
		const tareas = /* @__PURE__ */ new Set();
		const oms = /* @__PURE__ */ new Set();
		for (const fila of plan.filas) {
			if (tareas.has(fila.id)) throw new Error(`TAREA/PM ${fila.id} duplicada.`);
			tareas.add(fila.id);
			if (!fila.ordenes.length || elegibles(fila).length !== fila.ordenes.length) throw new Error(`${fila.id}: solo se permiten OM con «Valor aprobado».`);
			for (const om of fila.ordenes) {
				if (oms.has(om.numero)) throw new Error(`OM ${om.numero} duplicada.`);
				oms.add(om.numero);
			}
			const conflicto = actual.planes.find((p) => p.id !== plan.id && p.filas.some((f) => tareaActiva(p, f) && (f.id === fila.id || f.ordenes.some((om) => oms.has(om.numero) || fila.ordenes.some((o) => o.numero === om.numero)))));
			if (conflicto) throw new Error(`${fila.id}: conflicto con la planificación ${conflicto.tag}.`);
		}
		if (comando.enviar) {
			const errores = erroresEnvio(plan, actual);
			if (errores.length) throw new Error(errores.join("\n"));
		}
		if (!anterior) siguiente.contador++;
		if (!Number.isSafeInteger(siguiente.contador)) throw new Error("Se alcanzó el límite de numeración.");
		plan.tag = anterior?.tag ?? `PCM-${String(siguiente.contador).padStart(6, "0")}`;
		plan.version = (anterior?.version ?? 0) + 1;
		plan.estado = comando.enviar ? "Enviado a Taller" : "Borrador";
		plan.planificador = anterior?.planificador ?? actor.nombre;
		plan.planificadorId = anterior?.planificadorId ?? actor.id;
		plan.actualizado = fecha;
		plan.enviado = comando.enviar ? fecha : null;
		plan.evaluaciones = {};
		plan.referencias = Object.fromEntries(Object.values(actual.catalogos).flat().map((e) => [e.id, structuredClone(e)]));
		siguiente.planes = [...actual.planes.filter((p) => p.id !== plan.id), plan];
		auditar(plan.tag, anterior ?? null, plan);
	} else if (comando.tipo === "cambiarEta") {
		if (!puedeCambiarEta(actor)) throw new Error("Solo PCM o un Supervisor de Taller autorizado puede modificar la ETA final.");
		const plan = siguiente.planes.find((p) => p.id === comando.planId);
		if (!plan || plan.version !== comando.version) throw new Error("La planificación cambió. Actualizá los datos antes de modificar la ETA final.");
		if (cerradaPCM(plan)) throw new Error("La planificación confirmada o cancelada es de solo consulta.");
		if (!etaValida(comando.eta)) throw new Error("Ingresá una ETA final válida.");
		if (!comando.comentario.trim()) throw new Error("El cambio de ETA final requiere un comentario.");
		if (comando.eta === plan.eta) throw new Error("La ETA final no cambió; no se registró un evento duplicado.");
		const anterior = structuredClone(plan);
		plan.etaInicial ??= plan.eta;
		plan.origenEtaInicial ??= plan.eta ? "heredada" : "sin-dato";
		plan.historialEta ??= [];
		plan.historialEta.push({
			fecha,
			usuarioId: actor.id,
			usuario: actor.nombre,
			rol: actor.rol,
			anterior: plan.eta,
			nuevo: comando.eta,
			comentario: comando.comentario.trim(),
			revisionDisponibilidad: "pendiente"
		});
		plan.eta = comando.eta;
		plan.actualizado = fecha;
		plan.version++;
		registrarConflictos(siguiente, plan, actor, fecha);
		for (const otro of siguiente.planes) {
			if (otro.id === plan.id || ["Cancelada", "Borrador"].includes(otro.estado)) continue;
			const antes = structuredClone(otro);
			const candidato = structuredClone(otro);
			const cantidad = otro.revisionPCM?.conflictos.length ?? 0;
			registrarConflictos(siguiente, candidato, actor, fecha);
			if ((candidato.revisionPCM?.conflictos.length ?? 0) > cantidad) {
				otro.revisionPCM = candidato.revisionPCM;
				otro.version++;
				otro.actualizado = fecha;
				auditar(otro.tag, antes, structuredClone(otro));
			}
		}
		auditar(plan.tag, anterior, plan);
	} else if (comando.tipo === "guardarRevision" || comando.tipo === "confirmarPCM" || comando.tipo === "cancelarPCM") aplicarRevision(siguiente, comando, actor, fecha);
	else if (comando.tipo === "catalogo") {
		if (actor.rol !== "Administrador") throw new Error("Solo Administración puede modificar catálogos.");
		const entrada = {
			...comando.entrada,
			nombre: comando.entrada.nombre.trim()
		};
		if (!entrada.nombre) throw new Error("Ingresá el nombre de la entrada.");
		if (actual.catalogos[comando.catalogo].some((e) => e.id !== entrada.id && e.nombre.toLocaleUpperCase("es") === entrada.nombre.toLocaleUpperCase("es"))) throw new Error("Ese nombre ya existe en el catálogo.");
		const anterior = actual.catalogos[comando.catalogo].find((e) => e.id === entrada.id) ?? null;
		if (anterior && anterior.externo !== entrada.externo && actual.planes.some((p) => p.filas.some((f) => f.responsableId === entrada.id))) throw new Error("No se puede cambiar el tipo de ejecución de un responsable utilizado; creá una entrada nueva.");
		siguiente.catalogos[comando.catalogo] = [...actual.catalogos[comando.catalogo].filter((e) => e.id !== entrada.id), entrada];
		auditar(entrada.id, anterior, entrada);
	} else if (comando.tipo === "importar") {
		if (!pcm) throw new Error("Solo PCM puede importar datos.");
		validarFuente(comando.tareas);
		if (!comando.procedencia.trim()) throw new Error("Indicá la procedencia del archivo.");
		const diferencias = diferenciasFuente(actual.fuente, comando.tareas);
		siguiente.fuente = structuredClone(comando.tareas);
		siguiente.importaciones.push({
			id: solicitud,
			fecha,
			usuario: actor.nombre,
			procedencia: comando.procedencia,
			tareas: structuredClone(comando.tareas),
			diferencias
		});
		auditar("Fuente Excel", actual.fuente, comando.tareas);
	} else {
		if (![
			"Taller",
			"Supervisor Taller",
			"Administrador"
		].includes(actor.rol)) throw new Error("Solo Taller puede evaluar.");
		const plan = siguiente.planes.find((p) => p.id === comando.planId);
		if (!plan || ![
			"Enviado a Taller",
			"En evaluación",
			"En reevaluación"
		].includes(plan.estado)) throw new Error("La planificación no está disponible para evaluación.");
		if (comando.version !== void 0 && comando.version !== plan.version) throw new Error("La planificación cambió. Reabrí la versión vigente.");
		const anterior = structuredClone(plan);
		const revision = prepararRevision(plan, actor, fecha);
		if (comando.tipo === "evaluar") {
			const fila = plan.filas.find((f) => f.id === comando.tareaId);
			if (!fila || !tareaInterna(plan, fila)) throw new Error("La tarea no requiere evaluación de Taller interno.");
			if (evaluacionVigente(plan, fila.id)) throw new Error("La tarea ya fue evaluada en esta versión; su decisión está congelada.");
			if (!["Aceptada", "Rechazada"].includes(comando.resultado) || comando.resultado === "Rechazada" && !comando.motivo.trim()) throw new Error("El rechazo requiere un motivo.");
			const tiempoAceptado = comando.tiempoAceptado ?? fila.tiempoPropuesto;
			const trabajadoresAceptados = comando.trabajadoresAceptados ?? fila.trabajadores;
			if (!positivo$1(tiempoAceptado) || !enteroPositivo(trabajadoresAceptados)) throw new Error("Las horas deben ser positivas y los trabajadores enteros positivos.");
			Object.defineProperty(plan.evaluaciones, fila.id, {
				enumerable: true,
				configurable: true,
				writable: true,
				value: {
					resultado: comando.resultado,
					motivo: comando.motivo.trim(),
					usuario: actor.nombre,
					fecha,
					usuarioId: actor.id,
					versionTarea: revision.tareas[fila.id].version,
					tiempoAceptado,
					trabajadoresAceptados
				}
			});
			revision.tareas[fila.id].evaluaciones.push(structuredClone(plan.evaluaciones[fila.id]));
			if (resolucionTarea(plan, fila.id)?.tipo === "Devuelta a revisión") delete revision.tareas[fila.id].resolucion;
			plan.estado = revision.versionContenido > 1 ? "En reevaluación" : "En evaluación";
		} else {
			if (plan.filas.some((f) => tareaInterna(plan, f) && !evaluacionVigente(plan, f.id))) throw new Error("Hay tareas internas pendientes de evaluación.");
			plan.estado = "Evaluado";
			revision.versionEvaluada = revision.versionContenido;
		}
		plan.actualizado = fecha;
		plan.version++;
		auditar(plan.tag, anterior, plan);
	}
	siguiente.revision++;
	siguiente.solicitudes[solicitud] = siguiente.revision;
	return siguiente;
}
//#endregion
//#region src/features/revision-pcm/model/validacion.ts
var objeto$1 = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var texto$1 = (v) => typeof v === "string";
var positivo = (v) => Number.isSafeInteger(v) && Number(v) > 0;
function firma(v) {
	return objeto$1(v) && texto$1(v.usuarioId) && texto$1(v.usuario) && texto$1(v.fecha) && etaValida(v.fecha) && [
		"Planificador",
		"Taller",
		"Supervisor Taller",
		"Administrador",
		"Consulta"
	].includes(String(v.rol));
}
function evaluacion(v) {
	return objeto$1(v) && ["Aceptada", "Rechazada"].includes(String(v.resultado)) && texto$1(v.motivo) && texto$1(v.usuario) && texto$1(v.fecha) && etaValida(v.fecha) && (v.versionTarea === void 0 || positivo(v.versionTarea)) && (v.tiempoAceptado === void 0 || texto$1(v.tiempoAceptado) && Number.isFinite(Number(v.tiempoAceptado)) && Number(v.tiempoAceptado) > 0) && (v.trabajadoresAceptados === void 0 || texto$1(v.trabajadoresAceptados) && /^\d+$/u.test(v.trabajadoresAceptados) && positivo(Number(v.trabajadoresAceptados)));
}
function resolucion(v) {
	return objeto$1(v) && firma(v) && positivo(v.versionTarea) && [
		"Tercerizada",
		"Eliminada",
		"Devuelta a revisión"
	].includes(String(v.tipo));
}
function validarRevisionPersistida(p) {
	if (p.evaluaciones !== void 0 && (!objeto$1(p.evaluaciones) || !Object.values(p.evaluaciones).every(evaluacion))) throw new Error("Evaluaciones guardadas inválidas; se conservó el contenido original.");
	const r = p.revisionPCM;
	if (r === void 0) {
		if ([
			"Confirmada",
			"Cancelada",
			"En reevaluación"
		].includes(String(p.estado))) throw new Error("Falta la trazabilidad de revisión PCM; se conservó el contenido original.");
		return;
	}
	const fallar = () => {
		throw new Error("Revisión PCM guardada inválida; se conservó el contenido original.");
	};
	if (!objeto$1(r) || r.esquema !== 1 || !positivo(r.versionContenido) || !(r.versionEvaluada === null || positivo(r.versionEvaluada) && Number(r.versionEvaluada) <= Number(r.versionContenido)) || !objeto$1(r.tareas) || !Array.isArray(r.conflictos)) return fallar();
	const ids = p.filas.map((f) => f.id);
	if (Object.keys(r.tareas).length !== ids.length) return fallar();
	for (const [id, t] of Object.entries(r.tareas)) {
		if (!ids.includes(id) || !objeto$1(t) || !positivo(t.version) || !texto$1(t.responsableOriginalId) || !Array.isArray(t.resoluciones) || !t.resoluciones.every(resolucion) || t.resolucion !== void 0 && (!resolucion(t.resolucion) || JSON.stringify(t.resolucion) !== JSON.stringify(t.resoluciones.at(-1))) || !Array.isArray(t.evaluaciones) || !t.evaluaciones.every(evaluacion) || !Array.isArray(t.versiones) || t.versiones.length !== t.version) return fallar();
		for (const [indice, v] of t.versiones.entries()) {
			if (!objeto$1(v) || !firma(v) || v.version !== indice + 1 || !objeto$1(v.fila) || v.fila.id !== id || !Array.isArray(v.campos) || !v.campos.every(texto$1)) return fallar();
			validarFuente([v.fila]);
		}
	}
	if (r.conflictos.some((c) => !objeto$1(c) || !texto$1(c.id) || !ids.includes(String(c.tareaId)) || !texto$1(c.detalle) || !texto$1(c.fecha) || !etaValida(c.fecha) || c.estado !== "Pendiente de reprogramación" || c.reconocimiento !== void 0 && !firma(c.reconocimiento))) return fallar();
	if (r.confirmacion !== void 0 && (!objeto$1(r.confirmacion) || !firma(r.confirmacion) || !positivo(r.confirmacion.version) || typeof r.confirmacion.conAdvertencias !== "boolean")) return fallar();
	if (r.cancelacion !== void 0 && (!objeto$1(r.cancelacion) || !firma(r.cancelacion) || !texto$1(r.cancelacion.motivo) || !r.cancelacion.motivo.trim())) return fallar();
	if (p.estado === "Confirmada" && !r.confirmacion || p.estado === "Cancelada" && !r.cancelacion) return fallar();
}
//#endregion
//#region src/features/planificacion/model/validacion.ts
function texto(valor, maximo = 5e3) {
	return typeof valor === "string" && valor.length <= maximo;
}
function objeto(valor) {
	return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}
function validarComando(valor) {
	if (!objeto(valor)) throw new Error("Comando inválido.");
	if (valor.tipo === "guardar") {
		const p = valor.plan;
		if (!objeto(p) || typeof valor.enviar !== "boolean" || !texto(p.id, 80) || !/^[a-zA-Z0-9-]{16,80}$/u.test(p.id) || !Number.isSafeInteger(p.version) || Number(p.version) < 0 || ![
			"remolcadorId",
			"ubicacionId",
			"eta",
			"horasParada"
		].every((k) => texto(p[k], 100)) || !Array.isArray(p.filas) || p.filas.length > 500) throw new Error("La planificación tiene datos inválidos o supera 500 tareas.");
		if (p.filas.length) validarFuente(p.filas);
		if (p.etaInicial !== void 0 && (typeof p.etaInicial !== "string" || p.etaInicial !== "" && !etaValida(p.etaInicial)) || p.origenEtaInicial !== void 0 && ![
			"creacion",
			"heredada",
			"sin-dato"
		].includes(String(p.origenEtaInicial)) || p.historialEta !== void 0 && (!Array.isArray(p.historialEta) || p.historialEta.some((c) => !objeto(c) || !texto(c.fecha) || !etaValida(c.fecha) || !texto(c.usuarioId, 80) || !texto(c.usuario) || !texto(c.anterior) || c.anterior !== "" && !etaValida(c.anterior) || !texto(c.nuevo) || !etaValida(c.nuevo) || !texto(c.comentario) || !c.comentario.trim() || c.revisionDisponibilidad !== "pendiente"))) throw new Error("Los datos o el historial de ETA son inválidos; no se modificó el guardado.");
		if (p.filas.some((f) => !objeto(f) || ![
			"tiempoPropuesto",
			"trabajadores",
			"responsableId"
		].every((k) => texto(f[k], 100)))) throw new Error("Campos de propuesta inválidos.");
		validarRevisionPersistida(p);
	} else if (valor.tipo === "cambiarEta") {
		if (!texto(valor.planId, 80) || !valor.planId || !Number.isSafeInteger(valor.version) || Number(valor.version) < 1 || !texto(valor.eta, 100) || !etaValida(valor.eta) || !texto(valor.comentario) || !valor.comentario.trim()) throw new Error("Ingresá una ETA final válida y un comentario para registrar el cambio.");
	} else if (valor.tipo === "catalogo") {
		const e = valor.entrada;
		if (![
			"remolcadores",
			"ubicaciones",
			"responsables"
		].includes(String(valor.catalogo)) || !objeto(e) || !texto(e.id, 80) || !e.id || !texto(e.nombre, 160) || typeof e.activo !== "boolean" || typeof e.externo !== "boolean" || valor.catalogo !== "responsables" && e.externo) throw new Error("Entrada de catálogo inválida.");
	} else if (valor.tipo === "importar") {
		if (!texto(valor.procedencia, 250) || !Array.isArray(valor.tareas) || valor.tareas.length > 2e4) throw new Error("Importación inválida o demasiado grande.");
		validarFuente(valor.tareas);
	} else if (valor.tipo === "evaluar") {
		if (!texto(valor.planId, 80) || !texto(valor.tareaId, 100) || !["Aceptada", "Rechazada"].includes(String(valor.resultado)) || !texto(valor.motivo)) throw new Error("Evaluación inválida.");
		if (valor.version !== void 0 && (!Number.isSafeInteger(valor.version) || Number(valor.version) < 1) || valor.tiempoAceptado !== void 0 && !texto(valor.tiempoAceptado, 100) || valor.trabajadoresAceptados !== void 0 && !texto(valor.trabajadoresAceptados, 100)) throw new Error("Valores de evaluación inválidos.");
	} else if (valor.tipo === "finalizar") {
		if (!texto(valor.planId, 80) || valor.version !== void 0 && (!Number.isSafeInteger(valor.version) || Number(valor.version) < 1)) throw new Error("Planificación inválida.");
	} else if ([
		"guardarRevision",
		"confirmarPCM",
		"cancelarPCM"
	].includes(String(valor.tipo))) {
		if (!texto(valor.planId, 80) || !valor.planId || !Number.isSafeInteger(valor.version) || Number(valor.version) < 1) throw new Error("Planificación o versión de revisión inválida.");
		if (valor.tipo === "guardarRevision") {
			if (!Array.isArray(valor.decisiones) || valor.decisiones.length > 500 || valor.decisiones.some((d) => !objeto(d) || !texto(d.tareaId, 100) || !d.tareaId || ![
				"Tercerizada",
				"Eliminada",
				"Devuelta a revisión"
			].includes(String(d.tipo)) || d.confirmada !== void 0 && typeof d.confirmada !== "boolean" || d.tipo === "Devuelta a revisión" && (!objeto(d.correccion) || ![
				"descripcion",
				"criticidad",
				"tiempoPropuesto",
				"trabajadores",
				"responsableId"
			].every((k) => texto(d.correccion[k])) || Object.keys(d.correccion).some((k) => ![
				"descripcion",
				"criticidad",
				"tiempoPropuesto",
				"trabajadores",
				"responsableId"
			].includes(k))))) throw new Error("Resoluciones PCM inválidas.");
		} else if (valor.tipo === "confirmarPCM") {
			if (typeof valor.reconocerConflictos !== "boolean") throw new Error("Reconocimiento de conflictos inválido.");
		} else if (!texto(valor.motivo) || typeof valor.confirmada !== "boolean") throw new Error("Cancelación inválida.");
	} else throw new Error("Acción no reconocida.");
}
//#endregion
//#region server/pcm.ts
function respuesta(datos, estado = 200) {
	return Response.json(datos, {
		status: estado,
		headers: {
			"Cache-Control": "no-store",
			"X-Content-Type-Options": "nosniff"
		}
	});
}
function crearHandler(configuracion, solicitar = fetch) {
	return async (request) => {
		if (!["GET", "POST"].includes(request.method)) return respuesta({ message: "Método no permitido." }, 405);
		const config = configuracion();
		if (!config.url || !config.clave) return respuesta({ message: "Servidor sin configurar: faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY." }, 503);
		const token = request.headers.get("Authorization") ?? "";
		if (!/^Bearer \S+$/u.test(token)) return respuesta({ message: "Iniciá sesión." }, 401);
		try {
			const usuarioRespuesta = await solicitar(`${config.url}/auth/v1/user`, {
				headers: {
					apikey: config.clave,
					Authorization: token
				},
				signal: AbortSignal.timeout(15e3)
			});
			if (!usuarioRespuesta.ok) return respuesta({ message: "La sesión venció o no es válida. Volvé a iniciar sesión." }, 401);
			const usuario = await usuarioRespuesta.json();
			if (!usuario.id) return respuesta({ message: "Sesión inválida." }, 401);
			async function db(ruta, cuerpo) {
				const r = await solicitar(`${config.url}/rest/v1/${ruta}`, {
					method: cuerpo === void 0 ? "GET" : "POST",
					headers: {
						apikey: config.clave,
						Authorization: `Bearer ${config.clave}`,
						"Content-Type": "application/json"
					},
					...cuerpo === void 0 ? {} : { body: JSON.stringify(cuerpo) },
					signal: AbortSignal.timeout(15e3)
				});
				const datos = await r.json();
				if (!r.ok) {
					if (datos.code === "40001") throw new Error("CONFLICTO");
					throw new Error("No se pudo acceder al almacenamiento. Revisá la migración y la configuración del servidor.");
				}
				return datos;
			}
			const perfil = (await db(`pcm_perfiles?id=eq.${encodeURIComponent(usuario.id)}&select=id,nombre,rol,activo`))[0];
			if (!perfil?.activo || ![
				"Planificador",
				"Taller",
				"Supervisor Taller",
				"Administrador",
				"Consulta"
			].includes(perfil.rol)) return respuesta({ message: "La cuenta no tiene un perfil activo autorizado en PCM Connect." }, 403);
			const actor = {
				id: perfil.id,
				nombre: perfil.nombre,
				rol: perfil.rol
			};
			const registro = (await db("pcm_modulo1?id=eq.1&select=registro"))[0]?.registro;
			if (!registro) return respuesta({ message: "Falta inicializar el Módulo 1. Aplicá la migración SQL." }, 503);
			if (request.method === "GET") return respuesta({
				registro,
				actor
			});
			const texto = await request.text();
			if (texto.length > 3e6) return respuesta({ message: "La solicitud es demasiado grande. Reducí la importación." }, 413);
			let datos;
			try {
				datos = JSON.parse(texto);
			} catch {
				return respuesta({ message: "JSON inválido." }, 400);
			}
			if (!datos || !Number.isSafeInteger(datos.revision_esperada) || typeof datos.solicitud !== "string" || !/^[a-zA-Z0-9-]{16,80}$/u.test(datos.solicitud)) return respuesta({ message: "Solicitud o versión inválida." }, 400);
			const solicitud = `${actor.id}:${datos.solicitud}`;
			if (registro.solicitudes[solicitud] !== void 0) return respuesta({
				registro,
				actor
			});
			if (registro.revision !== datos.revision_esperada) return respuesta({ message: "Los datos cambiaron. Actualizá antes de guardar; conservá tus cambios para compararlos." }, 409);
			let siguiente;
			try {
				validarComando(datos.comando);
				siguiente = aplicarComando(registro, datos.comando, actor, solicitud, (/* @__PURE__ */ new Date()).toISOString());
			} catch (error) {
				return respuesta({ message: error instanceof Error ? error.message : "Datos inválidos." }, 422);
			}
			return respuesta({
				registro: await db("rpc/pcm_guardar", {
					nuevo: siguiente,
					revision_esperada: registro.revision,
					solicitud
				}),
				actor
			});
		} catch (error) {
			if (error instanceof Error && error.message === "CONFLICTO") return respuesta({ message: "Otra solicitud guardó cambios simultáneamente. Actualizá los datos; tus cambios siguen en pantalla." }, 409);
			return respuesta({ message: error instanceof Error && error.message.startsWith("No se pudo acceder") ? error.message : "No se pudo completar la operación. Revisá la conexión y reintentá la misma acción." }, 503);
		}
	};
}
var atender = crearHandler(() => ({
	url: (process.env.SUPABASE_URL ?? "").replace(/\/$/u, ""),
	clave: process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
}));
async function handler(req, res) {
	try {
		const headers = new Headers();
		for (const [clave, valor] of Object.entries(req.headers)) if (valor) headers.set(clave, Array.isArray(valor) ? valor.join(",") : valor);
		let cuerpo;
		if (!["GET", "HEAD"].includes(req.method ?? "GET")) {
			if (req.body !== void 0) cuerpo = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
			else {
				const partes = [];
				let bytes = 0;
				for await (const parte of req) {
					const buffer = Buffer.from(parte);
					bytes += buffer.length;
					if (bytes > 3e6) {
						res.writeHead(413, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ message: "La solicitud es demasiado grande." }));
						return;
					}
					partes.push(buffer);
				}
				cuerpo = Buffer.concat(partes).toString("utf8");
			}
		}
		const resultado = await atender(new Request("http://localhost/api/pcm", {
			method: req.method,
			headers,
			...cuerpo === void 0 ? {} : { body: cuerpo }
		}));
		res.statusCode = resultado.status;
		resultado.headers.forEach((valor, clave) => res.setHeader(clave, valor));
		res.end(await resultado.text());
	} catch {
		res.writeHead(503, {
			"Content-Type": "application/json",
			"Cache-Control": "no-store"
		});
		res.end(JSON.stringify({ message: "No se pudo atender la API. Revisá la configuración del servidor." }));
	}
}
//#endregion
export { crearHandler, handler as default };
