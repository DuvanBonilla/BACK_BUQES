// Importamos el modelo Buque (MongoDB)
const Buque = require('../models/Buque');

const Counter = require("../models/Counter");

// ✅ ExcelJS para exportar .xlsx
const ExcelJS = require("exceljs");

/**
 * =====================================================
 * FUNCIONES AUXILIARES (NO TOCAN LA BD)
 * =====================================================
 */

/**
 * Formatea tiempo restante a texto amigable
 */
function formatearTiempo(ms) {
  if (ms <= 0) return "0m";

  const totalMin = Math.floor(ms / (1000 * 60));
  const dias = Math.floor(totalMin / (60 * 24));
  const horas = Math.floor((totalMin % (60 * 24)) / 60);
  const minutos = totalMin % 60;

  if (dias > 0) return `${dias}d ${horas}h`;
  if (horas > 0) return `${horas}h ${minutos}m`;
  return `${minutos}m`;
}

/**
 * Calcula la franja del timeline
 */
function calcularFranja(horasRestantes) {
  if (horasRestantes > 48) return "MAS_2_DIAS";
  if (horasRestantes > 36) return "DIA_Y_MEDIO";
  if (horasRestantes > 24) return "24H";
  if (horasRestantes > 12) return "12H";
  if (horasRestantes > 6) return "6H";
  if (horasRestantes > 2) return "2H";
  return "OPERACION";
}

/**
 * =========================================================
 * POSICIÓN CONTINUA EN TIMELINE (0..100)
 * =========================================================
 * Esto permite que la tarjeta se mueva suavemente
 * entre franjas, como la manecilla de un reloj.
 */
function calcularPosicionTimeline(horasRestantes) {

  // Si ya llegó o está en hora
  if (horasRestantes <= 0) return 100;

  const puntos = [
    { h: 48, pos: 0 },   // inicio timeline
    { h: 24, pos: 25 },
    { h: 12, pos: 50 },
    { h: 6, pos: 70 },
    { h: 2, pos: 85 },
    { h: 0, pos: 100 }  // operación
  ];

  if (horasRestantes >= 48) return 0;

  for (let i = 0; i < puntos.length - 1; i++) {

    const a = puntos[i];
    const b = puntos[i + 1];

    if (horasRestantes <= a.h && horasRestantes >= b.h) {

      const rangoHoras = a.h - b.h;
      const rangoPos = b.pos - a.pos;

      if (rangoHoras === 0) return b.pos;

      const avance = (a.h - horasRestantes) / rangoHoras;

      const pos = a.pos + avance * rangoPos;

      return Math.round(pos * 100) / 100;
    }
  }

  return 0;
}

/**
 * =========================================================
 * FUNCIÓN AUXILIAR: CALCULAR "COLOR" DE LA TARJETA
 * =========================================================
 * NUEVAS REGLAS (sin codigoOperacion):
 * - ROJO: no hay NINGUNO de los códigos llenos
 * - NARANJA: hay algunos códigos llenos, pero faltan otros
 * - VERDE: están TODOS los códigos llenos
 *
 * Códigos que sí importan:
 * - codigoEstibador
 * - codigoTarja
 * - codigoEIR
 * - codigoSST
 * - codigoSupervisor
 */
function calcularColorBuque(buque) {

  // ✅ Lista de códigos que SÍ cuentan (sin codigoOperacion)
  const codigos = [
    buque.codigoEstibador,
    buque.codigoTarja,
    buque.codigoEIR,
    buque.codigoSST,
    buque.codigoSupervisor
  ];

  const total = codigos.length;

  // ✅ Contamos cuántos están realmente llenos
  // - null / undefined -> vacío
  // - "" (string vacía) -> vacío
  const llenos = codigos.filter(v => v !== null && v !== undefined && String(v).trim() !== '').length;

  // 🔴 ROJO: ninguno diligenciado
  if (llenos === 0) return 'ROJO';

  // 🟢 VERDE: todos diligenciados
  if (llenos === total) return 'VERDE';

  // 🟠 NARANJA: algunos sí, otros no
  return 'NARANJA';
}

/**
 * =========================================================
 * CREAR BUQUE
 * POST /api/buques
 * =========================================================
 */
/**
 * =========================================================
 * CREAR BUQUE (con consecutivo autoincremental)
 * POST /api/buques
 * =========================================================
 */
const crearBuque = async (req, res) => {
  try {

      const cleanStr = (v) => {
      if (v === undefined || v === null) return null;
      const s = String(v).trim();
      return s === "" ? null : s;
    };

    const toNumberOrNull = (v) => {
      if (v === undefined || v === null || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    // ✅ VALIDACIÓN ETA vs ETD (estimadas)
    if (req.body.etdEstimada && req.body.etaEstimada) {
      const eta = new Date(req.body.etaEstimada);
      const etd = new Date(req.body.etdEstimada);

      if (Number.isNaN(eta.getTime()) || Number.isNaN(etd.getTime())) {
        return res.status(400).json({ message: "ETA/ETD estimada inválida." });
      }

      if (etd < eta) {
        return res.status(400).json({
          message: "ETD estimada no puede ser menor que ETA.",
        });
      }
    }
    // ✅ Agregamos sucursal
    const {
      nombreBuque,
      etaEstimada,
      etdEstimada,
      movimientos,
      cantPersonas,
      sucursal,
      observaciones,
      codigoEstibador,
      codigoTarja,
      codigoEIR,
      codigoSST,
      codigoSupervisor
     } = req.body;

    // ✅ Consecutivo atómico (no se repite aunque creen 2 buques al mismo tiempo)
    const counter = await Counter.findOneAndUpdate(
      { name: "buque" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    const nuevoBuque = new Buque({
      consecutivo: counter.seq,
      nombreBuque: cleanStr(nombreBuque),
      etaEstimada,
      etdEstimada: etdEstimada ?? null,
      
      movimientos: toNumberOrNull(movimientos),
      cantPersonas: toNumberOrNull(cantPersonas),

      // ✅ regla: inicio operación = etaEstimada
      fechaInicioOperacion: etaEstimada,

      // ✅ nuevo campo sucursal
      sucursal: sucursal && String(sucursal).trim() !== ""
        ? String(sucursal).trim()
        : null,
      
      observaciones: cleanStr(observaciones),
      codigoEstibador: cleanStr(codigoEstibador),
      codigoTarja: cleanStr(codigoTarja),
      codigoEIR: cleanStr(codigoEIR),
      codigoSST: cleanStr(codigoSST),
      codigoSupervisor: cleanStr(codigoSupervisor),
    });


    const buqueGuardado = await nuevoBuque.save();

    return res.status(201).json({
      mensaje: "✅ Buque creado correctamente",
      buque: {
        ...buqueGuardado.toObject(),
        color: calcularColorBuque(buqueGuardado),
      },
    });
  } catch (error) {
    console.error("ERROR crearBuque:", error);

    // Si por alguna razón chocara el unique (muy raro con counter),
    // devolvemos mensaje claro
    if (error?.code === 11000) {
      return res.status(409).json({
        mensaje: "❌ Conflicto: consecutivo duplicado, intenta de nuevo.",
      });
    }

    return res.status(500).json({ mensaje: "Error al crear el buque" });
  }
};

/**
 * =========================================================
 * OBTENER TODOS
 * GET /api/buques
 * =========================================================
 */
const obtenerBuques = async (req, res) => {
  try {

    // 1️⃣ Traemos los buques
    const buques = await Buque.find().sort({ etaEstimada: 1 });

    // =========================================================
    // ACTUALIZAR AUTOMÁTICAMENTE EL STATUS A EN_OPERACION
    // =========================================================
    const ahora = new Date();

    // 1) Si el buque NO está finalizado y su ETA quedó a futuro => vuelve a PENDIENTE
    await Buque.updateMany(
      {
        status: { $ne: "FINALIZADO" },
        etaEstimada: { $gt: ahora },
      },
      { $set: { status: "PENDIENTE" } }
    );

    // 2) Si el buque NO está finalizado y su ETA ya llegó/pasó => EN_OPERACION
    await Buque.updateMany(
      {
        status: { $ne: "FINALIZADO" },
        etaEstimada: { $lte: ahora },
      },
      { $set: { status: "EN_OPERACION" } }
    );

    // 2️⃣ Volvemos a consultar ya actualizados
    const buquesActualizados = await Buque.find().sort({ etaEstimada: 1 });

    // 3️⃣ Calculamos extras para timeline
    const ahora2 = new Date();

    const buquesConExtras = buquesActualizados.map(b => {

      const eta = new Date(b.etaEstimada);

      const msRestantes = eta.getTime() - ahora2.getTime();
      const horasRestantes = msRestantes / (1000 * 60 * 60);

      return {
        ...b.toObject(),

        // color automático
        color: calcularColorBuque(b),

        // datos timeline
        tiempoRestante: formatearTiempo(msRestantes),
        horasRestantes: Math.round(horasRestantes * 100) / 100,
        franja: calcularFranja(horasRestantes),
        posicionTimeline: calcularPosicionTimeline(horasRestantes)
      };
    });

    res.json(buquesConExtras);

  } catch (error) {
    console.error('ERROR obtenerBuques:', error);
    res.status(500).json({ mensaje: 'Error al obtener los buques' });
  }
};

/**
 * =========================================================
 * OBTENER SOLO ACTIVOS (NO FINALIZADOS)
 * GET /api/buques/activos
 * =========================================================
 * Devuelve SOLO buques:
 *  - PENDIENTE
 *  - EN_OPERACION
 *
 * Además agrega:
 *  - color
 *  - tiempoRestante
 *  - horasRestantes
 *  - franja
 *  - posicionTimeline
 */
const obtenerBuquesActivos = async (req, res) => {
  try {
    // 1) Actualizamos automáticamente a EN_OPERACION los que ya pasaron la ETA
    const ahora = new Date();

    await Buque.updateMany(
      {
        status: { $ne: "FINALIZADO" },
        etaEstimada: { $gt: ahora },
      },
      { $set: { status: "PENDIENTE" } }
    );

    // 2) Si el buque NO está finalizado y su ETA ya llegó/pasó => EN_OPERACION
    await Buque.updateMany(
      {
        status: { $ne: "FINALIZADO" },
        etaEstimada: { $lte: ahora },
      },
      { $set: { status: "EN_OPERACION" } }
    );

    // 2) Buscamos SOLO activos (excluye FINALIZADO)
    // ✅ Filtro opcional por sucursal
    const { sucursal } = req.query;

    const filtro = { status: { $ne: "FINALIZADO" } };

    if (sucursal && String(sucursal).trim() !== "") {
      filtro.sucursal = String(sucursal).trim();
    }

    const buques = await Buque.find(filtro).sort({ etaEstimada: 1 });

    // 3) Calculamos extras para timeline
    const buquesConExtras = buques.map(b => {
      const eta = new Date(b.etaEstimada);

      const msRestantes = eta.getTime() - ahora.getTime();
      const horasRestantes = msRestantes / (1000 * 60 * 60);

      return {
        ...b.toObject(),
        color: calcularColorBuque(b),
        tiempoRestante: formatearTiempo(msRestantes),
        horasRestantes: Math.round(horasRestantes * 100) / 100,
        franja: calcularFranja(horasRestantes),
        posicionTimeline: calcularPosicionTimeline(horasRestantes)
      };
    });

    return res.json(buquesConExtras);

  } catch (error) {
    console.error("ERROR obtenerBuquesActivos:", error);
    return res.status(500).json({ mensaje: "Error al obtener buques activos" });
  }
};

/**
 * =========================================================
 * OBTENER POR ID
 * GET /api/buques/:id
 * =========================================================
 */
const obtenerBuquePorId = async (req, res) => {
  try {
    const buque = await Buque.findById(req.params.id);

    if (!buque) return res.status(404).json({ mensaje: 'Buque no encontrado' });

    res.json({
      ...buque.toObject(),
      color: calcularColorBuque(buque)
    });
  } catch (error) {
    console.error('ERROR obtenerBuquePorId:', error);
    res.status(500).json({ mensaje: 'Error al buscar el buque' });
  }
};

/**
 * =========================================================
 * ACTUALIZAR BUQUE (códigos, eta, movimientos, observaciones...)
 * PUT /api/buques/:id
 * =========================================================
 */
const actualizarBuque = async (req, res) => {
  try {
    // ✅ VALIDACIÓN ETA vs ETD en UPDATE
    if (req.body.etdEstimada) {
      const buqueActual = await Buque.findById(req.params.id);
      if (!buqueActual) {
        return res.status(404).json({ message: "Buque no encontrado." });
      }

      const etaRef = req.body.etaEstimada
        ? new Date(req.body.etaEstimada)
        : new Date(buqueActual.etaEstimada);

      const etd = new Date(req.body.etdEstimada);

      if (Number.isNaN(etaRef.getTime()) || Number.isNaN(etd.getTime())) {
        return res.status(400).json({ message: "ETA/ETD estimada inválida." });
      }

      if (etd < etaRef) {
        return res.status(400).json({
          message: "ETD estimada no puede ser menor que ETA.",
        });
      }
    }

    // ✅ Copiamos el body para poder limpiar campos que NO queremos usar
    const data = { ...req.body };

    // 🚫 Ignoramos codigoOperacion si llega por error
    delete data.codigoOperacion;

    const buqueActualizado = await Buque.findByIdAndUpdate(
      req.params.id,
      data,
      { new: true }
    );

    if (!buqueActualizado) return res.status(404).json({ mensaje: 'Buque no encontrado' });

    // ✅ Forzar status inmediato por regla ETA
    if (buqueActualizado.status !== "FINALIZADO") {
      const ahora = new Date();
      const eta = new Date(buqueActualizado.etaEstimada);

      const nuevoStatus = (eta <= ahora) ? "EN_OPERACION" : "PENDIENTE";

      if (nuevoStatus !== buqueActualizado.status) {
        buqueActualizado.status = nuevoStatus;
        await buqueActualizado.save();
      }
    }

    if (!buqueActualizado) return res.status(404).json({ mensaje: 'Buque no encontrado' });

    res.json({
      mensaje: '✅ Buque actualizado correctamente',
      buque: {
        ...buqueActualizado.toObject(),
        color: calcularColorBuque(buqueActualizado)
      }
    });
  } catch (error) {
    console.error('ERROR actualizarBuque:', error);
    res.status(500).json({ mensaje: 'Error al actualizar el buque' });
  }
};

/**
 * =========================================================
 * FINALIZAR BUQUE (SOLO SI YA ESTÁ EN OPERACIÓN)
 * PUT /api/buques/:id/finalizar
 * =========================================================
 *
 * Reglas:
 * 1) Se busca por ID (req.params.id)
 * 2) SOLO se puede finalizar si el buque está en "EN_OPERACION"
 * 3) fechaFin es obligatoria (manual)
 */
const finalizarBuque = async (req, res) => {
  try {
    const { id } = req.params;

    // 1) Buscar el buque por ID
    const buque = await Buque.findById(id);

    if (!buque) {
      return res.status(404).json({ mensaje: '❌ Buque no encontrado' });
    }

    // 2) Validación: solo finaliza si está EN_OPERACION
    if (buque.status !== 'EN_OPERACION') {
      return res.status(400).json({
        mensaje: '❌ No se puede finalizar: el buque aún no está en operación',
        statusActual: buque.status,
      });
    }

    // 3) Fecha fin (manual obligatoria según tu regla)
    const { fechaFin } = req.body;

    if (!fechaFin) {
      return res.status(400).json({
        mensaje: '❌ Debes enviar fechaFin para finalizar (manual)',
      });
    }

    const fechaFinal = new Date(fechaFin);

    // Validación simple: fecha válida
    if (isNaN(fechaFinal.getTime())) {
      return res.status(400).json({
        mensaje: '❌ fechaFin inválida (formato incorrecto)',
        fechaFinRecibida: fechaFin,
      });
    }

    // 4) Actualizar y guardar
    buque.status = 'FINALIZADO';
    buque.fechaFin = fechaFinal;

    // ✅ fechaInicioOperacion por regla = etaEstimada
    const inicioOp = buque.fechaInicioOperacion || buque.etaEstimada;

    // ✅ Calculamos total horas operación
    let totalHorasOperacion = null;
    let rendimiento = null;

    if (inicioOp && fechaFinal && fechaFinal >= inicioOp) {
      const diffMs = fechaFinal.getTime() - new Date(inicioOp).getTime();
      const horas = diffMs / (1000 * 60 * 60);

      totalHorasOperacion = Number(horas.toFixed(2));

      // rendimiento = movimientos / horas
      if (typeof buque.movimientos === "number" && buque.movimientos > 0 && totalHorasOperacion > 0) {
        rendimiento = Number((buque.movimientos / totalHorasOperacion).toFixed(2));
      }
    }

    // ✅ Persistimos en DB
    buque.totalHorasOperacion = totalHorasOperacion;
    buque.rendimiento = rendimiento;

    const buqueFinalizado = await buque.save();

    return res.json({
      mensaje: '✅ Buque finalizado correctamente',
      buque: buqueFinalizado,
    });
  } catch (error) {
    console.error('ERROR finalizarBuque:', error);
    return res.status(500).json({ mensaje: 'Error al finalizar el buque' });
  }
};

/**
 * =========================================================
 * ELIMINAR BUQUE
 * DELETE /api/buques/:id
 * =========================================================
 */
const eliminarBuque = async (req, res) => {
  try {
    const { id } = req.params;

    // 1) Intentamos eliminar por ID
    const buqueEliminado = await Buque.findByIdAndDelete(id);

    // 2) Si no existe, respondemos 404
    if (!buqueEliminado) {
      return res.status(404).json({ mensaje: '❌ Buque no encontrado' });
    }

    // 3) Confirmación
    return res.json({
      mensaje: '✅ Buque eliminado correctamente',
      buque: buqueEliminado
    });

  } catch (error) {
    console.error('ERROR eliminarBuque:', error);
    return res.status(500).json({ mensaje: 'Error al eliminar el buque' });
  }
};

/**
 * =====================================================
 * EXPORTAR BUQUES A EXCEL POR RANGO (ETA)
 * =====================================================
 * GET /api/buques/export/excel?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Reglas del Excel:
 * - Inicio = etaEstimada
 * - Fin = fechaFin
 * - Total horas = diferencia entre fin e inicio (horas decimales)
 * - Rendimiento = movimientos / totalHoras
 * - ID (Consecutivo) = 1..N (consecutivo en el archivo)
 * 
 
/**
 * =========================================================
 * OBTENER FINALIZADOS RECIENTES
 * GET /api/buques/finalizados?limit=7
 * =========================================================
 */
const obtenerFinalizados = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || "7", 10), 50);

    const buques = await Buque.find({ status: "FINALIZADO" })
      .sort({ fechaFin: -1 })
      .limit(limit);

    // (Opcional) agregar color por consistencia UI
    const data = buques.map(b => ({
      ...b.toObject(),
      color: calcularColorBuque(b),
    }));

    return res.json(data);
  } catch (error) {
    console.error("ERROR obtenerFinalizados:", error);
    return res.status(500).json({ mensaje: "Error al obtener finalizados" });
  }
};

const exportBuquesExcel = async (req, res) => {
  try {
    const { from, to } = req.query;

    // ✅ Validación
    if (!from || !to) {
      return res.status(400).json({
        ok: false,
        msg: "Debes enviar ?from=YYYY-MM-DD&to=YYYY-MM-DD",
      });
    }

    // ✅ Rango completo del día (UTC para evitar líos)
    const fromDate = new Date(`${from}T00:00:00.000Z`);
    const toDate = new Date(`${to}T23:59:59.999Z`);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return res.status(400).json({
        ok: false,
        msg: "Formato inválido. Usa YYYY-MM-DD en from y to.",
      });
    }

    if (fromDate > toDate) {
      return res.status(400).json({
        ok: false,
        msg: "El rango es inválido: from no puede ser mayor que to.",
      });
    }

    // ✅ Consulta por etaEstimada
    const buques = await Buque.find({
      etaEstimada: { $gte: fromDate, $lte: toDate },
    })
      .sort({ etaEstimada: 1 })
      .lean();

    // ✅ Crear Excel
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Buques");

    // ✅ Encabezados EXACTOS
    sheet.columns = [
      { header: "ID (Consecutivo)", key: "consecutivo", width: 16 },
      { header: "Fecha y hora de inicio", key: "inicio", width: 24 },
      { header: "Fecha y Hora finalización", key: "fin", width: 26 },
      { header: "Nombre Buque", key: "nombre", width: 28 },
      { header: "Total Horas Operacion", key: "horas", width: 20 },
      { header: "Cantidad", key: "cantidad", width: 12 },
      { header: "Codigo Estibador", key: "estibador", width: 16 },
      { header: "Codigo Tarjador", key: "tarja", width: 16 },
      { header: "Codigo EIR", key: "eir", width: 14 },
      { header: "Codigo Supervisor", key: "supervisor", width: 18 },
      { header: "Rendimiento", key: "rendimiento", width: 14 },
    ];
    // ✅ Formato Excel para fechas (col 2 y 3)
    sheet.getColumn(2).numFmt = "dd/mm/yyyy hh:mm";
    sheet.getColumn(3).numFmt = "dd/mm/yyyy hh:mm";

    // ✅ Header bonito
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }];

    // Helpers
    const fmtDateTime = (d) => {
      if (!d) return "";
      const date = new Date(d);

      // formato: YYYY-MM-DD HH:mm (UTC)
      const yyyy = date.getUTCFullYear();
      const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(date.getUTCDate()).padStart(2, "0");
      const hh = String(date.getUTCHours()).padStart(2, "0");
      const mi = String(date.getUTCMinutes()).padStart(2, "0");

      return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
    };

    const toNumberOrBlank = (v) => (v === null || v === undefined ? "" : v);

    // ✅ Rows
    buques.forEach((b, idx) => {
      const inicio = b.etaEstimada ? new Date(b.etaEstimada) : null;
      const fin = b.fechaFin ? new Date(b.fechaFin) : null;

      let totalHoras = "";
      let rendimiento = "";

      if (
        inicio &&
        fin &&
        !isNaN(inicio.getTime()) &&
        !isNaN(fin.getTime()) &&
        fin >= inicio
      ) {
        const diffMs = fin.getTime() - inicio.getTime();
        const horas = diffMs / (1000 * 60 * 60);

        totalHoras = Number(horas.toFixed(2));

        const mvt = b.movimientos;
        if (typeof mvt === "number" && mvt > 0 && totalHoras > 0) {
          rendimiento = Number((mvt / totalHoras).toFixed(2));
        }
      }

      sheet.addRow({
        consecutivo: b.consecutivo ?? "",
        inicio: inicio ? new Date(inicio) : null,
        fin: fin ? new Date(fin) : null,
        nombre: b.nombreBuque || "",
        horas: totalHoras,
        cantidad: toNumberOrBlank(b.movimientos),
        estibador: b.codigoEstibador || "",
        tarja: b.codigoTarja || "",
        eir: b.codigoEIR || "",
        supervisor: b.codigoSupervisor || "",
        rendimiento,
      });
    });

    // Formatos numéricos
    sheet.getColumn(5).numFmt = "0.00";  // Total horas
    sheet.getColumn(6).numFmt = "0";     // Cantidad
    sheet.getColumn(11).numFmt = "0.00"; // Rendimiento

    // ✅ Descargar
    const fileName = `buques_${from}_a_${to}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("ERROR exportBuquesExcel:", error);
    return res.status(500).json({ ok: false, msg: "Error generando el Excel." });
  }
};

/**
 * =====================================================
 * EXPORTS (SOLO UNO)
 * =====================================================
 */
module.exports = {
  crearBuque,
  obtenerBuques,
  obtenerBuquesActivos,
  obtenerBuquePorId,
  actualizarBuque,
  finalizarBuque,
  eliminarBuque, // 👈 MUY IMPORTANTE
  exportBuquesExcel, // ✅ NUEVO
  obtenerFinalizados,
};
