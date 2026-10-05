const fs = require('fs');
const path = require('path');

const publicJsDir = path.join(__dirname, '..', 'public', 'js');

const files = [
  'utils.js',
  'store.js',
  'api.js',
  'components/toast.js',
  'components/sheets.js',
  'components/printer.js',
  'components/scanner.js',
  'tabs/dashboard.js',
  'tabs/pos.js',
  'tabs/debts.js',
  'tabs/history.js',
  'tabs/system.js',
  'app.js'
];

let bundleContent = '/* WarungPro High-Performance Client Bundle */\n';
for (const file of files) {
  const filePath = path.join(publicJsDir, file);
  const code = fs.readFileSync(filePath, 'utf8');
  bundleContent += `\n/* --- ${file} --- */\n` + code + '\n';
}

const outputPath = path.join(publicJsDir, 'bundle.js');
fs.writeFileSync(outputPath, bundleContent, 'utf8');
console.log(`Bundle generated successfully: ${outputPath} (${bundleContent.length} bytes)`);
