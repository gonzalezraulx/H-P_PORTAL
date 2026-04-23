/**
 * H&P PORTAL — LOGIC FINAL (ESTABLE + BARRAS + HTML5-QRCODE)
 */

const scriptUrl = "https://script.google.com/macros/s/AKfycbxN17AEQAu03akt_QelQ7IG6Gmc6Oi4VadLyltqJNQVvgQIduRvmMvN-PuoCTOS12D07g/exec";

const TIENDAS_POR_MARCA = {
  "Huss": ["Huss 1", "Huss 2"],
  "Papas": ["Neo", "Rosarito"]
};

let state = { brand: '', mode: '', location: '', user: '', sessionCount: 0 };
let pedidoItems = []; 
let html5QrScanner = null;
let lastScanTime = 0;

// Inicialización de usuario
try {
    state.user = localStorage.getItem('h_user_name') || '';
} catch(e) {}

// === FUNCIONES DE FEEDBACK ===
function playBeep() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); 
    gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();
    setTimeout(() => oscillator.stop(), 100);
  } catch(e) {}
}

function showSuccessFeedback() {
  const wrappers = document.querySelectorAll('.scanner-container-wrapper');
  wrappers.forEach(w => w.classList.add('success'));
  playBeep();
  if (navigator.vibrate) navigator.vibrate(100);
  setTimeout(() => {
    wrappers.forEach(w => w.classList.remove('success'));
  }, 1000);
}

// === NAVEGACIÓN ===
function showScreen(id) { 
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); 
    const target = document.getElementById(id);
    if(target) {
        target.classList.add('active');
        target.style.display = 'block'; // Asegurar visibilidad
    }
}

function showModal(id) { document.getElementById(id).style.display = 'flex'; }
function hideModal(id) { document.getElementById(id).style.display = 'none'; }

function checkAuth() { 
  if (state.user) { 
    const nameEl = document.getElementById('display-name');
    if(nameEl) nameEl.textContent = "Hola, " + state.user; 
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
  
  const originalText = btn.textContent;
  btn.textContent = "Cargando...";
  btn.disabled = true;

  try {
    // Usamos una petición más simple para evitar problemas de CORS preflight si es posible
    const res = await fetch(scriptUrl, {
      method: 'POST',
      body: JSON.stringify({ action: 'login', username: u, password: p })
    });
    
    if (!res.ok) throw new Error("Error en el servidor: " + res.status);
    
    const data = await res.json();
    if (data.ok) { 
      state.user = data.name; 
      localStorage.setItem('h_user_name', data.name); 
      checkAuth(); 
    } else { 
      alert("Error: " + (data.error || "Credenciales inválidas")); 
    }
  } catch(e) { 
    console.error(e);
    alert("Error de conexión. Revisa el URL del script o tu internet. Mensaje: " + e.message); 
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

function logout() { 
    localStorage.removeItem('h_user_name'); 
    location.reload(); 
}

function selectBrand(b) { 
  state.brand = b.dataset.brand; 
  document.querySelectorAll('.brand-btn').forEach(btn => btn.classList.remove('active')); 
  b.classList.add('active'); 
  const menu = document.getElementById('dropdown-menu');
  if(menu) {
    menu.innerHTML = TIENDAS_POR_MARCA[state.brand].map(t => `<button class="drop-option" onclick="selectLocation('${t}')">${t}</button>`).join('');
  }
  state.location = ''; 
  const label = document.getElementById('dropdown-label');
  if(label) label.textContent = "Seleccionar..."; 
  checkReady(); 
}

function selectMode(b) { 
  state.mode = b.dataset.mode; 
  document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active')); 
  b.classList.add('active'); 
  checkReady(); 
}

function toggleDropdown() { 
  if(state.brand) {
    const menu = document.getElementById('dropdown-menu');
    if(menu) menu.classList.toggle('show');
  }
}

function selectLocation(l) { 
  state.location = l; 
  const label = document.getElementById('dropdown-label');
  if(label) label.textContent = l; 
  const menu = document.getElementById('dropdown-menu');
  if(menu) menu.classList.remove('show'); 
  checkReady(); 
}

function checkReady() { 
  const startBtn = document.getElementById('btn-start');
  if(startBtn) startBtn.disabled = !(state.brand && state.mode && state.location); 
}

function handleStart() { if (state.mode === 'inventario') startInventario(); else startPedido(); }

// === LOGICA SCANNER (HTML5-QRCODE) ===
async function initScanner(elementId, callback) {
  await stopScanner();
  
  if (typeof Html5Qrcode === 'undefined') {
      alert("Error: La librería de escaneo no cargó.");
      return;
  }

  html5QrScanner = new Html5Qrcode(elementId);
  const config = { 
    fps: 10, 
    qrbox: (w, h) => {
        const size = Math.min(w, h) * 0.7;
        return { width: size, height: size };
    }
  };

  try {
    await html5QrScanner.start(
      { facingMode: "environment" }, 
      config, 
      (decodedText) => {
        const now = Date.now();
        if (now - lastScanTime > 2000) {
          lastScanTime = now;
          showSuccessFeedback();
          callback(decodedText);
        }
      }
    );
  } catch (err) {
    console.error("Camera error", err);
    alert("Error al iniciar cámara: " + err);
  }
}

async function stopScanner() {
  if (html5QrScanner) {
    try {
      await html5QrScanner.stop();
      html5QrScanner = null;
    } catch(e) {}
  }
}

// === INVENTARIO ===
function startInventario() {
  const metaLoc = document.getElementById('meta-loc');
  if(metaLoc) metaLoc.textContent = state.location; 
  showScreen('screen-scanner');
  initScanner("qr-reader", (code) => {
    state.sessionCount++; 
    document.getElementById('counter-num').textContent = state.sessionCount;
    document.getElementById('lsb-name').textContent = "Escaneado: " + code;
    document.getElementById('lsb-code').textContent = code;
    fetch(scriptUrl, { 
      method: 'POST', 
      body: JSON.stringify({ 
        tipo: 'inventario', marca: state.brand, usuario: state.user, ubicacion: state.location, codigo: code, 
        fecha: new Date().toLocaleDateString(), hora: new Date().toLocaleTimeString() 
      }), 
      mode: 'no-cors' 
    });
  });
}

// === PEDIDOS ===
async function startPedido() {
  const pTitle = document.getElementById('pedido-title');
  if(pTitle) pTitle.textContent = state.location; 
  showScreen('screen-pedido');
  try {
    const params = `action=getPedido&marca=${encodeURIComponent(state.brand)}&destino=${encodeURIComponent(state.location)}`;
    const res = await fetch(`${scriptUrl}?${params}`);
    const data = await res.json();
    if(data.ok) { pedidoItems = data.items; renderPedidoList(); }
  } catch(e) { alert("Error al cargar lista: " + e.message); }
}

function renderPedidoList() {
  const list = document.getElementById('pedido-list'); 
  if(!list) return;
  const total = pedidoItems.reduce((acc, i) => acc + i.pedida, 0); 
  const done = pedidoItems.reduce((acc, i) => acc + i.confirmada, 0);
  const prog = document.getElementById('pedido-progress-fill');
  if (total > 0 && prog) prog.style.width = (done/total*100) + '%';
  list.innerHTML = pedidoItems.map(item => `
    <div class="pedido-card ${item.confirmada >= item.pedida ? 'complete' : ''}">
      <div>
        <div style="font-weight:800; font-size:16px;">${item.descripcion}</div>
        <div style="color:#8e8e93; font-family:monospace; font-size:12px;">${item.codigo}</div>
      </div>
      <div style="font-size:20px; font-weight:900;">${item.confirmada}/${item.pedida}</div>
    </div>`).join('');
}

function processScan(code) {
  const item = pedidoItems.find(i => i.codigo == code);
  if (item && item.confirmada < item.pedida) {
    item.confirmada++; 
    renderPedidoList();
    fetch(scriptUrl, { 
      method: 'POST', 
      body: JSON.stringify({ tipo: 'pedido', marca: state.brand, location: state.location, rowIndex: item.rowIndex }), 
      mode: 'no-cors' 
    });
    const resText = document.getElementById('pedido-scan-result');
    if(resText) {
        resText.style.color = "#34c759";
        resText.textContent = "✓ " + item.descripcion;
    }
  } else {
    const resText = document.getElementById('pedido-scan-result');
    if(resText) {
        resText.style.color = "#ff3b30";
        resText.textContent = "Código: " + code + (item ? " (Ya completo)" : " (No en lista)");
    }
  }
}

function openPedidoScanner() {
  document.getElementById('pedido-scanner-overlay').style.display = 'block';
  initScanner("qr-reader-pedido", processScan);
}

async function closePedidoScanner() { 
  await stopScanner();
  document.getElementById('pedido-scanner-overlay').style.display = 'none'; 
}

function endSession() { 
  stopScanner().then(() => {
    location.reload();
  });
}

function submitManual() {
  const codeEl = document.getElementById('manual-code');
  const code = codeEl ? codeEl.value : "";
  if(!code) return;
  
  showSuccessFeedback();
  if (document.getElementById('screen-pedido').classList.contains('active')) {
    processScan(code); 
  } else {
    state.sessionCount++; 
    document.getElementById('counter-num').textContent = state.sessionCount;
    fetch(scriptUrl, { 
      method: 'POST', 
      body: JSON.stringify({ 
        tipo: 'inventario', marca: state.brand, usuario: state.user, ubicacion: state.location, codigo: code, 
        fecha: new Date().toLocaleDateString(), hora: new Date().toLocaleTimeString() 
      }), 
      mode: 'no-cors' 
    });
  }
  if(codeEl) codeEl.value = "";
  hideModal('modal-manual');
}

// Iniciar aplicación
document.addEventListener('DOMContentLoaded', checkAuth);
