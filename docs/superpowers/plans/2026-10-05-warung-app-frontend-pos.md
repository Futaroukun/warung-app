# Frontend Modularization & Kasir POS UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memecah file monolitik `public/index.html` (>4200 baris) menjadi modul-modul ES Modules dan stylesheet CSS terpisah yang bersih, cepat, tanpa build step, dilengkapi fitur Barcode Scanner kamera, cetak struk thermal 58mm, dan bagikan struk via WhatsApp.

**Architecture:** Frontend native ES Modules murni tanpa bundler (zero-build, instant reload di Termux Android). State terpusat di `store.js` dengan observer subscription. UI dipisah menjadi tabs modular dan komponen modal/toast mandiri.

**Tech Stack:** Native HTML5, CSS3 Variables, ES Modules (`type="module"`), Web Audio API, Web BarcodeDetector API / MediaDevices camera stream, standard window.print media stylesheet.

**Spec:** `docs/superpowers/specs/2026-10-05-warung-app-frontend-pos-design.md`

## Global Constraints
- Tidak menggunakan Webpack/Vite/Babel untuk runtime produksi; semua kode JS harus native ES Modules yang valid langsung dijalankan oleh browser modern / Android WebView.
- Pertahankan estetika "Bespoke Cyber-Fintech Luxe" (warna gelap `#07090e`, aksen emerald neon `#00f59b`, tactile feeling).
- Kompatibel dengan Android WebView (`file:///android_asset/` atau `http://localhost:3000`).
- Sediakan script `npm run sync-assets` untuk menyalin output `public/` ke direktori `android/app/src/main/assets/`.

---

### Task 1: Modular Stylesheets (Variables, Base, Components, Print)

**Files:**
- Create: `public/css/variables.css`
- Create: `public/css/base.css`
- Create: `public/css/components.css`
- Create: `public/css/print.css`

**Interfaces:**
- Produces: 4 file CSS yang dipanggil di `<head>` oleh `index.html`.

- [ ] **Step 1: Create `public/css/variables.css`**
- [ ] **Step 2: Create `public/css/base.css`**
- [ ] **Step 3: Create `public/css/components.css`**
- [ ] **Step 4: Create `public/css/print.css`**
- [ ] **Step 5: Verify CSS files exist and commit**

---

### Task 2: Core Frontend Utilities & State Store

**Files:**
- Create: `public/js/utils.js`
- Create: `public/js/api.js`
- Create: `public/js/store.js`
- Create: `tests/frontend-store.test.js`

**Interfaces:**
- `utils`: `formatRp`, `toTitleCase`, `formatTanggal`, `sanitizeNumber`
- `api`: `api.get(url)`, `api.post(url, body)`, `api.put(url, body)`, `api.patch(url, body)`, `api.delete(url)`
- `store`: `getState()`, `setState(updates)`, `subscribe(listener)`, `addToCart(item)`, `updateCartQty(id, delta)`, `removeFromCart(id)`, `clearCart()`

- [ ] **Step 1: Write test for Store logic in `tests/frontend-store.test.js`**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement `utils.js`, `api.js`, `store.js`**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit**

---

### Task 3: UI Components (Toast, Sheets, Printer, Scanner)

**Files:**
- Create: `public/js/components/toast.js`
- Create: `public/js/components/sheets.js`
- Create: `public/js/components/printer.js`
- Create: `public/js/components/scanner.js`

**Interfaces:**
- `toast`: `showToast(msg, type = 'success' | 'error' | 'warning')`
- `sheets`: `openSheet(id)`, `closeSheet(id)`
- `printer`: `printReceipt(sale)`, `generateWhatsAppReceiptUrl(sale, phone)`
- `scanner`: `startScanner(videoEl, onResult)`, `stopScanner()`

- [ ] **Step 1: Implement Toast engine in `public/js/components/toast.js`**
- [ ] **Step 2: Implement Sheets manager in `public/js/components/sheets.js`**
- [ ] **Step 3: Implement Receipt Printer & WhatsApp formatter in `public/js/components/printer.js`**
- [ ] **Step 4: Implement Camera Barcode Scanner in `public/js/components/scanner.js`**
- [ ] **Step 5: Commit**

---

### Task 4: Modular Tab Views

**Files:**
- Create: `public/js/tabs/dashboard.js`
- Create: `public/js/tabs/pos.js`
- Create: `public/js/tabs/debts.js`
- Create: `public/js/tabs/history.js`
- Create: `public/js/tabs/system.js`

**Interfaces:**
- Each tab exports `init()` and `render()` functions interfacing with `store` and `api`.

- [ ] **Step 1: Implement `public/js/tabs/dashboard.js`**
- [ ] **Step 2: Implement `public/js/tabs/pos.js`**
- [ ] **Step 3: Implement `public/js/tabs/debts.js`**
- [ ] **Step 4: Implement `public/js/tabs/history.js`**
- [ ] **Step 5: Implement `public/js/tabs/system.js`**
- [ ] **Step 6: Commit**

---

### Task 5: Application Shell & Master Entrypoint

**Files:**
- Create: `public/js/app.js`
- Rewrite: `public/index.html` (clean semantic shell linking CSS and ES Modules)
- Update: `package.json` with `sync-assets` script

- [ ] **Step 1: Implement `public/js/app.js` connecting all tabs, scanner, and printer**
- [ ] **Step 2: Rewrite `public/index.html` with clean semantic HTML shell**
- [ ] **Step 3: Add `sync-assets` script in `package.json`**
- [ ] **Step 4: Run `npm run sync-assets` to copy to Android WebView assets**
- [ ] **Step 5: Commit**

---

### Task 6: End-to-End Verification & Sanity Checks

**Files:**
- Create: `tests/frontend-integration.test.js`

- [ ] **Step 1: Write integration test verifying all static files, scripts, and endpoints respond 200 OK**
- [ ] **Step 2: Run all project test suites (`npm test`)**
- [ ] **Step 3: Commit and finalize**
