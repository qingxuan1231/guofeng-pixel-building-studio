/* 验证剩余重复三角形：是否法线相反（内外双面）而非真重复 */
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
const V = (t) => { const i = t*9; return [[mesh.pos[i],mesh.pos[i+1],mesh.pos[i+2]],[mesh.pos[i+3],mesh.pos[i+4],mesh.pos[i+5]],[mesh.pos[i+6],mesh.pos[i+7],mesh.pos[i+8]]]; };
const seen = new Map();
const dups = [];
for (let t = 0; t < N; t++) {
  const tri = V(t);
  const k = [K(tri[0]),K(tri[1]),K(tri[2])].sort().join('|');
  if (seen.has(k)) dups.push({ cur: t, prev: seen.get(k), tag: mesh.tag[t], tri });
  else seen.set(k, t);
}
let opposite=0, same=0, degen=0;
const byTag = {};
for (const d of dups) {
  const a=d.tri[0], b=d.tri[1], c=d.tri[2];
  const ab=Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
  const ac=Math.hypot(a[0]-c[0],a[1]-c[1],a[2]-c[2]);
  const bc=Math.hypot(b[0]-c[0],b[1]-c[1],b[2]-c[2]);
  if (ab<1e-6||ac<1e-6||bc<1e-6){degen++;continue;}
  const prevT = V(d.prev);
  // 判定 prev 是否与 cur 逆序（内外双面）：寻找 cur 每顶点在 prev 的位置，检查全逆序
  const kf = (p)=> K(p);
  const order = prevT.map(p=>curKeyIndex(kf(p), d));
  function curKeyIndex(kk, dd){ return dd.tri.findIndex(q=>kf(q)===kk); }
  const rev = order[0]>order[1] && order[1]>order[2];
  if (rev) { opposite++; if(!byTag[d.tag])byTag[d.tag]={opp:0,same:0}; byTag[d.tag].opp++; }
  else { same++; if(!byTag[d.tag])byTag[d.tag]={opp:0,same:0}; byTag[d.tag].same++; }
}
console.log(`非退化的 ${same+opposite} 对: 逆序(双面)=${opposite} 同序(真重复)=${same}`);
for (const [k,v] of Object.entries(byTag)) console.log(`  ${k}: 双面=${v.opp} 真重复=${v.same}`);
// 打印真重复样本
let cc=0;
for (const d of dups) {
  const a=d.tri[0], b=d.tri[1], c=d.tri[2];
  const ab=Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
  const ac=Math.hypot(a[0]-c[0],a[1]-c[1],a[2]-c[2]);
  const bc=Math.hypot(b[0]-c[0],b[1]-c[1],b[2]-c[2]);
  if (ab<1e-6||ac<1e-6||bc<1e-6) continue;
  const prevT = V(d.prev);
  const kf = (p)=> K(p);
  const qd = {tri: d.tri};
  const order = prevT.map(p=>qd.tri.findIndex(q=>kf(q)===kf(p)));
  const rev = order[0]>order[1] && order[1]>order[2];
  if (rev) continue;
  if (++cc>8) break;
  console.log(`同序 #${d.cur}/#${d.prev} ${d.tag}: A(${a.map(v=>v.toFixed(3))}) B(${b.map(v=>v.toFixed(3))}) C(${c.map(v=>v.toFixed(3))})`);
}