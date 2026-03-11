const fs = require('fs');
let c = fs.readFileSync('index.html', 'utf8');

const svgPlus = '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>';

// Replace receptie Adaugă button
c = c.replace(
  '<button onclick="adaugaItemReceptie()" class="text-xs font-black text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg uppercase transition-all">\u2795 Adaug\u0103</button>',
  '<button onclick="adaugaItemReceptie()" class="text-xs font-black text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg uppercase transition-all flex items-center gap-1">' + svgPlus + 'Ad\u0103uga\u021bi</button>'
);

// Replace livrare Adaugă button
c = c.replace(
  '<button onclick="adaugaItemLivrare()" class="text-xs font-black text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg uppercase transition-all">\u2795 Adaug\u0103</button>',
  '<button onclick="adaugaItemLivrare()" class="text-xs font-black text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg uppercase transition-all flex items-center gap-1">' + svgPlus + 'Ad\u0103uga\u021bi</button>'
);

fs.writeFileSync('index.html', c, 'utf8');
console.log('Done — ➕ buttons replaced');
