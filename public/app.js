let modo = "ver";
let datosUsuario = null;
let listaProfesionalesGlobal = [];

async function procesarFormulario() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const res = await fetch("/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    const data = await res.json();
    if (res.ok) {
        datosUsuario = data.usuario;
        document.getElementById("login-container").style.display = "none";
        document.getElementById("app").style.display = "flex";
        document.getElementById("user-email-display").innerText = data.usuario.email;
        document.getElementById("btn-panel").style.display = data.usuario.es_admin ? "block" : "none";
        cargarSectores();
    } else alert(data.error);
}

async function cargarSectores() {
    const res = await fetch("/sectores");
    const sectores = await res.json();
    document.getElementById("sector").innerHTML = sectores.map(s => `<option value="${s.nombre}">${s.nombre}</option>`).join('');
}

function pantallaVerAgenda() { modo = "ver"; prepararInterfaz(); }
function pantallaModificarAgenda() { modo = "editar"; prepararInterfaz(); }

function prepararInterfaz() {
    document.getElementById("filtros-container").style.display = "block";
    document.getElementById("main-content").innerHTML = `<div class="empty-state"><h2>Seleccione filtros para ver la grilla</h2></div>`;
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
    dibujarAgenda(await resC.json(), await resA.json());
}

function dibujarAgenda(consultorios, agenda) {
    let horarios = [];
    for (let h = 8; h <= 19; h++) {
        horarios.push(`${String(h).padStart(2, "0")}:00`);
        if(h !== 19) horarios.push(`${String(h).padStart(2, "0")}:30`);
    }

    let html = `<div class="card-table"><table><tr><th style="width:100px">Hora</th>`;
    consultorios.forEach(c => html += `<th>Consultorio ${c.numero}</th>`);
    html += "</tr>";

    horarios.forEach(h => {
        html += `<tr><td style="background:#f8fafc; font-weight:bold">${h}</td>`;
        consultorios.forEach(c => {
            let slot = agenda.find(a => a.horario == h && a.consultorio_id == c.id);
            if (modo === "editar") {
                let txt = slot ? (slot.especialidad ? `${obtenerNombreProf(slot.profesional_id)} (${slot.especialidad})` : obtenerNombreProf(slot.profesional_id)) : "- Libre -";
                let menuId = `menu_${c.id}_${h.replace(':','_')}`;
                
                let liHtml = `<li onclick="asignar('${c.id}','${h}',null,null)"><b>🚫 Marcar Libre</b></li>`;
                listaProfesionalesGlobal.forEach(p => {
                    let esps = p.especialidades ? p.especialidades.split(',') : [];
                    if(esps.length) {
                        esps.forEach(e => liHtml += `<li onclick="asignar('${c.id}','${h}','${p.id}','${e.trim()}')"><b>${p.nombre}</b><span>${e.trim()}</span></li>`);
                    } else {
                        liHtml += `<li onclick="asignar('${c.id}','${h}','${p.id}',null)"><b>${p.nombre}</b></li>`;
                    }
                });

                html += `<td>
                    <div class="custom-select-container">
                        <div class="custom-select-box" onclick="toggleM('${menuId}')">${txt}</div>
                        <div class="custom-dropdown-menu" id="${menuId}">
                            <input type="text" placeholder="Buscar..." class="menu-search-input" onkeyup="filterM(this)">
                            <ul>${liHtml}</ul>
                        </div>
                    </div>
                </td>`;
            } else {
                if(slot) {
                    let p = listaProfesionalesGlobal.find(x => x.id == slot.profesional_id);
                    html += `<td><div class="slot-ocupado" style="background:${p?.color || '#eee'}">${p?.nombre || '?'}<br><small>${slot.especialidad || ''}</small></div></td>`;
                } else html += `<td class="slot-vacio">Libre</td>`;
            }
        });
        html += "</tr>";
    });
    html += "</table></div>";
    document.getElementById("main-content").innerHTML = html;
}

function obtenerNombreProf(id) { return listaProfesionalesGlobal.find(p => p.id == id)?.nombre || "Libre"; }
function toggleM(id) { 
    let m = document.getElementById(id);
    let visible = m.style.display === 'block';
    document.querySelectorAll('.custom-dropdown-menu').forEach(x => x.style.display = 'none');
    m.style.display = visible ? 'none' : 'block';
}

async function asignar(c_id, hora, p_id, esp) {
    const dia = document.getElementById("dia").value;
    const sector = document.getElementById("sector").value;
    await fetch("/agenda", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ consultorio_id: c_id, profesional_id: p_id, horario: hora, dia_semana: dia, sector, especialidad: esp }) });
    ejecutarBusqueda();
}

/* --- PROFESIONALES --- */
async function pantallaProfesionales() {
    document.getElementById("titulo-seccion").innerText = "Gestión de Profesionales";
    document.getElementById("filtros-container").style.display = "none";
    const res = await fetch("/profesionales");
    const profs = await res.json();
    
    let html = `
    <div class="form-container">
        <h3>➕ Incorporar Nuevo Profesional</h3>
        <div class="grid-form">
            <div><label>Nombre Completo</label><input id="new-name" placeholder="Ej: Dr. Pérez"></div>
            <div><label>Especialidades (separadas por coma)</label><input id="new-esp" placeholder="Cardiología, Clínica"></div>
            <button class="btn-primary" onclick="crearProf()">Guardar Profesional</button>
        </div>
    </div>
    <div class="card-table">
        <table>
            <tr><th>Color</th><th>Profesional / Especialidades</th><th>Licencias</th><th>Acciones</th></tr>`;
    
    profs.forEach(p => {
        html += `<tr>
            <td style="width:60px; text-align:center">
                <input type="color" class="color-circle-input" value="${p.color || '#e2e8f0'}" onchange="cambiarColor('${p.id}', this.value)">
            </td>
            <td>
                <div id="view_${p.id}">
                    <strong>${p.nombre}</strong><br><small>${p.especialidades || 'Sin especialidades'}</small>
                </div>
                <div id="edit_${p.id}" style="display:none">
                    <input id="inp_n_${p.id}" value="${p.nombre}" style="margin-bottom:5px">
                    <input id="inp_e_${p.id}" value="${p.especialidades || ''}">
                </div>
            </td>
            <td>
                <div style="display:flex; gap:5px; align-items:center">
                    <input type="date" id="d_${p.id}" style="width:130px; padding:5px">
                    <input type="date" id="h_${p.id}" style="width:130px; padding:5px">
                    <button class="btn-icon" onclick="saveLic('${p.id}')">💾</button>
                </div>
            </td>
            <td>
                <button class="btn-icon" id="btn_e_${p.id}" onclick="toggleEdit('${p.id}')">✏️</button>
                <button class="btn-icon" id="btn_s_${p.id}" style="display:none" onclick="saveEdit('${p.id}')">✔️</button>
                <button class="btn-icon" onclick="eliminarProf('${p.id}')">🗑️</button>
            </td>
        </tr>`;
    });
    html += `</table></div>`;
    document.getElementById("main-content").innerHTML = html;
}

async function crearProf() {
    const nombre = document.getElementById("new-name").value;
    const especialidades = document.getElementById("new-esp").value;
    if(!nombre) return alert("El nombre es obligatorio");
    await fetch("/profesional", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre, especialidades }) });
    pantallaProfesionales();
}

function toggleEdit(id) {
    document.getElementById(`view_${id}`).style.display = 'none';
    document.getElementById(`edit_${id}`).style.display = 'block';
    document.getElementById(`btn_e_${id}`).style.display = 'none';
    document.getElementById(`btn_s_${id}`).style.display = 'inline-block';
}

async function saveEdit(id) {
    const nombre = document.getElementById(`inp_n_${id}`).value;
    const especialidades = document.getElementById(`inp_e_${id}`).value;
    await fetch(`/profesional/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre, especialidades }) });
    pantallaProfesionales();
}

async function saveLic(id) {
    const desde = document.getElementById(`d_${id}`).value;
    const hasta = document.getElementById(`h_${id}`).value;
    await fetch("/licencia", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profesional_id: id, desde, hasta }) });
    alert("Licencia guardada");
}

async function cambiarColor(id, color) { await fetch(`/profesional/${id}/color`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ color }) }); }
async function eliminarProf(id) { if(confirm("¿Eliminar profesional y su agenda?")) { await fetch(`/profesional/${id}`, { method: "DELETE" }); pantallaProfesionales(); } }

/* --- PANEL ADMIN --- */
async function cargarPanelControl() {
    document.getElementById("titulo-seccion").innerText = "Panel de Usuarios";
    document.getElementById("filtros-container").style.display = "none";
    const res = await fetch("/usuarios/admin");
    const users = await res.json();
    let html = `<div class="card-table"><table><tr><th>Email</th><th>Estado</th><th>Acciones</th></tr>`;
    users.forEach(u => {
        html += `<tr><td>${u.email}</td><td>${u.activo ? '🟢 Activo' : '🟠 Pendiente'}</td>
        <td>${!u.activo ? `<button onclick="aprobar('${u.id}')">Aprobar</button>` : ''} <button onclick="borrarU('${u.id}')">Borrar</button></td></tr>`;
    });
    document.getElementById("main-content").innerHTML = html + "</table></div>";
}
