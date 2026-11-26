// 综合验证：① 四类屋顶山花闭合（无空洞）② 围墙细分均匀（无大三角/大方框）
const path = require('path'), vm = require('vm'), fs = require('fs');
const ROOT = path.join(__dirname, '..');
const { ANCIENT } = require('./modules');
const FILES = ANCIENT.concat(['js/gf-render.js', 'js/gf-presets.js', 'js/gf-export.js']);
const ctx = { console };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
const GF = ctx.GF;

function filter(mesh, re) {
  const m = new GF.Mesh();
  for (let t = 0; t < mesh.triCount; t++) {
    if (!re.test(mesh.tag[t])) continue;
    const i = t * 9;
    m.tri([mesh.pos[i], mesh.pos[i+1], mesh.pos[i+2]], [mesh.pos[i+3], mesh.pos[i+4], mesh.pos[i+5]],
          [mesh.pos[i+6], mesh.pos[i+7], mesh.pos[i+8]], mesh.mat[t], mesh.tag[t]);
  }
  return m;
}

// ---------- ① 山花闭合：世界空间 yz 正投影栅格 ----------
function checkGableCover(pre, roofType) {
  const m = GF.build({ ...pre, roofType });
  const fm = filter(m, /山花/);
  // 分左右面（x>0 / x<0），取左面
  const tris = [];
  for (let t = 0; t < fm.triCount; t++) {
    const i = t * 9;
    const v = [[fm.pos[i], fm.pos[i+1], fm.pos[i+2]], [fm.pos[i+3], fm.pos[i+4], fm.pos[i+5]], [fm.pos[i+6], fm.pos[i+7], fm.pos[i+8]]];
    if (v[0][0] < -0.01) tris.push(v);
  }
  if (!tris.length) return { roofType, tri: 0, solid: 0, total: 0 };
  // 计算左右面 yz 包围盒并栅格化 96x48
  let z0 = 1e9, z1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const v of tris) for (const p of v) {
    if (p[2] < z0) z0 = p[2]; if (p[2] > z1) z1 = p[2];
    if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1];
  }
  const W = 96, H = 48;
  const grid = new Uint8Array(W * H);
  const inTri = (px, py, a, b, c) => {
    const d1 = (px - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (py - b[1]);
    const d2 = (px - c[0]) * (b[1] - c[1]) - (b[0] - c[0]) * (py - c[1]);
    const d3 = (px - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (py - a[1]);
    const hasNeg = d1 < 0 || d2 < 0 || d3 < 0, hasPos = d1 > 0 || d2 > 0 || d3 > 0;
    return !(hasNeg && hasPos);
  };
  for (const v of tris) {
    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        const z = c / (W - 1) * (z1 - z0) + z0;
        const y = y1 - r / (H - 1) * (y1 - y0);
        if (inTri(z, y, [v[0][2], v[0][1]], [v[1][2], v[1][1]], [v[2][2], v[2][1]])) grid[r * W + c] = 1;
      }
    }
  }
  let solid = 0, total = 0;
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      total++;
      if (grid[r * W + c]) solid++;
    }
  }
  // 内部空洞检测：从四边洪水填充空白格（外部），剩下的空白格即被覆盖包围的内部空洞。
  const isOut = new Uint8Array(W * H);
  const q = [];
  for (let c = 0; c < W; c++) { q.push([0, c]); q.push([H - 1, c]); }
  for (let r = 0; r < H; r++) { q.push([r, 0]); q.push([r, W - 1]); }
  while (q.length) {
    const [r, c] = q.pop();
    if (r < 0 || c < 0 || r >= H || c >= W) continue;
    if (grid[r * W + c] || isOut[r * W + c]) continue;
    isOut[r * W + c] = 1;
    q.push([r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]);
  }
  let holes = 0;
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      if (!grid[r * W + c] && !isOut[r * W + c]) holes++;
    }
  }
  return { roofType, tri: tris.length, solid, total, fill: Math.round(solid / total * 100) + '%', holes };
}

const pre = GF.getPreset('jiangnan');
// 悬山/硬山/卷棚/歇山四类；庑殿(hip)四坡无侧山花，不在山花闭合验证范围
const types = ['gable', 'gableHard', 'roll', 'gableHip'];
console.log('===== ① 山花闭合检测（左侧山花，世界空间 yz 栅格） =====');
for (const rt of types) {
  const r = checkGableCover(pre, rt);
  console.log(`  ${rt.padEnd(10)} 三角形=${r.tri}  覆盖像素=${r.solid}/${r.total} (${r.fill})  内部空洞像素=${r.holes}`);
}

// ---------- ①b 山花网格边长：三角面片最长边（行带网格应 ≤ ~0.31m） ----------
function gableEdges(pre, roofType) {
  const m = GF.build({ ...pre, roofType });
  const fm = filter(m, /山花/);
  let maxE = 0, maxTag = '', big = 0;
  for (let t = 0; t < fm.triCount; t++) {
    const i = t * 9;
    const A = [fm.pos[i], fm.pos[i+1], fm.pos[i+2]];
    const B = [fm.pos[i+3], fm.pos[i+4], fm.pos[i+5]];
    const C = [fm.pos[i+6], fm.pos[i+7], fm.pos[i+8]];
    const e = (p, q) => Math.hypot(p[0]-q[0], p[1]-q[1], p[2]-q[2]);
    const mx = Math.max(e(A,B), e(B,C), e(C,A));
    if (mx > maxE) { maxE = mx; maxTag = fm.tag[t]; }
    if (mx > 0.55) big++;
  }
  return { maxE: maxE.toFixed(3), maxTag, big };
}
console.log('①b 山花网格最长边（目标 ≤~0.31m，无 >0.55m）');
for (const rt of types) {
  const e = gableEdges(pre, rt);
  console.log(`  ${rt.padEnd(10)} 最长边=${e.maxE}m (${e.maxTag})  超过0.55m=${e.big}`);
}

// ---------- ①c 全量大三角扫描：所有 tag 的 ==0.55m+ 来源 ----------
function scanBig(pre, label) {
  const m = GF.build({ ...pre });
  const byTag = {};
  let maxE = 0, maxTag = '', n = 0;
  for (let t = 0; t < m.triCount; t++) {
    const i = t * 9;
    const A = [m.pos[i], m.pos[i+1], m.pos[i+2]];
    const B = [m.pos[i+3], m.pos[i+4], m.pos[i+5]];
    const C = [m.pos[i+6], m.pos[i+7], m.pos[i+8]];
    const e = (p, q) => Math.hypot(p[0]-q[0], p[1]-q[1], p[2]-q[2]);
    const mx = Math.max(e(A,B), e(B,C), e(C,A));
    if (mx > maxE) { maxE = mx; maxTag = m.tag[t]; }
    if (mx > 0.55) byTag[m.tag[t]] = (byTag[m.tag[t]] || 0) + 1;
    n++;
  }
  console.log(`  ${label}: 三角形=${n}  最长边=${maxE.toFixed(3)}m (${maxTag})  超过0.55m=${Object.keys(byTag).length ? Object.entries(byTag).reduce((a,b)=>a+b[1],0) : 0}`);
  for (const k of Object.keys(byTag)) console.log(`      >0.55m tag: ${k}  ×${byTag[k]}`);
  return byTag;
}
console.log('①c 全构件大三角扫描（temple5 含门顶）');
scanBig(GF.getPreset('temple5'), 'temple5 全景');

// ---------- ② 围墙细分：无洞长段不应出现大 quad ----------
function checkWall(pre) {
  const fm = filter(GF.build({ ...pre }), /院墙/);
  let maxEdge = 0, bigEdge = 0, n = 0;
  for (let t = 0; t < fm.triCount; t++) {
    const i = t * 9;
    const A = [fm.pos[i], fm.pos[i+1], fm.pos[i+2]];
    const B = [fm.pos[i+3], fm.pos[i+4], fm.pos[i+5]];
    const C = [fm.pos[i+6], fm.pos[i+7], fm.pos[i+8]];
    const e = (p, q) => Math.hypot(p[0]-q[0], p[1]-q[1], p[2]-q[2]);
    const mx = Math.max(e(A,B), e(B,C), e(C,A));
    if (mx > maxEdge) maxEdge = mx;
    if (mx > 0.55) bigEdge++;
    n++;
  }
  return { n, maxEdge: maxEdge.toFixed(3), bigEdge };
}

// 用 checkWall 确认墙的三角规模（用四合院配方，含院墙）
const court = GF.getPreset('siheyuan');
const { n: wallTris, maxEdge: maxE, bigEdge: big } = checkWall(court);
console.log('');
console.log('===== ② 围墙细分检测（siheyuan 四合院院墙） =====');
console.log(`  院墙三角形数=${wallTris}  最长边=${maxE}m  超过 0.55m 的三角形=${big}`);
console.log('  修复目标：最长边应 ≤ ~0.45m（0.22m×2 对角），不存在 0.55m 以上大三角/大方框');
// 大三角的来源分布
const fmw = filter(court && GF.build({ ...court }), /院墙/);
const tagCount = {};
for (let t = 0; t < fmw.triCount; t++) {
  const i = t * 9;
  const A = [fmw.pos[i], fmw.pos[i+1], fmw.pos[i+2]];
  const B = [fmw.pos[i+3], fmw.pos[i+4], fmw.pos[i+5]];
  const C = [fmw.pos[i+6], fmw.pos[i+7], fmw.pos[i+8]];
  const e = (p, q) => Math.hypot(p[0]-q[0], p[1]-q[1], p[2]-q[2]);
  const mx = Math.max(e(A,B), e(B,C), e(C,A));
  if (mx > 0.55) tagCount[fmw.tag[t]] = (tagCount[fmw.tag[t]] || 0) + 1;
}
for (const k of Object.keys(tagCount)) console.log(`    大三角 tag: ${k}  ×${tagCount[k]}`);
// 打印所有 >0.45m 的三角形的来源，确认压顶/脊不再贡献
const big45 = {};
for (let t = 0; t < fmw.triCount; t++) {
  const i = t * 9;
  const A = [fmw.pos[i], fmw.pos[i+1], fmw.pos[i+2]];
  const B = [fmw.pos[i+3], fmw.pos[i+4], fmw.pos[i+5]];
  const C = [fmw.pos[i+6], fmw.pos[i+7], fmw.pos[i+8]];
  const e = (p, q) => Math.hypot(p[0]-q[0], p[1]-q[1], p[2]-q[2]);
  const mx = Math.max(e(A,B), e(B,C), e(C,A));
  if (mx > 0.45) big45[fmw.tag[t]] = (big45[fmw.tag[t]] || 0) + 1;
}
console.log('  >0.45m 三角形来源：', JSON.stringify(big45));

// ---------- ③ 隔墙细分：crossWall 墙身与压顶/脊 ----------
function checkTags(pre, re, label) {
  const fm = filter(GF.build({ ...pre }), re);
  let maxEdge = 0, bigEdge = 0, n = 0;
  const byTag = {};
  for (let t = 0; t < fm.triCount; t++) {
    const i = t * 9;
    const A = [fm.pos[i], fm.pos[i+1], fm.pos[i+2]];
    const B = [fm.pos[i+3], fm.pos[i+4], fm.pos[i+5]];
    const C = [fm.pos[i+6], fm.pos[i+7], fm.pos[i+8]];
    const e = (p, q) => Math.hypot(p[0]-q[0], p[1]-q[1], p[2]-q[2]);
    const mx = Math.max(e(A,B), e(B,C), e(C,A));
    if (mx > maxEdge) maxEdge = mx;
    if (mx > 0.55) {
      bigEdge++;
      byTag[fm.tag[t]] = (byTag[fm.tag[t]] || 0) + 1;
    }
    n++;
  }
  console.log(`  ${label}: 三角形数=${n}  最长边=${maxEdge.toFixed(3)}m  超过 0.55m=${bigEdge}`);
  for (const k of Object.keys(byTag)) console.log(`      >0.55m tag: ${k}  ×${byTag[k]}`);
  return { n, maxEdge: maxEdge.toFixed(3), bigEdge };
}
console.log('');
console.log('===== ③ 隔墙/自砌围墙细分（crossWall + wujin 院墙） =====');
checkTags(GF.getPreset('temple5'), /隔墙/, 'temple5 一进隔墙等');
checkTags(GF.getPreset('wujin'), /院墙/, 'wujin 五进四合院自砌院墙');
checkTags(GF.getPreset('jiafu'), /隔墙|院墙/, 'jiafu 府园隔墙+院墙');

// ---------- ④ 马头墙 ----------
console.log('');
console.log('===== ④ 马头墙（老屋封火山墙） =====');
try {
  const m4 = new GF.Mesh();
  const mhw = { cx: 0, z: 0, halfLen: 3.2, y0: 0, yTop: 2.8, steps: 3, depth: 0.28 };
  GF.parts.horseHeadWall(m4, mhw);
  const fr = filter(m4, /马头墙/);
  let maxE4 = 0;
  for (let t = 0; t < fr.triCount; t++) {
    const i = t * 9;
    const A = [fr.pos[i], fr.pos[i+1], fr.pos[i+2]];
    const B = [fr.pos[i+3], fr.pos[i+4], fr.pos[i+5]];
    const C = [fr.pos[i+6], fr.pos[i+7], fr.pos[i+8]];
    const e = (p, q) => Math.hypot(p[0]-q[0], p[1]-q[1], p[2]-q[2]);
    maxE4 = Math.max(maxE4, e(A,B), e(B,C), e(C,A));
  }
  console.log(`  马头墙：三角形数=${fr.triCount}  最长边=${maxE4.toFixed(3)}m`);
} catch (e) { console.log('  马头墙验证跳过：' + e.message); }

// ---------- ⑤ 影壁（墙身/座/顶/脊全部 0.22m 细分） ----------
console.log('');
console.log('===== ⑤ 影壁细分检测 =====');
try {
  const m5 = new GF.Mesh();
  GF.parts.yingbi(m5, { cx: 0, cz: 0, w: 3.2, h: 2.4 });
  const fr = filter(m5, /影壁/);
  let maxE5 = 0, maxTag5 = '';
  const byTag5 = {};
  for (let t = 0; t < fr.triCount; t++) {
    const i = t * 9;
    const A = [fr.pos[i], fr.pos[i+1], fr.pos[i+2]];
    const B = [fr.pos[i+3], fr.pos[i+4], fr.pos[i+5]];
    const C = [fr.pos[i+6], fr.pos[i+7], fr.pos[i+8]];
    const e = (p, q) => Math.hypot(p[0]-q[0], p[1]-q[1], p[2]-q[2]);
    const mx = Math.max(e(A,B), e(B,C), e(C,A));
    if (mx > 0.55) byTag5[fr.tag[t]] = Math.max(byTag5[fr.tag[t]] || 0, mx);
    if (mx > maxE5) { maxE5 = mx; maxTag5 = fr.tag[t]; }
  }
  console.log(`  影壁：三角形数=${fr.triCount}  最长边=${maxE5.toFixed(3)}m  (${maxTag5})`);
  for (const k of Object.keys(byTag5)) console.log(`      >0.55m tag: ${k}  最大=${byTag5[k].toFixed(3)}m`);
} catch (e) { console.log('  影壁验证跳过：' + e.message); }

// 输出到文件供查看
const out = [];
out.push('===== ① 山花闭合 =====');
for (const rt of types) out.push(`  ${rt}: ${JSON.stringify(checkGableCover(pre, rt))}`);
out.push('===== ①b 山花网格最长边 =====');
for (const rt of types) out.push(`  ${rt}: ${JSON.stringify(gableEdges(pre, rt))}`);
out.push('===== ①c temple5 全量扫描 =====');
out.push(`  ${JSON.stringify(scanBig(GF.getPreset('temple5'), 'temple5'))}`);
out.push('===== ② 围墙细分 =====');
out.push(`  院墙三角形数=${wallTris}  最长边=${maxE}m  超过0.55m=${big}`);
out.push('===== ③ 隔墙/自砌 =====');
out.push(`  temple5 隔墙: ${JSON.stringify(checkTags(GF.getPreset('temple5'), /隔墙/, ''))}`);
out.push(`  wujin 院墙: ${JSON.stringify(checkTags(GF.getPreset('wujin'), /院墙/, ''))}`);
fs.writeFileSync(path.join(ROOT, 'cli', '_verify_fixes.txt'), out.join('\n'));
console.log('详情已写入 cli/_verify_fixes.txt');