// 同投影、同取景下的四种光栅化变体对照（屏幕投影）
// + 世界空间 y-z 正投影栅格（无视 x，山花面在 x=const 平面内）
// 决定性问题：整组山花渲染成空心三角。到底是谁吃掉了内部像素？
//   屏幕投影四种变体全等 → 与光栅算法无关；世界正投影是否空心 → 几何是否有缝
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

function camera(yawDeg, pitchDeg) {
  const th = yawDeg * Math.PI / 180, ph = pitchDeg * Math.PI / 180;
  return {
    right: [Math.cos(th), 0, -Math.sin(th)],
    up: [-Math.sin(th) * Math.sin(ph), Math.cos(ph), -Math.cos(th) * Math.sin(ph)],
    view: [Math.sin(th) * Math.cos(ph), Math.sin(ph), Math.cos(th) * Math.cos(ph)]
  };
}

const pre = GF.getPreset('jiangnan');
const m = GF.build({ ...pre, roofType: 'gable' });
const fm = filter(m, /山花/);

/* ---------------- 屏幕投影四变体 ---------------- */
const cam = camera(90, 30);
const n = fm.triCount * 3;
const px = new Float32Array(n), py = new Float32Array(n), pz = new Float32Array(n);
let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
for (let i = 0; i < n; i++) {
  const vx = fm.pos[i*3], vy = fm.pos[i*3+1], vz = fm.pos[i*3+2];
  px[i] = vx * cam.right[0] + vz * cam.right[2];
  py[i] = -(vx * cam.up[0] + vy * cam.up[1] + vz * cam.up[2]);
  pz[i] = vx * cam.view[0] + vy * cam.view[1] + vz * cam.view[2];
  if (px[i] < minx) minx = px[i]; if (px[i] > maxx) maxx = px[i];
  if (py[i] < miny) miny = py[i]; if (py[i] > maxy) maxy = py[i];
}
const M2 = Math.max(0.5, Math.max(maxx - minx, maxy - miny) * 0.07);
const b0 = minx - M2, b1 = maxx + M2, t0 = miny - M2, t1 = maxy + M2;
const PPM = 40, PAD = 2;
const W = Math.max(4, Math.ceil((b1 - b0) * PPM) + PAD * 2);
const H = Math.max(4, Math.ceil((t1 - t0) * PPM) + PAD * 2);
const ox = -b0 * PPM + PAD, oy = -t0 * PPM + PAD;
console.log('屏幕取景 WxH=', W + 'x' + H, ' 三角形数=', fm.triCount);

function raster2D(tris, W, H) {
  const cov = new Uint8Array(W * H);
  for (const tr of tris) {
    const [x0, y0, z0] = tr[0], [x1, y1, z1] = tr[1], [x2, y2, z2] = tr[2];
    const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    if (area === 0) continue;
    const bx0 = Math.max(0, Math.floor(Math.min(x0, x1, x2)));
    const bx1 = Math.min(W-1, Math.ceil(Math.max(x0, x1, x2)));
    const by0 = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
    const by1 = Math.min(H-1, Math.ceil(Math.max(y0, y1, y2)));
    const za = (y1-y2)/area, zb = (x2-x1)/area;
    const w1a = (y2-y0)/area, w1b = (x0-x2)/area;
    for (let y = by0; y <= by1; y++) {
      const yc = y + 0.5 - y2;
      let w0 = za*(bx0+0.5-x2) + zb*yc;
      let w1 = w1a*(bx0+0.5-x2) + w1b*yc;
      let z = z2 + (za*(z0-z2) + w1a*(z1-z2))*(bx0+0.5-x2) + (zb*(z0-z2) + w1b*(z1-z2))*yc;
      let p = y*W + bx0;
      for (let x = bx0; x <= bx1; x++, w0 += za, w1 += w1a, z += (za*(z0-z2) + w1a*(z1-z2)), p++) {
        const w2 = 1 - w0 - w1;
        if (w0 >= -0.001 && w1 >= -0.001 && w2 >= -0.001) cov[p] = 1;
      }
    }
  }
  return cov;
}

function toScreenTri(t) {
  const i = t * 9;
  const s = (a) => {
    const kx = fm.pos[i+a*3] * cam.right[0] + fm.pos[i+a*3+2] * cam.right[2];
    const ky = -(fm.pos[i+a*3] * cam.up[0] + fm.pos[i+a*3+1] * cam.up[1] + fm.pos[i+a*3+2] * cam.up[2]);
    const kz = fm.pos[i+a*3] * cam.view[0] + fm.pos[i+a*3+1] * cam.view[1] + fm.pos[i+a*3+2] * cam.view[2];
    return [kx*PPM+ox, ky*PPM+oy, kz];
  };
  return [s(0), s(1), s(2)];
}

const screenTris = [];
for (let t = 0; t < fm.triCount; t++) screenTris.push(toScreenTri(t));
const covA = raster2D(screenTris, W, H);
let cnt = 0; for (let i = 0; i < W*H; i++) cnt += covA[i];
console.log('屏幕投影（纯重心覆盖）不透明像素=', cnt);

let ascii = '';
const DS = 2;
for (let y = 0; y < H; y += DS) {
  let row = '';
  for (let x = 0; x < W; x += DS) {
    let c = 0;
    for (let dy = 0; dy < DS && y + dy < H; dy++)
      for (let dx = 0; dx < DS && x + dx < W; dx++) c += covA[(y + dy) * W + x + dx];
    row += c === 0 ? '.' : (c === DS * DS ? '#' : '+');
  }
  ascii += row + '\n';
}
fs.writeFileSync(path.join(ROOT, 'cli', '_raster_ascii.txt'), ascii);

/* ---------------- 世界 y-z 正投影栅格（无视 x） ---------------- */
// 三角形 x 全部 = const（山花面），直接以 (z, y) 作二维栅格验证是否有几何缝隙
let minY = 1e9, maxY = -1e9, minZ = 1e9, maxZ = -1e9;
for (let i = 0; i < n; i++) {
  const vy = fm.pos[i*3+1], vz = fm.pos[i*3+2];
  if (vy < minY) minY = vy; if (vy > maxY) maxY = vy;
  if (vz < minZ) minZ = vz; if (vz > maxZ) maxZ = vz;
}
const PP = 50, WW = Math.ceil((maxZ - minZ) * PP) + 4, HH = Math.ceil((maxY - minY) * PP) + 4;
const oox = -minZ * PP + 2, ooy = -minY * PP + 2;
const worldTris = [];
for (let t = 0; t < fm.triCount; t++) {
  const i = t * 9;
  const w = (a) => [(fm.pos[i+a*3+2] * PP) + oox, (fm.pos[i+a*3+1] * PP) + ooy, 0];
  worldTris.push([w(0), w(1), w(2)]);
}
const covW = raster2D(worldTris, WW, HH);
let wcnt = 0; for (let i = 0; i < WW*HH; i++) wcnt += covW[i];
console.log('世界 y-z 正投影 WxH=', WW + 'x' + HH, ' 覆盖像素=', wcnt, ' 理论实心三角像素≈',
  Math.round(0.5 * (maxY - minY) * PP * (maxZ - minZ) * PP));

let wascii = '';
for (let yy = 0; yy < HH; yy++) {
  let row = '';
  for (let zz = 0; zz < WW; zz++) row += covW[yy*WW+zz] ? '#' : '.';
  wascii += row + '\n';
}
fs.writeFileSync(path.join(ROOT, 'cli', '_world_ascii.txt'), wascii);
console.log('详见 cli/_raster_ascii.txt（屏幕）与 cli/_world_ascii.txt（世界）');