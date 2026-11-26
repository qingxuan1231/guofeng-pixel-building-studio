'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = process.cwd();
const { ANCIENT } = require(path.join(ROOT, 'cli/modules.js'));
const FILES = ANCIENT.concat(['js/gf-render.js', 'js/gf-presets.js', 'js/gf-export.js']);
const ctx = { console }; ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of FILES) { const abs = path.isAbsolute(f) ? f : path.join(ROOT, f); vm.runInContext(fs.readFileSync(abs, 'utf8'), ctx, { filename: abs }); }
const GF = ctx.GF;
const presetKey = process.argv[2] || 'temple5';
const planeZ = Number(process.argv[3] || -6.4);
const tagRe = process.argv[4] ? new RegExp(process.argv[4]) : /台基/;
const ppm = Number(process.argv[5] || 320);
const mesh = GF.build(GF.getPreset(presetKey), { ppm });
const p = mesh.pos, tg = mesh.tag;
const N = mesh.triCount;
const hits = [];
for (let t = 0; t < N; t++) {
  const tag = tg[t] || '';
  if (!tagRe.test(tag)) continue;
  const zA = p[t*9+2], zB = p[t*9+5], zC = p[t*9+8];
  if (Math.abs(zA-planeZ) < 0.012 && Math.abs(zB-planeZ) < 0.012 && Math.abs(zC-planeZ) < 0.012) {
    const x0 = Math.min(p[t*9], p[t*9+3], p[t*9+6]);
    const x1 = Math.max(p[t*9], p[t*9+3], p[t*9+6]);
    const y0 = Math.min(p[t*9+1], p[t*9+4], p[t*9+7]);
    const y1 = Math.max(p[t*9+1], p[t*9+4], p[t*9+7]);
    const a = (x1-x0)*(y1-y0);
    if (a < 0.004) continue;
    hits.push({ tag, x0, x1, y0, y1, a });
  }
}
hits.sort((u, v) => v.a - u.a);
console.log('plane z=' + planeZ + ' hit ' + hits.length + ' faces:');
for (const h of hits.slice(0, 30)) console.log('  ' + h.tag.padEnd(16) + ' x[' + h.x0.toFixed(2) + ',' + h.x1.toFixed(2) + '] y[' + h.y0.toFixed(2) + ',' + h.y1.toFixed(2) + '] ~' + h.a.toFixed(3));
