/* 探针：大雄宝殿台基 vs 殿身包围盒 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = __dirname;
const { ANCIENT } = require(path.join(ROOT, 'cli/modules.js'));
const FILES = ANCIENT.concat(['js/gf-render.js', 'js/gf-presets.js', 'js/gf-export.js']);
const ctx = { console }; ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
const GF = ctx.GF;

function boundsOf(mesh, re) {
  const bb = { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9, z0: 1e9, z1: -1e9, tris: 0 };
  for (let t = 0; t < mesh.triCount; t++) {
    const tag = mesh.tag[t] || '';
    if (!re.test(tag)) continue;
    for (let k = 0; k < 3; k++) {
      const x = mesh.pos[t * 9 + k * 3], y = mesh.pos[t * 9 + k * 3 + 1], z = mesh.pos[t * 9 + k * 3 + 2];
      bb.x0 = Math.min(bb.x0, x); bb.x1 = Math.max(bb.x1, x);
      bb.y0 = Math.min(bb.y0, y); bb.y1 = Math.max(bb.y1, y);
      bb.z0 = Math.min(bb.z0, z); bb.z1 = Math.max(bb.z1, z);
    }
    bb.tris++;
  }
  return bb;
}
const mesh = GF.build(GF.getPreset('temple5'), { ppm: 120 });
console.log('temple5 tris', mesh.triCount);
for (const [name, re] of [
  ['大雄台基', /大雄台基/],
  ['大雄月台', /大雄月台/],
  ['月台台面', /月台台面/],
  ['月台踏跺', /月台踏跺/],
  ['月台栏', /月台栏/],
  ['大雄宝殿(殿身)', /大雄宝殿/],
]) {
  const b = boundsOf(mesh, re);
  if (b.tris) console.log(`${name}: x[${b.x0.toFixed(2)},${b.x1.toFixed(2)}] y[${b.y0.toFixed(2)},${b.y1.toFixed(2)}] z[${b.z0.toFixed(2)},${b.z1.toFixed(2)}] tris=${b.tris}`);
  else console.log(name + ': 无');
}