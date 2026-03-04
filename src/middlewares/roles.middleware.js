function allowRoles(...rolesPermitidos) {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ message: "No autorizado" });

        if (!rolesPermitidos.includes(req.user.rol)) {
            return res.status(403).json({ message: "Prohibido: rol sin permiso" });
        }

        return next();
    };
}

module.exports = allowRoles;
