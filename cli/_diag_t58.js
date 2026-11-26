/* 临时诊断：验证大雄宝殿两翼月台已并入『u:大雄宝殿』拖动区间。
 * 1) 打印台基/月台/踏跺世界包围盒；
 * 2) 扫描 大雄月台/月台台面/月台栏 三角是否全部落在 _mo['u:大雄宝殿'] 区间内；
 * 3) 用 moveRange 模拟拖动，证明翼台随殿身同步位移。 */
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

const hall = (mesh.units || []).filter((u) => u.id === '大雄宝殿')[0];
console.log('===== 大雄宝殿部件（世界坐标） =====');
for (const k of ['base', 'body', 'roof', 'terrace']) {
  const b = hall && hall.parts && hall.parts[k];
  console.log(k, b ? `x[${b.x0.toFixed(2)}..${b.x1.toFixed(2)}] z[${b.z0.toFixed(2)}..${b.z1.toFixed(2)}] y[${b.y0.toFixed(2)}..${b.y1.toFixed(2)}]` : '(null)');
}

const key = 'u:大雄宝殿';
const rg = (mesh._mo || {})[key];
console.log('_mo[' + key + '] =', rg ? '[t' + rg[0] + '..t' + rg[1] + ')' : '(missing)');
if (!rg) throw new Error('拖动区间缺失');

// 翼台相关三角是否全在区间内（栏杆内部硬编码『栏杆』标签，不带走 tag 参数）
for (const tag of ['大雄月台', '月台台面', '栏杆']) {
  let allIn = true, cnt = 0, minIdx = 1e9, maxIdx = -1;
  mesh.tag.forEach((t, i) => {
    if (!t || t.indexOf(tag) !== 0) return;
    if (i < rg[0] || i >= rg[1]) allIn = false;
    cnt++;
    minIdx = Math.min(minIdx, i); maxIdx = Math.max(maxIdx, i);
  });
  console.log(tag + ': ' + cnt + ' 块, 索引[' + minIdx + '..' + maxIdx + '], 全在拖动区间内=' + allIn);
}

// 采样一个翼台三角顶点，模拟拖动后验证位移
const o = 0, pos = mesh.pos;
let smp = null;
for (let t = rg[0]; t < Math.min(rg[1], mesh.tag.length); t++) {
  if (mesh.tag[t] && mesh.tag[t].indexOf('大雄月台') === 0) { smp = t; break; }
}
if (smp == null) throw new Error('找不到翼台样本');
const before = [pos[smp * 9], pos[smp * 9 + 2]];
const dx = 1.5, dz = 2.3;
mesh.moveRange(rg[0], rg[1], dx, dz);
const after = [pos[smp * 9], pos[smp * 9 + 2]];
console.log('翼台样本三角 #' + smp, '拖前(x,z)=(' + before[0] + ',' + before[1] + ')', '拖后=(' + after[0] + ',' + after[1] + ')');
console.log('位移量：dx=' + (after[0] - before[0]).toFixed(3) + '（期望 ' + dx + '） dz=' + (after[1] - before[1]).toFixed(3) + '（期望 ' + dz + '）');
const ok = Math.abs(after[0] - before[0] - dx) < 1e-6 && Math.abs(after[1] - before[1] - dz) < 1e-6;
console.log(ok ? 'PASS：两翼月台随大雄宝殿同步拖动' : 'FAIL：位移未同步');