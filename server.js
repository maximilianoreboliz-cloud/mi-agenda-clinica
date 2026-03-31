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

/* LOGIN */
app.post("/login", async (req, res) => {
const { email, password } = req.body;
const { data, error } = await supabase.from("usuarios")
.select("*").eq("email", email).eq("password", password).single();

if (error || !data) return res.status(401).json({ error: "Credenciales incorrectas." });
if (!data.activo) return res.status(403).json({ error: "Tu cuenta está pendiente de aprobación." });

res.json({ success: true, usuario: { email: data.email, es_admin: data.es_admin } });
});

app.post("/registro", async (req, res) => {
const { email, password } = req.body;
const { error } = await supabase.from("usuarios")
.insert({ email, password, activo: false, es_admin: false });

if (error) return res.status(500).json(error);
res.json({ success: true });
});

/* PROFESIONALES */
app.get("/profesionales", async (req, res) => {
const { data, error } = await supabase.from("profesionales").select("*").order("nombre");
if (error) return res.status(500).json(error);
res.json(data);
});

/* AGENDA OPTIMIZADA */
app.get("/agenda-datos", async (req, res) => {
const { dia, sector } = req.query;

const [consultoriosRes, agendaRes, profesionalesRes, ausenciasRes] = await Promise.all([
supabase.from("consultorios").select("*").eq("sector", sector).order("numero"),
supabase.from("agenda_base").select("*").eq("dia_semana", dia).eq("sector", sector),
supabase.from("profesionales").select("*").order("nombre"),
supabase.from("ausencias").select("*")
]);

if (consultoriosRes.error) return res.status(500).json(consultoriosRes.error);
if (agendaRes.error) return res.status(500).json(agendaRes.error);
if (profesionalesRes.error) return res.status(500).json(profesionalesRes.error);
if (ausenciasRes.error) return res.status(500).json(ausenciasRes.error);

res.json({
consultorios: consultoriosRes.data,
agenda: agendaRes.data,
profesionales: profesionalesRes.data,
ausencias: ausenciasRes.data
});
});

app.post("/agenda", async (req, res) => {
const { consultorio_id, profesional_id, especialidad, horario, dia_semana, sector } = req.body;

if (!profesional_id) {
await supabase.from("agenda_base")
.delete()
.eq("consultorio_id", consultorio_id)
.eq("horario", horario)
.eq("dia_semana", dia_semana)
.eq("sector", sector);

return res.json({ success: true });
}

const { error } = await supabase.from("agenda_base")
.upsert({ consultorio_id, profesional_id, especialidad, horario, dia_semana, sector });

if (error) return res.status(500).json(error);
res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Servidor OK"));
