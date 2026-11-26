const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const { ANCIENT } = require(path.join(ROOT, 'cli/modules.js'));
const FILES = ANCIENT.concat(['js/gf-render.js', 'js/gf-presets.js', 'js/gf-export.js']);
const ctx = { console }; ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of FILES) { const abs = path.isAbsolute(f) ? f : path.join(ROOT, f); vm.runInContext(fs.readFileSync(abs, 'utf8'), ctx, { filename: abs }); }
const GF = ctx.GF;
const mesh = GF.build({ ...GF.getPreset('temple5') });
const pr = (t) => { const i = t*9; return [[Math.round(mesh.pos[i]*1000)/1000,Math.round(mesh.pos[i+1]*1000)/1000,Math.round(mesh.pos[i+2]*1000)/1000],[Math.round(mesh.pos[i+3]*1000)/1000,Math.round(mesh.pos[i+4]*1000)/1000,Math.round(mesh.pos[i+5]*1000)/1000],[Math.round(mesh.pos[i+6]*1000)/1000,Math.round(mesh.pos[i+7]*1000)/1000,Math.round(mesh.pos[i+8]*1000)/1000]]; };
for (let t = 17820; t < 17910; t++) {
  const p = pr(t);
  const d01 = Math.hypot(p[0][0]-p[1][0],p[0][1]-p[1][1],p[0][2]-p[1][2]);
  const d12 = Math.hypot(p[1][0]-p[2][0],p[1][1]-p[2][1],p[1][2]-p[2][2]);
  const d20 = Math.hypot(p[2][0]-p[0][0],p[2][1]-p[0][1],p[2][2]-p[0][2]);
  const ez = d01<1e-9||d12<1e-9||d20<1e-9;
  const fmt = (v) => v.toFixed(3);
  console.log(`#${t} ${mesh.tag[t]} ${ez?'DEG':'   '} ${p.map(q=>`(${q.map(fmt).join(',')})`).join(' ')}`);
}