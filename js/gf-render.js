/* ============================================================================
 * 国风古建像素工坊 · 像素化渲染器
 * 正交投影（2:1 像素等轴）→ 软件光栅化 z-buffer → 材质色阶 → 描边
 * ==========================================================================*/
(function (global) {
  'use strict';
  const GF = (global.GF = global.GF || {});
  const V = GF.V;

  // 材质 → 肌理类型：砌筑面做砖缝，木面做竖纹（其余材质保持纯色阶）
  const MAT_PAT = {
    brick: 'mason', brickB: 'mason', stone: 'mason', stoneB: 'mason',
    stoneDark: 'mason', slab: 'mason', marble: 'mason', marbleB: 'mason',
    plaster: 'plaster',
    wood: 'wood', woodDark: 'wood', timber: 'wood', zhu: 'wood',
    water: 'water', waterB: 'water'
  };

  // 相机基向量：yaw 绕 Y 轴，pitch 俯视角
  function camera(yawDeg, pitchDeg) {
    const th = (yawDeg * Math.PI) / 180;
    const ph = (pitchDeg * Math.PI) / 180;
    return {
      right: [Math.cos(th), 0, -Math.sin(th)],
      up: [-Math.sin(th) * Math.sin(ph), Math.cos(ph), -Math.cos(th) * Math.sin(ph)],
      view: [Math.sin(th) * Math.cos(ph), Math.sin(ph), Math.cos(th) * Math.cos(ph)]
    };
  }

  /* ----------------------------- 阴影贴图 ----------------------------- */
  function buildShadow(mesh, bounds, light, cell, skipSmall) {
    const kx = -light[0] / light[1];
    const kz = -light[2] / light[1];
    const minX = bounds.x0 - 2, maxX = bounds.x1 + 2;
    const minZ = bounds.z0 - 2, maxZ = bounds.z1 + 2;
    const gw = Math.max(1, Math.ceil((maxX - minX) / cell));
    const gh = Math.max(1, Math.ceil((maxZ - minZ) / cell));
    const grid = new Uint8Array(gw * gh);

    const fill = (ax, az, bx, bz, cx2, cz2) => {
      const gx0 = Math.max(0, Math.floor((Math.min(ax, bx, cx2) - minX) / cell));
      const gx1 = Math.min(gw - 1, Math.ceil((Math.max(ax, bx, cx2) - minX) / cell));
      const gz0 = Math.max(0, Math.floor((Math.min(az, bz, cz2) - minZ) / cell));
      const gz1 = Math.min(gh - 1, Math.ceil((Math.max(az, bz, cz2) - minZ) / cell));
      const area = (bx - ax) * (cz2 - az) - (cx2 - ax) * (bz - az);
      if (Math.abs(area) < 1e-9) return;
      for (let j = gz0; j <= gz1; j++) {
        for (let i = gx0; i <= gx1; i++) {
          const px = minX + (i + 0.5) * cell;
          const pz = minZ + (j + 0.5) * cell;
          const w0 = ((bz - cz2) * (px - cx2) + (cx2 - bx) * (pz - cz2)) / area;
          const w1 = ((cz2 - az) * (px - cx2) + (ax - cx2) * (pz - cz2)) / area;
          const w2 = 1 - w0 - w1;
          if (w0 >= -0.02 && w1 >= -0.02 && w2 >= -0.02) grid[j * gw + i] = 1;
        }
      }
    };

    for (let t = 0; t < mesh.triCount; t++) {
      const tag = mesh.tag[t];
      if (tag === 'ground') continue;
      const o = t * 9;
      const ax = mesh.pos[o] + kx * mesh.pos[o + 1], az = mesh.pos[o + 2] + kz * mesh.pos[o + 1];
      const bx = mesh.pos[o + 3] + kx * mesh.pos[o + 4], bz = mesh.pos[o + 5] + kz * mesh.pos[o + 4];
      const cx2 = mesh.pos[o + 6] + kx * mesh.pos[o + 7], cz2 = mesh.pos[o + 8] + kz * mesh.pos[o + 7];
      // 预览档：世界面积过小的面（截瓦、连檐、斗拱小斗）对 0.18m 阴影网格本就无贡献，直接跳过
      if (skipSmall) {
        const a2 = Math.abs((bx - ax) * (cz2 - az) - (cx2 - ax) * (bz - az)) * 0.5;
        if (a2 < 0.09) continue;
      }
      fill(ax, az, bx, bz, cx2, cz2);
    }
    return { grid, gw, gh, minX, minZ, cell };
  }

  function sampleShadow(sh, x, z) {
    if (!sh) return 0;
    const i = Math.floor((x - sh.minX) / sh.cell);
    const j = Math.floor((z - sh.minZ) / sh.cell);
    if (i < 0 || j < 0 || i >= sh.gw || j >= sh.gh) return 0;
    return sh.grid[j * sh.gw + i];
  }

  /* --------------------- 手绘风格化后处理 --------------------- */
  // 参考手绘风格的核心特征：毛笔墨线、线条松弛粗细不一、断笔不闭合、
  // 墨色浓淡不均、纸纹颗粒、蚀刻排线、双色套印轻微错位、留白
  function hashN(x, y, s) {
    let h = (x * 374761393 + y * 668265263 + s * 1013904223) | 0;
    h = ((h ^ (h >>> 13)) * 1274126177) | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function stylize(rgba, W, H, pal, shade, edge, inner, style, amount, seed, preview) {
    const A = amount;
    const R2 = preview ? 1 : 2;   // 水彩洇开半径：预览 3×3，导出 5×5
    const ink = pal.ink;
    const paper = GF.hex2rgb(pal.bg || '#f6f2e6');
    const sketch = style === 'sketch';
    const wash = style === 'wash';
    const gongbi = style === 'gongbi';     // 工笔重彩：色饱、线细、几乎无颗粒
    const woodcut = style === 'woodcut';   // 木刻版画：硬色块、粗黑线、排刀纹
    const rub = style === 'rubbing';       // 金石拓片：墨拓纸白、斑驳缺墨
    const wc = style === 'watercolor';     // 水彩：色块洇开、线淡、纸纹
    const grain = woodcut ? 0 : rub ? 10 : gongbi ? 1.5 : wc ? 4 : sketch ? 8 : 5;
    const src0 = wc ? new Uint8ClampedArray(rgba) : null;

    // 一、颗粒 / 墨色浓淡 / 排线 / 各画风的色彩倾向
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const p = y * W + x;
        if (rgba[p * 4 + 3] === 0) continue;
        let r = rgba[p * 4], g = rgba[p * 4 + 1], b = rgba[p * 4 + 2];
        const n = (hashN(x, y, seed) - 0.5) * grain * A;
        const blk = 1 + (hashN(x >> 2, y >> 2, seed + 3) - 0.5) * 0.13 * A;
        r = r * blk + n; g = g * blk + n * 0.92; b = b * blk + n * 0.84;

        if (woodcut) {
          // 版画：按明度压成 4 阶硬色块，保留原色相，形成套色木刻的平涂感
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          const lv = lum < 62 ? 50 : lum < 118 ? 104 : lum < 180 ? 160 : 214;
          const sc = lum > 1 ? lv / lum : 1;
          r = r * sc; g = g * sc; b = b * sc;
        }
        if (rub) {
          // 拓片：按明度转成“纸—墨”，整体去彩
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          const t = Math.min(1, (1 - lum / 255) * 1.28);
          r = paper[0] * (1 - t) + ink[0] * t;
          g = paper[1] * (1 - t) + ink[1] * t;
          b = paper[2] * (1 - t) + ink[2] * t;
        }
        if (gongbi) {
          // 重彩：提饱和 + 提亮受光面
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          r = lum + (r - lum) * 1.3;
          g = lum + (g - lum) * 1.22;
          b = lum + (b - lum) * 1.1;
          if (shade[p] === 2) { r += 12 * A; g += 9 * A; b += 4 * A; }
        }
        if (wc && src0) {
          // 水彩：5×5 大半径洇开 + 轻微去饱和、掺纸色，色块边缘留水痕
          let sr = 0, sg = 0, sb = 0, cnt = 0;
          for (let dy = -R2; dy <= R2; dy++) {
            for (let dx = -R2; dx <= R2; dx++) {
              const nx2 = x + dx, ny2 = y + dy;
              if (nx2 < 0 || ny2 < 0 || nx2 >= W || ny2 >= H) continue;
              const q = (ny2 * W + nx2) * 4;
              if (src0[q + 3] === 0) continue;
              const wgt = 3 - (Math.abs(dx) + Math.abs(dy)) * 0.55;
              sr += src0[q] * wgt; sg += src0[q + 1] * wgt; sb += src0[q + 2] * wgt; cnt += wgt;
            }
          }
          if (cnt > 0) {
            const k = 0.9 * A;
            r = r * (1 - k) + (sr / cnt) * k;
            g = g * (1 - k) + (sg / cnt) * k;
            b = b * (1 - k) + (sb / cnt) * k;
          }
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          r = (lum + (r - lum) * 0.84) * 0.9 + paper[0] * 0.1;
          g = (lum + (g - lum) * 0.84) * 0.9 + paper[1] * 0.1;
          b = (lum + (b - lum) * 0.84) * 0.9 + paper[2] * 0.1;
          const blo = (hashN(x >> 3, y >> 3, seed + 5) - 0.5) * 7 * A;
          r += blo; g += blo; b += blo;
        }

        if (shade[p] === 2) {
          r += paper[0] * 0.02 * A; g += paper[1] * 0.02 * A; b += paper[2] * 0.015 * A;
        }
        if (!woodcut && !gongbi && !wc && shade[p] <= 1 && ((x + y * 2) & 3) === 0) {
          const k = 1 - 0.19 * A;
          r *= k; g *= k; b *= k;
        }
        if (sketch && hashN(x, y, seed + 9) < 0.05 * A) { r *= 0.86; g *= 0.86; b *= 0.88; }
        rgba[p * 4] = r; rgba[p * 4 + 1] = g; rgba[p * 4 + 2] = b;
      }
    }

    // 一·补：版画排刀纹（暗面斜线）、拓片斑驳、工笔平涂压角
    if (woodcut) {
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const p = y * W + x;
          if (rgba[p * 4 + 3] === 0) continue;
          if (shade[p] <= 1) {
            const mod = shade[p] === 0 ? 3 : 5;
            if (((x + y) % mod) === 0) {
              const k = shade[p] === 0 ? 0.5 : 0.72;
              rgba[p * 4] *= k; rgba[p * 4 + 1] *= k; rgba[p * 4 + 2] *= k;
            }
          }
        }
      }
    }
    if (rub) {
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const p = y * W + x;
          if (rgba[p * 4 + 3] === 0) continue;
          // 缺墨：随机把一小部分往纸色回拉，像拓包没压实
          if (hashN(x, y, seed + 41) < 0.12 * A) {
            const k = 0.55;
            rgba[p * 4] = rgba[p * 4] * k + paper[0] * (1 - k);
            rgba[p * 4 + 1] = rgba[p * 4 + 1] * k + paper[1] * (1 - k);
            rgba[p * 4 + 2] = rgba[p * 4 + 2] * k + paper[2] * (1 - k);
          }
        }
      }
    }

    // 二、勾线：抖线 / 断笔 / 粗细变化
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const p = y * W + x;
        if (edge[p]) {
          if (woodcut) {
            // 版画：粗黑硬线，不断笔，边缘再压一格
            rgba[p * 4] = ink[0] * 0.86; rgba[p * 4 + 1] = ink[1] * 0.86; rgba[p * 4 + 2] = ink[2] * 0.86;
            for (const q of [y + 1 < H ? p + W : p, x + 1 < W ? p + 1 : p]) {
              if (rgba[q * 4 + 3] !== 0) { rgba[q * 4] *= 0.42; rgba[q * 4 + 1] *= 0.42; rgba[q * 4 + 2] *= 0.46; }
            }
            continue;
          }
          const brk = hashN(x, y, seed + 17);
          if (!gongbi && !wc && !rub && brk < 0.08 * A) continue; // 断笔：留白
          const soft = gongbi ? 0.66 : wc ? 0.4 : 0.9;
          const w2 = soft * (0.9 + 0.1 * hashN(x, y, seed + 23));
          let r = ink[0] * w2 + rgba[p * 4] * (1 - w2);
          let g = ink[1] * w2 + rgba[p * 4 + 1] * (1 - w2);
          let b = ink[2] * w2 + rgba[p * 4 + 2] * (1 - w2);
          rgba[p * 4] = r; rgba[p * 4 + 1] = g; rgba[p * 4 + 2] = b;
          if (!gongbi && !wc && !rub && hashN(x, y, seed + 23) > 0.5 - 0.2 * A) {
            const q = (y + 1 < H ? p + W : p);
            if (rgba[q * 4 + 3] !== 0 && !edge[q]) {
              rgba[q * 4] = r * 0.9; rgba[q * 4 + 1] = g * 0.9; rgba[q * 4 + 2] = b * 0.9;
            }
          }
        } else if (inner[p]) {
          const kk = woodcut ? 0.5 : gongbi ? 0.26 : wc ? 0.12 : (1 - 0.34 * (0.6 + 0.4 * A));
          rgba[p * 4] *= kk; rgba[p * 4 + 1] *= kk; rgba[p * 4 + 2] *= kk;
        }
      }
    }

    // 三、双色套印：红蓝通道左右各错开 1px（预览档跳过，导出才做）
    if (wash && A > 0.55 && !preview) {
      const copy = new Uint8ClampedArray(rgba);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const p = y * W + x;
          if (copy[p * 4 + 3] === 0) continue;
          const xr = Math.min(W - 1, x + 1), xb = Math.max(0, x - 1);
          const pr = y * W + xr, pb = y * W + xb;
          if (copy[pr * 4 + 3] !== 0) rgba[p * 4] = copy[pr * 4];
          if (copy[pb * 4 + 3] !== 0) rgba[p * 4 + 2] = copy[pb * 4 + 2];
        }
      }
    }
  }

  /* ------------------------------- 渲染 ------------------------------- */
  GF.render = function (mesh, o) {
    o = o || {};
    // GPU 快路径：交互预览走 WebGL2，失败（无 WebGL2 / 无 DOM / 显存不足）自动回落到下面的软件光栅化
    if (o.gpu && !o.cpu) {
      const rg = GF.renderGPU(mesh, o);
      if (rg) return rg;
    }
    let ppm = o.ppm || 25;
    const preview = !!o.preview;
    const pitch = o.pitch == null ? 30 : o.pitch;
    const yaw = o.yaw == null ? 45 : o.yaw;
    const pad = o.pad == null ? 8 : o.pad;
    const pal = GF.palette(o.palette || 'qingya');
    const cam = camera(yaw, pitch);
    let light = o.light || pal.light;
    // 可调光照方位：绕 Y 轴旋转光向量，方位角同时驱动明暗分面与投影方向
    if (o.sunAz != null && isFinite(o.sunAz)) {
      const h = Math.sqrt(light[0] * light[0] + light[2] * light[2]) || 1;
      const a = (o.sunAz * Math.PI) / 180;
      light = [Math.cos(a) * h, light[1], Math.sin(a) * h];
    }
    // 阴影长度：压低/抬高太阳高度（等于把投影拉长或收短）
    if (o.shadowAngle != null && isFinite(o.shadowAngle)) {
      light = [light[0], light[1] / o.shadowAngle, light[2]];
    }
    const outline = o.outline !== false;
    const shadowOn = o.shadow !== false;
    const transparent = o.transparent !== false;

    const b = mesh.bounds();
    if (!isFinite(b.x0)) return { w: 8, h: 8, rgba: new Uint8ClampedArray(8 * 8 * 4) };

    // 顶点投影
    const n = mesh.triCount * 3;
    const px = new Float32Array(n), py = new Float32Array(n), pz = new Float32Array(n);
    let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
    for (let i = 0; i < n; i++) {
      const vx = mesh.pos[i * 3], vy = mesh.pos[i * 3 + 1], vz = mesh.pos[i * 3 + 2];
      const sx = vx * cam.right[0] + vz * cam.right[2];
      const sy = vx * cam.up[0] + vy * cam.up[1] + vz * cam.up[2];
      const d = vx * cam.view[0] + vy * cam.view[1] + vz * cam.view[2];
      px[i] = sx; py[i] = -sy; pz[i] = d;
      if (px[i] < minx) minx = px[i]; if (px[i] > maxx) maxx = px[i];
      if (py[i] < miny) miny = py[i]; if (py[i] > maxy) maxy = py[i];
    }
    // 取景：默认以“建筑本体”为中心，地面/树木等环境只做背景，避免画面重心被地台拉偏
    let bx0 = minx, bx1 = maxx, by0 = miny, by1 = maxy;
    // 显示地面时不裁到建筑，改为包含整块铺装，并四周留白，保证地面四边都完整进画（不会被画布边缘切掉）
    if (o.focus === false) {
      const m2 = Math.max(0.5, Math.max(maxx - minx, maxy - miny) * 0.07);
      bx0 = minx - m2; bx1 = maxx + m2; by0 = miny - m2; by1 = maxy + m2;
    }
    if (o.focus !== false) {
      const ENV_TAGS = ['ground', '树', '假山', '水池', '幡', '石灯', '井', '碑', '钟', '鼓', '盆景', '拴马桩', '曲桥', '花池', '甬道'];
      let fx0 = 1e9, fx1 = -1e9, fy0 = 1e9, fy1 = -1e9, hit = 0;
      for (let t = 0; t < mesh.triCount; t++) {
        const tg = mesh.tag[t];
        if (ENV_TAGS.indexOf(tg) >= 0) continue;
        hit++;
        for (let k = 0; k < 3; k++) {
          const p = t * 3 + k;
          if (px[p] < fx0) fx0 = px[p]; if (px[p] > fx1) fx1 = px[p];
          if (py[p] < fy0) fy0 = py[p]; if (py[p] > fy1) fy1 = py[p];
        }
      }
      if (hit > 0 && isFinite(fx0)) {
        const m = Math.max(0.55, Math.max(fx1 - fx0, fy1 - fy0) * 0.16);
        bx0 = fx0 - m; bx1 = fx1 + m; by0 = fy0 - m; by1 = fy1 + m;
      }
    }
    let W = Math.max(4, Math.ceil((bx1 - bx0) * ppm) + pad * 2);
    let H = Math.max(4, Math.ceil((by1 - by0) * ppm) + pad * 2);
    let ox = -bx0 * ppm + pad, oy = -by0 * ppm + pad;
    /* 预览档：屏幕只看得到画布那么大，多出来的像素用户看不见。
     * maxPixels 由页面按画布实际尺寸传入，超出就等比降 ppm（导出档不传，永远全精度）。 */
    if (preview && o.maxPixels && W * H > o.maxPixels) {
      const k = Math.sqrt(o.maxPixels / (W * H));
      ppm = Math.max(1, ppm * k);
      W = Math.max(4, Math.ceil((bx1 - bx0) * ppm) + pad * 2);
      H = Math.max(4, Math.ceil((by1 - by0) * ppm) + pad * 2);
      ox = -bx0 * ppm + pad; oy = -by0 * ppm + pad;
    }

    const depth = new Float32Array(W * H).fill(-1e9);
    const rgba = new Uint8ClampedArray(W * H * 4);
    const matId = new Uint16Array(W * H);
    const shadeIdx = new Uint8Array(W * H);
    const groundMask = new Uint8Array(W * H);
    if (!transparent && pal.bg) {
      const bg = GF.hex2rgb(pal.bg);
      for (let i = 0; i < W * H; i++) {
        rgba[i * 4] = bg[0]; rgba[i * 4 + 1] = bg[1]; rgba[i * 4 + 2] = bg[2]; rgba[i * 4 + 3] = 255;
      }
    }

    /* 精度档位：
     *   preview = true  —— 屏幕上的交互预览。看不见的东西降档：
     *     · 背面/被遮住的小构件走单点遮挡剔除（预通道深度），不再白白填充
     *     · 阴影网格放粗、小面不进阴影、水彩洇开半径减半、双色套印跳过
     *   preview = false —— 导出 PNG / 多向精灵表 / ZIP，全精度，一条优化都不开
     * 遮挡剔除只影响"被前面挡住的小面"，画面观感一致；导出永远走全精度。
     */
    const tMark = o.timing ? Date.now() : 0;
    const marks = [];
    const mark = (label) => { if (o.timing) marks.push(label + ' ' + (Date.now() - tMark) + 'ms'); };

    // 结构细节一律满精度：预览只在“算多少像素”“跳过被挡的面”“阴影粗糙度”上省，
    // 斗拱、瓦垄、窗棂、起翘这些看得见的东西不降档（细节按密度 320 的标准做）
    const shKey = (preview ? 'P' : 'F') + '|' + light.join(',') + '|' + (preview ? 0.32 : 0.18);
    let sh = null;
    if (shadowOn) {
      // 阴影网格只跟光向与网格粗细有关，和视角无关：同一份网格在转动视角时直接复用
      const cache = mesh.__shCache;
      if (cache && cache.key === shKey) sh = cache.sh;
      else {
        sh = buildShadow(mesh, b, light, preview ? 0.32 : 0.18, preview);
        mesh.__shCache = { key: shKey, sh };
      }
    }
    mark('shadow');

    // 材质索引
    const matKeys = Object.keys(pal.mats);
    const matIndex = {};
    matKeys.forEach((k, i) => (matIndex[k] = i));
    const ramps = matKeys.map((k) => pal.mats[k]);

    const L = V.norm(light);
    const tmpC = [0, 0, 0];

    /* ---------- 遮挡剔除预通道（只在预览档开） ----------
     * 先用 1/2 分辨率把“大面”（屏幕面积 ≥ 12px²：墙、屋面、地面、水面）
     * 的深度扫一遍，主循环里对小面只取重心一点查这张低分辨率深度：
     * 若该处已有更近的几何，说明这块小面被前面的墙/屋面挡死，直接跳过填充。
     */
    let depthLo = null, lw = 0, lh = 0;
    const LO = 3;
    if (preview && mesh.triCount > 20000) {
      lw = Math.max(1, Math.ceil(W / LO));
      lh = Math.max(1, Math.ceil(H / LO));
      depthLo = new Float32Array(lw * lh).fill(-1e9);
      const s = 1 / LO;
      for (let t = 0; t < mesh.triCount; t++) {
        const i0 = t * 3, i1 = i0 + 1, i2 = i0 + 2;
        const X0 = (px[i0] * ppm + ox) * s, Y0 = (py[i0] * ppm + oy) * s;
        const X1 = (px[i1] * ppm + ox) * s, Y1 = (py[i1] * ppm + oy) * s;
        const X2 = (px[i2] * ppm + ox) * s, Y2 = (py[i2] * ppm + oy) * s;
        const A2 = (X1 - X0) * (Y2 - Y0) - (X2 - X0) * (Y1 - Y0);
        if (Math.abs(A2) < 3) continue;
        const ix0 = Math.max(0, Math.floor(Math.min(X0, X1, X2)));
        const ix1 = Math.min(lw - 1, Math.ceil(Math.max(X0, X1, X2)));
        const iy0 = Math.max(0, Math.floor(Math.min(Y0, Y1, Y2)));
        const iy1 = Math.min(lh - 1, Math.ceil(Math.max(Y0, Y1, Y2)));
        if (ix1 < ix0 || iy1 < iy0) continue;
        const invA2 = 1 / A2;
        const a0 = (Y1 - Y2) * invA2, b0 = (X2 - X1) * invA2;
        const a1 = (Y2 - Y0) * invA2, b1 = (X0 - X2) * invA2;
        const z0 = pz[i0], z1 = pz[i1], z2 = pz[i2];
        for (let y = iy0; y <= iy1; y++) {
          const yc = y + 0.5 - Y2;
          let w0 = a0 * (ix0 + 0.5 - X2) + b0 * yc;
          let w1 = a1 * (ix0 + 0.5 - X2) + b1 * yc;
          for (let x = ix0; x <= ix1; x++, w0 += a0, w1 += a1) {
            const w2 = 1 - w0 - w1;
            if (w0 < -0.02 || w1 < -0.02 || w2 < -0.02) continue;
            const d = w0 * z0 + w1 * z1 + w2 * z2;
            const p = y * lw + x;
            if (d > depthLo[p]) depthLo[p] = d;
          }
        }
      }
    }
    mark('occlusion-prepass');

    let skipOccl = 0;
    for (let t = 0; t < mesh.triCount; t++) {
      // 落成演示：只画标高低于进度线的构件，自下而上逐层“生长”
      if (o.clipY != null) {
        if (mesh.pos[t * 9 + 1] > o.clipY) continue;
      }
      const i0 = t * 3, i1 = i0 + 1, i2 = i0 + 2;
      const x0 = px[i0] * ppm + ox, y0 = py[i0] * ppm + oy;
      const x1 = px[i1] * ppm + ox, y1 = py[i1] * ppm + oy;
      const x2 = px[i2] * ppm + ox, y2 = py[i2] * ppm + oy;
      const z0 = pz[i0], z1 = pz[i1], z2 = pz[i2];

      const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
      if (Math.abs(area) < 0.55) continue;

      // 背面剔除（可选，实验开关）：屏幕绕向为负的面一律背对相机，
      // 对实体构件是“内壁”，本来就被外面挡着；单面片若被剔会破洞，所以默认关，由页面按需打开。
      if (o.backCull === true && area < 0) continue;

      // 预览档：小面（<10px²）先查一次预通道深度，被前面的大面挡死就不填了
      if (depthLo && Math.abs(area) < 10) {
        const cx = (x0 + x1 + x2) / 3 / LO, cy = (y0 + y1 + y2) / 3 / LO;
        const li = cx < 0 ? 0 : Math.min(lw - 1, cx | 0);
        const lj = cy < 0 ? 0 : Math.min(lh - 1, cy | 0);
        const zc = (pz[i0] + pz[i1] + pz[i2]) / 3;
        if (depthLo[lj * lw + li] > zc + 0.05) { skipOccl++; continue; }
      }

      // 面法线：朝向相机的方向取正
      let nx = mesh.nrm[t * 3], ny = mesh.nrm[t * 3 + 1], nz = mesh.nrm[t * 3 + 2];
      const facing = nx * cam.view[0] + ny * cam.view[1] + nz * cam.view[2];
      if (facing < 0) { nx = -nx; ny = -ny; nz = -nz; }
      let lam = nx * L[0] + ny * L[1] + nz * L[2];
      if (lam < 0) lam = 0;
      // 朝下面压暗、朝上面提亮
      let idx = lam > 0.66 ? 2 : lam > 0.30 ? 1 : 0;
      if (ny < -0.35) idx = 0;
      if (ny > 0.85 && lam > 0.5) idx = 2;

      const matName = mesh.mat[t];
      const mi = matIndex[matName] != null ? matIndex[matName] : 0;
      const ramp = ramps[mi] || ramps[0];
      let cr = ramp[idx][0], cg = ramp[idx][1], cb = ramp[idx][2];

      // 面级颗粒：同一三角面用位置哈希取一个恒定亮度系数（±6%），
      // 让大块墙面/瓦面/石面不再是纯色塑料板，像素风下读成砖石与木纹的微差。
      if (o.grain !== 0) {
        const gAmt = o.grain == null ? 0.06 : o.grain;
        const gx2 = Math.floor((mesh.pos[t * 9] + mesh.pos[t * 9 + 3] + mesh.pos[t * 9 + 6]) * 37);
        const gz2 = Math.floor((mesh.pos[t * 9 + 2] + mesh.pos[t * 9 + 5] + mesh.pos[t * 9 + 8]) * 53);
        let hs = ((gx2 * 73856093) ^ (gz2 * 19349663)) | 0;
        hs = Math.abs(hs) % 997;
        const kk = 1 + ((hs / 997) - 0.5) * 2 * gAmt;
        cr = cr * kk; cg = cg * kk; cb = cb * kk;
      }

      const isGround = mesh.tag[t] === 'ground';
      const m9 = t * 9;
      const wx0 = mesh.pos[m9], wx1 = mesh.pos[m9 + 3], wx2 = mesh.pos[m9 + 6];
      const wy0 = mesh.pos[m9 + 1], wy1 = mesh.pos[m9 + 4], wy2c = mesh.pos[m9 + 7];
      const wz0 = mesh.pos[m9 + 2], wz1 = mesh.pos[m9 + 5], wz2 = mesh.pos[m9 + 8];
      // 肌理开关按面判定一次（原来每像素都在判 patKind 与法线角度）
      const patKind = isGround ? null : MAT_PAT[matName];
      const patOn = !!patKind && (
        (patKind === 'mason' && Math.abs(ny) < 0.62) ||
        (patKind === 'plaster' && Math.abs(ny) < 0.62) ||
        patKind === 'wood' ||
        (patKind === 'water' && Math.abs(ny) > 0.7));

      const bx0 = Math.max(0, Math.floor(Math.min(x0, x1, x2)));
      const bx1 = Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2)));
      const by0 = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
      const by1 = Math.min(H - 1, Math.ceil(Math.max(y0, y1, y2)));

      // 重心权重：除法提到循环外，内层按 2 次加法/像素递推（原来每像素 2 次除法）
      const invArea = 1 / area;
      const w0a = (y1 - y2) * invArea, w0b = (x2 - x1) * invArea;
      const w1a = (y2 - y0) * invArea, w1b = (x0 - x2) * invArea;
      // 平面深度也按 (x,y) 线性递推：先拿 1 次加法 + 1 次比较把“已被前面挡住”的像素丢掉，
      // 通过之后才算重心权重与材质肌理（这段最贵）
      const zxa = w0a * (z0 - z2) + w1a * (z1 - z2);
      const zya = w0b * (z0 - z2) + w1b * (z1 - z2);
      for (let y = by0; y <= by1; y++) {
        const yc = y + 0.5 - y2;
        let w0 = w0a * (bx0 + 0.5 - x2) + w0b * yc;
        let w1 = w1a * (bx0 + 0.5 - x2) + w1b * yc;
        let z = z2 + zxa * (bx0 + 0.5 - x2) + zya * yc;
        let p = y * W + bx0;
        for (let x = bx0; x <= bx1; x++, w0 += w0a, w1 += w1a, z += zxa, p++) {
          if (z <= depth[p]) continue;          // 早拒：这个像素已有更近的面
          const w2 = 1 - w0 - w1;
          if (w0 < -0.001 || w1 < -0.001 || w2 < -0.001) continue;
          depth[p] = z;
          matId[p] = mi + 1;
          if (isGround) groundMask[p] = 1;
          else groundMask[p] = 0;   // 后画的墙/屋顶盖在地面上时，这一格不再算“地面”
          let c0 = cr, c1 = cg, c2 = cb;
          // 材质肌理：砌筑面走砖缝（横缝 + 错缝竖缝），木面走竖向木纹，地面已在下方单独处理
          if (patOn) {
            const wy = w0 * wy0 + w1 * wy1 + w2 * wy2c;
            const wxp2 = w0 * wx0 + w1 * wx1 + w2 * wx2;
            const wzp2 = w0 * wz0 + w1 * wz1 + w2 * wz2;
            if (patKind === 'mason') {
              const course = 0.33, jointW = 0.032, runW = 0.66;
              const hor = Math.abs(nx) >= Math.abs(nz) ? wzp2 : wxp2;
              const row = Math.floor(wy / course);
              const fy = wy / course - row;
              const fx = ((hor + (row % 2 ? runW * 0.5 : 0)) / runW) % 1;
              const dY = Math.min(fy, 1 - fy) * course;
              const dX = Math.min(fx, 1 - fx) * runW;
              if (dY < jointW || dX < jointW) { c0 *= 0.80; c1 *= 0.80; c2 *= 0.82; }
              else if (dY < jointW * 2.2) { c0 *= 0.94; c1 *= 0.94; c2 *= 0.95; }
            } else if (patKind === 'plaster') {
              // 白粉墙：抹灰面平滑，只留极淡的水平分抹痕与斑驳
              const fy2 = (wy / 0.9) % 1;
              if (fy2 < 0.012) { c0 *= 0.95; c1 *= 0.95; c2 *= 0.95; }
              const blot = (Math.floor(wxp2 * 0.7) * 13 + Math.floor(wy * 0.7) * 7) % 5;
              if (blot === 0) { c0 *= 0.965; c1 *= 0.965; c2 *= 0.965; }
            } else if (patKind === 'wood') {
              const period = 0.24;
              const horW = Math.abs(nx) >= Math.abs(nz) ? wzp2 : wxp2;
              const f = (horW / period) % 1;
              const k2 = 0.93 + 0.13 * f;
              c0 *= k2; c1 *= k2; c2 *= k2;
            } else if (patKind === 'water') {
              // 水面：斜向缓波纹，明暗起伏，避免整片死蓝
              const phase = (wzp2 * 1.15 + wxp2 * 0.38 + Math.sin(wxp2 * 0.42) * 0.9) * Math.PI * 2;
              const wv = 0.5 + 0.5 * Math.sin(phase);
              const k3 = 0.88 + 0.18 * wv;
              c0 *= k3 * 0.98; c1 *= k3; c2 *= k3 * 1.04;
              // 偶尔一道亮反光
              if (wv > 0.93) { c0 += 8; c1 += 10; c2 += 12; }
            }
          }
          if (isGround) {
            const wxp = w0 * wx0 + w1 * wx1 + w2 * wx2;
            const wzp = w0 * wz0 + w1 * wz1 + w2 * wz2;
            if (sh && sampleShadow(sh, wxp, wzp)) {
              // 阴影里整体压暗，保持材质色相
              const lo = ramp[Math.max(0, idx - 1)];
              c0 = lo[0] * 0.86; c1 = lo[1] * 0.86; c2 = lo[2] * 0.88;
            }
            // 铺装是真实几何方砖，这里只保留轻微色温变化，不再叠程序化石缝
            const tone = 0.98 + 0.02 * (((Math.floor(wxp * 0.8) * 7 + Math.floor(wzp * 0.8) * 5) % 3) / 2);
            c0 *= tone; c1 *= tone; c2 *= tone;
          }
          const q = p * 4;
          rgba[q] = c0; rgba[q + 1] = c1; rgba[q + 2] = c2; rgba[q + 3] = 255;
          shadeIdx[p] = idx;
        }
      }
    }

    mark('raster');

    // 描边 + 内部转折线（先只标记，勾线交给风格化阶段，便于做“断笔/抖线”）
    const edgeMask = new Uint8Array(W * H);
    const innerMask = new Uint8Array(W * H);
    if (outline) {
      const at = (x, y) => y * W + x;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const p = at(x, y);
          if (rgba[p * 4 + 3] === 0) continue;
          let isEdge = false;
          let inner = false;
          const nb = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
          for (const [nx2, ny2] of nb) {
            if (nx2 < 0 || ny2 < 0 || nx2 >= W || ny2 >= H) continue;
            const q = at(nx2, ny2);
            if (rgba[q * 4 + 3] === 0) { isEdge = true; break; }
            if (matId[q] !== matId[p] && Math.abs(depth[q] - depth[p]) > 0.35) inner = true;
          }
          if (isEdge) edgeMask[p] = 1;
          else if (inner) innerMask[p] = 1;
        }
      }
    }

    // 手绘风格化（水墨 / 枯笔 / 双色套印）
    const style = o.style || 'pixel';
    const amt = o.styleAmount == null ? 0.7 : o.styleAmount;
    if (style !== 'pixel' && amt > 0.01) {
      stylize(rgba, W, H, pal, shadeIdx, edgeMask, innerMask, style, amt, o.seed || 20261123, preview);
    } else {
      // 硬边像素风：纯墨勾线 + 转折处压暗
      const ink = pal.ink;
      for (let p = 0; p < W * H; p++) {
        if (rgba[p * 4 + 3] === 0) continue;
        if (edgeMask[p]) {
          rgba[p * 4] = ink[0]; rgba[p * 4 + 1] = ink[1]; rgba[p * 4 + 2] = ink[2];
        } else if (innerMask[p]) {
          rgba[p * 4] *= 0.62; rgba[p * 4 + 1] *= 0.62; rgba[p * 4 + 2] *= 0.66;
        }
      }
    }

    // 地面保持实体（不再做任何淡出），与最初一致：铺装块本身构成有形的地面

    mark('post');
    if (o.timing) console.log('[render ' + (preview ? 'preview' : 'full') + '] ' + marks.join(' | ') + ' | occluded ' + skipOccl + '/' + mesh.triCount + ' | total ' + (Date.now() - tMark) + 'ms');

    // 页面要画地面栅格时，回一份“被物件挡住的像素”遮罩：
    // 有深度、又不是地面铺装本身的像素，就是墙、屋顶、树这些立在地面上的物件。
    // 栅格只在遮罩之外落笔，等于把格线铺在地面上、被房子自然遮住。
    let occl = null;
    if (o.gridMask) {
      occl = new Uint8Array(W * H);
      for (let i = 0, n = W * H; i < n; i++) {
        occl[i] = (depth[i] > -1e8 && !groundMask[i]) ? 1 : 0;
      }
    }
    return {
      w: W, h: H, rgba,
      // 世界上一点 → 帧内像素：给“拖动陈设”做拾取/反算用（正交投影，地面 y=0）
      map: { right: cam.right, up: cam.up, ox, oy, ppm },
      occl
    };
  };

  /* ------------------------------ GPU 渲染 ------------------------------ */
  // WebGL2 负责投影、z-buffer 光栅化、三级色阶、材质肌理、地面阴影；
  // 描边与画风仍在 CPU 上做（它们要看像素的邻域，GPU 端做要多一趟 pass，收益不划算）。
  // 只在交互预览用，导出永远走 CPU，保证成品像素确定、可复现。
  const GM = 48;                 // 同时支持的材质上限（qingya 调色板 45 种，留余量）
  const gpuState = { tried: false, g: null };

  const VS_SRC = [
    '#version 300 es',
    'precision highp float;',
    'layout(location=0) in vec3 a_pos;',
    'layout(location=1) in vec3 a_nrm;',
    'layout(location=2) in float a_mat;',
    'layout(location=3) in float a_gnd;',
    'layout(location=4) in float a_tid;',
    'layout(location=5) in float a_gk;',
    'uniform vec3 u_right; uniform vec3 u_up; uniform vec3 u_view;',
    'uniform float u_ppm, u_ox, u_oy, u_W, u_H, u_zmin, u_zmax, u_dbg;',
    'out vec3 v_wpos;',
    'flat out vec3 v_nrm; flat out float v_mat; flat out float v_gnd; flat out float v_tid; flat out float v_gk;',
    'void main() {',
    '  vec2 s = vec2(dot(a_pos, u_right), -dot(a_pos, u_up));',
    '  vec2 pix = s * u_ppm + vec2(u_ox, u_oy);',
    '  float d = dot(a_pos, u_view);',
    '  gl_Position = vec4(pix.x / u_W * 2.0 - 1.0, 1.0 - pix.y / u_H * 2.0,',
    '                     (d - u_zmin) / (u_zmax - u_zmin), 1.0);',
    '  if (u_dbg > 1.5) {',
    '    float sid = float(gl_VertexID - (gl_VertexID / 3) * 3);',
    '    vec2 pp = sid < 0.5 ? vec2(-1.0, -1.0) : (sid < 1.5 ? vec2(3.0, -1.0) : vec2(-1.0, 3.0));',
    '    gl_Position = vec4(pp, 0.5, 1.0);',
    '  } else if (u_dbg > 0.5) gl_Position = vec4(a_pos.x * 0.05, a_pos.y * 0.05, 0.9, 1.0);',
    '  v_wpos = a_pos; v_nrm = a_nrm; v_mat = a_mat; v_gnd = a_gnd; v_tid = a_tid; v_gk = a_gk;',
    '}'
  ].join('\n');

  const FS_SRC = [
    '#version 300 es',
    'precision highp float;',
    'in vec3 v_wpos;',
    'flat in vec3 v_nrm; flat in float v_mat; flat in float v_gnd; flat in float v_tid; flat in float v_gk;',
    'uniform vec3 u_light; uniform vec3 u_view;',
    'uniform vec3 u_ramps[' + (GM * 3) + '];',
    'uniform float u_pat[' + GM + '];',
    'uniform float u_grain, u_zmin, u_zmax, u_shadow, u_dbg, u_clipY;',
    'uniform vec3 u_shMeta;',
    'uniform vec2 u_shSize;',
    'uniform sampler2D u_shTex;',
    'layout(location=0) out vec4 oCol;',
    'layout(location=1) out vec4 oInfo;',
    'float hashf(float v) { return fract(sin(v * 12.9898) * 43758.5453); }',
    'void main() {',
    '  if (v_wpos.y > u_clipY) discard;   // 落成演示：按世界高度裁掉还没长出来的部分',
    '  if (u_dbg > 1.5) {',
    '    oCol = vec4(min(1.0, length(v_wpos) * 0.05), min(1.0, length(v_nrm)), 0.0, 1.0);',
    '    oInfo = vec4(0.0, 0.0, 0.0, 0.0);',
    '    return;',
    '  }',
    '  vec3 n = v_nrm;',
    '  if (dot(n, u_view) < 0.0) n = -n;',
    '  float lam = max(dot(n, u_light), 0.0);',
    '  int idx = lam > 0.66 ? 2 : (lam > 0.30 ? 1 : 0);',
    '  if (n.y < -0.35) idx = 0;',
    '  if (n.y > 0.85 && lam > 0.5) idx = 2;',
    '  int mi = int(v_mat);',
    '  vec3 c = u_ramps[mi * 3 + idx];',
    '  if (u_grain > 0.0) c *= v_gk;',
    '  bool gnd = v_gnd > 0.5;',
    '  int pat = int(u_pat[mi]);',
    '  bool usePat = pat == 1 || pat == 2 ? abs(n.y) < 0.62',
    '              : pat == 3 ? true',
    '              : pat == 4 ? abs(n.y) > 0.7 : false;',
    '  if (!gnd && usePat) {',
    '    float wx = v_wpos.x, wy = v_wpos.y, wz = v_wpos.z;',
    '    if (pat == 1) {',
    '      float hor = abs(n.x) >= abs(n.z) ? wz : wx;',
    '      float course = 0.33, jointW = 0.032, runW = 0.66;',
    '      float row = floor(wy / course);',
    '      float fy = wy / course - row;',
    '      float fx = mod((hor + (mod(row, 2.0) > 0.5 ? runW * 0.5 : 0.0)) / runW, 1.0);',
    '      float dY = min(fy, 1.0 - fy) * course;',
    '      float dX = min(fx, 1.0 - fx) * runW;',
    '      if (dY < jointW || dX < jointW) c *= vec3(0.80, 0.80, 0.82);',
    '      else if (dY < jointW * 2.2) c *= vec3(0.94, 0.94, 0.95);',
    '    } else if (pat == 2) {',
    '      if (mod(wy / 0.9, 1.0) < 0.012) c *= 0.95;',
    '      if (int(mod(floor(wx * 0.7) * 13.0 + floor(wy * 0.7) * 7.0, 5.0)) == 0) c *= 0.965;',
    '    } else if (pat == 3) {',
    '      float horW = abs(n.x) >= abs(n.z) ? wz : wx;',
    '      c *= 0.93 + 0.13 * mod(horW / 0.24, 1.0);',
    '    } else if (pat == 4) {',
    '      float phase = (wz * 1.15 + wx * 0.38 + sin(wx * 0.42) * 0.9) * 6.2831853;',
    '      float wv = 0.5 + 0.5 * sin(phase);',
    '      float k3 = 0.88 + 0.18 * wv;',
    '      c *= vec3(k3 * 0.98, k3, k3 * 1.04);',
    '      if (wv > 0.93) c += vec3(8.0, 10.0, 12.0);',
    '    }',
    '  }',
    '  if (gnd) {',
    '    if (u_shadow > 0.5) {',
    '      vec2 g2 = (vec2(v_wpos.x, v_wpos.z) - u_shMeta.xy) / u_shMeta.z;',
    '      ivec2 ij = ivec2(floor(g2.x), floor(g2.y));',
    '      if (ij.x >= 0 && ij.y >= 0 && ij.x < int(u_shSize.x) && ij.y < int(u_shSize.y)) {',
    '        float shv = texelFetch(u_shTex, ij, 0).r;',
    '        if (shv > 0.5) c = u_ramps[mi * 3 + max(0, idx - 1)] * vec3(0.86, 0.86, 0.88);',
    '      }',
    '    }',
    '    c *= 0.98 + 0.02 * float(int(mod(floor(v_wpos.x * 0.8) * 7.0 + floor(v_wpos.z * 0.8) * 5.0, 3.0))) / 2.0;',
    '  }',
    '  oCol = vec4(c / 255.0, 1.0);',
    '  float z = gl_FragCoord.z;',
    '  float v16 = floor(clamp(z, 0.0, 0.99999) * 65535.0);',
    '  oInfo = vec4(((float(mi) + 1.0) + (gnd ? 32.0 : 0.0)) / 255.0,',
    '               float(idx) / 3.0, mod(v16, 256.0) / 255.0, floor(v16 / 256.0) / 255.0);',
    '}'
  ].join('\n');

  function gpuInit() {
    if (gpuState.tried) return gpuState.g;
    gpuState.tried = true;
    if (typeof document === 'undefined') return null;
    try {
      const cv = document.createElement('canvas');
      const gl = cv.getContext('webgl2', {
        alpha: true, antialias: false, depth: true, stencil: false,
        premultipliedAlpha: false, preserveDrawingBuffer: false
      });
      if (!gl) return null;
      const sh = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
        return s;
      };
      const prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS_SRC));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS_SRC));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || 'link');
      const u = {};
      ['u_right', 'u_up', 'u_view', 'u_ppm', 'u_ox', 'u_oy', 'u_W', 'u_H', 'u_zmin', 'u_zmax', 'u_dbg',
        'u_light', 'u_ramps', 'u_pat', 'u_grain', 'u_shadow', 'u_shMeta', 'u_shSize', 'u_shTex', 'u_clipY']
        .forEach((k) => (u[k] = gl.getUniformLocation(prog, k)));
      const g = {
        cv, gl, prog, u,
        fb: gl.createFramebuffer(),
        tex: [gl.createTexture(), gl.createTexture()],
        db: null, W: 0, H: 0,
        shTex: gl.createTexture(), shW: 0, shH: 0,
        geo: null, geoKey: null, vao: gl.createVertexArray()
      };
      gl.bindTexture(gl.TEXTURE_2D, g.shTex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gpuState.g = g;
      return g;
    } catch (e) {
      if (typeof console !== 'undefined') console.warn('[gpu] 初始化失败，回落 CPU：' + e.message);
      gpuState.g = null;
      return null;
    }
  }

  // 几何上传：pos 直接复用 mesh.pos（每顶点 3 float），其余按面展开成每顶点属性
  function gpuGeo(g, mesh, matIndex, key, gAmt) {
    if (g.geoKey === key && g.geoGAmt === gAmt) return g.geo;
    const T = mesh.triCount, n = T * 3;
    const extra = new Float32Array(n * 7);      // nrm(3) mat gnd tid gk
    const nrm = mesh.nrm, mats = mesh.mat, tags = mesh.tag, pos = mesh.pos;
    for (let t = 0; t < T; t++) {
      const nx = nrm[t * 3], ny = nrm[t * 3 + 1], nz = nrm[t * 3 + 2];
      const mi = matIndex[mats[t]] != null ? matIndex[mats[t]] : 0;
      const gnd = tags[t] === 'ground' ? 1 : 0;
      // 面级颗粒系数：与 CPU 完全同一套面中心整数哈希，保证两种内核颗粒一致
      const gx2 = Math.floor((pos[t * 9] + pos[t * 9 + 3] + pos[t * 9 + 6]) * 37);
      const gz2 = Math.floor((pos[t * 9 + 2] + pos[t * 9 + 5] + pos[t * 9 + 8]) * 53);
      let hs = ((gx2 * 73856093) ^ (gz2 * 19349663)) | 0; hs = Math.abs(hs) % 997;
      const gk = gAmt > 0 ? 1 + (hs / 997 - 0.5) * 2 * gAmt : 1;
      for (let k = 0; k < 3; k++) {
        const o = (t * 3 + k) * 7;
        extra[o] = nx; extra[o + 1] = ny; extra[o + 2] = nz;
        extra[o + 3] = mi; extra[o + 4] = gnd; extra[o + 5] = t; extra[o + 6] = gk;
      }
    }
    const gl = g.gl;
    const vao = g.vao;
    gl.bindVertexArray(vao);
    if (g.geo) {
      gl.deleteBuffer(g.geo.pos); gl.deleteBuffer(g.geo.extra);
    }
    const posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    // mesh.pos 可能是普通数组（构建时动态 push），WebGL 只收 ArrayBufferView，这里统一拷成 Float32Array
    const posArr = (typeof Float32Array !== 'undefined' && mesh.pos instanceof Float32Array)
      ? mesh.pos : new Float32Array(mesh.pos);
    gl.bufferData(gl.ARRAY_BUFFER, posArr, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);
    const exBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, exBuf);
    gl.bufferData(gl.ARRAY_BUFFER, extra, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 28, 0);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 28, 12);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 28, 16);
    gl.enableVertexAttribArray(4);
    gl.vertexAttribPointer(4, 1, gl.FLOAT, false, 28, 20);
    gl.enableVertexAttribArray(5);
    gl.vertexAttribPointer(5, 1, gl.FLOAT, false, 28, 24);
    gl.bindVertexArray(null);
    g.geo = { pos: posBuf, extra: exBuf, count: n };
    g.geoKey = key; g.geoGAmt = gAmt;
    return g.geo;
  }

  function gpuFBO(g, W, H) {
    if (g.W === W && g.H === H && g.ready) return;
    const gl = g.gl;
    g.cv.width = W; g.cv.height = H;
    gl.bindFramebuffer(gl.FRAMEBUFFER, g.fb);
    for (let i = 0; i < 2; i++) {
      gl.bindTexture(gl.TEXTURE_2D, g.tex[i]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, g.tex[i], 0);
    }
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    if (!g.db) g.db = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, g.db);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, W, H);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, g.db);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error('framebuffer 不完整');
    }
    g.W = W; g.H = H; g.ready = true;
  }

  GF.gpuAvailable = function () { return !!gpuInit(); };

  // 显卡信息：模式按钮的提示、导出日志都靠它，能直接看出跑的是哪块 GPU
  GF.gpuInfo = function () {
    const g = gpuInit();
    if (!g) return null;
    const gl = g.gl;
    let renderer = String(gl.getParameter(gl.RENDERER));
    try {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      if (ext) renderer = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));
    } catch (e) {}
    return {
      renderer,
      vendor: String(gl.getParameter(gl.VENDOR)),
      maxTexture: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      maxViewport: Array.prototype.slice.call(gl.getParameter(gl.MAX_VIEWPORT_DIMS) || [])
    };
  };


  GF.renderGPU = function (mesh, o) {
    const tAll = o.timing ? Date.now() : 0;
    try {
      const g = gpuInit();
      if (!g) return null;
      const ppmBase = o.ppm || 25;
      const preview = !!o.preview;
      const pitch = o.pitch == null ? 30 : o.pitch;
      const yaw = o.yaw == null ? 45 : o.yaw;
      const pad = o.pad == null ? 8 : o.pad;
      const pal = GF.palette(o.palette || 'qingya');
      const cam = camera(yaw, pitch);
      let light = o.light || pal.light;
      if (o.sunAz != null && isFinite(o.sunAz)) {
        const hh = Math.sqrt(light[0] * light[0] + light[2] * light[2]) || 1;
        const a = (o.sunAz * Math.PI) / 180;
        light = [Math.cos(a) * hh, light[1], Math.sin(a) * hh];
      }
      if (o.shadowAngle != null && isFinite(o.shadowAngle)) light = [light[0], light[1] / o.shadowAngle, light[2]];
      const outline = o.outline !== false;
      const shadowOn = o.shadow !== false;
      const transparent = o.transparent !== false;

      const b = mesh.bounds();
      if (!isFinite(b.x0)) return null;

      /* 取景：与 CPU 版完全同一套规则（先按顶点投影求范围，再按 focus 裁到建筑本体） */
      const n = mesh.triCount * 3;
      const px = new Float32Array(n), py = new Float32Array(n);
      let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
      const view0 = cam.view, right0 = cam.right, up0 = cam.up;
      for (let i = 0; i < n; i++) {
        const vx = mesh.pos[i * 3], vy = mesh.pos[i * 3 + 1], vz = mesh.pos[i * 3 + 2];
        const sx = vx * right0[0] + vz * right0[2];
        const sy = vx * up0[0] + vy * up0[1] + vz * up0[2];
        px[i] = sx; py[i] = -sy;
        if (px[i] < minx) minx = px[i]; if (px[i] > maxx) maxx = px[i];
        if (py[i] < miny) miny = py[i]; if (py[i] > maxy) maxy = py[i];
      }
      let bx0 = minx, bx1 = maxx, by0 = miny, by1 = maxy;
      if (o.focus === false) {
        const m2 = Math.max(0.5, Math.max(maxx - minx, maxy - miny) * 0.07);
        bx0 = minx - m2; bx1 = maxx + m2; by0 = miny - m2; by1 = maxy + m2;
      }
      if (o.focus !== false) {
        const ENV_TAGS = ['ground', '树', '假山', '水池', '幡', '石灯', '井', '碑', '钟', '鼓', '盆景', '拴马桩', '曲桥', '花池', '甬道'];
        let fx0 = 1e9, fx1 = -1e9, fy0 = 1e9, fy1 = -1e9, hit = 0;
        for (let t = 0; t < mesh.triCount; t++) {
          if (ENV_TAGS.indexOf(mesh.tag[t]) >= 0) continue;
          hit++;
          for (let k = 0; k < 3; k++) {
            const p = t * 3 + k;
            if (px[p] < fx0) fx0 = px[p]; if (px[p] > fx1) fx1 = px[p];
            if (py[p] < fy0) fy0 = py[p]; if (py[p] > fy1) fy1 = py[p];
          }
        }
        if (hit > 0 && isFinite(fx0)) {
          const m = Math.max(0.55, Math.max(fx1 - fx0, fy1 - fy0) * 0.16);
          bx0 = fx0 - m; bx1 = fx1 + m; by0 = fy0 - m; by1 = fy1 + m;
        }
      }
      let ppm = ppmBase;
      let W = Math.max(4, Math.ceil((bx1 - bx0) * ppm) + pad * 2);
      let H = Math.max(4, Math.ceil((by1 - by0) * ppm) + pad * 2);
      let ox = -bx0 * ppm + pad, oy = -by0 * ppm + pad;
      if (preview && o.maxPixels && W * H > o.maxPixels) {
        const k = Math.sqrt(o.maxPixels / (W * H));
        ppm = Math.max(1, ppm * k);
        W = Math.max(4, Math.ceil((bx1 - bx0) * ppm) + pad * 2);
        H = Math.max(4, Math.ceil((by1 - by0) * ppm) + pad * 2);
        ox = -bx0 * ppm + pad; oy = -by0 * ppm + pad;
      }

      /* 深度范围：用包围盒 8 个角点，保守覆盖全部几何 */
      let zmin = 1e9, zmax = -1e9;
      for (let i = 0; i < 8; i++) {
        const cx = i & 1 ? b.x1 : b.x0;
        const cy = i & 2 ? b.y1 : b.y0;
        const cz = i & 4 ? b.z1 : b.z0;
        const d = cx * view0[0] + cy * view0[1] + cz * view0[2];
        if (d < zmin) zmin = d; if (d > zmax) zmax = d;
      }
      if (!(zmax > zmin)) { zmax = zmin + 1; }

      const gl = g.gl;
      // 全精度出图会到 1 万像素以上，超过显卡纹理上限就老实回落 CPU，
      // 否则 Framebuffer 建不起来，readPixels 拿到的是一整片透明黑。
      const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      if (maxTex && (W > maxTex || H > maxTex)) {
        console.warn('[gpu] ' + W + 'x' + H + ' 超过显卡纹理上限 ' + maxTex + '，回落 CPU');
        return null;
      }
      gpuFBO(g, W, H);

      // 材质表
      const matKeys = Object.keys(pal.mats);
      if (matKeys.length > GM) return null;   // 素材表超上限直接回落 CPU，避免缺色
      const matIndex = {};
      matKeys.forEach((k, i) => (matIndex[k] = i));
      const ramps = new Float32Array(GM * 3 * 3);
      const pats = new Float32Array(GM);
      const PAT_NUM = { mason: 1, plaster: 2, wood: 3, water: 4 };
      for (let i = 0; i < Math.min(GM, matKeys.length); i++) {
        const rp = pal.mats[matKeys[i]] || pal.mats[matKeys[0]];
        for (let j = 0; j < 3; j++) {
          ramps[(i * 3 + j) * 3] = rp[j][0];
          ramps[(i * 3 + j) * 3 + 1] = rp[j][1];
          ramps[(i * 3 + j) * 3 + 2] = rp[j][2];
        }
        pats[i] = PAT_NUM[MAT_PAT[matKeys[i]]] || 0;
      }

      const geo = gpuGeo(g, mesh, matIndex, mesh, o.grain === 0 ? 0 : (o.grain == null ? 0.06 : o.grain));

      // 阴影网格（与 CPU 同参数：预览 0.32m、跳小面）；只跟光向与网格粗细有关，与视角无关，可直接复用
      let sh = null;
      if (shadowOn) {
        const shKey = (preview ? 'P' : 'F') + '|' + light.join(',') + '|' + (preview ? 0.32 : 0.18);
        const cache = mesh.__shCache;
        if (cache && cache.key === shKey) sh = cache.sh;
        else {
          sh = buildShadow(mesh, b, light, preview ? 0.32 : 0.18, preview);
          mesh.__shCache = { key: shKey, sh };
        }
        if (sh && sh.gw * sh.gh > 0) {
          if (g.shW !== sh.gw || g.shH !== sh.gh) {
            gl.bindTexture(gl.TEXTURE_2D, g.shTex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, sh.gw, sh.gh, 0, gl.RED, gl.UNSIGNED_BYTE, sh.grid);
            g.shW = sh.gw; g.shH = sh.gh;
          } else {
            gl.bindTexture(gl.TEXTURE_2D, g.shTex);
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, sh.gw, sh.gh, gl.RED, gl.UNSIGNED_BYTE, sh.grid);
          }
        }
      }

      gl.bindFramebuffer(gl.FRAMEBUFFER, g.fb);
      gl.viewport(0, 0, W, H);
      gl.disable(gl.CULL_FACE);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.GREATER);
      gl.clearDepth(0);
      if (transparent) gl.clearColor(0, 0, 0, 0);
      else { const bg = GF.hex2rgb(pal.bg || '#f6f2e6'); gl.clearColor(bg[0] / 255, bg[1] / 255, bg[2] / 255, 1); }
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      gl.useProgram(g.prog);
      gl.uniform3f(g.u.u_right, cam.right[0], cam.right[1], cam.right[2]);
      gl.uniform3f(g.u.u_up, cam.up[0], cam.up[1], cam.up[2]);
      gl.uniform3f(g.u.u_view, view0[0], view0[1], view0[2]);
      gl.uniform1f(g.u.u_ppm, ppm);
      gl.uniform1f(g.u.u_ox, ox);
      gl.uniform1f(g.u.u_oy, oy);
      gl.uniform1f(g.u.u_W, W);
      gl.uniform1f(g.u.u_H, H);
      gl.uniform1f(g.u.u_zmin, zmin);
      gl.uniform1f(g.u.u_zmax, zmax);
      gl.uniform1f(g.u.u_dbg, o.debugVertex ? 2 : (o.debugDirect ? 1 : 0));
      gl.uniform1f(g.u.u_clipY, o.clipY == null ? 1e9 : o.clipY);
      gl.uniform3f(g.u.u_light, light[0], light[1], light[2]);
      gl.uniform3fv(g.u.u_ramps, ramps);
      gl.uniform1fv(g.u.u_pat, pats);
      gl.uniform1f(g.u.u_grain, o.grain === 0 ? 0 : (o.grain == null ? 0.06 : o.grain));
      gl.uniform1f(g.u.u_shadow, sh ? 1 : 0);
      if (sh) {
        gl.uniform3f(g.u.u_shMeta, sh.minX, sh.minZ, sh.cell);
        gl.uniform2f(g.u.u_shSize, sh.gw, sh.gh);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, g.shTex);
        gl.uniform1i(g.u.u_shTex, 1);
      }
      gl.bindVertexArray(null);
      gl.bindBuffer(gl.ARRAY_BUFFER, geo.pos);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, geo.extra);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 28, 0);
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 28, 12);
      gl.enableVertexAttribArray(3);
      gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 28, 16);
      gl.enableVertexAttribArray(4);
      gl.vertexAttribPointer(4, 1, gl.FLOAT, false, 28, 20);
      gl.enableVertexAttribArray(5);
      gl.vertexAttribPointer(5, 1, gl.FLOAT, false, 28, 24);
      gl.drawArrays(gl.TRIANGLES, 0, geo.count);
      // 画完立刻验一次：FBO 不完整或 GL 报错时，宁可回落 CPU 也不能交付一张空图
      const fbsStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      const glErr = gl.getError();
      if (fbsStatus !== gl.FRAMEBUFFER_COMPLETE || glErr !== 0) {
        console.warn('[gpu] 绘制失败 fbo=' + fbsStatus + ' err=' + glErr + '，回落 CPU');
        if (typeof GF.gpuBroken !== 'undefined') GF.gpuBroken = true;
        GF.__gpuFail = (GF.__gpuFail || 0) + 1;
        return null;
      }
      let dbg = null;
      if (o.debugGpu) {
        gl.bindVertexArray(g.vao);
        const at = [0, 1, 2, 3, 4].map((i) => (gl.getVertexAttrib(i, gl.VERTEX_ATTRIB_ARRAY_ENABLED) ? '1' : '0')).join('');
        const sz = [0, 1, 2, 3, 4].map((i) => gl.getVertexAttrib(i, gl.VERTEX_ATTRIB_ARRAY_SIZE)).join(',');
        gl.bindVertexArray(null);
        dbg = {
          err: gl.getError(), count: geo.count, zmin, zmax, ppm, ox, oy, W, H,
          fbs: gl.checkFramebufferStatus(gl.FRAMEBUFFER),
          nul: Object.keys(g.u).filter((k) => !g.u[k]).join('/') || 'none',
          attrib: at, sizes: sz,
          progOk: gl.getProgramParameter(g.prog, gl.LINK_STATUS) ? 1 : 0
        };
      }

      /* 读回：颜色 + 元信息（材质、色阶、地面、16bit 深度） */
      const N = W * H;
      const bufC = new Uint8Array(N * 4);
      const bufI = new Uint8Array(N * 4);
      gl.readBuffer(gl.COLOR_ATTACHMENT0);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, bufC);
      gl.readBuffer(gl.COLOR_ATTACHMENT1);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, bufI);

      const rgba = new Uint8ClampedArray(N * 4);
      const depth = new Float32Array(N).fill(-1e9);
      const matId = new Uint16Array(N);
      const shadeIdx = new Uint8Array(N);
      const zSpan = zmax - zmin;
      for (let y = 0; y < H; y++) {
        // readPixels 原点在左下，按行翻回来
        const s0 = (H - 1 - y) * W;
        const dst0 = y * W;
        for (let x = 0; x < W; x++) {
          const s = (s0 + x) * 4, d = (dst0 + x) * 4;
          const a = bufC[s + 3];
          rgba[d] = bufC[s]; rgba[d + 1] = bufC[s + 1]; rgba[d + 2] = bufC[s + 2]; rgba[d + 3] = a;
          if (a === 0) continue;
          const info = bufI[s];
          const gnd = info >= 32 ? 1 : 0;
          matId[dst0 + x] = (gnd ? info - 32 : info);
          shadeIdx[dst0 + x] = Math.round((bufI[s + 1] / 85) * 1);
          const v16 = bufI[s + 3] * 256 + bufI[s + 2];
          depth[dst0 + x] = zmin + (v16 / 65535) * zSpan;
        }
      }
      const tRaster = o.timing ? Date.now() : 0;

      /* 描边 + 内部转折线（与 CPU 完全同一套判定） */
      const edgeMask = new Uint8Array(N);
      const innerMask = new Uint8Array(N);
      if (outline) {
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const p = y * W + x;
            if (rgba[p * 4 + 3] === 0) continue;
            let isEdge = false, inner = false;
            const nb = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
            for (let q2 = 0; q2 < 4; q2++) {
              const nx2 = nb[q2][0], ny2 = nb[q2][1];
              if (nx2 < 0 || ny2 < 0 || nx2 >= W || ny2 >= H) continue;
              const qq = ny2 * W + nx2;
              if (rgba[qq * 4 + 3] === 0) { isEdge = true; break; }
              if (matId[qq] !== matId[p] && Math.abs(depth[qq] - depth[p]) > 0.35) inner = true;
            }
            if (isEdge) edgeMask[p] = 1;
            else if (inner) innerMask[p] = 1;
          }
        }
      }

      const style = o.style || 'pixel';
      const amt = o.styleAmount == null ? 0.7 : o.styleAmount;
      if (style !== 'pixel' && amt > 0.01) {
        stylize(rgba, W, H, pal, shadeIdx, edgeMask, innerMask, style, amt, o.seed || 20261123, preview);
      } else {
        const ink = pal.ink;
        for (let p = 0; p < W * H; p++) {
          if (rgba[p * 4 + 3] === 0) continue;
          if (edgeMask[p]) {
            rgba[p * 4] = ink[0]; rgba[p * 4 + 1] = ink[1]; rgba[p * 4 + 2] = ink[2];
          } else if (innerMask[p]) {
            rgba[p * 4] *= 0.62; rgba[p * 4 + 1] *= 0.62; rgba[p * 4 + 2] *= 0.66;
          }
        }
      }

      if (o.timing) {
        console.log('[gpu ' + (preview ? 'preview' : 'full') + '] setup ' + (tRaster ? '' : '') +
          (Date.now() - tAll) + 'ms | total ' + (Date.now() - tAll) + 'ms · ' + W + 'x' + H);
      }
      return {
        w: W, h: H, rgba, gpu: true, debug: dbg,
        map: { right: cam.right, up: cam.up, ox, oy, ppm }
      };
    } catch (e) {
      if (typeof console !== 'undefined') console.warn('[gpu] 渲染失败，回落 CPU：' + e.message);
      return null;
    }
  };

  /* --------------------------- 多方向与精灵表 --------------------------- */
  GF.renderDirs = function (mesh, o, yaws) {
    return yaws.map((yaw) => GF.render(mesh, Object.assign({}, o, { yaw })));
  };

  // 拼图：把多张同尺寸画面对齐到统一画布
  GF.composeSheet = function (frames, opts) {
    opts = opts || {};
    const pad = opts.pad == null ? 8 : opts.pad;
    const maxW = Math.max(...frames.map((f) => f.w));
    const maxH = Math.max(...frames.map((f) => f.h));
    const cols = opts.cols || frames.length;
    const rows = Math.ceil(frames.length / cols);
    const W = cols * (maxW + pad) + pad;
    const H = rows * (maxH + pad) + pad;
    const rgba = new Uint8ClampedArray(W * H * 4);
    frames.forEach((f, i) => {
      const c = i % cols, r2 = Math.floor(i / cols);
      const ox = pad + c * (maxW + pad) + Math.floor((maxW - f.w) / 2);
      const oy = pad + r2 * (maxH + pad) + (maxH - f.h); // 底部对齐
      for (let y = 0; y < f.h; y++) {
        for (let x = 0; x < f.w; x++) {
          const s = (y * f.w + x) * 4;
          const d = ((oy + y) * W + (ox + x)) * 4;
          rgba[d] = f.rgba[s]; rgba[d + 1] = f.rgba[s + 1];
          rgba[d + 2] = f.rgba[s + 2]; rgba[d + 3] = f.rgba[s + 3];
        }
      }
    });
    return { w: W, h: H, rgba };
  };
})(typeof window !== 'undefined' ? window : globalThis);
