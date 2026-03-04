const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth.middleware");
const allowRoles = require("../middlewares/roles.middleware");

const {
  crearBuque,
  obtenerBuques,
  obtenerBuquePorId,
  obtenerBuquesActivos,
  actualizarBuque,
  finalizarBuque,
  eliminarBuque,
  exportBuquesExcel,// ✅ NUEVO (Excel)
  obtenerFinalizados,
} = require("../controllers/buques.controller");

// ✅ PUBLICO: cualquiera visualiza
router.get("/activos", obtenerBuquesActivos);

// ✅ PRIVADO: Export Excel por rango (ETA)
// IMPORTANTE: va ANTES de "/:id" para que no lo capture como id
router.get("/export/excel", auth, allowRoles("ADMIN", "OPERADOR"), exportBuquesExcel);
// ✅ Finalizados recientes (privado)
router.get("/finalizados", auth, allowRoles("ADMIN", "OPERADOR"), obtenerFinalizados);

// ✅ PRIVADO: solo ADMIN/OPERADOR
router.get("/", auth, allowRoles("ADMIN", "OPERADOR"), obtenerBuques);
router.get("/:id", auth, allowRoles("ADMIN", "OPERADOR"), obtenerBuquePorId);

router.post("/", auth, allowRoles("ADMIN", "OPERADOR"), crearBuque);
router.put("/:id", auth, allowRoles("ADMIN", "OPERADOR"), actualizarBuque);
router.put("/:id/finalizar", auth, allowRoles("ADMIN", "OPERADOR"), finalizarBuque);
router.delete("/:id", auth, allowRoles("ADMIN", "OPERADOR"), eliminarBuque);

module.exports = router;
