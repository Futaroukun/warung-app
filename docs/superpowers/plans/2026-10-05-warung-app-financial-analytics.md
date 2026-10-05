# Financial Analytics & Advanced Reporting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambahkan kalkulasi Laba Rugi terperinci (omset, HPP, laba bersih, profit margin), export spreadsheet CSV untuk Excel (transaksi penjualan & inventaris stok), serta fitur penagihan kasbon pintar otomatis via WhatsApp.

**Architecture:** Backend service menambahkan agregasi SQL untuk HPP & laba rugi, modul streaming CSV ringan tanpa library eksternal, controller handler dengan header `Content-Disposition`, dan frontend UI card untuk analisis serta WhatsApp generator.

**Tech Stack:** Node.js, Express, SQLite DatabaseSync, Native CSV stream formatting, WhatsApp Web API link generator.

**Spec:** `docs/superpowers/specs/2026-10-05-warung-app-financial-analytics-design.md`

## Global Constraints
- Tidak menambahkan library berat untuk CSV (gunakan RFC-4180 CSV serializer native ringan).
- Pesan penagihan kasbon via WhatsApp harus sopan, jelas mencantumkan sisa hutang dan tanggal.
- Seluruh file frontend yang diperbarui wajib disinkronkan ke `android/app/src/main/assets/` via `npm run sync-assets`.

---

### Task 1: Profit & Loss Statement Service & Controller

**Files:**
- Modify: `src/services/reports.service.js`
- Modify: `src/controllers/reports.controller.js`
- Modify: `src/routes/reports.routes.js`
- Create: `tests/financial-reports.test.js`

**Interfaces:**
- `reportsService.getProfitLossStatement({ startDate, endDate })`
- Route: `GET /api/reports/profit-loss`

- [ ] **Step 1: Write failing test in `tests/financial-reports.test.js`**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement profit & loss logic in service, controller, and routes**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit**

---

### Task 2: CSV Export Endpoints (Sales & Inventory)

**Files:**
- Modify: `src/services/reports.service.js`
- Modify: `src/controllers/reports.controller.js`
- Modify: `src/routes/reports.routes.js`
- Modify: `tests/financial-reports.test.js`

**Interfaces:**
- `reportsService.generateSalesCsv()`
- `reportsService.generateItemsCsv()`
- Routes: `GET /api/reports/export/sales`, `GET /api/reports/export/items`

- [ ] **Step 1: Write test for CSV generation**
- [ ] **Step 2: Implement CSV export methods and streaming endpoints**
- [ ] **Step 3: Run test to verify it passes**
- [ ] **Step 4: Commit**

---

### Task 3: WhatsApp Debt Reminder Feature

**Files:**
- Modify: `public/js/tabs/debts.js`
- Modify: `tests/frontend-store.test.js`

**Interfaces:**
- `generateDebtReminderMessage(debt)`
- `sendDebtReminderWhatsApp(debt)`

- [ ] **Step 1: Implement WhatsApp debt reminder message generator in `public/js/tabs/debts.js`**
- [ ] **Step 2: Add "Tagih WA" action button to debt cards**
- [ ] **Step 3: Verify with unit test in `tests/frontend-store.test.js`**
- [ ] **Step 4: Commit**

---

### Task 4: Analytics Cards & Export Buttons in Frontend

**Files:**
- Modify: `public/js/tabs/dashboard.js`
- Modify: `public/index.html`

- [ ] **Step 1: Add Profit-Loss breakdown card and CSV export buttons in `public/index.html`**
- [ ] **Step 2: Implement Profit-Loss fetching and display in `public/js/tabs/dashboard.js`**
- [ ] **Step 3: Commit**

---

### Task 5: Final Verification & Android Sync

**Files:**
- Sync: `android/app/src/main/assets/`

- [ ] **Step 1: Run `npm run sync-assets`**
- [ ] **Step 2: Run `npm test` across all test suites**
- [ ] **Step 3: Commit and finalize**
