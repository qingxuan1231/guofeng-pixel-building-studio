#!/usr/bin/env node
/* 国风古建像素工坊 · 命令行渲染器
 * 用法：
 *   node cli/render.js --preset qing --out out/qing.png
 *   node cli/render.js --preset tang --dirs 4 --out out/tang_sheet.png
 *   node cli/render.js --all --outdir out
 *   node cli/render.js --recipe my.json --out out/custom.png --ppm 24 --yaw 45
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const { ANCIENT } = require('./modules');
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

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) { out[key] = next; i++; }
      else out[key] = true;
    }
  }
  return out;
}

const args = parseArgs(process.argv);
const GF = loadGF();
const outDir = args.outdir || path.join(ROOT, 'out');
fs.mkdirSync(outDir, { recursive: true });

function renderOne(recipe, opts) {
  const mesh = GF.build(recipe);
  if (args.debug) console.log('tris', mesh.triCount, 'bounds', JSON.stringify(mesh.bounds()));
  const yaws = [];
  const n = Number(opts.dirs || 1);
  const step = 360 / Math.max(1, n);
  for (let i = 0; i < n; i++) yaws.push((Number(opts.yaw == null ? 45 : opts.yaw) + i * step) % 360);
  const frames = yaws.map((yaw) => GF.render(mesh, {
    ppm: Number(opts.ppm || args.ppm || recipe.render.ppm || 20),
    pitch: Number(opts.pitch == null ? recipe.render.pitch : opts.pitch),
    yaw,
    palette: opts.palette || recipe.render.palette,
    style: opts.style || recipe.render.style || 'pixel',
    styleAmount: opts.styleAmount == null ? recipe.render.styleAmount : Number(opts.styleAmount),
    outline: recipe.render.outline !== false,
    shadow: args.shadow ? String(args.shadow) !== 'off' : (recipe.render.shadow !== false),
    sunAz: recipe.render.sunAz == null ? null : Number(recipe.render.sunAz),
    shadowAngle: recipe.render.shadowAngle == null ? null : Number(recipe.render.shadowAngle),
    transparent: recipe.render.transparent !== false,
    focus: !(recipe.env && recipe.env.showGround === true),
    seed: recipe.seed
  }));
  return frames;
}

function savePng(frame, file) {
  const png = GF.encodePNG(frame.w, frame.h, frame.rgba);
  fs.writeFileSync(file, png);
  console.log('->', file, frame.w + 'x' + frame.h, (png.length / 1024).toFixed(1) + 'KB');
}

if (args.all) {
  const list = GF.presetList;
  for (const p of list) {
    const recipe = GF.getPreset(p.key);
    const frames = renderOne(recipe, { dirs: 1 });
    savePng(frames[0], path.join(outDir, `preset_${p.key}.png`));
  }
  // 随机一枚（沿用配方自带的随机 ppm / 配色，不被命令行 --ppm 覆盖）
  const rr = GF.randomRecipe(20261123);
  const f2 = renderOne(rr, { dirs: 1, ppm: rr.render.ppm });
  savePng(f2[0], path.join(outDir, 'preset_random.png'));
} else {
  let recipe;
  if (args.recipe) {
    recipe = GF.normalize(JSON.parse(fs.readFileSync(args.recipe, 'utf8')));
  } else {
    recipe = GF.getPreset(args.preset || 'jiangnan');
  }
  if (args.cutroof) recipe.cut.roof = true;
  if (args.cutwalls) recipe.cut = { front: true, right: true, left: false, back: false, roof: recipe.cut.roof };
  if (args.palette) recipe.render.palette = args.palette;
  if (args.ppm) recipe.render.ppm = Number(args.ppm);
  const frames = renderOne(recipe, { dirs: args.dirs, yaw: args.yaw, ppm: args.ppm, pitch: args.pitch, palette: args.palette, style: args.style, styleAmount: args.styleAmount });
  if (frames.length > 1) {
    const sheet = GF.composeSheet(frames, { pad: 8, cols: frames.length <= 4 ? frames.length : 4 });
    savePng(sheet, args.out || path.join(outDir, 'sheet.png'));
  } else {
    savePng(frames[0], args.out || path.join(outDir, 'render.png'));
  }
}
