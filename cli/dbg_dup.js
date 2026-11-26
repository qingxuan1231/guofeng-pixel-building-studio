/* 全局哈希：找完全重复的三角形（3 顶点相同即重复），聚类输出重复区域 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const { ANCIENT } = require(path.join(ROOT, 'cli/modules.js'));
const FILES = ANCIENT.concat(['js/gf-render.js', 'js/gf-presets.js', 'js/gf-export.js']);
const ctx = { console }; ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of FILES) { const abs = path.isAbsolute(f) ? f : path.join(ROOT, f); vm.runInContext(fs.readFileSync(abs, 'utf8'), ctx, { filename: abs }); }
const GF = ctx.GF;
const mesh = GF.build({ ...GF.getPreset('temple5') });

function key(va) {
  return va.map(v => v.map(x => Math.round(x * 1000)).join(',')).join('|');
}
const seen = new Map();
const dupTris = [];
const N = mesh.triCount;
for (let t = 0; t < N; t++) {
  const i = t * 9;
  const A = [mesh.pos[i], mesh.pos[i+1], mesh.pos[i+2]];
  const B = [mesh.pos[i+3], mesh.pos[i+4], mesh.pos[i+5]];
  const C = [mesh.pos[i+6], mesh.pos[i+7], mesh.pos[i+8]];
  // 排序后的键（顺序无关）
  const srt = [key([A,B,C]), key([B,C,A]), key([C,A,B])].sort()[0];
  const tag = mesh.tag[t] || '';
  if (srt.startsWith('0,0,0')) continue;
  const rec = seen.get(srt);
  if (rec) {
    dupTris.push({ t, tag, A, B, C, prev: rec });
  } else seen.set(srt, { t, tag });
}
console.log('完全重复三角形总数 =', dupTris.length);
// 按 tag 聚合
const byTag = new Map();
for (const d of dupTris) {
  const k = (d.prev.tag || '') + ' × ' + d.tag;
  byTag.set(k, (byTag.get(k) || 0) + 1);
}
const top = [...byTag.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
for (const [k, n] of top) console.log(`  ${String(n).padStart(6)} 个   ${k}`);
// 抽样：分别打印 隔墙 与 墙体·前 的重复样本
console.log('—— 隔墙重复样本 ——');
let hw = 0;
for (const d of dupTris) {
  if (!/隔墙/.test(d.tag)) continue;
  if (hw++ >= 4) break;
  const A0 = d.A, B0 = d.B, C0 = d.C;
  const p0 = d.prev;
  const PA = [mesh.pos[p0.t*9], mesh.pos[p0.t*9+1], mesh.pos[p0.t*9+2]];
  const PB = [mesh.pos[p0.t*9+3], mesh.pos[p0.t*9+4], mesh.pos[p0.t*9+5]];
  const PC = [mesh.pos[p0.t*9+6], mesh.pos[p0.t*9+7], mesh.pos[p0.t*9+8]];
  console.log(`  tri#${d.t}(${d.tag}): A(${A0.map(v=>v.toFixed(3))}) B(${B0.map(v=>v.toFixed(3))}) C(${C0.map(v=>v.toFixed(3))})`);
  console.log(`  pri#${p0.t}(${p0.tag}): A(${PA.map(v=>v.toFixed(3))}) B(${PB.map(v=>v.toFixed(3))}) C(${PC.map(v=>v.toFixed(3))})`);
  const area = (a, b, c) => 0.5 * Math.hypot(
    (b[1]-a[1])*(c[2]-a[2]) - (b[2]-a[2])*(c[1]-a[1]),
    (b[2]-a[2])*(c[0]-a[0]) - (b[0]-a[0])*(c[2]-a[2]),
    (b[0]-a[0])*(c[1]-a[1]) - (b[1]-a[1])*(c[0]-a[0]));
  console.log(`  area=${area(A0,B0,C0).toFixed(4)}`);
}
console.log('—— 墙体·前 重复样本 ——');
let hw2 = 0;
for (const d of dupTris) {
  if (!/墙体·前/.test(d.tag)) continue;
  if (hw2++ >= 3) break;
  const A0 = d.A, B0 = d.B, C0 = d.C;
  console.log(`  tri#${d.t}: A(${A0.map(v=>v.toFixed(3))}) B(${B0.map(v=>v.toFixed(3))}) C(${C0.map(v=>v.toFixed(3))})`);
}