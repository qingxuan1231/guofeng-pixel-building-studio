// 决定性实验：逐个渲染山花三角形到 (z,y) 平面 ASCII，检查三角形真实形状
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
// 只取左侧面（x<0）
const tris = [];
for (let t = 0; t < fm.triCount; t++) {
  const i = t * 9;
  const v = [[fm.pos[i], fm.pos[i+1], fm.pos[i+2]], [fm.pos[i+3], fm.pos[i+4], fm.pos[i+5]], [fm.pos[i+6], fm.pos[i+7], fm.pos[i+8]]];
  if (v[0][0] < 0) tris.push(v);
}
console.log('左侧山花三角形数=', tris.length);

// 用 (z, y) 平面栅格 80x40
const W = 96, H = 48;
function renderTri(v, ch) {
  const out = new Array(H).fill(0).map(() => new Array(W).fill('.'));
  // 映射 (z,y) -> 栅格：z [-4,4], y [6,9]
  const P = (p) => [Math.round((p[2] + 4) / 8 * (W - 1)), Math.round((9 - p[1]) / 3 * (H - 1))];
  return out;
}
// 栅格化一个三角形（普通扫描线，点是否在内）
function inTri(px, py, a, b, c) {
  const d1 = (px - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (py - b[1]);
  const d2 = (px - c[0]) * (b[1] - c[1]) - (b[0] - c[0]) * (py - c[1]);
  const d3 = (px - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (py - a[1]);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0, hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

// 把所有三角形叠起来
const all = [];
for (const v of tris) all.push(v);

// 逐三角形渲染报面积
function triArea2D(a, b, c) {
  return Math.abs((b[0]-a[0])*(c[1]-a[1]) - (b[1]-a[1])*(c[0]-a[0])) * 0.005; // 每个整数格算0.005
}
// 单个三角形 ASCII
for (let ti = 0; ti < Math.min(8, tris.length); ti++) {
  const v = tris[ti];
  const grid = new Array(H).fill(0).map(() => new Array(W).fill('.'));
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const z = c / (W-1) * 8 - 4, y = 9 - r / (H-1) * 3;
      if (inTri(z, y, [v[0][2],v[0][1]], [v[1][2],v[1][1]], [v[2][2],v[2][1]])) grid[r][c] = '#';
    }
  }
  let lines = `--- 三角形 T${ti} (x=${v[0][0].toFixed(2)}) ---\n`;
  for (let r = 0; r < H; r += 2) { lines += grid[r].join('') + '\n'; }
  fs.appendFileSync(path.join(ROOT, 'cli', '_tri_ascii.txt'), lines);
}

// 全部左侧三角形叠加
const grid = new Array(H).fill(0).map(() => new Array(W).fill('.'));
for (const v of all) {
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const z = c / (W-1) * 8 - 4, y = 9 - r / (H-1) * 3;
      if (inTri(z, y, [v[0][2],v[0][1]], [v[1][2],v[1][1]], [v[2][2],v[2][1]])) grid[r][c] = '#';
    }
  }
}
let out = '--- 左侧全部山花三角形叠加 ---\n';
for (let r = 0; r < H; r += 2) out += grid[r].join('') + '\n';
fs.writeFileSync(path.join(ROOT, 'cli', '_tri_ascii.txt'), out);
console.log('已写入 cli/_tri_ascii.txt');