// 定位 temple5 钟楼·顶·坡面 0.512m 最长边的来源
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
let maxE = 0, maxTri = null;
for (let t = 0; t < m.triCount; t++) {
  const i = t * 9;
  const A = [m.pos[i], m.pos[i+1], m.pos[i+2]];
  const B = [m.pos[i+3], m.pos[i+4], m.pos[i+5]];
  const C = [m.pos[i+6], m.pos[i+7], m.pos[i+8]];
  const mx = Math.max(e(A,B), e(B,C), e(C,A));
  const tag = m.tag[t];
  if (/坡面/.test(tag) && mx > maxE) { maxE = mx; maxTri = { tag, A, B, C, mx }; }
}
if (maxTri) {
  console.log('钟楼·顶·坡面最长大三角：', maxTri.mx.toFixed(3), maxTri.tag);
  console.log('A', maxTri.A.map(v=>v.toFixed(2)).join(','));
  console.log('B', maxTri.B.map(v=>v.toFixed(2)).join(','));
  console.log('C', maxTri.C.map(v=>v.toFixed(2)).join(','));
}
// 也看所有坡面 >0.45 的
const big45 = {};
for (let t = 0; t < m.triCount; t++) {
  const i = t * 9;
  const A = [m.pos[i], m.pos[i+1], m.pos[i+2]];
  const B = [m.pos[i+3], m.pos[i+4], m.pos[i+5]];
  const C = [m.pos[i+6], m.pos[i+7], m.pos[i+8]];
  const mx = Math.max(e(A,B), e(B,C), e(C,A));
  if (mx > 0.45) {
    const k = m.tag[t];
    big45[k] = [big45[k] ? big45[k][0] + 1 : 1, Math.max(big45[k] ? big45[k][1] : 0, mx)];
  }
}
console.log('temple5 全部 >0.45m 三角形：');
for (const k of Object.keys(big45)) console.log(`  ${k}  ×${big45[k][0]}  最长=${big45[k][1].toFixed(3)}`);