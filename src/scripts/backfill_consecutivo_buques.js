require("dotenv").config();
const mongoose = require("mongoose");
const Buque = require("../models/Buque");
const Counter = require("../models/Counter");

async function run() {
    await mongoose.connect(process.env.MONGO_URI);

    // Tomamos el mayor consecutivo existente (si ya hay alguno)
    const maxDoc = await Buque.findOne({ consecutivo: { $ne: null } })
        .sort({ consecutivo: -1 })
        .lean();

    let seq = maxDoc?.consecutivo || 0;

    // Traemos buques sin consecutivo, en orden (puedes cambiar a createdAt si prefieres)
    const faltantes = await Buque.find({
        $or: [{ consecutivo: { $exists: false } }, { consecutivo: null }],
    }).sort({ etaEstimada: 1 });

    for (const b of faltantes) {
        seq += 1;
        b.consecutivo = seq;
        await b.save();
    }

    // Actualizamos el counter para que siga desde el último
    await Counter.findOneAndUpdate(
        { name: "buque" },
        { $set: { seq } },
        { upsert: true }
    );

    console.log(`✅ Backfill terminado. Asignados: ${faltantes.length}. Último consecutivo: ${seq}`);
    await mongoose.disconnect();
}

run().catch((e) => {
    console.error("❌ Error backfill:", e);
    process.exit(1);
});