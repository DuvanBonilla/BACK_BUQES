require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Usuario = require("../models/usuario.model");

async function run() {
    await mongoose.connect("mongodb://127.0.0.1:27017/buquesdb");

    const username = "admin";
    const password = "123456";

    const exists = await Usuario.findOne({ username });
    if (exists) {
        console.log("✅ Admin ya existe:", username);
        process.exit(0);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await Usuario.create({
        nombre: "ADMIN",
        username,
        passwordHash,
        rol: "ADMIN",
        activo: true,
    });

    console.log("✅ Admin creado:", username, "password:", password);
    process.exit(0);
}

run().catch((e) => {
    console.error("❌ Error seed:", e);
    process.exit(1);
});
