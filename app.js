/**
 * H&P PORTAL — LOGIC FINAL (ESTABLE + BARRAS)
 */

const scriptUrl = "https://script.google.com/macros/s/AKfycbygZTPGk7-e6q_y1dCFde0dJst0BUxB6ficJNj2B8sgyzUe2lwrSTRZAGqD7-m-DzHTzg/exec";

const TIENDAS_POR_MARCA = {
  "Huss": ["Huss 1", "Huss 2"],
  "Papas": ["Neo", "Rosarito"]
};

localStorage.removeItem('h_user_name'); // FORZAR RESET
let state = { brand: '', mode: '', location: '', user: '', sessionCount: 0 };
let pedidoItems = []; let scanner = null;

function showScreen(id) { document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); document.getElementById(id).classList.add('active'); }
function showModal(id) { document.getElementById(id).style.display = 'flex'; }
function hideModal(id) { document.getElementById(id).style.display = 'none'; }

function checkAuth() { 
  if (state.user) { 
    document.getElementById('display-name').textContent = "Hola, " + state.user; 
    showScreen('screen-setup'); 
  } else { 
    showScreen('screen-auth'); 
  } 
}

async function handleAuth(e) {
  e.preventDefault();
  const u = document.getElementById('auth-user').value;
  const p = document.getElementById('auth-pass').value;
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
      alert("Error: " + (data.error || "Credenciales inválidas")); 
    }
  } catch(e) { alert("Error de conexión: " + e.message); }
}

function logout() { localStorage.removeItem('h_user_name'); location.reload(); }

function selectBrand(b) { 
  state.brand = b.dataset.brand; 
  document.querySelectorAll('.brand-btn').forEach(btn => btn.classList.remove('active')); 
  b.classList.add('active'); 
  const menu = document.getElementById('dropdown-menu');
  menu.innerHTML = TIENDAS_POR_MARCA[state.brand].map(t => `<button class="drop-option" onclick="selectLocation('${t}')">${t}</button>`).join('');
  state.location = ''; document.getElementById('dropdown-label').textContent = "Seleccionar..."; checkReady(); 
}

function selectMode(b) { state.mode = b.dataset.mode; document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active')); b.classList.add('active'); checkReady(); }
function toggleDropdown() { if(state.brand) document.getElementById('dropdown-menu').classList.toggle('show'); }
function selectLocation(l) { state.location = l; document.getElementById('dropdown-label').textContent = l; document.getElementById('dropdown-menu').classList.remove('show'); checkReady(); }
function checkReady() { document.getElementById('btn-start').disabled = !(state.brand && state.mode && state.location); }

function handleStart() { if (state.mode === 'inventario') startInventario(); else startPedido(); }

const SCAN_CONFIG = { 
  fps: 20, 
  qrbox: { width: 350, height: 100 },
  aspectRatio: 3.5,
  disableFlip: false
};

function startInventario() {
  document.getElementById('meta-loc').textContent = state.location; showScreen('screen-scanner');
  scanner = new Html5Qrcode("qr-reader");
  scanner.start({ facingMode: "environment" }, SCAN_CONFIG, (code) => {
    if (navigator.vibrate) navigator.vibrate(100);
    state.sessionCount++; document.getElementById('counter-num').textContent = state.sessionCount;
    document.getElementById('lsb-name').textContent = "Escaneado: " + code;
    fetch(scriptUrl, { method: 'POST', body: JSON.stringify({ tipo: 'inventario', marca: state.brand, usuario: state.user, ubicacion: state.location, codigo: code, fecha: new Date().toLocaleDateString(), hora: new Date().toLocaleTimeString() }), mode: 'no-cors' });
  });
}

async function startPedido() {
  document.getElementById('pedido-title').textContent = state.location; showScreen('screen-pedido');
  try {
    const params = `action=getPedido&marca=${encodeURIComponent(state.brand)}&destino=${encodeURIComponent(state.location)}`;
    const res = await fetch(`${scriptUrl}?${params}`);
    const data = await res.json();
    if(data.ok) { pedidoItems = data.items; renderPedidoList(); }
  } catch(e) { alert("Error al cargar lista: " + e.message); }
}

function renderPedidoList() {
  const list = document.getElementById('pedido-list'); 
  const total = pedidoItems.reduce((acc, i) => acc + i.pedida, 0); 
  const done = pedidoItems.reduce((acc, i) => acc + i.confirmada, 0);
  const prog = document.getElementById('pedido-progress-fill');
  if (total > 0) prog.style.width = (done/total*100) + '%';
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
  if (navigator.vibrate) navigator.vibrate(100);
  const item = pedidoItems.find(i => i.codigo == code);
  if (item && item.confirmada < item.pedida) {
    item.confirmada++; renderPedidoList();
    fetch(scriptUrl, { method: 'POST', body: JSON.stringify({ tipo: 'pedido', marca: state.brand, location: state.location, rowIndex: item.rowIndex }), mode: 'no-cors' });
    document.getElementById('pedido-scan-result').style.color = "#34c759";
    document.getElementById('pedido-scan-result').textContent = "✓ " + item.descripcion;
  } else {
    document.getElementById('pedido-scan-result').style.color = "#ff3b30";
    document.getElementById('pedido-scan-result').textContent = "Código: " + code + " (No en lista)";
  }
}

function openPedidoScanner() {
  document.getElementById('pedido-scanner-overlay').style.display = 'block';
  scanner = new Html5Qrcode("qr-reader-pedido");
  scanner.start({ facingMode: "environment" }, SCAN_CONFIG, processScan).catch(err => {
    alert("Error al abrir cámara: " + err);
  });
}

function closePedidoScanner() { if(scanner) scanner.stop(); document.getElementById('pedido-scanner-overlay').style.display = 'none'; }
function endSession() { location.reload(); }

function submitManual() {
  const code = document.getElementById('manual-code').value; if(!code) return;
  if (document.getElementById('screen-pedido').classList.contains('active')) {
    processScan(code); hideModal('modal-manual');
  } else {
    state.sessionCount++; document.getElementById('counter-num').textContent = state.sessionCount;
    fetch(scriptUrl, { method: 'POST', body: JSON.stringify({ tipo: 'inventario', marca: state.brand, usuario: state.user, ubicacion: state.location, codigo: code, fecha: new Date().toLocaleDateString(), hora: new Date().toLocaleTimeString() }), mode: 'no-cors' });
    hideModal('modal-manual');
  }
}

checkAuth();
