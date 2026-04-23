const scriptUrl = "https://script.google.com/macros/s/AKfycbwz0e6lh0yzO7W66YACZQRc0OOTjOfjR03wWXQzO6J1L_PHyTJshbelEqkvRqUrYPLocA/exec";

const TIENDAS_POR_MARCA = {
  "Huss": ["Huss 1", "Huss 2"],
  "Papas": ["Neo", "Rosarito"]
};

let state = { brand: '', mode: '', location: '', user: '', sessionCount: 0 };
let pedidoItems = []; 
let html5QrScanner = null;

// CARGA INICIAL
document.addEventListener('DOMContentLoaded', () => {
    state.user = localStorage.getItem('h_user_name') || '';
    checkAuth();
});

function checkAuth() {
    if (state.user) {
        document.getElementById('display-name').textContent = "Hola, " + state.user;
        showScreen('screen-setup');
    } else {
        showScreen('screen-auth');
    }
}

// SELECCIÓN DE MARCA
function selectBrand(btn) {
    state.brand = btn.dataset.brand;
    document.querySelectorAll('.brand-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    // Actualizar tiendas
    const menu = document.getElementById('dropdown-menu');
    menu.innerHTML = TIENDAS_POR_MARCA[state.brand].map(t => 
        `<button class="drop-option" onclick="selectLocation('${t}')">${t}</button>`
    ).join('');
    
    state.location = '';
    document.getElementById('dropdown-label').textContent = "Seleccionar Tienda...";
    checkReady();
}

// SELECCIÓN DE MODO
function selectMode(btn) {
    state.mode = btn.dataset.mode;
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    checkReady();
}

// SELECCIÓN DE TIENDA
function selectLocation(loc) {
    state.location = loc;
    document.getElementById('dropdown-label').textContent = loc;
    document.getElementById('dropdown-menu').classList.remove('show');
    checkReady();
}

function toggleDropdown() {
    if(!state.brand) return alert("Selecciona una marca primero");
    document.getElementById('dropdown-menu').classList.toggle('show');
}

// FUNCIÓN CLAVE: HABILITA EL BOTÓN COMENZAR
function checkReady() {
    const btn = document.getElementById('btn-start');
    if (state.brand && state.mode && state.location) {
        btn.disabled = false;
        btn.style.opacity = "1";
    } else {
        btn.disabled = true;
        btn.style.opacity = "0.4";
    }
}

function handleStart() {
    if (state.mode === 'inventario') startInventario();
    else startPedido();
}

// ESCÁNER RECTANGULAR Y ZOOM
async function initScanner(id, cb) {
    if (html5QrScanner) await html5QrScanner.stop();
    
    html5QrScanner = new Html5Qrcode(id);
    const config = { 
        fps: 25, 
        qrbox: (w, h) => ({ width: Math.floor(w * 0.9), height: Math.floor(h * 0.4) }),
        videoConstraints: { facingMode: "environment" }
    };

    try {
        await html5QrScanner.start({ facingMode: "environment" }, config, (txt) => {
            cb(txt);
        });
        
        // Zoom automático para códigos físicos
        const track = html5QrScanner.getRunningTrack();
        if (track && track.getCapabilities().zoom) {
            track.applyConstraints({ advanced: [{ zoom: 1.5 }] });
        }
    } catch (e) { alert("Error cámara"); }
}

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

// ... Resto de funciones (handleAuth, logout, sendInventario) sin cambios ...
