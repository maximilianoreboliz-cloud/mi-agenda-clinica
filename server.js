const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const supabase = createClient("https://ywycizbmesdhtfaaxyxt.supabase.co", process.env.SUPABASE_KEY);

// AUTH
app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    const { data, error } = await supabase.from("usuarios").select("*").eq("email", email).eq("password", password).single();
    if (error || !data || !data.activo) return res.status(401).json({ error: "No autorizado" });
    res.json({ success: true, usuario: data });
});

// PROFESIONALES
app.get("/profesionales", async (req, res) => {
    const { data } = await supabase.from("profesionales").select("*").order("nombre");
    res.json(data || []);
});

app.post("/profesional", async (req, res) => {
    await supabase.from("profesionales").insert({ ...req.body, activo: true, color: "#e2e8f0" });
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
app.get("/ausencias", async (req, res) => {
    const { data } = await supabase.from("ausencias").select("*");
    res.json(data || []);
});

app.post("/licencia", async (req, res) => {
    const { profesional_id, desde, hasta } = req.body;
    await supabase.from("ausencias").delete().eq("profesional_id", profesional_id);
    if(desde && hasta) {
        await supabase.from("ausencias").insert({ profesional_id, fecha_desde: desde, fecha_hasta: hasta });
    }
    res.json({ success: true });
});

// AGENDA (Aquí está el filtrado crítico)
app.get("/agenda", async (req, res) => {
    const { dia, sector, fechaCompleta } = req.query;

    // 1. Buscamos la agenda semanal
    const { data: agenda } = await supabase.from("agenda_base")
        .select("*").eq("dia_semana", dia).eq("sector", sector);

    // 2. Buscamos quiénes están de licencia hoy
    const { data: ausentes } = await supabase.from("ausencias")
        .select("profesional_id")
        .lte("fecha_desde", fechaCompleta)
        .gte("fecha_hasta", fechaCompleta);

    const idsAusentes = ausentes ? ausentes.map(a => a.profesional_id) : [];

    // 3. Filtramos: Si el médico está ausente hoy, no lo enviamos
    const agendaFinal = agenda ? agenda.filter(item => !idsAusentes.includes(item.profesional_id)) : [];
    
    res.json(agendaFinal);
});

app.post("/agenda", async (req, res) => {
    const { consultorio_id, profesional_id, horario, dia_semana, sector } = req.body;
    if(!profesional_id) {
        await supabase.from("agenda_base").delete().eq("consultorio_id", consultorio_id).eq("horario", horario).eq("dia_semana", dia_semana).eq("sector", sector);
    } else {
        await supabase.from("agenda_base").upsert({ consultorio_id, profesional_id, horario, dia_semana, sector });
    }
    res.json({ success: true });
});

app.get("/sectores", async (req, res) => {
    const { data } = await supabase.from("sectores").select("*").eq("activo", true);
    res.json(data || []);
});

app.get("/consultorios", async (req, res) => {
    const { data } = await supabase.from("consultorios").select("*").eq("sector", req.query.sector);
    res.json(data || []);
});

app.listen(3000, () => console.log("Servidor listo"));
