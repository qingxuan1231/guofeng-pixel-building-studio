// 定位 屋面·下檐前/后 残留 >0.55m 三角形的确切坐标
const path = require('path'), vm = require('vm'), fs = require('fs');
const ROOT = path.join(__dirname, '..');
const { ANCIENT } = require('./modules');
const FILES = ANCIENT.concat(['js/gf-render.js', 'js/gf-presets.js', 'js/gf-export.js']);
const ctx = { console }; ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
const GF = ctx.GF;
GF._dbgPatch = true;

const e = (p, q) => Math.hypot(p[0]-q[0], p[1]-q[1], p[2]-q[2]);
const m = GF.build(GF.getPreset('temple5'));
let cnt = 0;
for (let t = 0; t < m.triCount; t++) {
  if (!/下檐[前后]$/.test(m.tag[t])) continue;
  const i = t * 9;
  const A = [m.pos[i], m.pos[i+1], m.pos[i+2]];
  const B = [m.pos[i+3], m.pos[i+4], m.pos[i+5]];
  const C = [m.pos[i+6], m.pos[i+7], m.pos[i+8]];
  const mx = Math.max(e(A,B), e(B,C), e(C,A));
  if (mx > 0.55) {
    cnt++;
    console.log(`tag=${m.tag[t]} mat=${m.mat[t]} max=${mx.toFixed(3)}`);
    console.log(`  A=${A.map(v=>v.toFixed(2))} B=${B.map(v=>v.toFixed(2))} C=${C.map(v=>v.toFixed(2))}`);
  }
}
console.log('total >0.55m 下檐前/后:', cnt);