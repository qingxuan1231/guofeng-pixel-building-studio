const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = __dirname;
const { ANCIENT } = require('./cli/modules');
const FILES = ANCIENT.concat(['js/gf-render.js', 'js/gf-presets.js', 'js/gf-export.js']);
function loadGF() {
  const ctx = { console };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  return ctx.GF;
}
const GF = loadGF();

const recipe = GF.getPreset('siheyuan');
console.log('声明 env:', JSON.stringify(recipe.env));
const p1 = GF.build(recipe, { ppm: recipe.render.ppm });
console.log('第一次 build 后 env.auto 条数:', Array.isArray(recipe.env.auto) ? recipe.env.auto.length : 0);
(recipe.env.auto || []).forEach((it, i) => console.log('  auto[' + i + ']', it.k, 'x=' + it.x, 'z=' + it.z));
const p2 = GF.build(recipe, { ppm: recipe.render.ppm });
console.log('第二次 build 后 env.auto 条数:', Array.isArray(recipe.env.auto) ? recipe.env.auto.length : 0);
console.log('moves 数量:', (p2.moves || []).length);
(p2.moves || []).forEach((m) => console.log('  move', m.key, m.label, 'x=' + m.x, 'z=' + m.z));
const counts = {};
(recipe.env.auto || []).forEach((it) => { counts[it.k] = (counts[it.k] || 0) + 1; });
console.log('auto 同款计数:', JSON.stringify(counts));