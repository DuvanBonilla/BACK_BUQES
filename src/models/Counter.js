const mongoose = require("mongoose");

/**
 * =====================================================
 * COUNTER (AUTOINCREMENT)
 * =====================================================
 * Guarda secuencias por nombre.
 * Ej: { name: "buque", seq: 10 }
 */
const CounterSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, unique: true },
        seq: { type: Number, default: 0 },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Counter", CounterSchema);