const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const { ANCIENT } = require(path.join(ROOT, 'cli/modules.js'));
const FILES = ANCIENT.concat(['js/gf-render.js', 'js/gf-presets.js', 'js/gf-export.js']);
const ctx = { console }; ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of FILES) { const abs = path.isAbsolute(f) ? f : path.join(ROOT, f); vm.runInContext(fs.readFileSync(abs, 'utf8'), ctx, { filename: abs }); }
const GF = ctx.GF;
const mb = new GF.Mesh();
// 八边形，内接半径 0.5（中心到顶点 0.5 -> nr=3），高 1
const n = 8, R = 0.5;
const pts = [];
for (let i = 0; i < n; i++) { const a = (i/n)*Math.PI*2; pts.push([Math.cos(a)*R, Math.sin(a)*R]); }
mb.prism(pts, 0, 1, 'stone', 'test·八棱柱');
const pr = (t) => { const i = t*9; const v=[0,3,6].map(k=>[Math.round(mb.pos[i+k]*1000)/1000,Math.round(mb.pos[i+k+1]*1000)/1000,Math.round(mb.pos[i+k+2]*1000)/1000]); const e=[Math.hypot(v[0][0]-v[1][0],v[0][1]-v[1][1],v[0][2]-v[1][2]),Math.hypot(v[1][0]-v[2][0],v[1][1]-v[2][1],v[1][2]-v[2][2]),Math.hypot(v[2][0]-v[0][0],v[2][1]-v[0][1],v[2][2]-v[0][2])]; const d=e[0]>=e[1]&&e[0]>=e[2]?e[0]:e[1]>=e[2]?e[1]:e[2]; return {v,e,d}; };
// 只打印顶面（y=1）风扇格
for (let t = 0; t < mb.triCount; t++) {
  const p = pr(t);
  const y1 = p.v[0][1], y2 = p.v[1][1], y3 = p.v[2][1];
  const capish = Math.abs(y1-1)<1e-9 && Math.abs(y2-1)<1e-9 && Math.abs(y3-1)<1e-9;
  if (!capish) continue;
  console.log(`#${t} ${p.v.map(v=>v.join(',')).join(' | ')} dmax=${p.d.toFixed(3)}`);
}