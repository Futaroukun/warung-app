function formatReceiptHtml(sale, storeInfo = {}) {
  const storeName = storeInfo.name || 'WARUNG KITA';
  const storeAddress = storeInfo.address || 'Kasir Warung Pintar';
  const invoice = sale.invoice_no || `INV-${sale.id}`;
  const dateStr = new Date(sale.created_at || Date.now()).toLocaleString('id-ID');
  const items = sale.items || [];

  let itemsHtml = '';
  for (const item of items) {
    itemsHtml += `
      <div class="receipt-item-name">${item.item_name || item.name}</div>
      <div class="receipt-item-details">
        <span>${item.qty} x ${Number(item.sell_price || item.price).toLocaleString('id-ID')}</span>
        <span>Rp ${Number(item.subtotal).toLocaleString('id-ID')}</span>
      </div>
    `;
  }

  const isDebt = sale.payment_type === 'debt';
  const isDebtLunas = isDebt && sale.debt_status === 'lunas';
  const payTypeStr = sale.payment_type === 'cash' 
    ? 'TUNAI' 
    : (isDebt 
        ? (isDebtLunas ? 'KASBON (LUNAS)' : 'KASBON (BELUM LUNAS)') 
        : sale.payment_type.toUpperCase());

  return `
    <div class="receipt-header">
      <div class="receipt-title">${storeName}</div>
      <div class="receipt-sub">${storeAddress}</div>
      <div class="receipt-divider"></div>
    </div>
    <div class="receipt-meta">
      <div class="receipt-meta-row"><span>No. Struk</span><span>${invoice}</span></div>
      <div class="receipt-meta-row"><span>Waktu</span><span>${dateStr}</span></div>
      ${sale.customer_name ? `<div class="receipt-meta-row"><span>Pelanggan</span><span>${sale.customer_name}</span></div>` : ''}
    </div>
    <div class="receipt-divider"></div>
    <div class="receipt-table">
      ${itemsHtml}
    </div>
    <div class="receipt-double-divider"></div>
    <div class="receipt-totals">
      <div class="receipt-row bold"><span>TOTAL</span><span>Rp ${Number(sale.total_amount).toLocaleString('id-ID')}</span></div>
      <div class="receipt-row"><span>METODE</span><span>${payTypeStr}</span></div>
      ${sale.payment_type === 'cash' ? `
        <div class="receipt-row"><span>BAYAR</span><span>Rp ${Number(sale.cash_received || 0).toLocaleString('id-ID')}</span></div>
        <div class="receipt-row"><span>KEMBALI</span><span>Rp ${Number(sale.cash_change || 0).toLocaleString('id-ID')}</span></div>
      ` : ''}
    </div>
    <div class="receipt-divider"></div>
    <div class="receipt-footer">
      <div>Terima kasih atas kunjungan Anda!</div>
      <div>Barang yang dibeli tidak dapat ditukar/dikembalikan</div>
    </div>
  `;
}

function printReceipt(sale) {
  let printArea = document.getElementById('receiptPrintArea');
  if (!printArea) {
    printArea = document.createElement('div');
    printArea.id = 'receiptPrintArea';
    document.body.appendChild(printArea);
  }

  printArea.innerHTML = formatReceiptHtml(sale);
  window.print();
}

function generateWhatsAppReceiptText(sale) {
  const invoice = sale.invoice_no || `INV-${sale.id}`;
  const dateStr = new Date(sale.created_at || Date.now()).toLocaleString('id-ID');
  const items = sale.items || [];

  let text = `╭── ✦ *STRUK PEMBELIAN WARUNG* ✦\n`;
  text += `• *No. Struk* : ${invoice}\n`;
  text += `• *Tanggal*   : ${dateStr}\n`;
  if (sale.customer_name) text += `• *Pelanggan* : ${sale.customer_name}\n`;
  text += `───────────────────────\n`;

  for (const item of items) {
    text += `› *${item.item_name || item.name}*\n`;
    text += `  ${item.qty} x Rp ${Number(item.sell_price || item.price).toLocaleString('id-ID')} = Rp ${Number(item.subtotal).toLocaleString('id-ID')}\n`;
  }

  const isDebt = sale.payment_type === 'debt';
  const isDebtLunas = isDebt && sale.debt_status === 'lunas';
  const payTypeLabel = sale.payment_type === 'cash' 
    ? 'Tunai' 
    : (isDebt 
        ? (isDebtLunas ? 'Kasbon (Lunas)' : 'Kasbon (Belum Lunas)') 
        : sale.payment_type.toUpperCase());

  text += `───────────────────────\n`;
  text += `• *TOTAL*     : *Rp ${Number(sale.total_amount).toLocaleString('id-ID')}*\n`;
  text += `• *PEMBAYARAN*: ${payTypeLabel}\n`;
  if (sale.payment_type === 'cash') {
    text += `• *DITERIMA*  : Rp ${Number(sale.cash_received || 0).toLocaleString('id-ID')}\n`;
    text += `• *KEMBALI*   : Rp ${Number(sale.cash_change || 0).toLocaleString('id-ID')}\n`;
  }
  text += `╰━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `_Terima kasih telah berbelanja di warung kami!_`;

  return text;
}

function shareReceiptWhatsApp(sale, phone = '') {
  const text = generateWhatsAppReceiptText(sale);
  let cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
  if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.slice(1);

  const url = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

if (typeof window !== 'undefined') {
  window.printReceipt = printReceipt;
  window.formatReceiptHtml = formatReceiptHtml;
  window.generateWhatsAppReceiptText = generateWhatsAppReceiptText;
  window.shareReceiptWhatsApp = shareReceiptWhatsApp;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { formatReceiptHtml, printReceipt, generateWhatsAppReceiptText, shareReceiptWhatsApp };
}
