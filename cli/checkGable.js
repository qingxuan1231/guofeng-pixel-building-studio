const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
const { ANCIENT } = require('./modules');
const FILES = ANCIENT.concat(['js/gf-render.js', 'js/gf-presets.js', 'js/gf-export.js']);
const ctx = { console };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of FILES) {
  const code = require('fs').readFileSync(path.join(ROOT, f), 'utf8');
  vm.runInContext(code, ctx, { filename: f });
}
const GF = ctx.GF;

function tagMaxX(mesh) {
  const P = mesh.pos, M = mesh.mat, T = mesh.tag;
  const out = {};
  for (let t = 0; t < mesh.triCount; t++) {
    const tag = T[t];
    const i = t * 9;
    for (let k = 0; k < 3; k++) {
      const ax = Math.abs(P[i + k * 3]);
      if (!out[tag]) out[tag] = { maxX: 0, mat: M[t] };
      if (ax > out[tag].maxX) out[tag].maxX = ax;
    }
  }
  return out;
}

const pre = GF.getPreset('jiangnan');
for (const [name, mod] of [
  ['悬山', { roofType: 'gable' }],
  ['硬山', { roofType: 'gableHard' }],
  ['卷棚悬山', { roofType: 'roll' }],
  ['卷棚硬山', { roofType: 'roll', roofHard: true }],
]) {
  const m = GF.build({ ...pre, ...mod });
  const tm = tagMaxX(m);
  const roofTags = Object.entries(tm)
    .filter(([t]) => /坡|檐|山花|博风|瓦当|元宝/.test(t))
    .sort((a, b) => b[1].maxX - a[1].maxX)
    .slice(0, 8);
  console.log('---', name);
  for (const [t, v] of roofTags) console.log('   ', t, 'maxX=', v.maxX.toFixed(2), 'mat=', v.mat);
}