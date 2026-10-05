# Desain Arsitektur Fase 3: Financial Analytics & Advanced Reporting

## 1. Ringkasan Eksekutif
Fase 3 melengkapi Warung App dengan kemampuan analitik keuangan tingkat lanjut dan otomasi operasional warung:
1. Laporan Laba Rugi (Profit & Loss Statement) otomatis dengan perhitungan HPP (Harga Pokok Penjualan) riil.
2. Fitur Export Spreadsheet (CSV) untuk transaksi penjualan dan inventaris stok, siap dibuka di Microsoft Excel atau Google Sheets.
3. Fitur Penagihan Kasbon Cerdas via WhatsApp (WhatsApp Debt Reminder) yang menghasilkan pesan ramah dan informatif lengkap dengan rincian hutang dan tanggal transaksi.

## 2. Spesifikasi Endpoint API Baru

### 2.1 Laporan Laba Rugi
- **Endpoint**: `GET /api/reports/profit-loss`
- **Query Params**: `startDate` (YYYY-MM-DD), `endDate` (YYYY-MM-DD)
- **Response**:
```json
{
  "success": true,
  "data": {
    "period": { "startDate": "2026-10-01", "endDate": "2026-10-05" },
    "gross_revenue": 1500000,
    "cogs_total": 1200000,
    "net_profit": 300000,
    "profit_margin_percent": 20.0,
    "cash_collected": 1400000,
    "uncollected_debts": 100000,
    "top_products_by_revenue": [...],
    "top_products_by_profit": [...]
  }
}
```

### 2.2 Ekspor Data ke CSV / Excel
- **Endpoint 1**: `GET /api/reports/export/sales`
  - Mengalirkan file CSV dengan header: `No Invoice, Tanggal, Pelanggan, Metode Pembayaran, Total Belanja, Modal (HPP), Laba Bersih, Rincian Barang`
- **Endpoint 2**: `GET /api/reports/export/items`
  - Mengalirkan file CSV dengan header: `Barcode, Nama Produk, Kategori, Harga Modal, Harga Jual, Margin Laba, Stok, Satuan, Total Nilai Aset, Status Stok`

## 3. Fitur WhatsApp Debt Reminder
Pada tab Kasbon (`public/js/tabs/debts.js`), setiap kartu kasbon yang berstatus `belum_lunas` memiliki tombol **"Tagih WA"**.
- Format pesan yang dihasilkan:
```
Halo Kak [Nama Pelanggan],
Salam hangat dari Warung Kami 🙏

Berikut rincian catatan kasbon yang tercatat:
• Sisa Kasbon: Rp [Sisa] (dari total Rp [Total])
• Tanggal Transaksi: [Tanggal]
• Keterangan: [Catatan]

Jika ada waktu luang, mohon dibantu pelunasannya ya Kak.
Terima kasih banyak atas kerjasamanya! 😊
```
- Otomatis membuka URL `https://wa.me/[NomorHP]?text=...` atau menyalin teks jika nomor HP belum diisi.

## 4. Rencana Pengujian
- Unit test backend pada `tests/financial-reports.test.js`: kalkulasi laba rugi, HPP, margin persen, dan format streaming CSV.
- Integration test verifikasi endpoint HTTP 200 dan header download file attachment.
