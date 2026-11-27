const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;
const { ANCIENT } = require('./cli/modules');
const FILES = ANCIENT.concat(['js/gf-render.js', 'js/gf-presets.js', 'js/gf-export.js']);

function loadGF() {
  const ctx = { console };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of FILES) {
    const code = fs.readFileSync(path.join(ROOT, f), 'utf8');
    vm.runInContext(code, ctx, { filename: f });
  }
  return ctx.GF;
}
const GF = loadGF();

const COURT = [
  ['siheyuan', '宅院·怡红院式'],
  ['yuanlin', '园林·叠山理水'],
  ['siyuan', '寺院·山门大殿'],
  ['temple5', '寺·五进中轴'],
  ['daoguan', '道观·中路紧凑'],
  ['wujin', '五进四合院'],
  ['langyuan', '廊院式祠庙'],
  ['jiafu', '贾府·前府后园']
];

for (const [key, name] of COURT) {
  const recipe = GF.getPreset(key);
  GF.build(recipe, { ppm: recipe.render ? recipe.render.ppm : 0 });
  const auto = recipe.env.auto || [];
  const items = recipe.env.items || [];
  const m = new Map();
  auto.concat(items).forEach((it) => m.set(it.k, (m.get(it.k) || 0) + 1));
  const parts = [...m.entries()].map(([k, n]) => k + ':' + n).join(' ');
  console.log(key, '(', name, ') 共', auto.length + items.length, '件 →', parts);
  // 每个硬渲染件是否都带 abs 锚点或有明确坐标
  const noAbs = auto.filter((it) => it.abs !== true && !(it.x != null && it.z != null));
  if (noAbs.length) console.log('   [无落位]', noAbs.map((x) => x.k).join(' '));
}