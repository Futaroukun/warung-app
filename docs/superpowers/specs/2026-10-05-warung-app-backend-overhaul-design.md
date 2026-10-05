# Desain Arsitektur Fase 1: Backend Architecture & Database Engine Overhaul

## 1. Ringkasan Eksekutif
Dokumen ini mendefinisikan arsitektur dan spesifikasi teknis untuk Fase 1 perombakan total Warung App: Modularisasi Backend Express dan Optimasi Engine SQLite. Fokus utama fase ini adalah mengubah arsitektur monolitik `server.js` menjadi arsitektur modular berlapis (Layered Architecture), mengaktifkan performa tinggi SQLite (WAL mode, indexing, atomic transactions), standardisasi respons API, serta pengamanan data (health monitor & instant backup).

## 2. Arsitektur & Struktur Direktori

```
warung-app/
├── server.js                        # Entry point: Express app boot, middleware wiring, port listener
├── src/
│   ├── config/
│   │   └── database.js              # SQLite connection, PRAGMA setup, migration/schema init
│   ├── routes/
│   │   ├── index.js                 # Router aggregator (/api)
│   │   ├── items.routes.js          # CRUD produk & stok
│   │   ├── sales.routes.js          # Transaksi kasir & riwayat penjualan
│   │   ├── debts.routes.js          # Kasbon & cicilan hutang
│   │   ├── reports.routes.js        # Ringkasan dashboard & laporan laba rugi
│   │   └── system.routes.js         # Health check & database backup/export
│   ├── controllers/
│   │   ├── items.controller.js      # Handler request/response item
│   │   ├── sales.controller.js      # Handler request/response transaksi
│   │   ├── debts.controller.js      # Handler request/response hutang
│   │   ├── reports.controller.js    # Handler statistik & ringkasan
│   │   └── system.controller.js     # Handler sistem & backup
│   ├── services/
│   │   ├── items.service.js         # Query & mutasi data produk
│   │   ├── sales.service.js         # Transaksi penjualan atomic (mutasi stok aman)
│   │   ├── debts.service.js         # Pengelolaan kasbon & pembayaran cicilan
│   │   └── reports.service.js       # Kalkulasi omset, laba kotor & bersih
│   └── middlewares/
│       ├── errorHandler.js          # Penanganan error tersentralisasi & SQLite exception
│       ├── validator.js             # Validasi tipe data & pembersihan input (trim, title case)
│       └── logger.js                # Request logger ringan
├── tests/
│   ├── db.test.js                   # Verifikasi skema, relasi, & transaksi rollback
│   └── api.test.js                  # Endpoint integration test dengan node:test
├── public/                          # Static assets (Frontend akan dimodularisasi pada Fase 2)
├── warung.db                        # SQLite database file
└── package.json
```

## 3. Optimasi Database SQLite Engine

### 3.1 SQLite Pragmas
Pada inisialisasi koneksi `src/config/database.js`:
- `PRAGMA journal_mode = WAL;` (Write-Ahead Logging: konkurensi pembacaan & penulisan tanpa lock)
- `PRAGMA synchronous = NORMAL;` (Mengurangi flush I/O disk yang berat di Termux tanpa mengorbankan durabilitas)
- `PRAGMA foreign_keys = ON;` (Integritas relasi data antar tabel)
- `PRAGMA cache_size = -8000;` (Alokasi memory cache ~8MB untuk query instan)
- `PRAGMA temp_store = MEMORY;` (Tabel temporer disimpan di RAM)

### 3.2 Skema Tabel & Indeks

#### 1. Tabel `items`
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `barcode` TEXT UNIQUE
- `name` TEXT NOT NULL
- `category` TEXT DEFAULT 'Umum'
- `buy_price` INTEGER DEFAULT 0
- `sell_price` INTEGER DEFAULT 0
- `stock` INTEGER DEFAULT 0
- `min_stock` INTEGER DEFAULT 3
- `unit` TEXT DEFAULT 'pcs'
- `is_active` INTEGER DEFAULT 1
- `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
- `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP
- **Indeks**: `idx_items_name` ON items(name), `idx_items_barcode` ON items(barcode), `idx_items_category` ON items(category)

#### 2. Tabel `sales`
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `invoice_no` TEXT UNIQUE NOT NULL
- `total_amount` INTEGER NOT NULL
- `total_cost` INTEGER DEFAULT 0
- `payment_type` TEXT NOT NULL CHECK(payment_type IN ('cash', 'debt', 'qris', 'transfer'))
- `cash_received` INTEGER DEFAULT 0
- `cash_change` INTEGER DEFAULT 0
- `customer_name` TEXT DEFAULT ''
- `debt_id` INTEGER DEFAULT NULL
- `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
- **Indeks**: `idx_sales_created_at` ON sales(created_at), `idx_sales_invoice` ON sales(invoice_no)

#### 3. Tabel `sale_items`
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `sale_id` INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE
- `item_id` INTEGER NOT NULL
- `item_name` TEXT NOT NULL
- `buy_price` INTEGER DEFAULT 0
- `sell_price` INTEGER NOT NULL
- `qty` INTEGER NOT NULL
- `subtotal` INTEGER NOT NULL
- **Indeks**: `idx_sale_items_sale_id` ON sale_items(sale_id), `idx_sale_items_item_id` ON sale_items(item_id)

#### 4. Tabel `debts`
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `customer_name` TEXT NOT NULL
- `phone` TEXT DEFAULT ''
- `amount` INTEGER NOT NULL
- `paid_amount` INTEGER DEFAULT 0
- `notes` TEXT DEFAULT ''
- `status` TEXT DEFAULT 'belum_lunas' CHECK(status IN ('belum_lunas', 'lunas'))
- `due_date` DATE DEFAULT NULL
- `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
- `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP
- **Indeks**: `idx_debts_status` ON debts(status), `idx_debts_customer` ON debts(customer_name)

#### 5. Tabel `debt_payments`
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `debt_id` INTEGER NOT NULL REFERENCES debts(id) ON DELETE CASCADE
- `amount` INTEGER NOT NULL
- `payment_date` DATETIME DEFAULT CURRENT_TIMESTAMP
- `notes` TEXT DEFAULT ''
- **Indeks**: `idx_debt_payments_debt_id` ON debt_payments(debt_id)

## 4. Transaksi Atomik (Atomic Transactions)
Pada proses transaksi kasir (`sales.service.js`):
1. Mulai transaksi: `BEGIN TRANSACTION`
2. Validasi stok semua item dalam keranjang belanja. Jika stok tidak mencukupi, lempar error dan lakukan `ROLLBACK`.
3. Hitung `total_cost` akumulatif dari `buy_price` masing-masing item.
4. Buat record `sales` dengan nomor invoice unik (format: `INV-YYYYMMDD-XXXX`).
5. Insert batch `sale_items` mencatat snapshot `buy_price`, `sell_price`, `qty`, dan `subtotal`.
6. Kurangi stok pada tabel `items` secara otomatis.
7. Jika metode pembayaran adalah `'debt'`, buat record pada tabel `debts` dan kaitkan `debt_id` ke record `sales`.
8. Eksekusi `COMMIT`.

## 5. Standardisasi API & Error Handling

### 5.1 Format Respons API
Respons berhasil:
```json
{
  "success": true,
  "data": ...
}
```
Respons gagal:
```json
{
  "success": false,
  "error": "Pesan deskripsi kesalahan"
}
```

### 5.2 Centralized Error Handler
- `400 Bad Request`: Validasi input tidak lengkap / format salah.
- `404 Not Found`: Item/transaksi/hutang tidak ditemukan.
- `409 Conflict`: Barcode atau nama produk duplikat.
- `500 Internal Server Error`: Kesalahan sistem atau database tidak terduga.

## 6. Fitur Sistem & Proteksi Data
1. `GET /api/system/health`: Memeriksa koneksi database, ukuran memory RAM (RSS, heapUsed), dan uptime Node.js.
2. `GET /api/system/backup`: Mengunduh file binary backup `warung.db` terkompresi/snapshot langsung dari browser.
3. Migrasi Skema Otomatis: Pemeriksaan dan penambahan kolom baru (misal: `barcode`, `unit`, `is_active`, `invoice_no`, `total_cost`) secara aman (`ALTER TABLE ADD COLUMN`) jika kolom belum ada pada database eksisting tanpa menghapus data yang ada.

## 7. Strategi Pengujian (Testing)
Menggunakan runner bawaan `node:test` dan `node:assert`:
- `tests/db.test.js`: Memverifikasi skema database inisial, penerapan PRAGMA WAL, dan keandalan rollback transaksi atomik.
- `tests/api.test.js`: Memverifikasi endpoint API produk, transaksi penjualan dengan pemotongan stok otomatis, pencatatan kasbon, dan endpoint backup.
