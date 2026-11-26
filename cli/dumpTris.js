// 诊断：dump 山花三角形顶点，检查三角形实际形状与分布
const path = require('path'), vm = require('vm'), fs = require('fs');
const ROOT = path.join(__dirname, '..');
const { ANCIENT } = require('./modules');
const FILES = ANCIENT.concat(['js/gf-render.js', 'js/gf-presets.js', 'js/gf-export.js']);
const ctx = { console };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
const GF = ctx.GF;

function filter(mesh, re) {
  const m = new GF.Mesh();
  for (let t = 0; t < mesh.triCount; t++) {
    if (!re.test(mesh.tag[t])) continue;
    const i = t * 9;
    m.tri([mesh.pos[i], mesh.pos[i+1], mesh.pos[i+2]], [mesh.pos[i+3], mesh.pos[i+4], mesh.pos[i+5]],
          [mesh.pos[i+6], mesh.pos[i+7], mesh.pos[i+8]], mesh.mat[t], mesh.tag[t]);
  }
  return m;
}

const pre = GF.getPreset('jiangnan');
const m = GF.build({ ...pre, roofType: 'gable' });
const fm = filter(m, /山花/);
const gtf = [];
for (let t = 0; t < fm.triCount; t++) {
  const i = t * 9;
  const v0 = [fm.pos[i], fm.pos[i+1], fm.pos[i+2]];
  const v1 = [fm.pos[i+3], fm.pos[i+4], fm.pos[i+5]];
  const v2 = [fm.pos[i+6], fm.pos[i+7], fm.pos[i+8]];
  gtf.push({ t, v: [v0, v1, v2] });
}

// yz 平面面积
function area2d(a, b, c) {
  return Math.abs((b[2]-a[2])*(c[1]-a[1]) - (b[1]-a[1])*(c[2]-a[2])) / 2;
}
let total = 0, minA = 1e9;
for (const g of gtf) {
  const a = area2d(...g.v);
  total += a; minA = Math.min(minA, a);
}
console.log('山花三角形数=', gtf.length, ' yz平面总面积Σ=', total.toFixed(3), ' 最小yz面积=', minA.toFixed(5));

// 按三角形编号输出前 10 个顶点（观察 x 分组）
console.log('\n-- 前 12 个三角形 --');
for (let i = 0; i < Math.min(12, gtf.length); i++) {
  const g = gtf[i];
  const fmt = (v) => `(${v[0].toFixed(2)},${v[1].toFixed(2)},${v[2].toFixed(2)})`;
  console.log(`T${g.t} [${fmt(g.v[0])}, ${fmt(g.v[1])}, ${fmt(g.v[2])}] area_yz=${area2d(...g.v).toFixed(4)}`);
}

// 统计有哪些 x 分片
const xs = [...new Set(gtf.map(g => g.v[0][0].toFixed(3)))].sort((a,b)=>+a-+b);
console.log('\nx 分片（山花面数）:', xs.join(', '));