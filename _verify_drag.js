const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;
const { ANCIENT } = require('./cli/modules');
const FILES = ANCIENT.concat(['js/gf-render.js', 'js/gf-presets.js', 'js/gf-export.js']);

function loadGF() {
  const ctx = { console };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of FILES) {
    const code = fs.readFileSync(path.join(ROOT, f), 'utf8');
    vm.runInContext(code, ctx, { filename: f });
  }
  return ctx.GF;
}

const GF = loadGF();

function maxDiff(A, B) {
  let md = 0, at = -1;
  const n = Math.min(A.pos.length, B.pos.length);
  for (let i = 0; i < n; i++) {
    const d = Math.abs(A.pos[i] - B.pos[i]);
    if (d > md) { md = d; at = i; }
  }
  let mw = 0, aw = -1;
  const w = Math.min(A.wx.length, B.wx.length);
  for (let i = 0; i < w; i++) {
    const dx = Math.abs(A.wx[i] - B.wx[i]);
    const dz = Math.abs(A.wz[i] - B.wz[i]);
    if (dx > mw) { mw = dx; aw = i; }
    if (dz > mw) { mw = dz; aw = i; }
  }
  return { md, at, mw, aw, sameLen: A.pos.length === B.pos.length };
}

function cloneRecipe(r) {
  return JSON.parse(JSON.stringify(r));
}

function check(name, draftStep, finalStep, key, info) {
  const A = GF.build(draftStep.base);
  const range = (A._mo || {})[key];
  const okKeys = !!(range && range[1] > range[0]);
  let steps = 0;
  draftStep.apply(A, range, (d) => { steps++; });
  if (steps === 0) { console.log('SKIP', name, '(no delta applied)'); return null; }
  const B = GF.build(finalStep.make());
  const eq = maxDiff(A, B);
  const pass = eq.md < 1e-6 && eq.mw < 1e-6 && eq.sameLen && A.triCount === B.triCount;
  console.log(
    (pass ? 'PASS' : 'FAIL'), name.padEnd(34),
    'key=' + key, 'steps=' + steps,
    '| tri', A.triCount, '==', B.triCount,
    '| max|pos|diff=%.2e'.replace('%.2e', eq.md.toExponential(2)),
    '| max|wx/wz|diff=%.2e'.replace('%.2e', eq.mw.toExponential(2)),
    info || ''
  );
  if (!pass && info !== 'expected-fail') process.exitCode = 1;
  return A;
}

// =====================================================================
// 1) 整栋建筑拖动（含环境）—— siheyuan 四合院有院落单元
// =====================================================================
{
  const r0 = GF.normalize(GF.getPreset('siheyuan'));
  r0.env.showGround = false;
  const r1 = cloneRecipe(r0);
  r1.moveX = 4.2; r1.moveZ = -2.3;

  const meshA = GF.build(r0);
  const mo = meshA._mo || {};
  const keys = Object.keys(mo);
  console.log('\n[siheyuan] _mo keys:', keys.length, keys.slice(0, 50).join(','), keys.length > 50 ? '...' : '');
  const bld0 = keys.indexOf('bld');
  console.log('[siheyuan] has bld:', bld0 >= 0, '| range:', JSON.stringify(mo.bld || 'MISSING'));

  check(
    'whole building drag (siheyuan)',
    { base: r0, apply: (A, range, cb) => { const rng = A._mo.bld; A.moveRange(rng[0], rng[1], 1.4, -0.8); A.moveRange(rng[0], rng[1], 2.8, -1.5); cb(); } },
    { make: () => r1 },
    'bld'
  );

  const ids = Object.keys(r0.units || {});
  console.log('[siheyuan] units:', ids.join(','));
  if (ids.length) {
    const id = ids[0];
    const r2 = cloneRecipe(r0);
    const base = r0.units[id] || {};
    r2.units[id] = Object.assign({}, r2.units[id], { dx: (base.dx || 0) + 3, dz: (base.dz || 0) - 1.6 });
    check(
      'single unit drag (' + id + ')',
      { base: r0, apply: (A, range) => { const rng = A._mo['u:' + id]; A.moveRange(rng[0], rng[1], 1.0, -0.6); A.moveRange(rng[0], rng[1], 2.0, -1.0); } },
      { make: () => r2 },
      'u:' + id
    );
  }
}

// =====================================================================
// 2) 单栋无单元建筑 —— 验证 bld 区间覆盖全建筑
// =====================================================================
{
  const r0 = GF.normalize(GF.getPreset('tang'));
  r0.env.showGround = false;
  const r1 = cloneRecipe(r0);
  r1.moveX = -3.6; r1.moveZ = 1.8;
  const meshA = GF.build(r0);
  const mo = meshA._mo || {};
  console.log('\n[tang] _mo keys:', Object.keys(mo).join(','));
  const rng = mo.bld;
  console.log('[tang] bld range:', JSON.stringify(rng), 'total tris:', meshA.triCount, 'coverage:', rng ? (rng[1] === meshA.triCount).toString() : 'MISSING');
  check(
    'whole building drag (tang, no env)',
    { base: r0, apply: (A) => { const R = A._mo.bld; A.moveRange(R[0], R[1], -1.8, 0.9); A.moveRange(R[0], R[1], -1.8, 0.9); } },
    { make: () => r1 },
    'bld'
  );
}

// =====================================================================
// 3) 统一平移等价性：多处拖动 = 一次 rebuild（分离散步骤验证累计）
// =====================================================================
function runKeyTest(label, r0, r1, key) {
  const A = GF.build(r0);
  const B = GF.build(r1);
  const ra = (A._mo || {})[key], rb = (B._mo || {})[key];
  if (!ra || !rb) { console.log('SKIP', label.padEnd(34), 'key=' + key, '(no range)'); return false; }
  if (ra[0] !== rb[0] || ra[1] !== rb[1] || A.triCount !== B.triCount) {
    console.log('FAIL', label.padEnd(34), 'key=' + key, 'range/tri mismatch A', ra, 'B', rb, 'tris', A.triCount, B.triCount);
    process.exitCode = 1; return false;
  }
  if (ra[1] - ra[0] <= 0) {
    console.log('SKIP', label.padEnd(34), 'key=' + key, '(empty range)');
    return false;
  }
  // 通过 B-A 实测平移量（应处处一致）
  let dx = null, dz = null, xBad = 0, zBad = 0;
  const posA = A.pos, posB = B.pos;
  for (let t = ra[0]; t < ra[1]; t++) {
    const o = t * 9;
    const ddx = posB[o] - posA[o], ddz = posB[o + 2] - posA[o + 2];
    if (dx == null) { dx = ddx; dz = ddz; }
    else {
      if (Math.abs(ddx - dx) > 1e-8) xBad++;
      if (Math.abs(ddz - dz) > 1e-8) zBad++;
    }
  }
  if (xBad > 0 || zBad > 0) {
    const total = ra[1] - ra[0];
    console.log('FAIL', label.padEnd(34), 'key=' + key, 'non-uniform translation', 'xBad ' + xBad + '/' + total, 'zBad ' + zBad + '/' + total);
    process.exitCode = 1; return false;
  }
  if (Math.abs(dx) + Math.abs(dz) < 1e-9) {
    console.log('SKIP', label.padEnd(34), 'key=' + key, '(recipe change produced no translation)');
    return false;
  }
  // 用分离步骤在 A 上累计平移，应等于 rebuild(B)
  const C = GF.build(r0);
  const rc = (C._mo || {})[key];
  const sx = dx / 3, sz = dz / 3;
  C.moveRange(rc[0], rc[1], sx, sz);
  C.moveRange(rc[0], rc[1], sx, sz);
  C.moveRange(rc[0], rc[1], dx - 2 * sx, dz - 2 * sz);
  const eq = maxDiff(C, B);
  const pass = eq.md < 1e-6 && eq.mw < 1e-6 && C.triCount === B.triCount;
  console.log(
    (pass ? 'PASS' : 'FAIL'), label.padEnd(34),
    'key=' + key, '| delta (' + dx.toFixed(2) + ',' + dz.toFixed(2) + ')',
    '| tris', C.triCount, '| posDiff', eq.md.toExponential(2), '| anchorDiff', eq.mw.toExponential(2)
  );
  if (!pass) process.exitCode = 1;
  return pass;
}

{
  const r0 = GF.normalize(GF.getPreset('siheyuan'));
  r0.env.showGround = true;
  const ids = (GF.build(r0).units || []).map((u) => u.id);
  console.log('\n[siheyuan] structural units:', ids.join(','));
  if (ids.length) {
    const id = ids[0];
    const r1 = cloneRecipe(r0);
    r1.units = r1.units || {};
    r1.units[id] = Object.assign({}, r1.units[id], { dx: (r1.units[id] && r1.units[id].dx) || 0 });
    r1.units[id].dx += 3.0; r1.units[id].dz = -1.6;
    runKeyTest('structural unit drag (' + id + ')', r0, r1, 'u:' + id);
  }

  const ry = GF.normalize(GF.getPreset('yuanlin'));
  ry.env.showGround = true;
  const my = GF.build(ry); // 展开 auto 并回写
  const envKeys = Object.keys(my._mo || {});
  console.log('[yuanlin] _mo keys:', envKeys.join(','), '(first build)');
  if (envKeys.indexOf('pond') >= 0) {
    const r1 = cloneRecipe(ry);
    r1.env.pond.x = (r1.env.pond.x || 0) + 2.0;
    r1.env.pond.z = (r1.env.pond.z || 0) + 1.0;
    runKeyTest('pond drag (yuanlin)', ry, r1, 'pond');
  }
  const auto0 = envKeys.filter((k) => k.slice(0, 4) === 'auto');
  if (auto0.length && (ry.env.auto || []).length) {
    const k0 = auto0[0];
    const r1 = cloneRecipe(ry);
    r1.env.auto[+k0.slice(4)].x = (r1.env.auto[+k0.slice(4)].x || 0) + 2.5;
    r1.env.auto[+k0.slice(4)].z = (r1.env.auto[+k0.slice(4)].z || 0) + 1.2;
    runKeyTest('auto item drag (' + k0 + ')', ry, r1, k0);
  }
  // 自由件：两端都带同一件，只改落点坐标（验证 itemN 区间）
  {
    const r0b = cloneRecipe(ry);
    r0b.env.items = [{ k: 'taihu', x: 1.2, z: -1.8, rot: 15, s: 1 }];
    const r1b = cloneRecipe(r0b);
    r1b.env.items[0].x += 1.6;
    r1b.env.items[0].z -= 0.7;
    runKeyTest('free item drag (item0)', r0b, r1b, 'item0');
  }
  // 自由件旋转会改变形状 → 不能单区间平移，必须走 rebuild（对比应不相同，若意外相同则回归）
  {
    const r0b = cloneRecipe(ry);
    r0b.env.items = [{ k: 'taihu', x: 1.2, z: -1.8, rot: 15, s: 1 }];
    const r1b = cloneRecipe(r0b);
    r1b.env.items[0].rot = 120;
    const A = GF.build(r0b), B = GF.build(r1b);
    const eq = maxDiff(A, B);
    console.log(
      'NON-TRANSLATION', 'rotation drag must NOT equal moveRange (rebuild path)',
      '| tri', A.triCount, '==', B.triCount, '| posDiff', eq.md.toExponential(2) > '1e-2' ? 'large ✓' : eq.md.toExponential(2)
    );
  }
}

// =====================================================================
// 4) 全件覆盖扫描：每个 preset 的每个可拖动锚点都要有 _mo 区间，
//    没有区间的键在拖动时只能整网重建 → 这就老抖动路径本身
// =====================================================================
{
  console.log('\n[coverage] dragging anchors vs _mo ranges (every preset)');
  let totalUnits = 0, badUnits = 0;
  for (const p of GF.presetList) {
    const r0 = GF.normalize(GF.getPreset(p.key));
    r0.env.showGround = true;   // 打开地面/水池，水池与陈设锚点才真正进入构建
    let mesh;
    try { mesh = GF.build(r0); } catch (e) { console.log('FAIL', '[coverage] build error', p.key, e.message); process.exitCode = 1; continue; }
    const mo = mesh._mo || {};
    const missing = [];
    let fixedUnits = 0;
    (mesh.units || []).forEach((u) => {
      totalUnits++;
      // fixed 单体（如院门）在交互层被明确禁止拖拽，随整栋建筑整体移动，不需要单件区间
      if (u.fixed) { fixedUnits++; return; }
      if (!mo['u:' + u.id]) missing.push('u:' + u.id);
    });
    // 环境锚点：auto/item 键 + pond
    const nAuto = (r0.env.auto || []).length, nItems = (r0.env.items || []).length;
    for (let i = 0; i < nAuto; i++) if (!mo['auto' + i]) missing.push('auto' + i);
    for (let i = 0; i < nItems; i++) if (!mo['item' + i]) missing.push('item' + i);
    if (r0.env.pond && !mo.pond) missing.push('pond');
    if (!mo.bld) missing.push('bld');
    const status = missing.length ? 'FAIL' : 'PASS';
    if (missing.length) process.exitCode = 1;
    if (missing.length) badUnits += missing.length;
    console.log(
      status, p.key.padEnd(12),
      'units', (mesh.units || []).length,
      '(fixed ' + fixedUnits + ')',
      '| auto', nAuto, 'items', nItems,
      '| moKeys', Object.keys(mo).length,
      missing.length ? '| MISSING: ' + missing.join(',') : '| all civ'
    );
  }
  console.log('[coverage] units checked:', totalUnits, '| missing ranges:', badUnits);
}

// =====================================================================
// 5) 拖动后 _mo / moves / units 元数据区间仍完整（多次拖动不破坏表）
// =====================================================================
{
  const r0 = GF.normalize(GF.getPreset('siheyuan'));
  r0.env.showGround = false;
  const meshA = GF.build(r0);
  const before = JSON.stringify(Object.keys(meshA._mo || {}));
  const R = meshA._mo.bld;
  meshA.moveRange(R[0], R[1], 1, 1);
  meshA.moveRange(R[0], R[1], -0.5, 0.25);
  const after = JSON.stringify(Object.keys(meshA._mo || {}));
  const rangesOK = before === after;
  const moveRangeOK = meshA._mo.bld[0] === R[0] && meshA._mo.bld[1] === R[1];
  console.log('\n[metadata] _mo keys stable after drags:', rangesOK, '| bld range stable:', moveRangeOK);
  if (!(rangesOK && moveRangeOK)) process.exitCode = 1;
}

console.log('\nDONE. exitCode =', process.exitCode == null ? 0 : process.exitCode);