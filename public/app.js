let modo = "ver";
let datosUsuario = null;
let listaProfesionalesGlobal = [];

// --- NAVEGACIÓN ---
function pantallaVerAgenda() {
    modo = "ver";
    actualizarInterfazMenu('btn-ver');
    document.getElementById("filtros-container").style.display = "block";
    document.getElementById("main-content").innerHTML = "";
}

function pantallaModificarAgenda() {
    modo = "editar";
    actualizarInterfazMenu('btn-modificar');
    document.getElementById("filtros-container").style.display = "block";
    document.getElementById("main-content").innerHTML = "";
}

function actualizarInterfazMenu(idActivo) {
    document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
    // Asegúrate de que tus botones en el HTML tengan estos IDs o usa selectores de texto
    document.getElementById(idActivo)?.classList.add('active');
}

// --- LÓGICA DE DATOS ---
async function ejecutarBusqueda() {
    const dia = document.getElementById("dia").value;
    const sector = document.getElementById("sector").value;
    const fechaParaLicencia = document.getElementById("fecha-busqueda")?.value;

    try {
        const [resC, resA, resP, resL] = await Promise.all([
            fetch(`/consultorios?sector=${sector}`),
            fetch(`/agenda?dia=${dia}&sector=${sector}`),
            fetch("/profesionales"),
            fetch(`/ausencias`)
        ]);
        
        const consultorios = await resC.json();
        const agenda = await resA.json();
        listaProfesionalesGlobal = await resP.json();
        const licencias = await resL.json();

        dibujarAgenda(consultorios, agenda, licencias, fechaParaLicencia);
    } catch (e) { console.error("Error en búsqueda:", e); }
}

function dibujarAgenda(consultorios, agenda, licencias, fechaActual) {
    const container = document.getElementById("main-content");
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
            const prof = slot ? listaProfesionalesGlobal.find(p => p.id == slot.profesional_id) : null;
            
            // Chequear si el profesional tiene licencia hoy
            const estaDeLicencia = prof && licencias.some(l => 
                l.profesional_id == prof.id && fechaActual >= l.fecha_desde && fechaActual <= l.fecha_hasta
            );

            if (modo === "editar") {
                const nombre = prof ? prof.nombre : "- Libre -";
                html += `<td><div class="custom-select-box" onclick="abrirMenuAsignar('${c.id}','${h}')">${nombre}</div></td>`;
            } else {
                if (estaDeLicencia) {
                    html += `<td><div class="slot-licencia">LICENCIA: ${prof.nombre}</div></td>`;
                } else if (prof) {
                    html += `<td><div class="slot-ocupado" style="background:${prof.color}">${prof.nombre}<br><small>${slot.especialidad || ''}</small></div></td>`;
                } else {
                    html += `<td class="slot-vacio">Libre</td>`;
                }
            }
        });
        html += "</tr>";
    });
    container.innerHTML = html + "</table></div>";
}

// --- EL FAMOSO DROPDOWN DE ASIGNACIÓN ---
function abrirMenuAsignar(consultorioId, horario) {
    const dia = document.getElementById("dia").value;
    const sector = document.getElementById("sector").value;

    // Usamos un prompt simple para no fallar con HTML extra, 
    // pero lo ideal es un modal que ya tenemos en el CSS.
    const seleccion = prompt("Asignar Profesional:\nEscribe el NOMBRE exacto del profesional o deja vacío para borrar:");
    
    const profEncontrado = listaProfesionalesGlobal.find(p => p.nombre.toLowerCase() === seleccion?.toLowerCase());

    fetch("/agenda", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            consultorio_id: consultorioId,
            profesional_id: profEncontrado ? profEncontrado.id : null,
            horario: horario,
            dia_semana: dia,
            sector: sector,
            especialidad: profEncontrado ? profEncontrado.especialidades : ""
        })
    }).then(() => ejecutarBusqueda());
}

// Carga Inicial
async function cargarSectores() {
    const res = await fetch("/sectores");
    const sectores = await res.json();
    const select = document.getElementById("sector");
    if(select) select.innerHTML = sectores.map(s => `<option value="${s.nombre}">${s.nombre}</option>`).join('');
}
