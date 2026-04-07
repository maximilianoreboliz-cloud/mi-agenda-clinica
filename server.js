const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const cors = require("cors");
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Configuración de Supabase
const supabaseUrl = "https://ywycizbmesdhtfaaxyxt.supabase.co";
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseKey) {
    console.error("❌ ERROR CRÍTICO: No se detectó la variable SUPABASE_KEY en Render.");
}

const supabase = createClient(supabaseUrl, supabaseKey);

/* --- AUTENTICACIÓN --- */
app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    try {
        const { data, error } = await supabase
            .from("usuarios")
            .select("*")
            .eq("email", email)
            .eq("password", password)
            .single();

        if (error || !data) {
            console.error("Error en login:", error);
            return res.status(401).json({ error: "Credenciales incorrectas o problema de conexión." });
        }
        if (!data.activo) return res.status(403).json({ error: "Cuenta pendiente de aprobación." });

        res.json({ success: true, usuario: { id: data.id, email: data.email, es_admin: data.es_admin } });
    } catch (e) {
        res.status(500).json({ error: "Error interno del servidor." });
    }
});

app.post("/registro", async (req, res) => {
    const { email, password } = req.body;
    const { error } = await supabase
        .from("usuarios")
        .insert({ email, password, activo: false, es_admin: false });

    if (error) return res.status(500).json({ error: "Error al registrar. El usuario podría ya existir." });
    res.json({ success: true });
});

/* --- GESTIÓN DE USUARIOS (ADMIN) --- */
app.get("/usuarios/admin", async (req, res) => {
    const { data } = await supabase.from("usuarios").select("id, email, activo, es_admin").order("email");
    res.json(data || []);
});

app.patch("/usuarios/aprobar/:id", async (req, res) => {
    const { error } = await supabase.from("usuarios").update({ activo: true }).eq("id", req.params.id);
    res.json({ success: !error });
});

app.delete("/usuarios/:id", async (req, res) => {
    const { error } = await supabase.from("usuarios").delete().eq("id", req.params.id);
    res.json({ success: !error });
});

/* --- PROFESIONALES --- */
app.get("/profesionales", async (req, res) => {
    const { data } = await supabase.from("profesionales").select("*").order("nombre");
    res.json(data || []);
});

app.post("/profesional", async (req, res) => {
    const { nombre, especialidades } = req.body;
    const { error } = await supabase.from("profesionales").insert({ nombre, especialidades, activo: true, color: "#e2e8f0" });
    res.json({ success: !error });
});

app.patch("/profesional/:id", async (req, res) => {
    const { nombre, especialidades } = req.body;
    const { error } = await supabase.from("profesionales").update({ nombre, especialidades }).eq("id", req.params.id);
    res.json({ success: !error });
});

app.patch("/profesional/:id/color", async (req, res) => {
    const { error } = await supabase.from("profesionales").update({ color: req.body.color }).eq("id", req.params.id);
    res.json({ success: !error });
});

app.delete("/profesional/:id", async (req, res) => {
    const { error } = await supabase.from("profesionales").delete().eq("id", req.params.id);
    res.json({ success: !error });
});

/* --- LICENCIAS Y AGENDA --- */
app.get("/ausencias", async (req, res) => {
    const { data } = await supabase.from("ausencias").select("*");
    res.json(data || []);
});

app.post("/licencia", async (req, res) => {
    const { profesional_id, desde, hasta } = req.body;
    await supabase.from("ausencias").delete().eq("profesional_id", profesional_id);
    if(desde && hasta) {
        const { error } = await supabase.from("ausencias").insert({ profesional_id, fecha_desde: desde, fecha_hasta: hasta });
        return res.json({ success: !error });
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

app.get("/agenda", async (req, res) => {
    const { dia, sector, fechaCompleta } = req.query;
    const { data: agenda } = await supabase.from("agenda_base").select("*").eq("dia_semana", dia).eq("sector", sector);
    const { data: ausentes } = await supabase.from("ausencias").select("profesional_id").lte("fecha_desde", fechaCompleta).gte("fecha_hasta", fechaCompleta);
    const idsAusentes = ausentes ? ausentes.map(a => a.profesional_id) : [];
    const agendaFinal = agenda ? agenda.filter(item => !idsAusentes.includes(item.profesional_id)) : [];
    res.json(agendaFinal);
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor activo en puerto ${PORT}`));
