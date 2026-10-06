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

async function startScanner(videoEl, onResult, options = {}) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Kamera tidak didukung pada browser ini');
  }

  stopScanner();
  currentVideoEl = videoEl;

  let lastContinuousBarcode = '';
  let lastContinuousTime = 0;

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
        height: { ideal: 720 },
        advanced: [{ focusMode: 'continuous' }]
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

            // Saring barcode berdasarkan batas jarak & area bidik tengah (ROI)
            const targetedBarcodes = valid1DBarcodes.filter(b => {
              if (b.boundingBox && videoEl && videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
                const box = b.boundingBox;
                const vWidth = videoEl.videoWidth;
                const vHeight = videoEl.videoHeight;

                // 1. Batas Jarak Maksimal: Barcode harus berukuran minimal 16% dari frame
                // Barcode kecil yang jauh di belakang meja diabaikan
                const maxDimRatio = Math.max(box.width / vWidth, box.height / vHeight);
                if (maxDimRatio < 0.16) {
                  return false;
                }

                // 2. Area Bidik Tengah (ROI): Titik tengah barcode harus di dalam area bidik
                const centerX = box.x + (box.width / 2);
                const centerY = box.y + (box.height / 2);
                if (centerX < vWidth * 0.10 || centerX > vWidth * 0.90 ||
                    centerY < vHeight * 0.10 || centerY > vHeight * 0.90) {
                  return false;
                }
              }
              return true;
            });

            if (targetedBarcodes.length > 0) {
              const rawValue = String(targetedBarcodes[0].rawValue || '').trim();
              if (rawValue) {
                const now = Date.now();
                if (options && options.continuous) {
                  // Mode continuous (Kulakan): cegah scan ganda barcode yang sama dalam 1.2 detik, beda barcode min 500ms
                  if (lastContinuousBarcode === rawValue && (now - lastContinuousTime < 1300)) {
                    // Skip duplicate frame for same barcode
                  } else if (now - lastContinuousTime < 500) {
                    // Skip too rapid inter-frame transition
                  } else {
                    lastContinuousBarcode = rawValue;
                    lastContinuousTime = now;
                    playBeep();
                    navigator.vibrate?.([60]);
                    onResult(rawValue, { continuous: true });
                  }
                } else {
                  // Hentikan kamera dan loop seketika untuk mencegah double-scan
                  stopScanner();
                  playBeep();
                  navigator.vibrate?.([60]);
                  onResult(rawValue, { continuous: false });
                  return;
                }
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

function showFocusIndicator(x, y) {
  const container = document.getElementById('scannerViewfinderContainer');
  if (!container) return;

  const old = container.querySelector('.camera-focus-ring');
  if (old) old.remove();

  const ring = document.createElement('div');
  ring.className = 'camera-focus-ring';
  ring.style.left = `${x}px`;
  ring.style.top = `${y}px`;
  container.appendChild(ring);

  requestAnimationFrame(() => {
    ring.classList.add('focused');
  });

  setTimeout(() => {
    ring.classList.add('fade-out');
    setTimeout(() => ring.remove(), 400);
  }, 600);
}

async function triggerCameraFocus(clientX, clientY) {
  showFocusIndicator(clientX, clientY);

  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate(25); } catch (_) {}
  }

  if (!activeStream) return;
  const track = activeStream.getVideoTracks()[0];
  if (!track || !track.applyConstraints) return;

  try {
    const caps = track.getCapabilities ? track.getCapabilities() : {};
    if (caps.focusMode && Array.isArray(caps.focusMode)) {
      if (caps.focusMode.includes('single-shot')) {
        await track.applyConstraints({ advanced: [{ focusMode: 'single-shot' }] });
      } else if (caps.focusMode.includes('continuous')) {
        await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
      }
    } else {
      await track.applyConstraints({
        advanced: [{ focusMode: 'continuous' }]
      });
    }
  } catch (err) {
    // Focus constraint fallback
  }
}

function onScannerViewfinderTap(event) {
  const container = document.getElementById('scannerViewfinderContainer');
  if (!container) return;
  const rect = container.getBoundingClientRect();
  const relX = event.clientX - rect.left;
  const relY = event.clientY - rect.top;
  triggerCameraFocus(relX, relY);
}

if (typeof window !== 'undefined') {
  window.startScanner = startScanner;
  window.stopScanner = stopScanner;
  window.playBeep = playBeep;
  window.unlockAudio = unlockAudio;
  window.triggerCameraFocus = triggerCameraFocus;
  window.onScannerViewfinderTap = onScannerViewfinderTap;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { startScanner, stopScanner, playBeep, unlockAudio, triggerCameraFocus, onScannerViewfinderTap };
}
