// 统计 temple5 当前面数与各 tag 三角形规模
const path = require('path'), vm = require('vm'), fs = require('fs');
const ROOT = path.join(__dirname, '..');
const { ANCIENT } = require('./modules');
const FILES = ANCIENT.concat(['js/gf-render.js', 'js/gf-presets.js', 'js/gf-export.js']);
const ctx = { console };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
const GF = ctx.GF;
const m = GF.build({ ...GF.getPreset('temple5') });
console.log('temple5 总三角形数 =', m.triCount);
// 收集大构件 tag 的三角形数（前 20 大）
const cnt = {};
for (let t = 0; t < m.triCount; t++) cnt[m.tag[t]] = (cnt[m.tag[t]] || 0) + 1;
const rows = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 25);
for (const [k, v] of rows) console.log('  ' + v + '\t' + k);
console.log('不同 tag 数 =', rows.length, '...');