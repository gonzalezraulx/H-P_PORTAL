/**
 * H&P PORTAL — VERSIÓN ULTRA-FOCUS (IGUALANDO APP NATIVA)
 */

const scriptUrl = "https://script.google.com/macros/s/AKfycbwz0e6lh0yzO7W66YACZQRc0OOTjOfjR03wWXQzO6J1L_PHyTJshbelEqkvRqUrYPLocA/exec";

// ... (Las funciones de Brand, Mode y Location se mantienen igual) ...

async function initScanner(id, cb) {
  await stopScanner();
  
  // Reducimos formatos a lo estrictamente necesario para ganar velocidad de procesamiento
  const formats = [
    Html5QrcodeSupportedFormats.EAN_13,
    Html5QrcodeSupportedFormats.UPC_A,
    Html5QrcodeSupportedFormats.CODE_128,
    Html5QrcodeSupportedFormats.QR_CODE
  ];

  html5QrScanner = new Html5Qrcode(id, { formatsToSupport: formats, verbose: false });

  const config = { 
    fps: 30, // Máximo posible para fluidez tipo app nativa
    qrbox: (w, h) => {
        // Hacemos el cuadro de escaneo más grande y cuadrado, como en tu captura
        const size = Math.min(w, h) * 0.7;
        return { width: size, height: size };
    },
    // Forzamos al navegador a pedir la máxima calidad posible del sensor
    videoConstraints: {
        facingMode: { exact: "environment" },
        width: { min: 640, ideal: 1920, max: 1920 },
        height: { min: 480, ideal: 1080, max: 1080 },
        focusMode: "continuous",
        whiteBalanceMode: "continuous"
    }
  };

  const onScan = (txt) => {
    const now = Date.now();
    if (now - lastScanTime > 1800) { 
        lastScanTime = now; 
        cb(txt); 
    }
  };

  try {
    // Iniciamos directamente con la cámara trasera optimizada
    await html5QrScanner.start({ facingMode: "environment" }, config, onScan);

    // TRUCO MAESTRO: Forzar el enfoque y zoom después de iniciar
    const track = html5QrScanner.getRunningTrack();
    const capabilities = track.getCapabilities();
    const settings = track.getSettings();

    // Si el celular lo permite, ajustamos el enfoque a "macro" para etiquetas físicas
    if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
        await track.applyConstraints({
            advanced: [{ focusMode: "continuous" }]
        });
    }

    // Si la imagen se ve muy lejos (como en tu captura), podemos aplicar un mini zoom digital
    if (capabilities.zoom) {
        await track.applyConstraints({
            advanced: [{ zoom: 1.2 }] // Un ligero zoom ayuda a centrar etiquetas pequeñas
        });
    }

  } catch (err) {
    console.error("Error detallado:", err);
    // Si falla el inicio estricto, reintentamos con modo normal
    try {
        await html5QrScanner.start({ facingMode: "environment" }, { fps: 20, qrbox: 250 }, onScan);
    } catch(e) {
        alert("Error de cámara: Asegúrate de dar permisos y usar HTTPS");
    }
  }
}

// ... (Resto del código de envío de datos y UI se mantiene igual) ...
