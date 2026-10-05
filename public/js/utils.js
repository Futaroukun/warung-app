function formatRp(num) {
  const n = Number(num) || 0;
  return 'Rp ' + n.toLocaleString('id-ID');
}

function toTitleCase(str) {
  if (!str) return '';
  return str
    .toString()
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/(^|[\s\(\)\[\]\/\-_.,])([a-z])/g, (m, p1, p2) => p1 + p2.toUpperCase());
}

function cleanNumber(val) {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const cleaned = val.toString().replace(/[^0-9]/g, '');
  return Number(cleaned) || 0;
}

function formatTanggal(isoString) {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return isoString;
  }
}

function autoCapitalizeWords(str) {
  if (!str) return '';
  return str.toString().replace(/(^|[\s\(\)\[\]\/\-_.,])([a-z])/g, (m, p1, p2) => p1 + p2.toUpperCase());
}

function autoCapitalizeSentences(str) {
  if (!str) return '';
  return str.toString().replace(/(^|[.!?]\s+)([a-z])/g, (m, p1, p2) => p1 + p2.toUpperCase());
}

async function fetchOnlineBarcodeProduct(barcode) {
  if (!barcode || String(barcode).trim().length < 6) return null;
  const clean = String(barcode).trim();
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 2800) : null;

  try {
    const fetchOpts = {
      headers: { 'User-Agent': 'KasirWarung - Android/Web - Version 1.0' }
    };
    if (controller) fetchOpts.signal = controller.signal;

    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(clean)}.json`, fetchOpts);
    if (timeoutId) clearTimeout(timeoutId);
    if (!res || !res.ok) return null;
    const data = await res.json();
    if (data && data.status === 1 && data.product) {
      const p = data.product;
      const rawName = p.product_name_id || p.product_name || p.product_name_en || '';
      if (!rawName) return null;
      const brand = p.brands ? p.brands.split(',')[0].trim() : '';
      let category = 'Umum';
      if (p.categories) {
        const catFirst = p.categories.split(',')[0].trim();
        if (catFirst) category = toTitleCase(catFirst.replace(/^[a-z]{2}:/, ''));
      }
      let finalName = rawName.trim();
      if (brand && !finalName.toLowerCase().includes(brand.toLowerCase())) {
        finalName = `${brand} ${finalName}`;
      }
      return {
        name: toTitleCase(finalName),
        category: category || 'Umum',
        brand: brand ? toTitleCase(brand) : ''
      };
    }
    return null;
  } catch (err) {
    if (timeoutId) clearTimeout(timeoutId);
    return null;
  }
}

// Support both ES Modules in browser and CommonJS in tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { formatRp, toTitleCase, cleanNumber, formatTanggal, autoCapitalizeWords, autoCapitalizeSentences, fetchOnlineBarcodeProduct };
}

if (typeof window !== 'undefined') {
  window.formatRp = formatRp;
  window.toTitleCase = toTitleCase;
  window.cleanNumber = cleanNumber;
  window.formatTanggal = formatTanggal;
  window.autoCapitalizeWords = autoCapitalizeWords;
  window.autoCapitalizeSentences = autoCapitalizeSentences;
  window.fetchOnlineBarcodeProduct = fetchOnlineBarcodeProduct;
}

