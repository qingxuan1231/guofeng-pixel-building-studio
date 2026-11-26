/* 打印连续三角形序列，观察重复 pattern */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const { ANCIENT } = require(path.join(ROOT, 'cli/modules.js'));
const FILES = ANCIENT.concat(['js/gf-render.js', 'js/gf-presets.js', 'js/gf-export.js']);
const ctx = { console }; ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of FILES) { const abs = path.isAbsolute(f) ? f : path.join(ROOT, f); vm.runInContext(fs.readFileSync(abs, 'utf8'), ctx, { filename: abs }); }
const GF = ctx.GF;
const mesh = GF.build({ ...GF.getPreset('temple5') });
const F = (v) => v.toFixed(3);
for (let t = 18190; t < 18210; t++) {
  const i = t*9;
  const A=[mesh.pos[i],mesh.pos[i+1],mesh.pos[i+2]], B=[mesh.pos[i+3],mesh.pos[i+4],mesh.pos[i+5]], C=[mesh.pos[i+6],mesh.pos[i+7],mesh.pos[i+8]];
  const area = 0.5*Math.hypot(
    (B[0]-A[0])*(C[1]-A[1])-(B[1]-A[1])*(C[0]-A[0]),
    0) ;
  const n = mesh.nrm[t*3];
  console.log(`#${t} ${(mesh.tag[t]||'').padEnd(12)} nrm(${nrmDir(mesh,t)}) A(${[F(A[0]),F(A[1]),F(A[2])]}) B(${[F(B[0]),F(B[1]),F(B[2])]}) C(${[F(C[0]),F(C[1]),F(C[2])]})`);
}
function nrmDir(mesh, t){
  const i=t*3;
  return [mesh.nrm[i],mesh.nrm[i+1],mesh.nrm[i+2]].map(v=>v.toFixed(2)).join(',');
}