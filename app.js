/**
 * H&P PORTAL — VERSIÓN ZEBRA-STYLE (ÁREA ANCHA Y ZOOM)
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

// --- UTILIDADES ---
function playBeep() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(880, audioCtx.currentTime); 
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); setTimeout(() => osc.stop(), 80);
  } catch(e) {}
}

function showSuccessFeedback() {
  const wrappers = document.querySelectorAll('.scanner-container-wrapper');
  wrappers.forEach(w => w.classList.add('success'));
  playBeep();
  if (navigator.vibrate) navigator.vibrate(100);
  setTimeout(() => wrappers.forEach(w => w.classList.remove('success')), 500);
}

function showScreen(id) { 
    document.querySelectorAll('.screen').forEach(s => { s.classList.remove('active'); s.style.display = 'none'; });
    const target = document.getElementById(id);
    if(target) { target.classList.add('active'); target.style.display = 'block'; }
}

// --- CONFIGURACIÓN DEL ESCÁNER ---
async function initScanner(id, cb) {
  await stopScanner();
  
  // Optimizamos solo para los códigos que usas en físico
  const formats = [
    Html5QrcodeSupportedFormats.EAN_13,
    Html5QrcodeSupportedFormats.UPC_A,
    Html5QrcodeSupportedFormats.CODE_128,
    Html5QrcodeSupportedFormats.CODE_39
  ];

  html5QrScanner = new Html5Qrcode(id, { formatsToSupport: formats, verbose: false });

  const config = { 
    fps: 30, 
    qrbox: (viewfinderWidth, viewfinderHeight) => {
        // ÁREA RECTANGULAR ANCHA: 92% del ancho, 45% del alto
        const width = Math.floor(viewfinderWidth * 0.92);
        const height = Math.floor(viewfinderHeight * 0.45);
        return { width, height };
    },
    aspectRatio: 1.777778, // Relación 16:9 para evitar que se vea cuadrado
    videoConstraints: {
        facingMode: { exact: "environment" },
        width: { ideal: 1920 }, // Resolución HD para nitidez en barras
        height: { ideal: 1080 }
    }
  };

  const onScan = (txt) => {
    const now = Date.now();
    if (now - lastScanTime > 1800) { lastScanTime = now; cb(txt); }
  };

  try {
    await html5QrScanner.start({ facingMode: "environment" }, config, onScan);

    // ACTIVACIÓN DE ZOOM Y ENFOQUE AUTOMÁTICO
    const track = html5QrScanner.getRunningTrack();
    const caps = track.getCapabilities();

    if (caps.zoom) {
        // Zoom 1.4x para que las etiquetas pequeñas se vean grandes sin acercarse
        await track.applyConstraints({ advanced: [{ zoom: 1.4 }] });
    }
    if (caps.focusMode && caps.focusMode.includes('continuous')) {
        await track.applyConstraints({ advanced: [{ focusMode: "continuous" }] });
    }
  } catch (err) {
    console.warn("Falla de modo estricto, iniciando modo compatible...");
    await html5QrScanner.start({ facingMode: "environment" }, { fps: 20, qrbox: {width: 320, height: 180} }, onScan);
  }
}

async function stopScanner() {
  if (html5QrScanner) { try { await html5QrScanner.stop(); html5QrScanner = null; } catch(e) {} }
}

// --- LÓGICA DE NEGOCIO ---
async function sendInventario(code, manualQty) {
  const qtyInput = document.getElementById('scan-qty');
  const qty = manualQty || (qtyInput ? parseInt(qtyInput.value) || 1 : 1);
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
        document.getElementById('lsb-name').textContent = "✓ ("+qty+") " + data.descripcion;
        document.getElementById('lsb-code').textContent = code;
        showSuccessFeedback();
    }
  } catch(e) { console.error("Error envío:", e); }
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
  } catch(e) { alert("Error al cargar pedido"); }
}

function renderPedidoList() {
  const list = document.getElementById('pedido-list');
  if(!list) return;
  list.innerHTML = pedidoItems.map(item => `
    <div class="pedido-card ${item.confirmada >= item.pedida ? 'complete' : ''}">
      <div>
        <div style="font-weight:800;">${item.descripcion}</div>
        <div style="font-size:12px; opacity:0.6; font-family:monospace;">${item.codigo}</div>
      </div>
      <div style="font-size:18px; font-weight:900;">${item.confirmada}/${item.pedida}</div>
    </div>`).join('');
}

function processScan(code) {
  const item = pedidoItems.find(i => i.codigo == code);
  if (item && item.confirmada < item.pedida) {
    item.confirmada++; renderPedidoList(); showSuccessFeedback();
    fetch(scriptUrl, { method: 'POST', body: JSON.stringify({ tipo: 'pedido', marca: state.brand, location: state.location, rowIndex: item.rowIndex }) });
  } else {
    if (navigator.vibrate) navigator.vibrate([50, 100, 50]);
  }
}

function openPedidoScanner() { showScreen('pedido-scanner-overlay'); initScanner("qr-reader-pedido", processScan); }
async function closePedidoScanner() { await stopScanner(); showScreen('screen-pedido'); }

// --- AUTH & DROPDOWNS ---
function checkAuth() { 
  if (state.user) { document.getElementById('display-name').textContent = "Hola, " + state.user; showScreen('screen-setup'); } 
  else { showScreen('screen-auth'); } 
}

async function handleAuth(e) {
  e.preventDefault();
  const u = document.getElementById('auth-user').value.trim();
  const p = document.getElementById('auth-pass').value.trim();
  try {
    const res = await fetch(scriptUrl, { method: 'POST', body: JSON.stringify({ action: 'login', username: u, password: p }) });
    const data = await res.json();
    if (data.ok) { state.user = data.name; localStorage.setItem('h_user_name', data.name); checkAuth(); }
    else { alert("Acceso denegado"); }
  } catch(e) { alert("Error de red"); }
}

function selectBrand(b) { 
  state.brand = b.dataset.brand; 
  document.querySelectorAll('.brand-btn').forEach(btn => btn.classList.remove('active')); 
  b.classList.add('active'); 
  const menu = document.getElementById('dropdown-menu');
  menu.innerHTML = TIENDAS_POR_MARCA[state.brand].map(t => `<button class="drop-option" onclick="selectLocation('${t}')">${t}</button>`).join('');
  checkReady(); 
}

function selectMode(b) { state.mode = b.dataset.mode; document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active')); b.classList.add('active'); checkReady(); }
function toggleDropdown() { if(state.brand) document.getElementById('dropdown-menu').classList.toggle('show'); }
function selectLocation(l) { state.location = l; document.getElementById('dropdown-label').textContent = l; document.getElementById('dropdown-menu').classList.remove('show'); checkReady(); }
function checkReady() { document.getElementById('btn-start').disabled = !(state.brand && state.mode && state.location); }
function logout() { localStorage.removeItem('h_user_name'); location.reload(); }
function submitManual() {
    const code = document.getElementById('manual-code').value.trim();
    if(!code) return;
    if (state.mode === 'pedido') processScan(code); else sendInventario(code);
    document.getElementById('manual-code').value = "";
    document.getElementById('modal-manual').style.display = 'none';
}

document.addEventListener('DOMContentLoaded', checkAuth);
