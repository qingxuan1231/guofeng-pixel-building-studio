#!/usr/bin/env node
/* 开发自检：把若干“变体配方”排成一张拼版，方便快速比对
 * 用法：node cli/dev-probe.js out/probe.png
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const FILES = [
  'js/gf-core.js', 'js/gf-roof.js', 'js/gf-parts.js',
  'js/gf-build.js', 'js/gf-render.js', 'js/gf-presets.js', 'js/gf-export.js'
];

function loadGF() {
  const ctx = { console };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  return ctx.GF;
}

const GF = loadGF();
const out = process.argv[2] || path.join(ROOT, 'out', 'probe.png');
const base = GF.getPreset('xieshan');

const VARIANTS = [
  { t: '像素硬边', o: {} },
  { t: '水墨手绘', o: { render: { palette: 'moxi', style: 'ink', styleAmount: 0.8 } } },
  { t: '枯笔速写', o: { render: { palette: 'qingya', style: 'sketch', styleAmount: 0.9 } } },
  { t: '赭石双套印', o: { render: { palette: 'zheshi', style: 'wash', styleAmount: 0.9 } } },
  { t: '青绿绢本', o: { render: { palette: 'qinglv', style: 'ink', styleAmount: 0.65 } } },
  { t: '卷棚+悬鱼', o: { roofType: 'roll', xuanYu: true, windDuo: true, render: { style: 'ink', styleAmount: 0.75 } } },
  { t: '十字歇山', o: { roofType: 'cross', depth: 9.4, bays: 5, render: { style: 'sketch', styleAmount: 0.8 } } },
  { t: '盝顶', o: { roofType: 'lu', render: { style: 'ink', styleAmount: 0.8 } } }
];

const frames = [];
for (const v of VARIANTS) {
  const rec = GF.normalize(Object.assign(JSON.parse(JSON.stringify(base)), v.o));
  if (v.o.render) rec.render = Object.assign(rec.render, v.o.render);
  const mesh = GF.build(rec);
  const f = GF.render(mesh, {
    ppm: 17, pitch: 32, yaw: 45, palette: rec.render.palette,
    style: rec.render.style, styleAmount: rec.render.styleAmount,
    outline: true, shadow: true, transparent: true
  });
  console.log(v.t, 'tris', mesh.triCount, f.w + 'x' + f.h);
  frames.push(f);
}
const sheet = GF.composeSheet(frames, { pad: 6, cols: 4 });
fs.writeFileSync(out, GF.encodePNG(sheet.w, sheet.h, sheet.rgba));
console.log('->', out, sheet.w + 'x' + sheet.h);
