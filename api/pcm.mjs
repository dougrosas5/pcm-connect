// Generado por scripts/build-api.mjs. Editar server/pcm.ts, src/types/pcm.ts y src/features/planificacion/model; ejecutar npm run build.
//#region src/features/planificacion/model/modelo.ts
function finParada(plan) {
	const fecha = Date.parse(plan.eta) + Number(plan.horasParada) * 36e5;
	return plan.eta && positivo(plan.horasParada) && Number.isFinite(fecha) && Math.abs(fecha) <= 864e13 ? new Date(fecha).toISOString() : "";
}
function etaValida(eta) {
	const tiempo = Date.parse(eta);
	return Number.isFinite(tiempo) && new Date(tiempo).toISOString() === eta;
}
function positivo(valor) {
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
	if (!positivo(plan.horasParada) || !finParada(plan)) errores.push("Tiempo de parada: ingresá una duración positiva válida.");
	if (!plan.filas.length) errores.push("Agregá al menos una TAREA o PM.");
	for (const fila of plan.filas) {
		if (!positivo(fila.tiempoPropuesto)) errores.push(`${fila.id}: el tiempo individual debe ser positivo.`);
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
//#region src/features/planificacion/model/comandos.ts
function aplicarComando(actual, comando, actor, solicitud, fecha) {
	if (actual.solicitudes[solicitud] !== void 0) return actual;
	const siguiente = structuredClone(actual);
	const pcm = actor.rol === "Planificador" || actor.rol === "Administrador";
	function auditar(entidad, anterior, nuevo) {
		siguiente.historial.push({
			fecha,
			usuario: actor.nombre,
			accion: comando.tipo,
			entidad,
			anterior,
			nuevo
		});
	}
	if (comando.tipo === "guardar") {
		if (!pcm) throw new Error("Solo Planificador o Administrador puede guardar o enviar.");
		const anterior = actual.planes.find((p) => p.id === comando.plan.id);
		if (anterior && anterior.planificadorId !== actor.id && actor.rol !== "Administrador") throw new Error("La planificación pertenece a otro planificador.");
		if (anterior && (anterior.estado !== "Borrador" || anterior.version !== comando.plan.version)) throw new Error("La planificación cambió o ya fue enviada. Volvé a abrirla.");
		const plan = structuredClone(comando.plan);
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
			const conflicto = actual.planes.find((p) => p.id !== plan.id && p.filas.some((f) => f.id === fila.id || f.ordenes.some((om) => oms.has(om.numero) || fila.ordenes.some((o) => o.numero === om.numero))));
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
			anterior: plan.eta,
			nuevo: comando.eta,
			comentario: comando.comentario.trim(),
			revisionDisponibilidad: "pendiente"
		});
		plan.eta = comando.eta;
		plan.actualizado = fecha;
		plan.version++;
		auditar(plan.tag, anterior, plan);
	} else if (comando.tipo === "catalogo") {
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
		if (actor.rol !== "Taller" && actor.rol !== "Administrador") throw new Error("Solo Taller puede evaluar.");
		const plan = siguiente.planes.find((p) => p.id === comando.planId);
		if (!plan || !["Enviado a Taller", "En evaluación"].includes(plan.estado)) throw new Error("La planificación no está disponible para evaluación.");
		const anterior = structuredClone(plan);
		if (comando.tipo === "evaluar") {
			const fila = plan.filas.find((f) => f.id === comando.tareaId);
			if (!fila || plan.referencias[fila.responsableId]?.externo) throw new Error("La tarea no requiere evaluación de Taller interno.");
			if (!["Aceptada", "Rechazada"].includes(comando.resultado) || comando.resultado === "Rechazada" && !comando.motivo.trim()) throw new Error("El rechazo requiere un motivo.");
			plan.evaluaciones[fila.id] = {
				resultado: comando.resultado,
				motivo: comando.motivo.trim(),
				usuario: actor.nombre,
				fecha
			};
			plan.estado = "En evaluación";
		} else {
			if (plan.filas.some((f) => !plan.referencias[f.responsableId]?.externo && !Object.hasOwn(plan.evaluaciones, f.id))) throw new Error("Hay tareas internas pendientes de evaluación.");
			plan.estado = "Evaluado";
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
	} else if (valor.tipo === "finalizar") {
		if (!texto(valor.planId, 80)) throw new Error("Planificación inválida.");
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
