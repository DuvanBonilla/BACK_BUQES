const jwt = require("jsonwebtoken");

function auth(req, res, next) {
    try {
        const header = req.headers.authorization || "";
        const token = header.startsWith("Bearer ") ? header.substring(7) : null;

        if (!token) {
            return res.status(401).json({ message: "No autorizado: falta token" });
        }

        const payload = jwt.verify(token, process.env.JWT_SECRET);

        req.user = {
            id: payload.id,
            username: payload.username,
            rol: payload.rol,
        };

        return next();
    } catch (e) {
        return res.status(401).json({ message: "No autorizado: token inválido" });
    }
}

module.exports = auth;
