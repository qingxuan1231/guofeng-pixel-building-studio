// 定位 temple5 共面墙体对的具体坐标与所属构件（tag 与顶点）
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

// 收集每个三角形的中心点 + tag
const tris = [];
for (let t = 0; t < m.triCount; t++) {
  const i = t * 9;
  tris.push({
    tag: m.tag[t],
    A: [m.pos[i], m.pos[i+1], m.pos[i+2]],
    B: [m.pos[i+3], m.pos[i+4], m.pos[i+5]],
    C: [m.pos[i+6], m.pos[i+7], m.pos[i+8]]
  });
}

// 按 tag 汇总中心点
const centers = new Map();
for (const tr of tris) {
  const cx = (tr.A[0]+tr.B[0]+tr.C[0])/3, cy = (tr.A[1]+tr.B[1]+tr.C[1])/3, cz = (tr.A[2]+tr.B[2]+tr.C[2])/3;
  if (!centers.has(tr.tag)) centers.set(tr.tag, []);
  centers.get(tr.tag).push([cx, cy, cz]);
}

// 输出所有 墙体·前 / 墙体·后 的 tag 与中心聚类（y 按 0.2 取整观察分层）
for (const [tag] of centers) {
  if (!tag.includes('墙体·前') && !tag.includes('墙体·后')) continue;
  const pts = new Map();
  for (const [x, y, z] of centers.get(tag)) {
    const ky = (Math.round(y * 4) / 4).toFixed(2);
    const kx = Math.round(x).toFixed(0), kz = Math.round(z).toFixed(0);
    const key = `${kx},${ky},${kz}`;
    pts.set(key, (pts.get(key) || 0) + 1);
  }
  const top = [...pts.entries()].sort((a,b) => b[1]-a[1]).slice(0, 14);
  console.log('===', tag, '=== 分块(中心取整):');
  for (const [k, n] of top) console.log('   ', k, 'x', n);
}