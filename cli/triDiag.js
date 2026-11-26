// 逐三角形诊断：把山花网格拆成一个个三角形单独渲染，
// 统计每个三角形被光栅化填充的像素数，与理论面积对比。
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
const { ANCIENT } = require('./modules');
const FILES = ANCIENT.concat(['js/gf-render.js', 'js/gf-presets.js']);
const ctx = { console };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of FILES) {
  const code = require('fs').readFileSync(path.join(ROOT, f), 'utf8');
  vm.runInContext(code, ctx, { filename: f });
}
const GF = ctx.GF;

function filter(mesh, re) {
  const m = new GF.Mesh();
  for (let t = 0; t < mesh.triCount; t++) {
    if (!re.test(mesh.tag[t])) continue;
    const i = t * 9;
    m.tri(
      [mesh.pos[i], mesh.pos[i + 1], mesh.pos[i + 2]],
      [mesh.pos[i + 3], mesh.pos[i + 4], mesh.pos[i + 5]],
      [mesh.pos[i + 6], mesh.pos[i + 7], mesh.pos[i + 8]],
      mesh.mat[t], mesh.tag[t]
    );
  }
  return m;
}

function renderMesh(m, yaw, pitch) {
  return GF.render(m, { ppm: 40, pitch, yaw, palette: 'paper', style: 'pixel', styleAmount: 1, outline: false, shadow: false, transparent: true, focus: true, seed: 1 });
}

const pre = GF.getPreset('jiangnan');
const m = GF.build({ ...pre, roofType: 'gable' });
const fm = filter(m, /山花/);
console.log('山花三角形总数=', fm.triCount);

let empty = 0, thin = 0, filled = 0;
const stats = [];
for (let t = 0; t < fm.triCount; t++) {
  const i = t * 9;
  const tri = [[fm.pos[i], fm.pos[i + 1], fm.pos[i + 2]],
    [fm.pos[i + 3], fm.pos[i + 4], fm.pos[i + 5]],
    [fm.pos[i + 6], fm.pos[i + 7], fm.pos[i + 8]]];
  // 世界坐标投影面积（叉积模长的一半），看几何是否退化
  const ax = tri[1][0] - tri[0][0], ay = tri[1][1] - tri[0][1], az = tri[1][2] - tri[0][2];
  const bx = tri[2][0] - tri[0][0], by = tri[2][1] - tri[0][1], bz = tri[2][2] - tri[0][2];
  const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
  const worldArea = 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz);

  // 单独渲染该三角形
  const tm = new GF.Mesh();
  tm.tri(tri[0], tri[1], tri[2], fm.mat[t], fm.tag[t]);
  const f = renderMesh(tm, 90, 30);
  const { w, h, rgba } = f;
  let op = 0, minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (rgba[(y * w + x) * 4 + 3] > 0) {
      op++;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  const bw = maxX - minX + 1, bh = maxY - minY + 1;
  stats.push({
    t,
    area: worldArea,
    px: op, bw, bh,
    ratio: bw > 0 ? op / (bw * bh) : 0,
    v0: tri[0].map(v => +v.toFixed(2)),
    v1: tri[1].map(v => +v.toFixed(2)),
    v2: tri[2].map(v => +v.toFixed(2)),
  });
  if (op === 0) empty++;
  else if (bw < 2 || bh < 2) thin++;
  else if (op / (bw * bh) > 0.2) filled++;
}

stats.sort((a, b) => a.px - b.px);
console.log('单独渲染: 空(op=0)=', empty, ' 细条(bw<2或bh<2)=', thin, ' 实心(>20%)=', filled);
for (const s of stats.slice(0, 8)) {
  console.log(`  tri#${s.t} 世界面积=${s.area.toFixed(2)}m²  填充px=${s.px} bbox=${s.bw}x${s.bh} 填充率=${(s.ratio * 100).toFixed(0)}%`);
  console.log(`    v0=${s.v0} v1=${s.v1} v2=${s.v2}`);
}
console.log('--- 填像素最多的 5 个 ---');
for (const s of [...stats].sort((a, b) => b.px - a.px).slice(0, 5)) {
  console.log(`  tri#${s.t} 世界面积=${s.area.toFixed(2)}m²  填充px=${s.px} bbox=${s.bw}x${s.bh} 填充率=${(s.ratio * 100).toFixed(0)}%`);
}

// 额外：打印每个三角形在世界平面上的形状因子（高/宽比），判定"扇心退化"
console.log('--- 形状统计 ---');
let degenerate = 0;
for (const s of stats) {
  // 三角形在 z（屏幕横向）和 y（屏幕纵向）的跨度
  const zs = [s.v0[2], s.v1[2], s.v2[2]], ys = [s.v0[1], s.v1[1], s.v2[1]];
  const zSpan = Math.max(...zs) - Math.min(...zs), ySpan = Math.max(...ys) - Math.min(...ys);
  if (zSpan < 0.1 || ySpan < 0.1) degenerate++;
  console.log(`  tri#${s.t} zspan=${zSpan.toFixed(2)} yspan=${ySpan.toFixed(2)} | v0z=${s.v0[2]} v1z=${s.v1[2]} v2z=${s.v2[2]}`);
}