let html5QrCode;
let isScanning = false;
let history = JSON.parse(localStorage.getItem('scannerHistory')) || [];

// DOM Elements
const btnStartScan = document.getElementById('btn-start-scan');
const btnStopScan = document.getElementById('btn-stop-scan');
const readerElement = document.getElementById('reader');
const modal = document.getElementById('result-modal');
const resultText = document.getElementById('scanned-result-text');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnCopy = document.getElementById('btn-copy');
const navItems = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.view');
const pageTitle = document.getElementById('page-title');
const historyList = document.getElementById('history-list');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    renderHistory();
    
    // Navigation Logic
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            if(item.dataset.target) {
                switchView(item.dataset.target);
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
                
                // Update Title
                pageTitle.textContent = item.querySelector('span').textContent;
            }
        });
    });

    // Scanner Buttons
    btnStartScan.addEventListener('click', startScanner);
    btnStopScan.addEventListener('click', stopScanner);

    // Modal Buttons
    btnCloseModal.addEventListener('click', () => {
        modal.classList.add('hidden');
        if(isScanning) {
            html5QrCode.resume();
        }
    });

    btnCopy.addEventListener('click', () => {
        navigator.clipboard.writeText(resultText.textContent).then(() => {
            const originalText = btnCopy.innerHTML;
            btnCopy.innerHTML = '<ion-icon name="checkmark-outline"></ion-icon> Copied!';
            setTimeout(() => btnCopy.innerHTML = originalText, 2000);
        });
    });
});

function switchView(targetId) {
    views.forEach(view => {
        if(view.id === targetId) {
            view.classList.add('active');
        } else {
            view.classList.remove('active');
        }
    });
    
    // Stop scanner if switching away from scan view
    if(targetId !== 'view-scan' && isScanning) {
        stopScanner();
    }
}

async function startScanner() {
    if (!html5QrCode) {
        html5QrCode = new Html5Qrcode("reader");
    }

    const config = {
        fps: 30, // High frame rate for native feel
        qrbox: { width: 300, height: 150 }, // Rectangular box for 1D barcodes
        aspectRatio: 1.0,
        disableFlip: false,
        useBarCodeDetectorIfSupported: true, // Native hardware acceleration
        formatsToSupport: [
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.ITF,
            Html5QrcodeSupportedFormats.QR_CODE
        ]
    };



    try {
        await html5QrCode.start(
            { facingMode: "environment" }, 
            config,
            onScanSuccess,
            onScanFailure
        );
        isScanning = true;
        btnStartScan.classList.add('hidden');
        btnStopScan.classList.remove('hidden');
        
        // Hide overlay initially to show the viewfinder cleanly
        document.querySelector('.instruction-toast').style.display = 'none';
    } catch (err) {
        console.error("Error starting scanner", err);
        alert("Camera access denied or error starting scanner. " + err);
    }
}

async function stopScanner() {
    if (html5QrCode && isScanning) {
        try {
            await html5QrCode.stop();
            isScanning = false;
            btnStartScan.classList.remove('hidden');
            btnStopScan.classList.add('hidden');
            document.querySelector('.instruction-toast').style.display = 'block';
        } catch (err) {
            console.error("Error stopping scanner", err);
        }
    }
}

function onScanSuccess(decodedText, decodedResult) {
    // Vibrate device if supported
    if (navigator.vibrate) {
        navigator.vibrate(50);
    }

    // Pause scanner so it doesn't keep scanning the same code
    if(html5QrCode.getState() === Html5QrcodeScannerState.SCANNING) {
        html5QrCode.pause();
    }

    // Show Result
    resultText.textContent = decodedText;
    modal.classList.remove('hidden');

    // Save to history
    saveToHistory(decodedText, decodedResult.result.format?.formatName || 'Barcode');
}

function onScanFailure(error) {
    // handle scan failure, usually better to ignore and keep scanning
    // console.warn(`Code scan error = ${error}`);
}

function saveToHistory(text, format) {
    // Avoid immediate duplicates
    if(history.length > 0 && history[0].text === text) return;

    const newItem = {
        text: text,
        format: format,
        timestamp: new Date().toISOString()
    };

    history.unshift(newItem);
    if(history.length > 50) history.pop(); // keep last 50
    
    localStorage.setItem('scannerHistory', JSON.stringify(history));
    renderHistory();
}

function renderHistory() {
    if (history.length === 0) {
        historyList.innerHTML = '<div class="empty-state" style="text-align:center; padding: 40px; color: var(--text-secondary);">No recent scans.</div>';
        return;
    }

    historyList.innerHTML = history.map(item => {
        const date = new Date(item.timestamp);
        const timeString = date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const dateString = date.toLocaleDateString();
        return `
            <li class="history-item">
                <div>
                    <div class="history-text">${item.text}</div>
                    <div class="history-date">${item.format} • ${dateString} ${timeString}</div>
                </div>
                <ion-icon name="copy-outline" style="color: var(--primary-color); cursor: pointer;" onclick="navigator.clipboard.writeText('${item.text}')"></ion-icon>
            </li>
        `;
    }).join('');
}
