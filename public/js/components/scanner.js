let activeStream = null;
let scanAnimationId = null;
let isScanning = false;
let barcodeDetector = null;
let currentVideoEl = null;

// Initialize native BarcodeDetector if available
const LINEAR_1D_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'codabar'];

// Initialize native BarcodeDetector if available (hanya 1D linear barcode, tanpa QR kotak)
if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
  try {
    barcodeDetector = new window.BarcodeDetector({ formats: LINEAR_1D_FORMATS });
  } catch (e) {
    console.warn('BarcodeDetector format init fallback:', e);
    try {
      barcodeDetector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });
    } catch {
      barcodeDetector = new window.BarcodeDetector();
    }
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
  currentVideoEl = videoEl;

  if (videoEl) {
    videoEl.muted = true;
    videoEl.autoplay = true;
    videoEl.playsInline = true;
    videoEl.setAttribute('playsinline', '');
    videoEl.setAttribute('webkit-playsinline', '');
    videoEl.setAttribute('disablePictureInPicture', '');
    videoEl.style.opacity = '0';
  }

  const loadingText = typeof document !== 'undefined' ? document.getElementById('scannerLoadingText') : null;
  if (loadingText) loadingText.style.display = 'flex';

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
    if (videoEl) videoEl.style.opacity = '1';
    if (loadingText) loadingText.style.display = 'none';
    isScanning = true;

    if (!barcodeDetector) {
      if ('BarcodeDetector' in window) {
        try {
          barcodeDetector = new window.BarcodeDetector({ formats: LINEAR_1D_FORMATS });
        } catch {
          barcodeDetector = new window.BarcodeDetector();
        }
      } else {
        throw new Error('BarcodeDetector API tidak aktif di browser ini. Masukkan barcode secara manual.');
      }
    }

    const detectLoop = async () => {
      if (!isScanning) return;

      if (videoEl.readyState === videoEl.HAVE_ENOUGH_DATA) {
        try {
          const barcodes = await barcodeDetector.detect(videoEl);
          if (barcodes && barcodes.length > 0 && isScanning) {
            // Filter HANYA barcode 1D garis panjang retail (EAN-13, dsb.)
            // Abaikan barcode 2D kotak (QR Code, DataMatrix BPOM seperti (90)MD...)
            const valid1DBarcodes = barcodes.filter(b => {
              const fmt = (b.format || '').toLowerCase();
              const val = String(b.rawValue || '').trim();

              // Tolak format 2D kotak
              if (['qr_code', 'data_matrix', 'aztec', 'pdf417'].includes(fmt)) return false;

              // Tolak kode BPOM / GS1 DataMatrix 2D yang diawali (90) atau (01) atau URL web
              if (val.startsWith('(90)') || val.startsWith('(01)') || val.startsWith('http://') || val.startsWith('https://')) {
                return false;
              }

              return val.length > 0;
            });

            if (valid1DBarcodes.length > 0) {
              const rawValue = String(valid1DBarcodes[0].rawValue || '').trim();
              if (rawValue) {
                // Hentikan kamera dan loop seketika untuk mencegah double-scan
                stopScanner();
                playBeep();
                navigator.vibrate?.([60]);
                onResult(rawValue);
                return;
              }
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
  if (currentVideoEl) {
    try {
      currentVideoEl.pause();
      currentVideoEl.srcObject = null;
      currentVideoEl.style.opacity = '0';
    } catch (_) {}
    currentVideoEl = null;
  }
  const loadingText = typeof document !== 'undefined' ? document.getElementById('scannerLoadingText') : null;
  if (loadingText) loadingText.style.display = 'none';
}

if (typeof window !== 'undefined') {
  window.startScanner = startScanner;
  window.stopScanner = stopScanner;
  window.playBeep = playBeep;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { startScanner, stopScanner, playBeep };
}
