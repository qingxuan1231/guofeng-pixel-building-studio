/* 复用 coplanar 网格逻辑，输出每对共面重叠的 tag、中心坐标 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const { ANCIENT } = require(path.join(ROOT, 'cli/modules.js'));
const FILES = ANCIENT.concat(['js/gf-render.js', 'js/gf-presets.js', 'js/gf-export.js']);
const ctx = { console }; ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of FILES) { const abs = path.isAbsolute(f) ? f : path.join(ROOT, f); vm.runInContext(fs.readFileSync(abs, 'utf8'), ctx, { filename: abs }); }
const GF = ctx.GF;
const mesh = GF.build({ ...GF.getPreset('temple5') });
const minArea = 0.02;

function tri4(t) {
  const p = mesh.pos;
  return [[p[t*9], p[t*9+1], p[t*9+2]], [p[t*9+3], p[t*9+4], p[t*9+5]], [p[t*9+6], p[t*9+7], p[t*9+8]]];
}
function plane4(a, b, c) {
  const u = [b[0]-a[0], b[1]-a[1], b[2]-a[2]], v = [c[0]-a[0], c[1]-a[1], c[2]-a[2]];
  let nx = u[1]*v[2]-u[2]*v[1], ny = u[2]*v[0]-u[0]*v[2], nz = u[0]*v[1]-u[1]*v[0];
  const L = Math.hypot(nx, ny, nz) || 1; nx/=L; ny/=L; nz/=L;
  if (nx+ny+nz<0) { nx=-nx; ny=-ny; nz=-nz; }
  return { nx, ny, nz, d: nx*a[0]+ny*a[1]+nz*a[2], area: L/2 };
}
function proj(n) {
  if (Math.abs(n.nx) >= Math.abs(n.ny) && Math.abs(n.nx) >= Math.abs(n.nz)) return [1, 2];
  if (Math.abs(n.ny) >= Math.abs(n.nz)) return [0, 2];
  return [0, 1];
}
function polyArea2(pts) { let s = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += a[0]*b[1] - b[0]*a[1]; } return Math.abs(s) / 2; }
const inbox = (p, a, b) => (b[0]-a[0])*(p[1]-a[1]) - (b[1]-a[1])*(p[0]-a[0]);
function clip(subj, clipPoly) {
  let out = subj;
  for (let i = 0; i < clipPoly.length && out.length; i++) {
    const a = clipPoly[i], b = clipPoly[(i + 1) % clipPoly.length];
    const next = [];
    for (let j = 0; j < out.length; j++) {
      const p = out[j], q = out[(j + 1) % out.length];
      const sp = inbox(p, a, b), sq = inbox(q, a, b);
      if (sp >= 0) next.push(p);
      if ((sp >= 0) !== (sq >= 0)) { const t = sp / (sp - sq); next.push([p[0] + (q[0]-p[0])*t, p[1] + (q[1]-p[1])*t]); }
    }
    out = next;
  }
  return out;
}
const groups = new Map();
for (let t = 0; t < mesh.triCount; t++) {
  const tg = mesh.tag[t] || '';
  if (!/墙体/.test(tg)) continue;
  const ps = tri4(t);
  const n = plane4(ps[0], ps[1], ps[2]);
  if (n.area < 1e-6) continue;
  const ax = proj(n);
  const key = Math.round(n.nx*2000) + ',' + Math.round(n.ny*2000) + ',' + Math.round(n.nz*2000) + ',' + Math.round(n.d*1000);
  let g = groups.get(key); if (!g) { g = { list: [] }; groups.set(key, g); }
  const poly = ps.map(p => [p[ax[0]], p[ax[1]]]);
  let ux0 = 1e9, ux1 = -1e9, uy0 = 1e9, uy1 = -1e9;
  for (const p of poly) { if (p[0] < ux0) ux0 = p[0]; if (p[0] > ux1) ux1 = p[0]; if (p[1] < uy0) uy0 = p[1]; if (p[1] > uy1) uy1 = p[1]; }
  g.list.push({ t, poly, area: n.area, n, ux0, ux1, uy0, uy1 });
}
const CELL = 0.6;
let outN = 0;
for (const g of groups.values()) {
  const L = g.list; if (L.length < 2) continue;
  const grid = new Map();
  for (let i = 0; i < L.length; i++) {
    const e = L[i];
    for (let gx = Math.floor(e.ux0/CELL); gx <= Math.floor(e.ux1/CELL); gx++)
      for (let gy = Math.floor(e.uy0/CELL); gy <= Math.floor(e.uy1/CELL); gy++) {
        const k = gx + ':' + gy; let b = grid.get(k); if (!b) { b = []; grid.set(k, b); } b.push(i);
      }
  }
  const seen = new Set();
  for (const b of grid.values()) {
    for (let a = 0; a < b.length; a++) for (let c = a + 1; c < b.length; c++) {
      const i = b[a], j = b[c];
      const k = i < j ? i * 1e7 + j : j * 1e7 + i;
      if (seen.has(k)) continue; seen.add(k);
      const A = L[i], B = L[j];
      if (!(A.ux0 < B.ux1 && B.ux0 < A.ux1 && A.uy0 < B.uy1 && B.uy0 < A.uy1)) continue;
      const inter = clip(A.poly, B.poly);
      if (inter.length < 3) continue;
      const a2 = polyArea2(inter);
      if (a2 <= minArea) continue;
      const cA = tri4(A.t), cB = tri4(B.t);
      const mAp = [(cA[0][0]+cA[1][0]+cA[2][0])/3, (cA[0][1]+cA[1][1]+cA[2][1])/3, (cA[0][2]+cA[1][2]+cA[2][2])/3];
      const mBp = [(cB[0][0]+cB[1][0]+cB[2][0])/3, (cB[0][1]+cB[1][1]+cB[2][1])/3, (cB[0][2]+cB[1][2]+cB[2][2])/3];
      if (outN++ < 25)
        console.log(`重叠=${a2.toFixed(3)}m²  ${mesh.tag[A.t]} @(${mAp[0].toFixed(1)},${mAp[1].toFixed(2)},${mAp[2].toFixed(1)})  ×  ${mesh.tag[B.t]} @(${mBp[0].toFixed(1)},${mBp[1].toFixed(2)},${mBp[2].toFixed(1)})  n=(${A.n.nx.toFixed(1)},${A.n.ny.toFixed(1)},${A.n.nz.toFixed(1)}) d=${A.n.d.toFixed(3)}`);
    }
  }
}
console.log('共输出', Math.min(outN, 25), '对');