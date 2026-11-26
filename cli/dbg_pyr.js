// 精确定位钟楼/鼓楼 pyramidRoof 坡面 >0.45m 三角形的具体网格位置
const path = require('path'), vm = require('vm'), fs = require('fs');
const ROOT = path.join(__dirname, '..');
const { ANCIENT } = require('./modules');
const FILES = ANCIENT.concat(['js/gf-render.js', 'js/gf-presets.js', 'js/gf-export.js']);
const ctx = { console };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
const GF = ctx.GF;

// 单独构建一个钟楼小亭（50-compounds 参数：R=1.5 colH=3.2 yb=0.4），只看坡面
const m = GF.build({ ...GF.getPreset('temple5') });
const e = (p, q) => Math.hypot(p[0]-q[0], p[1]-q[1], p[2]-q[2]);
const byTag = {};
for (let t = 0; t < m.triCount; t++) {
  const i = t * 9;
  const tag = m.tag[t];
  if (!/坡面/.test(tag)) continue;
  const A = [m.pos[i], m.pos[i+1], m.pos[i+2]];
  const B = [m.pos[i+3], m.pos[i+4], m.pos[i+5]];
  const C = [m.pos[i+6], m.pos[i+7], m.pos[i+8]];
  const mx = Math.max(e(A,B), e(B,C), e(C,A));
  if (mx > 0.45) {
    const k = /·(鼓楼|钟楼)/.test(tag) ? '钟鼓楼坡面' : tag;
    // 按 y 最低点分组：>3.5 是下檐（skirtRoof），<3.5 才是顶
    const yMin = Math.min(A[1], B[1], C[1]);
    const g = yMin > 1.6 ? '下檐区(y>1.6)' : '顶区(y<=1.6)';
    (byTag[g] = byTag[g] || []).push({ A, B, C, mx, ys: [A[1], B[1], C[1]].map(v=>v.toFixed(2)) });
  }
}
for (const g of Object.keys(byTag)) {
  console.log('==', g, '== x', byTag[g].length);
  for (const tr of byTag[g].slice(0, 4)) {
    console.log('  mx', tr.mx.toFixed(3), ' ys', tr.ys.join('/'));
    console.log('   A', tr.A.map(v=>v.toFixed(2)).join(','), ' B', tr.B.map(v=>v.toFixed(2)).join(','), ' C', tr.C.map(v=>v.toFixed(2)).join(','));
  }
}