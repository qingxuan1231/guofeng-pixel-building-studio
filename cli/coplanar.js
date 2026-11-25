/* 共面重叠检测：同一平面且真实 2D 重叠 = z-fighting（转视角条纹闪烁）的物理成因
 *
 *   node cli/coplanar.js <preset> [ppm] [tagRegex] [minArea]
 *   例：node cli/coplanar.js qing 320
 *       node cli/coplanar.js qing 320 "墙|窗" 0.05
 *
 * 判据：两个三角面法线平行、平面常数 d 相同（1/1000 容差），且投影后 2D 多边形真重叠。
 * 面积合计越小越好；0 表示没有可见的共面争夺。
 */
/* 全模型共面重叠检测（网格加速）：同一平面且真实 2D 重叠 = z-fighting 的物理成因 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const { ANCIENT } = require(path.join(ROOT, 'cli/modules.js'));
const PARTS = process.env.PARTS_OVERRIDE || 'js/gf-parts.js';
const FILES = ANCIENT.map(f => (f === 'js/gf-parts.js' ? PARTS : f)).concat(['js/gf-render.js', 'js/gf-presets.js', 'js/gf-export.js']);
const ctx = { console }; ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of FILES) { const abs = path.isAbsolute(f) ? f : path.join(ROOT, f); vm.runInContext(fs.readFileSync(abs, 'utf8'), ctx, { filename: abs }); }
const GF = ctx.GF;

const presetKey = process.argv[2] || 'qing';
const ppm = Number(process.argv[3] || 320);
const filtRe = process.argv[4] ? new RegExp(process.argv[4]) : null;
const minArea = Number(process.argv[5] || 0.02);
const mesh = GF.build(GF.getPreset(presetKey), { ppm });
console.log(`[${presetKey} ppm=${ppm}] tris=${mesh.triCount}`);

function tri4(t) {
  const p = mesh.pos;
  return [[p[t * 9], p[t * 9 + 1], p[t * 9 + 2]], [p[t * 9 + 3], p[t * 9 + 4], p[t * 9 + 5]], [p[t * 9 + 6], p[t * 9 + 7], p[t * 9 + 8]]];
}
function plane4(a, b, c) {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  let nx = u[1] * v[2] - u[2] * v[1], ny = u[2] * v[0] - u[0] * v[2], nz = u[0] * v[1] - u[1] * v[0];
  const L = Math.hypot(nx, ny, nz) || 1; nx /= L; ny /= L; nz /= L;
  if (nx + ny + nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
  return { nx, ny, nz, d: nx * a[0] + ny * a[1] + nz * a[2], area: L / 2 };
}
function proj(n) {
  if (Math.abs(n.nx) >= Math.abs(n.ny) && Math.abs(n.nx) >= Math.abs(n.nz)) return [1, 2];
  if (Math.abs(n.ny) >= Math.abs(n.nz)) return [0, 2];
  return [0, 1];
}
function polyArea2(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(s) / 2;
}
const inbox = (p, a, b) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
function clip(subj, clipPoly) {
  let out = subj;
  for (let i = 0; i < clipPoly.length && out.length; i++) {
    const a = clipPoly[i], b = clipPoly[(i + 1) % clipPoly.length];
    const next = [];
    for (let j = 0; j < out.length; j++) {
      const p = out[j], q = out[(j + 1) % out.length];
      const sp = inbox(p, a, b), sq = inbox(q, a, b);
      if (sp >= 0) next.push(p);
      if ((sp >= 0) !== (sq >= 0)) {
        const t = sp / (sp - sq);
        next.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    }
    out = next;
  }
  return out;
}

const groups = new Map();
const N = mesh.triCount;
for (let t = 0; t < N; t++) {
  const tg = mesh.tag[t] || '';
  if (filtRe && !filtRe.test(tg)) continue;
  const ps = tri4(t);
  const n = plane4(ps[0], ps[1], ps[2]);
  if (n.area < 1e-6) continue;
  const ax = proj(n);
  const key = Math.round(n.nx * 2000) + ',' + Math.round(n.ny * 2000) + ',' + Math.round(n.nz * 2000) + ',' + Math.round(n.d * 1000);
  let g = groups.get(key);
  if (!g) { g = { n, free: ax, list: [] }; groups.set(key, g); }
  const poly = ps.map(p => [p[ax[0]], p[ax[1]]]);
  let ux0 = 1e9, ux1 = -1e9, uy0 = 1e9, uy1 = -1e9;
  for (const p of poly) { if (p[0] < ux0) ux0 = p[0]; if (p[0] > ux1) ux1 = p[0]; if (p[1] < uy0) uy0 = p[1]; if (p[1] > uy1) uy1 = p[1]; }
  g.list.push({ t, poly, area: n.area, ux0, ux1, uy0, uy1 });
}

const CELL = 0.6;
let pairs = 0, areaSum = 0;
const agg = new Map();   // "tagA×tagB" -> {n, area}
const worst = [];
for (const g of groups.values()) {
  const L = g.list;
  if (L.length < 2) continue;
  // 网格分桶
  const grid = new Map();
  for (let i = 0; i < L.length; i++) {
    const e = L[i];
    const gx0 = Math.floor(e.ux0 / CELL), gx1 = Math.floor(e.ux1 / CELL);
    const gy0 = Math.floor(e.uy0 / CELL), gy1 = Math.floor(e.uy1 / CELL);
    for (let gx = gx0; gx <= gx1; gx++) for (let gy = gy0; gy <= gy1; gy++) {
      const k = gx + ':' + gy;
      let b = grid.get(k); if (!b) { b = []; grid.set(k, b); }
      b.push(i);
    }
  }
  const seen = new Set();
  for (const b of grid.values()) {
    for (let a = 0; a < b.length; a++) for (let c = a + 1; c < b.length; c++) {
      const i = b[a], j = b[c];
      const k = i < j ? i * 1e7 + j : j * 1e7 + i;
      if (seen.has(k)) continue;
      seen.add(k);
      const A = L[i], B = L[j];
      if (!(A.ux0 < B.ux1 && B.ux0 < A.ux1 && A.uy0 < B.uy1 && B.uy0 < A.uy1)) continue;
      const inter = clip(A.poly, B.poly);
      if (inter.length < 3) continue;
      const a2 = polyArea2(inter);
      if (a2 <= minArea) continue;
      pairs++; areaSum += a2;
      const ta = mesh.tag[A.t] || '', tb = mesh.tag[B.t] || '';
      const key = ta < tb ? ta + ' × ' + tb : tb + ' × ' + ta;
      const e = agg.get(key) || { n: 0, area: 0 };
      e.n++; e.area += a2; agg.set(key, e);
      worst.push({ a2, ta, tb, n: g.n, d: g.n.nx * 0 + g.n.d });
    }
  }
}
const top = [...agg.entries()].sort((x, y) => y[1].area - x[1].area).slice(0, 18);
console.log(`共面重叠面对 ${pairs}，面积合计 ${areaSum.toFixed(2)} m²`);
for (const [k, v] of top) console.log(`  ${v.area.toFixed(3).padStart(9)} m²  ${String(v.n).padStart(5)} 对   ${k}`);
worst.sort((x, y) => y.a2 - x.a2);
console.log('单对最大:');
for (const w of worst.slice(0, 6)) console.log(`  ${w.a2.toFixed(3)} m²  ${w.ta} × ${w.tb}  n=(${w.n.nx.toFixed(2)},${w.n.ny.toFixed(2)},${w.n.nz.toFixed(2)}) d=${w.n.d.toFixed(3)}`);

