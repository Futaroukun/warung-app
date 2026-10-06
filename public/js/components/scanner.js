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

let audioCtx = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch (e) {
    return null;
  }
}

function unlockAudio() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

// User-gesture listener untuk pre-unlock AudioContext pada browser mobile / Android WebView
if (typeof window !== 'undefined') {
  const unlock = () => {
    unlockAudio();
    window.removeEventListener('click', unlock);
    window.removeEventListener('touchstart', unlock);
  };
  window.addEventListener('click', unlock, { once: true, passive: true });
  window.addEventListener('touchstart', unlock, { once: true, passive: true });
}

function playBeep() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Bunyi "niiittt" khas barcode scanner kasir supermarket / minimarket
    // Frekuensi 2700 Hz (standar nada piezo buzzer barcode scanner)
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(2700, now);

    // Filter halus agar suara tidak pecah sekaligus menjaga nada tinggi tetap renyah
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(4500, now);

    // Envelope suara "niiittt": attack tajam (3ms), sustain stabil (87ms), release bersih (20ms) -> Total ~110ms
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.003);
    gain.gain.setValueAtTime(0.4, now + 0.09);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.11);
  } catch (e) {
    console.warn('Barcode beep audio error:', e);
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
  window.unlockAudio = unlockAudio;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { startScanner, stopScanner, playBeep, unlockAudio };
}
