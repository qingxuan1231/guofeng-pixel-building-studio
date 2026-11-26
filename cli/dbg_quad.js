/* 插桩 prism：对「组件石·冠」精确捕获 triFan 输出的每 segment 三角形，找出重复来源 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const { ANCIENT } = require(path.join(ROOT, 'cli/modules.js'));
const FILES = ANCIENT.concat(['js/gf-render.js', 'js/gf-presets.js', 'js/gf-export.js']);
const ctx = { console }; ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of FILES) { const abs = path.isAbsolute(f) ? f : path.join(ROOT, f); vm.runInContext(fs.readFileSync(abs, 'utf8'), ctx, { filename: abs }); }
const GF = ctx.GF;

// 捕获：记录模块加载时捕获我们插桩后的 mesh class
const origTri = GF.Mesh.prototype.tri;
const origQuad = GF.Mesh.prototype.quad;
const origPrism = GF.Mesh.prototype.prism;
let prismNo = 0;
let seq = 0;

// 复制源码内 triFan 的逻辑无法直接抓闭包，改用顶点分类：
// 在 tri 中记录「每 3 个三角形一组×3」的 (y, x中心依赖) —— y 恒定的水平三角
const rows = [];
GF.Mesh.prototype.tri = function (a, b, c, mat, tag, nrm) {
  const idx = this.mat.length; // 即将 push 的三角形序号
  origTri.call(this, a, b, c, mat, tag, nrm);
  const n0 = nrm || GF.V.norm(GF.V.cross(GF.V.sub(b, a), GF.V.sub(c, a)));
  rows.push({ idx, a, b, c, n0, tag });
};
// 注意 GF.Mesh.prototype.quad 内调 this.tri → 会被 hook
GF.Mesh.prototype.quad = function (a, b, c, d, mat, tag) {
  const n = GF.V.norm(GF.V.cross(GF.V.sub(b, a), GF.V.sub(d, a)));
  origTri.call(this, a, b, c, mat, tag, n);
  origTri.call(this, a, c, d, mat, tag, n);
};
const mesh = GF.build({ ...GF.getPreset('temple5') });
// rows 现在记录了顺序；但 build 期间 hook 的 rows 是按构建顺序 push 的（与 mesh 的 push 同步）
// 取构建顺序中 triangle idx 18000~18300 的 rows 打印
const R = rows.filter(r => r.idx >= 18170 && r.idx <= 18260);
for (const r of R) {
  const mb = r.tag && r.tag.includes('组件石');
  console.log(`#${r.idx} nrm=(${r.n0.map(v=>v.toFixed(2)).join(',')}) ${r.tag} ${[r.a,r.b,r.c].map(p=>`(${p.map(v=>v.toFixed(3)).join(',')})`).join(' ')}`);
}
console.log('rows 总数 =', rows.length, ' mesh triCount =', mesh.triCount);