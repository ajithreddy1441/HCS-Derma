const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', '..', 'frontend', 'dist');
const dest = path.join(__dirname, '..', 'public');
if (!fs.existsSync(path.join(src, 'index.html'))) {
  console.error('frontend/dist is missing. Run: cd frontend && npm run build');
  process.exit(1);
}
fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true });
console.log('Copied frontend/dist -> backend/public');
