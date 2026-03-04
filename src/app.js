const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require("path"); 
require('dotenv').config(); // lee .env desde /Backend/.env

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// MongoDB
const MONGO_URI =
  process.env.MONGO_URI; 

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB conectado correctamente'))
  .catch((err) => console.error(' Error conectando a MongoDB:', err));

// ============================
// RUTAS
// ============================
const buquesRoutes = require('./routes/buques.routes');
const authRoutes = require('./routes/auth.routes');
const usuariosRoutes = require('./routes/usuarios.routes');

app.use('/api/buques', buquesRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);

// Ruta base
app.get("/api", (req, res) => {
  res.json({ ok: true, message: "API de Buques funcionando" });
});


// FRONTEND (FLUTTER WEB)
app.use(express.static(path.join(__dirname, "../public")));

//  fallback SPA (Express 5 compatible)
app.get("/{*splat}", (req, res) => {
  // si es /api y no existe, NO devuelvas index.html
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ ok: false, message: "Ruta API no encontrada" });
  }

  res.sendFile(path.join(__dirname, "../public/index.html"));
});


// ======================================
// ✅ LOG DE ERRORES (para ver el 500 real)
// ======================================
process.on("unhandledRejection", (reason) => {
  console.error("unhandledRejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("uncaughtException:", err);
});

// Middleware final de errores (por si algún route hace next(err))
app.use((err, req, res, next) => {
  console.error(" ERROR MIDDLEWARE:", {
    message: err?.message,
    stack: err?.stack,
    url: req.originalUrl,
    method: req.method,
    body: req.body,
  });

  res.status(err?.status || 500).json({
    ok: false,
    message: err?.message || "Error interno del servidor",
  });
});


// Servidor
const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
