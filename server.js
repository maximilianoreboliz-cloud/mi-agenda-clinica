const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const supabase = createClient("https://ywycizbmesdhtfaaxyxt.supabase.co", process.env.SUPABASE_KEY);

// LOGIN Y REGISTRO (Igual que antes)
app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    const { data, error } = await supabase.from("usuarios").select("*").eq("email", email).eq("password", password).single();
    if (error || !data || !data.activo) return res.status(401).json({ error: "No autorizado" });
    res.json({ success: true, usuario: data });
});

// PROFESIONALES
app.get("/profesionales", async (req, res) => {
    const { data } = await supabase.from("profesionales").select("*").order("nombre");
    res.json(data);
});

app.post("/profesional", async (req, res) => {
    const { nombre, especialidades } = req.body;
    await supabase.from("profesionales").insert({ nombre, especialidades, activo: true, color: "#e2e8f0" });
    res.json({ success: true });
});

app.patch("/profesional/:id", async (req, res) => {
    const { id } = req.params;
    const { nombre, especialidades } = req.body;
    await supabase.from("profesionales").update({ nombre, especialidades }).eq("id", id);
    res.json({ success: true });
});

app.patch("/profesional/:id/color", async (req, res) => {
    await supabase.from("profesionales").update({ color: req.body.color }).eq("id", req.params.id);
    res.json({ success: true });
});

app.delete("/profesional/:id", async (req, res) => {
    await supabase.from("profesionales").delete().eq("id", req.params.id);
    res.json({ success: true });
});

// LICENCIAS
app.post("/licencia", async (req, res) => {
    const { profesional_id, desde, hasta } = req.body;
    await supabase.from("ausencias").delete().eq("profesional_id", profesional_id);
    if(desde && hasta) await supabase.from("ausencias").insert({ profesional_id, fecha_desde: desde, fecha_hasta: hasta });
    res.json({ success: true });
});

// SECTORES Y AGENDA (Igual que antes)
app.get("/sectores", async (req, res) => {
    const { data } = await supabase.from("sectores").select("*").eq("activo", true);
    res.json(data);
});

app.get("/consultorios", async (req, res) => {
    const { data } = await supabase.from("consultorios").select("*").eq("sector", req.query.sector);
    res.json(data);
});

app.get("/agenda", async (req, res) => {
    const { data } = await supabase.from("agenda_base").select("*").eq("dia_semana", req.query.dia).eq("sector", req.query.sector);
    res.json(data);
});

app.post("/agenda", async (req, res) => {
    const { consultorio_id, profesional_id, horario, dia_semana, sector, especialidad } = req.body;
    if(!profesional_id) {
        await supabase.from("agenda_base").delete().eq("consultorio_id", consultorio_id).eq("horario", horario).eq("dia_semana", dia_semana).eq("sector", sector);
    } else {
        await supabase.from("agenda_base").upsert({ consultorio_id, profesional_id, horario, dia_semana, sector, especialidad });
    }
    res.json({ success: true });
});

app.listen(3000, () => console.log("Servidor en puerto 3000"));
