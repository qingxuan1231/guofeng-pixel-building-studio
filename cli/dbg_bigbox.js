// 统计 temple5 中各 tag 的 >0.55m 三角形包围盒尺寸，确定 box 细分策略
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
const stat = {};
let totalBig = 0;
for (let t = 0; t < m.triCount; t++) {
  const i = t * 9;
  const A = [m.pos[i], m.pos[i+1], m.pos[i+2]];
  const B = [m.pos[i+3], m.pos[i+4], m.pos[i+5]];
  const C = [m.pos[i+6], m.pos[i+7], m.pos[i+8]];
  const mx = Math.max(e(A,B), e(B,C), e(C,A));
  if (mx <= 0.55) continue;
  totalBig++;
  const s = stat[m.tag[t]] || (stat[m.tag[t]] = { n: 0, mx: 0, xs: 0, ys: 0, zs: 0 });
  s.n++;
  s.mx = Math.max(s.mx, mx);
  const xs = Math.max(A[0],B[0],C[0]) - Math.min(A[0],B[0],C[0]);
  const ys = Math.max(A[1],B[1],C[1]) - Math.min(A[1],B[1],C[1]);
  const zs = Math.max(A[2],B[2],C[2]) - Math.min(A[2],B[2],C[2]);
  s.xs = Math.max(s.xs, xs); s.ys = Math.max(s.ys, ys); s.zs = Math.max(s.zs, zs);
}
console.log('total >0.55m =', totalBig);
const rows = Object.entries(stat).sort((a,b)=>b[1].n-a[1].n);
for (const [k, v] of rows) {
  console.log(`${v.n}\t${k}\t最长=${v.mx.toFixed(2)}m  Δx=${v.xs.toFixed(2)} Δy=${v.ys.toFixed(2)} Δz=${v.zs.toFixed(2)}`);
}