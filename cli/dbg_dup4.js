/* 检查剩余重复三角形是否零面积退化（两顶点重合） */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const { ANCIENT } = require(path.join(ROOT, 'cli/modules.js'));
const FILES = ANCIENT.concat(['js/gf-render.js', 'js/gf-presets.js', 'js/gf-export.js']);
const ctx = { console }; ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of FILES) { const abs = path.isAbsolute(f) ? f : path.join(ROOT, f); vm.runInContext(fs.readFileSync(abs, 'utf8'), ctx, { filename: abs }); }
const GF = ctx.GF;
const mesh = GF.build({ ...GF.getPreset('temple5') });
const N = mesh.triCount;
const K = (p) => Math.round(p[0]*1000) + ',' + Math.round(p[1]*1000) + ',' + Math.round(p[2]*1000);
const seen = new Map();
const dups = [];
for (let t = 0; t < N; t++) {
  const i = t * 9;
  const A = [mesh.pos[i], mesh.pos[i+1], mesh.pos[i+2]];
  const B = [mesh.pos[i+3], mesh.pos[i+4], mesh.pos[i+5]];
  const C = [mesh.pos[i+6], mesh.pos[i+7], mesh.pos[i+8]];
  const k = [K(A), K(B), K(C)].sort().join('|');
  if (seen.has(k)) dups.push({ cur: t, prev: seen.get(k), tag: mesh.tag[t], A, B, C });
  else seen.set(k, t);
}
let degen = 0, real = 0;
const byTag = {};
for (const d of dups) {
  const a = d.A, b = d.B, c = d.C;
  const ab = Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]);
  const ac = Math.hypot(a[0]-c[0], a[1]-c[1], a[2]-c[2]);
  const bc = Math.hypot(b[0]-c[0], b[1]-c[1], b[2]-c[2]);
  const isDeg = ab < 1e-6 || ac < 1e-6 || bc < 1e-6;
  const key = d.tag || '?';
  if (!byTag[key]) byTag[key] = { degen: 0, real: 0 };
  if (isDeg) { degen++; byTag[key].degen++; } else { real++; byTag[key].real++; }
}
console.log(`剩余重复: ${dups.length}  = 零面积退化 ${degen} + 真实重叠 ${real}`);
for (const [k, v] of Object.entries(byTag)) console.log(`  ${k}: 退化=${v.degen} 真实=${v.real}`);
// 打印真实重叠样本
let cc = 0;
for (const d of dups) {
  const a = d.A, b = d.B, c = d.C;
  const ab = Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]);
  const ac = Math.hypot(a[0]-c[0], a[1]-c[1], a[2]-c[2]);
  const bc = Math.hypot(b[0]-c[0], b[1]-c[1], b[2]-c[2]);
  if (ab < 1e-6 || ac < 1e-6 || bc < 1e-6) continue;
  if (++cc > 12) break;
  console.log(`real #${d.cur}/#${d.prev} ${d.tag}: A(${a.map(v=>v.toFixed(3))}) B(${b.map(v=>v.toFixed(3))}) C(${c.map(v=>v.toFixed(3))})`);
}