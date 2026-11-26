// 全量扫描所有构件 >0.45m 三角形的来源分布（temple5）
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
const e = (p, q) => Math.hypot(p[0]-q[0], p[1]-q[1], p[2]-q[2]);
const dist = new Map();
let over045 = 0, over05 = 0;
for (let t = 0; t < m.triCount; t++) {
  const i = t * 9;
  const tag = m.tag[t];
  const A = [m.pos[i], m.pos[i+1], m.pos[i+2]];
  const B = [m.pos[i+3], m.pos[i+4], m.pos[i+5]];
  const C = [m.pos[i+6], m.pos[i+7], m.pos[i+8]];
  const mx = Math.max(e(A,B), e(B,C), e(C,A));
  if (mx > 0.45) {
    over045++;
    const key = tag.split('·')[0];
    const cur = dist.get(key) || { n: 0, mx: 0, ys: [] };
    cur.n++; cur.mx = Math.max(cur.mx, mx);
    if (cur.ys.length < 4) cur.ys.push(tag);
    dist.set(key, cur);
    if (mx > 0.5) over05++;
  }
}
const sorted = [...dist.entries()].sort((a, b) => b[1].mx - a[1].mx);
console.log('>0.45m 三角形总数 =', over045, ' (>0.50m =', over05 + ')');
for (const [k, v] of sorted) {
  console.log(' ', k, 'n=' + v.n, 'mx=' + v.mx.toFixed(3), '示例:', v.ys.slice(0,2).join(', '));
}