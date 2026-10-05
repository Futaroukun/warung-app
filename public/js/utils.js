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

// Support both ES Modules in browser and CommonJS in tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { formatRp, toTitleCase, cleanNumber, formatTanggal, autoCapitalizeWords, autoCapitalizeSentences };
}

if (typeof window !== 'undefined') {
  window.formatRp = formatRp;
  window.toTitleCase = toTitleCase;
  window.cleanNumber = cleanNumber;
  window.formatTanggal = formatTanggal;
  window.autoCapitalizeWords = autoCapitalizeWords;
  window.autoCapitalizeSentences = autoCapitalizeSentences;
}
