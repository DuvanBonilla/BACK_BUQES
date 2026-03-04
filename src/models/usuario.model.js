const mongoose = require("mongoose");

const UsuarioSchema = new mongoose.Schema(
    {
        nombre: { type: String, required: true, trim: true },
        username: { type: String, required: true, unique: true, trim: true },
        passwordHash: { type: String, required: true },

        rol: {
            type: String,
            enum: ["ADMIN", "OPERADOR"],
            default: "OPERADOR",
            required: true,
        },

        activo: { type: Boolean, default: true },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Usuario", UsuarioSchema);
