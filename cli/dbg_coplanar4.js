/* 找出完全重复（顶点相同的三角形）或共面的墙体对，dump 顶点 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const { ANCIENT } = require(path.join(ROOT, 'cli/modules.js'));
const FILES = ANCIENT.concat(['js/gf-render.js', 'js/gf-presets.js', 'js/gf-export.js']);
const ctx = { console }; ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of FILES) { const abs = path.isAbsolute(f) ? f : path.join(ROOT, f); vm.runInContext(fs.readFileSync(abs, 'utf8'), ctx, { filename: abs }); }
const GF = ctx.GF;
const mesh = GF.build({ ...GF.getPreset('temple5') });

// 收集 x≈±8, z≈-12~-16.5, y≈4.09/4.29 且 tag 含 墙体 的三角形
const want = [];
for (let t = 0; t < mesh.triCount; t++) {
  const tg = mesh.tag[t] || '';
  if (!/墙体/.test(tg)) continue;
  const i = t * 9;
  const A = [mesh.pos[i], mesh.pos[i+1], mesh.pos[i+2]];
  const B = [mesh.pos[i+3], mesh.pos[i+4], mesh.pos[i+5]];
  const C = [mesh.pos[i+6], mesh.pos[i+7], mesh.pos[i+8]];
  const cy = (A[1]+B[1]+C[1])/3;
  if (!(Math.abs(cy - 4.09) < 0.01 || Math.abs(cy - 4.29) < 0.01)) continue;
  const cx = (A[0]+B[0]+C[0])/3, cz = (A[2]+B[2]+C[2])/3;
  if (Math.abs(cx) < 6 || cz > -11) continue;
  want.push({ t, tg, A, B, C, cy: +cy.toFixed(3), cx: +cx.toFixed(1), cz: +cz.toFixed(1) });
}
console.log('候选水平墙体三角形数 =', want.length);
// 按 (cy, cx, cz) 聚类看是否每个位置有两个完全相同的三角形
const byPos = new Map();
for (const w of want) {
  const key = w.cy + '@' + w.cx + '@' + w.cz;
  if (!byPos.has(key)) byPos.set(key, []);
  byPos.get(key).push(w);
}
for (const [key, list] of byPos) {
  if (list.length > 1) {
    console.log('== 位置', key, '有', list.length, '个三角形（应为重复生成）');
    for (const w of list.slice(0, 4)) {
      console.log(`   tag=${w.tg} A(${w.A.map(v=>v.toFixed(3))}) B(${w.B.map(v=>v.toFixed(3))}) C(${w.C.map(v=>v.toFixed(3))})`);
    }
  }
}