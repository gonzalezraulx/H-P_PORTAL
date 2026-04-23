/**
 * H&P PORTAL — LOGIC FINAL (FILTRO INVENTARIO + CANTIDADES)
 * VERIFICADO — REVISIÓN FINAL
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
  const wrappers = document.querySelectorAll('.scanner-container-wrapper, .scanner-container-wrapper-overlay');
  wrappers.forEach(w => w.classList.add('success'));
  playBeep();
  if (navigator.vibrate) navigator.vibrate(100);
  setTimeout(() => wrappers.forEach(w => w.classList.remove('success')), 1000);
}

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
  const u = document.getElementById('auth-user').value.trim();
  const p = document.getElementById('auth-pass').value.trim();
  const btn = e.target.querySelector('button');
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
      alert("Error Google: " + (data.error || "Datos incorrectos")); 
    }
  } catch(error) { 
    alert("FALLA TÉCNICA"); 
  } finally {
    btn.textContent = "Acceder"; btn.disabled = false;
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

async function initScanner(id, cb) {
  await stopScanner();
  html5QrScanner = new Html5Qrcode(id);
  try {
    await html5QrScanner.start(
      { facingMode: "environment" }, 
      { fps: 10, qrbox: (w, h) => { const s = Math.min(w, h) * 0.7; return { width: s, height: s }; } }, 
      (txt) => {
        const now = Date.now();
        if (now - lastScanTime > 1500) {
          lastScanTime = now;
          cb(txt);
        }
      }
    );
  } catch (err) { alert("Error cámara"); }
}

async function stopScanner() {
  if (html5QrScanner) { try { await html5QrScanner.stop(); html5QrScanner = null; } catch(e) {} }
}

async function sendInventario(code, manualQty) {
  let qty = manualQty;
  if (!qty) {
    const qtyInput = document.getElementById('scan-qty');
    qty = qtyInput ? parseInt(qtyInput.value) || 1 : 1;
  }
  try {
    const res = await fetch(scriptUrl, {
      method: 'POST',
      body: JSON.stringify({ 
        tipo: 'inventario', 
        marca: state.brand, 
        usuario: state.user, 
        ubicacion: state.location, 
        codigo: code, 
        cantidad: qty,
        fecha: new Date().toLocaleDateString(), 
        hora: new Date().toLocaleTimeString() 
      })
    });
    const data = await res.json();
    if (data.ok) {
        state.sessionCount += qty; 
        document.getElementById('counter-num').textContent = state.sessionCount;
        document.getElementById('lsb-name').style.color = "#000";
        document.getElementById('lsb-name').textContent = "✓ ("+qty+") " + data.descripcion;
        document.getElementById('lsb-code').textContent = code;
        showSuccessFeedback();
    } else {
        document.getElementById('lsb-name').style.color = "red";
        document.getElementById('lsb-name').textContent = "❌ " + data.error;
        document.getElementById('lsb-code').textContent = code;
        if (navigator.vibrate) navigator.vibrate([100,50,100]);
    }
  } catch(e) { alert("ERROR DE CONEXIÓN"); }
}

function startInventario() {
  const el = document.getElementById('meta-loc'); if(el) el.textContent = state.location; 
  showScreen('screen-scanner');
  initScanner("qr-reader", (code) => { sendInventario(code); });
}

async function startPedido() {
  const el = document.getElementById('pedido-title'); if(el) el.textContent = state.location; 
  showScreen('screen-pedido');
  try {
    const res = await fetch(`${scriptUrl}?action=getPedido&marca=${encodeURIComponent(state.brand)}&destino=${encodeURIComponent(state.location)}`);
    const data = await res.json();
    if(data.ok) { pedidoItems = data.items; renderPedidoList(); }
  } catch(e) { alert("ERROR DE CARGA"); }
}

function renderPedidoList() {
  const list = document.getElementById('pedido-list'); if(!list) return;
  const tot = pedidoItems.reduce((a, i) => a + i.pedida, 0); 
  const dn = pedidoItems.reduce((a, i) => a + i.confirmada, 0);
  const prg = document.getElementById('pedido-progress-fill');
  if (tot > 0 && prg) prg.style.width = (dn/tot*100) + '%';
  list.innerHTML = pedidoItems.map(item => {
    const isComplete = item.pedida > 0 && item.confirmada >= item.pedida;
    return `
    <div class="pedido-card ${isComplete ? 'complete' : ''}">
      <div>
        <div style="font-weight:800; font-size:16px;">${item.descripcion}</div>
        <div style="color:#8e8e93; font-family:monospace; font-size:12px;">${item.codigo}</div>
      </div>
      <div style="font-size:20px; font-weight:900;">${item.confirmada}/${item.pedida}</div>
    </div>`;
  }).join('');
}

function processScan(code) {
  const item = pedidoItems.find(i => i.codigo == code);
  const res = document.getElementById('pedido-scan-result');
  if (item && item.confirmada < item.pedida) {
    item.confirmada++; renderPedidoList(); showSuccessFeedback();
    fetch(scriptUrl, { method: 'POST', body: JSON.stringify({ tipo: 'pedido', marca: state.brand, location: state.location, rowIndex: item.rowIndex }) });
    if(res) { res.style.color = "#34c759"; res.textContent = "✓ " + item.descripcion; }
  } else if(res) {
    res.style.color = "#ff3b30"; res.textContent = "Código: " + code + (item ? " (Ya completo)" : " (No en lista)");
    if (navigator.vibrate) navigator.vibrate([100,50,100]);
  }
}

function openPedidoScanner() { showScreen('pedido-scanner-overlay'); initScanner("qr-reader-pedido", processScan); }
async function closePedidoScanner() { await stopScanner(); showScreen('screen-pedido'); }
function endSession() { stopScanner().then(() => location.reload()); }

function submitManual() {
  const codeEl = document.getElementById('manual-code');
  const qtyEl = document.getElementById('manual-qty');
  const code = codeEl ? codeEl.value.trim() : ""; 
  const qty = qtyEl ? parseInt(qtyEl.value) || 1 : 1;
  if(!code) return;
  if (document.getElementById('screen-pedido').classList.contains('active') || document.getElementById('pedido-scanner-overlay').classList.contains('active')) {
    processScan(code); 
  } else {
    sendInventario(code, qty);
  }
  if(codeEl) codeEl.value = ""; 
  if(qtyEl) qtyEl.value = "1";
  hideModal('modal-manual');
}

document.addEventListener('DOMContentLoaded', checkAuth);
