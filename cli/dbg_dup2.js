/* 分析隔墙重复：打印重复三角形坐标分布与 index 差 */
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
// tag 统计隔墙总数
let totalWall = 0;
const wallIdx = [];
for (let t = 0; t < N; t++) if ((mesh.tag[t]||'').includes('隔墙')) { totalWall++; wallIdx.push(t); }
console.log('一进/二进/三进/四进隔墙 三角形总数 =', totalWall);

function keyOf(A, B, C) {
  const K = (p) => Math.round(p[0]*1000) + ',' + Math.round(p[1]*1000) + ',' + Math.round(p[2]*1000);
  const s = [K(A), K(B), K(C)].sort().join('|');
  return s;
}
const seen = new Map();
const dups = [];
for (const t of wallIdx) {
  const i = t * 9;
  const A = [mesh.pos[i], mesh.pos[i+1], mesh.pos[i+2]];
  const B = [mesh.pos[i+3], mesh.pos[i+4], mesh.pos[i+5]];
  const C = [mesh.pos[i+6], mesh.pos[i+7], mesh.pos[i+8]];
  const k = keyOf(A, B, C);
  if (seen.has(k)) dups.push({ cur: t, prev: seen.get(k), A, B, C });
  else seen.set(k, t);
}
console.log('隔墙内重复对 =', dups.length);
// index 差分布
const diffs = new Map();
for (const d of dups) {
  const df = d.cur - d.prev;
  diffs.set(df, (diffs.get(df) || 0) + 1);
}
console.log('index 差分布:');
for (const [df, n] of [...diffs.entries()].sort((a,b)=>a[0]-b[0])) console.log(`  Δ=${df} : ${n}`);
// 三顶点是否 y 恒定（侧壁竖面）？
const vert = new Map(), horz = new Map();
for (const d of dups) {
  const xs = new Set([d.A[0], d.B[0], d.C[0]]);
  const ys = new Set([d.A[1], d.B[1], d.C[1]]);
  const zs = new Set([d.A[2], d.B[2], d.C[2]]);
  const ax = Math.min(d.A[0], d.B[0], d.C[0]), bx = Math.max(d.A[0], d.B[0], d.C[0]);
  const ay = Math.min(d.A[1], d.B[1], d.C[1]), by = Math.max(d.A[1], d.B[1], d.C[1]);
  const az = Math.min(d.A[2], d.B[2], d.C[2]), bz = Math.max(d.A[2], d.B[2], d.C[2]);
  const k = `面[${(bx-ax).toFixed(2)}x${(by-ay).toFixed(2)}x${(bz-az).toFixed(2)}] x恒=${xs.size===1} y恒=${ys.size===1} z恒=${zs.size===1}`;
  const m = xs.size === 1 ? '竖-x' : ys.size === 1 ? '水平' : zs.size === 1 ? '竖-z' : '歪';
  (m === '水平' ? horz : vert).set(k, ((m === '水平' ? horz : vert).get(k) || 0) + 1);
}
console.log('水平类重复:'); for (const [k,n] of horz) console.log(`  ${n}  ${k}`);
console.log('非水平类重复:'); for (const [k,n] of vert) console.log(`  ${n}  ${k}`);
// 打印几组对比坐标
let c = 0;
for (const d of dups) {
  if (++c > 5) break;
  const A = d.A, B = d.B, C = d.C;
  console.log(`cur#${d.cur} prev#${d.prev}: A(${A.map(v=>v.toFixed(3))}) B(${B.map(v=>v.toFixed(3))}) C(${C.map(v=>v.toFixed(3))})`);
}