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

// 已 fp 上被不透明包围的透明像素 = 洞
function findHoles(frame) {
  const { w, h, rgba } = frame;
  const alpha = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) alpha[i] = rgba[i * 4 + 3] > 0 ? 1 : 0;
  const holes = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      if (alpha[p]) continue;
      // 透明像素，四邻有足够多的不透明邻居且不是画面边缘 -> 疑似洞
      const nb = alpha[p - 1] + alpha[p + 1] + alpha[p - w] + alpha[p + w];
      const nb8 = nb + alpha[p - w - 1] + alpha[p - w + 1] + alpha[p + w - 1] + alpha[p + w + 1];
      if (nb8 >= 5) holes.push([x, y]);
    }
  }
  return holes;
}
// 8 邻域聚类
function alphaOf(frame) {
  const { w, h, rgba } = frame;
  const alpha = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) alpha[i] = rgba[i * 4 + 3] > 0 ? 1 : 0;
  return alpha;
}
function clusters(holes, alpha, w, h) {
  const sought = new Set(holes.map(([x, y]) => y * w + x));
  const seen = new Set();
  const out = [];
  for (const [hx, hy] of holes) {
    const key = hy * w + hx;
    if (seen.has(key)) continue;
    let stack = [[hx, hy]], cnt = 0, minx = 1e9, maxx = -1, miny = 1e9, maxy = -1, minD = 1e9;
    seen.add(key);
    while (stack.length) {
      const [cx, cy] = stack.pop(); cnt++;
      if (cx < minx) minx = cx; if (cx > maxx) maxx = cx;
      if (cy < miny) miny = cy; if (cy > maxy) maxy = cy;
      const nb0 = alpha[cy * w + cx - 1] + alpha[cy * w + cx + 1] + alpha[(cy - 1) * w + cx] + alpha[(cy + 1) * w + cx];
      if (nb0 < minD) minD = nb0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const nk = ny * w + nx;
        if (seen.has(nk) || alpha[nk]) continue;   // 只在透明洞里连通
        seen.add(nk);
        stack.push([nx, ny]);
      }
    }
    out.push({ cnt, x0: minx, x1: maxx, y0: miny, y1: maxy, minD });
  }
  return out.sort((a, b) => b.cnt - a.cnt);
}

const pre = GF.getPreset('jiangnan');
for (const [name, mod] of [
  ['悬山', { roofType: 'gable' }],
  ['卷棚悬山', { roofType: 'roll' }],
  ['歇山', { roofType: 'gableHip' }],
]) {
  const m = GF.build({ ...pre, ...mod });
  for (const yaw of [90]) {
    const f = GF.render(m, { ppm: 40, pitch: 30, yaw, palette: 'paper', style: 'pixel', styleAmount: 1, outline: true, shadow: false, transparent: true, focus: true, seed: 1 });
    const holes = findHoles(f);
    const cs = clusters(holes, alphaOf(f), f.w, f.h).slice(0, 6);
    console.log(name, 'yaw=' + yaw, 'size=' + f.w + 'x' + f.h, '洞像素数=', holes.length);
    for (const c of cs) {
      console.log('   簇: 像素=', c.cnt, 'x[' + c.x0 + '..' + c.x1 + ']', 'y[' + c.y0 + '..' + c.y1 + ']');
    }
  }
}