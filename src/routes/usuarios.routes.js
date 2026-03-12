const express = require("express");
const bcrypt = require("bcryptjs");
const Usuario = require("../models/usuario.model");
const auth = require("../middlewares/auth.middleware");
const allowRoles = require("../middlewares/roles.middleware");

const router = express.Router();

// ✅ Solo ADMIN puede administrar usuarios
router.use(auth, allowRoles("ADMIN"));

router.get("/", async (req, res) => {
    const users = await Usuario.find({}, { passwordHash: 0 }).sort({
        createdAt: -1,
    });
    return res.json(users);
});

router.post("/", async (req, res) => {
    try {
        const { nombre, username, password, rol } = req.body || {};

        if (!nombre || !username || !password) {
            return res
                .status(400)
                .json({ message: "nombre, username y password son obligatorios" });
        }

        const rolesValidos = ["ADMIN", "OPERADOR"];
        if (rol != null && !rolesValidos.includes(rol)) {
            return res.status(400).json({ message: "Rol inválido" });
        }

        const exists = await Usuario.findOne({ username: String(username).trim() });
        if (exists) return res.status(409).json({ message: "Username ya existe" });

        const passwordHash = await bcrypt.hash(String(password), 10);

        const user = await Usuario.create({
            nombre: String(nombre).trim(),
            username: String(username).trim(),
            passwordHash,
            rol: rol || "OPERADOR",
            activo: true,
        });

        return res.status(201).json({
            id: user._id.toString(),
            nombre: user.nombre,
            username: user.username,
            rol: user.rol,
            activo: user.activo,
        });
    } catch (e) {
        console.error("❌ Error creando usuario:", e); // <-- clave
        return res.status(500).json({
            message: "Error creando usuario",
            detail: e?.message,
        });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, username, password, rol, activo } = req.body || {};

        const rolesValidos = ["ADMIN", "OPERADOR"];
        if (rol != null && !rolesValidos.includes(rol)) {
            return res.status(400).json({ message: "Rol inválido" });
        }

        const update = {};
        if (nombre != null) update.nombre = String(nombre).trim();

        //  si se quiere cambiar username, validar que no choque con otro
        if (username != null) {
            const newUsername = String(username).trim();
            const exists = await Usuario.findOne({
                username: newUsername,
                _id: { $ne: id },
            });
            if (exists) return res.status(409).json({ message: "Username ya existe" });

            update.username = newUsername;
        }

        if (rol != null) update.rol = rol;
        if (activo != null) update.activo = Boolean(activo);

        if (password != null && String(password).trim() !== "") {
            update.passwordHash = await bcrypt.hash(String(password), 10);
        }

        const user = await Usuario.findByIdAndUpdate(id, update, {
            new: true,
            runValidators: true,
        });
        if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

        return res.json({
            id: user._id.toString(),
            nombre: user.nombre,
            username: user.username,
            rol: user.rol,
            activo: user.activo,
        });
    } catch (e) {
        return res.status(500).json({ message: "Error actualizando usuario" });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const user = await Usuario.findByIdAndDelete(id);
        if (!user) return res.status(404).json({ message: "Usuario no encontrado" });
        return res.json({ message: "Usuario eliminado" });
    } catch (e) {
        return res.status(500).json({ message: "Error eliminando usuario" });
    }
});

module.exports = router;
