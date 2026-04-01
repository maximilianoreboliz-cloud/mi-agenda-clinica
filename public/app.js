let modo = "ver";
let esRegistro = false;
let datosUsuario = null;
let listaProfesionalesGlobal = [];

// Al cargar, ponemos la fecha de hoy por defecto
document.addEventListener('DOMContentLoaded', () => {
    const hoy = new Date().toISOString().split('T')[0];
    const inpFecha = document.getElementById("fecha-busqueda");
    if(inpFecha) {
        inpFecha.value = hoy;
        actualizarDiaSemana();
    }
});

function actualizarDiaSemana() {
    const fechaVal = document.getElementById("fecha-busqueda").value;
    if(!fechaVal) return;
    const fecha = new Date(fechaVal + "T00:00:00");
    const dias = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];
    document.getElementById("dia").value = dias[fecha.getDay()];
}

/* --- AUTENTICACIÓN --- */
function toggleModoFormulario() {
    esRegistro = !esRegistro;
    document.getElementById("form-title").innerText = esRegistro ? "Solicitar Acceso" : "Ingreso al Sistema";
    document.getElementById("btn-submit").innerText = esRegistro ? "Enviar Solicitud" : "Ingresar";
}

async function procesarFormulario() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const endpoint = esRegistro ? "/registro" : "/login";
    
    const res = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (res.ok) {
        if (esRegistro) return alert("Solicitud enviada");
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

/* --- AGENDA --- */
function pantallaVerAgenda() { modo = "ver"; document.getElementById("filtros-container").style.display = "block"; }
function pantallaModificarAgenda() { modo = "editar"; document.getElementById("filtros-container").style.display = "block"; }

async function ejecutarBusqueda() {
    const dia = document.getElementById("dia").value;
    const sector = document.getElementById("sector").value;
    const fecha = document.getElementById("fecha-busqueda").value;

    const [resC, resA, resP] = await Promise.all([
        fetch(`/consultorios?sector=${sector}`),
        fetch(`/agenda?dia=${dia}&sector=${sector}&fechaCompleta=${fecha}`),
        fetch("/profesionales")
    ]);
    
    listaProfesionalesGlobal = await resP.json();
    dibujarAgenda(await resC.json(), await resA.json());
}

function dibujarAgenda(consultorios, agenda) {
    let horarios = [];
    for (let h = 8; h <= 19; h++) {
        horarios.push(`${String(h).padStart(2, "0")}:00`);
        if(h < 19) horarios.push(`${String(h).padStart(2, "0")}:30`);
    }

    let html = `<div class="card-table"><table><tr><th>Hora</th>`;
    consultorios.forEach(c => html += `<th>Cons. ${c.numero}</th>`);
    html += "</tr>";

    horarios.forEach(h => {
        html += `<tr><td><strong>${h}</strong></td>`;
        consultorios.forEach(c => {
            const slot = agenda.find(a => a.horario == h && a.consultorio_id == c.id);
            if (modo === "editar") {
                const prof = slot ? listaProfesionalesGlobal.find(p => p.id == slot.profesional_id) : null;
                const txt = prof ? prof.nombre : "- Libre -";
                html += `<td>
                    <div class="custom-select-container">
                        <div class="custom-select-box" onclick="this.nextElementSibling.style.display='block'">${txt}</div>
                        <div class="custom-dropdown-menu">
                            <ul class="menu-list-items">
                                <li onclick="asignar('${c.id}','${h}',null)">❌ Quitar</li>
                                ${listaProfesionalesGlobal.map(p => `<li onclick="asignar('${c.id}','${h}','${p.id}')">${p.nombre}</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                </td>`;
            } else {
                if(slot) {
                    const p = listaProfesionalesGlobal.find(x => x.id == slot.profesional_id);
                    html += `<td class="slot-ocupado" style="background:${p?.color}">${p?.nombre}</td>`;
                } else html += `<td class="slot-vacio">Libre</td>`;
            }
        });
        html += "</tr>";
    });
    document.getElementById("main-content").innerHTML = html + "</table></div>";
}

async function asignar(c_id, hora, p_id) {
    const dia = document.getElementById("dia").value;
    const sector = document.getElementById("sector").value;
    await fetch("/agenda", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consultorio_id: c_id, profesional_id: p_id, horario: hora, dia_semana: dia, sector })
    });
    ejecutarBusqueda();
}

/* --- PROFESIONALES --- */
async function pantallaProfesionales() {
    document.getElementById("filtros-container").style.display = "none";
    const [resP, resA] = await Promise.all([fetch("/profesionales"), fetch("/ausencias")]);
    const profs = await resP.json();
    const aus = await resA.json();

    let html = `
    <div class="form-container">
        <div class="grid-form">
            <input id="new-name" placeholder="Nombre del Médico">
            <input id="new-esp" placeholder="Especialidades">
            <button class="btn-primary" onclick="crearProf()">Agregar</button>
        </div>
    </div>
    <div class="card-table">
        <table>
            <tr><th>Color</th><th>Nombre</th><th>Licencia (Desde - Hasta)</th><th>Acciones</th></tr>`;
    
    profs.forEach(p => {
        const licencia = aus.find(a => a.profesional_id == p.id) || { fecha_desde: '', fecha_hasta: '' };
        html += `<tr>
            <td><input type="color" class="color-circle-input" value="${p.color}" onchange="cambiarColor('${p.id}', this.value)"></td>
            <td>
                <div id="v_${p.id}"><strong>${p.nombre}</strong></div>
                <div id="e_${p.id}" style="display:none"><input id="in_${p.id}" value="${p.nombre}"></div>
            </td>
            <td>
                <input type="date" id="d_${p.id}" value="${licencia.fecha_desde}" style="width:130px; margin:0">
                <input type="date" id="h_${p.id}" value="${licencia.fecha_hasta}" style="width:130px; margin:0">
                <button class="accion-btn btn-save" onclick="guardarLicencia('${p.id}')">OK</button>
            </td>
            <td>
                <div class="acciones-container">
                    <button class="accion-btn btn-edit-action" onclick="document.getElementById('v_${p.id}').style.display='none'; document.getElementById('e_${p.id}').style.display='block'">Editar</button>
                    <button class="accion-btn btn-delete" onclick="eliminarProf('${p.id}')">Borrar</button>
                </div>
            </td>
        </tr>`;
    });
    document.getElementById("main-content").innerHTML = html + "</table></div>";
}

async function crearProf() {
    const nombre = document.getElementById("new-name").value;
    const especialidades = document.getElementById("new-esp").value;
    await fetch("/profesional", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre, especialidades }) });
    pantallaProfesionales();
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

function cerrarSesion() { location.reload(); }
