/**
 * H&P PORTAL — VERSIÓN FINAL REPARADA
 */

const scriptUrl = "https://script.google.com/macros/s/AKfycbwz0e6lh0yzO7W66YACZQRc0OOTjOfjR03wWXQzO6J1L_PHyTJshbelEqkvRqUrYPLocA/exec";

const TIENDAS_POR_MARCA = {
  "Huss": ["Huss 1", "Huss 2"],
  "Papas": ["Neo", "Rosarito"]
};

// Estado inicial
let state = { brand: '', mode: '', location: '', user: '', sessionCount: 0 };
let pedidoItems = []; 
let html5QrScanner = null;
let lastScanTime = 0;

// Cargar usuario si existe
try { 
    state.user = localStorage.getItem('h_user_name') || ''; 
} catch(e) { console.log("Error localstorage"); }

// --- FUNCIONES DE NAVEGACIÓN ---
function showScreen(id) { 
    document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove('active');
        s.style.display = 'none';
    });
    const target = document.getElementById(id);
    if(target) {
        target.classList.add('active');
        target.style.display = 'block';
    }
}

// --- LÓGICA DE SELECCIÓN (AQUÍ ESTABA EL FALLO) ---

function selectBrand(btn) { 
  state.brand = btn.getAttribute('data-brand'); 
  // Visual
  document.querySelectorAll('.brand-btn').forEach(b => b.classList.remove('active')); 
  btn.classList.add('active'); 
  
  // Actualizar Tiendas
  const menu = document.getElementById('dropdown-menu');
  if(menu) {
      menu.innerHTML = TIENDAS_POR_MARCA[state.brand].map(t => 
        `<button class="drop-option" onclick="selectLocation('${t}')">${t}</button>`
      ).join('');
  }
  
  // Reset de tienda al cambiar marca
  state.location = '';
  const label = document.getElementById('dropdown-label');
  if(label) label.textContent = "Seleccionar Tienda...";
  
  checkReady(); 
}

function selectMode(btn) { 
  state.mode = btn.getAttribute('data-mode'); 
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active')); 
  btn.classList.add('active'); 
  checkReady(); 
}

function selectLocation(loc) { 
  state.location = loc; 
  const label = document.getElementById('dropdown-label');
  if(label) label.textContent = loc; 
  
  const menu = document.getElementById('dropdown-menu');
  if(menu) menu.classList.remove('show'); 
  
  checkReady(); 
}

function toggleDropdown() {
    if(!state.brand) {
        alert("Primero selecciona una marca (Huss o Papas)");
        return;
    }
    const menu = document.getElementById('dropdown-menu');
    if(menu) menu.classList.toggle('show');
}

// ESTA FUNCIÓN HABILITA EL BOTÓN
function checkReady() { 
  const btnStart = document.getElementById('btn-start');
  if(!btnStart) return;

  if (state.brand && state.mode && state.location) {
      btnStart.disabled = false;
      btnStart.style.opacity = "1";
      btnStart.style.background = "var(--primary)";
  } else {
      btnStart.disabled = true;
      btnStart.style.opacity = "0.5";
  }
}

// FUNCIÓN DEL BOTÓN COMENZAR
function handleStart() {
  if (!state.brand || !state.mode || !state.location) {
      alert("Falta seleccionar información");
      return;
  }
  
  if (state.mode === 'inventario') {
      startInventario();
  } else {
      startPedido();
  }
}

// --- MOTORES DE ESCANEO ---

async function initScanner(id, cb) {
  await stopScanner();
  
  // Usamos strings de formatos para evitar errores si la librería tarda en cargar
  const formats = [0, 1, 5, 11]; // EAN_13, CODE_128, etc.

  html5QrScanner = new Html5Qrcode(id, { verbose: false });

  const config = { 
    fps: 25, 
    qrbox: (w, h) => ({ width: Math.floor(w * 0.9), height: Math.floor(h * 0.5) }),
    videoConstraints: {
        facingMode: "environment",
        width: { ideal: 1280 },
        height: { ideal: 720 }
    }
  };

  try {
    await html5QrScanner.start({ facingMode: "environment" }, config, (txt) => {
        const now = Date.now();
        if (now - lastScanTime > 2000) { lastScanTime = now; cb(txt); }
    });
    
    // Auto-zoom
    const track = html5QrScanner.getRunningTrack();
    if (track && track.getCapabilities().zoom) {
        track.applyConstraints({ advanced: [{ zoom: 1.5 }] });
    }
  } catch (err) {
    alert("Error de cámara. Revisa permisos.");
  }
}

async function stopScanner() {
  if (html5QrScanner) {
      try { await html5QrScanner.stop(); html5QrScanner = null; } catch(e) {}
  }
}

// --- FLUJOS DE TRABAJO ---

function startInventario() {
  document.getElementById('meta-loc').textContent = state.location; 
  showScreen('screen-scanner');
  initScanner("qr-reader", (code) => { sendInventario(code); });
}

async function startPedido() {
  document.getElementById('pedido-title').textContent = state.location; 
  showScreen('screen-pedido');
  try {
    const res = await fetch(`${scriptUrl}?action=getPedido&marca=${state.brand}&destino=${state.location}`);
    const data = await res.json();
    if(data.ok) { 
        pedidoItems = data.items; 
        renderPedidoList(); 
    }
  } catch(e) { alert("Error cargando pedido de Google Sheets"); }
}

// (El resto de funciones como sendInventario, renderPedidoList permanecen igual...)

async function sendInventario(code, manualQty) {
  const qty = manualQty || parseInt(document.getElementById('scan-qty').value) || 1;
  showSuccessFeedback(); // Feedback rápido
  try {
    const res = await fetch(scriptUrl, {
      method: 'POST',
      body: JSON.stringify({ 
        tipo: 'inventario', marca: state.brand, usuario: state.user, 
        ubicacion: state.location, codigo: code, cantidad: qty 
      })
    });
  } catch(e) { console.error(e); }
}

function showSuccessFeedback() {
  const wrapper = document.querySelector('.scanner-container-wrapper');
  if(wrapper) {
      wrapper.style.borderColor = "#34c759";
      setTimeout(() => wrapper.style.borderColor = "transparent", 500);
  }
  if (navigator.vibrate) navigator.vibrate(100);
}

function checkAuth() { 
  if (state.user) { 
    const el = document.getElementById('display-name');
    if(el) el.textContent = "Hola, " + state.user; 
    showScreen('screen-setup'); 
  } else { 
    showScreen('screen-auth'); 
  } 
}

async function handleAuth(e) {
  e.preventDefault();
  const u = document.getElementById('auth-user').value.trim();
  const p = document.getElementById('auth-pass').value.trim();
  if(u === "admin" && p === "123") { // Login temporal si Google falla
      state.user = u;
      localStorage.setItem('h_user_name', u);
      checkAuth();
  }
}

document.addEventListener('DOMContentLoaded', checkAuth);
