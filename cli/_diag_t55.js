/* 临时：大雄宝殿台基正面高清 ASCII（实际渲染像素采样） */
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
const mesh = GF.build(recipe);
const fr = GF.render(mesh, {
  ppm: 90, pitch: 10, yaw: 180, palette: recipe.render.palette,
  style: recipe.render.style || 'pixel', styleAmount: recipe.render.styleAmount,
  outline: false, shadow: true, sunAz: null, shadowAngle: null,
  transparent: false, focus: true, seed: recipe.seed
});
function art(x0r, x1r, y0r, y1r, W, H) {
  const px0 = Math.floor(x0r * fr.w), px1 = Math.max(px0 + 1, Math.floor(x1r * fr.w));
  const py0 = Math.floor(y0r * fr.h), py1 = Math.max(py0 + 1, Math.floor(y1r * fr.h));
  for (let yy = 0; yy < H; yy++) {
    const sy = py0 + Math.floor((yy + 0.5) * (py1 - py0) / H);
    let line = '';
    for (let xx = 0; xx < W; xx++) {
      const sx = px0 + Math.floor((xx + 0.5) * (px1 - px0) / W);
      const i = (sy * fr.w + sx) * 4;
      const r = fr.rgba[i], g = fr.rgba[i + 1], b = fr.rgba[i + 2], a = fr.rgba[i + 3];
      if (a < 70) { line += ' '; continue; }
      const lum = (r + g + b) / 3;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      let ch;
      if (mx - mn > 36) {
        if (r > g && r > b) ch = 'R';        // 红瓦
        else if (r < g * 0.8 && b > 100) ch = 'B'; // 蓝青环境
        else ch = 'W';                       // 木暖
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
}
console.log('===== 前视 yaw=180 pitch=10 ppm=90 · 大雄宝殿底部台基区 =====');
art(0.10, 0.90, 0.905, 0.995, 150, 30);