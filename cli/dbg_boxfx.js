// 快速验证 box 细分后的效果（temple5 全场景）
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
function e(p, q) { return Math.hypot(p[0]-q[0], p[1]-q[1], p[2]-q[2]); }
let maxE = 0, maxTag = '', totalBig = 0;
const byTag = {};
for (let t = 0; t < m.triCount; t++) {
  const i = t * 9;
  const A = [m.pos[i], m.pos[i+1], m.pos[i+2]];
  const B = [m.pos[i+3], m.pos[i+4], m.pos[i+5]];
  const C = [m.pos[i+6], m.pos[i+7], m.pos[i+8]];
  const mx = Math.max(e(A,B), e(B,C), e(C,A));
  if (mx > maxE) { maxE = mx; maxTag = m.tag[t]; }
  if (mx > 0.55) { totalBig++; byTag[m.tag[t]] = (byTag[m.tag[t]] || 0) + 1; }
}
console.log('triCount =', m.triCount);
console.log('maxE =', maxE.toFixed(3), maxTag);
console.log('totalBig =', totalBig);
const rows = Object.entries(byTag).sort((a,b)=>b[1]-a[1]).slice(0,30);
for (const [k,v] of rows) console.log('  ' + v + '\t' + k);