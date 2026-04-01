const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const cors = require("cors");
require('dotenv').config(); // Asegúrate de tener dotenv instalado o reemplaza process.env.SUPABASE_KEY por tu clave

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Configuración de Supabase
const supabaseUrl = "https://ywycizbmesdhtfaaxyxt.supabase.co";
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

/* --- AUTENTICACIÓN Y USUARIOS --- */

app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    const { data, error } = await supabase
        .from("usuarios")
        .select("*")
        .eq("email", email)
        .eq("password", password)
        .single();

    if (error || !data) return res.status(401).json({ error: "Credenciales incorrectas." });
    if (!data.activo) return res.status(403).json({ error: "Tu cuenta está pendiente de aprobación." });

    res.json({ success: true, usuario: { id: data.id, email: data.email, es_admin: data.es_admin } });
});

app.post("/registro", async (req, res) => {
    const { email, password } = req.body;
    const { error } = await supabase
        .from("usuarios")
        .insert({ email, password, activo: false, es_admin: false });

    if (error) return res.status(500).json({ error: "Error al registrar usuario. Posiblemente ya existe." });
    res.json({ success: true });
});

/* --- PANEL DE ADMINISTRACIÓN (NUEVO) --- */

app.get("/usuarios/admin", async (req, res) => {
    const { data, error } = await supabase.from("usuarios").select("id, email, activo, es_admin").order("email");
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

/* --- GESTIÓN DE PROFESIONALES --- */

app.get("/profesionales", async (req, res) => {
    const { data } = await supabase.from("profesionales").select("*").order("nombre");
    res.json(data || []);
});

app.post("/profesional", async (req, res) => {
    const { nombre, especialidades } = req.body;
    const { error } = await supabase.from("profesionales").insert({ 
        nombre, 
        especialidades, 
        activo: true, 
        color: "#e2e8f0" 
    });
    res.json({ success: !error });
});

app.patch("/profesional/:id", async (req, res) => {
    const { nombre, especialidades } = req.body;
    const { error } = await supabase.from("profesionales")
        .update({ nombre, especialidades })
        .eq("id", req.params.id);
    res.json({ success: !error });
});

app.patch("/profesional/:id/color", async (req, res) => {
    const { error } = await supabase.from("profesionales")
        .update({ color: req.body.color })
        .eq("id", req.params.id);
    res.json({ success: !error });
});

app.delete("/profesional/:id", async (req, res) => {
    const { error } = await supabase.from("profesionales").delete().eq("id", req.params.id);
    res.json({ success: !error });
});

/* --- GESTIÓN DE LICENCIAS --- */

app.get("/ausencias", async (req, res) => {
    const { data } = await supabase.from("ausencias").select("*");
    res.json(data || []);
});

app.post("/licencia", async (req, res) => {
    const { profesional_id, desde, hasta } = req.body;
    // Limpiamos licencias anteriores para evitar solapamientos en este prototipo
    await supabase.from("ausencias").delete().eq("profesional_id", profesional_id);
    
    if(desde && hasta) {
        const { error } = await supabase.from("ausencias").insert({ profesional_id, fecha_desde: desde, fecha_hasta: hasta });
        return res.json({ success: !error });
    }
    res.json({ success: true });
});

/* --- AGENDA Y CONFIGURACIÓN --- */

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

    // 1. Obtener la programación base
    const { data: agenda } = await supabase.from("agenda_base")
        .select("*")
        .eq("dia_semana", dia)
        .eq("sector", sector);

    // 2. Obtener licencias activas para la fecha seleccionada
    const { data: ausentes } = await supabase.from("ausencias")
        .select("profesional_id")
        .lte("fecha_desde", fechaCompleta)
        .gte("fecha_hasta", fechaCompleta);

    const idsAusentes = ausentes ? ausentes.map(a => a.profesional_id) : [];

    // 3. Filtrar: No mostrar en la agenda a quienes estén de licencia
    const agendaFinal = agenda ? agenda.filter(item => !idsAusentes.includes(item.profesional_id)) : [];
    
    res.json(agendaFinal);
});

app.post("/agenda", async (req, res) => {
    const { consultorio_id, profesional_id, horario, dia_semana, sector, especialidad } = req.body;
    
    if(!profesional_id) {
        // Si no hay profesional_id, borramos el turno (lo dejamos libre)
        await supabase.from("agenda_base")
            .delete()
            .eq("consultorio_id", consultorio_id)
            .eq("horario", horario)
            .eq("dia_semana", dia_semana)
            .eq("sector", sector);
    } else {
        // Si hay profesional, usamos UPSERT (insertar o actualizar)
        await supabase.from("agenda_base").upsert({ 
            consultorio_id, 
            profesional_id, 
            horario, 
            dia_semana, 
            sector,
            especialidad 
        });
    }
    res.json({ success: true });
});

// Iniciar servidor
const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 Servidor MediPlan corriendo en http://localhost:${PORT}`));
