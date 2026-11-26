/* 一次性诊断：temple5 正面视角，底部中央放大，观察须弥座/月台/踏跺衔接 */
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
function render(preset, pitch, yaw) {
  const recipe = GF.getPreset(preset);
  recipe.render.ppm = 40;
  const mesh = GF.build(recipe);
  return GF.render(mesh, {
    ppm: 40, pitch, yaw, palette: recipe.render.palette,
    style: recipe.render.style || 'pixel', styleAmount: recipe.render.styleAmount,
    outline: recipe.render.outline !== false, shadow: true, transparent: false, focus: true, seed: recipe.seed
  });
}
function art(frame, x0r, x1r, y0r, y1r, W, H) {
  const px0 = Math.floor(x0r * frame.w), px1 = Math.floor(x1r * frame.w);
  const py0 = Math.floor(y0r * frame.h), py1 = Math.floor(y1r * frame.h);
  let out = [];
  for (let yy = 0; yy < H; yy++) {
    const sy = py0 + Math.floor((yy + 0.5) * (py1 - py0) / H);
    let line = '';
    for (let xx = 0; xx < W; xx++) {
      const sx = px0 + Math.floor((xx + 0.5) * (px1 - px0) / W);
      const i = (sy * frame.w + sx) * 4;
      const r = frame.rgba[i], g = frame.rgba[i + 1], b = frame.rgba[i + 2], a = frame.rgba[i + 3];
      if (a < 60) { line += ' '; continue; }
      // 颜色分类：R>G>B 红(瓦/门); B>R 蓝青(瓦心); R≈B≈G 灰(石/墙)
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      if (mx - mn < 18) line += (r > 140 ? '#' : (r > 90 ? 'o' : ':'));
      else if (r > b && r > g) line += 'R';
      else if (b > r && b > g) line += 'T';
      else if (r > b) line += 'W'; // 木/暖灰
      else line += 'B';
    }
    out.push(line);
  }
  console.log(out.join('\n'));
}
console.log('===== temple5 正面（大雄宝殿位于底部中央台基上） =====');
const f1 = render('temple5', 24, 180);
art(f1, 0.2, 0.8, 0.55, 1.0, 150, 34);