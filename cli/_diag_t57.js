/* 临时：紧贴大雄宝殿台基正面 slab（含踏跺与两翼）的投影裁剪 ASCII */
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
  outline: false, shadow: true, transparent: false,
  focus: true, seed: recipe.seed
};
const fr = GF.render(mesh, o);

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
const m = Math.max(0.55, Math.max(b.x1 - b.x0, (b.z1 - b.z0), (b.y1 - b.y0) * 1.8, 20) * 1);
// 与渲染器同 way：只取非环境焦点框
{
  const ENV_TAGS = ['ground', '树', '假山', '水池', '幡', '石灯', '井', '碑', '钟', '鼓', '盆景', '拴马桩', '曲桥', '花池', '甬道'];
  let fx0 = 1e9, fx1 = -1e9, fy0 = 1e9, fy1 = -1e9;
  const pr = (X, Y, Z) => {
    const sx = (X * cam.right[0] + Z * cam.right[2]);
    const sy = (X * cam.up[0] + Y * cam.up[1] + Z * cam.up[2]);
    return { x: sx, y: -sy };
  };
  for (let t = 0; t < mesh.triCount; t++) {
    if (ENV_TAGS.indexOf(mesh.tag[t]) >= 0) continue;
    for (let k = 0; k < 3; k++) {
      const p = t * 3 + k;
      const q = pr(mesh.pos[p * 3], mesh.pos[p * 3 + 1], mesh.pos[p * 3 + 2]);
      if (q.x < fx0) fx0 = q.x; if (q.x > fx1) fx1 = q.x;
      if (q.y < fy0) fy0 = q.y; if (q.y > fy1) fy1 = q.y;
    }
  }
  const mm = Math.max(0.55, Math.max(fx1 - fx0, fy1 - fy0) * 0.16);
  bx0 = fx0 - mm; bx1 = fx1 + mm; by0 = fy0 - mm; by1 = fy1 + mm;
}
const ox = -bx0 * o.ppm + pad, oy = -by0 * o.ppm + pad;
const proj = (X, Y, Z) => ({ x: ox + (X * cam.right[0] + Z * cam.right[2]) * o.ppm, y: oy + (-(X * cam.up[0] + Y * cam.up[1] + Z * cam.up[2])) * o.ppm });

// 目标 slab：台基正面 + 踏跺 + 两翼
let gx0 = 1e9, gx1 = -1e9, gy0 = 1e9, gy1 = -1e9;
for (const X of [-4.7, -3.4, -2.5, -1.94, -1.6, -0.8, 0, 0.8, 1.6, 1.94, 2.5, 3.4, 4.7])
  for (const Z of [-0.25, 0.02, 0.45, 0.8, 0.92, 1.2, 1.5, 1.9])
    for (const Y of [0, 0.55, 0.75, 1.45]) {
      const q = proj(X, Y, Z);
      if (q.x < gx0) gx0 = q.x; if (q.x > gx1) gx1 = q.x;
      if (q.y < gy0) gy0 = q.y; if (q.y > gy1) gy1 = q.y;
    }
gx0 = Math.max(0, gx0 - 4); gx1 = Math.min(fr.w - 1, gx1 + 4);
gy0 = Math.max(0, gy0 - 4); gy1 = Math.min(fr.h - 1, gy1 + 4);
console.log('crop px', gx0, gx1, 'py', gy0, gy1, 'frame', fr.w, fr.h);

const W = 148, H = 44;
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