/* 临时诊断：验证大雄宝殿月台顶面高度与台基生效高度完全联动。
 * 1) 默认高度：台基 baseH=0.75，月台台面应在 y≈0.75；
 * 2) 用户把「台基高」override 成 1.2，月台台面应在 y≈1.2；
 * 3) 用户把「台基高」override 成 0.35，月台台面应在 y≈0.35；
 * 通过扫描『月台台面』三角顶点高度判断，误差 < 1e-3。 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
const { ANCIENT } = require('./modules');
const FILES = ANCIENT.concat(['js/gf-render.js', 'js/gf-presets.js', 'js/gf-export.js']);
const ctx = { console };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
const GF = ctx.GF;

function terraceTopY(unitsOverride) {
  const recipe = JSON.parse(JSON.stringify(GF.getPreset('temple5')));
  recipe.units = recipe.units || {};
  delete recipe.units['大雄宝殿'];
  if (unitsOverride) recipe.units['大雄宝殿'] = JSON.parse(JSON.stringify(unitsOverride));
  const mesh = GF.build(recipe);
  const pos = mesh.pos, tag = mesh.tag;
  let yMax = -1e9, cnt = 0;
  for (let i = 0; i < tag.length; i++) {
    if (tag[i] && tag[i].indexOf('月台台面') === 0) {
      cnt++;
      yMax = Math.max(yMax, pos[i * 9 + 1], pos[i * 9 + 4], pos[i * 9 + 7]);
    }
  }
  const base = (mesh.units || []).filter((u) => u.id === '大雄宝殿')[0];
  const baseBox = base && base.parts && base.parts.base;
  return {
    terraceTopY: cnt ? yMax : NaN, cnt,
    baseY0: baseBox ? baseBox.y0 : NaN, baseY1: baseBox ? baseBox.y1 : NaN
  };
}

const cases = [
  { name: '默认(0.75)', ov: undefined, expect: 0.75 },
  { name: '台基高=1.2', ov: { baseH: 1.2 }, expect: 1.2 },
  { name: '台基高=0.35', ov: { baseH: 0.35 }, expect: 0.35 },
  { name: '台基高+月台面阔/进深', ov: { baseH: 0.92, terraceW: 8.3, terraceD: 1.0 }, expect: 0.92 }
];
let allOk = true;
for (const c of cases) {
  const r = terraceTopY(c.ov);
  const err = Math.abs(r.terraceTopY - c.expect);
  const baseErr = Math.abs(r.baseY1 - c.expect);
  const ok = err < 1e-3 && baseErr < 1e-3;
  allOk = allOk && ok;
  console.log((ok ? 'PASS' : 'FAIL'), c.name,
    '| 月台顶 y=' + r.terraceTopY.toFixed(3), '(期望', c.expect + ')',
    '| 台基顶 y=' + r.baseY1.toFixed(3), '| 月台台面块数=' + r.cnt);
}
console.log(allOk ? '=== ALL PASS ===' : '=== HAS FAILURE ===');