/* 临时：大雄宝殿台基区放大 ASCII（前视 / 斜视两个角度） */
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

function frame(pitch, yaw, ppm, outline) {
  const recipe = GF.getPreset('temple5');
  const mesh = GF.build(recipe);
  return GF.render(mesh, {
    ppm, pitch, yaw, palette: recipe.render.palette,
    style: recipe.render.style || 'pixel', styleAmount: recipe.render.styleAmount,
    outline, shadow: true, sunAz: recipe.render.sunAz, shadowAngle: recipe.render.shadowAngle,
    transparent: false, focus: true, seed: recipe.seed
  });
}
function art(fr, x0r, x1r, y0r, y1r, W, H) {
  const px0 = Math.floor(x0r * fr.w), px1 = Math.max(px0 + 1, Math.floor(x1r * fr.w));
  const py0 = Math.floor(y0r * fr.h), py1 = Math.max(py0 + 1, Math.floor(y1r * fr.h));
  const rows = [];
  for (let yy = 0; yy < H; yy++) {
    const sy = py0 + Math.floor((yy + 0.5) * (py1 - py0) / H);
    let line = '';
    for (let xx = 0; xx < W; xx++) {
      const sx = px0 + Math.floor((xx + 0.5) * (px1 - px0) / W);
      const i = (sy * fr.w + sx) * 4;
      const r = fr.rgba[i], g = fr.rgba[i + 1], b = fr.rgba[i + 2], a = fr.rgba[i + 3];
      if (a < 70) { line += ' '; continue; }
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), lum = (r + g + b) / 3;
      if (mx - mn > 40) {
        if (r > b && r > g && r > 90) line += (r < 170 ? 'R' : 'r');
        else if (b > r && b > g) line += 'T';
        else line += 'W';
      } else if (lum > 180) line += '#';
      else if (lum > 140) line += 'o';
      else if (lum > 105) line += ':';
      else if (lum > 70) line += '.';
      else line += '+';
    }
    rows.push(line);
  }
  console.log(rows.join('\n'));
}

// 前视靠近眼平：台基正立面 + 两侧翼台应可见
console.log('===== 前视 yaw=180 pitch=14 全帧粗览 =====');
art(frame(14, 180, 50, false), 0.0, 1.0, 0.5, 1.0, 140, 30);
console.log('\n===== 前视 底部中央放大（大雄宝殿台基/踏跺/翼台） =====');
art(frame(14, 180, 80, false), 0.33, 0.67, 0.72, 1.0, 132, 40);
console.log('\n===== 前视 更低位更放大（仅台基裙脚与踏跺） =====');
art(frame(14, 180, 80, false), 0.36, 0.64, 0.84, 1.0, 120, 30);