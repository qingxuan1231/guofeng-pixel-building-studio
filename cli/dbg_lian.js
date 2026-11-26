// 定位 连檐 0.509m 三角形的具体网格位置
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
let shown = 0;
for (let t = 0; t < m.triCount; t++) {
  const i = t * 9;
  const tag = m.tag[t];
  if (!/连檐/.test(tag)) continue;
  const A = [m.pos[i], m.pos[i+1], m.pos[i+2]];
  const B = [m.pos[i+3], m.pos[i+4], m.pos[i+5]];
  const C = [m.pos[i+6], m.pos[i+7], m.pos[i+8]];
  const mx = Math.max(e(A,B), e(B,C), e(C,A));
  if (mx > 0.45 && shown < 4) {
    shown++;
    console.log('连檐 大三角 mx', mx.toFixed(3), 'tag', tag);
    console.log('  A', A.map(v=>v.toFixed(2)).join(','), ' B', B.map(v=>v.toFixed(2)).join(','), ' C', C.map(v=>v.toFixed(2)).join(','));
    console.log('  eAB', e(A,B).toFixed(3), 'eBC', e(B,C).toFixed(3), 'eCA', e(C,A).toFixed(3),
      ' yA', A[1].toFixed(2), 'yB', B[1].toFixed(2), 'yC', C[1].toFixed(2));
  }
}