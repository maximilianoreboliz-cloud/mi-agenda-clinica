let modo = "ver";
let esRegistro = false;
let datosUsuario = null;
let listaProfesionalesGlobal = [];

document.addEventListener('DOMContentLoaded', () => {
    const inpFecha = document.getElementById("fecha-busqueda");
    if(inpFecha) {
        const hoy = new Date().toISOString().split('T')[0];
        inpFecha.value = hoy;
        actualizarDiaSemana();
    }
});

async function procesarFormulario() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const errorMsg = document.getElementById("error-msg");
    
    if (!email || !password) {
        if (errorMsg) errorMsg.innerText = "Ingresa email y contraseña.";
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
                alert("Solicitud enviada con éxito.");
                toggleModoFormulario();
            } else {
                iniciarSesion(data.usuario);
            }
        } else {
            if (errorMsg) errorMsg.innerText = data.error;
        }
    } catch (e) {
        if (errorMsg) errorMsg.innerText = "Error de conexión.";
    }
}

function iniciarSesion(usuario) {
    datosUsuario = usuario;
    document.getElementById("login-container").style.display = "none";
    document.getElementById("app").style.display = "flex";
    document.getElementById("user-email-display").innerText = usuario.email;
    document.getElementById("btn-panel").style.display = usuario.es_admin ? "block" : "none";
    cargarSectores();
    pantallaVerAgenda();
}

async function cargarSectores() {
    try {
        const res = await fetch("/sectores");
        const sectores = await res.json();
        const selectSector = document.getElementById("sector");
        if (selectSector && sectores.length > 0) {
            selectSector.innerHTML = sectores.map(s => `<option value="${s.nombre}">${s.nombre}</option>`).join('');
        }
    } catch (e) { console.error("Error cargando sectores"); }
}

function actualizarDiaSemana() {
    const fechaVal = document.getElementById("fecha-busqueda").value;
    if(!fechaVal) return;
    const fecha = new Date(fechaVal + "T00:00:00");
    const dias = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];
    document.getElementById("dia").value = dias[fecha.getDay()];
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
        
        const consultorios = await resC.json();
        const agenda = await resA.json();
        listaProfesionalesGlobal = await resP.json();
        
        dibujarAgenda(consultorios, agenda, fecha, sector, dia);
    } catch (e) {
        console.error("Error al cargar la agenda:", e);
    }
}

function dibujarAgenda(consultorios, agenda, fecha, sector, dia) {
    const container = document.getElementById("main-content");
    if(!consultorios || consultorios.length === 0) {
        container.innerHTML = `<div class="empty-state"><h3>No hay consultorios en este sector</h3></div>`;
        return;
    }

    let horarios = [];
    for (let h = 8; h <= 19; h++) {
        horarios.push(`${String(h).padStart(2, "0")}:00`);
        if(h < 19) horarios.push(`${String(h).padStart(2, "0")}:30`);
    }

    let html = `<div class="card-table"><table><tr><th>Hora</th>`;
    consultorios.forEach(c => html += `<th>Cons. ${c.numero}</th>`);
    html += "</tr>";

    horarios.forEach(h => {
        html += `<tr><td style="text-align:center; font-weight:bold;">${h}</td>`;
        consultorios.forEach(c => {
            const slot = agenda.find(a => a.horario == h && a.consultorio_id == c.id);
            if (modo === "editar") {
                const prof = slot ? listaProfesionalesGlobal.find(p => p.id == slot.profesional_id) : null;
                const txt = prof ? prof.nombre : "- Libre -";
                html += `<td><div class="custom-select-box" onclick="abrirMenuAsignar('${c.id}','${h}', event)">${txt}</div></td>`;
            } else {
                if(slot) {
                    const p = listaProfesionalesGlobal.find(x => x.id == slot.profesional_id);
                    html += `<td><div class="slot-ocupado" style="background:${p?.color || '#e2e8f0'}">${p?.nombre || '?'}<br><small>${slot.especialidad || ''}</small></div></td>`;
                } else {
                    html += `<td class="slot-vacio">Libre</td>`;
                }
            }
        });
        html += "</tr>";
    });
    container.innerHTML = html + "</table></div>";
}

function pantallaVerAgenda() { 
    modo = "ver"; 
    document.getElementById("titulo-seccion").innerText = "Visor de Agenda";
    document.getElementById("filtros-container").style.display = "block";
}

function pantallaModificarAgenda() { 
    modo = "editar"; 
    document.getElementById("titulo-seccion").innerText = "Configurar Turnos";
    document.getElementById("filtros-container").style.display = "block";
}

function cerrarSesion() { location.reload(); }
