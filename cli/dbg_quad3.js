const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const { ANCIENT } = require(path.join(ROOT, 'cli/modules.js'));
const FILES = ANCIENT.concat(['js/gf-render.js', 'js/gf-presets.js', 'js/gf-export.js']);
const ctx = { console }; ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of FILES) { const abs = path.isAbsolute(f) ? f : path.join(ROOT, f); vm.runInContext(fs.readFileSync(abs, 'utf8'), ctx, { filename: abs }); }
const GF = ctx.GF;
const mesh = GF.build({ ...GF.getPreset('temple5') });
const pr = (t) => { const i = t*9; return [[mesh.pos[i],mesh.pos[i+1],mesh.pos[i+2]],[mesh.pos[i+3],mesh.pos[i+4],mesh.pos[i+5]],[mesh.pos[i+6],mesh.pos[i+7],mesh.pos[i+8]]]; };
for (const t0 of [17844, 308900, 309360, 309494]) {
  console.log(`---- 区间 #${t0}~#${t0+16} ----`);
  for (let t = t0; t < t0+16; t++) {
    const p = pr(t);
    const d01 = Math.hypot(p[0][0]-p[1][0],p[0][1]-p[1][1],p[0][2]-p[1][2]);
    const d12 = Math.hypot(p[1][0]-p[2][0],p[1][1]-p[2][1],p[1][2]-p[2][2]);
    const d20 = Math.hypot(p[2][0]-p[0][0],p[2][1]-p[0][1],p[2][2]-p[0][2]);
    const ez = d01<1e-9||d12<1e-9||d20<1e-9;
    console.log(`#${t} ${mesh.tag[t]} ${ez?'DEG':'   '} ${p.map(v=>`(${v.map(x=>x.toFixed(3)).join(',')})`).join(' ')}`);
  }
}