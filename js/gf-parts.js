/* ============================================================================
 * 国风古建像素工坊 · 构件库
 * 台基 / 墙体开洞 / 格心窗 / 隔扇门 / 斗拱 / 额枋彩画 / 雀替 / 匾额
 * 栏杆 / 踏跺 / 马头墙 / 院墙 / 影壁 / 石狮 / 香炉 / 灯笼 / 幡旗
 * 树木（松梅竹柳银杏）/ 假山 / 水池 / 家具（桌凳屏风书架榻香案佛龛）
 * ==========================================================================*/
(function (global) {
  'use strict';
  const GF = (global.GF = global.GF || {});
  const V = GF.V;

  /* ------------------------- 墙面局部坐标映射 ------------------------- */
  // dir: front(+z) / back(-z) / right(+x) / left(-x)
  // (u,v,d) -> 世界坐标；u 沿墙面向右，v 向上，d 为外法线方向
  function mapper(dir, at) {
    if (dir === 'back') return (u, v, d) => [-u, v, at - d];
    if (dir === 'right') return (u, v, d) => [at + d, v, u];
    if (dir === 'left') return (u, v, d) => [at - d, v, -u];
    if (dir === 'xfront') return (u, v, d) => [u, v, at + d];
    return (u, v, d) => [u, v, at + d];
  }
  GF.mapper = mapper;

  function localBox(mb, mp, u0, u1, v0, v1, d0, d1, mat, tag) {
    const pts = [];
    for (const u of [u0, u1]) for (const v of [v0, v1]) for (const d of [d0, d1]) pts.push(mp(u, v, d));
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const p of pts) {
      x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]);
      y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
      z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2]);
    }
    mb.box(x0, x1, y0, y1, z0, z1, mat, tag);
  }
  GF.localBox = localBox;

  /* ------------------------------ 墙体 ------------------------------ */
  // 带洞口的墙：自动切分成过梁、窗下墙、槛墙、墙垛
  function wallWithHoles(mb, o) {
    const mp = mapper(o.dir, o.at);
    const t = (o.thickness || 0.2) / 2;
    const holes = o.holes || [];
    const us = [o.u0, o.u1];
    const vs = [o.y0, o.y1];
    holes.forEach((h) => { us.push(h.u0, h.u1); vs.push(h.v0, h.v1); });
    us.sort((a, b) => a - b); vs.sort((a, b) => a - b);
    const inHole = (u, v) => holes.some((h) => u > h.u0 - 1e-6 && u < h.u1 + 1e-6 && v > h.v0 - 1e-6 && v < h.v1 + 1e-6);
    for (let i = 0; i < us.length - 1; i++) {
      for (let j = 0; j < vs.length - 1; j++) {
        const u0 = us[i], u1 = us[i + 1], v0 = vs[j], v1 = vs[j + 1];
        if (u1 - u0 < 1e-6 || v1 - v0 < 1e-6) continue;
        if (inHole((u0 + u1) / 2, (v0 + v1) / 2)) continue;
        localBox(mb, mp, u0, u1, v0, v1, -t, t, o.mat || 'plaster', o.tag || '墙');
      }
    }
  }

  /* ------------------------------ 格心窗 ------------------------------ */
  // 生成格心图案的细木条（局部坐标），返回 [u0,u1,v0,v1]
  function latticeBars(w, h, pattern) {
    const bars = [];
    const bu = 0.07; // 条宽
    if (pattern === 'straight') {
      // 直棂窗：竖条
      const n = Math.max(3, Math.round(w / 0.16));
      for (let i = 1; i < n; i++) {
        const u = -w / 2 + (w * i) / n;
        bars.push([u - bu / 2, u + bu / 2, -h / 2, h / 2]);
      }
    } else if (pattern === 'step' || pattern === 'wanzi') {
      // 步步锦/万字：横竖交错
      const rows = Math.max(2, Math.round(h / 0.22));
      for (let j = 1; j < rows; j++) {
        const v = -h / 2 + (h * j) / rows;
        bars.push([-w / 2, w / 2, v - bu / 2, v + bu / 2]);
      }
      const cols = Math.max(2, Math.round(w / 0.24));
      for (let j = 0; j < rows; j++) {
        const v0 = -h / 2 + (h * j) / rows;
        for (let i = 1; i < cols; i++) {
          const u = -w / 2 + (w * i) / cols;
          const off = (j % 2 ? 1 : -1) * (h / rows) * 0.28;
          bars.push([u - bu / 2, u + bu / 2, v0 + off, v0 + h / rows - off]);
        }
      }
    } else if (pattern === 'ice') {
      // 冰裂纹：折线交错
      const n = 3;
      for (let i = 1; i <= n; i++) {
        const u = -w / 2 + (w * i) / (n + 1);
        bars.push([u - bu / 2, u + bu / 2, -h / 2, h / 2]);
        bars.push([-w / 2, w / 2, -h / 2 + (h * i) / (n + 1) - bu / 2, -h / 2 + (h * i) / (n + 1) + bu / 2]);
      }
      bars.push([-w / 2, -w / 6, -h / 2, -h / 6]);
      bars.push([w / 6, w / 2, h / 6, h / 2]);
    } else if (pattern === 'lantern') {
      // 灯笼框
      bars.push([-w * 0.32, w * 0.32, -h * 0.36, -h * 0.36 + bu * 1.6]);
      bars.push([-w * 0.32, w * 0.32, h * 0.36 - bu * 1.6, h * 0.36]);
      bars.push([-w * 0.32, -w * 0.32 + bu * 1.6, -h * 0.36, h * 0.36]);
      bars.push([w * 0.32 - bu * 1.6, w * 0.32, -h * 0.36, h * 0.36]);
      bars.push([-bu / 2, bu / 2, -h / 2, h / 2]);
    } else if (pattern === 'haitang') {
      // 海棠纹：四瓣花头 + 方胜套叠
      const s = Math.min(w, h) * 0.32;
      bars.push([-s * 0.2, s * 0.2, -s, s]);            // 竖瓣
      bars.push([-s, s, -s * 0.2, s * 0.2]);            // 横瓣
      bars.push([-w / 2, w / 2, -bu / 2, bu / 2]);
      bars.push([-bu / 2, bu / 2, -h / 2, h / 2]);
      for (const sx of [-1, 1]) {
        for (const sy of [-1, 1]) {
          bars.push([sx * s * 0.55, sx * s * 0.85, sy * s * 0.55, sy * s * 0.85]);
        }
      }
    } else if (pattern === 'liujiao') {
      // 六角龟背锦
      const rows = Math.max(2, Math.round(h / 0.3));
      for (let j = 0; j < rows; j++) {
        const v = -h / 2 + (h * (j + 0.5)) / rows;
        bars.push([-w / 2, w / 2, v - bu / 2, v + bu / 2]);
      }
      const cols = Math.max(2, Math.round(w / 0.3));
      for (let i = 1; i < cols; i++) {
        const u = -w / 2 + (w * i) / cols;
        for (let j = 0; j < rows; j++) {
          const v0 = -h / 2 + (h * j) / rows;
          const off = (j % 2 ? 0.5 : 0) * (h / rows) * 0.6;
          bars.push([u - bu / 2, u + bu / 2, v0 + off, v0 + off + h / rows * 0.7]);
        }
      }
    }
    return bars;
  }

  function windowAt(mb, o) {
    // o: dir, at, uc（中心u）, vc（中心v）, w, h, pattern, hole? 由墙体先行开洞
    const mp = mapper(o.dir, o.at);
    const w = o.w, h = o.h, uc = o.uc, vc = o.vc;
    const u0 = uc - w / 2, u1 = uc + w / 2, v0 = vc - h / 2, v1 = vc + h / 2;
    const tag = o.tag || '窗';
    // 窗内暗面（窗纸）
    localBox(mb, mp, u0, u1, v0, v1, -0.06, -0.04, o.paperMat || 'paper', tag + '·纸');
    // 外框
    const fw = 0.1;
    localBox(mb, mp, u0 - fw, u1 + fw, v0 - fw, v0, -0.03, 0.08, o.frameMat || 'wood', tag + '·框');
    localBox(mb, mp, u0 - fw, u1 + fw, v1, v1 + fw, -0.03, 0.08, o.frameMat || 'wood', tag + '·框');
    localBox(mb, mp, u0 - fw, u0, v0, v1, -0.03, 0.08, o.frameMat || 'wood', tag + '·框');
    localBox(mb, mp, u1, u1 + fw, v0, v1, -0.03, 0.08, o.frameMat || 'wood', tag + '·框');
    // 格心（LOD plain：省格心棂条）
    if (!o.plain) {
      const bars = latticeBars(w, h, o.pattern || 'step');
      const barMat = o.barMat || 'wood';
      for (const b of bars) {
        localBox(mb, mp, uc + b[0], uc + b[1], vc + b[2], vc + b[3], 0.02, 0.09, barMat, tag + '·格心');
      }
    }
    // 窗楣与窗台：上挑石楣 + 下石台，让窗洞有“框住”的层次（民居、厅堂通用）
    if (o.hood !== false && !o.plain) {
      const hm = o.hoodMat || 'stone';
      localBox(mb, mp, u0 - 0.18, u1 + 0.18, v1 + fw, v1 + fw + 0.12, -0.05, 0.13, hm, tag + '·窗楣');
      localBox(mb, mp, u0 - 0.16, u1 + 0.16, v1 + fw + 0.12, v1 + fw + 0.16, -0.03, 0.11, hm, tag + '·窗楣线');
      localBox(mb, mp, u0 - 0.16, u1 + 0.16, v0 - fw - 0.1, v0 - fw, -0.05, 0.12, hm, tag + '·窗台');
    }
  }

  /* ------------------------------ 门 ------------------------------ */
  function doorAt(mb, o) {
    // 隔扇门：四扇，上部格心、下部裙板
    const mp = mapper(o.dir, o.at);
    const uc = o.uc, w = o.w, h = o.h, y0 = o.y0;
    const tag = o.tag || '门';
    if (o.plain) {
      // LOD plain：板门两扇平板，省门钉 / 门环细分
      const half = w / 2;
      for (const s of [-1, 1]) {
        localBox(mb, mp, uc + s * 0.03, uc + s * half, y0, y0 + h, -0.08, 0.06, 'wood', tag + '·板门');
      }
      localBox(mb, mp, uc - w / 2, uc + w / 2, y0 - 0.12, y0, -0.1, 0.1, 'stone', tag + '·门槛');
      return;
    }
    if (o.style === 'panel') {
      // 板门：两扇实木门 + 门钉 + 环
      const half = w / 2;
      for (const s of [-1, 1]) {
        localBox(mb, mp, uc + s * 0.03, uc + s * half, y0, y0 + h, -0.08, 0.06, 'wood', tag + '·板门');
        for (let r = 0; r < 4; r++) {
          for (let c = 0; c < 3; c++) {
            const uu = uc + s * (0.18 + c * (half - 0.3) / 2);
            const vv = y0 + h * (0.32 + r * 0.16);
            localBox(mb, mp, uu - 0.035, uu + 0.035, vv - 0.035, vv + 0.035, 0.06, 0.1, 'gold', tag + '·门钉');
          }
        }
        // 门环
        const ru = uc + s * 0.2, rv = y0 + h * 0.5;
        mb.lathe(0, 0, [[0.01, 0], [0.11, 0.02], [0.11, 0.05], [0.01, 0.06]], 8, 'gold', tag + '·门环');
      }
      // 门轴与门槛
      localBox(mb, mp, uc - w / 2, uc + w / 2, y0 - 0.12, y0, -0.1, 0.1, 'stone', tag + '·门槛');
      return;
    }
    // 隔扇（默认）
    const leaves = o.leaves || 4;
    const lw = w / leaves;
    for (let i = 0; i < leaves; i++) {
      const a = uc - w / 2 + i * lw, b = a + lw;
      // 边框
      localBox(mb, mp, a, b, y0, y0 + 0.12, -0.1, 0.06, 'wood', tag + '·隔扇');
      localBox(mb, mp, a, b, y0 + h - 0.1, y0 + h, -0.1, 0.06, 'wood', tag + '·隔扇');
      localBox(mb, mp, a, a + 0.07, y0, y0 + h, -0.1, 0.06, 'wood', tag + '·隔扇');
      localBox(mb, mp, b - 0.07, b, y0, y0 + h, -0.1, 0.06, 'wood', tag + '·隔扇');
      // 上部格心
      const gy0 = y0 + h * 0.42, gy1 = y0 + h - 0.12;
      localBox(mb, mp, a + 0.07, b - 0.07, gy0, gy1, -0.06, -0.04, 'paper', tag + '·窗纸');
      const cw = (b - a) - 0.14, ch = gy1 - gy0;
      const bars = latticeBars(cw, ch, o.pattern || 'step');
      const cu = (a + b) / 2, cv = (gy0 + gy1) / 2;
      for (const bb of bars) {
        localBox(mb, mp, cu + bb[0], cu + bb[1], cv + bb[2], cv + bb[3], 0.02, 0.07, 'wood', tag + '·格心');
      }
      // 下部裙板
      localBox(mb, mp, a + 0.07, b - 0.07, y0 + 0.12, gy0 - 0.06, -0.04, 0.04, 'wood', tag + '·裙板');
      localBox(mb, mp, a + 0.12, b - 0.12, y0 + 0.3, y0 + h * 0.34, 0.04, 0.07, 'gold', tag + '·裙板线');
    }
    localBox(mb, mp, uc - w / 2, uc + w / 2, y0 - 0.12, y0, -0.1, 0.1, 'stone', tag + '·门槛');
  }

  /* ------------------------------ 匾额 ------------------------------ */
  function plaque(mb, o) {
    const mp = mapper(o.dir, o.at);
    const w = o.w || 1.8, h = o.h || 0.6, vc = o.vc;
    // 底板
    localBox(mb, mp, o.uc - w / 2, o.uc + w / 2, vc - h / 2, vc + h / 2, -0.05, 0.1, 'dark', '匾额');
    // 金框
    localBox(mb, mp, o.uc - w / 2 - 0.06, o.uc + w / 2 + 0.06, vc + h / 2, vc + h / 2 + 0.06, -0.05, 0.1, 'gold', '匾额·框');
    localBox(mb, mp, o.uc - w / 2 - 0.06, o.uc + w / 2 + 0.06, vc - h / 2 - 0.06, vc - h / 2, -0.05, 0.1, 'gold', '匾额·框');
    localBox(mb, mp, o.uc - w / 2 - 0.06, o.uc - w / 2, vc - h / 2, vc + h / 2, -0.05, 0.1, 'gold', '匾额·框');
    localBox(mb, mp, o.uc + w / 2, o.uc + w / 2 + 0.06, vc - h / 2, vc + h / 2, -0.05, 0.1, 'gold', '匾额·框');
    // 字（以金色方块示意，1~4 个字）
    const n = o.chars || 3;
    for (let i = 0; i < n; i++) {
      const u = o.uc + (i - (n - 1) / 2) * (w / (n + 0.6));
      localBox(mb, mp, u - 0.1, u + 0.1, vc - h * 0.26, vc + h * 0.26, 0.1, 0.14, 'gold', '匾额·字');
    }
  }

  /* ------------------------------ 斗拱 ------------------------------ */
  // style: simple(一斗三升) / mid(五踩) / full(七踩) / none
  function dougong(mb, x, y, z, s, tag, style) {
    s = s || 1;
    const st = style || 'mid';
    // 栌斗：斗欹（下收）+ 斗平（外张），两个棱台叠起来才有“斗”的轮廓
    mb.taper(x, z, 0.26 * s, 0.26 * s, 0.34 * s, 0.34 * s, y, y + 0.09 * s, 'wood', tag + '·斗欹');
    mb.taper(x, z, 0.34 * s, 0.34 * s, 0.40 * s, 0.40 * s, y + 0.09 * s, y + 0.17 * s, 'wood', tag + '·斗平');
    const yb = y + 0.17 * s;
    if (st === 'simple') {
      // 一斗三升：泥道拱（两端卷杀）+ 三个散斗（上大下小）
      mb.boxC(x, z, 0.80 * s, 0.22 * s, yb, yb + 0.13 * s, 'paintGreen', tag + '·泥道拱');
      for (const sx of [-1, 1]) {
        mb.taper(x + sx * 0.40 * s, z, 0.16 * s, 0.22 * s, 0.06 * s, 0.16 * s, yb, yb + 0.125 * s, 'paintGreen', tag + '·拱头');
      }
      for (const dx of [-0.42, 0, 0.42]) {
        mb.taper(x + dx * s, z, 0.15 * s, 0.15 * s, 0.19 * s, 0.19 * s, yb + 0.13 * s, yb + 0.25 * s, 'paintGreen', tag + '·散斗');
      }
      return;
    }
    // 多踩：逐层出跳（华拱 + 昂 + 升），拱头卷杀、升收顶
    const steps = st === 'full' ? 3 : 2;
    for (let k = 0; k < steps; k++) {
      const yy = yb + k * 0.19 * s;
      const w = (1.02 + k * 0.26) * s;
      mb.boxC(x, z, w - 0.16 * s, 0.21 * s, yy, yy + 0.13 * s, 'paintGreen', tag + '·华拱');
      for (const sx of [-1, 1]) {
        mb.taper(x + sx * (w / 2 - 0.09 * s), z, 0.18 * s, 0.21 * s, 0.06 * s, 0.15 * s, yy, yy + 0.125 * s, 'paintGreen', tag + '·拱头');
      }
      mb.taper(x, z + (0.2 + k * 0.16) * s, 0.2 * s, (0.5 + k * 0.34) * s, 0.14 * s, (0.34 + k * 0.28) * s, yy, yy + 0.12 * s, 'wood', tag + '·昂');
      for (const dx of [-0.52, 0.52]) {
        mb.taper(x + dx * (1 + k * 0.24) * s, z, 0.13 * s, 0.13 * s, 0.17 * s, 0.17 * s, yy + 0.13 * s, yy + 0.26 * s, 'paintGreen', tag + '·升');
      }
    }
    mb.taper(x, z, 0.38 * s, 0.20 * s, 0.28 * s, 0.13 * s, yb + steps * 0.19 * s, yb + steps * 0.19 * s + 0.12 * s, 'paintGreen', tag + '·耍头');
  }

  /* --------------------------- 额枋（带彩画） --------------------------- */
  function lintel(mb, o) {
    // o: dir, at, uc, w, y, h, th, seg
    const mp = mapper(o.dir, o.at);
    const seg = o.seg || 6;
    const w = o.w, y0 = o.y, h = o.h || 0.32;
    const th = o.th || 0.22;
    for (let i = 0; i < seg; i++) {
      const a = o.uc - w / 2 + (w * i) / seg;
      const b = o.uc - w / 2 + (w * (i + 1)) / seg;
      const mat = i % 2 === 0 ? 'paintBlue' : 'paintGreen';
      localBox(mb, mp, a, b, y0, y0 + h, -th / 2, th / 2, mat, o.tag || '额枋');
    }
    // 金线
    localBox(mb, mp, o.uc - w / 2, o.uc + w / 2, y0 + h * 0.62, y0 + h * 0.72, -th / 2 - 0.02, th / 2 + 0.02, 'gold', o.tag || '额枋·金线');
  }

  /* ------------------------------ 雀替 ------------------------------ */
  function queti(mb, dir, at, u, y, w, tag) {
    const mp = mapper(dir, at);
    // 阶梯状小托木
    localBox(mb, mp, u, u + w, y, y + 0.14, 0.02, 0.22, 'wood', tag);
    localBox(mb, mp, u + 0.06, u + w * 0.8, y - 0.14, y, 0.02, 0.18, 'wood', tag);
    localBox(mb, mp, u + 0.12, u + w * 0.62, y - 0.26, y - 0.14, 0.02, 0.14, 'wood', tag);
  }

  /* ------------------------------ 台基 ------------------------------ */
  // style: xumizuo(须弥座) / plain(直台基) / stone(毛石台)
  function platform(mb, o) {
    const h = o.h, tag = '台基';
    const style = o.style || 'xumizuo';

    if (style === 'plain') {
      // 直台基：陡板 + 阶条石压面
      mb.box(o.x0, o.x1, 0, h - 0.1, o.z0, o.z1, 'stoneDark', tag + '·陡板');
      mb.box(o.x0 - 0.05, o.x1 + 0.05, h - 0.1, h, o.z0 - 0.05, o.z1 + 0.05, 'stone', tag + '·阶条石');
      for (let x = o.x0; x < o.x1 - 0.2; x += 1.2) {
        mb.box(x + 0.02, Math.min(x + 1.18, o.x1 - 0.02), h - 0.1, h, o.z1 - 0.06, o.z1 + 0.05, 'slab', tag + '·阶条石');
      }
      mb.box(o.x0 + 0.02, o.x1 - 0.02, h, h + 0.04, o.z0 + 0.02, o.z1 - 0.02, 'stone', tag + '·台面');
    } else if (style === 'stone') {
      // 毛石台：乱石砌筑，缝里透暗
      mb.box(o.x0, o.x1, 0, h, o.z0, o.z1, 'stoneDark', tag + '·台芯');
      const rows = Math.max(1, Math.round(h / 0.28));
      for (let r = 0; r < rows; r++) {
        const y0 = (h * r) / rows, y1 = (h * (r + 1)) / rows - 0.02;
        for (let x = o.x0; x < o.x1 - 0.1; x += 0.7) {
          mb.box(x + 0.02, Math.min(x + 0.66, o.x1), y0 + 0.02, y1, o.z1 - 0.12, o.z1, 'stone', tag + '·毛石');
        }
        for (let z = o.z0; z < o.z1 - 0.1; z += 0.7) {
          mb.box(o.x1 - 0.12, o.x1, y0 + 0.02, y1, z + 0.02, Math.min(z + 0.66, o.z1), 'stone', tag + '·毛石');
        }
      }
      mb.box(o.x0 + 0.02, o.x1 - 0.02, h, h + 0.04, o.z0 + 0.02, o.z1 - 0.02, 'stone', tag + '·台面');
    } else {
      const inset = 0.18;
      mb.box(o.x0, o.x1, 0, 0.12, o.z0, o.z1, 'stoneDark', tag + '·圭脚');
      mb.box(o.x0 + 0.04, o.x1 - 0.04, 0.12, 0.3, o.z0 + 0.04, o.z1 - 0.04, 'stone', tag + '·下枋');
      mb.box(o.x0 + inset, o.x1 - inset, 0.3, h - 0.28, o.z0 + inset, o.z1 - inset, 'stoneDark', tag + '·束腰');
      mb.box(o.x0 + 0.02, o.x1 - 0.02, h - 0.28, h, o.z0 + 0.02, o.z1 - 0.02, 'marble', tag + '·上枋');
      mb.box(o.x0 + 0.02, o.x1 - 0.02, h, h + 0.04, o.z0 + 0.02, o.z1 - 0.02, 'stone', tag + '·台面');
      // 束腰莲瓣（简化为小方块点阵）
      if (o.lotus) {
        for (let x = o.x0 + 0.4; x < o.x1 - 0.3; x += 0.5) {
          mb.box(x, x + 0.26, 0.34, 0.44, o.z1 - inset - 0.02, o.z1 - inset + 0.02, 'marble', tag + '·莲瓣');
          mb.box(x, x + 0.26, 0.34, 0.44, o.z0 + inset - 0.02, o.z0 + inset + 0.02, 'marble', tag + '·莲瓣');
        }
      }
    }

    // 踏跺（含垂带石）：front = +z（与门、匾额同一面），back = -z
    const st = o.steps || 0;
    if (st > 0) {
      const sw = o.stepW || 2.4;
      const dirFront = o.stepDir !== 'back';
      const sgn = dirFront ? 1 : -1;
      const zEdge = dirFront ? o.z1 : o.z0;
      for (let i = 0; i < st; i++) {
        const d = (i + 1) * (h / st);
        const za = zEdge + sgn * (i * 0.3 + 0.02);
        const zb = zEdge + sgn * ((i + 1) * 0.3);
        const zz0 = Math.min(za, zb), zz1 = Math.max(za, zb);
        mb.box(-sw / 2, sw / 2, 0, h - d, zz0, zz1, 'stone', tag + '·踏跺');
        // 垂带
        for (const s of [-1, 1]) {
          mb.box(s * sw / 2, s * (sw / 2 + 0.26), 0, h - d + 0.16, zz0, zz1, 'slab', tag + '·垂带');
        }
        // 御路石：三级以上踏跺居中铺一条雕花斜板（云纹用深浅两色小条表现）
        if (st >= 3 && i === 0) {
          const pw = Math.min(1.1, sw * 0.42);
          mb.box(-pw / 2, pw / 2, 0.02, h - d + 0.05, zz0, zz1, 'marble', tag + '·御路石');
          for (let k = 0; k < 3; k++) {
            const qa = Math.min(zz0 + 0.04 + k * 0.09, zz0 + 0.08 + k * 0.09);
            mb.box(-pw / 2 + 0.06, pw / 2 - 0.06, 0.02, 0.06, qa, qa + 0.04, 'marbleB', tag + '·御路云纹');
          }
        }
      }
    }
  }

  /* ------------------------------ 栏杆 ------------------------------ */
  // style: marble(石栏/望柱) / wood(寻杖栏杆) / beauty(美人靠)
  function railing(mb, o) {
    const a = o.a, b = o.b, y = o.y, tag = '栏杆';
    const style = o.style || 'marble';
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const gap = style === 'wood' ? 0.8 : 0.62;
    const n = Math.max(2, Math.round(len / gap));
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const dx = Math.cos(ang), dz = Math.sin(ang);

    if (style === 'wood') {
      // 寻杖栏杆：望柱 + 寻杖 + 净瓶 + 地栿
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const x = V.lerp(a[0], b[0], t), z = V.lerp(a[1], b[1], t);
        mb.taper(x, z, 0.14, 0.14, 0.15, 0.15, y, y + 0.72, 'wood', tag + '·望柱');
        mb.taper(x, z, 0.17, 0.17, 0.20, 0.20, y + 0.72, y + 0.8, 'wood', tag + '·柱头');
      }
      const half = len / 2;
      GF.beamRound(mb, [a[0], y + 0.68, a[1]], [b[0], y + 0.68, b[1]], 0.045, 6, 'woodDark', tag + '·寻杖');
      GF.beamRound(mb, [a[0], y + 0.1, a[1]], [b[0], y + 0.1, b[1]], 0.05, 6, 'wood', tag + '·地栿');
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const x = V.lerp(a[0], b[0], t), z = V.lerp(a[1], b[1], t);
        const hh = len / n / 2 - 0.12;
        GF.beamRound(mb, [x - dx * hh, y + 0.12, z - dz * hh], [x - dx * hh, y + 0.64, z - dz * hh], 0.028, 6, 'wood', tag + '·净瓶');
        GF.beamRound(mb, [x + dx * hh, y + 0.12, z + dz * hh], [x + dx * hh, y + 0.64, z + dz * hh], 0.028, 6, 'wood', tag + '·净瓶');
      }
      return;
    }

    if (style === 'beauty') {
      // 美人靠（吴王靠）：坐板 + 外倾靠背
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const x = V.lerp(a[0], b[0], t), z = V.lerp(a[1], b[1], t);
        mb.boxC(x, z, 0.12, 0.12, y, y + 0.5, 'wood', tag + '·靠柱');
      }
      const seat = 0.5, back = 0.92;
      const p0 = [a[0], a[1]], p1 = [b[0], b[1]];
      // 坐板
      for (let i = 0; i < n; i++) {
        const t0 = i / n, t1 = (i + 1) / n;
        const q0 = [V.lerp(p0[0], p1[0], t0), V.lerp(p0[1], p1[1], t0)];
        const q1 = [V.lerp(p0[0], p1[0], t1), V.lerp(p0[1], p1[1], t1)];
        GF.beamBetween(mb, [q0[0], y + seat, q0[1]], [q1[0], y + seat, q1[1]], 0.34, 0.06, 'wood', tag + '·坐板');
        // 靠背（略外倾）：用两根细木撑出斜面
        GF.beamBetween(mb, [q0[0], y + seat + 0.05, q0[1]], [q1[0], y + back, q1[1]], 0.06, 0.24, 'wood', tag + '·靠背');
        GF.beamBetween(mb, [q0[0], y + seat + 0.05, q0[1]], [q1[0], y + seat + 0.05, q1[1]], 0.07, 0.1, 'woodDark', tag + '·下枋');
      }
      GF.beamBetween(mb, [a[0], y + back + 0.02, a[1]], [b[0], y + back + 0.02, b[1]], 0.12, 0.08, 'wood', tag + '·寻杖');
      return;
    }

    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = V.lerp(a[0], b[0], t), z = V.lerp(a[1], b[1], t);
      mb.boxC(x, z, 0.16, 0.16, y, y + 0.62, 'marble', tag + '·望柱');
      mb.boxC(x, z, 0.2, 0.2, y + 0.62, y + 0.68, 'marble', tag + '·柱头');
      if (i < n) {
        const t2 = (i + 0.5) / n;
        const x2 = V.lerp(a[0], b[0], t2), z2 = V.lerp(a[1], b[1], t2);
        const half = len / n / 2 - 0.1;
        // 地栿：石栏也得有底，不然整排栏杆悬空看着“镂空”
        GF.beamBetween(mb,
          [x2 - dx * half, y + 0.01, z2 - dz * half],
          [x2 + dx * half, y + 0.01, z2 + dz * half],
          0.1, 0.16, 'marble', tag + '·地栿');
        for (const [dy0, dy1] of [[0.14, 0.46], [0.5, 0.58]]) {
          GF.beamBetween(mb,
            [x2 - dx * half, y + dy0, z2 - dz * half],
            [x2 + dx * half, y + dy1, z2 + dz * half],
            0.06, 0.14, 'marble', tag + '·栏板');
        }
      }
    }
  }

  /* ------------------------------ 马头墙 ------------------------------ */
  // 徽派民居 stepped 山墙，沿 x 方向若干级
  function horseHeadWall(mb, o) {
    // o: cx, z, halfLen, y0, yTop, steps, depth
    const d = o.depth || 0.28, tag = '马头墙';
    const steps = o.steps || 3;
    const span = o.halfLen / steps;
    for (let i = 0; i < steps; i++) {
      const w = o.halfLen - i * span;
      const yTo = o.y0 + (o.yTop - o.y0) * ((i + 1) / steps);
      for (const s of [-1, 1]) {
        mb.box(o.cx + s * (o.halfLen - w), o.cx + s * (o.halfLen - w + span), o.y0, yTo, o.z - d / 2, o.z + d / 2, 'plaster', tag);
        // 压顶瓦
        mb.box(o.cx + s * (o.halfLen - w) - 0.08, o.cx + s * (o.halfLen - w + span) + 0.08, yTo, yTo + 0.16, o.z - d / 2 - 0.1, o.z + d / 2 + 0.1, 'tile', tag + '·压顶');
      }
    }
    // 中间高起的墙垛
    mb.box(o.cx - span / 2, o.cx + span / 2, o.y0, o.yTop + 0.2, o.z - d / 2, o.z + d / 2, 'plaster', tag);
    mb.box(o.cx - span / 2 - 0.08, o.cx + span / 2 + 0.08, o.yTop + 0.2, o.yTop + 0.36, o.z - d / 2 - 0.1, o.z + d / 2 + 0.1, 'tile', tag + '·压顶');
  }

  /* ------------------------------ 院墙 ------------------------------ */
  function courtWall(mb, o) {
    // o: x0,x1,z0,z1, y (高), gate: {side:'front', w, h} 可选
    const y = o.y || 2.2, d = 0.3, tag = '院墙';
    const sides = [
      { dir: 'front', at: o.z1, a: [o.x0, o.z1], b: [o.x1, o.z1], u0: o.x0, u1: o.x1 },
      { dir: 'back', at: o.z0, a: [o.x1, o.z0], b: [o.x0, o.z0], u0: -o.x1, u1: -o.x0 },
      { dir: 'right', at: o.x1, a: [o.x1, o.z1], b: [o.x1, o.z0], u0: -o.z1, u1: -o.z0 },
      { dir: 'left', at: o.x0, a: [o.x0, o.z0], b: [o.x0, o.z1], u0: o.z0, u1: o.z1 }
    ];
    for (const s of sides) {
      let hole = [];
      if (o.gate && o.gate.side === s.dir) {
        if (o.gate.shape === 'round') {
          // 月洞门：下部直段 + 上部半圆拱。半径取门宽的一半，直段 = 门洞高 - 半径
          const R = o.gate.w / 2, h0 = Math.max(0.4, o.gate.h - R), n = 16;
          const w = (2 * R) / n;
          for (let k = 0; k < n; k++) {
            const u0 = -R + w * k, u1 = u0 + w;
            const uc = (u0 + u1) / 2;
            const top = Math.sqrt(Math.max(0, R * R - uc * uc));
            hole.push({ u0: u0, u1: u1, v0: -0.02, v1: h0 + top });
          }
        } else {
          hole = [{ u0: -o.gate.w / 2, u1: o.gate.w / 2, v0: 0, v1: o.gate.h }];
        }
      }
      // 漏窗（墙上开洞）
      const wins = (o.windows || []).filter((w) => w.dir === s.dir).map((w) => {
        const ww = w.w || 1.5, wh = w.h || 1.2;
        return { u: w.u, v: w.v, u0: w.u - ww / 2, u1: w.u + ww / 2, v0: w.v - wh / 2, v1: w.v + wh / 2 };
      });
      for (const w of wins) hole.push({ u0: w.u0, u1: w.u1, v0: w.v0, v1: w.v1 });

      wallWithHoles(mb, { dir: s.dir, at: s.at, u0: s.u0, u1: s.u1, y0: 0, y1: y, holes: hole, thickness: d, mat: 'plaster', tag: tag });
      // 瓦顶小脊
      const ax = s.a[0], az = s.a[1], bx = s.b[0], bz = s.b[1];
      const isX = Math.abs(bx - ax) > Math.abs(bz - az);
      const rh = 0.26;
      if (isX) {
        mb.box(Math.min(ax, bx) - 0.06, Math.max(ax, bx) + 0.06, y, y + 0.16, az - d / 2 - 0.08, az + d / 2 + 0.08, 'tile', tag + '·压顶');
        mb.box(Math.min(ax, bx) - 0.06, Math.max(ax, bx) + 0.06, y + 0.16, y + rh, az - 0.08, az + 0.08, 'tileEnd', tag + '·脊');
      } else {
        mb.box(ax - d / 2 - 0.08, ax + d / 2 + 0.08, y, y + 0.16, Math.min(az, bz) - 0.06, Math.max(az, bz) + 0.06, 'tile', tag + '·压顶');
        mb.box(ax - 0.08, ax + 0.08, y + 0.16, y + rh, Math.min(az, bz) - 0.06, Math.max(az, bz) + 0.06, 'tileEnd', tag + '·脊');
      }
      const mp = mapper(s.dir, s.at);
      // 月洞门石券：下部两侧立框（0 → 直段顶），上部沿半圆铺券石（圆心在直段顶）
      if (o.gate && o.gate.side === s.dir && o.gate.shape === 'round') {
        const R2 = o.gate.w / 2, h0 = Math.max(0.4, o.gate.h - R2);
        for (let i = 0; i <= 10; i++) {
          const a2 = Math.PI * (i / 10);
          const uu = Math.cos(a2) * (R2 + 0.1);
          const vv = h0 + Math.sin(a2) * (R2 + 0.1);
          localBox(mb, mp, uu - 0.16, uu + 0.16, vv - 0.14, vv + 0.14, -d / 2 - 0.1, d / 2 + 0.1, 'slab', tag + '·券石');
        }
        for (const sx2 of [-1, 1]) localBox(mb, mp, sx2 * R2 - 0.1, sx2 * R2 + 0.1, 0, h0 + 0.03, -d / 2 - 0.1, d / 2 + 0.1, 'slab', tag + '·券石');
      }
      // 漏窗窗框与冰裂纹花格
      for (const w of wins) {
        localBox(mb, mp, w.u0 - 0.1, w.u1 + 0.1, w.v1, w.v1 + 0.12, -0.18, 0.18, 'slab', tag + '·窗框');
        localBox(mb, mp, w.u0 - 0.1, w.u1 + 0.1, w.v0 - 0.12, w.v0, -0.18, 0.18, 'slab', tag + '·窗框');
        localBox(mb, mp, w.u0 - 0.1, w.u0 + 0.1, w.v0, w.v1, -0.18, 0.18, 'slab', tag + '·窗框');
        localBox(mb, mp, w.u1 - 0.1, w.u1 + 0.1, w.v0, w.v1, -0.18, 0.18, 'slab', tag + '·窗框');
        const n = 3;
        for (let i = 1; i < n; i++) {
          const uu = w.u0 + (w.u1 - w.u0) * i / n;
          localBox(mb, mp, uu - 0.04, uu + 0.04, w.v0, w.v1, -0.12, 0.12, 'stoneDark', tag + '·花格');
        }
        for (let i = 1; i < n; i++) {
          const vv = w.v0 + (w.v1 - w.v0) * i / n;
          localBox(mb, mp, w.u0, w.u1, vv - 0.04, vv + 0.04, -0.12, 0.12, 'stoneDark', tag + '·花格');
        }
      }
    }
  }

  /* ------------------------------ 影壁 ------------------------------ */
  function yingbi(mb, o) {
    const w = o.w || 3.2, h = o.h || 2.4, tag = '影壁';
    const x = o.cx, z = o.cz;
    mb.box(x - w / 2, x + w / 2, 0, 0.3, z - 0.2, z + 0.2, 'stoneDark', tag + '·座');
    mb.box(x - w / 2 + 0.1, x + w / 2 - 0.1, 0.3, h, z - 0.16, z + 0.16, 'brick', tag);
    // 中心琉璃团花
    mb.box(x - 0.5, x + 0.5, h * 0.5, h * 0.78, z + 0.16, z + 0.22, 'glazeG', tag + '·团花');
    mb.box(x - 0.32, x + 0.32, h * 0.58, h * 0.7, z + 0.22, z + 0.26, 'gold', tag + '·团花心');
    // 瓦顶
    mb.box(x - w / 2 - 0.2, x + w / 2 + 0.2, h, h + 0.14, z - 0.26, z + 0.26, 'tile', tag + '·顶');
    mb.box(x - w / 2 - 0.2, x + w / 2 + 0.2, h + 0.14, h + 0.24, z - 0.08, z + 0.08, 'tileEnd', tag + '·脊');
  }

  /* ------------------------------ 石狮 ------------------------------ */
  function lion(mb, x, z, s, tag) {
    s = s || 1;
    mb.boxC(x, z, 0.8 * s, 0.8 * s, 0, 0.18 * s, 'stoneDark', '石狮·座');
    mb.boxC(x, z, 0.5 * s, 0.62 * s, 0.18 * s, 0.62 * s, 'stone', '石狮·身');
    mb.boxC(x, z - 0.1 * s, 0.42 * s, 0.36 * s, 0.62 * s, 0.86 * s, 'stone', '石狮·头');
    mb.boxC(x, z - 0.06 * s, 0.52 * s, 0.1 * s, 0.66 * s, 0.76 * s, 'stoneDark', '石狮·鬃');
    for (const sx of [-1, 1]) {
      mb.boxC(x + sx * 0.16 * s, z - 0.2 * s, 0.12 * s, 0.2 * s, 0.18 * s, 0.42 * s, 'stone', '石狮·腿');
    }
  }

  /* ------------------------------ 香炉 ------------------------------ */
  function censer(mb, x, z, s, tag) {
    s = s || 1;
    mb.lathe(x, z, [
      [0, 0.02], [0.3 * s, 0.04], [0.24 * s, 0.18 * s], [0.36 * s, 0.34 * s],
      [0.4 * s, 0.5 * s], [0.36 * s, 0.56 * s], [0.2 * s, 0.6 * s], [0, 0.62 * s]
    ], 8, 'gold', tag || '香炉');
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      mb.boxC(x + Math.cos(a) * 0.22 * s, z + Math.sin(a) * 0.22 * s, 0.08 * s, 0.08 * s, 0, 0.14 * s, 'gold', tag);
    }
    // 香柱
    for (let i = 0; i < 3; i++) {
      mb.boxC(x + (i - 1) * 0.08 * s, z, 0.02, 0.02, 0.6 * s, 0.78 * s, 'zhu', tag + '·香');
    }
  }

  /* ------------------------------ 灯笼 ------------------------------ */
  function lantern(mb, x, y, z, s, tag) {
    s = s || 1;
    mb.boxC(x, z, 0.03, 0.03, y, y + 0.28 * s, 'wood', '灯笼·吊绳');
    mb.lathe(x, z, [
      [0.1 * s, y + 0.02], [0.22 * s, y + 0.06], [0.26 * s, y + 0.16], [0.26 * s, y + 0.28],
      [0.2 * s, y + 0.34], [0.1 * s, y + 0.38]
    ].map((p) => p), 8, 'lantern', tag || '灯笼');
    mb.boxC(x, z, 0.3 * s, 0.3 * s, y + 0.36 * s, y + 0.42 * s, 'gold', '灯笼·口');
    mb.boxC(x, z, 0.06 * s, 0.06 * s, y - 0.14 * s, y + 0.02 * s, 'gold', '灯笼·坠');
  }

  /* ------------------------------ 幡旗 ------------------------------ */
  function banner(mb, x, y, z, h, w, tag, mat) {
    mb.boxC(x, z, 0.08, 0.08, 0, y + h, 'wood', '旗杆');
    mb.panel(x + 0.05, x + 0.05 + w, y + h - 1.6, y + h - 0.1, z, mat || 'cloth', tag || '幡');
    mb.boxC(x, z, 0.16, 0.16, y + h, y + h + 0.14, 'gold', '旗杆·顶');
  }

  /* ------------------------------ 树 ------------------------------ */
  // 树干：上细下粗的旋转体（6 棱）
  function trunk(mb, x, z, y, r0, mat, tag) {
    mb.lathe(x, z, [[0, 0], [r0, 0.02], [r0 * 0.86, y * 0.55], [r0 * 0.6, y]], 6, mat, tag);
  }
  // 树冠：多层不规则多边形棱柱，逐层内收、随机相位与半径，轮廓带起伏而非方箱
  function blobCrown(mb, x, y0, z, rw, rh, r, mat, tag, layers) {
    const L = layers || 4;
    for (let i = 0; i < L; i++) {
      const frac = i / L;
      const k = r.int(5, 8);
      const a0 = r.range(0, 6.283);
      const rad = rw * (1 - frac * 0.6);
      const pts = [];
      for (let j = 0; j < k; j++) {
        const a = a0 + (j / k) * 6.283;
        const rr = rad * (0.78 + r.next() * 0.42);
        pts.push([x + Math.cos(a) * rr, z + Math.sin(a) * rr]);
      }
      mb.prism(pts, y0 + rh * frac, y0 + rh * (frac + 0.9 / L), mat, tag);
    }
  }

  function tree(mb, x, z, kind, rng, s, tag) {
    s = s || 1;
    const r = rng || new GF.RNG(1);
    if (kind === 'pine') {
      trunk(mb, x, z, 1.5 * s, 0.13 * s, 'wood', '松·干');
      for (let i = 0; i < 3; i++) {
        const y0 = 0.9 * s + i * 0.5 * s;
        blobCrown(mb, x + r.range(-0.08, 0.08) * s, y0, z + r.range(-0.08, 0.08) * s,
          (0.85 - i * 0.21) * s, 0.46 * s, r, 'pine', '松·冠', 3);
      }
    } else if (kind === 'plum') {
      trunk(mb, x, z, 1.15 * s, 0.1 * s, 'wood', '梅·干');
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + r.range(0, 0.6);
        const end = [x + Math.cos(a) * 0.9 * s, 1.05 * s + r.range(0.1, 0.5) * s, z + Math.sin(a) * 0.9 * s];
        GF.beamRound(mb, [x, 1.0 * s, z], end, 0.045 * s, 5, 'wood', '梅·枝');
        blobCrown(mb, end[0], end[1] - 0.1 * s, end[2], 0.2 * s, 0.22 * s, r, 'plum', '梅·花', 2);
      }
      blobCrown(mb, x, 1.3 * s, z, 0.34 * s, 0.4 * s, r, 'plum', '梅·花', 3);
    } else if (kind === 'bamboo') {
      const n = 4;
      for (let i = 0; i < n; i++) {
        const ox = (i - n / 2) * 0.22 * s + r.range(-0.1, 0.1);
        const hh = (2.4 + r.range(0, 1.0)) * s;
        const px = x + ox, pz = z + r.range(-0.2, 0.2);
        mb.cyl(px, pz, 0.055 * s, 0, hh, 6, 'bamboo', '竹·竿');
        for (let k = 1; k <= 4; k++) {
          const yy = (hh * k) / 5;
          mb.cyl(px, pz, 0.075 * s, yy - 0.025 * s, yy + 0.025 * s, 6, 'bamboo', '竹·节');
        }
        for (let k = 0; k < 4; k++) {
          const a = r.range(0, 6.283);
          const yy = hh * (0.45 + k * 0.15);
          const p0 = [px, yy, pz];
          const p1 = [px + Math.cos(a) * 0.55 * s, yy - 0.3 * s, pz + Math.sin(a) * 0.55 * s];
          GF.beamBetween(mb, p0, p1, 0.1 * s, 0.02 * s, 'bamboo', '竹·叶');
        }
      }
    } else if (kind === 'willow') {
      trunk(mb, x, z, 1.7 * s, 0.13 * s, 'wood', '柳·干');
      blobCrown(mb, x, 1.5 * s, z, 0.74 * s, 0.55 * s, r, 'willow', '柳·冠', 3);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const px = x + Math.cos(a) * 0.62 * s, pz = z + Math.sin(a) * 0.62 * s;
        GF.beamRound(mb, [px, 1.95 * s, pz], [px + Math.cos(a) * 0.18 * s, 1.0 * s, pz + Math.sin(a) * 0.18 * s], 0.045 * s, 5, 'willow', '柳·条');
      }
    } else if (kind === 'gingko') {
      trunk(mb, x, z, 1.6 * s, 0.12 * s, 'wood', '银杏·干');
      blobCrown(mb, x, 1.45 * s, z, 0.78 * s, 0.9 * s, r, 'gold', '银杏·冠', 4);
    } else if (kind === 'banana') {
      // 芭蕉：假茎 + 向外垂下的扇叶（叶片必须斜垂，不能是平顶桌面）
      mb.cyl(x, z, 0.2 * s, 0, 2.15 * s, 8, 'bamboo', '芭蕉·茎');
      const nL = 7;
      for (let i = 0; i < nL; i++) {
        const a = (i / nL) * Math.PI * 2 + 0.35;
        const ca = Math.cos(a), sa = Math.sin(a);
        const pa = -sa, pb = ca;
        // 叶片改成 3 段折线：根部窄 → 中段宽 → 叶尖下垂收窄，不再是“绿色螺旋桨”
        const segs = [[0.16, 2.16, 0.10], [0.58, 2.00, 0.22], [1.0, 1.74, 0.26], [1.3, 1.4, 0.11]]
          .map((v) => [v[0] * s, v[1] * s, v[2] * s]);
        for (let k = 0; k < segs.length - 1; k++) {
          const r0 = segs[k][0], y0 = segs[k][1], w0 = segs[k][2];
          const r1 = segs[k + 1][0], y1 = segs[k + 1][1], w1 = segs[k + 1][2];
          const A = [x + ca * r0 + pa * w0, y0, z + sa * r0 + pb * w0];
          const B = [x + ca * r0 - pa * w0, y0, z + sa * r0 - pb * w0];
          const C = [x + ca * r1 - pa * w1, y1, z + sa * r1 - pb * w1];
          const D = [x + ca * r1 + pa * w1, y1, z + sa * r1 + pb * w1];
          mb.quad(A, B, C, D, 'leaf', '芭蕉·叶');
          mb.quad(D, C, B, A, 'leaf', '芭蕉·叶');
        }
      }
      mb.cyl(x, z, 0.24 * s, 2.1 * s, 2.2 * s, 6, 'leaf', '芭蕉·心');
    } else if (kind === 'maple') {
      // 红枫：树干 + 三层云片冠，冠不再是红砖块
      trunk(mb, x, z, 1.55 * s, 0.11 * s, 'wood', '枫·干');
      blobCrown(mb, x, 1.35 * s, z, 0.7 * s, 0.8 * s, r, 'zhu', '枫·冠', 4);
      blobCrown(mb, x + 0.32 * s, 1.55 * s, z - 0.26 * s, 0.32 * s, 0.32 * s, r, 'terracotta', '枫·叶', 2);
    } else {
      trunk(mb, x, z, 1.35 * s, 0.12 * s, 'wood', '树·干');
      blobCrown(mb, x, 1.25 * s, z, 0.8 * s, 0.95 * s, r, 'leaf', '树·冠', 4);
    }
  }

  /* ------------------------------ 假山 ------------------------------ */
  function rock(mb, x, z, s, rng, tag) {
    s = s || 1;
    const r = rng || new GF.RNG(7);
    const n = r.int(3, 5);
    for (let i = 0; i < n; i++) {
      const w = (0.45 + r.next() * 0.8) * s;
      const h = (0.3 + r.next() * 1.1) * s;
      const px = x + r.range(-0.55, 0.55) * s, pz = z + r.range(-0.45, 0.45) * s;
      const k = r.int(5, 7);
      const a0 = r.range(0, Math.PI * 2);
      // 一块石头拆成 3 层不规则多边形棱柱：逐层内收，轮廓带随机半径与随机相位，不再是方箱
      const layers = 3;
      const radii = [];
      for (let j = 0; j < k; j++) radii.push(0.82 + r.next() * 0.36);
      for (let L = 0; L < layers; L++) {
        const frac = L / layers;
        const shrink = 1 - frac * 0.5;
        const twist = frac * 0.35;
        const pts = [];
        for (let j = 0; j < k; j++) {
          const a = a0 + twist + (j / k) * Math.PI * 2;
          const rad = w * 0.5 * shrink * radii[j];
          pts.push([px + Math.cos(a) * rad, pz + Math.sin(a) * rad * 0.85]);
        }
        const ya = (h * L) / layers, yb = (h * (L + 1)) / layers;
        mb.prism(pts, ya, yb, 'stone', tag || '假山');
      }
    }
  }

  /* ------------------------------ 水池 ------------------------------ */
  function pond(mb, x, z, w, d, tag) {
    // 水面
    mb.box(x - w / 2, x + w / 2, 0, 0.04, z - d / 2, z + d / 2, 'water', tag || '水池');
    // 岸石
    const step = 0.5;
    for (let i = 0; i < Math.round(w / step); i++) {
      const px = x - w / 2 + step * (i + 0.5);
      mb.boxC(px, z - d / 2, step * 0.9, 0.2, 0, 0.16, 'stone', '池岸');
      mb.boxC(px, z + d / 2, step * 0.9, 0.2, 0, 0.16, 'stone', '池岸');
    }
    for (let i = 0; i < Math.round(d / step); i++) {
      const pz = z - d / 2 + step * (i + 0.5);
      mb.boxC(x - w / 2, pz, 0.2, step * 0.9, 0, 0.16, 'stone', '池岸');
      mb.boxC(x + w / 2, pz, 0.2, step * 0.9, 0, 0.16, 'stone', '池岸');
    }
    // 睡莲
    for (let i = 0; i < 3; i++) {
      mb.boxC(x + (i - 1) * 0.8, z + (i % 2) * 0.4, 0.4, 0.3, 0.04, 0.08, 'leaf', '莲叶');
    }
  }

  /* ------------------------------ 家具 ------------------------------ */
  function furniture(mb, kind, x, z, s, rot, tag) {
    s = s || 1;
    if (kind === 'table') {
      mb.boxC(x, z, 1.4 * s, 0.8 * s, 0.72 * s, 0.8 * s, 'wood', '桌·面');
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        mb.boxC(x + sx * 0.6 * s, z + sz * 0.3 * s, 0.1 * s, 0.1 * s, 0, 0.72 * s, 'wood', '桌·腿');
      }
    } else if (kind === 'stool') {
      mb.boxC(x, z, 0.46 * s, 0.46 * s, 0.4 * s, 0.5 * s, 'wood', '凳');
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        mb.boxC(x + sx * 0.17 * s, z + sz * 0.17 * s, 0.07 * s, 0.07 * s, 0, 0.4 * s, 'wood', '凳·腿');
      }
    } else if (kind === 'screen') {
      // 三折屏风
      for (let i = -1; i <= 1; i++) {
        const px = x + i * 0.62 * s;
        const pz = z + (i === 0 ? 0.1 : 0);
        mb.boxC(px, pz, 0.6 * s, 0.08 * s, 0, 1.7 * s, 'wood', '屏风');
        mb.boxC(px, pz - 0.06 * s, 0.48 * s, 0.06 * s, 0.15 * s, 1.5 * s, 'cloth', '屏风·绢');
        mb.boxC(px, pz - 0.09 * s, 0.3 * s, 0.02 * s, 0.9 * s, 1.2 * s, 'paintBlue', '屏风·画');
      }
    } else if (kind === 'shelf') {
      mb.boxC(x, z, 1.2 * s, 0.35 * s, 0, 2.0 * s, 'wood', '书架');
      for (let i = 0; i < 3; i++) {
        const y = 0.4 * s + i * 0.55 * s;
        mb.boxC(x, z - 0.18 * s, 1.06 * s, 0.06 * s, y, y + 0.06 * s, 'woodDark' === 'woodDark' ? 'wood' : 'wood', '书架·层');
        for (let k = 0; k < 4; k++) {
          mb.boxC(x - 0.42 * s + k * 0.28 * s, z, 0.16 * s, 0.22 * s, y + 0.06 * s, y + 0.26 * s, 'cloth', '书');
        }
      }
    } else if (kind === 'bed') {
      mb.boxC(x, z, 1.3 * s, 0.9 * s, 0, 0.42 * s, 'wood', '榻');
      mb.boxC(x, z, 1.2 * s, 0.82 * s, 0.42 * s, 0.52 * s, 'cloth', '榻·垫');
      mb.boxC(x - 0.42 * s, z, 0.3 * s, 0.5 * s, 0.52 * s, 0.66 * s, 'cloth', '榻·枕');
      mb.boxC(x, z - 0.5 * s, 1.3 * s, 0.06 * s, 0, 1.0 * s, 'wood', '榻·屏');
    } else if (kind === 'altar') {
      mb.boxC(x, z, 1.6 * s, 0.6 * s, 0, 0.85 * s, 'wood', '香案');
      mb.boxC(x, z, 1.7 * s, 0.7 * s, 0.85 * s, 0.95 * s, 'timber', '香案·面');
      censer(mb, x, z, 0.6 * s, '香案·炉');
    } else if (kind === 'shrine') {
      mb.boxC(x, z, 0.9 * s, 0.6 * s, 0, 1.3 * s, 'timber', '佛龛');
      mb.boxC(x, z - 0.28 * s, 0.6 * s, 0.1 * s, 0.3 * s, 1.1 * s, 'gold', '佛龛·像');
      mb.boxC(x, z - 0.32 * s, 0.5 * s, 0.06 * s, 0.4 * s, 0.9 * s, 'gold', '佛龛·光');
    } else if (kind === 'lamp') {
      mb.boxC(x, z, 0.2 * s, 0.2 * s, 0, 1.6 * s, 'wood', '灯架');
      lantern(mb, x, 1.2 * s, z, 0.7 * s, '灯架·灯笼');
    } else if (kind === 'firepit') {
      // 火塘：石圈 + 灶心 + 火焰（穴居 / 半坡室内陈设）
      mb.boxC(x, z, 0.9 * s, 0.9 * s, 0, 0.12 * s, 'stoneDark', '火塘·石圈');
      mb.boxC(x, z, 0.55 * s, 0.55 * s, 0.12 * s, 0.16 * s, 'dark', '火塘·灶心');
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2 + Math.PI / 4;
        mb.boxC(x + Math.cos(a) * 0.36 * s, z + Math.sin(a) * 0.36 * s, 0.18 * s, 0.18 * s, 0.1 * s, 0.26 * s, 'stone', '火塘·石块');
      }
      mb.lathe(x, z, [[0.02, 0.16 * s], [0.16 * s, 0.24 * s], [0.1 * s, 0.42 * s], [0.02, 0.5 * s]], 6, 'lamp', '火塘·火焰');
    } else if (kind === 'mat') {
      // 草席：室内铺地薄垫
      mb.boxC(x, z, 1.3 * s, 0.9 * s, 0, 0.06 * s, 'mat', '草席');
    }
  }

  /* ------------------------------ 隔断 ------------------------------ */
  // 碧纱橱 / 博古架 / 落地罩：室内分间隔断，中间留门洞
  function partition(mb, o) {
    const mp = mapper(o.dir || 'front', o.at);
    const t = 0.09;
    const u0 = o.u0, u1 = o.u1, v0 = o.v0, v1 = o.v1;
    const style = o.style || 'screen';
    const open = o.open == null ? 1.5 : o.open;
    const uc = (u0 + u1) / 2;
    const tag = o.tag || '隔断';

    localBox(mb, mp, u0, u1, v0, v0 + 0.14, -t, t, 'wood', tag + '·下槛');
    localBox(mb, mp, u0, u1, v1 - 0.18, v1, -t, t, 'wood', tag + '·上槛');
    localBox(mb, mp, u0, u0 + 0.12, v0, v1, -t, t, 'wood', tag + '·边柱');
    localBox(mb, mp, u1 - 0.12, u1, v0, v1, -t, t, 'wood', tag + '·边柱');

    if (style === 'shelf') {
      // 博古架：分层格架 + 陈设
      const levels = 4;
      for (let i = 1; i < levels; i++) {
        const v = v0 + ((v1 - v0) * i) / levels;
        localBox(mb, mp, u0, u1, v - 0.05, v + 0.05, -t, t, 'wood', tag + '·架层');
      }
      const cols = 3;
      for (let i = 1; i < cols; i++) {
        const u = u0 + ((u1 - u0) * i) / cols;
        localBox(mb, mp, u - 0.05, u + 0.05, v0, v1, -t, t, 'wood', tag + '·立枨');
      }
      // 摆件
      const items = ['glazeG', 'glazeY', 'zhu', 'marble', 'gold', 'paintBlue'];
      for (let i = 0; i < 6; i++) {
        const uu = u0 + ((u1 - u0) * (i + 0.5)) / 6;
        const vv = v0 + ((v1 - v0) * (1 + (i % levels)) ) / levels;
        localBox(mb, mp, uu - 0.1, uu + 0.1, vv, vv + 0.26, -0.06, 0.06, items[i % items.length], tag + '·古玩');
      }
      return;
    }

    // 格心面板（左右两扇）
    const panels = [[u0 + 0.12, uc - open / 2], [uc + open / 2, u1 - 0.12]];
    for (const [a, b] of panels) {
      if (b - a < 0.15) continue;
      const h = (v1 - 0.18) - (v0 + 0.14);
      const py0 = v0 + 0.14 + h * 0.42;
      // 下裙板
      localBox(mb, mp, a, b, v0 + 0.14, py0, -0.045, 0.045, o.lowerMat || 'wood', tag + '·裙板');
      // 上部格心（背衬窗纸）
      localBox(mb, mp, a, b, py0 + 0.04, v1 - 0.18, -0.03, -0.01, 'paper', tag + '·纱');
      const w = b - a, hh = (v1 - 0.18) - (py0 + 0.04);
      const bars = latticeBars(w, hh, o.pattern || 'step');
      const cu = (a + b) / 2, cv = py0 + 0.04 + hh / 2;
      for (const bb of bars) {
        localBox(mb, mp, cu + bb[0], cu + bb[1], cv + bb[2], cv + bb[3], 0.02, 0.07, 'wood', tag + '·格心');
      }
    }
    // 门洞上方的横披
    if (style !== 'frame') {
      const hy0 = v1 - 0.75, hy1 = v1 - 0.18;
      if (hy1 > hy0) {
        const bars = latticeBars(open, hy1 - hy0, 'step');
        const hcv = (hy0 + hy1) / 2;
        for (const bb of bars) {
          localBox(mb, mp, uc + bb[0], uc + bb[1], hcv + bb[2], hcv + bb[3], 0.02, 0.07, 'wood', tag + '·横披');
        }
      }
    }
    // 门洞两侧的抱框
    localBox(mb, mp, uc - open / 2 - 0.07, uc - open / 2, v0, v1, -t, t, 'wood', tag + '·抱框');
    localBox(mb, mp, uc + open / 2, uc + open / 2 + 0.07, v0, v1, -t, t, 'wood', tag + '·抱框');
  }

  /* --------------------------- 楹联 / 门簪 / 抱鼓石 --------------------------- */
  function couplet(mb, o) {
    const mp = mapper(o.dir || 'front', o.at);
    const uc = o.uc || 0, y0 = o.y0, y1 = o.y1;
    const off = o.off || 1.02, w = 0.28, tag = '楹联';
    for (const s of [-1, 1]) {
      const u = uc + s * off;
      localBox(mb, mp, u - w / 2, u + w / 2, y0, y1, 0.02, 0.07, 'zhu', tag);
      localBox(mb, mp, u - w / 2 - 0.03, u - w / 2, y0 - 0.03, y1 + 0.03, 0.02, 0.06, 'gold', tag + '·边');
      const n = 5;
      for (let i = 0; i < n; i++) {
        const v = y1 - 0.3 - i * ((y1 - y0 - 0.5) / n);
        localBox(mb, mp, u - 0.09, u + 0.09, v - 0.11, v + 0.11, 0.07, 0.1, 'gold', tag + '·字');
      }
    }
  }

  function menZan(mb, o) {
    const mp = mapper(o.dir || 'front', o.at);
    const uc = o.uc || 0, v = o.v, tag = '门簪';
    const n = o.n || 3;
    for (let i = 0; i < n; i++) {
      const u = uc + (i - (n - 1) / 2) * (o.gap || 0.42);
      localBox(mb, mp, u - 0.11, u + 0.11, v - 0.1, v + 0.1, -0.02, 0.1, 'woodDark', tag);
      localBox(mb, mp, u - 0.07, u + 0.07, v - 0.06, v + 0.06, 0.1, 0.13, 'gold', tag + '·花心');
    }
  }

  function baogu(mb, x, z, s, tag) {
    s = s || 1;
    const t2 = tag || '抱鼓石';
    mb.boxC(x, z, 0.72 * s, 0.5 * s, 0, 0.14 * s, 'stoneDark', t2 + '·座');
    mb.boxC(x, z, 0.5 * s, 0.36 * s, 0.14 * s, 0.2 * s, 'stone', t2 + '·下槛');
    // 鼓身
    mb.boxC(x, z, 0.46 * s, 0.3 * s, 0.2 * s, 0.62 * s, 'stone', t2);
    mb.boxC(x, z, 0.36 * s, 0.16 * s, 0.62 * s, 0.86 * s, 'stone', t2 + '·鼓面');
    mb.boxC(x, z, 0.44 * s, 0.3 * s, 0.86 * s, 0.94 * s, 'stoneDark', t2 + '·卷云');
    for (const sx of [-1, 1]) {
      mb.boxC(x + sx * 0.14 * s, z - 0.14 * s, 0.1 * s, 0.02, 0.5 * s, 0.56 * s, 'stoneDark', t2 + '·鼓钉');
    }
  }

  /* --------------------------- 天花 / 藻井 --------------------------- */
  function ceiling(mb, o) {
    const { x0, x1, z0, z1, y } = o;
    const step = o.step || 1.1;
    const tag = '天花';
    for (let x = x0; x <= x1 + 1e-6; x += step) {
      mb.box(Number(x) - 0.05, Number(x) + 0.05, y - 0.07, y + 0.07, z0, z1, 'wood', tag + '·支条');
    }
    for (let z = z0; z <= z1 + 1e-6; z += step) {
      mb.box(x0, x1, y - 0.07, y + 0.07, Number(z) - 0.05, Number(z) + 0.05, 'wood', tag + '·支条');
    }
    // 井口天花彩绘板
    for (let x = x0; x < x1 - 0.1; x += step) {
      for (let z = z0; z < z1 - 0.1; z += step) {
        mb.box(x + 0.12, Math.min(x + step - 0.12, x1), y + 0.07, y + 0.11, z + 0.12, Math.min(z + step - 0.12, z1), 'paintGreen', tag + '·板');
      }
    }
  }

  function caisson(mb, x, z, y, w, d, tag) {
    tag = tag || '藻井';
    for (let i = 0; i < 3; i++) {
      const k = 1 - i * 0.26;
      const yy = y + i * 0.26;
      const W = w * k, D = d * k;
      for (const sz of [-1, 1]) {
        mb.box(x - W / 2, x + W / 2, yy, yy + 0.12, z + sz * D / 2 - 0.07, z + sz * D / 2 + 0.07, 'paintBlue', tag + '·方井');
      }
      for (const sx of [-1, 1]) {
        mb.box(x + sx * W / 2 - 0.07, x + sx * W / 2 + 0.07, yy, yy + 0.12, z - D / 2, z + D / 2, 'paintGreen', tag + '·方井');
      }
      if (i === 2) {
        mb.boxC(x, z, W - 0.3, D - 0.3, yy + 0.12, yy + 0.18, 'gold', tag + '·明镜');
      }
    }
    mb.lathe(x, z, [[0, y + 0.9], [0.16, y + 0.92], [0.1, y + 1.05], [0, y + 1.1]], 8, 'gold', tag + '·垂莲');
  }

  /* --------------------------- 园林陈设 --------------------------- */
  function stoneLantern(mb, x, z, s, tag) {
    s = s || 1;
    tag = tag || '石灯';
    mb.boxC(x, z, 0.5 * s, 0.5 * s, 0, 0.12 * s, 'stoneDark', tag + '·座');
    mb.cyl(x, z, 0.12 * s, 0.12 * s, 0.72 * s, 8, 'stone', tag + '·柱');
    mb.boxC(x, z, 0.42 * s, 0.42 * s, 0.72 * s, 0.78 * s, 'stone', tag + '·托');
    mb.boxC(x, z, 0.36 * s, 0.36 * s, 0.78 * s, 1.06 * s, 'lamp', tag + '·灯室');
    for (const sx of [-1, 1]) {
      mb.boxC(x + sx * 0.2 * s, z, 0.03, 0.3 * s, 0.86 * s, 1.04 * s, 'stone', tag + '·窗棂');
    }
    mb.boxC(x, z, 0.5 * s, 0.5 * s, 1.06 * s, 1.18 * s, 'stone', tag + '·檐');
    mb.boxC(x, z, 0.1 * s, 0.1 * s, 1.18 * s, 1.28 * s, 'stoneDark', tag + '·顶');
  }

  function well(mb, x, z, s, tag) {
    s = s || 1;
    tag = tag || '井';
    mb.lathe(x, z, [[0.62 * s, 0], [0.62 * s, 0.14 * s], [0.42 * s, 0.16 * s], [0.42 * s, 0.04 * s], [0, 0.04 * s]], 10, 'stone', tag + '·井台');
    mb.lathe(x, z, [[0.34 * s, 0.04], [0.34 * s, 0.08], [0, 0.08]], 10, 'dark', tag + '·井口');
    for (const sx of [-1, 1]) {
      mb.boxC(x + sx * 0.5 * s, z, 0.1, 0.1, 0, 1.2 * s, 'wood', tag + '·辘轳架');
    }
    mb.boxC(x, z, 1.1 * s, 0.12, 1.2 * s, 1.3 * s, 'wood', tag + '·辘轳轴');
  }

  function stele(mb, x, z, s, tag) {
    s = s || 1;
    tag = tag || '碑';
    mb.boxC(x, z, 0.9 * s, 0.6 * s, 0, 0.22 * s, 'stoneDark', tag + '·座');
    mb.boxC(x, z, 0.6 * s, 0.16 * s, 0.22 * s, 1.7 * s, 'stone', tag + '·碑身');
    mb.boxC(x, z, 0.7 * s, 0.2 * s, 1.7 * s, 1.9 * s, 'stone', tag + '·碑首');
    for (let i = 0; i < 3; i++) {
      mb.boxC(x, z - 0.09 * s, 0.34 * s, 0.03, 0.7 * s + i * 0.28 * s, 0.78 * s + i * 0.28 * s, 'gold', tag + '·字');
    }
  }

  function bellDrum(mb, x, z, s, kind, tag) {
    s = s || 1;
    if (kind === 'bell') {
      // 钟：钟架 + 钟身
      tag = tag || '钟';
      for (const sx of [-1, 1]) mb.boxC(x + sx * 0.7 * s, z, 0.14, 0.14, 0, 2.4 * s, 'zhu', tag + '·架');
      mb.boxC(x, z, 1.6 * s, 0.14, 2.4 * s, 2.55 * s, 'zhu', tag + '·梁');
      mb.lathe(x, z, [[0.1 * s, 0.5 * s], [0.5 * s, 0.6 * s], [0.52 * s, 1.1 * s], [0.36 * s, 1.5 * s], [0.12 * s, 1.65 * s], [0, 1.68 * s]], 10, 'gold', tag + '·钟身');
      mb.boxC(x, z, 0.16, 0.16, 1.68 * s, 2.25 * s, 'wood', tag + '·钟钮');
    } else {
      // 鼓：鼓架 + 鼓身
      tag = tag || '鼓';
      for (const sx of [-1, 1]) mb.boxC(x + sx * 0.6 * s, z, 0.12, 0.12, 0, 1.0 * s, 'zhu', tag + '·架');
      mb.boxC(x, z, 1.1 * s, 0.55 * s, 0.55 * s, 1.15 * s, 'timber', tag + '·鼓身');
      mb.boxC(x, z, 1.14 * s, 0.58 * s, 0.9 * s, 0.96 * s, 'gold', tag + '·鼓箍');
      mb.boxC(x, z, 1.14 * s, 0.58 * s, 0.6 * s, 0.66 * s, 'gold', tag + '·鼓箍');
    }
  }

  function penjing(mb, x, z, s, tag) {
    s = s || 1;
    tag = tag || '盆景';
    mb.boxC(x, z, 0.8 * s, 0.6 * s, 0, 0.4 * s, 'stone', tag + '·盆');
    mb.boxC(x, z, 0.66 * s, 0.46 * s, 0.4 * s, 0.44 * s, 'soil', tag + '·土');
    mb.boxC(x, z, 0.14 * s, 0.14 * s, 0.44 * s, 1.0 * s, 'wood', tag + '·干');
    mb.boxC(x + 0.1 * s, z, 0.5 * s, 0.4 * s, 0.95 * s, 1.15 * s, 'pine', tag + '·松');
    mb.boxC(x - 0.15 * s, z + 0.06 * s, 0.34 * s, 0.3 * s, 0.8 * s, 0.96 * s, 'pine', tag + '·松');
  }

  function quBridge(mb, pts, w, tag, opt) {
    tag = tag || '曲桥';
    opt = opt || {};
    const yD = opt.y == null ? 0.42 : opt.y;   // 桥面标高：接平台时应压低到平台面以下，避免桥面盖住平台
    const half = w / 2;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const len = Math.hypot(dx, dz);
      const nx = -dz / len, nz = dx / len;
      GF.beamBetween(mb, [a[0], yD, a[1]], [b[0], yD, b[1]], w, 0.1, 'stone', tag + '·桥面');
      for (const s2 of [-1, 1]) {
        const off = s2 * half;
        GF.beamBetween(mb,
          [a[0] + nx * off, yD + 0.08, a[1] + nz * off],
          [b[0] + nx * off, yD + 0.08, b[1] + nz * off], 0.1, 0.28, 'marble', tag + '·桥栏');
      }
      // 桥墩
      mb.boxC(a[0], a[1], 0.4, 0.4, 0, yD, 'stoneDark', tag + '·墩');
    }
    const last = pts[pts.length - 1];
    mb.boxC(last[0], last[1], 0.4, 0.4, 0, yD, 'stoneDark', tag + '·墩');
  }

  function tieMaZhuang(mb, x, z, s, tag) {
    s = s || 1;
    tag = tag || '拴马桩';
    mb.boxC(x, z, 0.34 * s, 0.34 * s, 0, 1.6 * s, 'stone', tag);
    mb.boxC(x, z, 0.42 * s, 0.42 * s, 1.6 * s, 1.8 * s, 'stoneDark', tag + '·桩头');
    mb.boxC(x, z, 0.1, 0.12, 1.45 * s, 1.6 * s, 'stoneDark', tag + '·穿孔');
  }

  GF.parts = {
    mapper, localBox, wallWithHoles, windowAt, doorAt, plaque, dougong, lintel,
    queti, platform, railing, horseHeadWall, courtWall, yingbi, lion, censer,
    lantern, banner, tree, rock, pond, furniture, latticeBars, partition,
    couplet, menZan, baogu, ceiling, caisson, stoneLantern, well, stele,
    bellDrum, penjing, quBridge, tieMaZhuang
  };
})(typeof window !== 'undefined' ? window : globalThis);

