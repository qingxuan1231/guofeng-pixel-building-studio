// 定位 temple5 门顶·山花 / 连檐 中最长边三角形的实际位置
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
const e = (p, q) => Math.hypot(p[0]-q[0], p[1]-q[1], p[2]-q[2]);

// 只筛二进隔墙门顶，找最长三角形
const m = GF.build({ ...GF.getPreset('temple5') });
const fr = filter(m, /门顶/);
let best = { len: 0, tag: '', tri: null };
for (let t = 0; t < fr.triCount; t++) {
  const i = t * 9;
  const A = [fr.pos[i], fr.pos[i+1], fr.pos[i+2]];
  const B = [fr.pos[i+3], fr.pos[i+4], fr.pos[i+5]];
  const C = [fr.pos[i+6], fr.pos[i+7], fr.pos[i+8]];
  const AB = e(A,B), BC = e(B,C), CA = e(C,A);
  if (Math.max(AB,BC,CA) > best.len) best = { len: Math.max(AB,BC,CA), tag: fr.tag[t],
    tri: [A,B,C].map(v => v.map(n => +n.toFixed(2))), edges: [AB,BC,CA].map(n => +n.toFixed(2)) };
}
console.log('门顶最长三角形:', best);