const fs = require('fs');
const path = require('path');
const dir = 'c:\\Users\\ACER\\win-slap\\slapper';

const folders = fs.readdirSync(dir).filter(f => f.startsWith('dist-electron-v'));

for (const f of folders) {
  const p = path.join(dir, f);
  console.log('Nuking', p);
  try {
    fs.rmSync(p, {recursive: true, force: true, maxRetries: 10, retryDelay: 500});
    console.log('SUCCESS:', p);
  } catch(e) {
    console.error('FAILED:', p, e.message);
  }
}
