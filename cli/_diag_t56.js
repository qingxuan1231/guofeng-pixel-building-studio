/* 临时：精确投影大雄宝殿台基区 → 屏幕 → 高清 ASCII 验证 */
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
const recipe = GF.getPreset('temple5');
recipe.render.ppm = 90;
const mesh = GF.build(recipe);
const o = {
  ppm: 90, pitch: 10, yaw: 180, palette: recipe.render.palette,
  style: recipe.render.style || 'pixel', styleAmount: recipe.render.styleAmount,
  outline: false, shadow: true, sunAz: null, shadowAngle: null,
  transparent: false, focus: true, seed: recipe.seed
};
const fr = GF.render(mesh, o);
console.log('frame', fr.w + 'x' + fr.h);

// 复算投影（与渲染器同公式）
function camera(yawDeg, pitchDeg) {
  const th = (yawDeg * Math.PI) / 180, ph = (pitchDeg * Math.PI) / 180;
  return {
    right: [Math.cos(th), 0, -Math.sin(th)],
    up: [-Math.sin(th) * Math.sin(ph), Math.cos(ph), -Math.cos(th) * Math.sin(ph)],
    view: [Math.sin(th) * Math.cos(ph), Math.sin(ph), Math.cos(th) * Math.cos(ph)]
  };
}
const pad = 8, cam = camera(o.yaw, o.pitch);
const b = mesh.bounds();
const span = Math.max(b.x1 - b.x0, b.z1 - b.z0, (b.y1 - b.y0) * 1.8, 20);
const D = Math.max(span * 2.2, 40);
const c = [(b.x0 + b.x1) * 0.5, (b.y0 + b.y1) * 0.5, (b.z0 + b.z1) * 0.5];
const cdepth = c[0] * cam.view[0] + c[1] * cam.view[1] + c[2] * cam.view[2];
const perspK = (depth) => 1;
function proj(X, Y, Z) {
  const d = X * cam.view[0] + Y * cam.view[1] + Z * cam.view[2];
  const k = perspK(d - cdepth);
  const sx = (X * cam.right[0] + Z * cam.right[2]) * k;
  const sy = (X * cam.up[0] + Y * cam.up[1] + Z * cam.up[2]) * k;
  return { x: sx, y: -sy };
}
// 取景范围（与渲染器 focus 逻辑相同：非环境包围盒 + 边距）
const ENV_TAGS = ['ground', '树', '假山', '水池', '幡', '石灯', '井', '碑', '钟', '鼓', '盆景', '拴马桩', '曲桥', '花池', '甬道'];
let fx0 = 1e9, fx1 = -1e9, fy0 = 1e9, fy1 = -1e9;
for (let t = 0; t < mesh.triCount; t++) {
  if (ENV_TAGS.indexOf(mesh.tag[t]) >= 0) continue;
  for (let k = 0; k < 3; k++) {
    const p = t * 3 + k;
    const vx = mesh.pos[p * 3], vy = mesh.pos[p * 3 + 1], vz = mesh.pos[p * 3 + 2];
    const pr = proj(vx, vy, vz);
    if (pr.x < fx0) fx0 = pr.x; if (pr.x > fx1) fx1 = pr.x;
    if (pr.y < fy0) fy0 = pr.y; if (pr.y > fy1) fy1 = pr.y;
  }
}
const m = Math.max(0.55, Math.max(fx1 - fx0, fy1 - fy0) * 0.16);
const bx0 = fx0 - m, bx1 = fx1 + m, by0 = fy0 - m, by1 = fy1 + m;
const ox = -bx0 * o.ppm + pad, oy = -by0 * o.ppm + pad;

// 大殿台基区世界范围：x[-4.6,4.6] z[-0.4,2.3] y[0,1.5]
let gx0 = 1e9, gx1 = -1e9, gy0 = 1e9, gy1 = -1e9;
for (const X of [-4.6, -3.4, -1.9, -0.9, 0, 0.9, 1.9, 3.4, 4.6])
  for (const Z of [-0.4, 0.0, 0.4, 0.92, 1.4, 2.3])
    for (const Y of [0.0, 0.4, 0.7, 1.45]) {
      const pr = proj(X, Y, Z);
      const sxv = ox + pr.x * o.ppm, syv = oy + pr.y * o.ppm;
      if (sxv < gx0) gx0 = sxv; if (sxv > gx1) gx1 = sxv;
      if (syv < gy0) gy0 = syv; if (syv > gy1) gy1 = syv;
    }
const PAD = 4;
gx0 = Math.max(0, gx0 - PAD); gx1 = Math.min(fr.w - 1, gx1 + PAD);
gy0 = Math.max(0, gy0 - PAD); gy1 = Math.min(fr.h - 1, gy1 + PAD);
console.log('投影裁剪 px', gx0, gx1, 'py', gy0, gy1);

const W = 148, H = 42;
for (let yy = 0; yy < H; yy++) {
  const sy = Math.floor(gy0 + (yy + 0.5) * (gy1 - gy0) / H);
  let line = '';
  for (let xx = 0; xx < W; xx++) {
    const sx = Math.floor(gx0 + (xx + 0.5) * (gx1 - gx0) / W);
    const i = (sy * fr.w + sx) * 4;
    const r = fr.rgba[i], g = fr.rgba[i + 1], b = fr.rgba[i + 2], a = fr.rgba[i + 3];
    if (a < 70) { line += ' '; continue; }
    const lum = (r + g + b) / 3, mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    let ch;
    if (mx - mn > 36) {
      if (r > g && r > b) ch = 'R';
      else if (b > r && b > g) ch = 'B';
      else ch = 'W';
    } else if (lum > 205) ch = '@';
    else if (lum > 178) ch = '#';
    else if (lum > 150) ch = 'o';
    else if (lum > 122) ch = 'x';
    else if (lum > 95) ch = ':';
    else if (lum > 68) ch = '.';
    else if (lum > 42) ch = '+';
    else ch = '-';
    line += ch;
  }
  console.log(line);
}