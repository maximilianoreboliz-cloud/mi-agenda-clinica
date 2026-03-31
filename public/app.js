let modo = "ver";
let esRegistro = false;
let datosUsuario = null;
let listaProfesionalesGlobal = [];

document.addEventListener('DOMContentLoaded', () => {
    // Cerrar menús al hacer clic fuera
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.custom-select-container')) {
            document.querySelectorAll('.custom-dropdown-menu').forEach(m => m.style.display = 'none');
        }
    });
});

/* --- AUTENTICACIÓN --- */
function toggleModoFormulario() {
    esRegistro = !esRegistro;
    document.getElementById("form-title").innerText = esRegistro ? "Crear Cuenta" : "Ingreso al Sistema";
    document.getElementById("btn-submit").innerText = esRegistro ? "Solicitar Cuenta" : "Ingresar";
    document.getElementById("toggle-text").innerHTML = esRegistro 
        ? '¿Ya tienes cuenta? <a href="#" onclick="toggleModoFormulario()">Ingresar</a>' 
        : '¿No tienes cuenta? <a href="#" onclick="toggleModoFormulario()">Solicitar acceso</a>';
}

async function procesarFormulario() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    if (!email || !password) return alert("Completa todos los campos.");
    
    const endpoint = esRegistro ? "/registro" : "/login";
    try {
        const res = await fetch(endpoint, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (res.ok) {
            if (esRegistro) alert("Solicitud enviada.");
            else iniciarSesion(data.usuario);
        } else alert(data.error);
    } catch (err) { alert("Error de conexión."); }
}

async function iniciarSesion(usuario) {
    datosUsuario = usuario;
    document.getElementById("login-container").style.display = "none";
    document.getElementById("app").style.display = "flex";
    document.getElementById("user-email-display").innerText = usuario.email;
    document.getElementById("btn-panel").style.display = usuario.es_admin ? "block" : "none";
    await cargarSectores();
}

function cerrarSesion() { location.reload(); }

async function cargarSectores() {
    const res = await fetch("/sectores");
    const sectores = await res.json();
    const select = document.getElementById("sector");
    select.innerHTML = sectores.map(s => `<option value="${s.nombre}">${s.nombre}</option>`).join('');
}

/* --- PROFESIONALES --- */
async function pantallaProfesionales() {
    document.getElementById("titulo-seccion").innerText = "Gestión de Profesionales";
    document.getElementById("filtros-container").style.display = "none";
    const [resP, resA] = await Promise.all([fetch("/profesionales"), fetch("/ausencias")]);
    const profesionales = await resP.json();
    const ausencias = await resA.json();
    
    let html = `<div class="card-table"><table><tr><th>Color</th><th>Nombre</th><th>Licencia</th><th>Acciones</th></tr>`;
    profesionales.forEach(p => {
        let aus = ausencias.find(a => a.profesional_id === p.id) || { fecha_desde: '', fecha_hasta: '' };
        html += `<tr>
            <td><input type="color" value="${p.color || '#e2e8f0'}" onchange="cambiarColor('${p.id}', this.value)"></td>
            <td><strong>${p.nombre}</strong></td>
            <td><input type="date" id="d_${p.id}" value="${aus.fecha_desde}"> a <input type="date" id="h_${p.id}" value="${aus.fecha_hasta}"> <button onclick="guardarLicencia('${p.id}')">OK</button></td>
            <td><button class="accion-btn btn-delete" onclick="eliminarProfesional('${p.id}')">Borrar</button></td>
        </tr>`;
    });
    html += `</table></div>`;
    document.getElementById("main-content").innerHTML = html;
}

async function cambiarColor(id, color) {
    await fetch(`/profesional/${id}/color`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ color }) });
}

async function guardarLicencia(id) {
    const desde = document.getElementById("d_"+id).value;
    const hasta = document.getElementById("h_"+id).value;
    await fetch("/licencia", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profesional_id: id, desde, hasta }) });
    alert("Licencia guardada");
}

/* --- AGENDA Y BUSCADOR --- */
function pantallaVerAgenda() { modo = "ver"; prepararAgenda(); }
function pantallaModificarAgenda() { modo = "editar"; prepararAgenda(); }

function prepararAgenda() {
    document.getElementById("titulo-seccion").innerText = modo === "ver" ? "Visor" : "Edición";
    document.getElementById("filtros-container").style.display = "block";
    document.getElementById("main-content").innerHTML = "Seleccione filtros.";
}

async function ejecutarBusqueda() {
    const dia = document.getElementById("dia").value;
    const sector = document.getElementById("sector").value;
    const [resC, resA, resP, resAus] = await Promise.all([
        fetch(`/consultorios?sector=${sector}`),
        fetch(`/agenda?dia=${dia}&sector=${sector}`),
        fetch("/profesionales"),
        fetch("/ausencias")
    ]);
    listaProfesionalesGlobal = await resP.json();
    dibujarAgenda(await resC.json(), await resA.json(), await resAus.json(), dia, sector);
}

// Lógica de filtrado en tiempo real
function filtrarMenu(input, menuId) {
    const term = input.value.toLowerCase();
    const items = document.querySelectorAll(`#menu_${menuId} .menu-list-items > li`);
    items.forEach(li => {
        if (li.textContent.includes("- Libre -")) return;
        li.style.display = li.textContent.toLowerCase().includes(term) ? "flex" : "none";
    });
}

function toggleCustomMenu(idStr, event) {
    event.stopPropagation();
    document.querySelectorAll('.custom-dropdown-menu').forEach(m => { if(m.id !== `menu_${idStr}`) m.style.display='none'; });
    const menu = document.getElementById(`menu_${idStr}`);
    if (!menu) return;
    const isVisible = menu.style.display === 'block';
    menu.style.display = isVisible ? 'none' : 'block';
    
    if (!isVisible) {
        const inp = menu.querySelector('.menu-search-input');
        inp.value = '';
        filtrarMenu(inp, idStr);
        setTimeout(() => inp.focus(), 50);
    }
}

function dibujarAgenda(consultorios, agenda, ausencias, dia, sector) {
    let horarios = [];
    for (let h = 8; h <= 19; h++) {
        horarios.push(`${String(h).padStart(2, "0")}:00`);
        if(h !== 19) horarios.push(`${String(h).padStart(2, "0")}:30`);
    }

    let html = `<div class="card-table"><table class="tabla-agenda"><tr><th>Hora</th>`;
    consultorios.forEach(c => html += `<th>Cons. ${c.numero}</th>`);
    html += "</tr>";

    horarios.forEach(h => {
        let h_id = h.replace(':','_');
        html += `<tr><td><strong>${h}</strong></td>`;
        consultorios.forEach(c => {
            let slot = agenda.find(a => a.horario == h && a.consultorio_id == c.id);
            if (modo === "editar") {
                let txt = "- Libre -";
                if(slot) {
                    let p = listaProfesionalesGlobal.find(x => x.id == slot.profesional_id);
                    if(p) txt = slot.especialidad ? `${p.nombre} - ${slot.especialidad}` : p.nombre;
                }

                let menuItemsHtml = `<li onclick="seleccionarOpcion('${c.id}','${h}',null,null)">- Libre -</li>`;
                listaProfesionalesGlobal.forEach(p => {
                    if (p.especialidades) {
                        let esps = p.especialidades.split(',').map(e => e.trim());
                        menuItemsHtml += `<li class="has-submenu">${p.nombre} <span>▶</span><ul class="custom-submenu">`;
                        esps.forEach(e => {
                            menuItemsHtml += `<li onclick="seleccionarOpcion('${c.id}','${h}','${p.id}','${e}')">${e}</li>`;
                        });
                        menuItemsHtml += `</ul></li>`;
                    } else {
                        menuItemsHtml += `<li onclick="seleccionarOpcion('${c.id}','${h}','${p.id}',null)">${p.nombre}</li>`;
                    }
                });

                html += `<td>
                    <div class="custom-select-container">
                        <div class="custom-select-box" onclick="toggleCustomMenu('${c.id}_${h_id}', event)">${txt}</div>
                        <div class="custom-dropdown-menu" id="menu_${c.id}_${h_id}">
                            <div class="menu-search-container">
                                <input type="text" class="menu-search-input" placeholder="🔍 Buscar..." onkeyup="filtrarMenu(this, '${c.id}_${h_id}')" onclick="event.stopPropagation()">
                            </div>
                            <ul class="menu-list-items">${menuItemsHtml}</ul>
                        </div>
                    </div>
                </td>`;
            } else {
                if(slot) {
                    let p = listaProfesionalesGlobal.find(x => x.id == slot.profesional_id);
                    html += `<td style="background:${p?.color || '#eee'}">${p?.nombre || 'Error'}</td>`;
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
