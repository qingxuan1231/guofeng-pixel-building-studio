// trace 鼓楼/钟楼 pyramidRoof 的垂脊生成
const path = require('path'), vm = require('vm'), fs = require('fs');
const ROOT = path.join(__dirname, '..');
const { ANCIENT } = require('./modules');
const FILES = ANCIENT.concat(['js/gf-render.js', 'js/gf-presets.js', 'js/gf-export.js']);
const ctx = { console };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
const GF = ctx.GF;
console.log('detail =', GF.detailLevel());

// 单独构建一个鼓楼（smallPavilion 尺寸同 temple5 的钟鼓楼）
const mb = new GF.Mesh();
// temple5 中钟鼓楼 smallPavilion R=1.5 colH=3.4
GF.roofs.build(mb, {
  cx: 0, cz: 0, xe: 1.5 + 0.55, ze: 1.5 + 0.55, yb: 0 + 3.4, rise: 1.5 * 0.95,
  type: 'pyramid', tile: 'tile', tileB: 'tileB',
  upturn: 0.55, ridgeStyle: 'plain', beasts: 0, finial: true, tag: '鼓楼·顶'
});
function e(p, q) { return Math.hypot(p[0]-q[0], p[1]-q[1], p[2]-q[2]); }
let maxE = 0, maxT = '', n = 0;
const dist = [];
for (let t = 0; t < mb.triCount; t++) {
  if (!/垂脊/.test(mb.tag[t])) continue;
  const i = t * 9;
  const A = [mb.pos[i], mb.pos[i+1], mb.pos[i+2]];
  const B = [mb.pos[i+3], mb.pos[i+4], mb.pos[i+5]];
  const C = [mb.pos[i+6], mb.pos[i+7], mb.pos[i+8]];
  const mx = Math.max(e(A,B), e(B,C), e(C,A));
  if (mx > maxE) { maxE = mx; maxT = mb.tag[t]; }
  if (mx > 0.55) n++;
  dist.push(mx.toFixed(2));
}
console.log('鼓楼单景 顶·垂脊 三角形数=', mb.triCount, ' maxE=', maxE.toFixed(3), ' >0.55m=', n, ' tag=', maxT);
console.log('最长边分布(采样): ', dist.filter(v=>+v>0.5).slice(0,20).join(','));