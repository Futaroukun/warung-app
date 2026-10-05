# Desain Arsitektur Fase 2: Frontend Modularization & Kasir POS UX

## 1. Ringkasan Eksekutif
Fase 2 mentransformasi frontend Warung App dari satu file monolitik (`public/index.html` >4200 baris) menjadi arsitektur modular yang terorganisir rapi menggunakan native ES Modules dan CSS berlapis. Tidak ada build step berat yang membebani Termux Android. Selain modularisasi, fase ini memperkenalkan fitur kasir modern: pemindaian barcode produk dengan kamera HP, pencetakan struk belanja thermal (format 58mm/80mm), opsi bagikan struk digital via WhatsApp, serta integrasi tombol unduh backup database langsung dari UI.

## 2. Struktur Direktori Frontend

```
warung-app/
├── public/
│   ├── index.html                   # Shell HTML bersih, semantik (<600 baris)
│   ├── manifest.json                # PWA manifest
│   ├── icon.png                     # Logo app
│   ├── css/
│   │   ├── variables.css            # Token desain, palette fintech neon-mint, spacing, typography
│   │   ├── base.css                 # Reset, layout container, header, bottom navigation bar
│   │   ├── components.css           # Cards, buttons, inputs, badge, cart floating bar, bottom sheet modals, toasts
│   │   └── print.css                # CSS khusus media print thermal 58mm / 80mm
│   └── js/
│       ├── app.js                   # Entry point ES Module: init router, event delegation, tab switching
│       ├── api.js                   # HTTP client terstandar (fetch wrapper dengan error toast otomatis)
│       ├── store.js                 # Global reactive store (cart, active tab, items cache, active filters)
│       ├── utils.js                 # Helper formatRp, toTitleCase, formatTanggal, sanitizeNumber
│       ├── components/
│       │   ├── toast.js             # Toast notification engine
│       │   ├── sheets.js            # Bottom sheet modal controller
│       │   ├── scanner.js           # Barcode scanner via kamera (BarcodeDetector API & video stream fallback)
│       │   └── printer.js           # Generator struk thermal 58mm & generator pesan WhatsApp
│       └── tabs/
│           ├── dashboard.js         # Tab Ringkasan: metrik omset, laba, estimasi aset stok, kasbon
│           ├── pos.js               # Tab Kasir/Stok: search realtime, filter kategori, keranjang belanja, checkout
│           ├── debts.js             # Tab Kasbon: daftar hutang, cicilan bertahap, status pelunasan
│           ├── history.js           # Tab Riwayat: riwayat transaksi penjualan, cetak ulang struk, filter tanggal
│           └── system.js            # Tab Pengaturan/Sistem: health RAM Termux & tombol satu klik unduh backup DB
└── android/app/src/main/assets/     # Mirror aset untuk APK Android WebView
```

## 3. Komponen Utama & Fitur

### 3.1 CSS Layering
- `variables.css`: Variabel CSS `:root` warna canvas dark (`--bg-base: #07090e`, `--bg-card: #131826`), warna aksen neon mint (`--emerald: #00f59b`), font stack, dan border styling.
- `base.css`: Struktur dasar mobile-first, viewport lock, header atas, dan navigasi tab bawah (`.bottom-bar`).
- `components.css`: Styling modular untuk `.stat-card`, `.item-card`, `.cart-bar`, `.sheet-box`, `.btn`, `.input-box`.
- `print.css`: Aturan `@media print` yang menyembunyikan semua elemen UI kecuali struk `.receipt-print-area`, mengatur lebar 58mm monospace, kontras hitam putih tajam tanpa margin kertas browser.

### 3.2 State Management (`store.js`)
Penyimpanan state reaktif sederhana tanpa library pihak ketiga:
- `cart`: Array of `{ id, name, sell_price, buy_price, stock, qty }`
- `activeTab`: `'dashboard' | 'pos' | 'debts' | 'history' | 'system'`
- `items`: Cache produk untuk pencarian dan pemindaian barcode instan
- `filters`: Kategori aktif dan query pencarian
- Event listener berbasis observer pattern (`store.subscribe(key, callback)`) agar UI ter-render otomatis saat keranjang berubah.

### 3.3 Barcode Scanner (`scanner.js`)
- Menggunakan native Web API `BarcodeDetector` (didukung di Android Chrome/WebView) dengan fallback camera video stream `navigator.mediaDevices.getUserMedia`.
- Saat barcode terdeteksi:
  1. Suara beep audio sintetis Web Audio API (`AudioContext`).
  2. Cari item di `store.items` berdasarkan field `barcode`.
  3. Jika ditemukan, langsung tambahkan ke keranjang belanja (`store.addToCart(item)`).
  4. Jika tidak ditemukan, tawarkan untuk membuat produk baru dengan barcode tersebut.

### 3.4 Cetak Struk & Share WhatsApp (`printer.js`)
- **Thermal Print**: Menyiapkan template struk rapi berformat monospaced (Nama Warung, Alamat/Telp, No Invoice, Tanggal, Item x Qty = Subtotal, Total, Bayar, Kembalian, Catatan Footer) lalu memanggil `window.print()`.
- **Share WhatsApp**: Menghasilkan link `https://wa.me/?text=...` berisi format struk teks rapi berborder WhatsApp (`╭── ✦ *STRUK WARUNG* ✦ ... ╰━━━━━━━━━━━━━`) yang dapat dikirimkan langsung ke nomor pelanggan untuk transaksi kasbon maupun tunai.

### 3.5 Sinkronisasi Android
Menyediakan perintah npm script `npm run sync-assets` yang menyalin `public/` ke `android/app/src/main/assets/` secara instan setiap kali ada perubahan pada frontend.

## 4. Rencana Pengujian Frontend
- Verifikasi syntax JS ES Modules tanpa bundler (`node -c` atau script static server test).
- Pengujian browser/DOM integration: memastikan semua script dimuat tanpa `404` atau syntax error, modal terbuka dan tertutup dengan benar, keranjang belanja menghitung total secara akurat.
