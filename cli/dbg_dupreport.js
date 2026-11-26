/* 完整清单：全部重复对 → (idx0, idx1, src0, src1, 退化?, 间距, 端点坐标) 写入 cli/dup_report.txt */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const { ANCIENT } = require(path.join(ROOT, 'cli/modules.js'));
const FILES = ANCIENT.concat(['js/gf-render.js', 'js/gf-presets.js', 'js/gf-export.js']);
const ctx = { console }; ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of FILES) { const abs = path.isAbsolute(f) ? f : path.join(ROOT, f); vm.runInContext(fs.readFileSync(abs, 'utf8'), ctx, { filename: abs }); }
const GF = ctx.GF;

let callNo = 0;
const rowSrc = [];
const wrap = (name) => {
  const orig = GF.Mesh.prototype[name];
  GF.Mesh.prototype[name] = function (...args) {
    const tag = args.length >= 5 ? args[4] : args.length >= 3 ? args[args.length - 2] : '?';
    this.__cur = name + '#' + (callNo++) + ':' + String(tag);
    orig.apply(this, args);
    this.__cur = null;
  };
};
['prism', 'box', 'taper', 'cyl', 'lathe', 'panel'].forEach(wrap);
const origTri = GF.Mesh.prototype.tri;
GF.Mesh.prototype.tri = function (a, b, c, mat, tag, nrm) { rowSrc[this.mat.length] = this.__cur || null; origTri.call(this, a, b, c, mat, tag, nrm); };
const origQuad = GF.Mesh.prototype.quad;
GF.Mesh.prototype.quad = function (a, b, c, d, mat, tag) { const cur = this.__cur || null; const i0 = this.mat.length; origQuad.call(this, a, b, c, d, mat, tag); rowSrc[i0] = cur; rowSrc[i0 + 1] = cur; };

const mesh = GF.build({ ...GF.getPreset('temple5') });
const V = (t) => { const i = t * 9; return [[mesh.pos[i], mesh.pos[i+1], mesh.pos[i+2]], [mesh.pos[i+3], mesh.pos[i+4], mesh.pos[i+5]], [mesh.pos[i+6], mesh.pos[i+7], mesh.pos[i+8]]]; };
const K = (p) => p.map(x => x.toFixed(3)).join(',');
const key = (tri) => [...tri].map(K).sort().join('|');

const lines = [];
lines.push(`triCount=${mesh.triCount}`);
const seen = new Map();
let dupIdx = 0;
for (let t = 0; t < mesh.triCount; t++) {
  const tri = V(t);
  const k = key(tri);
  if (seen.has(k)) {
    const first = seen.get(k);
    const a = first.tri, b = tri;
    const deg = (t0, t1) => { // test by coordinate equality rounded at 1e-9
      return (t0[0][0]===t0[1][0]&&t0[0][1]===t0[1][1]&&t0[0][2]===t0[1][2]) || (t0[1][0]===t0[2][0]&&t0[1][1]===t0[2][1]&&t0[1][2]===t0[2][2]) || (t0[2][0]===t0[0][0]&&t0[2][1]===t0[0][1]&&t0[2][2]===t0[0][2]);
    };
    const deg0 = deg(a), deg1 = deg(b);
    lines.push(`DUP#${dupIdx++} #${first.t} vs #${t} gap=${t - first.t} dsrc="${rowSrc[first.t] || '(direct)'}" vs "${rowSrc[t] || '(direct)'}" DEG=${deg0 && deg1} tag="${mesh.tag[t]}"
  T0=${K(a[0])} ${K(a[1])} ${K(a[2])}
  T1=${K(b[0])} ${K(b[1])} ${K(b[2])}`);
  } else seen.set(k, { t, tri });
}
fs.writeFileSync(path.join(ROOT, 'cli/dup_report.txt'), lines.join('\n'), 'utf8');
// 汇总
const byTag = {}, bySrc = {};
for (const l of lines) {
  if (!l.startsWith('DUP#')) continue;
  const tg = /tag="([^"]*)"/.exec(l); byTag[`[${tg && tg[1]}]`] = (byTag[`[${tg && tg[1]}]`] || 0) + 1;
  const ds = /dsrc="([^"]*)" vs "([^"]*)"/.exec(l); bySrc[`${ds && ds[1]} <=> ${ds && ds[2]}`] = (bySrc[`${ds && ds[1]} <=> ${ds && ds[2]}`] || 0) + 1;
}
console.log('== 按 tag 汇总 ==');
for (const k of Object.keys(byTag).sort((a,b)=>byTag[b]-byTag[a])) console.log(String(byTag[k]).padStart(5), k);
console.log('== 按来源汇总 ==');
for (const k of Object.keys(bySrc).sort((a,b)=>bySrc[b]-bySrc[a])) console.log(String(bySrc[k]).padStart(5), k);
console.log('\n详细清单已写入 cli/dup_report.txt');