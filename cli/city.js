#!/usr/bin/env node
/* 城池工坊 · 命令行渲染（自检用）
 * node cli/city.js --ppm 20 --pitch 52 --yaw 35 --out out/预览/city.png
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const FILES = ['js/gf-core.js', 'js/gf-roof.js', 'js/gf-parts.js', 'js/gf-build.js',
  'js/gf-render.js', 'js/gf-presets.js', 'js/gf-export.js', 'js/gf-city.js'];

function loadGF() {
  const ctx = { console };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  return ctx.GF;
}

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) {
    const k = a.slice(2), n = process.argv[i + 1];
    if (n && !n.startsWith('--')) {
      args[k] = n;
      i++;
    } else args[k] = true;
  }
}

const GF = loadGF();
const city = args.preset
  ? GF.getCityPreset(args.preset)
  : GF.cityNormalize({
  seed: Number(args.seed || 20261123),
  w: Number(args.w || 100),
  d: Number(args.d || 88),
  wallH: Number(args.wallH || 9),
  cols: Number(args.cols || 3),
  rows: Number(args.rows || 3),
  density: args.density == null ? 0.9 : Number(args.density),
  moat: args.moat !== 'off',
  palace: args.palace !== 'off',
  tower: args.tower !== 'off'
});

const t0 = Date.now();
const mesh = GF.buildCity(city);
console.log('tris', mesh.triCount, 'build ms', Date.now() - t0);

const frame = GF.render(mesh, {
  ppm: Number(args.ppm || 20),
  pitch: Number(args.pitch || 52),
  yaw: Number(args.yaw || 35),
  palette: args.palette || 'qingya',
  style: 'pixel', styleAmount: 0.7, outline: true, shadow: true,
  transparent: true, focus: false, seed: city.seed
});

const out = args.out || path.join(ROOT, 'out/预览/city.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, GF.encodePNG(frame.w, frame.h, frame.rgba));
console.log('->', out, frame.w + 'x' + frame.h);
