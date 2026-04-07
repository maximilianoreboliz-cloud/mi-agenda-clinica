let modo = "ver";
let datosUsuario = null;
let listaProfesionalesGlobal = [];

// Navegación del Menú Lateral
function pantallaVerAgenda() {
    modo = "ver";
    document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
    document.querySelector('[onclick="pantallaVerAgenda()"]').classList.add('active');
    document.getElementById("titulo-seccion").innerText = "Visor de Agenda Semanal";
    document.getElementById("filtros-container").style.display = "block";
    document.getElementById("main-content").innerHTML = "";
}

function pantallaModificarAgenda() {
    modo = "editar";
    document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
    document.querySelector('[onclick="pantallaModificarAgenda()"]').classList.add('active');
    document.getElementById("titulo-seccion").innerText = "Configurar Agenda Base";
    document.getElementById("filtros-container").style.display = "block";
    document.getElementById("main-content").innerHTML = "";
}

async function pantallaProfesionales() {
    document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
    document.querySelector('[onclick="pantallaProfesionales()"]').classList.add('active');
    document.getElementById("titulo-seccion").innerText = "Gestión de Profesionales";
    document.getElementById("filtros-container").style.display = "none";
    
    const res = await fetch("/profesionales");
    const profesionales = await res.json();
    
    let html = `
        <div class="card-table">
            <button class="btn-primary" onclick="mostrarFormProfesional()" style="margin-bottom:15px">+ Nuevo Profesional</button>
            <table>
                <tr><th>Nombre</th><th>Especialidades</th><th>Acciones</th></tr>
                ${profesionales.map(p => `
                    <tr>
                        <td>${p.nombre}</td>
                        <td>${p.especialidades}</td>
                        <td><button onclick="eliminarProfesional('${p.id}')" style="color:red">Eliminar</button></td>
                    </tr>
                `).join('')}
            </table>
        </div>`;
    document.getElementById("main-content").innerHTML = html;
}

// Lógica de Agenda
async function ejecutarBusqueda() {
    const dia = document.getElementById("dia").value;
    const sector = document.getElementById("sector").value;

    try {
        const [resC, resA, resP] = await Promise.all([
            fetch(`/consultorios?sector=${sector}`),
            fetch(`/agenda?dia=${dia}&sector=${sector}`),
            fetch("/profesionales")
        ]);
        
        const consultorios = await resC.json();
        const agenda = await resA.json();
        listaProfesionalesGlobal = await resP.json();
        
        dibujarAgenda(consultorios, agenda, sector, dia);
    } catch (e) { console.error(e); }
}

function dibujarAgenda(consultorios, agenda, sector, dia) {
    const container = document.getElementById("main-content");
    if(!consultorios.length) {
        container.innerHTML = "<h3>No hay consultorios en este sector</h3>";
        return;
    }

    let horarios = [];
    for (let h = 8; h <= 19; h++) {
        horarios.push(`${String(h).padStart(2, "0")}:00`);
        horarios.push(`${String(h).padStart(2, "0")}:30`);
    }

    let html = `<div class="card-table"><table><tr><th>Hora</th>`;
    consultorios.forEach(c => html += `<th>Cons. ${c.numero}</th>`);
    html += "</tr>";

    horarios.forEach(h => {
        html += `<tr><td class="hora-col">${h}</td>`;
        consultorios.forEach(c => {
            const slot = agenda.find(a => a.horario == h && a.consultorio_id == c.id);
            if (modo === "editar") {
                const prof = slot ? listaProfesionalesGlobal.find(p => p.id == slot.profesional_id) : null;
                const txt = prof ? prof.nombre : "- Libre -";
                html += `<td><div class="custom-select-box" onclick="abrirMenuAsignar('${c.id}','${h}', event)">${txt}</div></td>`;
            } else {
                const p = slot ? listaProfesionalesGlobal.find(x => x.id == slot.profesional_id) : null;
                html += p ? `<td><div class="slot-ocupado" style="background:${p.color}">${p.nombre}</div></td>` : `<td>Libre</td>`;
            }
        });
        html += "</tr>";
    });
    container.innerHTML = html + "</table></div>";
}

// Inicialización
function iniciarSesion(usuario) {
    datosUsuario = usuario;
    document.getElementById("login-container").style.display = "none";
    document.getElementById("app").style.display = "flex";
    document.getElementById("user-email-display").innerText = usuario.email;
    cargarSectores();
    pantallaVerAgenda();
}

async function cargarSectores() {
    const res = await fetch("/sectores");
    const sectores = await res.json();
    const select = document.getElementById("sector");
    select.innerHTML = sectores.map(s => `<option value="${s.nombre}">${s.nombre}</option>`).join('');
}

// Función para abrir el menú de asignación (el desplegable que mencionas)
function abrirMenuAsignar(consultorioId, horario, event) {
    const dia = document.getElementById("dia").value;
    const sector = document.getElementById("sector").value;
    
    // Aquí iría la lógica del modal o dropdown flotante para elegir profesional
    let profId = prompt("Ingrese ID del profesional (o deje vacío para liberar):");
    
    fetch("/agenda", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            consultorio_id: consultorioId,
            profesional_id: profId || null,
            horario: horario,
            dia_semana: dia,
            sector: sector
        })
    }).then(() => ejecutarBusqueda());
}
