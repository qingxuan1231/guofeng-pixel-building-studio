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

// 精确边水密性：量化顶点坐标 → 无向边计数。闭合三角网格内部边应恰好被 2 个三角共享，
// 边界边应恰好 1 次。出现「应内部却只 1 次」的边即裂缝/洞；出现 3+ 次即自交重叠。
function edgeHealth(mesh, tagRe) {
  const P = mesh.pos, M = mesh.mat, T = mesh.tag;
  const edgeCnt = new Map();
  const triEdges = [];
  const fmt = (v) => [v[0], v[1], v[2]].map((x) => (Math.round(x * 1e6) / 1e6).toFixed(6)).join(',');
  for (let t = 0; t < mesh.triCount; t++) {
    if (!tagRe.test(T[t])) continue;
    const i = t * 9;
    const a = [P[i], P[i + 1], P[i + 2]], b = [P[i + 3], P[i + 4], P[i + 5]], c = [P[i + 6], P[i + 7], P[i + 8]];
    const es = [[fmt(a), fmt(b)], [fmt(b), fmt(c)], [fmt(c), fmt(a)]];
    triEdges.push(es);
    for (const [u, v] of es) {
      const key = u < v ? u + '|' + v : v + '|' + u;
      edgeCnt.set(key, (edgeCnt.get(key) || 0) + 1);
    }
  }
  let single = 0, multi = 0, total = 0;
  for (const [_, n] of edgeCnt) {
    total++;
    if (n === 1) single++;
    else if (n >= 3) multi++;
  }
  // 找「只被 1 个三角引用的内部边」：每个三角形自己的边界边，先按三角形统计
  const isolated = [];
  const seen = new Set();
  for (let ti = 0; ti < triEdges.length; ti++) {
    for (const [u, v] of triEdges[ti]) {
      const key = u < v ? u + '|' + v : v + '|' + u;
      if (edgeCnt.get(key) === 1 && !seen.has(ti + ':' + key)) {
        seen.add(ti + ':' + key);
        isolated.push(key);
      }
    }
  }
  return { total, single, multi, isolated: isolated.length };
}

function reportEdges(name, mesh, re) {
  const e = edgeHealth(mesh, re);
  console.log(`  ${name}: 边=${e.total} 单引用(边界/裂缝)=${e.single} 三引用(自交)=${e.multi} 孤立边=${e.isolated}`);
}

// 对指定 tag 的山花三角做几何体检：零面积/退化为线段/轮廓是否闭合到墙脚
function gableHealth(mesh, tagRe) {
  const P = mesh.pos, T = mesh.tag;
  const tris = [];
  for (let t = 0; t < mesh.triCount; t++) {
    if (!tagRe.test(T[t])) continue;
    const i = t * 9;
    tris.push([
      [P[i], P[i + 1], P[i + 2]],
      [P[i + 3], P[i + 4], P[i + 5]],
      [P[i + 6], P[i + 7], P[i + 8]]
    ]);
  }
  // 拉平所有边：每条边按 (a,b) 排序哈希计数——闭合多面体每条边被恰好两个三角共享
  const edgeCnt = new Map();
  for (const [a, b, c] of tris) {
    for (const [u, v] of [[a, b], [b, c], [c, a]]) {
      const key = [Math.min(u[1], v[1]), Math.max(u[1], v[1])].join(',');   // 以高度表征水平边
      edgeCnt.set(key, (edgeCnt.get(key) || 0) + 1);
    }
  }
  let minArea = Infinity, minH = Infinity, maxH = -Infinity;
  let bad = 0, openEdges = 0;
  for (const [a, b, c] of tris) {
    const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2];
    const acx = c[0] - a[0], acy = c[1] - a[1], acz = c[2] - a[2];
    const nx = aby * acz - abz * acy, ny = abz * acx - abx * acz, nz = abx * acy - aby * acx;
    const area = 0.5 * Math.hypot(nx, ny, nz);
    if (area < 1e-9) bad++;
    if (area < minArea) minArea = area;
    for (const p of [a, b, c]) { if (p[1] < minH) minH = p[1]; if (p[1] > maxH) maxH = p[1]; }
  }
  for (const [k, n] of edgeCnt) {
    if (n === 1) openEdges++;   // 只被一个三角引用的边 → 洞口边（合法：屋脊天沟/瓦口边也算），仅统计非水平边
  }
  return { n: tris.length, bad, minArea, minH, maxH, openEdges };
}

for (const [name, mod] of [
  ['悬山', { roofType: 'gable' }],
  ['硬山', { roofType: 'gableHard' }],
  ['卷棚悬山', { roofType: 'roll' }],
  ['卷棚硬山', { roofType: 'roll', roofHard: true }],
  ['歇山', { roofType: 'gableHip' }],
]) {
  const m = GF.build({ ...pre, ...mod });
  const tm = tagMaxX(m);
  const roofTags = Object.entries(tm)
    .filter(([t]) => /坡|檐|山花|博风|瓦当|元宝/.test(t))
    .sort((a, b) => b[1].maxX - a[1].maxX)
    .slice(0, 8);
  console.log('---', name);
  for (const [t, v] of roofTags) console.log('   ', t, 'maxX=', v.maxX.toFixed(2), 'mat=', v.mat);
  const gh = gableHealth(m, /山花/);
  console.log('   山花体检: tri=', gh.n, '零面积=', gh.bad, 'minArea=', gh.minArea.toExponential(1),
    '高区间=', gh.minH.toFixed(2) + '..' + gh.maxH.toFixed(2), '镂空边=', gh.openEdges);
  reportEdges('山花边', m, /山花/);
  reportEdges('博风边', m, /博风/);
  reportEdges('屋面边', m, /屋面|瓦|坡/);
  reportEdges('围墙边', m, /院墙/);
}