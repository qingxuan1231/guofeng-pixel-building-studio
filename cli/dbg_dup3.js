/* 检查 116632..116792 区间（含一对重复）的 tag 序列与顶点模式 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const { ANCIENT } = require(path.join(ROOT, 'cli/modules.js'));
const FILES = ANCIENT.concat(['js/gf-render.js', 'js/gf-presets.js', 'js/gf-export.js']);
const ctx = { console }; ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of FILES) { const abs = path.isAbsolute(f) ? f : path.join(ROOT, f); vm.runInContext(fs.readFileSync(abs, 'utf8'), ctx, { filename: abs }); }
const GF = ctx.GF;
const mesh = GF.build({ ...GF.getPreset('temple5') });
const P = (t) => {
  const i = t * 9;
  return [[mesh.pos[i], mesh.pos[i+1], mesh.pos[i+2]], [mesh.pos[i+3], mesh.pos[i+4], mesh.pos[i+5]], [mesh.pos[i+6], mesh.pos[i+7], mesh.pos[i+8]]];
};
// 打印 116600..116740 每个三角形的 tag 与前 2 顶点
for (let t = 116610; t < 116740; t += 2) {
  const v = P(t);
  const tag = mesh.tag[t] || '';
  console.log(`#${t} ${tag.padEnd(14)} (${v[0].map(x=>x.toFixed(2))}) (${v[1].map(x=>x.toFixed(2))})`);
}