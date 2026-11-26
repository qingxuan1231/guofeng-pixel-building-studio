// 打印鼓楼垂脊中所有 >0.55m 三角形的顶点坐标
const path = require('path'), vm = require('vm'), fs = require('fs');
const ROOT = path.join(__dirname, '..');
const { ANCIENT } = require('./modules');
const FILES = ANCIENT.concat(['js/gf-render.js', 'js/gf-presets.js', 'js/gf-export.js']);
const ctx = { console };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
const GF = ctx.GF;
const mb = new GF.Mesh();
GF.roofs.build(mb, {
  cx: 0, cz: 0, xe: 1.5 + 0.55, ze: 1.5 + 0.55, yb: 3.4, rise: 1.5 * 0.95,
  type: 'pyramid', tile: 'tile', tileB: 'tileB',
  upturn: 0.55, ridgeStyle: 'plain', beasts: 0, finial: true, tag: '鼓楼·顶'
});
function e(p, q) { return Math.hypot(p[0]-q[0], p[1]-q[1], p[2]-q[2]); }
let shown = 0;
for (let t = 0; t < mb.triCount && shown < 8; t++) {
  if (!/垂脊/.test(mb.tag[t])) continue;
  const i = t * 9;
  const A = [mb.pos[i], mb.pos[i+1], mb.pos[i+2]];
  const B = [mb.pos[i+3], mb.pos[i+4], mb.pos[i+5]];
  const C = [mb.pos[i+6], mb.pos[i+7], mb.pos[i+8]];
  const mx = Math.max(e(A,B), e(B,C), e(C,A));
  if (mx > 0.55) {
    console.log(JSON.stringify({ A: A.map(v=>+v.toFixed(2)), B: B.map(v=>+v.toFixed(2)), C: C.map(v=>+v.toFixed(2)), mx: +mx.toFixed(3) }));
    shown++;
  }
}
console.log('shown=', shown);