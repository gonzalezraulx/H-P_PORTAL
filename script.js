document.addEventListener('DOMContentLoaded', () => {
    const html5QrCode = new Html5Qrcode("reader");
    const wrapper = document.querySelector('.scanner-wrapper');
    const status = document.querySelector('.status');

    // Función para emitir un "beep"
    function playBeep() {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // Tono alto
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.start();
        setTimeout(() => oscillator.stop(), 100); // 100ms
    }

    const onScanSuccess = (decodedText) => {
        // Ejecutar "beep"
        playBeep();

        // Poner contorno verde
        wrapper.classList.add('success');
        status.innerText = "Leído: " + decodedText;

        // Quitar contorno verde después de 1 segundo
        setTimeout(() => {
            wrapper.classList.remove('success');
            status.innerText = "Apunta al código de barras";
        }, 1500);
    };

    const config = { 
        fps: 10, 
        qrbox: (viewfinderWidth, viewfinderHeight) => {
            return { width: viewfinderWidth * 0.8, height: viewfinderHeight * 0.8 };
        }
    };

    // Iniciar scanner automáticamente
    html5QrCode.start(
        { facingMode: "environment" }, 
        config, 
        onScanSuccess
    ).catch(err => {
        console.error("Error al iniciar camara", err);
        status.innerText = "Error: Permite el acceso a la cámara";
    });
});
