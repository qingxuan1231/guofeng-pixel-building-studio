/* 精确归属：给每次 prism/box/taper/cyl/lathe/panel 调用设 __cur 标记，
 * tri/quad 时记录来源标记，从而判定重复三角形是「同一调用内部」还是「不同调用重叠」 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const { ANCIENT } = require(path.join(ROOT, 'cli/modules.js'));
const FILES = ANCIENT.concat(['js/gf-render.js', 'js/gf-presets.js', 'js/gf-export.js']);
const ctx = { console }; ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of FILES) { const abs = path.isAbsolute(f) ? f : path.join(ROOT, f); vm.runInContext(fs.readFileSync(abs, 'utf8'), ctx, { filename: abs }); }
const GF = ctx.GF;

let callNo = 0;
const callLog = []; // {no, kind, tag, t0, t1}
const rowSrc = [];   // idx -> 'kind#no:tag' or '(direct)'

const wrap = (name) => {
  const orig = GF.Mesh.prototype[name];
  GF.Mesh.prototype[name] = function (...args) {
    const tag = args.length >= 2 ? args[args.length - 2] : args[args.length - 1];
    const t0 = this.mat.length;
    this.__cur = name + '#' + (callNo++) + ':' + (tag || '?');
    orig.apply(this, args);
    this.__cur = null;
    callLog.push({ no: callNo - 1, kind: name, tag: String(tag), t0, t1: this.mat.length });
  };
};
['prism', 'box', 'taper', 'cyl', 'lathe', 'panel'].forEach(wrap);

const origTri = GF.Mesh.prototype.tri;
GF.Mesh.prototype.tri = function (a, b, c, mat, tag, nrm) {
  const idx = this.mat.length;
  rowSrc[idx] = this.__cur || null;
  origTri.call(this, a, b, c, mat, tag, nrm);
};
const origQuad = GF.Mesh.prototype.quad;
GF.Mesh.prototype.quad = function (a, b, c, d, mat, tag) {
  const idx = this.mat.length;
  const cur = this.__cur || null;
  rowSrc[idx] = cur;
  origQuad.call(this, a, b, c, d, mat, tag);
  rowSrc[idx + 1] = (this.__cur || null) === cur ? cur : (this.__cur || null);
};

const mesh = GF.build({ ...GF.getPreset('temple5') });
const V = (t) => { const i = t * 9; return [[mesh.pos[i], mesh.pos[i+1], mesh.pos[i+2]], [mesh.pos[i+3], mesh.pos[i+4], mesh.pos[i+5]], [mesh.pos[i+6], mesh.pos[i+7], mesh.pos[i+8]]]; };
const K = (p) => Math.round(p[0]*1000)+','+Math.round(p[1]*1000)+','+Math.round(p[2]*1000);
const seen = new Map();
const report = {};
let nDup = 0;
for (let t = 0; t < mesh.triCount; t++) {
  const tri = V(t);
  const k = [K(tri[0]), K(tri[1]), K(tri[2])].sort().join('|');
  const s1 = rowSrc[t] || '(direct)';
  if (seen.has(k)) {
    nDup++;
    const s0 = seen.get(k).src;
    const key = `${s1} <-> ${s0}`;
    report[key] = report[key] || { n: 0, t0: seen.get(k).t, t1: t, tag: mesh.tag[t] };
    report[key].n++;
  } else seen.set(k, { t, src: s1 });
}
console.log('完全重复对总数 =', nDup);
const ks = Object.keys(report).sort((a, b) => report[b].n - report[a].n);
for (const key of ks.slice(0, 30)) {
  const r = report[key];
  console.log(`${r.n.toString().padStart(4)} x  ${key}  例: #${r.t0} #${r.t1} ${r.tag}`);
}
// 查看 #18198 #18199 #18200 归属
for (const t of [18190, 18198, 18199, 18200]) {
  console.log(`#${t} src=${rowSrc[t]} tag=${mesh.tag[t]}`);
}
// 单独统计 组件石·冠 的调用明细
console.log('\n组件石·冠 prism 调用：');
callLog.filter(c => String(c.tag).includes('组件石')).forEach(c =>
  console.log(`${c.kind}#${c.no} t=${c.tag} tris=[${c.t0},${c.t1}) n=${c.t1 - c.t0}`));