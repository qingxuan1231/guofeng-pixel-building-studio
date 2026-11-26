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

// 克隆 mesh 并按 tag 过滤
function filter(mesh, re) {
  const m = new GF.Mesh();
  for (let t = 0; t < mesh.triCount; t++) {
    if (!re.test(mesh.tag[t])) continue;
    const i = t * 9;
    const a = [mesh.pos[i], mesh.pos[i + 1], mesh.pos[i + 2]];
    const b = [mesh.pos[i + 3], mesh.pos[i + 4], mesh.pos[i + 5]];
    const c = [mesh.pos[i + 6], mesh.pos[i + 7], mesh.pos[i + 8]];
    m.tri(a, b, c, mesh.mat[t], mesh.tag[t]);
  }
  return m;
}

function alphaOf(frame) {
  const { w, h, rgba } = frame;
  const a = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) a[i] = rgba[i * 4 + 3] > 0 ? 1 : 0;
  return a;
}
// 透明像素且 8 邻域中不透明邻居 >= 4 → 洞
function findHoles(frame) {
  const a = alphaOf(frame);
  const { w, h } = frame;
  const holes = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      if (a[p]) continue;
      let nb = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        nb += a[p + dy * w + dx];
      }
      if (nb >= 4) holes.push([x, y]);
    }
  }
  return holes;
}

function renderMesh(m, yaw, pitch) {
  return GF.render(m, { ppm: 40, pitch, yaw, palette: 'paper', style: 'pixel', styleAmount: 1, outline: true, shadow: false, transparent: true, focus: true, seed: 1 });
}

const pre = GF.getPreset('jiangnan');
const groups = [
  ['山花', /山花/, true],
  ['屋面', /屋面|坡|檐面|瓦|博风/, false],
  ['墙体', /墙|柱|枋|梁|窗|门/, false],
  ['全部', /.*/, false],
];
// 输出 ASCII 图：把渲染帧按采样网格块转成字符（'#'=密集不透明, '.'=透明, 'O'=洞中心附近）
function asciiArt(frame, holes, downsample = 4) {
  const { w, h, rgba } = frame;
  const a = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) a[i] = rgba[i * 4 + 3] > 0 ? 1 : 0;
  const holeSet = new Set(holes.map(([x, y]) => y * w + x));
  let out = '';
  for (let y = 0; y < h; y += downsample) {
    let row = '';
    for (let x = 0; x < w; x += downsample) {
      let cnt = 0, holeNear = false;
      for (let dy = 0; dy < downsample && y + dy < h; dy++) {
        for (let dx = 0; dx < downsample && x + dx < w; dx++) {
          cnt += a[(y + dy) * w + x + dx];
          if (holeSet.has((y + dy) * w + x + dx)) holeNear = true;
        }
      }
      const n = downsample * downsample;
      if (holeNear) row += 'H';
      else if (cnt === 0) row += '.';
      else if (cnt === n) row += '#';
      else row += '+';
    }
    out += row + '\n';
  }
  return out;
}

for (const [name2, mod] of [
  ['悬山', { roofType: 'gable' }],
  ['卷棚悬山', { roofType: 'roll' }],
  ['歇山', { roofType: 'gableHip' }],
]) {
  const m = GF.build({ ...pre, ...mod });
  console.log('=====', name2, '=====');
  const fm = filter(m, /山花/);
  // 检查 filter 重建网格的 pos 数据
  let nan = 0, yMin = 1e9, yMax = -1e9, xMin = 1e9, xMax = -1e9;
  const P2 = fm.pos;
  for (let i = 0; i < P2.length; i += 3) {
    if (!isFinite(P2[i])) nan++;
    const xi = P2[i], yi = P2[i + 1];
    if (xi < xMin) xMin = xi; if (xi > xMax) xMax = xi;
    if (yi < yMin) yMin = yi; if (yi > yMax) yMax = yi;
  }
  console.log('  山花网格: posNaN=', nan, 'x=', xMin.toFixed(2) + '..' + xMax.toFixed(2), 'y=', yMin.toFixed(2) + '..' + yMax.toFixed(2));
  // 检查 tri 的顶点顺序法线（是否全 X 面）
  const nrmX = [];
  for (let t = 0; t < fm.triCount; t++) {
    nrmX.push(Math.abs(fm.nrm[t * 3]));
  }
  console.log('  法线 |x| 分布: min=', Math.min(...nrmX).toFixed(2), 'max=', Math.max(...nrmX).toFixed(2));
  const f = renderMesh(fm, 90, 30);
  console.log('--- 山花 ASCII (yaw=90) ---');
  console.log(asciiArt(f, findHoles(f), 6));
  // 帧像素统计：按行统计不透明像素，判断 is 填充满
  const { w: W0, h: H0, rgba: RGBA } = f;
  const rowC = [];
  let totalOpaque = 0;
  for (let y = 0; y < H0; y++) {
    let c = 0;
    for (let x = 0; x < W0; x++) if (RGBA[(y * W0 + x) * 4 + 3] > 0) c++;
    rowC.push(c); totalOpaque += c;
  }
  const ys = rowC.map((c, i) => (c > 0 ? i : null)).filter((v) => v != null);
  console.log('  帧尺寸=', W0 + 'x' + H0, '不透明像素=', totalOpaque, '有内容行=', ys.length ? ys[0] + '..' + ys[ys.length - 1] : '无');
  console.log('  不透明像素按行分布(每2行): ', rowC.filter((_, i) => i % 2 === 0).map((c) => (c > 0 ? String(c).padStart(3) : '  0')).join(' '));
  const { w, h, rgba } = f;
  const a = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) a[i] = rgba[i * 4 + 3] > 0 ? 1 : 0;
  // 投影诊断：复刻渲染器真实相机 yaw=90 pitch=30（persp=0 纯正交）
  // camera: right=[cosT,0,-sinT] up=[-sinT sinP, cosP, -cosT sinP] view=[sinT cosP, sinP, cosT cosP]
  const T = (90 * Math.PI) / 180, P = (30 * Math.PI) / 180;
  const cR = [Math.cos(T), 0, -Math.sin(T)];
  const cU = [-Math.sin(T) * Math.sin(P), Math.cos(P), -Math.cos(T) * Math.sin(P)];
  const cV = [Math.sin(T) * Math.cos(P), Math.sin(P), Math.cos(T) * Math.cos(P)];
  // 取景：bounds 全山花 mesh → 取 frame 内以 (ox,oy) 平移缩放
  const bnd = fm.bounds();
  // 投影所有顶点（正交 k=1）
  const n2 = fm.triCount;
  const svec = [];
  let mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9;
  for (let t = 0; t < n2; t++) {
    const oo = t * 9;
    const tri = [];
    for (let kk = 0; kk < 3; kk++) {
      const vv = [fm.pos[oo + kk * 3], fm.pos[oo + kk * 3 + 1], fm.pos[oo + kk * 3 + 2]];
      const sx0 = vv[0] * cR[0] + vv[2] * cR[2];
      const sy0 = vv[0] * cU[0] + vv[1] * cU[1] + vv[2] * cU[2];
      tri.push([sx0, -sy0]);
      if (sx0 < mnx) mnx = sx0; if (sx0 > mxx) mxx = sx0;
      if (-sy0 < mny) mny = -sy0; if (-sy0 > mxy) mxy = -sy0;
    }
    svec.push(tri);
  }
  let big2 = 0, minS2 = 1e9, filled2 = 0, zeroA = 0;
  for (let t = 0; t < n2; t++) {
    const [A2, B2, C2] = svec[t];
    const area2 = Math.abs((B2[0] - A2[0]) * (C2[1] - A2[1]) - (C2[0] - A2[0]) * (B2[1] - A2[1]));
    if (area2 < 1e-9) zeroA++;
    if (area2 > 500) big2++;
    const ss = [Math.hypot(B2[0] - A2[0], B2[1] - A2[1]), Math.hypot(C2[0] - B2[0], C2[1] - B2[1]), Math.hypot(A2[0] - C2[0], A2[1] - C2[1])];
    minS2 = Math.min(minS2, Math.min(...ss));
    const cx2 = (A2[0] + B2[0] + C2[0]) / 3, cy2 = (A2[1] + B2[1] + C2[1]) / 3;
    // 映射到帧坐标：与渲染器一致
    const pad2 = 8;
    const m2 = Math.max(0.55, Math.max(mxx - mnx, mxy - mny) * 0.16);
    const bx02 = mnx - m2, bx12 = mxx + m2, by02 = mny - m2, by12 = mxy + m2;
    const W2 = Math.max(4, Math.ceil((bx12 - bx02) * 40) + pad2 * 2);
    const H2 = Math.max(4, Math.ceil((by12 - by02) * 40) + pad2 * 2);
    const o2x = -bx02 * 40 + pad2, o2y = -by02 * 40 + pad2;
    const X = Math.round(cx2 * 40 + o2x), Y = Math.round(cy2 * 40 + o2y);
    if (X >= 0 && X < W2 && Y >= 0 && Y < H2 && a[Y * W2 + X]) filled2++;
  }
  console.log('  真投影复算: 三角形=', n2, '零面积=', zeroA, '面积>500px²=', big2, '最短边min=', minS2.toFixed(1), 'px  重心填充=', filled2 + '/' + n2);
  for (const [gname, re] of groups) {
    const f2 = renderMesh(filter(m, re), 90, 30);
    const holes = findHoles(f2);
    console.log('  ', gname, 'tri=', filter(m, re).triCount, '洞=', holes.length);
  }
}