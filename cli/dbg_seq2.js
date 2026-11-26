/* 精确对比 #18198 vs #18200 及垂脊/栏杆重复对 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const { ANCIENT } = require(path.join(ROOT, 'cli/modules.js'));
const FILES = ANCIENT.concat(['js/gf-render.js', 'js/gf-presets.js', 'js/gf-export.js']);
const ctx = { console }; ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of FILES) { const abs = path.isAbsolute(f) ? f : path.join(ROOT, f); vm.runInContext(fs.readFileSync(abs, 'utf8'), ctx, { filename: abs }); }
const GF = ctx.GF;
const mesh = GF.build({ ...GF.getPreset('temple5') });
const V = (t) => { const i = t*9; return [[mesh.pos[i],mesh.pos[i+1],mesh.pos[i+2]],[mesh.pos[i+3],mesh.pos[i+4],mesh.pos[i+5]],[mesh.pos[i+6],mesh.pos[i+7],mesh.pos[i+8]]]; };
const pr = (tri) => tri.map(p=>`(${p.map(v=>v.toFixed(3)).join()})`).join(' ');

const cases = [[18198,18200],[18197,18195],[18193,18200]];
for (const [a,b] of cases) {
  const va = V(a), vb = V(b);
  console.log(`#${a}: ${pr(va)}`);
  console.log(`#${b}: ${pr(vb)}`);
  // 逐点差
  const d = [];
  for (let i=0;i<3;i++) for (let k=0;k<3;k++) d.push(Math.abs(va[i][k]-vb[i][k]));
  console.log(`  逐点差 mm: ${d.map(x=>(x*1000).toFixed(3)).join(', ')}`);
}
// 垂脊重复：找全部 屋面·垂脊 重复对
console.log('\n—— 屋面·垂脊 重复对 ——');
const seen = new Map();
const K = (p) => Math.round(p[0]*1000) + ',' + Math.round(p[1]*1000) + ',' + Math.round(p[2]*1000);
let cnt = 0;
for (let t = 0; t < mesh.triCount; t++) {
  if ((mesh.tag[t]||'') !== '屋面·垂脊') continue;
  const tri = V(t);
  const k = [K(tri[0]),K(tri[1]),K(tri[2])].sort().join('|');
  if (seen.has(k)) {
    if (cnt++ < 6) {
      const va = V(seen.get(k)), vb = tri;
      console.log(`#${seen.get(k)} vs #${t}: ${pr(va)}`);
      console.log(`                    ${pr(vb)}`);
    }
  } else seen.set(k, t);
}