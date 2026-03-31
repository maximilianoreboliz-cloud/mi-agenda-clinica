let modo = "ver";
let esRegistro = false;
let datosUsuario = null;
let listaProfesionalesGlobal = [];

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('input').forEach(input => {
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') procesarFormulario();
        });
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.custom-select-container')) {
            document.querySelectorAll('.custom-dropdown-menu').forEach(m => m.style.display = 'none');
        }
    });
});

/* --- LOGIN Y REGISTRO --- */
function toggleModoFormulario() {
    esRegistro = !esRegistro;
    document.getElementById("form-title").innerText = esRegistro ? "Crear Cuenta" : "Ingreso al Sistema";
    document.getElementById("btn-submit").innerText = esRegistro ? "Solicitar Cuenta" : "Ingresar";
    document.getElementById("toggle-text").innerHTML = esRegistro 
        ? '¿Ya tienes cuenta? <a href="#" onclick="toggleModoFormulario()">Ingresar</a>' 
        : '¿No tienes cuenta? <a href="#" onclick="toggleModoFormulario()">Solicitar acceso</a>';
    document.getElementById("error-msg").innerText = "";
    document.getElementById("success-msg").innerText = "";
}

async function procesarFormulario() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const errorMsg = document.getElementById("error-msg");
    const successMsg = document.getElementById("success-msg");
    errorMsg.innerText = ""; successMsg.innerText = "";

    if (!email || !password) return errorMsg.innerText = "Completa todos los campos.";
    
    const endpoint = esRegistro ? "/registro" : "/login";
    try {
        const res = await fetch(endpoint, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (res.ok) {
            if (esRegistro) {
                successMsg.innerText = "Solicitud enviada. Un administrador debe aprobarla.";
                setTimeout(() => toggleModoFormulario(), 3000);
            } else { iniciarSesion(data.usuario); }
        } else { errorMsg.innerText = data.error || "Ocurrió un error."; }
    } catch (err) { errorMsg.innerText = "Error de conexión con el servidor."; }
}

async function iniciarSesion(usuario) {
    datosUsuario = usuario;
    document.getElementById("login-container").style.display = "none";
    document.getElementById("app").style.display = "flex";
    document.getElementById("user-email-display").innerText = usuario.email;
    document.getElementById("btn-panel").style.display = usuario.es_admin ? "block" : "none";
    await cargarSectores();
    document.getElementById("titulo-seccion").innerText = "Bienvenido";
    document.getElementById("main-content").innerHTML = `
        <div class="empty-state">
            <h2>¡Hola, ${usuario.email.split('@')[0]}!</h2>
            <p>Selecciona una opción del menú lateral para comenzar.</p>
        </div>`;
}

function cerrarSesion() {
    datosUsuario = null;
    document.getElementById("app").style.display = "none";
    document.getElementById("login-container").style.display = "flex";
    document.getElementById("email").value = "";
    document.getElementById("password").value = "";
}

/* --- UTILIDADES SIDEBAR --- */
async function cargarSectores() {
    const res = await fetch("/sectores");
    const sectores = await res.json();
    const select = document.getElementById("sector");
    select.innerHTML = "";
    sectores.forEach(s => {
        let o = document.createElement("option");
        o.value = s.nombre; o.innerText = s.nombre; select.appendChild(o);
    });
}

function actualizarBotonesMenu(activo) {
    document.querySelectorAll('.sidebar-nav button').forEach(b => b.classList.remove('active'));
    if(activo) document.getElementById(activo)?.classList.add('active');
}

/* --- PANEL DE CONTROL (ADMIN) --- */
async function cargarPanelControl() {
    actualizarBotonesMenu('btn-panel');
    document.getElementById("titulo-seccion").innerText = "Panel de Control de Usuarios";
    document.getElementById("filtros-container").style.display = "none";
    const res = await fetch("/usuarios/admin");
    const usuarios = await res.json();
    let html = `
        <h3 style="margin-bottom:15px; color:var(--text-main);">Gestión de Accesos</h3>
        <div class="card-table"><table>
        <tr><th>Email</th><th>Estado</th><th>Fecha Alta</th><th style="text-align:center;">Acciones</th></tr>`;
    
    if (usuarios.length === 0) {
        html += `<tr><td colspan="4" style="text-align:center">No hay usuarios en el sistema.</td></tr>`;
    } else {
        usuarios.forEach(u => {
            const fecha = new Date(u.creado_en).toLocaleDateString('es-ES');
            const estado = u.activo 
                ? `<span style="color:var(--success); font-weight:bold;">Activo</span>` 
                : `<span style="color:#d97706; font-weight:bold;">Pendiente</span>`;
            const btnAprobar = !u.activo ? `<button class="accion-btn btn-save" onclick="aprobarUsuario('${u.id}')">Aprobar</button>` : '';
            html += `<tr>
                <td>${u.email}</td><td>${estado}</td><td>${fecha}</td>
                <td>
                    <div class="acciones-container">
                        ${btnAprobar}
                        <button class="accion-btn btn-delete" onclick="eliminarUsuario('${u.id}')">Borrar</button>
                    </div>
                </td>
            </tr>`;
        });
    }
    html += `</table></div>`;
    document.getElementById("main-content").innerHTML = html;
}

async function aprobarUsuario(id) {
    if(!confirm("¿Aprobar acceso a este usuario?")) return;
    await fetch(`/usuarios/aprobar/${id}`, { method: "PATCH" });
    cargarPanelControl();
}

async function eliminarUsuario(id) {
    if(!confirm("¿Borrar usuario permanentemente?")) return;
    await fetch(`/usuarios/${id}`, { method: "DELETE" });
    cargarPanelControl();
}

/* --- PROFESIONALES --- */
async function pantallaProfesionales() {
    actualizarBotonesMenu();
    document.getElementById("titulo-seccion").innerText = "Gestión de Profesionales";
    document.getElementById("filtros-container").style.display = "none";
    const [resProf, resAus] = await Promise.all([fetch("/profesionales"), fetch("/ausencias")]);
    const profesionales = await resProf.json();
    const ausencias = await resAus.json();
    
    let html = `
        <div class="flex-row" style="align-items: flex-start;">
            <div><input id="nuevoNombre" placeholder="Nombre del profesional..." style="margin:0; width:220px;"></div>
            <div>
                <input id="nuevasEsp" placeholder="Especialidades (Ej: Neuro, General)" style="margin:0; width:250px;">
                <div style="font-size:11px; color:var(--text-muted); margin-top:3px;">* Separa con comas ( , )</div>
            </div>
            <button class="btn-primary" style="width:auto; height: 42px;" onclick="agregarProfesional()">+ Añadir</button>
        </div>
        <div class="card-table">
        <table>
        <tr><th style="width:60px;">Color</th><th>Nombre y Especialidades</th><th>Licencia (Desde - Hasta)</th><th style="text-align:center; width:220px;">Acciones</th></tr>`;

    profesionales.forEach(p => {
        let licencia = ausencias.find(a => a.profesional_id === p.id) || { fecha_desde: '', fecha_hasta: '' };
        let especialidadesVista = p.especialidades ? p.especialidades.split(',').join(' <span style="color:#cbd5e1;">|</span> ') : '<span style="color:#94a3b8; font-size:12px;">Sin especialidad</span>';
        html += `
        <tr>
            <td style="text-align:center;">
                <input type="color" class="color-picker" id="c_${p.id}" value="${p.color || '#e2e8f0'}" onchange="cambiarColor('${p.id}', this.value)">
            </td>
            <td>
                <div id="vista_datos_${p.id}">
                    <strong>${p.nombre}</strong><br>
                    <small style="color:var(--primary); font-weight:600;">${especialidadesVista}</small>
                </div>
                <div id="edit_datos_${p.id}" style="display:none; flex-direction:column; gap:5px;">
                    <input id="edit_nom_${p.id}" value="${p.nombre}" style="margin:0; padding:6px; font-size:14px;">
                    <input id="edit_esp_${p.id}" value="${p.especialidades || ''}" placeholder="Ej: Neurología, General" style="margin:0; padding:6px; font-size:12px;">
                </div>
            </td>
            <td>
                <div style="display:flex; gap:10px; align-items:center;">
                    <input type="date" id="d_${p.id}" value="${licencia.fecha_desde}" style="margin:0; width:125px; font-size:12px;">
                    <span>a</span>
                    <input type="date" id="h_${p.id}" value="${licencia.fecha_hasta}" style="margin:0; width:125px; font-size:12px;">
                    <button class="accion-btn btn-save" style="min-width:70px; height:30px;" onclick="guardarLicencia('${p.id}')">OK</button>
                </div>
            </td>
            <td>
                <div class="acciones-container">
                    <button id="btn_edit_${p.id}" class="accion-btn btn-edit-action" onclick="habilitarEdicionProf('${p.id}')">Editar</button>
                    <button id="btn_save_${p.id}" class="accion-btn btn-save" style="display:none;" onclick="guardarEdicionProf('${p.id}')">Guardar</button>
                    <button class="accion-btn btn-delete" onclick="eliminarProfesional('${p.id}')">Borrar</button>
                </div>
            </td>
        </tr>`;
    });
    html += `</table></div>`;
    document.getElementById("main-content").innerHTML = html;
}

async function agregarProfesional() {
    const nombre = document.getElementById("nuevoNombre").value;
    const especialidades = document.getElementById("nuevasEsp").value;
    if (!nombre) return alert("Ingrese un nombre");
    await fetch("/profesional", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, especialidades })
    });
    pantallaProfesionales();
}

function habilitarEdicionProf(id) {
    document.getElementById(`vista_datos_${id}`).style.display = 'none';
    document.getElementById(`edit_datos_${id}`).style.display = 'flex';
    document.getElementById(`btn_edit_${id}`).style.display = 'none';
    document.getElementById(`btn_save_${id}`).style.display = 'inline-block';
}

async function guardarEdicionProf(id) {
    const nombre = document.getElementById(`edit_nom_${id}`).value;
    const especialidades = document.getElementById(`edit_esp_${id}`).value;
    await fetch(`/profesional/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, especialidades })
    });
    pantallaProfesionales();
}

async function cambiarColor(id, color) {
    await fetch(`/profesional/${id}/color`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ color }) });
}

async function guardarLicencia(id) {
    const desde = document.getElementById("d_" + id).value;
    const hasta = document.getElementById("h_" + id).value;
    await fetch("/licencia", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profesional_id: id, desde, hasta }) });
    alert("Licencia actualizada.");
    pantallaProfesionales();
}

async function eliminarProfesional(id) {
    if (!confirm("¿Borrar profesional y sus turnos?")) return;
    await fetch(`/profesional/${id}`, { method: "DELETE" });
    pantallaProfesionales();
}

/* --- AGENDA --- */
function pantallaVerAgenda() {
    modo = "ver";
    actualizarBotonesMenu('btn-ver');
    prepararVistaAgenda("Visor de Agenda");
}

function pantallaModificarAgenda() {
    modo = "editar";
    actualizarBotonesMenu('btn-editar');
    prepararVistaAgenda("Edición de Agenda");
}

function prepararVistaAgenda(titulo) {
    document.getElementById("titulo-seccion").innerText = titulo;
    document.getElementById("filtros-container").style.display = "block";
    document.getElementById("main-content").innerHTML = `<div class="empty-state"><h2>Selecciona Día y Sector</h2></div>`;
}

function ejecutarBusqueda() { verAgenda(); }

async function verAgenda() {
    const dia = document.getElementById("dia").value;
    const sector = document.getElementById("sector").value;
    const [resCons, resAg, resProf, resAus] = await Promise.all([
        fetch(`/consultorios?sector=${sector}`),
        fetch(`/agenda?dia=${dia}&sector=${sector}`),
        fetch(`/profesionales`),
        fetch(`/ausencias`)
    ]);
    const consultorios = await resCons.json();
    const agenda = await resAg.json();
    listaProfesionalesGlobal = await resProf.json();
    const ausencias = await resAus.json();
    dibujarAgenda(consultorios, agenda, ausencias, dia, sector);
}

function estaEnLicencia(idProfesional, ausencias) {
    const licencia = ausencias.find(a => a.profesional_id === idProfesional);
    if (!licencia || !licencia.fecha_desde || !licencia.fecha_hasta) return false;
    const hoyStr = new Date().toLocaleDateString('sv-SE');
    if (hoyStr >= licencia.fecha_desde && hoyStr <= licencia.fecha_hasta) {
        return { activa: true, texto: `${licencia.fecha_desde.split('-').reverse().join('/')} al ${licencia.fecha_hasta.split('-').reverse().join('/')}` };
    }
    return false;
}

// NUEVA FUNCIÓN PARA FILTRADO DE MENÚS
function filtrarMenu(input, menuId) {
    const term = input.value.toLowerCase();
    const items = document.querySelectorAll(`#menu_${menuId} .menu-list-items > li`);
    items.forEach(li => {
        // No ocultamos la opción "- Libre -"
        if (li.textContent === "- Libre -") return;
        
        const texto = li.textContent.toLowerCase();
        li.style.display = texto.includes(term) ? "flex" : "none";
    });
}

function dibujarAgenda(consultorios, agenda, ausencias, dia, sector) {
    if(consultorios.length === 0) {
        document.getElementById("main-content").innerHTML = `<div class="empty-state"><h2>No hay consultorios</h2></div>`; return;
    }
    
    let horarios = [];
    for (let h = 8; h <= 19; h++) {
        horarios.push(`${String(h).padStart(2, "0")}:00`);
        if(h !== 19) horarios.push(`${String(h).padStart(2, "0")}:30`);
    }

    let html = `<h3 style="margin-bottom:20px;"> Sector: ${sector} | Día: ${dia}</h3>
        <div class="card-table" style="overflow-x: auto; overflow-y: visible;">
        <table class="tabla-agenda">
        <tr><th style="width:70px;">Hora</th>`;
    consultorios.forEach(c => { html += `<th>Cons. ${c.numero}</th>`; });
    html += "</tr>";

    horarios.forEach(h => {
        let h_str = h.replace(':', '_');
        html += `<tr><td><strong>${h}</strong></td>`;
        consultorios.forEach(c => {
            let slot = agenda.find(a => a.horario == h && a.consultorio_id == c.id);
            
            if (modo === "editar") {
                let selectedText = "- Libre -";
                if (slot && slot.profesional_id) {
                    let p = listaProfesionalesGlobal.find(x => x.id === slot.profesional_id);
                    if (p) {
                        let lic = estaEnLicencia(p.id, ausencias);
                        if (lic && lic.activa) selectedText = `${p.nombre} (LIC)`;
                        else selectedText = slot.especialidad ? `${p.nombre} - ${slot.especialidad}` : p.nombre;
                    }
                }

                // ESTRUCTURA CON BUSCADOR INTEGRADO
                let menuHtml = `
                    <div class="custom-dropdown-menu" id="menu_${c.id}_${h_str}">
                        <div class="menu-search-container">
                            <input type="text" class="menu-search-input" placeholder="🔍 Buscar..." 
                                   onkeyup="filtrarMenu(this, '${c.id}_${h_str}')" 
                                   onclick="event.stopPropagation()">
                        </div>
                        <ul class="menu-list-items">
                            <li onclick="seleccionarOpcionTurno('${c.id}', '${h_str}', null, null)">- Libre -</li>`;
                
                listaProfesionalesGlobal.forEach(p => {
                    let lic = estaEnLicencia(p.id, ausencias);
                    let isLic = lic && lic.activa;
                    let label = isLic ? `${p.nombre} (LIC)` : p.nombre;
                    
                    if (p.especialidades && !isLic) {
                        let esps = p.especialidades.split(',').map(e => e.trim()).filter(e=>e);
                        if (esps.length > 0) {
                            menuHtml += `<li class="has-submenu">${label} <span> ▶ </span><ul class="custom-submenu">${esps.map(e => `<li onclick="seleccionarOpcionTurno('${c.id}', '${h_str}', '${p.id}', '${e}')">${e}</li>`).join('')}</ul></li>`;
                        } else { 
                            menuHtml += `<li onclick="seleccionarOpcionTurno('${c.id}', '${h_str}', '${p.id}', null)">${label}</li>`; 
                        }
                    } else { 
                        menuHtml += `<li onclick="seleccionarOpcionTurno('${c.id}', '${h_str}', '${p.id}', null)">${label}</li>`; 
                    }
                });
                
                menuHtml += `</ul></div>`;
                html += `<td style="vertical-align: top;"><div class="custom-select-container"><div class="custom-select-box" onclick="toggleCustomMenu('${c.id}_${h_str}', event)">${selectedText}</div>${menuHtml}</div></td>`;
                
            } else {
                if (slot && slot.profesional_id) {
                    let p = listaProfesionalesGlobal.find(x => x.id == slot.profesional_id);
                    if(p) {
                        let lic = estaEnLicencia(p.id, ausencias);
                        let subtexto = slot.especialidad ? `<br><small style="opacity:0.8; font-size:10px;">${slot.especialidad}</small>` : '';
                        if (lic && lic.activa) {
                            html += `<td class="slot-licencia" style="background-color:#ffebeb; border-left: 4px solid red; font-size:0.75em;"><strong>${p.nombre}</strong><br>LICENCIA</td>`;
                        } else {
                            html += `<td class="slot-ocupado celda-drop" style="background-color: ${p.color || '#e2e8f0'};" draggable="true" ondragstart="drag(event)" data-id="${p.id}" data-esp="${slot.especialidad || ''}"><div class="truncate-text">${p.nombre}${subtexto}</div></td>`;
                        }
                    } else { html += `<td class="slot-vacio">Error</td>`; }
                } else { html += `<td class="slot-vacio celda-drop" ondragover="allowDrop(event)" ondrop="drop(event,'${c.id}','${h}')">Libre</td>`; }
            }
        });
        html += "</tr>";
    });
    html += `</table></div>`;
    document.getElementById("main-content").innerHTML = html;
}

function toggleCustomMenu(idStr, event) {
    event.stopPropagation();
    document.querySelectorAll('.custom-dropdown-menu').forEach(m => { 
        if (m.id !== `menu_${idStr}`) m.style.display = 'none'; 
    });
    const menu = document.getElementById(`menu_${idStr}`);
    const isHidden = menu.style.display === 'none' || menu.style.display === '';
    menu.style.display = isHidden ? 'block' : 'none';
    
    // Al abrir, limpiar el buscador y enfocarlo
    if (isHidden) {
        const input = menu.querySelector('.menu-search-input');
        input.value = '';
        filtrarMenu(input, idStr); // Resetear visibilidad
        setTimeout(() => input.focus(), 50);
    }
}

async function seleccionarOpcionTurno(c_id, h_str, profId, especialidad) {
    document.getElementById(`menu_${c_id}_${h_str}`).style.display = 'none';
    const dia = document.getElementById("dia").value;
    const sector = document.getElementById("sector").value;
    await fetch("/agenda", { 
        method: "POST", headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ 
            consultorio_id: c_id, 
            profesional_id: profId || null, 
            especialidad: especialidad || null, 
            horario: h_str.replace('_', ':'), 
            dia_semana: dia, 
            sector 
        }) 
    });
    verAgenda();
}

function drag(ev) { ev.dataTransfer.setData("id", ev.target.dataset.id); ev.dataTransfer.setData("esp", ev.target.dataset.esp); }
function allowDrop(ev) { ev.preventDefault(); }
async function drop(ev, consultorio, horario) {
    ev.preventDefault();
    let id = ev.dataTransfer.getData("id");
    let esp = ev.dataTransfer.getData("esp");
    if (!id) return;
    const dia = document.getElementById("dia").value;
    const sector = document.getElementById("sector").value;
    await fetch("/agenda", { 
        method: "POST", headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ 
            consultorio_id: consultorio, 
            profesional_id: id, 
            especialidad: esp || null, 
            horario: horario, 
            dia_semana: dia, 
            sector 
        }) 
    });
    verAgenda();
}
