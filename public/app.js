let modo = "ver";
let esRegistro = false;
let datosUsuario = null;
let listaProfesionalesGlobal = [];

// Cerrar menús al hacer clic afuera
document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-select-container')) {
        document.querySelectorAll('.custom-dropdown-menu').forEach(m => m.style.display = 'none');
    }
});

// Sincronizar fecha inicial al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    const hoy = new Date().toISOString().split('T')[0];
    const inpFecha = document.getElementById("fecha-busqueda");
    if(inpFecha) {
        inpFecha.value = hoy;
        actualizarDiaSemana();
    }
});

function toggleModoFormulario() {
    esRegistro = !esRegistro;
    document.getElementById("form-title").innerText = esRegistro ? "Crear Cuenta" : "Ingreso al Sistema";
    document.getElementById("btn-submit").innerText = esRegistro ? "Solicitar Cuenta" : "Ingresar al Panel";
    document.getElementById("toggle-text").innerHTML = esRegistro ? 
        '¿Ya tienes cuenta? <a href="#" onclick="toggleModoFormulario()">Ingresar</a>' : 
        '¿No tienes cuenta? <a href="#" onclick="toggleModoFormulario()">Solicitar acceso</a>';
}

async function procesarFormulario() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const errorMsg = document.getElementById("error-msg");
    
    if (errorMsg) errorMsg.innerText = "";

    if (!email || !password) {
        if (errorMsg) errorMsg.innerText = "Completa todos los campos.";
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
                alert("Solicitud enviada. Espera la aprobación del administrador.");
                toggleModoFormulario();
            } else {
                iniciarSesion(data.usuario); // Corregido: sin espacio y minúscula
            }
        } else {
            if (errorMsg) errorMsg.innerText = data.error;
            else alert(data.error);
        }
    } catch (e) {
        console.error(e);
        if (errorMsg) errorMsg.innerText = "Error de conexión con el servidor.";
    }
}

function iniciarSesion(usuario) {
    datosUsuario = usuario;
    document.getElementById("login-container").style.display = "none";
    document.getElementById("app").style.display = "flex";
    document.getElementById("user-email-display").innerText = usuario.email;
    document.getElementById("btn-panel").style.display = usuario.es_admin ? "block" : "none";
    cargarSectores();
    pantallaVerAgenda(); // Carga la vista inicial por defecto
}

function cerrarSesion() { location.reload(); }

async function cargarSectores() {
    const res = await fetch("/sectores");
    const sectores = await res.json();
    const selectSector = document.getElementById("sector");
    if (selectSector) {
        selectSector.innerHTML = sectores.map(s => `<option value="${s.nombre}">${s.nombre}</option>`).join('');
    }
}

function actualizarDiaSemana() {
    const fechaVal = document.getElementById("fecha-busqueda").value;
    if(!fechaVal) return;
    const fecha = new Date(fechaVal + "T00:00:00");
    const dias = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];
    document.getElementById("dia").value = dias[fecha.getDay()];
}

/* --- AGENDA --- */
function pantallaVerAgenda() { 
    modo = "ver"; 
    prepararInterfaz("Visor de Agenda", "nav-ver"); 
}

function pantallaModificarAgenda() { 
    modo = "editar"; 
    prepararInterfaz("Configurar Turnos", "nav-modificar"); 
}

function prepararInterfaz(titulo, navId) {
    document.querySelectorAll('.sidebar-nav button').forEach(b => b.classList.remove('active'));
    const btnNav = document.getElementById(navId);
    if (btnNav) btnNav.classList.add('active');
    
    document.getElementById("titulo-seccion").innerText = titulo;
    document.getElementById("filtros-container").style.display = "block";
    
    document.getElementById("main-content").innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">🔍</div>
            <h2>Consultar Agenda</h2>
            <p>Utiliza los filtros de la izquierda para seleccionar Fecha, Día y Sector, luego haz clic en 'Cargar Grilla'.</p>
        </div>`;
}

async function ejecutarBusqueda() {
    const dia = document.getElementById("dia").value;
    const sector = document.getElementById("sector").value;
    const fecha = document.getElementById("fecha-busqueda").value;

    try {
        const [resC, resA, resP] = await Promise.all([
            fetch(`/consultorios?sector=${sector}`),
            fetch(`/agenda?dia=${dia}&sector=${sector}&fechaCompleta=${fecha}`),
            fetch("/profesionales")
        ]);
        
        listaProfesionalesGlobal = await resP.json();
        dibujarAgenda(await resC.json(), await resA.json(), fecha, sector, dia);
    } catch (e) {
        console.error("Error en búsqueda:", e);
    }
}

function dibujarAgenda(consultorios, agenda, fecha, sector, dia) {
    if(consultorios.length === 0) {
        document.getElementById("main-content").innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🏥</div>
                <h2>No hay consultorios</h2>
                <p>No se encontraron consultorios configurados para el sector ${sector}.</p>
            </div>`;
        return;
    }
    
    let horarios = [];
    for (let h = 8; h <= 19; h++) {
        horarios.push(`${String(h).padStart(2, "0")}:00`);
        if(h < 19) horarios.push(`${String(h).padStart(2, "0")}:30`);
    }

    let html = `<div class="card-table"><table><tr><th style="width:90px; text-align:center;">Hora</th>`;
    consultorios.forEach(c => html += `<th>Cons. ${c.numero}</th>`);
    html += "</tr>";

    horarios.forEach(h => {
        let h_id = h.replace(':','_');
        html += `<tr><td style="font-weight:700; color:var(--primary); text-align:center;">${h}</td>`;
        consultorios.forEach(c => {
            const slot = agenda.find(a => a.horario == h && a.consultorio_id == c.id);
            if (modo === "editar") {
                const prof = slot ? listaProfesionalesGlobal.find(p => p.id == slot.profesional_id) : null;
                const txt = prof ? prof.nombre : "- Libre -";
                
                let menuItemsHtml = `<li onclick="asignar('${c.id}','${h}',null)"><b>❌ Marcar como Libre</b></li>`;
                listaProfesionalesGlobal.forEach(p => {
                    let esps = p.especialidades ? p.especialidades.split(',').map(e => e.trim()).filter(e => e) : [];
                    if (esps.length > 0) {
                        esps.forEach(e => {
                            menuItemsHtml += `<li onclick="asignar('${c.id}','${h}','${p.id}','${e}')"><b>${p.nombre}</b><span>${e}</span></li>`;
                        });
                    } else {
                        menuItemsHtml += `<li onclick="asignar('${c.id}','${h}','${p.id}',null)"><b>${p.nombre}</b></li>`;
                    }
                });

                html += `<td>
                    <div class="custom-select-container">
                        <div class="custom-select-box" onclick="toggleM('menu_${c.id}_${h_id}', event)">${txt}</div>
                        <div class="custom-dropdown-menu" id="menu_${c.id}_${h_id}">
                            <div class="menu-search-container">
                                <input type="text" placeholder="🔍 Buscar Médico..." class="menu-search-input" onkeyup="filterM(this)" onclick="event.stopPropagation()">
                            </div>
                            <ul class="menu-list-items">${menuItemsHtml}</ul>
                        </div>
                    </div>
                </td>`;
            } else {
                if(slot) {
                    const p = listaProfesionalesGlobal.find(x => x.id == slot.profesional_id);
                    const espSub = slot.especialidad ? `<br><span style="font-size:11px; font-weight:400; opacity:0.8;">${slot.especialidad}</span>` : '';
                    html += `<td><div class="slot-ocupado" style="background:${p?.color || '#e2e8f0'}">${p?.nombre || '?'}${espSub}</div></td>`;
                } else html += `<td class="slot-vacio">Libre</td>`;
            }
        });
        html += "</tr>";
    });
    
    const headerHtml = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
        <h3 style="font-size:16px; font-weight:600; color:var(--text-main);">${sector} - ${dia} ${fecha.split('-').reverse().join('/')}</h3>
        <span style="background:var(--primary-light); color:var(--primary); padding:5px 12px; border-radius:99px; font-size:12px; font-weight:600;">${modo === 'ver' ? 'Modo Lectura' : 'Modo Edición'}</span>
    </div>`;
    
    document.getElementById("main-content").innerHTML = headerHtml + html + "</table></div>";
}

/* --- PROFESIONALES --- */
async function pantallaProfesionales() {
    document.querySelectorAll('.sidebar-nav button').forEach(b => b.classList.remove('active'));
    document.getElementById("nav-profesionales").classList.add('active');
    document.getElementById("titulo-seccion").innerText = "Gestión de Profesionales";
    document.getElementById("filtros-container").style.display = "none";
    
    const [resP, resA] = await Promise.all([fetch("/profesionales"), fetch("/ausencias")]);
    const profs = await resP.json();
    const aus = await resA.json();

    let html = `
    <div class="form-container">
        <h3>➕ Incorporar Nuevo Profesional</h3>
        <div class="grid-form">
            <div class="input-group-sm">
                <label>Nombre Completo</label>
                <input id="new-name" placeholder="Ej: Dr. Alejandro Pérez">
            </div>
            <div class="input-group-sm">
                <label>Especialidades</label>
                <input id="new-esp" placeholder="Cardiología, Clínica">
            </div>
            <button class="btn-primary btn-md" onclick="crearProf()">Guardar</button>
        </div>
    </div>
    <div class="card-table">
        <table>
            <tr><th style="width:70px; text-align:center;">Color</th><th>Nombre</th><th>Licencia</th><th style="text-align:center;">Acciones</th></tr>`;
    
    profs.forEach(p => {
        const licencia = aus.find(a => a.profesional_id == p.id) || { fecha_desde: '', fecha_hasta: '' };
        html += `<tr>
            <td style="text-align:center;"><input type="color" class="color-circle-input" value="${p.color || '#e2e8f0'}" onchange="cambiarColor('${p.id}', this.value)"></td>
            <td>
                <div id="v_${p.id}"><strong>${p.nombre}</strong><br><small style="color:var(--text-muted);">${p.especialidades || ''}</small></div>
                <div id="e_${p.id}" style="display:none; flex-direction:column; gap:5px;">
                    <input id="in_${p.id}" value="${p.nombre}">
                    <input id="ie_${p.id}" value="${p.especialidades || ''}">
                </div>
            </td>
            <td>
                <div style="display:flex; gap:5px; align-items:center;">
                    <input type="date" id="d_${p.id}" value="${licencia.fecha_desde}" style="width:130px;">
                    <input type="date" id="h_${p.id}" value="${licencia.fecha_hasta}" style="width:130px;">
                    <button class="accion-btn btn-save" style="min-width:40px;" onclick="guardarLicencia('${p.id}')">💾</button>
                </div>
            </td>
            <td>
                <div class="acciones-container">
                    <button class="accion-btn btn-edit-action" id="be_${p.id}" onclick="habilitarEdit('${p.id}')">✏️ Editar</button>
                    <button class="accion-btn btn-save" id="bs_${p.id}" style="display:none;" onclick="saveEdit('${p.id}')">✔️ OK</button>
                    <button class="accion-btn btn-delete" onclick="eliminarProf('${p.id}')">🗑️</button>
                </div>
            </td>
        </tr>`;
    });
    document.getElementById("main-content").innerHTML = html + "</table></div>";
}

// Funciones de apoyo UI
function toggleM(id, event) {
    event.stopPropagation();
    const menu = document.getElementById(id);
    const visible = menu.style.display === 'block';
    document.querySelectorAll('.custom-dropdown-menu').forEach(m => m.style.display = 'none');
    menu.style.display = visible ? 'none' : 'block';
}

function filterM(input) {
    const term = input.value.toLowerCase();
    const items = input.nextElementSibling.querySelectorAll('li');
    items.forEach(li => {
        li.style.display = li.innerText.toLowerCase().includes(term) ? "flex" : "none";
    });
}

function habilitarEdit(id) {
    document.getElementById(`v_${id}`).style.display='none'; 
    document.getElementById(`e_${id}`).style.display='flex';
    document.getElementById(`be_${id}`).style.display='none';
    document.getElementById(`bs_${id}`).style.display='inline-flex';
}

async function crearProf() {
    const nombre = document.getElementById("new-name").value;
    const especialidades = document.getElementById("new-esp").value;
    await fetch("/profesional", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre, especialidades }) });
    pantallaProfesionales();
}

async function saveEdit(id) {
    const nombre = document.getElementById(`in_${id}`).value;
    const especialidades = document.getElementById(`ie_${id}`).value;
    await fetch(`/profesional/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre, especialidades }) });
    pantallaProfesionales();
}

async function asignar(c_id, hora, p_id, esp) {
    const dia = document.getElementById("dia").value;
    const sector = document.getElementById("sector").value;
    await fetch("/agenda", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consultorio_id: c_id, profesional_id: p_id, horario: hora, dia_semana: dia, sector, especialidad: esp || null })
    });
    ejecutarBusqueda();
}

async function guardarLicencia(id) {
    const desde = document.getElementById(`d_${id}`).value;
    const hasta = document.getElementById(`h_${id}`).value;
    await fetch("/licencia", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profesional_id: id, desde, hasta }) });
    alert("Licencia actualizada");
}

async function cambiarColor(id, color) {
    await fetch(`/profesional/${id}/color`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ color }) });
}

async function eliminarProf(id) {
    if(confirm("¿Eliminar profesional?")) {
        await fetch(`/profesional/${id}`, { method: "DELETE" });
        pantallaProfesionales();
    }
}

async function cargarPanelControl() {
    document.getElementById("filtros-container").style.display = "none";
    document.getElementById("titulo-seccion").innerText = "Panel Admin";
    const res = await fetch("/usuarios/admin");
    const usuarios = await res.json();
    let html = `<div class="card-table"><table><tr><th>Email</th><th>Estado</th><th>Acciones</th></tr>`;
    usuarios.forEach(u => {
        html += `<tr>
            <td>${u.email}</td>
            <td>${u.activo ? 'Activo' : 'Pendiente'}</td>
            <td>
                ${!u.activo ? `<button onclick="aprobarUsuario('${u.id}')">Aprobar</button>` : ''}
                <button onclick="borrarUsuario('${u.id}')">Borrar</button>
            </td>
        </tr>`;
    });
    document.getElementById("main-content").innerHTML = html + "</table></div>";
}

async function aprobarUsuario(id) {
    await fetch(`/usuarios/aprobar/${id}`, { method: "PATCH" });
    cargarPanelControl();
}

async function borrarUsuario(id) {
    await fetch(`/usuarios/${id}`, { method: "DELETE" });
    cargarPanelControl();
}
