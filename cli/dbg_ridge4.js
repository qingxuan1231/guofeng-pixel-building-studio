// 在 pyramidRoof 的 hipN 处插桩，输出真实分段数
const path = require('path'), vm = require('vm'), fs = require('fs');
const ROOT = path.join(__dirname, '..');
const { ANCIENT } = require('./modules');
const FILES = ANCIENT.concat(['js/gf-render.js', 'js/gf-presets.js', 'js/gf-export.js']);
const ctx = { console };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
let src = fs.readFileSync(path.join(ROOT, 'js/gf-roof.js'), 'utf8');
// 插桩：pyramidRoof 的 hipN
const marker1 = 'const hipN = Math.max(4, Math.round(Math.hypot(xe, ze, rise) / 0.22));';
if (src.includes(marker1)) {
  src = src.replace(marker1, 'console.log("[P-R]", JSON.stringify({xe,ze,rise,hipN:Math.max(4, Math.round(Math.hypot(xe, ze, rise)/0.22))})); ' + marker1);
}
// 插桩：beamBetween 在 tag 含垂脊时输出
for (const f of FILES) {
  if (f.endsWith('gf-roof.js')) vm.runInContext(src, ctx, { filename: f });
  else vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}
const GF = ctx.GF;
const mb = new GF.Mesh();
GF.roofs.build(mb, {
  cx: 0, cz: 0, xe: 1.5 + 0.55, ze: 1.5 + 0.55, yb: 3.4, rise: 1.5 * 0.95,
  type: 'pyramid', tile: 'tile', tileB: 'tileB',
  upturn: 0.55, ridgeStyle: 'plain', beasts: 0, finial: true, tag: '鼓楼·顶'
});
console.log('ok triCount=', mb.triCount);