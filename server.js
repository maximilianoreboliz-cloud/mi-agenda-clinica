const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const cors = require("cors");
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const supabaseUrl = "https://ywycizbmesdhtfaaxyxt.supabase.co";
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

/* --- AUTENTICACIÓN --- */
app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    const { data, error } = await supabase.from("usuarios").select("*").eq("email", email).eq("password", password).single();
    if (error || !data) return res.status(401).json({ error: "Credenciales incorrectas." });
    if (!data.activo) return res.status(403).json({ error: "Cuenta pendiente de aprobación." });
    res.json({ success: true, usuario: data });
});

/* --- SECTORES Y CONSULTORIOS --- */
app.get("/sectores", async (req, res) => {
    const { data } = await supabase.from("sectores").select("*").eq("activo", true).order("nombre");
    res.json(data || []);
});

app.get("/consultorios", async (req, res) => {
    const { sector } = req.query;
    const { data } = await supabase.from("consultorios").select("*").eq("sector", sector).order("numero");
    res.json(data || []);
});

/* --- PROFESIONALES --- */
app.get("/profesionales", async (req, res) => {
    const { data } = await supabase.from("profesionales").select("*").order("nombre");
    res.json(data || []);
});

app.post("/profesional", async (req, res) => {
    const { error } = await supabase.from("profesionales").insert([req.body]);
    res.json({ success: !error });
});

app.delete("/profesional/:id", async (req, res) => {
    const { error } = await supabase.from("profesionales").delete().eq("id", req.params.id);
    res.json({ success: !error });
});

/* --- AGENDA BASE (Semanal) --- */
app.get("/agenda", async (req, res) => {
    const { dia, sector } = req.query;
    const { data } = await supabase.from("agenda_base").select("*").eq("dia_semana", dia).eq("sector", sector);
    res.json(data || []);
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

/* --- LICENCIAS (Para el visor) --- */
app.get("/ausencias", async (req, res) => {
    const { fecha } = req.query;
    const { data } = await supabase.from("ausencias").select("profesional_id").lte("fecha_desde", fecha).gte("fecha_hasta", fecha);
    res.json(data || []);
});

/* --- ADMINISTRACIÓN DE USUARIOS --- */
app.get("/usuarios/admin", async (req, res) => {
    const { data } = await supabase.from("usuarios").select("*").order("email");
    res.json(data || []);
});

app.patch("/usuarios/aprobar/:id", async (req, res) => {
    const { error } = await supabase.from("usuarios").update({ activo: true }).eq("id", req.params.id);
    res.json({ success: !error });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));
