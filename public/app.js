let listaProfesionalesGlobal = [];

function normalizarTexto(texto) {
return (texto || "")
.toLowerCase()
.normalize("NFD")
.replace(/[\u0300-\u036f]/g, "");
}

function filtrarOpcionesDropdown(menuId, valor) {
const menu = document.getElementById(menuId);
const filtro = normalizarTexto(valor);

menu.querySelectorAll("li[data-search]").forEach(li => {
const texto = normalizarTexto(li.dataset.search);
li.style.display = texto.includes(filtro) ? "" : "none";
});
}

function toggleCustomMenu(idStr, event) {
event.stopPropagation();

document.querySelectorAll('.custom-dropdown-menu')
.forEach(m => m.style.display = 'none');

const menu = document.getElementById(`menu_${idStr}`);
menu.style.display = 'block';

const input = menu.querySelector("input");
if (input) {
input.value = "";
input.focus();
}
}

async function verAgenda() {
const dia = document.getElementById("dia").value;
const sector = document.getElementById("sector").value;

const res = await fetch(`/agenda-datos?dia=${dia}&sector=${sector}`);
const data = await res.json();

listaProfesionalesGlobal = data.profesionales;

dibujarAgenda(data.consultorios, data.agenda, data.ausencias, dia, sector);
}

function dibujarAgenda(consultorios, agenda, ausencias, dia, sector) {

let horarios = [];
for (let h = 8; h <= 19; h++) {
horarios.push(`${String(h).padStart(2, "0")}:00`);
if (h !== 19) horarios.push(`${String(h).padStart(2, "0")}:30`);
}

let html = `<table><tr><th>Hora</th>`;

consultorios.forEach(c => html += `<th>${c.numero}</th>`);
html += "</tr>";

horarios.forEach(h => {
let h_str = h.replace(':', '_');
html += `<tr><td>${h}</td>`;

consultorios.forEach(c => {

let menuHtml = `
<ul class="custom-dropdown-menu" id="menu_${c.id}_${h_str}" style="display:none;">
<li>
<input type="text" placeholder="Buscar..." 
oninput="filtrarOpcionesDropdown('menu_${c.id}_${h_str}', this.value)">
</li>
<li onclick="seleccionar('${c.id}','${h_str}',null)">Libre</li>
`;

listaProfesionalesGlobal.forEach(p => {
menuHtml += `
<li data-search="${p.nombre}" 
onclick="seleccionar('${c.id}','${h_str}','${p.id}')">
${p.nombre}
</li>`;
});

menuHtml += "</ul>";

html += `
<td>
<div onclick="toggleCustomMenu('${c.id}_${h_str}', event)">
Seleccionar
</div>
${menuHtml}
</td>`;
});

html += "</tr>";
});

html += "</table>";

document.getElementById("main-content").innerHTML = html;
}

async function seleccionar(c, h, p) {
await fetch("/agenda", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
consultorio_id: c,
profesional_id: p,
horario: h.replace("_", ":"),
dia_semana: document.getElementById("dia").value,
sector: document.getElementById("sector").value
})
});

verAgenda();
}
