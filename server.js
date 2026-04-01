const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const supabaseUrl = "https://ywycizbmesdhtfaaxyxt.supabase.co";
const supabaseKey = process.env.SUPABASE_KEY; 
const supabase = createClient(supabaseUrl, supabaseKey);

/* --- USUARIOS Y LOGIN --- */
app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    const { data, error } = await supabase.from("usuarios").select("*").eq("email", email).eq("password", password).single();
    if (error || !data) return res.status(401).json({ error: "Credenciales incorrectas." });
    if (!data.activo) return res.status(403).json({ error: "Tu cuenta está pendiente de aprobación." });
    res.json({ success: true, usuario: { email: data.email, es_admin: data.es_admin } });
});

app.post("/registro", async (req, res) => {
    const { email, password } = req.body;
    const { error } = await supabase.from("usuarios").insert({ email, password, activo: false, es_admin: false });
    if (error) return res.status(500).json(error);
    res.json({ success: true });
});

/* --- PANEL DE ADMINISTRADOR (Gestión de Usuarios) --- */
app.get("/usuarios/admin", async (req, res) => {
    const { data, error } = await supabase.from("usuarios").select("id, email, activo, creado_en").eq("es_admin", false).order("activo").order("creado_en", { ascending: false });
    if (error) return res.status(500).json(error);
    res.json(data);
});

app.patch("/usuarios/aprobar/:id", async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase.from("usuarios").update({ activo: true }).eq("id", id);
    if (error) return res.status(500).json(error);
    res.json({ success: true });
});

app.delete("/usuarios/:id", async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase.from("usuarios").delete().eq("id", id);
    if (error) return res.status(500).json(error);
    res.json({ success: true });
});

/* --- SECTORES Y CONSULTORIOS --- */
app.get("/sectores", async (req, res) => {
    const { data, error } = await supabase.from("sectores").select("*").eq("activo", true).order("nombre");
    if (error) return res.status(500).json(error);
    res.json(data);
});

app.get("/consultorios", async (req, res) => {
    const { sector } = req.query;
    let query = supabase.from("consultorios").select("*").order("numero");
    if (sector) query = query.eq("sector", sector);
    const { data, error } = await query;
    if (error) return res.status(500).json(error);
    res.json(data);
});

/* --- PROFESIONALES --- */
app.get("/profesionales", async (req, res) => {
    const { data, error } = await supabase.from("profesionales").select("*").order("nombre");
    if (error) return res.status(500).json(error);
    res.json(data);
});

app.post("/profesional", async (req, res) => {
    const { nombre, especialidades } = req.body;
    const { error } = await supabase.from("profesionales").insert({ nombre, especialidades, activo: true, color: "#e2e8f0" });
    if (error) return res.status(500).json(error);
    res.json({ success: true });
});

app.patch("/profesional/:id", async (req, res) => {
    const { id } = req.params;
    const { nombre, especialidades } = req.body;
    const { error } = await supabase.from("profesionales").update({ nombre, especialidades }).eq("id", id);
    if (error) return res.status(500).json(error);
    res.json({ success: true });
});

app.patch("/profesional/:id/color", async (req, res) => {
    const { id } = req.params;
    const { color } = req.body;
    const { error } = await supabase.from("profesionales").update({ color }).eq("id", id);
    if (error) return res.status(500).json(error);
    res.json({ success: true });
});

app.delete("/profesional/:id", async (req, res) => {
    const { id } = req.params;
    await supabase.from("agenda_base").delete().eq("profesional_id", id);
    await supabase.from("ausencias").delete().eq("profesional_id", id);
    const { error } = await supabase.from("profesionales").delete().eq("id", id);
    if (error) return res.status(500).json(error);
    res.json({ success: true });
});

/* --- LICENCIAS --- */
app.post("/licencia", async (req, res) => {
    const { profesional_id, desde, hasta } = req.body;
    await supabase.from("ausencias").delete().eq("profesional_id", profesional_id);
    if (desde && hasta) {
        const { error } = await supabase.from("ausencias").insert({ profesional_id, fecha_desde: desde, fecha_hasta: hasta });
        if (error) return res.status(500).json(error);
    }
    res.json({ success: true });
});

app.get("/ausencias", async (req, res) => {
    const { data, error } = await supabase.from("ausencias").select("*");
    if (error) return res.status(500).json(error);
    res.json(data);
});

/* --- AGENDA --- */
app.get("/agenda", async (req, res) => {
    const { dia, sector } = req.query;
    const { data, error } = await supabase.from("agenda_base").select("*").eq("dia_semana", dia).eq("sector", sector);
    if (error) return res.status(500).json(error);
    res.json(data);
});

app.post("/agenda", async (req, res) => {
    const { consultorio_id, profesional_id, especialidad, horario, dia_semana, sector } = req.body;
    if (!profesional_id) {
        const { error } = await supabase.from("agenda_base").delete().eq("consultorio_id", consultorio_id).eq("horario", horario).eq("dia_semana", dia_semana).eq("sector", sector);
        if (error) return res.status(500).json(error);
        return res.json({ success: true });
    }
    const { error } = await supabase.from("agenda_base").upsert({ consultorio_id, profesional_id, especialidad, horario, dia_semana, sector });
    if (error) return res.status(500).json(error);
    res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`Servidor iniciado correctamente en el puerto ${PORT}`); });
