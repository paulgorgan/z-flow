const fs = require('fs');
const path = require('path');
const base = path.join(__dirname, '..');

const files = [
  'index.html',
  'js/app.js',
  'js/modules/features.js',
  'js/modules/depozit.js',
  'js/modules/logistic.js',
  'js/modules/export.js',
];

const emojiRx = /[\u{1F300}-\u{1FFFF}\u{2600}-\u{27FF}\u2705\u274C\u26A0\u2795\uFE0F]/u;

for (const f of files) {
  const content = fs.readFileSync(path.join(base, f), 'utf8');
  const lines = content.split('\n');
  const visible = [];
  lines.forEach((line, i) => {
    if (emojiRx.test(line) && !line.trim().startsWith('//') && !line.includes('console.')) {
      visible.push({ line: i+1, text: line.trim().substring(0, 120) });
    }
  });
  if (visible.length > 0) {
    console.log('\n=== ' + f + ' ===');
    visible.forEach(v => console.log('  L' + v.line + ': ' + v.text));
  }
}
console.log('\nDone');
