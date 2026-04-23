/**
 * H&P PORTAL — VERSIÓN ULTRA-SCAN (OPTIMIZADA PARA ETIQUETAS FÍSICAS)
 */

const scriptUrl = "https://script.google.com/macros/s/AKfycbwz0e6lh0yzO7W66YACZQRc0OOTjOfjR03wWXQzO6J1L_PHyTJshbelEqkvRqUrYPLocA/exec";

const TIENDAS_POR_MARCA = {
  "Huss": ["Huss 1", "Huss 2"],
  "Papas": ["Neo", "Rosarito"]
};

let state = { brand: '', mode: '', location: '', user: '', sessionCount: 0 };
let pedidoItems = []; 
let html5QrScanner = null;
let lastScanTime = 0;

try { state.user = localStorage.getItem('h_user_name') || ''; } catch(e) {}

// --- FUNCIONES DE FEEDBACK ---
function playBeep() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(880, audioCtx.currentTime); 
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); setTimeout(() => osc.stop(), 100);
  } catch(e) {}
}

function showSuccessFeedback() {
  const wrappers = document.querySelectorAll('.scanner-container-wrapper');
  wrappers.forEach(w => w.classList.add('success'));
  playBeep();
  if (navigator.vibrate) navigator.vibrate(150);
  setTimeout(() => wrappers.forEach(w => w.classList.remove('success')), 600);
}

// --- NAVEGACIÓN ---
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

// --- AUTENTICACIÓN Y SETUP ---
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
  try {
    const res = await fetch(scriptUrl, {
      method: 'POST',
      body: JSON.stringify({ action: 'login', username: u, password: p })
    });
    const data = await res.json();
    if (data.ok) { 
      state.user = data.name; 
      localStorage.setItem('h_user_name', data.name); 
      checkAuth(); 
    } else { alert("Datos incorrectos"); }
  } catch(error) { alert("Falla de conexión"); }
}

function selectBrand(b) { 
  state.brand = b.dataset.brand; 
  document.querySelectorAll('.brand-btn').forEach(btn => btn.classList.remove('active')); 
  b.classList.add('active'); 
  const menu = document.getElementById('dropdown-menu');
  if(menu) menu.innerHTML = TIENDAS_POR_MARCA[state.brand].map(t => `<button class="drop-option" onclick="selectLocation('${t}')">${t}</button>`).join('');
  checkReady(); 
}

function selectMode(b) { 
  state.mode = b.dataset.mode; 
  document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active')); 
  b.classList.add('active'); 
  checkReady(); 
}

function selectLocation(l) { 
  state.location = l; 
  document.getElementById('dropdown-label').textContent = l; 
  document.getElementById('dropdown-menu').classList.remove('show'); 
  checkReady(); 
}

function checkReady() { 
  document.getElementById('btn-start').disabled = !(state.brand && state.mode && state.location); 
}

function handleStart() { 
  if (state.mode === 'inventario') startInventario(); 
  else startPedido(); 
}

// --- EL MOTOR DEL ESCÁNER (CORE) ---
async function initScanner(id, cb) {
  await stopScanner();
  
  // Formatos limitados para mayor velocidad
  const formats = [
    Html5QrcodeSupportedFormats.EAN_13,
    Html5QrcodeSupportedFormats.UPC_A,
    Html5QrcodeSupportedFormats.CODE_128
  ];

  html5QrScanner = new Html5Qrcode(id, { formatsToSupport: formats, verbose: false });

  const config = { 
    fps: 30, // Mayor frecuencia para etiquetas en movimiento
    qrbox: (w, h) => {
        // Cuadro de escaneo amplio (estilo app nativa)
        const size = Math.min(w, h) * 0.75;
        return { width: size, height: size };
    },
    videoConstraints: {
        facingMode: { exact: "environment" },
        width: { ideal: 1920 }, // Forzar alta resolución para ver barras finas
        height: { ideal: 1080 },
        focusMode: "continuous"
    }
  };

  const onScan = (txt) => {
    const now = Date.now();
    if (now - lastScanTime > 2000) { 
        lastScanTime = now; 
        cb(txt); 
    }
  };

  try {
    await html5QrScanner.start({ facingMode: "environment" }, config, onScan);

    // Ajustes avanzados de hardware después de iniciar
    const track = html5QrScanner.getRunningTrack();
    const capabilities = track.getCapabilities();

    // Aplicar Zoom automático para no tener que acercar el celular demasiado
    if (capabilities.zoom) {
        await track.applyConstraints({ advanced: [{ zoom: 1.3 }] });
    }

    // Forzar enfoque continuo si el navegador lo permite
    if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
        await track.applyConstraints({ advanced: [{ focusMode: "continuous" }] });
    }

  } catch (err) {
    console.error("Falla de cámara:", err);
    // Reintento en modo compatible si el modo estricto falla
    await html5QrScanner.start({ facingMode: "environment" }, { fps: 20, qrbox: 250 }, onScan);
  }
}

async function stopScanner() {
  if (html5QrScanner) { try { await html5QrScanner.stop(); html5QrScanner = null; } catch(e) {} }
}

// --- LÓGICA DE INVENTARIO Y PEDIDOS ---
async function sendInventario(code, manualQty) {
  const qty = manualQty || parseInt(document.getElementById('scan-qty').value) || 1;
  try {
    const res = await fetch(scriptUrl, {
      method: 'POST',
      body: JSON.stringify({ 
        tipo: 'inventario', marca: state.brand, usuario: state.user, 
        ubicacion: state.location, codigo: code, cantidad: qty 
      })
    });
    const data = await res.json();
    if (data.ok) {
        state.sessionCount += qty; 
        document.getElementById('counter-num').textContent = state.sessionCount;
        document.getElementById('lsb-name').textContent = "✓ " + data.descripcion;
        document.getElementById('lsb-code').textContent = code;
        showSuccessFeedback();
    }
  } catch(e) { console.error(e); }
}

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
    if(data.ok) { pedidoItems = data.items; renderPedidoList(); }
  } catch(e) { alert("Error al cargar lista"); }
}

function renderPedidoList() {
  const list = document.getElementById('pedido-list');
  list.innerHTML = pedidoItems.map(item => `
    <div class="pedido-card ${item.confirmada >= item.pedida ? 'complete' : ''}">
      <div>
        <div style="font-weight:800;">${item.descripcion}</div>
        <div style="font-size:12px; opacity:0.6;">${item.codigo}</div>
      </div>
      <div style="font-size:18px; font-weight:900;">${item.confirmada}/${item.pedida}</div>
    </div>`).join('');
}

function processScan(code) {
  const item = pedidoItems.find(i => i.codigo == code);
  if (item && item.confirmada < item.pedida) {
    item.confirmada++; renderPedidoList(); showSuccessFeedback();
    fetch(scriptUrl, { method: 'POST', body: JSON.stringify({ tipo: 'pedido', marca: state.brand, location: state.location, rowIndex: item.rowIndex }) });
  } else if (navigator.vibrate) {
    navigator.vibrate([100, 50, 100]);
  }
}

function openPedidoScanner() { showScreen('pedido-scanner-overlay'); initScanner("qr-reader-pedido", processScan); }
async function closePedidoScanner() { await stopScanner(); showScreen('screen-pedido'); }

document.addEventListener('DOMContentLoaded', checkAuth);
