let modo = "ver";
let esRegistro = false;
let datosUsuario = null;
window.datosProfesionales = []; // Global para acceso rápido en selects de agenda

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('input').forEach(input => {
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && (this.id === 'email' || this.id === 'password')) procesarFormulario();
        });
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
    document.getElementById("main-content").innerHTML = `<div class="empty-state"><h2>¡Hola, ${usuario.email.split('@')[0]}!</h2><p>Selecciona una opción del menú lateral para comenzar.</p></div>`;
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
    sectores.forEach(s => { select.innerHTML += `<option value="${s.nombre}">${s.nombre}</option>`; });
}

function actualizarBotonesMenu(activo) {
    document.querySelectorAll('.sidebar-nav button').forEach(b => b.classList.remove('active'));
    document.getElementById(activo)?.classList.add('active');
}

/* --- PANEL DE CONTROL (ADMIN) --- */
async function cargarPanelControl() {
    actualizarBotonesMenu('btn-panel');
    document.getElementById("titulo-seccion").innerText = "Panel de Control de Usuarios";
    document.getElementById("filtros-container").style.display = "none";

    const [resPend, resAprob] = await Promise.all([fetch("/usuarios/pendientes"), fetch("/usuarios/aprobados")]);
    const pendientes = await resPend.json();
    const aprobados = await resAprob.json();

    let html = `<h3>Solicitudes Pendientes</h3><div class="card-table" style="margin-bottom:30px;"><table><tr><th>Email</th><th>Fecha</th><th>Acción</th></tr>`;
    if (pendientes.length === 0) { html += `<tr><td colspan="3" style="text-align:center">No hay solicitudes pendientes.</td></tr>`; } 
    else {
        pendientes.forEach(u => {
            html += `<tr><td>${u.email}</td><td>${new Date(u.creado_en).toLocaleDateString('es-ES')}</td>
            <td><button class="accion-btn btn-save" onclick="aprobarUsuario('${u.id}')">✅ Aprobar</button></td></tr>`;
        });
    }
    html += `</table></div><h3>Usuarios Activos</h3><div class="card-table"><table><tr><th>Email</th><th>Rol</th><th>Acción</th></tr>`;
    aprobados.forEach(u => {
        let btnBorrar = u.es_admin ? `<span style="color:#94a3b8; font-size:12px;">Admin General</span>` : `<button class="accion-btn btn-delete" onclick="borrarUsuario('${u.id}')">🗑️ Revocar Acceso</button>`;
        html += `<tr><td>${u.email}</td><td>${u.es_admin ? 'Administrador' : 'Usuario'}</td><td>${btnBorrar}</td></tr>`;
    });
    html += `</table></div>`;
    document.getElementById("main-content").innerHTML = html;
}

async function aprobarUsuario(id) {
    if(!confirm("¿Aprobar acceso a este usuario?")) return;
    await fetch(`/usuarios/aprobar/${id}`, { method: "PATCH" });
    cargarPanelControl();
}

async function borrarUsuario(id) {
    if(!confirm("⚠️ ¿Estás seguro de que quieres eliminar el acceso a este usuario?")) return;
    await fetch(`/usuarios/${id}`, { method: "DELETE" });
    cargarPanelControl();
}

/* --- PROFESIONALES --- */
async function pantallaProfesionales() {
    actualizarBotonesMenu();
    document.getElementById("titulo-seccion").innerText = "Gestión de Profesionales y Especialidades";
    document.getElementById("filtros-container").style.display = "none";

    const res = await fetch("/profesionales");
    const profesionales = await res.json();
    const resAus = await fetch("/ausencias");
    const ausencias = await resAus.json();

    let html = `
    <div class="flex-row" style="flex-wrap: wrap;">
        <input id="nuevoNombre" placeholder="Nombre del médico..." style="margin:0; width:250px;">
        <input id="nuevasEsp" placeholder="Especialidades (ej: Neurología, General)..." style="margin:0; width:300px;">
        <button class="btn-primary" style="width:auto;" onclick="agregarProfesional()">+ Añadir</button>
    </div>
    <div class="card-table">
        <table>
            <tr><th style="width:60px;">Color</th><th>Profesional y Especialidades</th><th>Licencia (Desde - Hasta)</th><th style="width:180px;">Acciones</th></tr>`;

    profesionales.forEach(p => {
        let licencia = ausencias.find(a => a.profesional_id === p.id) || { fecha_desde: '', fecha_hasta: '' };
        let especialidadesText = p.especialidades ? p.especialidades : '<em style="color:#94a3b8; font-size:12px;">Sin especialidad cargada</em>';
        
        html += `
            <tr id="row_${p.id}">
                <td style="text-align:center;"><input type="color" class="color-picker" id="c_${p.id}" value="${p.color || '#e2e8f0'}" onchange="cambiarColor('${p.id}', this.value)"></td>
                <td>
                    <div id="vista_datos_${p.id}">
                        <strong>${p.nombre}</strong><br>
                        <small style="color:var(--primary);">${especialidadesText}</small>
                    </div>
                    <div id="edit_datos_${p.id}" style="display:none; flex-direction:column; gap:5px;">
                        <input id="edit_nom_${p.id}" value="${p.nombre}" style="margin:0; padding:6px; font-size:14px;">
                        <input id="edit_esp_${p.id}" value="${p.especialidades || ''}" placeholder="Especialidades..." style="margin:0; padding:6px; font-size:12px;">
                    </div>
                </td>
                <td>
                    <div style="display:flex; gap:10px; align-items:center;">
                        <input type="date" id="d_${p.id}" value="${licencia.fecha_desde}" style="margin:0; width:130px; font-size:12px;"><span>a</span><input type="date" id="h_${p.id}" value="${licencia.fecha_hasta}" style="margin:0; width:130px; font-size:12px;">
                        <button class="accion-btn btn-save" onclick="guardarLicencia('${p.id}')">Guardar</button>
                    </div>
                </td>
                <td style="text-align:center;">
                    <button id="btn_edit_${p.id}" class="accion-btn btn-primary" onclick="habilitarEdicionProf('${p.id}')">✏️ Editar</button>
                    <button id="btn_save_${p.id}" class="accion-btn btn-save" style="display:none;" onclick="guardarEdicionProf('${p.id}')">💾 OK</button>
                    <button class="accion-btn btn-delete" onclick="eliminarProfesional('${p.id}')">🗑️</button>
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
    if(!nombre) return alert("El nombre no puede quedar vacío.");

    await fetch(`/profesional/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, especialidades })
    });
    pantallaProfesionales();
}

async function cambiarColor(id, color) { await fetch(`/profesional/${id}/color`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ color }) }); }

async function guardarLicencia(id) {
    const desde = document.getElementById("d_" + id).value;
    const hasta = document.getElementById("h_" + id).value;
    await fetch("/licencia", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profesional_id: id, desde, hasta }) });
    alert("Licencia actualizada.");
    pantallaProfesionales();
}

async function eliminarProfesional(id) {
    if (!confirm("⚠️ ATENCIÓN: Esto borrará al profesional y sus turnos. ¿Continuar?")) return;
    await fetch(`/profesional/${id}`, { method: "DELETE" });
    pantallaProfesionales();
}

/* --- AGENDA (VER Y MODIFICAR) --- */
function pantallaVerAgenda() { modo = "ver"; actualizarBotonesMenu('btn-ver'); prepararVistaAgenda("Visor de Agenda"); }
function pantallaModificarAgenda() { modo = "editar"; actualizarBotonesMenu('btn-editar'); prepararVistaAgenda("Edición de Agenda"); }

function prepararVistaAgenda(titulo) {
    document.getElementById("titulo-seccion").innerText = titulo;
    document.getElementById("filtros-container").style.display = "block";
    document.getElementById("main-content").innerHTML = `<div class="empty-state"><h2>Selecciona Día y Sector</h2><p>Luego presiona el botón "Buscar".</p></div>`;
}

function ejecutarBusqueda() { verAgenda(); }

async function verAgenda() {
    const dia = document.getElementById("dia").value;
    const sector = document.getElementById("sector").value;
    
    const [resCons, resAg, resProf, resAus] = await Promise.all([
        fetch(`/consultorios?sector=${sector}`), fetch(`/agenda?dia=${dia}&sector=${sector}`),
        fetch(`/profesionales`), fetch(`/ausencias`)
    ]);

    const consultorios = await resCons.json();
    const agenda = await resAg.json();
    window.datosProfesionales = await resProf.json();
    const ausencias = await resAus.json();

    dibujarAgenda(consultorios, agenda, window.datosProfesionales, ausencias, dia, sector);
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

// Auxiliares para las listas de especialidades
function tieneEspecialidades(idProf) {
    const p = window.datosProfesionales.find(x => x.id === idProf);
    return p && p.especialidades && p.especialidades.trim() !== "";
}

function generarOptionsEspecialidades(idProf, espSeleccionada) {
    if (!idProf) return '<option value="">- Gral -</option>';
    const p = window.datosProfesionales.find(x => x.id === idProf);
    if (!p || !p.especialidades) return '<option value="">- Gral -</option>';

    const espArray = p.especialidades.split(',').map(e => e.trim()).filter(e => e !== "");
    let options = '<option value="">- General -</option>';
    espArray.forEach(e => { options += `<option value="${e}" ${espSeleccionada === e ? 'selected' : ''}>${e}</option>`; });
    return options;
}

function handleDocChange(consultorio, horario) {
    const docSelect = document.getElementById(`sel_doc_${consultorio}_${horario.replace(':','')}`);
    const espSelect = document.getElementById(`sel_esp_${consultorio}_${horario.replace(':','')}`);
    const idProf = docSelect.value;

    if (!idProf || !tieneEspecialidades(idProf)) {
        espSelect.style.display = 'none';
        espSelect.innerHTML = '<option value="">- Gral -</option>';
    } else {
        espSelect.innerHTML = generarOptionsEspecialidades(idProf, null);
        espSelect.style.display = 'block';
    }
    guardarAgendaFinal(consultorio, horario);
}

async function guardarAgendaFinal(consultorio, horario) {
    const idProf = document.getElementById(`sel_doc_${consultorio}_${horario.replace(':','')}`).value;
    const esp = document.getElementById(`sel_esp_${consultorio}_${horario.replace(':','')}`).value;
    const dia = document.getElementById("dia").value;
    const sector = document.getElementById("sector").value;
    
    await fetch("/agenda", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consultorio_id: consultorio, profesional_id: idProf || null, especialidad: esp || null, horario, dia_semana: dia, sector })
    });
}

function dibujarAgenda(consultorios, agenda, profesionales, ausencias, dia, sector) {
    if(consultorios.length === 0) {
        document.getElementById("main-content").innerHTML = `<div class="empty-state"><h2>No hay consultorios</h2></div>`; return;
    }

    let horarios = [];
    for (let h = 8; h <= 19; h++) {
        horarios.push(`${String(h).padStart(2, "0")}:00`);
        if(h < 19) horarios.push(`${String(h).padStart(2, "0")}:30`);
    }

    let html = `<h3 style="margin-bottom:20px;">🗓️ Sector: ${sector} | Día: ${dia}</h3>
    <div class="card-table"><table class="tabla-agenda"><tr><th style="width:70px;">Hora</th>`;
    
    consultorios.forEach(c => { html += `<th>Cons. ${c.numero}</th>`; });
    html += "</tr>";

    horarios.forEach(h => {
        const idH = h.replace(':',''); // Para IDs HTML limpios
        html += `<tr><td><strong>${h}</strong></td>`;
        consultorios.forEach(c => {
            let slot = agenda.find(a => a.horario == h && a.consultorio_id == c.id);
            
            if (modo === "editar") {
                let showEsp = slot && slot.profesional_id && tieneEspecialidades(slot.profesional_id);
                html += `<td style="vertical-align: top;">
                    <select class="select-agenda" id="sel_doc_${c.id}_${idH}" onchange="handleDocChange('${c.id}','${h}')">
                        <option value="">- Libre -</option>
                        ${profesionales.map(p => {
                            const lic = estaEnLicencia(p.id, ausencias);
                            return `<option value="${p.id}" ${slot && slot.profesional_id == p.id ? "selected" : ""}>${lic ? p.nombre+' (LIC)' : p.nombre}</option>`;
                        }).join("")}
                    </select>
                    <select class="select-agenda select-esp" id="sel_esp_${c.id}_${idH}" onchange="guardarAgendaFinal('${c.id}','${h}')" style="${showEsp ? 'margin-top:6px;' : 'display:none;'} background-color: #f8fafc; font-size: 11px;">
                        ${generarOptionsEspecialidades(slot ? slot.profesional_id : null, slot ? slot.especialidad : null)}
                    </select>
                </td>`;
            } else {
                if (slot) {
                    let p = profesionales.find(x => x.id == slot.profesional_id);
                    if(p) {
                        let lic = estaEnLicencia(p.id, ausencias);
                        if (lic && lic.activa) {
                            html += `<td class="slot-licencia" style="padding:5px;">
                                        <strong>${p.nombre}</strong><br><span style="color:red; font-weight:bold;">LICENCIA</span><br><small style="color: #666;">${lic.texto}</small>
                                     </td>`;
                        } else {
                            let textoEsp = slot.especialidad ? `<br><small style="color:#1d4ed8; font-weight:bold; font-size:11px;">${slot.especialidad}</small>` : '';
                            html += `<td class="slot-ocupado celda-drop" style="background-color: ${p.color || '#e2e8f0'}; padding:8px 5px;" 
                                         draggable="true" ondragstart="drag(event)" data-id="${p.id}">
                                         <strong>${p.nombre}</strong>${textoEsp}
                                     </td>`;
                        }
                    } else { html += `<td class="slot-vacio">Error (Dr. Borrado)</td>`; }
                } else {
                    html += `<td class="slot-vacio celda-drop" ondragover="allowDrop(event)" ondrop="drop(event,'${c.id}','${h}')">Libre</td>`;
                }
            }
        });
        html += "</tr>";
    });
    html += `</table></div>`;
    document.getElementById("main-content").innerHTML = html;
}

function drag(ev) { ev.dataTransfer.setData("id", ev.target.dataset.id); }
function allowDrop(ev) { ev.preventDefault(); }
async function drop(ev, consultorio, horario) {
    ev.preventDefault();
    let id = ev.dataTransfer.getData("id");
    if (!id) return;
    const dia = document.getElementById("dia").value;
    const sector = document.getElementById("sector").value;
    await fetch("/agenda", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ consultorio_id: consultorio, profesional_id: id, especialidad: null, horario, dia_semana: dia, sector }) });
    verAgenda();
}
