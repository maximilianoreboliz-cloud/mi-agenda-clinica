let modo = "ver";
let esRegistro = false;
let datosUsuario = null;
let listaProfesionalesGlobal = [];

document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.custom-select-container')) {
            document.querySelectorAll('.custom-dropdown-menu').forEach(m => m.style.display = 'none');
        }
    });
});

async function procesarFormulario() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    if (!email || !password) return alert("Faltan datos");
    const endpoint = esRegistro ? "/registro" : "/login";
    try {
        const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
        const data = await res.json();
        if (res.ok) {
            if (esRegistro) alert("Solicitud enviada");
            else {
                datosUsuario = data.usuario;
                document.getElementById("login-container").style.display = "none";
                document.getElementById("app").style.display = "flex";
                document.getElementById("user-email-display").innerText = data.usuario.email;
                document.getElementById("btn-panel").style.display = data.usuario.es_admin ? "block" : "none";
                cargarSectores();
            }
        } else alert(data.error);
    } catch(e) { alert("Error de servidor"); }
}

async function cargarSectores() {
    const res = await fetch("/sectores");
    const sectores = await res.json();
    document.getElementById("sector").innerHTML = sectores.map(s => `<option value="${s.nombre}">${s.nombre}</option>`).join('');
}

/* --- AGENDA --- */
function pantallaVerAgenda() { modo = "ver"; prepararAgenda(); }
function pantallaModificarAgenda() { modo = "editar"; prepararAgenda(); }

function prepararAgenda() {
    document.getElementById("titulo-seccion").innerText = modo === "ver" ? "Visor de Agenda" : "Edición de Agenda";
    document.getElementById("filtros-container").style.display = "block";
    document.getElementById("main-content").innerHTML = `<div style="padding:40px; text-align:center; color:#94a3b8;">Seleccione filtros para cargar la grilla</div>`;
}

async function ejecutarBusqueda() {
    const dia = document.getElementById("dia").value;
    const sector = document.getElementById("sector").value;
    const [resC, resA, resP] = await Promise.all([
        fetch(`/consultorios?sector=${sector}`),
        fetch(`/agenda?dia=${dia}&sector=${sector}`),
        fetch("/profesionales")
    ]);
    listaProfesionalesGlobal = await resP.json();
    dibujarAgenda(await resC.json(), await resA.json(), dia, sector);
}

function filtrarMenu(input, menuId) {
    const term = input.value.toLowerCase();
    const items = document.querySelectorAll(`#menu_${menuId} .menu-list-items > li`);
    items.forEach(li => {
        li.style.display = li.innerText.toLowerCase().includes(term) ? "block" : "none";
    });
}

function toggleCustomMenu(idStr, event) {
    event.stopPropagation();
    document.querySelectorAll('.custom-dropdown-menu').forEach(m => { if(m.id !== `menu_${idStr}`) m.style.display='none'; });
    const menu = document.getElementById(`menu_${idStr}`);
    const isVisible = menu.style.display === 'block';
    menu.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) {
        const inp = menu.querySelector('.menu-search-input');
        inp.value = '';
        filtrarMenu(inp, idStr);
        setTimeout(() => inp.focus(), 50);
    }
}

function dibujarAgenda(consultorios, agenda, dia, sector) {
    let horarios = [];
    for (let h = 8; h <= 19; h++) {
        horarios.push(`${String(h).padStart(2, "0")}:00`);
        if(h !== 19) horarios.push(`${String(h).padStart(2, "0")}:30`);
    }

    let html = `<div class="card-table"><table class="tabla-agenda"><tr><th style="width:70px">Hora</th>`;
    consultorios.forEach(c => html += `<th>Cons. ${c.numero}</th>`);
    html += "</tr>";

    horarios.forEach(h => {
        let h_id = h.replace(':','_');
        html += `<tr><td style="text-align:center"><strong>${h}</strong></td>`;
        consultorios.forEach(c => {
            let slot = agenda.find(a => a.horario == h && a.consultorio_id == c.id);
            if (modo === "editar") {
                let displayTxt = "- Libre -";
                if(slot) {
                    let p = listaProfesionalesGlobal.find(x => x.id == slot.profesional_id);
                    displayTxt = p ? (slot.especialidad ? `${p.nombre} (${slot.especialidad})` : p.nombre) : "- Libre -";
                }

                // GENERACIÓN DE LISTA PLANA (Sin submenús)
                let menuItemsHtml = `<li onclick="seleccionarOpcion('${c.id}','${h}',null,null)"><b>- Marcar como Libre -</b></li>`;
                listaProfesionalesGlobal.forEach(p => {
                    let esps = p.especialidades ? p.especialidades.split(',').map(e => e.trim()).filter(e => e) : [];
                    if (esps.length > 0) {
                        esps.forEach(e => {
                            menuItemsHtml += `<li onclick="seleccionarOpcion('${c.id}','${h}','${p.id}','${e}')">
                                <b>${p.nombre}</b>
                                <span>${e}</span>
                            </li>`;
                        });
                    } else {
                        menuItemsHtml += `<li onclick="seleccionarOpcion('${c.id}','${h}','${p.id}',null)"><b>${p.nombre}</b></li>`;
                    }
                });

                html += `<td>
                    <div class="custom-select-container">
                        <div class="custom-select-box" onclick="toggleCustomMenu('${c.id}_${h_id}', event)">${displayTxt}</div>
                        <div class="custom-dropdown-menu" id="menu_${c.id}_${h_id}">
                            <div class="menu-search-container">
                                <input type="text" class="menu-search-input" placeholder="Buscar..." onkeyup="filtrarMenu(this, '${c.id}_${h_id}')" onclick="event.stopPropagation()">
                            </div>
                            <ul class="menu-list-items">${menuItemsHtml}</ul>
                        </div>
                    </div>
                </td>`;
            } else {
                if(slot) {
                    let p = listaProfesionalesGlobal.find(x => x.id == slot.profesional_id);
                    let sub = slot.especialidad ? `<br><small style="font-size:10px">${slot.especialidad}</small>` : '';
                    html += `<td class="slot-ocupado" style="background:${p?.color || '#eee'}">${p?.nombre || '?'}${sub}</td>`;
                } else html += `<td class="slot-vacio">Libre</td>`;
            }
        });
        html += "</tr>";
    });
    html += "</table></div>";
    document.getElementById("main-content").innerHTML = html;
}

async function seleccionarOpcion(c_id, hora, prof_id, esp) {
    const dia = document.getElementById("dia").value;
    const sector = document.getElementById("sector").value;
    await fetch("/agenda", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consultorio_id: c_id, profesional_id: prof_id, horario: hora, dia_semana: dia, sector, especialidad: esp })
    });
    ejecutarBusqueda();
}

/* --- PANEL ADMIN --- */
async function pantallaProfesionales() {
    document.getElementById("titulo-seccion").innerText = "Gestión de Profesionales";
    document.getElementById("filtros-container").style.display = "none";
    const res = await fetch("/profesionales");
    const profesionales = await res.json();
    let html = `<div class="card-table"><table><tr><th>Color</th><th>Nombre</th><th>Acciones</th></tr>`;
    profesionales.forEach(p => {
        html += `<tr>
            <td><input type="color" class="color-picker" value="${p.color || '#e2e8f0'}" onchange="cambiarColor('${p.id}', this.value)"></td>
            <td><strong>${p.nombre}</strong><br><small>${p.especialidades || ''}</small></td>
            <td><button class="btn-delete" onclick="eliminarProf('${p.id}')">Eliminar</button></td>
        </tr>`;
    });
    html += `</table></div>`;
    document.getElementById("main-content").innerHTML = html;
}

async function cambiarColor(id, color) { await fetch(`/profesional/${id}/color`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ color }) }); }
async function eliminarProf(id) { if(confirm("¿Eliminar profesional?")) { await fetch(`/profesional/${id}`, { method: "DELETE" }); pantallaProfesionales(); } }
