let activeStream = null;
let scanAnimationId = null;
let isScanning = false;
let barcodeDetector = null;

// Initialize native BarcodeDetector if available
if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
  try {
    barcodeDetector = new window.BarcodeDetector({
      formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code']
    });
  } catch (e) {
    console.warn('BarcodeDetector format init fallback:', e);
    barcodeDetector = new window.BarcodeDetector();
  }
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1800, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch (e) {
    // Audio context not allowed or unsupported
  }
}

async function startScanner(videoEl, onResult) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Kamera tidak didukung pada browser ini');
  }

  stopScanner();

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });

    activeStream = stream;
    videoEl.srcObject = stream;
    await videoEl.play();
    isScanning = true;

    if (!barcodeDetector) {
      if ('BarcodeDetector' in window) {
        barcodeDetector = new window.BarcodeDetector();
      } else {
        throw new Error('BarcodeDetector API tidak aktif di browser ini. Masukkan barcode secara manual.');
      }
    }

    let lastDetectedCode = '';
    let lastDetectedTime = 0;

    const detectLoop = async () => {
      if (!isScanning) return;

      if (videoEl.readyState === videoEl.HAVE_ENOUGH_DATA) {
        try {
          const barcodes = await barcodeDetector.detect(videoEl);
          if (barcodes && barcodes.length > 0 && isScanning) {
            const rawValue = String(barcodes[0].rawValue || '').trim();
            if (rawValue) {
              // Hentikan kamera dan loop secara instan agar tidak terjadi double-scan
              stopScanner();
              playBeep();
              navigator.vibrate?.([60]);
              onResult(rawValue);
              return;
            }
          }
        } catch (err) {
          // Frame glitch, abaikan dan lanjut frame berikutnya
        }
      }

      if (isScanning) {
        scanAnimationId = requestAnimationFrame(detectLoop);
      }
    };

    scanAnimationId = requestAnimationFrame(detectLoop);
  } catch (err) {
    stopScanner();
    throw err;
  }
}

function stopScanner() {
  isScanning = false;
  if (scanAnimationId) {
    cancelAnimationFrame(scanAnimationId);
    scanAnimationId = null;
  }
  if (activeStream) {
    activeStream.getTracks().forEach(track => track.stop());
    activeStream = null;
  }
}

if (typeof window !== 'undefined') {
  window.startScanner = startScanner;
  window.stopScanner = stopScanner;
  window.playBeep = playBeep;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { startScanner, stopScanner, playBeep };
}
