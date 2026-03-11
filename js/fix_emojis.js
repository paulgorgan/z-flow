/**
 * Z-FLOW Emoji Cleanup Script
 * Removes emoji prefixes from showNotification() text args across all JS files
 * Replaces visible UI emoji with text or SVG markers for later HTML substitution
 */
const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..');

// Files to process
const jsFiles = [
  path.join(BASE, 'js/app.js'),
  path.join(BASE, 'js/modules/logistic.js'),
  path.join(BASE, 'js/modules/depozit.js'),
  path.join(BASE, 'js/modules/export.js'),
  path.join(BASE, 'js/modules/features.js'),
  path.join(BASE, 'js/modules/auth.js'),
  path.join(BASE, 'js/modules/mobile.js'),
  path.join(BASE, 'js/modules/index.js'),
];

// Regex to match showNotification call with first string argument
// Handles both 'single' and "double" quoted strings (not template literals)
// Group 1: opening quote, Group 2: message content, Group 3: closing quote
const showNotifRegex = /showNotification\((['"])([\s\S]*?)\1/g;

// Emoji chars to strip from START of notification message strings
// This regex matches one or more emoji codepoints + optional variation selector + optional space
// Using a broad Unicode emoji range
const leadingEmojiRegex = /^(?:[\u{1F300}-\u{1FFFF}\u{2600}-\u{27FF}\u{2B00}-\u{2BFF}\u00AE\u00A9\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9\u21AA\u231A\u231B\u23E9-\u23F3\u23F8-\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB-\u25FE\u2600-\u2604\u260E\u2611\u2614\u2615\u2618\u261D\u2620\u2622\u2623\u2626\u262A\u262E\u262F\u2638-\u263A\u2640\u2642\u2648-\u2653\u265F\u2660\u2663\u2665\u2666\u2668\u267B\u267E\u267F\u2692-\u2697\u2699\u269B\u269C\u26A0\u26A1\u26A7\u26AA\u26AB\u26B0\u26B1\u26BD\u26BE\u26C4\u26C5\u26CE\u26CF\u26D1\u26D3\u26D4\u26E9\u26EA\u26F0-\u26F5\u26F7-\u26FA\u26FD\u2702\u2705\u2708-\u270D\u270F\u2712\u2714\u2716\u271D\u2721\u2728\u2733\u2734\u2744\u2747\u274C\u274E\u2753-\u2755\u2757\u2763\u2764\u2795-\u2797\u27A1\u27B0\u27BF\u2934\u2935\u2B05-\u2B07\u2B1B\u2B1C\u2B50\u2B55✅❌⚠️⚡️↩️🗑️][\uFE0F]?[\u20D0-\u20FF]?)+\s*/u;

let totalFixed = 0;

for (const fpath of jsFiles) {
  if (!fs.existsSync(fpath)) continue;
  
  let content = fs.readFileSync(fpath, 'utf8');
  let fileFixed = 0;
  
  // Replace showNotification first arg — strip leading emoji
  content = content.replace(showNotifRegex, (match, quote, msg) => {
    const cleaned = msg.replace(leadingEmojiRegex, '');
    if (cleaned !== msg) {
      fileFixed++;
      return 'showNotification(' + quote + cleaned + quote;
    }
    return match;
  });
  
  fs.writeFileSync(fpath, content, 'utf8');
  console.log(`  ${path.basename(fpath)}: ${fileFixed} notification strings cleaned`);
  totalFixed += fileFixed;
}

console.log(`\nTotal: ${totalFixed} emoji prefixes removed from showNotification() calls`);
