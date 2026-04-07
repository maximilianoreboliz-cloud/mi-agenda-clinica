const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const cors = require("cors");
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Servir archivos estáticos desde la carpeta 'public'
app.use(express.static("public"));

// Configuración de Supabase
const supabaseUrl = "https://ywycizbmesdhtfaaxyxt.supabase.co";
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseKey) {
    console.error("❌ ERROR: No se encontró la variable SUPABASE_KEY en Render.");
}

const supabase = createClient(supabaseUrl, supabaseKey);

/* --- RUTAS DE API --- */

// Login
app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    const { data, error } = await supabase
        .from("usuarios")
        .select("*")
        .eq("email", email)
        .eq("password", password)
        .single();

    if (error || !data) return res.status(401).json({ error: "Credenciales incorrectas." });
    if (!data.activo) return res.status(403).json({ error: "Cuenta pendiente de aprobación." });

    res.json({ success: true, usuario: { id: data.id, email: data.email, es_admin: data.es_admin } });
});

// Sectores
app.get("/sectores", async (req, res) => {
    const { data, error } = await supabase.from("sectores").select("*").eq("activo", true);
    if (error) return res.status(500).json(error);
    res.json(data || []);
});

// Consultorios
app.get("/consultorios", async (req, res) => {
    const { data } = await supabase.from("consultorios").select("*").eq("sector", req.query.sector);
    res.json(data || []);
});

// Profesionales
app.get("/profesionales", async (req, res) => {
    const { data } = await supabase.from("profesionales").select("*").order("nombre");
    res.json(data || []);
});

// Agenda
app.get("/agenda", async (req, res) => {
    const { dia, sector, fechaCompleta } = req.query;
    const { data: agenda } = await supabase.from("agenda_base").select("*").eq("dia_semana", dia).eq("sector", sector);
    const { data: ausentes } = await supabase.from("ausencias").select("profesional_id").lte("fecha_desde", fechaCompleta).gte("fecha_hasta", fechaCompleta);
    const idsAusentes = ausentes ? ausentes.map(a => a.profesional_id) : [];
    const agendaFinal = agenda ? agenda.filter(item => !idsAusentes.includes(item.profesional_id)) : [];
    res.json(agendaFinal);
});

// Guardar en Agenda
app.post("/agenda", async (req, res) => {
    const { consultorio_id, profesional_id, horario, dia_semana, sector, especialidad } = req.body;
    if(!profesional_id) {
        await supabase.from("agenda_base").delete().eq("consultorio_id", consultorio_id).eq("horario", horario).eq("dia_semana", dia_semana).eq("sector", sector);
    } else {
        await supabase.from("agenda_base").upsert({ consultorio_id, profesional_id, horario, dia_semana, sector, especialidad });
    }
    res.json({ success: true });
});

// Licencias
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

// Arrancar el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));
