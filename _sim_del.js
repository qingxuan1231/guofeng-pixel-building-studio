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

function makeState() { return { recipe: null, selItem: null }; }
function envItems(st) {
  const e = st.recipe.env;
  const auto = Array.isArray(e.auto) ? e.auto : [];
  const items = Array.isArray(e.items) ? e.items : [];
  return auto.concat(items);
}
function autoCount(st) { return Array.isArray(st.recipe.env.auto) ? st.recipe.env.auto.length : 0; }
function removeEnvItem(st, idx) {
  const e = st.recipe.env;
  const n = autoCount(st);
  if (idx < n) e.auto.splice(idx, 1); else e.items.splice(idx - n, 1);
}
function rebuild(st) {
  GF.build(st.recipe, { ppm: st.recipe.render.ppm });
  if (st.selItem != null && !envItems(st)[st.selItem]) st.selItem = null;
}
function switchTo(st, key) { st.recipe = GF.getPreset(key); st.selItem = null; rebuild(st); }
function del(st) { if (st.selItem == null) return; removeEnvItem(st, st.selItem); st.selItem = null; rebuild(st); }
function declared(st) {
  const e = st.recipe.env;
  const m = new Map();
  (e.trees || []).forEach((k) => m.set(k, (m.get(k) || 0) + 1));
  m.set('taihu', (m.get('taihu') || 0) + (e.rocks || 0));
  m.set('banner', (m.get('banner') || 0) + (e.banners || 0));
  (e.props || []).forEach((k) => { if (k === 'qubridge') return; m.set(k, (m.get(k) || 0) + 1); });
  return m;
}
function present(st) {
  const m = new Map();
  envItems(st).forEach((it) => m.set(it.k, (m.get(it.k) || 0) + 1));
  return m;
}
function mapEq(a, b) {
  const keys = new Set([...a.keys(), ...b.keys()]);
  for (const k of keys) if ((a.get(k) || 0) !== (b.get(k) || 0)) return false;
  return true;
}

// —— 组件条 COMPONENTS 与 buildItem 渲染白名单（与源码一致，供三层对照）——
const COMPONENTS_KEYS = [
  'pine', 'plum', 'bamboo', 'willow', 'maple', 'gingko', 'leaf', 'misc', 'banana',
  'taihu', 'qianshi', 'stonelamp', 'well', 'stele', 'bell', 'drum',
  'penjing', 'tiema', 'table', 'stool', 'banner'
];
const BUILD_ITEM_KEYS = [ // here: 仅支持 P.tree/P.rock/各陈设，其中树类白名单来自 buildItem 的 case
  'pine', 'plum', 'bamboo', 'willow', 'maple', 'gingko', 'leaf', 'misc', 'banana',
  'taihu', 'qianshi', 'stonelamp', 'well', 'stele', 'bell', 'drum',
  'penjing', 'tiema', 'table', 'stool', 'banner'
];

console.log('================ 普查A：配方键 vs 组件条卡片 vs 渲染白名单 ================');
const declaredAll = new Map();
GF.presetList.forEach(({ key }) => {
  const st = makeState(); switchTo(st, key);
  declared(st).forEach((n, k) => declaredAll.set(k, (declaredAll.get(k) || 0) + n));
});
for (let i = 0; i < 300; i++) {
  const st = makeState();
  st.recipe = GF.randomRecipe(7000 + i); rebuild(st);
  declared(st).forEach((n, k) => declaredAll.set(k, (declaredAll.get(k) || 0) + n));
}

console.log('—— 配方声明到的全部组件键（50预设 + 300随机）——');
console.log('  ', [...declaredAll.keys()].sort().join(' '));
const missingCards = [...declaredAll.keys()].filter((k) => !COMPONENTS_KEYS.includes(k));
console.log('声明有、但组件条【无卡片】:', missingCards.length ? missingCards.join(' ') : '无');
const missingRender = [...declaredAll.keys()].filter((k) => !BUILD_ITEM_KEYS.includes(k));
console.log('声明有、但构建渲染【白名单无】:', missingRender.length ? missingRender.join(' ') : '无');
const cardNoDeclare = COMPONENTS_KEYS.filter((k) => !declaredAll.has(k));
console.log('组件条有卡片、但任何配方都没声明:', cardNoDeclare.length ? cardNoDeclare.join(' ') : '无');

console.log('================ 场景1：删除后保存→重载，重载结果必须与删除瞬态【完全一致】 ================');
let s1Bug = 0;
GF.presetList.forEach(({ key, name }) => {
  const st = makeState();
  switchTo(st, key);
  if (envItems(st).length) { st.selItem = 0; del(st); }
  if (envItems(st).length) { st.selItem = Math.min(envItems(st).length - 1, autoCount(st) + 1); del(st); }
  const pBeforeSave = present(st);
  const json = JSON.stringify(st.recipe, null, 2);
  const st2 = makeState();
  st2.recipe = GF.normalize(JSON.parse(json));
  rebuild(st2);
  if (!mapEq(declared(st2), declared(st)) || !mapEq(present(st2), pBeforeSave)) {
    s1Bug++;
    console.log('  [重载漂移]', key, name, '瞬态', [...pBeforeSave.entries()].map((x) => x.join(':')).join(','),
      '→ 重载', [...present(st2).entries()].map((x) => x.join(':')).join(','));
  }
});
console.log('重载后列表与删除瞬态不一致:', s1Bug, '/', 50);

console.log('================ 场景2：删除前后差额必须恰好=被删件，其它零牵连 ================');
let s2Bug = 0;
GF.presetList.forEach(({ key, name }) => {
  const st = makeState();
  switchTo(st, key);
  const p0 = present(st);
  if (envItems(st).length) {
    const victim = envItems(st)[0].k;
    st.selItem = 0; del(st);
    const p1 = present(st);
    if ((p1.get(victim) || 0) !== (p0.get(victim) || 0) - 1) {
      s2Bug++;
      console.log('  [删除不精确]', key, name, '受害者', victim, p0.get(victim), '→', p1.get(victim));
    }
    const others = [...p0.keys()].filter((k) => k !== victim);
    for (const k of others) {
      if ((p1.get(k) || 0) !== (p0.get(k) || 0)) {
        s2Bug++;
        console.log('  [牵连丢失]', key, name, '组件', k, p0.get(k), '→', p1.get(k));
      }
    }
  }
});
console.log('删除单件后发生「非预期丢失或牵连」:', s2Bug, '/', 50);

console.log('================ 场景3：随机配方删除后重载一致性（250 批次） ================');
let s3Bug = 0;
for (let i = 0; i < 250; i++) {
  const st = makeState();
  st.recipe = GF.randomRecipe(15000 + i); rebuild(st);
  if (envItems(st).length) { st.selItem = 0; del(st); }
  if (envItems(st).length) { st.selItem = Math.floor(envItems(st).length / 2); del(st); }
  const pBefore = present(st);
  const st2 = makeState();
  st2.recipe = GF.normalize(JSON.parse(JSON.stringify(st.recipe)));
  rebuild(st2);
  if (!mapEq(present(st2), pBefore) || !mapEq(declared(st2), declared(st))) {
    s3Bug++;
    if (s3Bug < 6) console.log('  [随机重载漂移] seed', 15000 + i);
  }
}
console.log('随机配方「删除→保存→重载」不一致:', s3Bug, '/', 250);

console.log('================ 场景4：删除后组件条能逐键重建（键→卡片一一对应） ================');
const st = makeState();
switchTo(st, GF.presetList[0].key);
while (envItems(st).length) { st.selItem = 0; del(st); }
const reAdd = [...declared(st).keys()]
  .map((k) => (COMPONENTS_KEYS.includes(k) ? '可重建:' + k : '找不齐:' + k));
console.log('主配方删空后，声明键重建覆盖率:', reAdd.join(' '));

const summary = [];
summary.push(['普查A 卡片缺口', missingCards]);
summary.push(['普查A 渲染白名单缺口', missingRender]);
summary.push(['场景1 重载漂移', s1Bug], ['场景2 删除不精确/牵连', s2Bug], ['场景3 随机重载漂移', s3Bug]);
console.log('================ 汇总 ================');
summary.forEach(([t, v]) => console.log(' ', t, '→', Array.isArray(v) ? (v.length ? v.join(',') : '无') : v));