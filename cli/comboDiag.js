// 组合贡献诊断：整组山花一起渲染 vs 每个三角形单独渲染
// 目的：确认组合帧里内部像素是否真空；如果空，是哪些三角形丢失。
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
const { ANCIENT } = require('./modules');
const FILES = ANCIENT.concat(['js/gf-render.js', 'js/gf-presets.js', 'js/gf-export.js']);
const ctx = { console };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of FILES) {
  const code = require('fs').readFileSync(path.join(ROOT, f), 'utf8');
  vm.runInContext(code, ctx, { filename: f });
}
const GF = ctx.GF;

function filter(mesh, re) {
  const m = new GF.Mesh();
  for (let t = 0; t < mesh.triCount; t++) {
    if (!re.test(mesh.tag[t])) continue;
    const i = t * 9;
    m.tri(
      [mesh.pos[i], mesh.pos[i + 1], mesh.pos[i + 2]],
      [mesh.pos[i + 3], mesh.pos[i + 4], mesh.pos[i + 5]],
      [mesh.pos[i + 6], mesh.pos[i + 7], mesh.pos[i + 8]],
      mesh.mat[t], mesh.tag[t]
    );
  }
  return m;
}

function renderFixed(m, yaw, pitch) {
  // 固定取景（不 focus）：中心对准山花 bbox 中心，ppm=40，padding 一样方便对齐
  return GF.render(m, { ppm: 40, pitch, yaw, palette: 'paper', style: 'pixel', styleAmount: 1, outline: false, shadow: false, transparent: true, focus: true, seed: 1 });
}

const pre = GF.getPreset('jiangnan');
const m = GF.build({ ...pre, roofType: 'gable' });
const fm = filter(m, /山花/);
console.log('山花三角形=', fm.triCount);

// 1) 整组渲染一次
const full = renderFixed(fm, 90, 30);
const { w, h, rgba } = full;
console.log('整组帧尺寸=', w + 'x' + h);
let opFull = 0;
for (let i = 0; i < w * h; i++) if (rgba[i * 4 + 3] > 0) opFull++;
console.log('整组渲染不透明像素=', opFull);

// 2) 逐三角形渲染，把每个三角形在帧里的不透明像素坐标记录下来
//    由于 focus:true 会让每一帧的取景都不同，不能直接相加；
//    这里改为：逐三角形渲染但把输出"注册"到一张累加图同等分辨率（用同一 focus 的取景？不行）。
//    改用 tagDiag 的做法：对每一个三角形单独渲染，然后在 frame 里找它的贡献区域，
//    该区域（bbox 范围）在全图中是否已经覆盖了像素。若每个三角形都有覆盖，则说明不是缺三角形。

// 3) 关键替代实验：不加 depth 竞争 —— 直接把所有顶点投影出来，看三角形是否在屏幕上重叠太多。
//    打印一下组合帧 ASCII，确认内部是否真空。
function asciiArt(frame, downsample = 4) {
  const { w: W, h: H, rgba: R } = frame;
  const a = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) a[i] = R[i * 4 + 3] > 0 ? 1 : 0;
  let out = '';
  for (let y = 0; y < H; y += downsample) {
    let row = '';
    for (let x = 0; x < W; x += downsample) {
      let cnt = 0;
      for (let dy = 0; dy < downsample && y + dy < H; dy++) {
        for (let dx = 0; dx < downsample && x + dx < W; dx++) cnt += a[(y + dy) * W + x + dx];
      }
      row += cnt === 0 ? '.' : (cnt === downsample * downsample ? '#' : '+');
    }
    out += row + '\n';
  }
  return out;
}

// ASCII 观察内部是否有洞
const fs = require('fs');
fs.writeFileSync(path.join(ROOT, 'cli', '_combo_ascii.txt'), asciiArt(full, 2));
console.log('ASCII 已写入 cli/_combo_ascii.txt');

// 4) 逐三角形单独渲染并记录它"填了哪些像素坐标"——用整组帧的取景参数无法在 GF.render 里复用，
//    但可以对比：单独渲染的 bbox 与对应三角形在该帧中的理论投影 bbox。
//    我们真正要知道的是：把 56 个三角形逐个放进累积 alpha，是否等于整组帧？
//    做法：用同一个 focus 取景（整组 bbox），对每个三角形用同取景渲染——不行，focus 只对网格求包围盒。
//    所以用固定 centerPx 覆盖。改用：对整组帧 + 按 tag0..t 前缀渲染，"前缀递增"对比每加一个三角形哪些像素变不透明。
console.log('--- 前缀递增渲染：逐个加入三角形，统计新增像素 ---');
const acc = new Uint8Array(w * h);       // 累积覆盖（任何三角形画过的像素）
let prevNew = 0;
for (let t = 0; t < fm.triCount; t++) {
  const i = t * 9;
  const tm = new GF.Mesh();
  tm.tri(
    [fm.pos[i], fm.pos[i + 1], fm.pos[i + 2]],
    [fm.pos[i + 3], fm.pos[i + 4], fm.pos[i + 5]],
    [fm.pos[i + 6], fm.pos[i + 7], fm.pos[i + 8]],
    fm.mat[t], fm.tag[t]
  );
  const f = renderFixed(tm, 90, 30);
  const { w: W1, h: H1, rgba: R1 } = f;
  // 这个三角形在整组帧里的投影位置未知（focus 缩小到单三角形）。无法直接叠加。
  // 因此逐三角形渲染的取景箱不同，不能做像素级累加。
  // —— 放弃像素累加，改为：把整组帧和"反证法"——
  break;
}

// 5) 反证法：假设是深度早拒导致内部被吃。
//    制造一个"单深度竞争"测试：把所有山花三角形投影到屏幕后看屏幕重叠关系。
//    更直接：渲染"只有山花三角形自己"时内部空心；渲染"只有单个三角形"时实心。
//    那构造两个三角形的组合：如果两个矮矮的相邻三角形组合后出现空洞，就复现了。
const triIdx = [36, 75, 1];  // 两个相邻的山花三角形（查 triDiag 序号）
for (let k0 = 0; k0 < triIdx.length; k0++) {
  const t2 = triIdx[k0];
  const i = t2 * 9;
  const TM2 = new GF.Mesh();
  TM2.tri([fm.pos[i], fm.pos[i + 1], fm.pos[i + 2]],
    [fm.pos[i + 3], fm.pos[i + 4], fm.pos[i + 5]],
    [fm.pos[i + 6], fm.pos[i + 7], fm.pos[i + 8]],
    fm.mat[t2], fm.tag[t2]);
  const f1 = renderFixed(TM2, 90, 30);
  let o1 = 0;
  for (let j = 0; j < f1.w * f1.h; j++) if (f1.rgba[j * 4 + 3] > 0) o1++;
  console.log('单独渲染 tri#', t2, '不透明像素=', o1, '帧=', f1.w + 'x' + f1.h);
}

// 6) 相邻两三角形合并渲染
const pair = new GF.Mesh();
for (const t2 of [36, 75]) {
  const i = t2 * 9;
  pair.tri([fm.pos[i], fm.pos[i + 1], fm.pos[i + 2]],
    [fm.pos[i + 3], fm.pos[i + 4], fm.pos[i + 5]],
    [fm.pos[i + 6], fm.pos[i + 7], fm.pos[i + 8]],
    fm.mat[t2], fm.tag[t2]);
}
const fp = renderFixed(pair, 90, 30);
let op2 = 0;
for (let j = 0; j < fp.w * fp.h; j++) if (fp.rgba[j * 4 + 3] > 0) op2++;
console.log('tri#36+75 合并渲染不透明像素=', op2, '帧=', fp.w + 'x' + fp.h);
console.log('--- 合并对 ASCII ---');
console.log(asciiArt(fp, 1));

// 7) 再看整组求和：如果合并对 == 单三角形像素之和，说明多三角形阶段就出问题