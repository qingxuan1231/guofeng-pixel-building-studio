/* 精确定位重复三角形所属构件与 origin：检查 nrm 数组/全部重复 */
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
console.log('nrm 数组长度 =', mesh.nrm.length, ' triCount=', mesh.triCount, ' 比值=', mesh.nrm.length/mesh.triCount);
// 打印 #18190~#18200 的原始 pos 与 nrm
for (let t = 18193; t <= 18200; t++) {
  const i = t*9;
  const raw = [];
  for (let k=0;k<9;k++) raw.push(mesh.pos[i+k].toFixed(4));
  const nr = [mesh.nrm[t*3], mesh.nrm[t*3+1], mesh.nrm[t*3+2]];
  console.log(`#${t} pos=${raw.join(' ')} nrm=${nr.map(v=>v.toFixed(4)).join(',')}`);
}
// 找出所有重复的「组件石·冠」在 y=0.68 行的三角形数量
const seen = new Map();
const K = (p) => Math.round(p[0]*1000)+','+Math.round(p[1]*1000)+','+Math.round(p[2]*1000);
let cap=0;
for (let t=0;t<mesh.triCount;t++){
  const tg=mesh.tag[t]||'';
  if (!tg.includes('组件石')) continue;
  const tri=V(t);
  const k=[K(tri[0]),K(tri[1]),K(tri[2])].sort().join('|');
  if(seen.has(k)){
    if (cap++ < 4){
      console.log(`DUP#${seen.get(k)} vs #${t}: ${pr(V(seen.get(k)))}`);
    }
  }else seen.set(k,t);
}