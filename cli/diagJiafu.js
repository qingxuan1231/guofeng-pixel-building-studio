'use strict';
const path = require('path'), vm = require('vm'), fs = require('fs');
const ROOT = path.join(__dirname, '..');
const { ANCIENT } = require('./modules');
const FILES = ANCIENT.concat(['js/gf-render.js', 'js/gf-presets.js', 'js/gf-export.js']);
const ctx = { console };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
const GF = ctx.GF;

function filter(mesh, re) {
  const m = new GF.Mesh();
  for (let t = 0; t < mesh.triCount; t++) {
    if (!re.test(mesh.tag[t])) continue;
    const i = t * 9;
    m.tri([mesh.pos[i], mesh.pos[i+1], mesh.pos[i+2]], [mesh.pos[i+3], mesh.pos[i+4], mesh.pos[i+5]],
          [mesh.pos[i+6], mesh.pos[i+7], mesh.pos[i+8]], mesh.mat[t], mesh.tag[t]);
  }
  return m;
}
const p = GF.getPreset('jiafu');
const m = GF.build({ ...p });
console.log('build 完成，总三角形数', m.triCount);
const fm = filter(m, /院墙·压顶/);
const rows = [];
for (let t = 0; t < fm.triCount; t++) {
  const i = t * 9;
  const A = [fm.pos[i], fm.pos[i+1], fm.pos[i+2]];
  const B = [fm.pos[i+3], fm.pos[i+4], fm.pos[i+5]];
  const C = [fm.pos[i+6], fm.pos[i+7], fm.pos[i+8]];
  const e = (p, q) => Math.hypot(p[0]-q[0], p[1]-q[1], p[2]-q[2]);
  const mx = Math.max(e(A,B), e(B,C), e(C,A));
  if (mx > 0.55) {
    rows.push({ mx: +mx.toFixed(2), tag: fm.tag[t], A, B, C });
  }
}
rows.sort((a,b)=>b.mx-a.mx);
console.log('>0.55m 数量', rows.length);
for (const r of rows.slice(0, 12)) {
  console.log(JSON.stringify(r));
}