const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Usuario = require("../models/usuario.model");

const router = express.Router();

router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body || {};

        if (!username || !password) {
            return res
                .status(400)
                .json({ message: "username y password son obligatorios" });
        }

        const user = await Usuario.findOne({ username: String(username).trim() });
        if (!user || !user.activo) {
            return res.status(401).json({ message: "Credenciales inválidas" });
        }

        const ok = await bcrypt.compare(String(password), user.passwordHash);
        if (!ok) {
            return res.status(401).json({ message: "Credenciales inválidas" });
        }

        const token = jwt.sign(
            { id: user._id.toString(), username: user.username, rol: user.rol },
            process.env.JWT_SECRET,
            { expiresIn: "12h" }
        );

        return res.json({
            token,
            user: {
                id: user._id.toString(),
                nombre: user.nombre,
                username: user.username,
                rol: user.rol,
            },
        });
    } catch (e) {
        return res.status(500).json({ message: "Error en login" });
    }
});

module.exports = router;
