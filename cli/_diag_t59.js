/* 回归：所有预设都能正常构建（验证 axisUnit 的 extraMesh/extraParts 新参数无副作用） */
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
let bad = 0;
for (const name of (GF.presetList || [])) {
  try {
    const r = GF.getPreset(name);
    const m = GF.build(r);
    if (m.triCount <= 0) throw new Error('空网格');
    const d = Object.keys(m._mo || {}).length;
    console.log('OK  ' + name + '   tris=' + m.triCount + '  可拖区间=' + d);
  } catch (e) {
    bad++;
    console.log('ERR ' + name + '  ' + e.message);
  }
}
console.log(bad ? ('有 ' + bad + ' 个预设失败') : '全部预设构建通过');
process.exit(bad ? 1 : 0);