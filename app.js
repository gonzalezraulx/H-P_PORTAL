/**
 * H&P PORTAL — LOGIC FINAL (ESTABLE + BARRAS + HTML5-QRCODE)
 */

const scriptUrl = "https://script.google.com/macros/s/AKfycbygZTPGk7-e6q_y1dCFde0dJst0BUxB6ficJNj2B8sgyzUe2lwrSTRZAGqD7-m-DzHTzg/exec";

const TIENDAS_POR_MARCA = {
  "Huss": ["Huss 1", "Huss 2"],
  "Papas": ["Neo", "Rosarito"]
};

let state = { brand: '', mode: '', location: '', user: '', sessionCount: 0 };
let pedidoItems = []; 
let html5QrScanner = null;
let lastScanTime = 0;

// Inicialización
try { state.user = localStorage.getItem('h_user_name') || ''; } catch(e) {}

// === FEEDBACK ===
function playBeep() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(880, audioCtx.currentTime); 
    gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); setTimeout(() => osc.stop(), 100);
  } catch(e) {}
}

function showSuccessFeedback() {
  const wrappers = document.querySelectorAll('.scanner-container-wrapper');
  wrappers.forEach(w => w.classList.add('success'));
  playBeep();
  if (navigator.vibrate) navigator.vibrate(100);
  setTimeout(() => wrappers.forEach(w => w.classList.remove('success')), 1000);
}

// === NAVEGACIÓN BLINDADA ===
function showScreen(id) { 
    // Ocultar todas las pantallas de forma agresiva
    const screens = document.querySelectorAll('.screen');
    screens.forEach(s => {
        s.classList.remove('active');
        s.style.display = 'none';
    });
    
    // Mostrar solo la solicitada
    const target = document.getElementById(id);
    if(target) {
        target.classList.add('active');
        target.style.display = 'block';
        // Hacer scroll al inicio de la pantalla por si acaso
        target.scrollTop = 0;
    }
}

function showModal(id) { document.getElementById(id).style.display = 'flex'; }
function hideModal(id) { document.getElementById(id).style.display = 'none'; }

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
  const u = document.getElementById('auth-user').value;
  const p = document.getElementById('auth-pass').value;
  const btn = e.target.querySelector('button');
  const original = btn.textContent;
  btn.textContent = "Verificando..."; btn.disabled = true;

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
    } else { 
      alert("Error: " + (data.error || "Datos incorrectos")); 
    }
  } catch(e) { 
    alert("Error de conexión. Revisa que el Script esté publicado correctamente."); 
  } finally {
    btn.textContent = original; btn.disabled = false;
  }
}

function logout() { localStorage.removeItem('h_user_name'); location.reload(); }

function selectBrand(b) { 
  state.brand = b.dataset.brand; 
  document.querySelectorAll('.brand-btn').forEach(btn => btn.classList.remove('active')); 
  b.classList.add('active'); 
  const menu = document.getElementById('dropdown-menu');
  if(menu) menu.innerHTML = TIENDAS_POR_MARCA[state.brand].map(t => `<button class="drop-option" onclick="selectLocation('${t}')">${t}</button>`).join('');
  state.location = ''; 
  const lbl = document.getElementById('dropdown-label');
  if(lbl) lbl.textContent = "Seleccionar..."; 
  checkReady(); 
}

function selectMode(b) { 
  state.mode = b.dataset.mode; 
  document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active')); 
  b.classList.add('active'); 
  checkReady(); 
}

function toggleDropdown() { if(state.brand) document.getElementById('dropdown-menu').classList.toggle('show'); }
function selectLocation(l) { 
  state.location = l; 
  const lbl = document.getElementById('dropdown-label'); if(lbl) lbl.textContent = l; 
  const menu = document.getElementById('dropdown-menu'); if(menu) menu.classList.remove('show'); 
  checkReady(); 
}
function checkReady() { const b = document.getElementById('btn-start'); if(b) b.disabled = !(state.brand && state.mode && state.location); }

function handleStart() { if (state.mode === 'inventario') startInventario(); else startPedido(); }

// === SCANNER ===
async function initScanner(id, cb) {
  await stopScanner();
  if (typeof Html5Qrcode === 'undefined') return alert("Error de librería");
  html5QrScanner = new Html5Qrcode(id);
  try {
    await html5QrScanner.start(
      { facingMode: "environment" }, 
      { fps: 10, qrbox: (w, h) => { const s = Math.min(w, h) * 0.7; return { width: s, height: s }; } }, 
      (txt) => {
        const now = Date.now();
        if (now - lastScanTime > 2000) {
          lastScanTime = now;
          showSuccessFeedback();
          cb(txt);
        }
      }
    );
  } catch (err) { alert("Error cámara: " + err); }
}

async function stopScanner() {
  if (html5QrScanner) {
    try { await html5QrScanner.stop(); html5QrScanner = null; } catch(e) {}
  }
}

// === LOGICA DE NEGOCIO ===
function startInventario() {
  const el = document.getElementById('meta-loc'); if(el) el.textContent = state.location; 
  showScreen('screen-scanner');
  initScanner("qr-reader", (code) => {
    state.sessionCount++; document.getElementById('counter-num').textContent = state.sessionCount;
    document.getElementById('lsb-name').textContent = "Escaneado: " + code;
    document.getElementById('lsb-code').textContent = code;
    fetch(scriptUrl, { method: 'POST', body: JSON.stringify({ tipo: 'inventario', marca: state.brand, usuario: state.user, ubicacion: state.location, codigo: code, fecha: new Date().toLocaleDateString(), hora: new Date().toLocaleTimeString() }), mode: 'no-cors' });
  });
}

async function startPedido() {
  const el = document.getElementById('pedido-title'); if(el) el.textContent = state.location; 
  showScreen('screen-pedido');
  try {
    const res = await fetch(`${scriptUrl}?action=getPedido&marca=${encodeURIComponent(state.brand)}&destino=${encodeURIComponent(state.location)}`);
    const data = await res.json();
    if(data.ok) { pedidoItems = data.items; renderPedidoList(); }
  } catch(e) { alert("Error: " + e.message); }
}

function renderPedidoList() {
  const list = document.getElementById('pedido-list'); if(!list) return;
  const tot = pedidoItems.reduce((a, i) => a + i.pedida, 0); 
  const dn = pedidoItems.reduce((a, i) => a + i.confirmada, 0);
  const prg = document.getElementById('pedido-progress-fill');
  if (tot > 0 && prg) prg.style.width = (dn/tot*100) + '%';
  list.innerHTML = pedidoItems.map(item => `
    <div class="pedido-card ${(item.pedida > 0 && item.confirmada >= item.pedida) ? 'complete' : ''}">
      <div>
        <div style="font-weight:800; font-size:16px;">${item.descripcion}</div>
        <div style="color:#8e8e93; font-family:monospace; font-size:12px;">${item.codigo}</div>
      </div>
      <div style="font-size:20px; font-weight:900;">${item.confirmada}/${item.pedida}</div>
    </div>`).join('');
}

function processScan(code) {
  const item = pedidoItems.find(i => i.codigo == code);
  const res = document.getElementById('pedido-scan-result');
  if (item && item.confirmada < item.pedida) {
    item.confirmada++; renderPedidoList();
    fetch(scriptUrl, { method: 'POST', body: JSON.stringify({ tipo: 'pedido', marca: state.brand, location: state.location, rowIndex: item.rowIndex }), mode: 'no-cors' });
    if(res) { res.style.color = "#34c759"; res.textContent = "✓ " + item.descripcion; }
  } else if(res) {
    res.style.color = "#ff3b30"; res.textContent = "Código: " + code + (item ? " (Lleno)" : " (No está)");
  }
}

function openPedidoScanner() { showScreen('pedido-scanner-overlay'); initScanner("qr-reader-pedido", processScan); }
async function closePedidoScanner() { await stopScanner(); showScreen('screen-pedido'); }
function endSession() { stopScanner().then(() => location.reload()); }

function submitManual() {
  const codeEl = document.getElementById('manual-code');
  const code = codeEl ? codeEl.value : ""; if(!code) return;
  showSuccessFeedback();
  if (document.getElementById('screen-pedido').classList.contains('active')) processScan(code); 
  else {
    state.sessionCount++; document.getElementById('counter-num').textContent = state.sessionCount;
    fetch(scriptUrl, { method: 'POST', body: JSON.stringify({ tipo: 'inventario', marca: state.brand, usuario: state.user, ubicacion: state.location, codigo: code, fecha: new Date().toLocaleDateString(), hora: new Date().toLocaleTimeString() }), mode: 'no-cors' });
  }
  if(codeEl) codeEl.value = ""; hideModal('modal-manual');
}

// Inicio
document.addEventListener('DOMContentLoaded', checkAuth);
