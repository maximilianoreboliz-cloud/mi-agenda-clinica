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

/* --- AUTENTICACIÓN --- */
function toggleModoFormulario() {
    esRegistro = !esRegistro;
    document.getElementById("form-title").innerText = esRegistro ? "Solicitar Acceso" : "Ingreso al Sistema";
    document.getElementById("btn-submit").innerText = esRegistro ? "Enviar Solicitud" : "Ingresar";
    document.getElementById("toggle-text").innerHTML = esRegistro ? 
        '¿Ya tienes cuenta? <a href="#" onclick="toggleModoFormulario()">Ingresar</a>' : 
        '¿No tienes cuenta? <a href="#" onclick="toggleModoFormulario()">Solicitar acceso</a>';
}

async function procesarFormulario() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    if (!email || !password) return alert("Faltan datos");
    
    const endpoint = esRegistro ? "/registro" : "/login";
    try {
        const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
        const data = await res.json();
        
        if (res.ok) {
            if (esRegistro) {
                alert("Solicitud enviada. Espera la aprobación de un administrador.");
                toggleModoFormulario();
            } else {
                datosUsuario = data.usuario;
                document.getElementById("login-container").style.display = "none";
                document.getElementById("app").style.display = "flex";
                document.getElementById("user-email-display").innerText = data.usuario.email;
                document.getElementById("btn-panel").style.display = data.usuario.es_admin ? "block" : "none";
                cargarSectores();
            }
        } else {
            alert(data.error);
        }
    } catch(e) { 
        alert("Error de conexión con el servidor"); 
    }
}

function cerrarSesion() { location.reload(); }

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
    document.getElementById("main-content").innerHTML = `<div class="empty-state"><h2>Seleccione filtros para cargar la grilla</h2></div>`;
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
        if(inp) {
            inp.value = '';
            filtrarMenu(inp, idStr);
            setTimeout(() => inp.focus(), 50);
        }
    }
}

function dibujarAgenda(consultorios, agenda, dia, sector) {
    let horarios = [];
    for (let h = 8; h <= 19; h++) {
        horarios.push(`${String(h).padStart(2, "0")}:00`);
        if(h !== 19) horarios.push(`${String(h).padStart(2, "0")}:30`);
    }

    let html = `<div class="card-table"><table class="tabla-agenda"><tr><th style="width:80px">Hora</th>`;
    consultorios.forEach(c => html += `<th>Cons. ${c.numero}</th>`);
    html += "</tr>";

    horarios.forEach(h => {
        let h_id = h.replace(':','_');
        html += `<tr><td><strong>${h}</strong></td>`;
        consultorios.forEach(c => {
            let slot = agenda.find(a => a.horario == h && a.consultorio_id == c.id);
            if (modo === "editar") {
                let displayTxt = "- Libre -";
                if(slot) {
                    let p = listaProfesionalesGlobal.find(x => x.id == slot.profesional_id);
                    displayTxt = p ? (slot.especialidad ? `${p.nombre} (${slot.especialidad})` : p.nombre) : "- Libre -";
                }

                let menuItemsHtml = `<li onclick="seleccionarOpcion('${c.id}','${h}',null,null)"><b>🚫 - Marcar como Libre -</b></li>`;
                listaProfesionalesGlobal.forEach(p => {
                    let esps = p.especialidades ? p.especialidades.split(',').map(e => e.trim()).filter(e => e) : [];
                    if (esps.length > 0) {
                        esps.forEach(e => {
                            menuItemsHtml += `<li onclick="seleccionarOpcion('${c.id}','${h}','${p.id}','${e}')"><b>${p.nombre}</b><span>${e}</span></li>`;
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
                                <input type="text" class="menu-search-input" placeholder="🔍 Buscar médico..." onkeyup="filtrarMenu(this, '${c.id}_${h_id}')" onclick="event.stopPropagation()">
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

/* --- PROFESIONALES Y LICENCIAS --- */
async function pantallaProfesionales() {
    document.getElementById("titulo-seccion").innerText = "Gestión de Profesionales";
    document.getElementById("filtros-container").style.display = "none";
    
    // Obtenemos profesionales y ausencias al mismo tiempo
    const [resP, resA] = await Promise.all([fetch("/profesionales"), fetch("/ausencias")]);
    const profesionales = await resP.json();
    const ausencias = await resA.json();
    
    let html = `
    <div class="form-container">
        <h3 style="margin-bottom:15px; color:var(--text-main);">➕ Incorporar Nuevo Profesional</h3>
        <div class="grid-form">
            <div>
                <label style="font-size:12px; color:var(--text-muted); display:block; margin-bottom:5px;">Nombre Completo</label>
                <input id="new-name" placeholder="Ej: Dr. Pérez" style="margin-bottom:0;">
            </div>
            <div>
                <label style="font-size:12px; color:var(--text-muted); display:block; margin-bottom:5px;">Especialidades (separadas por coma)</label>
                <input id="new-esp" placeholder="Cardiología, Clínica" style="margin-bottom:0;">
            </div>
            <button class="btn-primary" style="margin-bottom:0;" onclick="crearProf()">Añadir Médico</button>
        </div>
    </div>

    <div class="card-table">
        <table>
            <tr>
                <th style="width:70px; text-align:center;">Color</th>
                <th>Profesional / Especialidades</th>
                <th>Licencias (Desde - Hasta)</th>
                <th style="text-align:center;">Acciones</th>
            </tr>`;
    
    profesionales.forEach(p => {
        let aus = ausencias.find(a => a.profesional_id === p.id) || { fecha_desde: '', fecha_hasta: '' };
        
        html += `<tr>
            <td style="text-align:center;">
                <input type="color" class="color-circle-input" value="${p.color || '#e2e8f0'}" onchange="cambiarColor('${p.id}', this.value)">
            </td>
            <td>
                <div id="view_${p.id}">
                    <strong>${p.nombre}</strong><br>
                    <small style="color:var(--primary); font-weight:500;">${p.especialidades || 'Sin especialidades'}</small>
                </div>
                <div id="edit_${p.id}" style="display:none; flex-direction:column; gap:5px;">
                    <input id="inp_n_${p.id}" value="${p.nombre}" style="margin:0; padding:8px;">
                    <input id="inp_e_${p.id}" value="${p.especialidades || ''}" placeholder="Especialidades" style="margin:0; padding:8px;">
                </div>
            </td>
            <td>
                <div style="display:flex; gap:10px; align-items:center;">
                    <input type="date" id="d_${p.id}" value="${aus.fecha_desde}" style="margin:0; width:130px; font-size:12px; padding:8px;">
                    <span style="color:var(--text-muted); font-size:12px;">a</span>
                    <input type="date" id="h_${p.id}" value="${aus.fecha_hasta}" style="margin:0; width:130px; font-size:12px; padding:8px;">
                    <button class="accion-btn btn-save" style="min-width:40px; padding:0 10px;" onclick="guardarLicencia('${p.id}')">OK</button>
                </div>
            </td>
            <td style="text-align:center;">
                <div class="acciones-container">
                    <button class="accion-btn btn-edit-action" id="btn_e_${p.id}" onclick="toggleEdit('${p.id}')">Editar</button>
                    <button class="accion-btn btn-save" id="btn_s_${p.id}" style="display:none;" onclick="saveEdit('${p.id}')">Guardar</button>
                    <button class="accion-btn btn-delete" onclick="eliminarProf('${p.id}')">Borrar</button>
                </div>
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
    
    await fetch("/profesional", { 
        method: "POST", headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ nombre, especialidades }) 
    });
    pantallaProfesionales();
}

function toggleEdit(id) {
    document.getElementById(`view_${id}`).style.display = 'none';
    document.getElementById(`edit_${id}`).style.display = 'flex';
    document.getElementById(`btn_e_${id}`).style.display = 'none';
    document.getElementById(`btn_s_${id}`).style.display = 'inline-flex';
}

async function saveEdit(id) {
    const nombre = document.getElementById(`inp_n_${id}`).value;
    const especialidades = document.getElementById(`inp_e_${id}`).value;
    await fetch(`/profesional/${id}`, { 
        method: "PATCH", headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ nombre, especialidades }) 
    });
    pantallaProfesionales();
}

async function guardarLicencia(id) {
    const desde = document.getElementById(`d_${id}`).value;
    const hasta = document.getElementById(`h_${id}`).value;
    await fetch("/licencia", { 
        method: "POST", headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ profesional_id: id, desde, hasta }) 
    });
    alert("Licencia guardada correctamente");
}

async function cambiarColor(id, color) { 
    await fetch(`/profesional/${id}/color`, { 
        method: "PATCH", headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ color }) 
    }); 
}

async function eliminarProf(id) { 
    if(confirm("¿Estás seguro de eliminar este profesional? Se borrarán todos sus turnos en la agenda.")) { 
        await fetch(`/profesional/${id}`, { method: "DELETE" }); 
        pantallaProfesionales(); 
    } 
}

/* --- PANEL DE ADMINISTRACIÓN --- */
async function cargarPanelControl() {
    document.getElementById("titulo-seccion").innerText = "Panel de Usuarios";
    document.getElementById("filtros-container").style.display = "none";
    const res = await fetch("/usuarios/admin");
    const users = await res.json();
    
    let html = `<div class="card-table"><table><tr><th>Email</th><th>Estado</th><th style="text-align:center;">Acciones</th></tr>`;
    users.forEach(u => {
        let estadoBadge = u.activo ? '<span style="color:var(--success); font-weight:bold;">🟢 Activo</span>' : '<span style="color:#d97706; font-weight:bold;">🟠 Pendiente</span>';
        
        html += `<tr>
            <td>${u.email}</td>
            <td>${estadoBadge}</td>
            <td style="text-align:center;">
                <div class="acciones-container">
                    ${!u.activo ? `<button class="accion-btn btn-save" onclick="aprobarUsuario('${u.id}')">Aprobar</button>` : ''} 
                    <button class="accion-btn btn-delete" onclick="borrarUsuario('${u.id}')">Borrar</button>
                </div>
            </td>
        </tr>`;
    });
    html += `</table></div>`;
    document.getElementById("main-content").innerHTML = html;
}

async function aprobarUsuario(id) { await fetch(`/usuarios/aprobar/${id}`, { method: "PATCH" }); cargarPanelControl(); }
async function borrarUsuario(id) { if(confirm("¿Eliminar usuario?")) { await fetch(`/usuarios/${id}`, { method: "DELETE" }); cargarPanelControl(); } }
