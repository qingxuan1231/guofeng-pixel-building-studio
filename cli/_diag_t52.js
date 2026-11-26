/* 临时诊断：打印 temple5 各部件包围盒 + 产出前视图 PNG，验证大雄宝殿台基/台阶一体修复 */
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

const units = mesh.units || [];
console.log('===== 部件包围盒（世界坐标） =====');
for (const u of units) {
  if (!u || !u.parts) continue;
  if (u.id === '大雄宝殿' || u.id === '法堂' || u.id === '天王殿') {
    const parts = Object.keys(u.parts).map((k) => {
      const b = u.parts[k];
      if (!b) return k + ':null';
      return `${k}[x${b.x0.toFixed(2)}..${b.x1.toFixed(2)} z${b.z0.toFixed(2)}..${b.z1.toFixed(2)} y${b.y0.toFixed(2)}..${b.y1.toFixed(2)}]`;
    }).join('  ');
    console.log(u.id, '->', parts);
  }
}
console.log('总三角数', mesh.triCount);

const outDir = path.join(ROOT, 'out');
fs.mkdirSync(outDir, { recursive: true });
for (const cfg of [
  { yaw: 45, pitch: 35, ppm: 30, name: 't5_recheck_45' },
  { yaw: 90, pitch: 35, ppm: 30, name: 't5_recheck_90' },
  { yaw: 10, pitch: 18, ppm: 30, name: 't5_recheck_frontlow' }
]) {
  const frame = GF.render(mesh, {
    ppm: cfg.ppm, pitch: cfg.pitch, yaw: cfg.yaw,
    palette: recipe.render.palette, style: recipe.render.style,
    styleAmount: recipe.render.styleAmount,
    outline: false, shadow: true, sunAz: recipe.render.sunAz, shadowAngle: recipe.render.shadowAngle,
    transparent: false, focus: false, seed: recipe.seed
  });
  const file = path.join(outDir, cfg.name + '.png');
  fs.writeFileSync(file, GF.encodePNG(frame.w, frame.h, frame.rgba));
  console.log('->', file, frame.w + 'x' + frame.h);
}