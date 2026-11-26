/* 打印 18160~18240 的三角形序列与相对中心的几何 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const { ANCIENT } = require(path.join(ROOT, 'cli/modules.js'));
const FILES = ANCIENT.concat(['js/gf-render.js', 'js/gf-presets.js', 'js/gf-export.js']);
const ctx = { console }; ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of FILES) { const abs = path.isAbsolute(f) ? f : path.join(ROOT, f); vm.runInContext(fs.readFileSync(abs, 'utf8'), ctx, { filename: abs }); }
const GF = ctx.GF;
const mesh = GF.build({ ...GF.getPreset('temple5') });
const pr = (t) => { const i = t*9;
  return [[mesh.pos[i],mesh.pos[i+1],mesh.pos[i+2]],[mesh.pos[i+3],mesh.pos[i+4],mesh.pos[i+5]],[mesh.pos[i+6],mesh.pos[i+7],mesh.pos[i+8]]]; };
for (let t = 18160; t <= 18240; t += 2) {
  const tg = mesh.tag[t] || '';
  const p = pr(t);
  const d01 = Math.hypot(p[0][0]-p[1][0],p[0][1]-p[1][1],p[0][2]-p[1][2]);
  const d12 = Math.hypot(p[1][0]-p[2][0],p[1][1]-p[2][1],p[1][2]-p[2][2]);
  const d20 = Math.hypot(p[2][0]-p[0][0],p[2][1]-p[0][1],p[2][2]-p[0][2]);
  const ez = d01 < 1e-9 || d12 < 1e-9 || d20 < 1e-9;
  const area = 0.5 * Math.abs(
    (p[1][0]-p[0][0])*(p[2][2]-p[0][2]) - (p[2][0]-p[0][0])*(p[1][2]-p[0][2]));
  console.log(`#${t} area=${area.toFixed(4)} L=${[d01,d12,d20].map(x=>x.toFixed(3)).join('/')} ${ez?'DEG':'   '} ${tg} ${p.map(v=>`(${v.map(x=>x.toFixed(3)).join(',')})`).join(' ')}`);
}