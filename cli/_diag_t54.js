/* 临时：大雄宝殿台基/踏跺/翼台 顶视图（用部件包围盒直绘） */
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
const u = mesh.units.find((v) => v && v.id === '大雄宝殿');

const x0 = -4.2, x1 = 4.2, z0 = -0.6, z1 = 2.2, W = 120, H = 35;
const draw = new Array(W * H).fill(' ');
const put = (x, z, ch, big) => {
  const px = Math.round((x - x0) / (x1 - x0) * (W - 1));
  let py = Math.round((z - z0) / (z1 - z0) * (H - 1));
  py = (H - 1) - py; // 行自顶向下，z 大在上
  if (px >= 0 && px < W && py >= 0 && py < H) draw[py * W + px] = ch;
};
if (u && u.parts) {
  // 台基（含主打Built踏跺）
  const pb = u.parts.base, pt = u.parts.terrace, pr = u.parts.roof;
  const pad2 = (b, ch) => { for (let x = x0; x <= x1; x += 0.03) for (let z = z0; z <= z1; z += 0.03) if (b && x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) put(x, z, ch); };
  if (pr) pad2(pr, '^');
  if (pt) pad2(pt, 'T');
  if (pb) pad2(pb, '#');
}
let out = [];
for (let r = 0; r < H; r++) out.push(draw.slice(r * W, (r + 1) * W).join(''));
console.log('===== 大雄宝殿顶视足迹（横坐标 x[-4.2,4.2] 纵坐标 z[-0.6,2.2]） =====');
console.log('legenda: ^=屋面投影 #=台基(含踏跺) T=月台翼台');
console.log(out.join('\n'));