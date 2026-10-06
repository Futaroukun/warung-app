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

const INDONESIA_KNOWN_BARCODES = {
  // Rokok & Tembakau (Dikecualikan oleh Open Food Facts)
  '8999909015838': { name: 'Dji Sam Soe Magnum Filter 12', category: 'Rokok', brand: 'Dji Sam Soe' },
  '8999909005402': { name: 'Sampoerna A Mild 16', category: 'Rokok', brand: 'Sampoerna' },
  '8999909000100': { name: 'Dji Sam Soe 234 Kretek 12', category: 'Rokok', brand: 'Dji Sam Soe' },
  '8999909005006': { name: 'Sampoerna Hijau 12', category: 'Rokok', brand: 'Sampoerna' },
  '8999909020009': { name: 'Marlboro Merah 20', category: 'Rokok', brand: 'Marlboro' },
  '8999909020016': { name: 'Marlboro Gold Lights 20', category: 'Rokok', brand: 'Marlboro' },
  '8999909020023': { name: 'Marlboro Filter Black 20', category: 'Rokok', brand: 'Marlboro' },
  '8992770001007': { name: 'Gudang Garam Surya 16', category: 'Rokok', brand: 'Gudang Garam' },
  '8992770001014': { name: 'Gudang Garam Surya 12', category: 'Rokok', brand: 'Gudang Garam' },
  '8992770014007': { name: 'Gudang Garam International 12', category: 'Rokok', brand: 'Gudang Garam' },
  '8992770020008': { name: 'Gudang Garam Merah King Size 12', category: 'Rokok', brand: 'Gudang Garam' },
  '8992770000017': { name: 'Gudang Garam Signature 12', category: 'Rokok', brand: 'Gudang Garam' },
  '8992388111005': { name: 'Djarum Super 12', category: 'Rokok', brand: 'Djarum' },
  '8992388111012': { name: 'Djarum Super 16', category: 'Rokok', brand: 'Djarum' },
  '8992388121004': { name: 'LA Lights 16', category: 'Rokok', brand: 'Djarum' },
  '8992388121011': { name: 'LA Bold 20', category: 'Rokok', brand: 'Djarum' },
  '8992388131003': { name: 'Djarum Coklat Kretek 12', category: 'Rokok', brand: 'Djarum' },
  '8992388141002': { name: 'Djarum 76 Kretek 12', category: 'Rokok', brand: 'Djarum' },
  '8997232230005': { name: 'Esse Change Juicy 20', category: 'Rokok', brand: 'Esse' },
  '8997232230012': { name: 'Esse Change Double 20', category: 'Rokok', brand: 'Esse' },
  '8997232230029': { name: 'Esse Berry Pop 20', category: 'Rokok', brand: 'Esse' },
  '8997232230036': { name: 'Camel Option Purple 20', category: 'Rokok', brand: 'Camel' },
  '8997232230043': { name: 'Camel Yellow 20', category: 'Rokok', brand: 'Camel' },

  // Kopi, Teh & Minuman Sachet
  '8999999522108': { name: 'Kopi Kapal Api Special Mix 24g', category: 'Minuman', brand: 'Kapal Api' },
  '8991389220015': { name: 'Kopi Good Day Mocacinno 20g', category: 'Minuman', brand: 'Good Day' },
  '8991389220022': { name: 'Kopi Good Day Cappuccino 25g', category: 'Minuman', brand: 'Good Day' },
  '8999908000002': { name: 'Kopi ABC Susu 31g', category: 'Minuman', brand: 'ABC' },
  '8992753220018': { name: 'Teh Pucuk Harum 350ml', category: 'Minuman', brand: 'Teh Pucuk' },
  '8992753220025': { name: 'Kopiko 78C Coffee Latte 240ml', category: 'Minuman', brand: 'Kopiko' },
  '8996001600269': { name: 'Le Minerale Air Mineral 600ml', category: 'Minuman', brand: 'Le Minerale' },
  '8996001300008': { name: 'Aqua Air Mineral 600ml', category: 'Minuman', brand: 'Aqua' },
  '8996001300015': { name: 'Aqua Air Mineral 1500ml', category: 'Minuman', brand: 'Aqua' },
  '8992736110016': { name: 'Ultra Milk Cokelat 250ml', category: 'Minuman', brand: 'Ultra Milk' },
  '8992736110023': { name: 'Ultra Milk Full Cream 250ml', category: 'Minuman', brand: 'Ultra Milk' },
  '8992736210013': { name: 'Teh Kotak Jasmine 300ml', category: 'Minuman', brand: 'Teh Kotak' },

  // Mie Instan & Makanan Ringan
  '8991002105206': { name: 'Indomie Mi Goreng 85g', category: 'Makanan', brand: 'Indomie' },
  '8991002105213': { name: 'Indomie Kuah Ayam Bawang 69g', category: 'Makanan', brand: 'Indomie' },
  '8991002105220': { name: 'Indomie Kuah Soto Mie 70g', category: 'Makanan', brand: 'Indomie' },
  '8998866200259': { name: 'Mie Sedaap Goreng 90g', category: 'Makanan', brand: 'Mie Sedaap' },
  '8998866200266': { name: 'Mie Sedaap Soto 75g', category: 'Makanan', brand: 'Mie Sedaap' },
  '8992753110012': { name: 'Beng-Beng Wafer Coklat 25g', category: 'Makanan', brand: 'Beng-Beng' },
  '8992753110029': { name: 'Roma Sari Gandum 115g', category: 'Makanan', brand: 'Roma' },
  '8992753110036': { name: 'Roma Kelapa 300g', category: 'Makanan', brand: 'Roma' },

  // Kebutuhan Rumah Tangga & Obat Warung
  '8992761110014': { name: 'Promag Tablet Kunyah Blister', category: 'Obat', brand: 'Promag' },
  '8992761120013': { name: 'Tolak Angin Cair Sido Muncul', category: 'Obat', brand: 'Tolak Angin' },
  '8999999120007': { name: 'Pepsodent Pencegah Gigi Berlubang 120g', category: 'Perawatan', brand: 'Pepsodent' },
  '8999999230003': { name: 'Lifebuoy Sabun Mandi Batang 110g', category: 'Perawatan', brand: 'Lifebuoy' },
  '8998838110012': { name: 'Mama Lemon Jeruk Nipis 780ml', category: 'Kebersihan', brand: 'Mama Lemon' },
  '8998838220019': { name: 'Daia Deterjen Bunga 850g', category: 'Kebersihan', brand: 'Daia' },
  '8998838330016': { name: 'So Klin Pewangi Pouch 800ml', category: 'Kebersihan', brand: 'So Klin' }
};

const INDONESIA_PREFIX_DIRECTORIES = [
  { prefix: '8999909', brand: 'Sampoerna / Dji Sam Soe', category: 'Rokok' },
  { prefix: '8992770', brand: 'Gudang Garam', category: 'Rokok' },
  { prefix: '8992388', brand: 'Djarum', category: 'Rokok' },
  { prefix: '8997232', brand: 'KT&G / Esse', category: 'Rokok' },
  { prefix: '8991002', brand: 'Indofood CBP', category: 'Makanan' },
  { prefix: '8991001', brand: 'Indofood', category: 'Makanan' },
  { prefix: '8998866', brand: 'Wings Food', category: 'Makanan' },
  { prefix: '8998838', brand: 'Wings Care', category: 'Kebersihan' },
  { prefix: '8992753', brand: 'Mayora', category: 'Makanan' },
  { prefix: '8991389', brand: 'Santos Jaya Abadi / Kapal Api', category: 'Minuman' },
  { prefix: '8999908', brand: 'ABC Kogen', category: 'Minuman' },
  { prefix: '8996001', brand: 'Danone / Aqua', category: 'Minuman' },
  { prefix: '8992736', brand: 'Ultra Jaya', category: 'Minuman' },
  { prefix: '8992761', brand: 'Kalbe Farma', category: 'Obat' },
  { prefix: '8999999', brand: 'Unilever', category: 'Perawatan' },
  { prefix: '8999996', brand: 'Unilever', category: 'Perawatan' },
  { prefix: '8992999', brand: 'Orang Tua (OT)', category: 'Makanan' },
  { prefix: '8997003', brand: 'Frisian Flag', category: 'Minuman' },
  { prefix: '8993005', brand: 'Nestle', category: 'Makanan' }
];

async function fetchOnlineBarcodeProduct(barcode) {
  if (!barcode || String(barcode).trim().length < 6) return null;
  const clean = String(barcode).trim();

  // 1. Cek kamus produk ritel & warung Indonesia
  if (INDONESIA_KNOWN_BARCODES[clean]) {
    const item = INDONESIA_KNOWN_BARCODES[clean];
    return {
      name: item.name,
      category: item.category || 'Umum',
      brand: item.brand || ''
    };
  }

  // 2. Query online Open Food / Products / Beauty Facts
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 3500) : null;

  const endpoints = [
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(clean)}.json`,
    `https://world.openproductsfacts.org/api/v2/product/${encodeURIComponent(clean)}.json`,
    `https://world.openbeautyfacts.org/api/v2/product/${encodeURIComponent(clean)}.json`
  ];

  try {
    const fetchPromises = endpoints.map(async (url) => {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'KasirWarung - Android/Web - Version 1.0' },
        signal: controller ? controller.signal : undefined
      });
      if (!res.ok) throw new Error('Not ok');
      const data = await res.json();
      if (data && data.status === 1 && data.product) {
        const p = data.product;
        const rawName = p.product_name_id || p.product_name || p.product_name_en || '';
        if (!rawName) throw new Error('No name');
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
      throw new Error('Not found');
    });

    const result = await Promise.any(fetchPromises);
    if (timeoutId) clearTimeout(timeoutId);
    return result;
  } catch (err) {
    if (timeoutId) clearTimeout(timeoutId);

    // 3. Fallback cerdas: Deteksi Produsen & Kategori via GS1 Indonesia Prefix
    const prefixMatch = INDONESIA_PREFIX_DIRECTORIES.find(p => clean.startsWith(p.prefix));
    if (prefixMatch) {
      return {
        name: `Produk ${prefixMatch.brand}`,
        category: prefixMatch.category || 'Umum',
        brand: prefixMatch.brand || '',
        isPrefixHint: true
      };
    }

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

