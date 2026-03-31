// ==========================
// LOGIN
// ==========================

function procesarFormulario() {
    const email = document.querySelector("input[type='email']").value;
    const password = document.querySelector("input[type='password']").value;

    // credenciales de prueba
    if (email === "admin@agenda.com" && password === "1234") {
        localStorage.setItem("usuarioLogueado", "true");

        iniciarApp();
    } else {
        document.getElementById("error-msg").innerText = "Credenciales incorrectas";
    }
}

// ==========================
// INICIO APP
// ==========================

function iniciarApp() {
    document.getElementById("login-container").style.display = "none";
    document.getElementById("app").style.display = "flex";
}

// ==========================
// LOGOUT
// ==========================

function cerrarSesion() {
    localStorage.removeItem("usuarioLogueado");
    location.reload();
}

// ==========================
// AL CARGAR
// ==========================

window.onload = function () {
    if (localStorage.getItem("usuarioLogueado") === "true") {
        iniciarApp();
    }
};
