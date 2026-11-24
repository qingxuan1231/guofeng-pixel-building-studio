/* 控件有效性审计：对每种建筑类型，逐个参数换值，比较网格（顶点+材质）是否真的变化。
   每一项可带 need（前置配方），避免“开关没开所以看不出”的误判。 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { ANCIENT } = require('./modules');
const ROOT = path.join(__dirname, '..');

const ctx = { console };
ctx.window = ctx;
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ANCIENT.concat(['js/gf-render.js', 'js/gf-presets.js'])) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}
const GP = ctx.GF;

function sig(mesh) {
  let h = 2166136261;
  for (let i = 0; i < mesh.pos.length; i++) {
    h ^= Math.round(mesh.pos[i] * 1000) | 0;
    h = Math.imul(h, 16777619) >>> 0;
  }
  let hm = 2166136261;
  for (let i = 0; i < mesh.mat.length; i++) {
    const s = String(mesh.mat[i]);
    for (let k = 0; k < s.length; k++) {
      hm ^= s.charCodeAt(k);
      hm = Math.imul(hm, 16777619) >>> 0;
    }
  }
  return mesh.triCount + ':' + h + ':' + hm;
}

const BASE = {
  hall: { type: 'hall', preset: 'qing' },
  house: { type: 'house', preset: 'jiangnan' },
  courtyard: { type: 'courtyard', preset: 'siheyuan' },
  pavilion: { type: 'pavilion', preset: 'ting' },
  pagoda: { type: 'pagoda', preset: 'ta' },
  ge: { type: 'ge', preset: 'chongge' },
  xie: { type: 'xie', preset: 'shuixie' },
  fang: { type: 'fang', preset: 'huafang' },
  archway: { type: 'archway', preset: 'paifang' },
  gate: { type: 'gate', preset: 'chenglou' },
  que: { type: 'que', preset: 'que' },
  corridor: { type: 'corridor', preset: 'changlang' },
  tai: { type: 'tai', preset: 'luntai' },
  bridge: { type: 'bridge', preset: 'langqiao' }
};

// {a, b, need}：need 为前置配方片段
const P = {
  bays: { a: 3, b: 5 }, bayW: { a: 2.8, b: 3.8 }, depth: { a: 4.5, b: 8 },
  floors: { a: 1, b: 2 }, floorH: { a: 3.0, b: 4.2 },
  baseH: { a: 0.3, b: 1.1 }, steps: { a: 1, b: 5 },
  railing: { a: false, b: true },
  pedestal: { a: 'xumizuo', b: 'plain' },
  railStyle: { a: 'marble', b: 'wood', need: { railing: true } },
  radius: { a: 1.8, b: 3.0 }, sides: { a: 4, b: 8 },
  tiers: { a: 1, b: 2 },
  courtW: { a: 16, b: 24 }, courtD: { a: 16, b: 24 },
  width: { a: 9, b: 15 }, wallH: { a: 4, b: 7 }, span: { a: 9, b: 16 },
  roofType: { a: 'hip', b: 'gable' },
  tileColor: { a: 'grey', b: 'yellow' },
  eave: { a: 0.7, b: 1.8 }, slope: { a: 0.35, b: 0.75 }, upturn: { a: 0.05, b: 0.65 },
  ridgeStyle: { a: 'plain', b: 'ornate' },
  beasts: { a: 0, b: 4, need: { ridgeStyle: 'plain' } },
  finial: { a: false, b: true, need: { roofType: 'lu' } },
  trimColor: { a: 'none', b: 'gold' },
  xuanYu: { a: false, b: true, need: { roofType: 'gable' } },
  windDuo: { a: false, b: true },
  wallMat: { a: 'plaster', b: 'brick' }, colMat: { a: 'timber', b: 'zhu' },
  winPattern: { a: 'straight', b: 'ice' }, winW: { a: 1.0, b: 2.0 }, winH: { a: 1.0, b: 2.2 },
  doorStyle: { a: 'leaf', b: 'panel' }, doorW: { a: 1.4, b: 2.6 }, doorH: { a: 2.2, b: 3.2 },
  dougong: { a: false, b: true },
  dgStyle: { a: 'mid', b: 'full', need: { dougong: true } },
  dgEye: { a: false, b: true, need: { dougong: true } },
  queti: { a: false, b: true },
  plaque: { a: false, b: true }, couplet: { a: false, b: true },
  menZan: { a: false, b: true }, baogu: { a: false, b: true },
  ceiling: { a: 'none', b: 'caisson', need: { cut: { roof: true } } },
  lanterns: { a: false, b: true }, lions: { a: false, b: true }, censer: { a: false, b: true },
  horseWall: { a: false, b: true },
  courtStyle: { a: 'siheyuan', b: 'garden' }
};

function buildOf(t, extra) {
  const base = GP.getPreset(BASE[t].preset);
  const need = extra.need || {};
  const probe = Object.assign({}, extra);
  delete probe.need;
  return GP.build(GP.normalize(Object.assign({}, base, need, probe)));
}

const types = Object.keys(BASE);
const report = {};
for (const t of types) {
  const bad = [];
  const good = [];
  for (const k of Object.keys(P)) {
    const pr = P[k];
    const s0 = sig(buildOf(t, Object.assign({}, pr, { need: pr.need, [k]: pr.a })));
    const s1 = sig(buildOf(t, Object.assign({}, pr, { need: pr.need, [k]: pr.b })));
    (s0 === s1 ? bad : good).push(k);
  }
  report[t] = { bad, good };
}
for (const t of types) {
  console.log('[' + t + '] 无效:', report[t].bad.join(', ') || '无');
}
const keys = Object.keys(P);
console.log('\n按参数横向看（哪些类型不响应）:');
for (const k of keys) {
  const no = types.filter((t) => report[t].bad.indexOf(k) >= 0);
  console.log(k.padEnd(10), no.join('/') || '全部生效');
}
