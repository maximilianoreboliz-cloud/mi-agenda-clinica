let modo = "ver";
let esRegistro = false;
let datosUsuario = null;

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('input').forEach(input => {
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') procesarFormulario();
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

    errorMsg.innerText = "";
    successMsg.innerText = "";

    if (!email || !password) {
        errorMsg.innerText = "Completa todos los campos.";
        return;
    }

    const endpoint = esRegistro ? "/registro" : "/login";
    try {
        const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (res.ok) {
            if (esRegistro) {
                successMsg.innerText = "Solicitud enviada. Un administrador debe aprobarla.";
                setTimeout(() => toggleModoFormulario(), 3000);
            } else {
                iniciarSesion(data.usuario);
            }
        } else {
            errorMsg.innerText = data.error || "Ocurrió un error.";
        }
    } catch (err) {
        errorMsg.innerText = "Error de conexión con el servidor.";
    }
}

async function iniciarSesion(usuario) {
    datosUsuario = usuario;
    document.getElementById("login-container").style.display = "none";
    document.getElementById("app").style.display = "flex";
    document.getElementById("user-email-display").innerText = usuario.email;

    if (usuario.es_admin) {
        document.getElementById("btn-panel").style.display = "block";
    } else {
        document.getElementById("btn-panel").style.display = "none";
    }

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

/* --- UTILIDADES --- */
async function cargarSectores() {
    const res = await fetch("/sectores");
    const sectores = await res.json();
    const select = document.getElementById("sector");
    select.innerHTML = "";
    sectores.forEach(s => {
        let o = document.createElement("option");
        o.value = s.nombre;
        o.innerText = s.nombre;
        select.appendChild(o);
    });
}

function actualizarBotonesMenu(activo) {
    document.querySelectorAll('.sidebar-nav button').forEach(b => b.classList.remove('active'));
    document.getElementById(activo)?.classList.add('active');
}

/* --- ADMIN --- */
async function cargarPanelControl() {
    actualizarBotonesMenu('btn-panel');
    document.getElementById("titulo-seccion").innerText = "Panel de Control - Usuarios Pendientes";
    document.getElementById("filtros-container").style.display = "none";

    const res = await fetch("/usuarios/pendientes");
    const pendientes = await res.json();

    let html = `<div class="card-table"><table>
        <tr><th>Email</th><th>Fecha de Solicitud</th><th>Acción</th></tr>`;
    
    if (pendientes.length === 0) {
        html += `<tr><td colspan="3" style="text-align:center">No hay solicitudes pendientes.</td></tr>`;
    } else {
        pendientes.forEach(u => {
            const fecha = new Date(u.creado_en).toLocaleDateString('es-ES');
            html += `<tr>
                <td>${u.email}</td>
                <td>${fecha}</td>
                <td><button class="accion-btn btn-save" onclick="aprobarUsuario('${u.id}')">✅ Aprobar</button></td>
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

/* --- PROFESIONALES --- */
async function pantallaProfesionales() {
    actualizarBotonesMenu();
    document.getElementById("titulo-seccion").innerText = "Gestión de Profesionales";
    document.getElementById("filtros-container").style.display = "none";

    const res = await fetch("/profesionales");
    const profesionales = await res.json();
    const resAus = await fetch("/ausencias");
    const ausencias = await resAus.json();

    let html = `
    <div class="flex-row">
        <input id="nuevoNombre" placeholder="Nombre del profesional..." style="margin:0; width:300px;">
        <button class="btn-primary" style="width:auto;" onclick="agregarProfesional()">+ Añadir</button>
    </div>
    <div class="card-table">
        <table>
            <tr>
                <th>Color</th>
                <th>Nombre</th>
                <th>Licencia (Desde - Hasta)</th>
                <th>Acciones</th>
            </tr>
    `;

    profesionales.forEach(p => {
        let licencia = ausencias.find(a => a.profesional_id === p.id) || { fecha_desde: '', fecha_hasta: '' };
        
        html += `
            <tr>
                <td style="width: 80px; text-align:center;">
                    <input type="color" class="color-picker" id="c_${p.id}" value="${p.color || '#e2e8f0'}" onchange="cambiarColor('${p.id}', this.value)">
                </td>
                <td><strong>${p.nombre}</strong></td>
                <td>
                    <div style="display:flex; gap:10px; align-items:center;">
                        <input type="date" id="d_${p.id}" value="${licencia.fecha_desde}" style="margin:0; width:140px;">
                        <span> a </span>
                        <input type="date" id="h_${p.id}" value="${licencia.fecha_hasta}" style="margin:0; width:140px;">
                        <button class="accion-btn btn-save" onclick="guardarLicencia('${p.id}')">Guardar</button>
                    </div>
                </td>
                <td style="width: 100px; text-align:center;">
                    <button class="accion-btn btn-delete" onclick="eliminarProfesional('${p.id}')">🗑️ Borrar</button>
                </td>
            </tr>
        `;
    });
    
    html += `</table></div>`;
    document.getElementById("main-content").innerHTML = html;
}

async function agregarProfesional() {
    const nombre = document.getElementById("nuevoNombre").value;
    if (!nombre) return alert("Ingrese un nombre");
    await fetch("/profesional", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre })
    });
    pantallaProfesionales();
}

async function cambiarColor(id, color) {
    await fetch(`/profesional/${id}/color`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ color })
    });
}

async function guardarLicencia(id) {
    const desde = document.getElementById("d_" + id).value;
    const hasta = document.getElementById("h_" + id).value;
    if (!desde || !hasta) return alert("Selecciona ambas fechas");
    await fetch("/licencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profesional_id: id, desde, hasta })
    });
    alert("Licencia guardada correctamente.");
    pantallaProfesionales(); // Refrescar para ver los cambios
}

async function eliminarProfesional(id) {
    if (!confirm("⚠️ Se borrará al profesional y sus turnos. ¿Continuar?")) return;
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
    document.getElementById("main-content").innerHTML = `
        <div class="empty-state">
            <h2>Selecciona Día y Sector</h2>
            <p>Luego presiona el botón "Buscar".</p>
        </div>`;
}

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
    const profesionales = await resProf.json();
    const ausencias = await resAus.json();

    dibujarAgenda(consultorios, agenda, profesionales, ausencias, dia, sector);
}

// CORRECCIÓN CLAVE: Función de licencia mejorada para evitar desfases de zona horaria
function estaEnLicencia(idProfesional, ausencias) {
    const licencia = ausencias.find(a => a.profesional_id === idProfesional);
    if (!licencia || !licencia.fecha_desde || !licencia.fecha_hasta) return false;
    
    // Obtenemos la fecha de hoy en formato local YYYY-MM-DD
    const hoyStr = new Date().toLocaleDateString('sv-SE'); // 'sv-SE' da formato YYYY-MM-DD

    if (hoyStr >= licencia.fecha_desde && hoyStr <= licencia.fecha_hasta) {
        return {
            activa: true,
            texto: `${licencia.fecha_desde.split('-').reverse().join('/')} al ${licencia.fecha_hasta.split('-').reverse().join('/')}`
        };
    }
    return false;
}

function dibujarAgenda(consultorios, agenda, profesionales, ausencias, dia, sector) {
    if(consultorios.length === 0) {
        document.getElementById("main-content").innerHTML = `<div class="empty-state"><h2>No hay consultorios</h2></div>`;
        return;
    }

    let horarios = [];
    for (let h = 8; h <= 18; h++) {
        horarios.push(`${String(h).padStart(2, "0")}:00`);
        horarios.push(`${String(h).padStart(2, "0")}:30`);
    }

    let html = `
    <h3 style="margin-bottom:20px;">🗓️ ${sector} | ${dia}</h3>
    <div class="card-table">
        <table class="tabla-agenda">
            <tr><th style="width:80px;">Hora</th>`;
    
    consultorios.forEach(c => { html += `<th>Cons. ${c.numero}</th>`; });
    html += "</tr>";

    horarios.forEach(h => {
        html += `<tr><td><strong>${h}</strong></td>`;
        consultorios.forEach(c => {
            let slot = agenda.find(a => a.horario == h && a.consultorio_id == c.id);
            
            if (modo === "editar") {
                html += `<td>
                    <select class="select-agenda" onchange="guardarAgenda('${c.id}','${h}',this.value)">
                        <option value="">- Libre -</option>
                        ${profesionales.map(p => {
                            const lic = estaEnLicencia(p.id, ausencias);
                            const label = lic ? `${p.nombre} (LICENCIA)` : p.nombre;
                            return `<option value="${p.id}" ${slot && slot.profesional_id == p.id ? "selected" : ""}>${label}</option>`;
                        }).join("")}
                    </select>
                </td>`;
            } else {
                if (slot) {
                    let p = profesionales.find(x => x.id == slot.profesional_id);
                    if(p) {
                        let lic = estaEnLicencia(p.id, ausencias);
                        if (lic && lic.activa) {
                            html += `<td class="slot-licencia" style="background-color:#ffebeb; border-left: 4px solid red;">
                                        <strong>${p.nombre}</strong><br><small style="color:red">LICENCIA<br>${lic.texto}</small>
                                     </td>`;
                        } else {
                            html += `<td class="slot-ocupado celda-drop" style="background-color: ${p.color || '#e2e8f0'};" 
                                         draggable="true" ondragstart="drag(event)" data-id="${p.id}">
                                         ${p.nombre}
                                     </td>`;
                        }
                    } else {
                        html += `<td class="slot-vacio">Error (Dr. Borrado)</td>`;
                    }
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

async function guardarAgenda(consultorio, horario, profesionalId) {
    const dia = document.getElementById("dia").value;
    const sector = document.getElementById("sector").value;
    await fetch("/agenda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consultorio_id: consultorio, profesional_id: profesionalId || null, horario, dia_semana: dia, sector })
    });
}

function drag(ev) { ev.dataTransfer.setData("id", ev.target.dataset.id); }
function allowDrop(ev) { ev.preventDefault(); }
async function drop(ev, consultorio, horario) {
    ev.preventDefault();
    let id = ev.dataTransfer.getData("id");
    if (!id) return;
    await guardarAgenda(consultorio, horario, id);
    verAgenda();
}
