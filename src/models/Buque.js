/**
 * =====================================================
 * MODELO BUQUE (MongoDB - Mongoose)
 * =====================================================
 * Este archivo define la estructura de cómo se guardan
 * los buques en MongoDB.
 *
 * Piensa en el Schema como "la forma" del documento.
 * Si el controller intenta guardar un campo con un nombre
 * diferente, Mongoose no lo valida como esperas y puede
 * generar errores.
 */

const mongoose = require("mongoose");

/**
 * =====================================================
 * Schema: estructura del documento "Buque"
 * =====================================================
 */
const BuqueSchema = new mongoose.Schema(
  {
    /**
     * Nombre del buque
     * Obligatorio (siempre debe existir)
     */
    nombreBuque: {
      type: String,
      required: true,
      trim: true,
    },

    /**
 * Consecutivo único (autoincremental)
 * Se asigna al crear el buque y NO cambia nunca
 */
    consecutivo: {
      type: Number,
      unique: true,
      index: true,
    },

    /**
     * ETA estimada (Fecha y hora estimada de arribo)
     * Obligatoria porque el sistema se basa en esta fecha
     * para ubicarlo en la línea de tiempo.
     */
    etaEstimada: {
      type: Date,
      required: true,
    },

    etdEstimada: { type: Date, default: null },
    /**
 * Sucursal (para filtro en UI)
 */
    sucursal: {
      type: String,
      default: null,
      trim: true,
    },

    /**
     * Fecha inicio operación (REGla: SIEMPRE = etaEstimada)
     */
    fechaInicioOperacion: {
      type: Date,
      default: null,
    },

    /**
     * Total horas operación (se calcula al FINALIZAR)
     */
    totalHorasOperacion: {
      type: Number,
      default: null,
    },

    /**
     * Rendimiento = movimientos / totalHorasOperacion (se calcula al FINALIZAR)
     */
    rendimiento: {
      type: Number,
      default: null,
    },

    /**
     * Cantidad de movimientos (puede llegar después)
     * Por eso lo dejamos null por defecto.
     */
    movimientos: {
      type: Number,
      default: null,
    },

    /**
     * Código general de operación
     */
    codigoOperacion: {
      type: String,
      default: null,
      trim: true,
    },

    /**
     * Códigos individuales (pueden llegar después)
     */
    consecutivo: { type: Number, unique: true, index: true },
    codigoEstibador: { type: String, default: null, trim: true },
    codigoTarja: { type: String, default: null, trim: true },
    codigoEIR: { type: String, default: null, trim: true },
    codigoSST: { type: String, default: null, trim: true },
    codigoSupervisor: { type: String, default: null, trim: true },
    cantPersonas: { type: Number, default: null },

    /**
     * Estado del buque dentro del sistema
     */
    status: {
      type: String,
      enum: ["PENDIENTE", "EN_OPERACION", "FINALIZADO"],
      default: "PENDIENTE",
    },

    /**
     * Fecha real de finalización (cuando lo marcan como completado)
     */
    fechaFin: {
      type: Date,
      default: null,
    },

    /**
     * Observaciones opcionales
     */
    observaciones: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    /**
     * timestamps agrega automáticamente:
     * createdAt y updatedAt
     */
    timestamps: true,
  }
);

module.exports = mongoose.model("Buque", BuqueSchema);
