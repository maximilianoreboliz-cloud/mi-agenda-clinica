let modo = "ver";
let esRegistro = false;
let datosUsuario = null;

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    // Evitar envío de formularios accidentales
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

    // Mostrar panel de control solo si es admin
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

/* --- UTILIDADES SIDEBAR --- */
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

/* --- PANEL DE CONTROL (ADMIN) --- */
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
    actualizarBotonesMenu(); // Sin clase activa en agenda
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
        // Buscar si tiene licencia cargada (para rellenar los inputs)
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
                    <button class="accion-btn btn-delete" title="Borrar profesional y sus turnos" onclick="eliminarProfesional('${p.id}')">🗑️ Borrar</button>
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
}

async function eliminarProfesional(id) {
    if (!confirm("⚠️ ATENCIÓN: Esto borrará al profesional y vaciará TODOS los consultorios que ocupa actualmente en la agenda. ¿Estás seguro?")) return;
    await fetch(`/profesional/${id}`, { method: "DELETE" });
    pantallaProfesionales();
}

/* --- AGENDA (VER Y MODIFICAR) --- */
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
            <p>Luego presiona el botón "Buscar" para cargar la grilla.</p>
        </div>`;
}

function ejecutarBusqueda() {
    verAgenda();
}

async function verAgenda() {
    const dia = document.getElementById("dia").value;
    const sector = document.getElementById("sector").value;
    
    // Obtener datos
    const resCons = await fetch(`/consultorios?sector=${sector}`);
    const consultorios = await resCons.json();
    
    const resAg = await fetch(`/agenda?dia=${dia}&sector=${sector}`);
    const agenda = await resAg.json();
    
    const resProf = await fetch(`/profesionales`);
    const profesionales = await resProf.json();

    const resAus = await fetch(`/ausencias`);
    const ausencias = await resAus.json();

    dibujarAgenda(consultorios, agenda, profesionales, ausencias, dia, sector);
}

// Función auxiliar para saber si una fecha está dentro de un rango
function estaEnLicencia(idProfesional, ausencias) {
    const licencia = ausencias.find(a => a.profesional_id === idProfesional);
    if (!licencia) return false;
    
    const hoy = new Date();
    // Ajuste de zona horaria para evitar desfases (ponemos hora a 00:00:00)
    hoy.setHours(0,0,0,0);
    
    // Convertir las fechas que vienen de DB ("YYYY-MM-DD")
    const desde = new Date(licencia.fecha_desde + "T00:00:00");
    const hasta = new Date(licencia.fecha_hasta + "T23:59:59"); // Hasta el final del dia

    if (hoy >= desde && hoy <= hasta) {
        return {
            activa: true,
            texto: `${licencia.fecha_desde.split('-').reverse().join('/')} a ${licencia.fecha_hasta.split('-').reverse().join('/')}`
        };
    }
    return false;
}

function dibujarAgenda(consultorios, agenda, profesionales, ausencias, dia, sector) {
    if(consultorios.length === 0) {
        document.getElementById("main-content").innerHTML = `<div class="empty-state"><h2>No hay consultorios</h2><p>No se encontraron consultorios para el sector ${sector}.</p></div>`;
        return;
    }

    let horarios = [];
    for (let h = 8; h <= 19; h++) {
        horarios.push(`${String(h).padStart(2, "0")}:00`);
        horarios.push(`${String(h).padStart(2, "0")}:30`);
    }
    horarios.pop(); // quitar 19:30

    let html = `
    <h3 style="margin-bottom:20px; color:var(--text-main);">🗓️ Sector: ${sector} | Día: ${dia}</h3>
    <div class="card-table">
        <table class="tabla-agenda">
            <tr>
                <th style="width:80px;">Hora</th>
    `;
    
    consultorios.forEach(c => {
        html += `<th>Cons. ${c.numero}</th>`;
    });
    html += "</tr>";

    horarios.forEach(h => {
        html += `<tr><td><strong>${h}</strong></td>`;
        consultorios.forEach(c => {
            let slot = agenda.find(a => a.horario == h && a.consultorio_id == c.id);
            
            if (modo === "editar") {
                html += `<td>
                    <select class="select-agenda" onchange="guardarAgenda('${c.id}','${h}',this.value)">
                        <option value="">- Libre -</option>
                        ${profesionales.map(p => `
                            <option value="${p.id}" ${slot && slot.profesional_id == p.id ? "selected" : ""}>
                                ${p.nombre}
                            </option>
                        `).join("")}
                    </select>
                </td>`;
            } else {
                if (slot) {
                    let p = profesionales.find(x => x.id == slot.profesional_id);
                    if(p) {
                        let objLicencia = estaEnLicencia(p.id, ausencias);
                        
                        if (objLicencia && objLicencia.activa) {
                            // Si está de licencia, mostramos la leyenda y forzamos clase slot-licencia
                            html += `
                            <td class="slot-licencia">
                                ${p.nombre}<br>Licencia:<br>${objLicencia.texto}
                            </td>`;
                        } else {
                            // Si trabaja normal, aplicamos SU color de fondo
                            html += `
                            <td class="slot-ocupado celda-drop" 
                                style="background-color: ${p.color || '#e2e8f0'};"
                                draggable="true" 
                                ondragstart="drag(event)" 
                                data-id="${p.id}">
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

/* --- GUARDAR Y DRAG & DROP --- */
async function guardarAgenda(consultorio, horario, profesionalId) {
    const dia = document.getElementById("dia").value;
    const sector = document.getElementById("sector").value;
    
    await fetch("/agenda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            consultorio_id: consultorio,
            profesional_id: profesionalId || null, // Si es "", manda null
            horario,
            dia_semana: dia,
            sector
        })
    });
}

function drag(ev) {
    ev.dataTransfer.setData("id", ev.target.dataset.id);
}

function allowDrop(ev) {
    ev.preventDefault();
}

async function drop(ev, consultorio, horario) {
    ev.preventDefault();
    let id = ev.dataTransfer.getData("id");
    if (!id) return;

    await guardarAgenda(consultorio, horario, id);
    verAgenda(); // Refrescar automáticamente tras soltar el bloque
}