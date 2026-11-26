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

  /* --------------------- 深度槽位表（相对墙面，mm，正 = 出皮） --------------------- */
  // 门窗族唯一的“占位法”：每件只许一个槽，槽的前脸（第二个数）两两不相等，
  // 相邻槽的带子必须相交（你咬我 3 mm、我咬你 4 mm），禁止端面齐平。
  // 前脸集合：24 10 -32 -78 -22 -28 -12 -44 -26 -32 -16 14 26 100 130 84 28 40 18 -6
  // 门窗族之外（墙脚石/台基/屋面/栏杆/斗拱/道具）的槽位见 docs/阶段9_部件生成总表.md 第 3 节。
  const SLOT_MM = {
    frame:    [-44,  24],   // 门窗框（含抱框竖框）
    mull:     [-44,  10],   // 抹头（框内的横档）
    leaf:     [-76, -32],   // 门扇 / 隔扇边梃（退进洞口 3.2–7.6 cm）
    glass:    [-108, -78],  // 窗纸 / 纱（洞口最深一档）
    lattice:  [-40, -22],   // 格心棂条
    panel:    [-74, -28],   // 裙板
    panelEdge:[-30, -12],   // 裙板四周仔边
    panelLine:[-16,  -6],   // 裙板金线
    taohuan:  [-60, -44],   // 绦环板
    kazi:     [-44, -26],   // 卡子花
    zibian:   [-42, -32],   // 格心仔边
    nail:     [-34, -16],   // 门钉
    thresh:   [-40,  14],   // 门槛
    zhen:     [-60,  26],   // 门枕石（抱鼓）
    lintel:   [-36,  40],   // 门楣
    bracket:  [-44,  18],   // 抱框
    hood:     [ 26, 100],   // 窗楣（第一级枭混）
    hood2:    [ 96, 130],   // 窗楣线（第二级）
    sill:     [  8,  84],   // 窗台
    boss:     [-34,  -8]    // 铺首（贴门扇前脸，后缘压进门扇 2 mm）
  };
  GF.SLOT_MM = SLOT_MM;
  // 槽位 → 局部深度（F = 墙半厚，墙面在 d = F 处）
  function slotZ(F, k) {
    const s = SLOT_MM[k];
    return [F + s[0] / 1000, F + s[1] / 1000];
  }
  GF.slotZ = slotZ;

  /* ------------------------------ 墙体 ------------------------------ */
  // 带洞口的墙：按洞口边界切栅格，但只生成“壳”——内外两张墙面 + 洞口/墙端/墙顶的
  // 侧壁。原来的做法是每个格子都出一个完整六面盒，格与格之间的切缝上就留下两张
  // 严格共面的面（整栋清式殿 26 m² 以上），转视角时 z-fighting 成条纹，还白烧光栅化。
  function wallWithHoles(mb, o) {
    const mp = mapper(o.dir, o.at);
    const t = (o.thickness || 0.2) / 2;
    const mat = o.mat || 'plaster';
    const tag = o.tag || '墙';
    const holes = o.holes || [];
    const us = [o.u0, o.u1];
    const vs = [o.y0, o.y1];
    holes.forEach((h) => { us.push(h.u0, h.u1); vs.push(h.v0, h.v1); });
    us.sort((a, b) => a - b); vs.sort((a, b) => a - b);
    const inHole = (u, v) => holes.some((h) => u > h.u0 - 1e-6 && u < h.u1 + 1e-6 && v > h.v0 - 1e-6 && v < h.v1 + 1e-6);
    // 这一点上有没有墙（在墙范围内且不在洞口）
    const solid = (u, v) => u > o.u0 - 1e-6 && u < o.u1 + 1e-6 && v > o.y0 - 1e-6 && v < o.y1 + 1e-6 && !inHole(u, v);
    const skin = (u0, u1, v0, v1, d) => {
      mb.quad(mp(u0, v0, d), mp(u1, v0, d), mp(u1, v1, d), mp(u0, v1, d), mat, tag);
    };
    const sideU = (u, v0, v1) => {
      mb.quad(mp(u, v0, -t), mp(u, v1, -t), mp(u, v1, t), mp(u, v0, t), mat, tag);
    };
    const sideV = (u0, u1, v) => {
      mb.quad(mp(u0, v, -t), mp(u1, v, -t), mp(u1, v, t), mp(u0, v, t), mat, tag);
    };
    for (let i = 0; i < us.length - 1; i++) {
      for (let j = 0; j < vs.length - 1; j++) {
        const u0 = us[i], u1 = us[i + 1], v0 = vs[j], v1 = vs[j + 1];
        if (u1 - u0 < 1e-6 || v1 - v0 < 1e-6) continue;
        if (inHole((u0 + u1) / 2, (v0 + v1) / 2)) continue;
        const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
        skin(u0, u1, v0, v1, t);
        skin(u0, u1, v0, v1, -t);
        // 侧壁只在“真边界”上出现：墙端、洞口边、墙顶墙脚。栅格内部的切缝两侧都有墙，不出面。
        if (u0 <= o.u0 + 1e-9 || !solid(u0 - 0.002, cv)) sideU(u0, v0, v1);
        if (u1 >= o.u1 - 1e-9 || !solid(u1 + 0.002, cv)) sideU(u1, v0, v1);
        if (v0 <= o.y0 + 1e-9 || !solid(cu, v0 - 0.002)) sideV(u0, u1, v0);
        if (v1 >= o.y1 - 1e-9 || !solid(cu, v1 + 0.002)) sideV(u0, u1, v1);
      }
    }
  }

  /* ------------------------------ 格心窗 ------------------------------ */
  // 生成格心图案的细木条（局部坐标），返回 [u0,u1,v0,v1]
  function latticeBars(w, h, pattern) {
    const bars = [];
    // 棂条宽度：320 px/m 下 0.07 m 是 22 px，太粗像“窗框格”，精档收到 0.038 m（12 px）
    const fine = GF.detail(3);
    const bu = fine ? 0.038 : 0.07;
    const k = fine ? 1.35 : 1; // 棂条密度倍数
    if (pattern === 'straight') {
      // 直棂窗：竖条
      const n = Math.max(3, Math.round(w / (0.16 / k)));
      for (let i = 1; i < n; i++) {
        const u = -w / 2 + (w * i) / n;
        bars.push([u - bu / 2, u + bu / 2, -h / 2, h / 2]);
      }
    } else if (pattern === 'step' || pattern === 'wanzi') {
      // 步步锦/万字：横竖交错
      const rows = Math.max(2, Math.round(h / (0.22 / k)));
      for (let j = 1; j < rows; j++) {
        const v = -h / 2 + (h * j) / rows;
        bars.push([-w / 2, w / 2, v - bu / 2, v + bu / 2]);
      }
      const cols = Math.max(2, Math.round(w / (0.24 / k)));
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
      const n = fine ? 4 : 3;
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
      const rows = Math.max(2, Math.round(h / (0.3 / k)));
      for (let j = 0; j < rows; j++) {
        const v = -h / 2 + (h * (j + 0.5)) / rows;
        bars.push([-w / 2, w / 2, v - bu / 2, v + bu / 2]);
      }
      const cols = Math.max(2, Math.round(w / (0.3 / k)));
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
    // o: dir, at（墙中轴）, uc, vc, w, h, wt（墙半厚）, pattern；洞口由墙体先行开出
    const mp = mapper(o.dir, o.at);
    const F = o.wt || 0.11;
    const W = (k) => slotZ(F, k);
    const w = o.w, h = o.h, uc = o.uc, vc = o.vc;
    const u0 = uc - w / 2, u1 = uc + w / 2, v0 = vc - h / 2, v1 = vc + h / 2;
    const tag = o.tag || '窗';
    const fw = 0.1;        // 框外面的挑出宽
    const gn = 0.002;      // 框内缘咬进洞边 2 mm（避开“框内立面 == 洞口侧壁”那张同面）
    const FM = o.frameMat || 'wood';
    // ① 窗纸：退到洞口最深一档（glass −108..−78 mm），两侧各咬进洞边 6 mm，
    //    纸的侧立面原来与洞口侧壁严格同面（清式殿 0.17 m²、厅堂 0.20 m² 的同面）
    localBox(mb, mp, u0 - 0.006, u1 + 0.006, v0 + 0.003, v1 - 0.003, ...W('glass'), o.paperMat || 'paper', tag + '·纸');   // 纸上下各缩 3 mm：原来纸顶面正落在洞顶那张墙面上
    // ② 框：四边框，前脸 +24 mm（相对墙面），比纸/格心都靠外
    const fzj = ((Math.abs(Math.round((u0 + u1 + 100) * 7919)) % 3) - 1) * 0.0015;   // 并排窗的框同处一槽，前后脸严格同面：按窗位散列 ±1.5 mm
    const FZ = W('frame').map((v) => v + fzj);
    localBox(mb, mp, u0 - fw, u1 + fw, v0 - fw, v0 + gn, FZ[0], FZ[1], FM, tag + '·框');
    localBox(mb, mp, u0 - fw, u1 + fw, v1 - gn, v1 + fw, FZ[0], FZ[1], FM, tag + '·框');
    localBox(mb, mp, u0 - fw, u0 + gn, v0, v1, FZ[0], FZ[1], FM, tag + '·框');
    localBox(mb, mp, u1 - gn, u1 + fw, v0, v1, FZ[0], FZ[1], FM, tag + '·框');
    if (!o.plain) {
      // ③ 格心（lattice −40..−22）与抹头（mull −44..+10）：抹头把窗分成上樘/中樘/下樘，
      //    320 档才看得出“这是一扇窗，不是一块板”
      const barMat = o.barMat || 'wood';
      const bars = latticeBars(w, h, o.pattern || 'step');
      const LZ = W('lattice');
      for (const b of bars) {
        localBox(mb, mp, uc + b[0], uc + b[1], vc + b[2], vc + b[3], LZ[0], LZ[1], barMat, tag + '·格心');
      }
      if (GF.detail(2) && h > 0.9) {
        const MZ = W('mull');
        for (const [fr, hh] of [[0.34, 0.030], [0.68, 0.024]]) {
          const mv = v0 + h * fr;
          localBox(mb, mp, u0 - gn, u1 + gn, mv - hh, mv + hh, MZ[0], MZ[1], FM, tag + '·抹头');
        }
      }
    }
    // ④ 窗楣两级枭混（hood 26..100 / hood2 96..130）与窗台（sill 8..84）：出皮不再等于墙皮
    if (o.hood !== false && !o.plain) {
      const hm = o.hoodMat || 'stone';
      const HZ = W('hood'), H2 = W('hood2'), SZ = W('sill');
      localBox(mb, mp, u0 - 0.18, u1 + 0.18, v1 + fw - 0.004, v1 + fw + 0.12, HZ[0], HZ[1], hm, tag + '·窗楣');
      localBox(mb, mp, u0 - 0.20, u1 + 0.20, v1 + fw + 0.10, v1 + fw + 0.15, H2[0], H2[1], hm, tag + '·窗楣线');
      localBox(mb, mp, u0 - 0.16, u1 + 0.16, v0 - fw - 0.1, v0 - fw, SZ[0], SZ[1], hm, tag + '·窗台');
    }
  }

  /* ------------------------------ 门 ------------------------------ */
  function doorAt(mb, o) {
    // 隔扇门：四扇，上部格心、下部裙板
    const mp = mapper(o.dir, o.at);
    const F = o.wt || 0.11;
    const W = (k) => slotZ(F, k);
    const uc = o.uc, w = o.w, h = o.h, y0 = o.y0;
    const tag = o.tag || '门';
    const half = w / 2;
    const LA = W('leaf'), TH = W('thresh');
    if (o.plain) {
      // LOD plain：板门两扇平板，省门钉 / 门环细分
      for (const s of [-1, 1]) {
        localBox(mb, mp, uc + s * 0.03, uc + s * (half + 0.004), y0, y0 + h, LA[0], LA[1], 'wood', tag + '·板门');
      }
      localBox(mb, mp, uc - w / 2, uc + w / 2, y0 - 0.12, y0, TH[0], TH[1], 'stone', tag + '·门槛');
      return;
    }
    if (o.style === 'panel') {
      // 板门：两扇实木门 + 门钉 + 铺首衔环 + 抱框 + 门楣 + 门枕石
      const fine = GF.detail(3);
      const rows = fine ? 9 : 4;
      const cols = fine ? 5 : 3;
      const NZ = W('nail'), BZ = W('boss');
      for (const s of [-1, 1]) {
        localBox(mb, mp, uc + s * 0.03, uc + s * (half + 0.004), y0, y0 + h, LA[0], LA[1], 'wood', tag + '·板门');
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const uu = uc + s * (0.16 + c * ((half - 0.26) / Math.max(1, cols - 1) * 0.82));
            const vv = y0 + h * (0.26 + r * (0.48 / Math.max(1, rows - 1)));
            // 门钉：钉帽压在门扇前脸上（nail −34..−16），不再像原来那样整根钉浮在墙皮外 6 cm
            localBox(mb, mp, uu - 0.035, uu + 0.035, vv - 0.035, vv + 0.035, NZ[0], NZ[1], 'gold', tag + '·门钉');
          }
        }
        // 铺首衔环：门平面内的圆盘 + 8 段环。原来用竖轴 lathe，等于把门环做成了立在门口的花瓶
        const pu = uc + s * 0.22, pv = y0 + h * 0.5;
        const disc = (cu, cv, r0, r1, d0, d1, mat, tg) => {
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2, b = ((k + 1) / 8) * Math.PI * 2;
            const pt = (r, ang, dd) => mp(cu + Math.cos(ang) * r, cv + Math.sin(ang) * r, dd);
            mb.quad(pt(r0, a, d1), pt(r0, b, d1), pt(r1, b, d1), pt(r1, a, d1), mat, tg);
            mb.quad(pt(r1, a, d0), pt(r1, b, d0), pt(r1, b, d1), pt(r1, a, d1), mat, tg);
          }
        };
        disc(pu, pv, 0.001, 0.075, BZ[0], BZ[1], 'gold', tag + '·铺首');
        disc(pu, pv, 0.082, 0.115, BZ[0] + 0.006, BZ[1], 'gold', tag + '·铺首');
        if (fine) disc(pu, pv - 0.20, 0.10, 0.135, BZ[0], BZ[1] - 0.01, 'gold', tag + '·门环');
      }
      // 抱框（门洞两侧立柱）、门楣、门槛石、门枕石，各占自己的槽
      const BR = W('bracket'), LI = W('lintel'), ZE = W('zhen');
      localBox(mb, mp, uc - w / 2 - 0.14, uc - w / 2, y0, y0 + h, BR[0], BR[1], 'woodDark', tag + '·抱框');
      localBox(mb, mp, uc + w / 2, uc + w / 2 + 0.14, y0, y0 + h, BR[0], BR[1], 'woodDark', tag + '·抱框');
      // 门楣：只在门顶以上（原来 v 从 y0 一直到 y0+h+0.1，等于在门洞前立了一整块大板）
      localBox(mb, mp, uc - w / 2 - 0.18, uc + w / 2 + 0.18, y0 + h + 0.02, y0 + h + 0.14, LI[0], LI[1], 'woodDark', tag + '·门楣');
      localBox(mb, mp, uc - w / 2, uc + w / 2, y0 - 0.12, y0, TH[0], TH[1], 'stone', tag + '·门槛');
      if (fine) {
        // 门枕石：门槛两端各一块抱鼓石
        for (const s of [-1, 1]) {
          localBox(mb, mp, uc + s * (w / 2 + 0.02), uc + s * (w / 2 + 0.3), y0 - 0.14, y0 + 0.16, ZE[0], ZE[1], 'marble', tag + '·门枕石');
        }
      }
      return;
    }
    // 隔扇（默认）：边梃/抹头 leaf −76..−32、格心 lattice −40..−22、裙板 panel −74..−28、
    // 裙板仔边 panelEdge −30..−12、板心金线 panelLine −16..−6、绦环板 taohuan −60..−44。
    // 相邻门扇的边梃原来是两个盒子面对面，交界处整条立面严格同面（12 处竖线在闪）；
    // 现在每扇左右各外扩 2 mm 互相咬进去，同面消失；门洞两侧顺带咬进墙 2 mm。
    const leaves = o.leaves || 4;
    const lw = w / leaves;
    const gn = 0.002;
    const LA2 = W('leaf'), GL = W('glass'), LZ = W('lattice'), PN = W('panel');
    const PE = W('panelEdge'), PLT = W('panelLine'), TZ = W('taohuan'), KZ = W('kazi'), ZB = W('zibian');
    for (let i = 0; i < leaves; i++) {
      const a = uc - w / 2 + i * lw, b = a + lw;
      const L = a - gn, R = b + gn;
      // 边框
      localBox(mb, mp, L, R, y0, y0 + 0.12, LA2[0], LA2[1], 'wood', tag + '·隔扇');
      localBox(mb, mp, L, R, y0 + h - 0.1, y0 + h, LA2[0], LA2[1], 'wood', tag + '·隔扇');
      localBox(mb, mp, L, a + 0.07, y0, y0 + h, LA2[0], LA2[1], 'wood', tag + '·隔扇');
      localBox(mb, mp, b - 0.07, R, y0, y0 + h, LA2[0], LA2[1], 'wood', tag + '·隔扇');
      // 上部格心：纸退到洞口最深一档
      const gy0 = y0 + h * 0.42, gy1 = y0 + h - 0.12;
      localBox(mb, mp, a + 0.07, b - 0.07, gy0, gy1, GL[0] + 0.004, GL[1] + 0.004, 'paper', tag + '·窗纸');   // 前移 4 mm：原与窗纸同处玻璃槽，两层纸同面
      const cw = (b - a) - 0.14, ch = gy1 - gy0;
      const cu = (a + b) / 2, cv = (gy0 + gy1) / 2;
      for (const bb of latticeBars(cw, ch, o.pattern || 'step')) {
        localBox(mb, mp, cu + bb[0], cu + bb[1], cv + bb[2], cv + bb[3], LZ[0], LZ[1], 'wood', tag + '·格心');
      }
      // 下部裙板
      localBox(mb, mp, a + 0.068, b - 0.068, y0 + 0.12, gy0 - 0.06, PN[0], PN[1], 'wood', tag + '·裙板');
      if (GF.detail(3)) {
        const gx0 = a + 0.07 - 0.002, gx1 = b - 0.07 + 0.002;
        // 绦环板（格心与裙板之间的一道窄板，板上两枚卡子花）
        const ty = gy0 - 0.12;
        localBox(mb, mp, a + 0.07, b - 0.07, ty, gy0 - 0.02, TZ[0], TZ[1], 'woodDark', tag + '·绦环板');
        for (const cu2 of [0.3, 0.7]) {
          const uu = a + 0.07 + (b - a - 0.14) * cu2;
          localBox(mb, mp, uu - 0.05, uu + 0.05, ty + 0.02, gy0 - 0.04, KZ[0], KZ[1], 'gold', tag + '·卡子花');
        }
        // 裙板四周仔边（panelEdge 前脸 −12）与板心金线（panelLine 前脸 −6）：两道线各占一槽
        localBox(mb, mp, gx0, gx1, y0 + 0.12, y0 + 0.16, PE[0], PE[1], 'woodDark', tag + '·裙板边');
        localBox(mb, mp, gx0, gx1, gy0 - 0.1, gy0 - 0.06, PE[0], PE[1], 'woodDark', tag + '·裙板边');
        localBox(mb, mp, gx0, gx0 + 0.05, y0 + 0.16, gy0 - 0.1, PE[0], PE[1], 'woodDark', tag + '·裙板边');
        localBox(mb, mp, gx1 - 0.05, gx1, y0 + 0.16, gy0 - 0.1, PE[0], PE[1], 'woodDark', tag + '·裙板边');
        localBox(mb, mp, a + 0.12, b - 0.12, y0 + 0.3, y0 + h * 0.34, PLT[0], PLT[1], 'gold', tag + '·裙板线');
        // 格心仔边（内框）
        localBox(mb, mp, a + 0.09, b - 0.09, gy0, gy0 + 0.04, ZB[0], ZB[1], 'wood', tag + '·仔边');
        localBox(mb, mp, a + 0.09, b - 0.09, gy1 - 0.04, gy1, ZB[0], ZB[1], 'wood', tag + '·仔边');
      }
    }
    localBox(mb, mp, uc - w / 2, uc + w / 2, y0 - 0.12, y0, TH[0], TH[1], 'stone', tag + '·门槛');
  }

  /* ------------------------------ 匾额 ------------------------------ */
  function plaque(mb, o) {
    const mp = mapper(o.dir, o.at);
    const w = o.w || 1.8, h = o.h || 0.6, vc = o.vc;
    // 底板
    localBox(mb, mp, o.uc - w / 2, o.uc + w / 2, vc - h / 2, vc + h / 2, -0.02, 0.055, 'dark', '匾额');
    // 金框：每条边都咬进底板 4 mm，避开“框内边 == 板边”的整条同面
    localBox(mb, mp, o.uc - w / 2 - 0.06, o.uc + w / 2 + 0.06, vc + h / 2 - 0.004, vc + h / 2 + 0.06, -0.02, 0.065, 'gold', '匾额·框');
    localBox(mb, mp, o.uc - w / 2 - 0.06, o.uc + w / 2 + 0.06, vc - h / 2 - 0.06, vc - h / 2 + 0.004, -0.02, 0.065, 'gold', '匾额·框');
    localBox(mb, mp, o.uc - w / 2 - 0.06, o.uc - w / 2 + 0.004, vc - h / 2, vc + h / 2, -0.02, 0.065, 'gold', '匾额·框');
    localBox(mb, mp, o.uc + w / 2 - 0.004, o.uc + w / 2 + 0.06, vc - h / 2, vc + h / 2, -0.02, 0.065, 'gold', '匾额·框');
    // 字（以金色方块示意，1~4 个字）
    const n = o.chars || 3;
    for (let i = 0; i < n; i++) {
      const u = o.uc + (i - (n - 1) / 2) * (w / (n + 0.6));
      localBox(mb, mp, u - 0.1, u + 0.1, vc - h * 0.26, vc + h * 0.26, 0.065, 0.105, 'gold', '匾额·字');
    }
  }

  /* ------------------------------ 斗拱 ------------------------------ */
  // style: simple(一斗三升) / mid(五踩) / full(七踩) / none
  function dougong(mb, x, y, z, s, tag, style, o) {
    s = s || 1;
    o = o || {};
    // 斗：丹粉刷饰时斗面刷白，与朱红栱身分开；青绿彩画保持木色
    const dm = (o.tone === 'dan') ? 'plaster' : 'wood';
    // 材色：唐宋辽金丹粉刷饰（朱红栱），明清青绿彩画
    const mc = (o.tone === 'dan') ? 'timber' : 'paintGreen';
    // 铺作间距：柱头枋、拱眼壁必须连成一整条，不能每朵各画一块（唐宋补间稀疏时会露出大缝）
    const gapW = o.gap || 0;
    const st = style || 'mid';
    // 栌斗：斗欹（下收）+ 斗平（外张），两个棱台叠起来才有“斗”的轮廓
    mb.taper(x, z, 0.26 * s, 0.26 * s, 0.34 * s, 0.34 * s, y, y + 0.09 * s, dm, tag + '·斗欹');
    mb.taper(x, z, 0.32 * s, 0.32 * s, 0.40 * s, 0.40 * s, y + 0.088 * s, y + 0.17 * s, dm, tag + '·斗平');   // 斗平底 0.34→0.32：原来斗欹顶环与斗平底环同尺寸同高，每个斗都有一整圈方环同面（240 对）
    const yb = y + 0.17 * s;
    if (st === 'simple') {
      // 一斗三升：泥道拱（两端卷杀）+ 三个散斗（上大下小）
      mb.boxC(x, z, 0.80 * s, 0.22 * s, yb, yb + 0.13 * s, mc, tag + '·泥道拱');
      for (const sx of [-1, 1]) {
        mb.taper(x + sx * 0.40 * s, z, 0.16 * s, 0.22 * s, 0.06 * s, 0.16 * s, yb, yb + 0.125 * s, mc, tag + '·拱头');
      }
      for (const dx of [-0.42, 0, 0.42]) {
        mb.taper(x + dx * s, z, 0.15 * s, 0.15 * s, 0.19 * s, 0.19 * s, yb + 0.126 * s, yb + 0.25 * s, dm, tag + '·散斗');
      }
      return;
    }
    // 多踩：真正的“层层出跳”——每一跳都是一根朝外伸出的华栱，端头压散斗，
    // 上一跳再往外、往上叠一层；最外一跳上加令栱、耍头，形成斗栱—撩檐枋的层次。
    // （原来的华栱只在原地叠方块，出跳全靠一根昂，320 档看过去还是一串小方块。）
    const steps = st === 'full' ? 3 : 2;
    for (let k = 0; k < steps; k++) {
      const yy = yb + k * 0.19 * s;
      const reach = (0.5 + k * 0.3) * s;          // 本跳出跳长度（含半在柱内的部分）
      const armD = 0.19 * s;
      // 华栱：沿出跳方向（+z）的臂，向外出挑
      mb.boxC(x, z + reach / 2 - 0.08 * s, 0.2 * s, reach, yy - 0.004 * s, yy + 0.13 * s, mc, tag + '·华栱');   // 底面压进斗平顶 4 mm
      // 栱头卷杀：臂端收成小斜面
      mb.taper(x, z + reach - 0.08 * s, 0.2 * s, 0.1 * s, 0.16 * s, 0.06 * s, yy, yy + 0.13 * s, mc, tag + '·栱头');
      // 臂端散斗
      mb.taper(x, z + reach - 0.14 * s, 0.15 * s, 0.15 * s, 0.19 * s, 0.19 * s, yy + 0.126 * s, yy + 0.25 * s, dm, tag + '·散斗');
      // 沿墙向的横栱（泥道栱／瓜子栱）：宽度随跳递增
      mb.boxC(x, z + armD / 2, (0.72 + k * 0.22) * s, armD + 0.008 * s, yy + 0.02 * s, yy + 0.14 * s, mc, tag + '·横栱');
      for (const sx of [-1, 1]) {
        mb.taper(x + sx * (0.36 + k * 0.11) * s, z + armD / 2, 0.15 * s, 0.15 * s, 0.06 * s, 0.12 * s, yy + 0.026 * s, yy + 0.146 * s, mc, tag + '·栱头');   // 上下各错 6 mm，不再与横栱同一对水平面
      }
      // 昂：斜置长木，前端压在檐下，是唐辽斗栱最显眼的一道斜线
      // 昂：斜置长木，前端压在檐下，是唐辽斗栱最显眼的一道斜线。
      // 断面比华栱窄 5 mm、底部略抬 4 mm：原来两者侧立面完全同面（240 对共面），转视角时一道竖线在闪。
      mb.taper(x, z + (0.16 + k * 0.24) * s, 0.19 * s, (0.42 + k * 0.3) * s, 0.13 * s, (0.3 + k * 0.26) * s, yy + 0.004 * s, yy + 0.12 * s, 'wood', tag + '·昂');
    }
    // 令栱（最外一跳上的长横栱）+ 耍头
    const yTop0 = yb + steps * 0.19 * s;
    // 相邻朵叠压错位：令栱/拱眼壁/柱头枋都是一整条连过去的 box，相邻两朵在 x 上
    // 叠 0.4~0.5 m，上下面本来就同平面；按朵序给 0/1.5/3 mm 阶梯，接缝就有了错台，
    // 不再整条同面（连条视觉仍连续，320 档看不到 1.5 mm 的台阶）。
    const seq = ((Math.round(x * 100000) % 7919) * 7 % 3 + 3) % 3;   // 素数散列，避开等间距朵距的整数共振
    const sy = seq * 0.0015;
    mb.boxC(x, z + 0.42 * s, (1.1 + (steps - 2) * 0.2) * s, 0.206 * s, yTop0 + sy, yTop0 + 0.13 * s + sy, mc, tag + '·令栱');
    mb.taper(x, z + 0.5 * s, 0.38 * s, 0.24 * s, 0.26 * s, 0.14 * s, yTop0 + 0.128 * s + sy, yTop0 + 0.25 * s + sy, mc, tag + '·耍头');
    if (GF.detail(2) && !o.gap) {
      // 拱眼壁 + 柱头枋：把铺作与檐口之间的空隙填实，檐下才有“层层叠出去”的深度，
      // 不然一排在像素上就是几个悬空的小柱子。
      const yTop = yTop0 + 0.25 * s;
      const gw = gapW > 0 ? Math.max(1.15 * s, gapW * 0.98) : 1.15 * s;
      const gd = gapW > 0 ? Math.max(1.45 * s, gapW * 0.98) : 1.45 * s;
      mb.boxC(x, z + 0.06 * s, gw, 0.506 * s, yTop + 0.02 + sy, yTop + 0.26 * s + sy, 'paintBlue', tag + '·拱眼壁');
      mb.boxC(x, z + 0.1 * s, gd, 0.606 * s, yTop + 0.256 * s + sy, yTop + 0.38 * s + sy, mc, tag + '·柱头枋');
      if (GF.detail(3)) {
        // 枋上金线：细到 0.02 m，320 档才看得见
        mb.boxC(x, z + 0.1 * s, gd, 0.626 * s, yTop + 0.32 * s + sy, yTop + 0.335 * s + sy, 'gold', tag + '·枋金线');
        // 慢拱（第二道横拱，比华拱长一截）
        mb.boxC(x, z + 0.19 * s, (1.0 + (steps - 2) * 0.16) * s, 0.196 * s, yb + 0.06 * s + sy, yb + 0.18 * s + sy, mc, tag + '·慢拱');
      }
    }
  }

  // 斗栱自栌斗底算起的总高（与 dougong() 的分层一一对应）：
  // 檐口标高 = 斗栱底 + 本高 + 檐檩（0.22）+ 檐椽（0.12）+ 瓦口（0.06）。
  // 以前屋面直接坐在柱头上，斗栱一整个被埋进檐口里，檐下就没有放椽子的净空。
  function dougongHeight(style, s) {
    s = s || 1;
    const st = style || 'mid';
    if (st === 'simple') return 0.42 * s;
    const steps = st === 'full' ? 3 : 2;
    let h = (0.17 + steps * 0.19 + 0.25) * s;   // 栌斗 + 逐跳华栱 + 令栱 + 耍头
    if (GF.detail(2)) h += (0.26 + 0.38) * s;    // 拱眼壁 + 柱头枋（2 档以上才有）
    return h;
  }
  GF.dougongHeight = dougongHeight;

  /* ------------------------------ 朝代做法 ------------------------------ */
  // 依梁思成《中国建筑史》第六章（宋辽金实物）与《图像中国建筑史》阑额普拍枋演变图：
  //   唐辽：多无普拍枋，斗栱直接坐在阑额／柱头上（佛光寺大殿即此式）；
  //   宋辽：普拍枋扁而宽，与阑额在断面上成 T 字形（薄伽教藏）；
  //   金元：普拍枋渐加厚，与阑额所出无几（善化寺三圣殿、山门）；
  //   明清：普拍枋反而狭于阑额（清式平板枋宽三斗口、额枋宽四斗口）。
  // 断面一律按阑额厚度 lanT 取倍数，斗栱另给缩放 dgK（唐宋铺作大、明清铺作小）。
  const ERA = {
    han:  { pb: null,              lanH: 0.30, lanT: 0.13, dg: 'col',   dgK: 0.90 },
    tang: { pb: null,              lanH: 0.36, lanT: 0.14, dg: 'two',   dgK: 1.10 },
    song: { pb: { w: 1.60, h: 0.45 }, lanH: 0.34, lanT: 0.13, dg: 'two',   dgK: 0.92 },
    jin:  { pb: { w: 1.10, h: 0.62 }, lanH: 0.32, lanT: 0.13, dg: 'two',   dgK: 0.85 },
    yuan: { pb: { w: 0.95, h: 0.62 }, lanH: 0.30, lanT: 0.14, dg: 'two',   dgK: 0.80 },
    ming: { pb: { w: 0.80, h: 0.60 }, lanH: 0.30, lanT: 0.15, dg: 'dense', dgK: 0.72 },
    qing: { pb: { w: 0.75, h: 0.58 }, lanH: 0.28, lanT: 0.16, dg: 'dense', dgK: 0.68 }
  };
  GF.ERA = ERA;
  GF.era = function (v) { return ERA[v] || ERA.qing; };

  // 普拍枋：阑额与斗栱之间的横向垫枋，绕殿身一周（前后檐 + 两山）
  function pingban(mb, o) {
    const w = o.w, y0 = o.y0, y1 = o.y1;
    const x0 = o.x0, x1 = o.x1, z0 = o.z0, z1 = o.z1;
    const mat = o.mat || 'wood';
    const b = y0 - 0.005;   // 底面压进额枋 5 mm：原来普拍枋底 == 额枋顶，整圈同一张面在闪
    mb.box(x0 - 0.03, x1 + 0.03, b, y1, z1 + 0.022 - w, z1 + 0.022, mat, o.tag + '·前');
    mb.box(x0 - 0.03, x1 + 0.03, b, y1, z0 - 0.022, z0 - 0.022 + w, mat, o.tag + '·后');
    mb.box(x1 + 0.022 - w, x1 + 0.022, b - 0.002, y1 - 0.002, z0 - 0.03, z1 + 0.03, mat, o.tag + '·右');
    mb.box(x0 - 0.022, x0 - 0.022 + w, b - 0.002, y1 - 0.002, z0 - 0.03, z1 + 0.03, mat, o.tag + '·左');   // 左右两条顶面低 2 mm：转角处与前后条顶面不再齐平
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
    localBox(mb, mp, u, u + w, y, y + 0.14, -0.020, 0.030, 'wood', tag);
    localBox(mb, mp, u + 0.06, u + w * 0.8, y - 0.14, y, -0.016, 0.020, 'wood', tag);
    localBox(mb, mp, u + 0.12, u + w * 0.62, y - 0.26, y - 0.14, -0.012, 0.010, 'wood', tag);   // 三级各占一槽：原来三级后脸同在 0.02 一张平面
  }

  /* ------------------------------ 台基 ------------------------------ */
  // style: xumizuo(须弥座) / plain(直台基) / stone(毛石台)
  //
  // 面数修复（本轮）：
  // 台基原来是几十个 box / taper 叠出来的，两个毛病：
  //   ① 每个 taper 自带上下盖面 → 段与段之间必然出现两张同高、同尺寸的盖面，
  //      纯属白占面数，还会在 z-buffer 里逐像素抢深度（转视角时那一圈横纹在闪）；
  //   ② 侧面石 / 缝底 / 铺地 / 玛瑙柱这些 3~16 mm 的薄板，在常规密度下只有零点几个
  //      像素；js/gf-render.js 的交互轻量帧会把亚像素小面整片跳过（|area| < 0.55），
  //      于是转动视角时整排细纹忽隐忽现 —— 这才是肉眼看到的“条纹闪烁”。
  // 现在两条硬规矩：
  //   ① 台身按断面环 loft：相邻两环之间只铺 4 条侧板，内部一张盖面都不封；
  //   ② 小于 4 cm 的装饰不落几何，交给材质的砌缝肌理（逐像素算，不会闪）。
  // 实测（qing 预置，ppm=320 档）：整块台基 3696 → 580 面，其中空台基（无踏跺）130 面；
  // 台基内部的共面重叠面对 578 → 0。

  // 断面方环：以中心定位的 4 个角点（俯视逆时针）
  function rectRing(cx, cz, w, d, y) {
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
    return [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]];
  }

  // 断面环 loft：rings 自下而上，相邻两环之间只出 4 条侧板，上下盖面一刀不封。
  // 两环同高、只收进尺寸时，这 4 条侧板就是一道水平压边，断面不会断开。
  function loftRect(mb, cx, cz, rings, tag) {
    for (let i = 1; i < rings.length; i++) {
      const a = rings[i - 1], b = rings[i];
      if (a.y === b.y && a.w === b.w && a.d === b.d) continue;
      const s = rectRing(cx, cz, a.w, a.d, a.y);
      const t = rectRing(cx, cz, b.w, b.d, b.y);
      const mat = b.m || a.m || 'stone';
      for (let k = 0; k < 4; k++) {
        const j = (k + 1) % 4;
        mb.quad(s[k], s[j], t[j], t[k], mat, tag);
      }
    }
  }

  // 顶面一张板：2 个三角面，不用 box 的 6 个面
  function capRect(mb, cx, cz, w, d, y, mat, tag) {
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
    mb.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], mat, tag);
  }

  function platform(mb, o) {
    const h = o.h, tag = '台基';
    const style = o.style || 'xumizuo';
    const det = GF.detailLevel();
    // 三档形制统一按「中心 + 平面尺寸」定位，全部走同一套断面环 loft
    const cx = (o.x0 + o.x1) / 2, cz = (o.z0 + o.z1) / 2;
    const W = o.x1 - o.x0, D = o.z1 - o.z0;

    if (style === 'plain') {
      // 直台基：陡板（暗）+ 阶条石外挑压面 + 台面。
      // 原来是三块盒子叠起来：陡板顶面 / 阶条石底面、阶条石顶面 / 台面底面都同高，
      // 现在并成一圈断面，这些内部盖面一张都不生成。
      const rim = Math.max(0.05, h - 0.1), out = 0.05;
      loftRect(mb, cx, cz, [
        { y: 0, w: W, d: D },                                        // 陡板底（落地不封底）
        { y: rim, w: W, d: D, m: 'stoneDark' },                       // 陡板立面
        { y: rim, w: W + out * 2, d: D + out * 2, m: 'stoneDark' },   // 阶条石外挑
        { y: h, w: W + out * 2, d: D + out * 2, m: 'slab' },          // 阶条石立面
        { y: h, w: W - 0.04, d: D - 0.04, m: 'slab' }                 // 阶条石压面
      ], tag);
      // 台面：铺装砌缝交给 slabTop 材质（逐像素画，低档也不会退化成一条条细线）
      capRect(mb, cx, cz, W - 0.04, D - 0.04, h, 'slabTop', tag + '·台面');
    } else if (style === 'stone') {
      // 毛石台：一整圈台芯立面 + 台面。
      // 乱石的块感交给材质砌缝（stoneDark / stone 的 mason 肌理），
      // 精档才补真石块，而且只补正面一张四边形（2 面），不再一块一个盒子（12 面）。
      loftRect(mb, cx, cz, [
        { y: 0, w: W, d: D },
        { y: h, w: W, d: D, m: 'stoneDark' },                // 台芯立面
        { y: h, w: W - 0.04, d: D - 0.04, m: 'stoneDark' }   // 台面压边
      ], tag);
      capRect(mb, cx, cz, W - 0.04, D - 0.04, h, 'stoneBTop', tag + '·台面');
      if (det >= 3) {
        // 320 档才补真石块：块宽 0.66 m、缝 0.04 m（12.8 px），不会变成亚像素条纹
        const rows = Math.max(1, Math.round(h / 0.28));
        const off = 0.005;
        for (let r = 0; r < rows; r++) {
          const y0 = (h * r) / rows + 0.02, y1 = (h * (r + 1)) / rows - 0.02;
          const mat = r % 2 ? 'stone' : 'stoneB';
          for (let x = o.x0; x < o.x1 - 0.1; x += 0.7) {
            const a = x + 0.02, b = Math.min(x + 0.66, o.x1);
            if (b <= a) continue;
            mb.quad([a, y0, o.z1 + off], [b, y0, o.z1 + off], [b, y1, o.z1 + off], [a, y1, o.z1 + off], mat, tag + '·毛石');
            mb.quad([b, y0, o.z0 - off], [a, y0, o.z0 - off], [a, y1, o.z0 - off], [b, y1, o.z0 - off], mat, tag + '·毛石');
          }
          for (let z = o.z0; z < o.z1 - 0.1; z += 0.7) {
            const a = z + 0.02, b = Math.min(z + 0.66, o.z1);
            if (b <= a) continue;
            mb.quad([o.x1 + off, y0, a], [o.x1 + off, y0, b], [o.x1 + off, y1, b], [o.x1 + off, y1, a], mat, tag + '·毛石');
            mb.quad([o.x0 - off, y0, b], [o.x0 - off, y0, a], [o.x0 - off, y1, a], [o.x0 - off, y1, b], mat, tag + '·毛石');
          }
        }
      }
    } else {
      // 须弥座：六段线脚（圭脚—下枋—下枭—束腰—上枭—上枋）用一圈断面环 loft 连起来。
      // 320 px/m 时 0.1 m 的线脚收分就是 32 px，盒子叠不出这层转折，但棱台叠棱台
      // 会在每道接缝处多一对同高盖面 —— 那就是原来条纹闪烁的来源，现在整条断面
      // 一气贯通，接缝处一张盖面也没有。
      // 剖面线脚按 0.6 m 基准高设计（圭脚 0.12 / 下枋 0.26 / 下枭 0.33 / 莲花带 0.40 / 束腰 / 上枭 / 上枋）。
      // 台基高被改到 0.6 m 以下时，原固定数值会把上枭/上枋顶出台面之上（台基“看起来更高”），
      // 这正是“台基矮了露台反而高”的由来：统一按 h/0.6 比例压缩剖面，越低越矮，
      // h ≥ 0.6 m 时 s=1，所有线脚与旧版完全一致，不影响任何既有形制。
      const s = Math.min(1, h / 0.6), yb = s === 1 ? Math.max(0.5, h - 0.32) : 0.5 * s;
      const rings = [
        { y: 0, w: W, d: D },                                   // 圭脚底（落地不封底）
        { y: 0.12 * s, w: W, d: D, m: 'stoneDark' },             // 圭脚
        { y: 0.12 * s, w: W - 0.02, d: D - 0.02, m: 'stoneDark' },// 圭脚压边
        { y: 0.26 * s, w: W - 0.10, d: D - 0.10, m: 'stone' },    // 下枋
        { y: 0.33 * s, w: W - 0.20, d: D - 0.20, m: 'stone' },    // 下枭
        // 下枭收这一段：低档兼作莲瓣带（原来是一排 26 cm 宽、2 cm 深的浅浮雕小盒，
        // 40 档只有 0.8 px，纯属亚像素噪点），改成一圈浅色线脚，读起来是同一层意思。
        { y: 0.40 * s, w: W - 0.34, d: D - 0.34, m: (o.lotus && det < 2) ? 'marble' : 'stoneDark' },
        { y: yb, w: W - 0.34, d: D - 0.34, m: 'stoneDark' },      // 束腰（退进去的暗带）
        { y: yb + 0.1 * s, w: W - 0.16, d: D - 0.16, m: 'stone' },// 上枭
        { y: h, w: W - 0.06, d: D - 0.06, m: 'marble' }           // 上枋
      ];
      loftRect(mb, cx, cz, rings, tag);
      // 台面：上枋顶面一张板，铺装砌缝交给 slabTop 材质（逐像素算，任何密度下都稳定：
      // 原来 320 档要铺 0.28 m 的石条、一块一个盒子，一块台基就上千面，且 8 mm 的缝
      // 只有 2.6 px 宽，转视角时整片石缝在闪）。
      const topW = W - 0.06, topD = D - 0.06;
      capRect(mb, cx, cz, topW, topD, h, 'slabTop', tag + '·台面');
      if (det >= 2) {
        // 束腰玛瑙柱：每 1.6 m 一道竖线。原来凸出 1.5 cm（12 面/根，常规密度 0.6 px），
        // 改成贴面一张竖板（2 面），靠颜色读，不靠那点凹凸。
        const xw = W / 2 - 0.34, zw = D / 2 - 0.34, off = 0.004, hw = 0.05;
        const ya2 = 0.44 * s, yb2 = yb - 0.04 * s;
        for (let x = o.x0 + 0.6; x <= o.x1 - 0.6; x += 1.6) {
          mb.quad([x - hw, ya2, cz + zw + off], [x + hw, ya2, cz + zw + off],
                  [x + hw, yb2, cz + zw + off], [x - hw, yb2, cz + zw + off], 'stone', tag + '·玛瑙柱');
          mb.quad([x + hw, ya2, cz - zw - off], [x - hw, ya2, cz - zw - off],
                  [x - hw, yb2, cz - zw - off], [x + hw, yb2, cz - zw - off], 'stone', tag + '·玛瑙柱');
        }
        for (let z = o.z0 + 0.6; z <= o.z1 - 0.6; z += 1.6) {
          mb.quad([cx + xw + off, ya2, z - hw], [cx + xw + off, ya2, z + hw],
                  [cx + xw + off, yb2, z + hw], [cx + xw + off, yb2, z - hw], 'stone', tag + '·玛瑙柱');
          mb.quad([cx - xw - off, ya2, z + hw], [cx - xw - off, ya2, z - hw],
                  [cx - xw - off, yb2, z - hw], [cx - xw - off, yb2, z + hw], 'stone', tag + '·玛瑙柱');
        }
        // 四角角柱：转角一根石柱。原来是 8 cm 见方的盒子（只凸出 1 cm，还是亚像素），
        // 现在每个转角两个贴面（各 2 面），示意柱身即可，总共 16 个三角面。
        const pw = 0.09, cOff = 0.004;
        for (const sx of [-1, 1]) {
          for (const sz of [-1, 1]) {
            const px = cx + sx * xw, pz = cz + sz * zw;
            const u0 = px - sx * pw;
            mb.quad([u0, 0.40 * s, pz + sz * cOff], [px, 0.40 * s, pz + sz * cOff],
                    [px, yb + 0.02 * s, pz + sz * cOff], [u0, yb + 0.02 * s, pz + sz * cOff], 'marble', tag + '·角柱');
            const v0 = pz - sz * pw;
            mb.quad([px + sx * cOff, 0.40 * s, v0], [px + sx * cOff, 0.40 * s, pz],
                    [px + sx * cOff, yb + 0.02 * s, pz], [px + sx * cOff, yb + 0.02 * s, v0], 'marble', tag + '·角柱');
          }
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
        // 与台明立面留 2 cm、级与级之间也留 2 cm：这点缝在像素画里正好是一条踏步暗线，
        // 反而比把台阶埋进台明更好读；埋进去会让两级、垂带、御路石的底面大量重合。
        const za = zEdge + sgn * (i * 0.3 + 0.02);
        const zb = zEdge + sgn * ((i + 1) * 0.3);
        const zz0 = Math.min(za, zb), zz1 = Math.max(za, zb);
        // 每向下一级外放 1.5 cm：原来所有踏步同宽，侧面全在 x=±sw/2 这一张平面上互相重叠，
        // 踏步侧面就是一片同高面（虽然多被垂带挡住，仍是白送的共面）。
        const swI = sw / 2 + i * 0.015;
        // 最下面一级 h-d 恰好为 0：原来照样吐出一个零高度的盒子（12 个退化三角面，
        // 顶面与底面精确重合、彼此共面，等于白送 12 面 + 一堆共面重叠）。画面上它本来就不占像素。
        if (h - d > 0.002) mb.box(-swI, swI, -0.03, h - d, zz0, zz1, 'stone', tag + '·踏跺');   // 底沉到地平以下 3 cm：每级踏跺的底面原来与院墙/台基的底面同在 y=0 这张大平面上（0.89 m²）
        if (det >= 3) {
          // 踏跺也不能是一块整石：踏面按 0.4 m 分条石，立面每 0.4 m 一道暗缝。
          // 但都不做成盒子了 —— 原来 12 mm 厚的踏面石盒、8 mm 宽的缝盒各 12 面，
          // 一层台基光台阶就多出 500+ 面，而且盒底与踏面同高（共面）。现在只贴面：
          // 踏面石是一张 2 面的板（抬 8 mm），缝是一张 2 面的竖板（4 mm 外贴）。
          const topY = h - d;
          let sx = -sw / 2;
          let bi = 0;
          while (sx < sw / 2 - 0.02) {
            const ex = Math.min(sx + 0.4, sw / 2);
            const a = sx, b = ex - 0.008;
            if (b > a) {
              mb.quad([a, topY + 0.008, zz1], [b, topY + 0.008, zz1],
                      [b, topY + 0.008, zz0], [a, topY + 0.008, zz0], bi % 2 ? 'stone' : 'stoneB', tag + '·踏面石');
            }
            sx = ex; bi++;
          }
          const zFace = dirFront ? zz1 : zz0;
          const zOut = zFace + sgn * 0.004;
          for (let x = -sw / 2 + 0.4; x < sw / 2 - 0.02; x += 0.4) {
            mb.quad([x - 0.004, 0.02, zOut], [x + 0.004, 0.02, zOut],
                    [x + 0.004, Math.max(0.03, topY - 0.01), zOut], [x - 0.004, Math.max(0.03, topY - 0.01), zOut], 'stoneDark', tag + '·踏跺缝');
          }
        }
        // 垂带：往台阶里多压 2 cm、两端各外放 1.2 cm。
        // 原来垂带内侧与台阶侧面、前后与台阶立面完全共面，两张面就在这几条边上抢深度。
        // 顶段抬高 0.16 本是让它压在踏面上；台基低时这会把垂带顶出台面之上（baseH=0.35 时
        // 顶段 peaking 到 0.393，比台面还高）——上缘一律按不超过台面收口。
        for (const s of [-1, 1]) {
          mb.box(s * (swI - 0.02), s * (swI + 0.26), 0, Math.min(h - d + 0.16, h - 0.02), zz0 - sgn * 0.012, zz1 + sgn * 0.012, 'slab', tag + '·垂带');
        }
        // 御路石：三级以上踏跺居中铺一条通长的斜板。
        // 原来只在最上一级放一块 marble，结果台面上凭空多出一个白色矩形；
        // 现在每一级都铺，连成一条从台明直落到底的白色石带，最低一级加云纹。
        // 石带四周各外放 1.2 cm：原来它与台阶的立/背立面同高同宽，两张面完全共面，
        // 台阶正中那条白带会跟着视角闪 —— 现在它是一块压在台阶上的凸板。
        if (st >= 3) {
          const pw = Math.min(1.1, sw * 0.42);
          mb.box(-pw / 2, pw / 2, 0.02, h - d + 0.035, zz0 - 0.012, zz1 + 0.012, 'marble', tag + '·御路石');
          if (i === st - 1) {
            for (let k = 0; k < 3; k++) {
              const qa = Math.min(zz0 + 0.04 + k * 0.09, zz0 + 0.08 + k * 0.09);
              mb.box(-pw / 2 + 0.06, pw / 2 - 0.06, h - d + 0.045, h - d + 0.061, qa, qa + 0.04, 'marbleB', tag + '·御路云纹');
            }
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

    const det = GF.detailLevel();
    const rr = 0.155 - ((Math.round((a[0] + a[1] + b[0] * 1.3 + b[1] * 1.7) * 997) % 3 + 3) % 3) * 0.002;   // 转角双柱去重：不同 run 的柱径差 0–4 mm
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = V.lerp(a[0], b[0], t), z = V.lerp(a[1], b[1], t);
      if (det >= 2) {
        // 望柱：柱身略收分，柱头做宝珠/莲瓣（lathe 一圈），不再是平顶方帽
        // 底径 0.155（原 0.17）：柱距正好 0.34 时，原尺寸两根柱的侧立面严格贴着
        // （栏杆·望柱×望柱 0.72 m² / 16 对），整排柱子中间那两条竖缝一直在闪
        mb.taper(x, z, rr, rr, 0.149, 0.149, y, y + 0.56, 'marble', tag + '·望柱');
        mb.lathe(x, z, [[0.001, 0], [0.09, 0.005], [0.125, 0.05], [0.115, 0.1], [0.07, 0.15], [0.02, 0.18], [0.001, 0.2]], 8, 'marble', tag + '·柱头');
      } else {
        mb.boxC(x, z, 0.16, 0.16, y, y + 0.62, 'marble', tag + '·望柱');
        mb.boxC(x, z, 0.2, 0.2, y + 0.62, y + 0.68, 'marble', tag + '·柱头');
      }
      if (i < n) {
        const t2 = (i + 0.5) / n;
        const x2 = V.lerp(a[0], b[0], t2), z2 = V.lerp(a[1], b[1], t2);
        const half = len / n / 2 - 0.1;
        // 地栿：石栏也得有底，不然整排栏杆悬空看着“镂空”
        GF.beamBetween(mb,
          [x2 - dx * half, y + 0.01, z2 - dz * half],
          [x2 + dx * half, y + 0.01, z2 + dz * half],
          0.1, 0.16, 'marble', tag + '·地栿');
        if (det >= 2) {
          // 华板（薄板）+ 宝瓶（斗子蜀柱）+ 寻杖（圆木/石杖）
          GF.beamBetween(mb,
            [x2 - dx * half, y + 0.18, z2 - dz * half],
            [x2 + dx * half, y + 0.18, z2 + dz * half],
            0.045, 0.3, 'marble', tag + '·华板');
          mb.lathe(x2, z2, [[0.001, 0], [0.07, 0.01], [0.085, 0.06], [0.05, 0.12], [0.07, 0.18], [0.001, 0.2]], 8, 'marble', tag + '·宝瓶');
          GF.beamRound(mb, [x2 - dx * half, y + 0.52, z2 - dz * half], [x2 + dx * half, y + 0.52, z2 + dz * half], 0.045, 5, 'marble', tag + '·寻杖');
        } else {
          for (const [dy0, dy1] of [[0.14, 0.46], [0.5, 0.58]]) {
            GF.beamBetween(mb,
              [x2 - dx * half, y + dy0, z2 - dz * half],
              [x2 + dx * half, y + dy1, z2 + dz * half],
              0.06, 0.14, 'marble', tag + '·栏板');
          }
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

      // body:false —— 只出压顶与脊（墙身由调用方自己砌，避免整圈墙被建两遍同面叠着闪）
      if (o.body !== false) {
        wallWithHoles(mb, { dir: s.dir, at: s.at, u0: s.u0, u1: s.u1, y0: 0, y1: y, holes: hole, thickness: d, mat: 'plaster', tag: tag });
      }
      // 瓦顶小脊
      const ax = s.a[0], az = s.a[1], bx = s.b[0], bz = s.b[1];
      const isX = Math.abs(bx - ax) > Math.abs(bz - az);
      const rh = 0.26;
      // 压顶压进墙顶 8 mm、脊再压进压顶 8 mm：这两处原来上下两层严格同面，
      // 整圈院墙 20 m² + 11 m² 站在墙顶同一条面上，斜视一转就闪花边。
      const lp = 0.008;
      // 前后两条（isX）与左右两条在四个转角互相压着，两条压顶原来底/顶面完全同平面。
      // 左右两条上下各收 1.2 mm，转角处不再共面（1.0 m² / 4 对）。
      const jz = isX ? 0.0104 : 0.0092;   // 左右条底面上抬 1.2 mm
      const hsh = ((Math.round((Math.min(ax, bx) * 1.3 + Math.min(az, bz) * 1.7) * 997) % 4 + 4) % 4);
      const jt = (isX ? 0 : 0.0012) + hsh * 0.0006;        // 顶面下压 1.2 mm
      if (isX) {
        mb.box(Math.min(ax, bx) - 0.06, Math.max(ax, bx) + 0.06, y - lp - hsh * 0.0008, y + 0.16 - jt, az - d / 2 - hsh * 0.0008, az + d / 2 + hsh * 0.0008, 'tile', tag + '·压顶');
        mb.box(Math.min(ax, bx) - 0.06, Math.max(ax, bx) + 0.06, y + 0.16 - lp, y + rh - jt, az - 0.08, az + 0.08, 'tileEnd', tag + '·脊');
      } else {
        mb.box(ax - d / 2 - 0.08, ax + d / 2 + 0.08, y - jz + 0.0012, y + 0.16 - jt, Math.min(az, bz) - 0.06, Math.max(az, bz) + 0.06, 'tile', tag + '·压顶');
        mb.box(ax - 0.08, ax + 0.08, y + 0.16 - lp, y + rh - jt, Math.min(az, bz) - 0.06, Math.max(az, bz) + 0.06, 'tileEnd', tag + '·脊');
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
    // 座 / 身 / 头 三件逐级压进去 2 cm：原来 身底=座顶、头底=身顶 严格齐平（0.96 + 0.49 m²）
    mb.boxC(x, z, 0.5 * s, 0.62 * s, 0.16 * s, 0.62 * s, 'stone', '石狮·身');
    mb.boxC(x, z - 0.1 * s, 0.42 * s, 0.36 * s, 0.60 * s, 0.86 * s, 'stone', '石狮·头');
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
  // 窄长叶片：根部收窄、中腰最宽、叶尖收成一点，两段折出下垂；正反两面各画一次。
  // 竹、柳共用——叶子要有叶子的形状，不能拿一根方木条代替。
  /* 叶片母题（批 6）：一片窄叶固定成一组“单位坐标”顶点，实例化时只做一次旋转/缩放/平移。
   *   u = 沿叶长（0 根 → 1 尖），v = 横向（±1 = 半宽），w = 下垂（0..1，乘 droop）
   * 根边收 0.3、中腰最宽 1.0、叶尖收成一点，五点定一片叶。
   * 原来每片叶正反各画一次（同一位置的六张三角面，两两共面 10143 对 / 44.7 m²）——
   * 渲染器本来就按相机翻法线，单面即可双面可见，背面那一遍纯属自找 z-fighting。 */
  const LEAF_MOTIF = [[0, -0.3, 0], [0, 0.3, 0], [0.5, -1, -0.3], [0.5, 1, -0.3], [1, 0, -1]];

  // 叶形母题：同一种树只认一种母题，靠 tag 里的树名分流（原来七种树共用一片通用叶，
  // 320 档下竹、柳、银杏、枫的叶子长得一模一样，冠形全靠枝干区分）。
  const LEAF_MOTIFS = {
    // 竹：窄长、近乎平行、叶尖略垂
    '竹':   [[0, -0.25, 0], [0, 0.25, 0], [0.55, -0.42, -0.10], [0.55, 0.42, -0.10], [1, 0, -0.26]],
    // 柳：细长、中段即下垂，叶尖垂到底
    '柳':   [[0, -0.20, 0], [0, 0.20, 0], [0.50, -0.34, -0.55], [0.50, 0.34, -0.55], [1, 0, -1.05]],
    // 银杏：扇面，基部窄、上部宽，叶端平缺
    '银杏': [[0, -0.25, 0], [0, 0.25, 0], [0.68, -1.10, -0.12], [0.68, 1.10, -0.12], [1, 0, -0.16]],
    // 枫：掌形，两肩外张成角，叶尖略翘
    '枫':   [[0, -0.30, 0], [0, 0.30, 0], [0.48, -1.25, -0.20], [0.48, 1.25, -0.20], [1, 0, -0.42]],
  };
  function leafMotif(tag) {
    if (!tag) return LEAF_MOTIF;
    for (const k in LEAF_MOTIFS) if (tag.indexOf(k) >= 0) return LEAF_MOTIFS[k];
    return LEAF_MOTIF;
  }
  function leafBlade(mb, base, ang, len, hw, droop, mat, tag) {
    const dx = Math.cos(ang), dz = Math.sin(ang), px = -dz, pz = dx;
    const P = leafMotif(tag).map((m) => [
      base[0] + dx * m[0] * len + px * m[1] * hw,
      base[1] + 0.02 + droop * m[2],
      base[2] + dz * m[0] * len + pz * m[1] * hw
    ]);
    const A0 = P[0], A1 = P[1], C = P[2], D = P[3], T = P[4];
    // 叶片厚度：320 档（det≥3）沿中肋抬 4~8 mm，把平面叶折成 V 形断面。
    // 平片时代叶子斜对镜头就是一条零宽度的线；折过之后任何角度都有 3~5 px 的实体厚度。
    const rib = GF.detail(3) ? Math.min(0.009, Math.max(0.006, hw * 0.12)) : 0;   // 叶厚下限提到 6 mm：320 档 6 mm ≈ 2 px，低于 2 px 的 V 折在像素上会被削平
    if (rib > 0) {
      const M0 = [(A0[0] + A1[0]) / 2, (A0[1] + A1[1]) / 2 + rib, (A0[2] + A1[2]) / 2];
      const M1 = [(C[0] + D[0]) / 2, (C[1] + D[1]) / 2 + rib, (C[2] + D[2]) / 2];
      mb.quad(A0, M0, M1, C, mat, tag);
      mb.quad(M0, A1, D, M1, mat, tag);
      mb.tri(C, M1, T, mat, tag);
      mb.tri(M1, D, T, mat, tag);
      return;
    }
    mb.quad(A0, A1, D, C, mat, tag);
    mb.tri(C, D, T, mat, tag);
  }

  // 一根枝分两级：本级出枝，末级交给叶/花单元铺满。分杈数、分杈角、长度收率都带随机，
  // 这样每棵树的骨架都不重复，但整体轮廓是“由枝端叶簇堆出来的体积”，不是一团色块。
  function forkTwig(mb, p, ang, len, rise, depth, rad, r, leaf, tag, s, midLeaf) {
    const end = [p[0] + Math.cos(ang) * len, p[1] + rise, p[2] + Math.sin(ang) * len];
    GF.beamRound(mb, p, end, rad, depth > 1 ? 5 : 4, 'wood', tag);
    // 侧芽：真树的叶子沿枝而生，不是只在枝梢。中段补一簇，冠才连成一片。
    if (midLeaf && depth > 2) {
      leaf([p[0] + (end[0] - p[0]) * 0.62, p[1] + (end[1] - p[1]) * 0.62, p[2] + (end[2] - p[2]) * 0.62], ang, len * 0.7);
    }
    if (depth <= 1) { leaf(end, ang, len); return; }
    const n = 2 + r.int(0, 1);
    const base = ang + r.range(-0.28, 0.28);
    for (let i = 0; i < n; i++) {
      const na = base + (i - (n - 1) / 2) * (0.5 + r.next() * 0.34);
      forkTwig(mb, end, na, len * (0.6 + r.next() * 0.22), rise * 0.62 + 0.02 * s,
        depth - 1, rad * 0.62, r, leaf, tag, s, midLeaf);
    }
  }

  // 松针簇：一个枝端散出十几根三维短针，方位角铺满一周、仰角随机，
  // 针是细长锥（根部宽一点、针尖收成一点），所以从任何角度看都是蓬开的针球。
  function pineTuft(mb, p, s, r, tag) {
    // 针球密度跟精度档走：低档减半，320 档才给满
    const n = GF.detail(2) ? 9 + r.int(0, 3) : GF.detail(1) ? 7 : 5;
    for (let b = 0; b < n; b++) {
      const az = r.range(0, 6.283);
      const el = r.range(-0.55, 1.0);
      const L = (0.26 + r.next() * 0.13) * s;
      const ce = Math.cos(el), se = Math.sin(el);
      const w = 0.012 * s;
      const perX = -Math.sin(az), perZ = Math.cos(az);
      const mid = [p[0] + Math.cos(az) * L * 0.55 * ce, p[1] + se * L * 0.62, p[2] + Math.sin(az) * L * 0.55 * ce];
      const end = [p[0] + Math.cos(az) * L * 1.05 * ce, p[1] + se * L * 1.15, p[2] + Math.sin(az) * L * 1.05 * ce];
      const A = [p[0] - perX * w, p[1], p[2] - perZ * w];
      const B = [p[0] + perX * w, p[1], p[2] + perZ * w];
      const C = [mid[0] + perX * w * 0.5, mid[1], mid[2] + perZ * w * 0.5];
      const D = [mid[0] - perX * w * 0.5, mid[1], mid[2] - perZ * w * 0.5];
      mb.tri(A, B, C, 'pine', tag);
      mb.tri(A, C, D, 'pine', tag);
      mb.tri(D, C, end, 'pine', tag);
      mb.tri(C, B, end, 'pine', tag);
    }
  }

  // 叶簇：绕一点散出数片窄长叶，叶尖朝外、叶身略垂；竹、枫、银杏、杂树共用。
  function leafCluster(mb, p, s, r, n, len, hw, droop, mat, tag) {
    const cnt = GF.detail(2) ? n + r.int(0, 2) : GF.detail(1) ? n : Math.max(2, n - 2);
    for (let i = 0; i < cnt; i++) {
      const a = (i / cnt) * 6.283 + r.range(-0.3, 0.3);
      const base = [p[0] + Math.cos(a) * 0.03 * s, p[1] + r.range(-0.02, 0.03) * s, p[2] + Math.sin(a) * 0.03 * s];
      leafBlade(mb, base, a, len * (0.78 + r.next() * 0.4), hw, droop, mat, tag);
    }
  }

  // 五瓣花：每瓣一个四边小面，正反两面都画；梅、海棠等花树用。
  function blossom5(mb, c, s, r, mat, tag) {
    for (let p = 0; p < 5; p++) {
      const pa = (p / 5) * 6.283 + r.range(-0.08, 0.08);
      const pr = 0.07 * s;
      const A = [c[0], c[1], c[2]];
      const B = [c[0] + Math.cos(pa) * pr, c[1] + 0.014 * s, c[2] + Math.sin(pa) * pr];
      const C = [c[0] + Math.cos(pa + 0.6) * pr * 1.3, c[1] + 0.02 * s, c[2] + Math.sin(pa + 0.6) * pr * 1.3];
      const D = [c[0] + Math.cos(pa + 1.2) * pr, c[1] + 0.014 * s, c[2] + Math.sin(pa + 1.2) * pr];
      mb.quad(A, B, C, D, mat, tag);
      // 背面不再重画：单面即可双面可见（见 leafBlade 注释）
    }
  }

  // 阔叶树（枫 / 银杏 / 杂树共用）：先立一根从根到梢的通高主干，主枝沿干分三层斜上出，
  // 每根主枝在中段与枝端再分副枝，叶簇挂在副枝、主枝中段与冠心里层。干始终是同一根往上收，
  // 不会从中段忽然变成一把杈；冠靠里外两层叶簇堆成实体，仍有缝。
  function broadleaf(mb, x, z, s, r, H, mat, tag, o) {
    o = o || {};
    const leanA = r.range(0, 6.283), lean = r.range(0.05, 0.12) * s;
    const topY = H * (o.top || 0.74);
    const r0 = (o.r0 || 0.16) * s;
    const pt = (t) => [x + Math.cos(leanA) * lean * t * t, topY * t, z + Math.sin(leanA) * lean * t * t];
    const segs = 5;
    for (let i = 0; i < segs; i++) {
      const a = pt(i / segs), b = pt((i + 1) / segs);
      GF.beamRound(mb, a, b, r0 * (1 - (i / segs) * 0.7), 6, 'wood', tag + '·干');
    }
    const leafN = o.leafN || 6, leafLen = (o.leafLen || 0.22) * s, leafHW = (o.leafHW || 0.08) * s;
    const cluster = (p) => leafCluster(mb, p, s, r, leafN, leafLen, leafHW, 0.1 * s, mat, tag + '·叶');
    const tiers = o.tiers || [0.44, 0.62, 0.78];
    const cnts = o.cnts || [5, 4, 3];
    const lfs = o.lfs || [0.42, 0.32, 0.22];
    for (let ti = 0; ti < tiers.length; ti++) {
      const base = pt(tiers[ti]);
      const L = H * lfs[ti];
      const n = cnts[ti] + r.int(0, 1);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 6.283 + ti * 0.75 + r.range(-0.25, 0.25);
        // 主枝斜上得陡些，冠才有厚度，不会摊成一把伞
        const rise = L * (0.9 + r.next() * 0.4);
        const tip = [base[0] + Math.cos(a) * L, base[1] + rise, base[2] + Math.sin(a) * L];
        GF.beamRound(mb, base, tip, (0.052 - ti * 0.008) * s, 5, 'wood', tag + '·主枝');
        const mid = [base[0] + (tip[0] - base[0]) * 0.6, base[1] + (tip[1] - base[1]) * 0.62, base[2] + (tip[2] - base[2]) * 0.6];
        for (let k = 0; k < 2; k++) {
          const side = k ? 1 : -1;
          const aa = a + side * (0.45 + r.next() * 0.4);
          const sl = L * (0.36 + r.next() * 0.16);
          const st = [mid[0] + Math.cos(aa) * sl, mid[1] + sl * (0.5 + r.next() * 0.35), mid[2] + Math.sin(aa) * sl];
          GF.beamRound(mb, mid, st, 0.026 * s, 4, 'wood', tag + '·副枝');
          cluster(st);
          cluster([(mid[0] + st[0]) * 0.5, (mid[1] + st[1]) * 0.5, (mid[2] + st[2]) * 0.5]);
        }
        // 主枝沿程挂三簇，枝端一簇，冠里有里外两层叶
        cluster([base[0] + (tip[0] - base[0]) * 0.55, base[1] + (tip[1] - base[1]) * 0.58, base[2] + (tip[2] - base[2]) * 0.55]);
        cluster(mid);
        cluster(tip);
      }
    }
    // 冠壳：按高度分四环铺叶簇，半径按腰鼓形收回——下环最阔、上环收成锥，
    // 保证冠是一片连续的树冠，中心不留空洞，枝干只在冠里透出几道
    const shell = o.shell || [[0.46, 0.7, 6], [0.6, 1.0, 7], [0.74, 0.92, 6], [0.86, 0.68, 5], [0.95, 0.34, 4]];
    for (let si = 0; si < shell.length; si++) {
      const hf = shell[si][0], rf = shell[si][1], n = shell[si][2];
      const c0 = pt(hf);
      const R = H * 0.4 * rf;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 6.283 + si * 0.6 + r.range(-0.18, 0.18);
        const rj = R * (0.84 + r.next() * 0.3);
        cluster([c0[0] + Math.cos(a) * rj, c0[1] + r.range(-0.05, 0.07) * s, c0[2] + Math.sin(a) * rj]);
      }
    }
    // 冠心立柱：沿干再补三簇，填掉两侧枝之间那道空当
    for (const hf of [0.62, 0.76, 0.88]) {
      const c0 = pt(hf);
      cluster([c0[0] + r.range(-0.06, 0.06) * s, c0[1], c0[2] + r.range(-0.06, 0.06) * s]);
    }
    // 干梢与冠心：顶上两簇，冠心再补一圈，上层的冠才连成一片
    cluster(pt(1));
    const cp = pt(0.86);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * 6.283 + r.range(0, 0.9);
      const rr = H * 0.1;
      cluster([cp[0] + Math.cos(a) * rr, cp[1] + r.range(-0.03, 0.12) * s, cp[2] + Math.sin(a) * rr]);
    }
  }

  function tree(mb, x, z, kind, rng, s, tag) {
    s = s || 1;
    const r = rng || new GF.RNG(1);
    if (kind === 'pine') {
      // 松：主干四段渐细略欹侧 → 五轮轮生枝（下多上少，每轮四到五枝）→ 每枝再分两级 →
      // 枝端团成三维针球。整棵树的轮廓靠几十个针球堆出来，所以冠是蓬的，不会秃。
      const H = 2.55 * s;
      const leanA = r.range(0, 6.283), leanK = r.range(0.05, 0.14);
      let px = x, pz = z, py = 0, rad = 0.16 * s;
      for (let i = 0; i < 4; i++) {
        const t1 = (i + 1) / 4;
        const nx = x + Math.cos(leanA) * leanK * s * Math.sin(t1 * 2.4);
        const nz = z + Math.sin(leanA) * leanK * s * Math.sin(t1 * 2.4);
        const ny = H * t1;
        GF.beamRound(mb, [px, py, pz], [nx, ny, nz], rad, 6, 'wood', '松·干');
        px = nx; pz = nz; py = ny; rad *= 0.82;
      }
      const tiers = 6;
      for (let i = 0; i < tiers; i++) {
        const ty = H * (0.28 + i * 0.12);
        const len0 = (0.6 - i * 0.07) * s;
        const a0 = r.range(0, 6.283) + i * 0.9;
        const cnt = i < 2 ? 4 : 3;
        const sx = x + (px - x) * (ty / H), sz = z + (pz - z) * (ty / H);
        for (let j = 0; j < cnt; j++) {
          const a = a0 + (j / cnt) * 6.283 + r.range(-0.2, 0.2);
          forkTwig(mb, [sx, ty, sz], a, len0, 0.26 * s, 3, 0.05 * s, r,
            (p) => pineTuft(mb, p, s, r, '松·针'), '松·枝', s, true);
        }
      }
      // 顶芽：几根短枝向上，端上再团针
      for (let j = 0; j < 3; j++) {
        const aa = (j / 3) * 6.283 + r.range(0, 0.8);
        forkTwig(mb, [px, py - 0.12 * s, pz], aa, 0.2 * s, 0.18 * s, 2, 0.028 * s, r,
          (p) => pineTuft(mb, p, s, r, '松·针'), '松·顶枝', s, true);
      }
    } else if (kind === 'plum') {
      // 梅：老干作弯势 → 四五主枝 → 每主枝再分两级小枝 → 小枝与枝身都着五瓣花与花蕾。
      // 花是沿枝散开的，冠的轮廓由“枝影 + 花点”构成，不是粉球，也不是光杆。
      const H = 1.15 * s;
      const leanA = r.range(0, 6.283);
      const midP = [x + Math.cos(leanA) * 0.12 * s, H * 0.42, z + Math.sin(leanA) * 0.12 * s];
      const topP = [x + Math.cos(leanA) * 0.2 * s, H * 0.52, z + Math.sin(leanA) * 0.2 * s];
      GF.beamRound(mb, [x, 0, z], midP, 0.11 * s, 6, 'wood', '梅·干');
      GF.beamRound(mb, midP, topP, 0.085 * s, 6, 'wood', '梅·干');
      const nb = 4 + r.int(0, 2);
      const bloomAt = (p, ang, len) => {
        for (let f = 0; f < 4; f++) {
          const fa = ang + r.range(-1.1, 1.1);
          const off = r.range(0.02, 0.14) * s;
          blossom5(mb, [p[0] + Math.cos(fa) * off, p[1] + r.range(-0.06, 0.1) * s, p[2] + Math.sin(fa) * off], s, r, 'plum', '梅·瓣');
        }
        for (let q = 0; q < 2; q++) {
          const bw = 0.026 * s;
          mb.tri([p[0], p[1], p[2]], [p[0] + bw, p[1] + bw, p[2]], [p[0], p[1] + bw * 1.6, p[2] + bw * 0.7], 'plum', '梅·蕾');
          mb.tri([p[0], p[1], p[2]], [p[0], p[1] + bw * 1.6, p[2] + bw * 0.7], [p[0] + bw, p[1] + bw, p[2]], 'plum', '梅·蕾');
        }
      };
      for (let i = 0; i < nb; i++) {
        const a = (i / nb) * 6.283 + r.range(-0.35, 0.35);
        forkTwig(mb, topP, a, (0.5 + r.next() * 0.26) * s, H * (0.6 + r.next() * 0.3) - topP[1],
          3, 0.048 * s, r, bloomAt, '梅·枝', s, true);
      }
    } else if (kind === 'bamboo') {
      // 竹：多竿丛生，一竿七节逐节收细、节处凸环；下两节不出枝，其上每节左右互生一枝，
      // 枝再分两小枝，小枝端着五到七片窄长叶；越往上出枝越密，丛才蓬得住。
      const n = GF.detail(2) ? 7 : GF.detail(1) ? 6 : 4;
      for (let i = 0; i < n; i++) {
        const ox = (i - n / 2) * 0.21 * s + r.range(-0.08, 0.08);
        const pz = z + r.range(-0.26, 0.26);
        const hh = (2.2 + r.range(0, 1.5)) * s;
        const bx = r.range(-0.4, 0.4) * s;
        const nodes = 7;
        for (let q = 0; q < nodes; q++) {
          const t0 = q / nodes, t1 = (q + 1) / nodes;
          const cx0 = x + ox + bx * t0 * t0, cx1 = x + ox + bx * t1 * t1;
          const y0 = hh * t0, y1 = hh * t1;
          const rad1 = (0.062 - 0.007 * t1) * s;
          GF.beamRound(mb, [cx0, y0, pz], [cx1, y1, pz], rad1, 6, 'bamboo', '竹·竿');
          mb.cyl(cx1, pz, rad1 * 1.16, y1 - 0.016 * s, y1 + 0.016 * s, 6, 'bamboo', '竹·节');
          if (q < 1) continue;
          const nbq = t1 > 0.5 ? 2 : 1;
          for (let m = 0; m < nbq; m++) {
            const side = (q + m) % 2 ? 1 : -1;
            const a = (side > 0 ? 0 : Math.PI) + r.range(-0.6, 0.6);
            const len = (0.36 + r.next() * 0.16) * s;
            const tip = [cx1 + Math.cos(a) * len, y1 + (0.08 + r.next() * 0.14) * s, pz + Math.sin(a) * len];
            GF.beamRound(mb, [cx1, y1, pz], tip, 0.02 * s, 4, 'bamboo', '竹·枝');
            for (const off of [-0.55, 0.1, 0.65]) {
              const aa = a + off;
              const subTip = [tip[0] + Math.cos(aa) * 0.26 * s, tip[1] + (off > 0 ? 0.06 : -0.03) * s, tip[2] + Math.sin(aa) * 0.26 * s];
              GF.beamRound(mb, tip, subTip, 0.012 * s, 4, 'bamboo', '竹·小枝');
              leafCluster(mb, subTip, s, r, 5, 0.34 * s, 0.06 * s, 0.22 * s, 'leaf', '竹·叶');
            }
          }
        }
        // 竹梢：竿顶一小簇叶
        leafCluster(mb, [x + ox + bx, hh - 0.02 * s, pz], s, r, 4, 0.24 * s, 0.05 * s, 0.1 * s, 'leaf', '竹·叶');
      }
    } else if (kind === 'willow') {
      // 柳：主干短粗 → 五到七根粗枝斜上 → 枝端各垂七到九条柳条（两段自然下垂）→
      // 条上互生八到十片小叶。冠是一帘垂条，条上有叶，不是蘑菇。
      const H = 2.0 * s;
      trunk(mb, x, z, H * 0.6, 0.15 * s, 'wood', '柳·干');
      const branches = 6 + r.int(0, 2);
      for (let i = 0; i < branches; i++) {
        const a = (i / branches) * 6.283 + r.range(-0.3, 0.3);
        const L = (0.5 + r.next() * 0.22) * s;
        const tip = [x + Math.cos(a) * L, H * (0.9 + r.next() * 0.14), z + Math.sin(a) * L];
        GF.beamRound(mb, [x, H * 0.58, z], tip, 0.06 * s, 5, 'wood', '柳·枝');
        const strands = 7 + r.int(0, 3);
        for (let k = 0; k < strands; k++) {
          const aa = a + r.range(-1.1, 1.1);
          const rr = 0.08 + r.next() * 0.16;
          const start = [tip[0] + Math.cos(aa) * rr * s, tip[1] - r.range(0, 0.1) * s, tip[2] + Math.sin(aa) * rr * s];
          const outLen = (0.14 + r.next() * 0.16) * s;
          const dropLen = (1.0 + r.next() * 0.75) * s;
          const p1 = [start[0] + Math.cos(aa) * outLen, start[1] - 0.05 * s, start[2] + Math.sin(aa) * outLen];
          const p2 = [p1[0] + Math.cos(aa) * 0.055 * s, p1[1] - dropLen * 0.55, p1[2] + Math.sin(aa) * 0.055 * s];
          const p3 = [p2[0] - Math.cos(aa) * 0.022 * s, p1[1] - dropLen, p2[2] - Math.sin(aa) * 0.022 * s];
          GF.beamRound(mb, start, p1, 0.013 * s, 4, 'willow', '柳·条');
          GF.beamRound(mb, p1, p2, 0.011 * s, 4, 'willow', '柳·条');
          GF.beamRound(mb, p2, p3, 0.009 * s, 4, 'willow', '柳·条');
          const leaves = 10;
          for (let m = 0; m < leaves; m++) {
            const t = (m + 1) / (leaves + 1);
            const seg = t < 0.55 ? [p1, p2] : [p2, p3];
            const tt = t < 0.55 ? t / 0.55 : (t - 0.55) / 0.45;
            const at = [seg[0][0] + (seg[1][0] - seg[0][0]) * tt, seg[0][1] + (seg[1][1] - seg[0][1]) * tt, seg[0][2] + (seg[1][2] - seg[0][2]) * tt];
            const la = aa + (m % 2 ? 1.05 : -1.05);
            leafBlade(mb, at, la, (0.09 + r.next() * 0.04) * s, 0.028 * s, 0.06 * s, 'willow', '柳·叶');
          }
        }
      }
    } else if (kind === 'gingko') {
      // 银杏：通高主干 + 三层主枝，扇形叶簇（gold），冠上尖下阔
      broadleaf(mb, x, z, s, r, 2.0 * s, 'gold', '银杏', {
        tiers: [0.34, 0.5, 0.64], cnts: [5, 4, 3], lfs: [0.54, 0.42, 0.3],
        leafN: 5, leafLen: 0.215, leafHW: 0.085, r0: 0.155
      });
    } else if (kind === 'banana') {
      // 芭蕉：假茎 + 向外垂下的长扇叶（叶根窄、中段最宽、叶尖下垂收窄），另有一片心叶。
      mb.cyl(x, z, 0.2 * s, 0, 2.15 * s, 8, 'bamboo', '芭蕉·茎');
      const nL = 8;
      for (let i = 0; i < nL; i++) {
        const a = (i / nL) * Math.PI * 2 + 0.35 + r.range(-0.12, 0.12);
        const ca = Math.cos(a), sa = Math.sin(a);
        const pa = -sa, pb = ca;
        const segs = [[0.16, 2.16, 0.1], [0.55, 2.02, 0.22], [0.98, 1.74, 0.26], [1.3, 1.36, 0.1]]
          .map((v) => [v[0] * s, v[1] * s, v[2] * s]);
        for (let k = 0; k < segs.length - 1; k++) {
          const r0 = segs[k][0], yy0 = segs[k][1], w0 = segs[k][2];
          const r1 = segs[k + 1][0], yy1 = segs[k + 1][1], w1 = segs[k + 1][2];
          const A = [x + ca * r0 + pa * w0, yy0, z + sa * r0 + pb * w0];
          const B = [x + ca * r0 - pa * w0, yy0, z + sa * r0 - pb * w0];
          const C = [x + ca * r1 - pa * w1, yy1, z + sa * r1 - pb * w1];
          const D = [x + ca * r1 + pa * w1, yy1, z + sa * r1 + pb * w1];
          mb.quad(A, B, C, D, 'leaf', '芭蕉·叶');
          
        }
      }
      mb.cyl(x, z, 0.24 * s, 2.1 * s, 2.22 * s, 6, 'leaf', '芭蕉·心');
    } else if (kind === 'maple') {
      // 红枫：主干略短、冠更低更铺，三层主枝 + 副枝红叶片簇
      broadleaf(mb, x, z, s, r, 1.85 * s, 'zhu', '枫', {
        top: 0.7, tiers: [0.34, 0.5, 0.64], cnts: [5, 4, 3], lfs: [0.56, 0.44, 0.3],
        leafN: 6, leafLen: 0.2, leafHW: 0.075, r0: 0.145
      });
    } else {
      // 杂树：通高主干 + 三层主枝，叶簇双色不分，冠圆而透
      broadleaf(mb, x, z, s, r, 1.8 * s, 'leaf', '树', {
        top: 0.72, tiers: [0.36, 0.52, 0.66], cnts: [5, 4, 3], lfs: [0.55, 0.43, 0.3],
        leafN: 6, leafLen: 0.225, leafHW: 0.085, r0: 0.155
      });
    }
  }

  /* ------------------------------ 假山 ------------------------------ */
  // 石分两类：
  //   taihu   太湖石——瘦（下收上丰）、皱（三重正弦溶蚀面）、漏（腿间柱缝是真空气）、透（那孔高拱前后左右都通）
  //   qianshi 千层石——层理，层厚分明、层面波痕、整体缓倾，层间夹泥层
  function rockPillar(mb, cx, cz, w, y0, h, layers, r, tag, depth) {
    const k = 6 + r.int(0, 2);
    const a0 = r.range(0, 6.283);
    const dz = (depth || w * 0.82) * 0.5;
    for (let L = 0; L < layers; L++) {
      const f0 = L / layers, f1 = (L + 1) / layers;
      const shrink = 1 - f0 * 0.42;
      const twist = f0 * (0.28 + r.range(0, 0.18));
      const pts = [];
      for (let j = 0; j < k; j++) {
        const a = a0 + twist + (j / k) * 6.283;
        // 皱：隔一个点外凸、隔一个点内凹，且逐层换相位
        const wrinkle = (j % 2 === 0 ? 1.16 : 0.86) * (L % 2 ? 0.96 : 1.04);
        const rad = w * 0.5 * shrink * wrinkle * (0.94 + r.next() * 0.14);
        pts.push([cx + Math.cos(a) * rad, cz + Math.sin(a) * dz * wrinkle * 0.9]);
      }
      mb.prism(pts, y0 + h * f0, y0 + h * f1, 'stone', tag);
    }
  }

  function taihuRock(mb, x, z, s, r, tag) {
    // 太湖石：一对粗腿到腰，上方石冠层层跨过两腿、逐层收成馒头状，中间留一孔高拱，
    // 前后左右都望得穿；冠顶压三块错位横石再起一短峰，腿脚边散三块小石，侧面补一块斜石。
    const a0 = r.range(0, 6.283), ph = r.range(0, 6.283), k = 9, H = 1.0 * s;
    // 腿：五层，几乎不收分；两腿相距 0.44s，腿间即拱洞
    for (const sx of [-1, 1]) {
      const lx = x + sx * 0.23 * s;
      rockPillar(mb, lx, z, 0.27 * s, 0, 0.52 * H, 5, r, tag + '·腿', 0.4 * s);
    }
    // 腿后垫矮石，洞不全空
    mb.taper(x - 0.04 * s, z + 0.32 * s, 0.2 * s, 0.14 * s, 0.16 * s, 0.11 * s, 0, 0.28 * H, 'stone', tag + '·垫石');
    // 石冠：四层，底起 0.48H 压住腿顶，逐层收得快，收成馒头而不是石桌
    const crown = [[0.43, 0.48, 0.68], [0.37, 0.68, 0.84], [0.28, 0.84, 0.95]];
    const dz = 0.8;
    for (let L = 0; L < crown.length; L++) {
      const pts = [];
      for (let j = 0; j < k; j++) {
        const a = a0 + (j / k) * 6.283 + L * 0.22;
        const w = 1 + 0.15 * Math.sin(3 * a + ph + L * 0.8) + 0.07 * Math.sin(5 * a - ph * 0.7);
        const rr = crown[L][0] * s * w * (0.95 + r.next() * 0.1);
        pts.push([x + Math.cos(a) * rr, z + Math.sin(a) * rr * dz]);
      }
      mb.prism(pts, crown[L][1] * H, crown[L][2] * H, 'stone', tag + '·冠');
    }
    // 冠顶三块错位横石：都落在冠顶半径内，不悬空
    for (let i = 0; i < 3; i++) {
      const a = a0 + 0.8 + i * 2.2;
      const rr = 0.1 * s * (1 + r.next() * 0.4);
      const px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr * 0.8;
      const w = (0.17 + r.next() * 0.06) * s, d = (0.14 + r.next() * 0.05) * s;
      const yb = 0.95 * H + i * 0.03 * H;
      mb.prism([
        [px - w * 0.5, pz - d * 0.5], [px + w * 0.5, pz - d * 0.54],
        [px + w * 0.46, pz + d * 0.5], [px - w * 0.46, pz + d * 0.44]
      ], yb, yb + 0.075 * H, i === 1 ? 'stoneB' : 'stone', tag + '·顶石');
    }
    mb.taper(x + 0.05 * s, z - 0.03 * s, 0.17 * s, 0.15 * s, 0.08 * s, 0.07 * s, 1.02 * H, 1.18 * H, 'stone', tag + '·峰');
    // 腿脚边两块碎石，只靠在腿外侧，不挡拱洞
    for (let i = 0; i < 2; i++) {
      const sx = i ? 1 : -1;
      const px = x + sx * (0.34 + r.next() * 0.06) * s, pz = z + (i ? 0.06 : -0.08) * s;
      const w = (0.14 + r.next() * 0.06) * s;
      mb.taper(px, pz, w, w * 0.8, w * 0.55, w * 0.45, 0, (0.14 + r.next() * 0.1) * H, 'stone', tag + '·碎石');
    }
    // 侧面斜石
    mb.taper(x + 0.38 * s, z + 0.04 * s, 0.22 * s, 0.19 * s, 0.12 * s, 0.1 * s, 0, 0.58 * H, 'stone', tag + '·侧石');
  }
  function qianshiRock(mb, x, z, s, r, tag) {
    // 千层石：沉积岩层理。层厚分明、厚薄不均，层面带波痕、整块顺一个方向缓倾，
    // 出挑幅度很小（1.02/0.98），层间夹一道薄泥层换色；整块宽而矮，顶上平压一层，不往上抽成塔。
    const layers = 6 + r.int(0, 3);
    const a0 = r.range(0, 6.283), k = 7 + r.int(0, 2);
    const slopeA = r.range(0, 6.283);
    const slope = 0.1 + r.next() * 0.12;
    const wavePh = r.range(0, 6.283);
    const H0 = 0.52 * s;                             // 整块高约 0.52s，宽约 1.0s
    let y = 0;
    for (let L = 0; L < layers; L++) {
      const f = L / layers;
      const h = H0 * (0.6 / layers + r.next() * 0.9 / layers);
      const taper = 1 - 0.16 * f;
      const out = L % 2 === 0 ? 1.02 : 0.98;
      const cx = x + Math.cos(slopeA) * slope * f * s * 0.5;
      const cz = z + Math.sin(slopeA) * slope * f * s * 0.5;
      const pts = [];
      for (let j = 0; j < k; j++) {
        const a = a0 + (j / k) * 6.283 + L * 0.14;
        const wave = 1 + 0.06 * Math.sin(3 * a + wavePh + L * 0.5);
        const rad = 0.5 * s * taper * out * wave * (0.92 + r.next() * 0.16);
        pts.push([cx + Math.cos(a) * rad, cz + Math.sin(a) * rad * 0.78]);
      }
      mb.prism(pts, y, y + h, 'stone', tag + '·层');
      y += h;
      if (L % 4 === 3) {                            // 薄泥层，颜色略深
        const thin = pts.map((p) => [cx + (p[0] - cx) * 0.96, cz + (p[1] - cz) * 0.96]);
        mb.prism(thin, y, y + 0.014 * s, 'stoneB', tag + '·夹层');
        y += 0.014 * s;
      }
    }
    // 顶上压一层略小的平石，层口封住，顶面平（千层石顶多被切平）
    const top = [];
    for (let j = 0; j < k; j++) {
      const a = a0 + (j / k) * 6.283 + 0.3;
      const rad = 0.4 * s * (0.9 + r.next() * 0.18);
      top.push([x + Math.cos(a) * rad, z + Math.sin(a) * rad * 0.78]);
    }
    mb.prism(top, y, y + 0.07 * s, 'stone', tag + '·顶层');
  }
  // 叠石母题：五种轮廓（墩石 / 石笋 / 卧石 / 错叠 / 扇石），按位置散列选型、相位随位置旋转。
  // 原来小石只有 qianshiRock 一种断面，岸线上一排石头其实是同一块石头的随机半径版本；
  // 母题表给的是固定轮廓 + 固定相位比，相邻两块既不同型、也不会凑出同一张侧面（不共面）。
  const ROCK_MOTIF = [
    { k: 8, st: [[0.62, 0.00, 0.34], [0.56, 0.33, 0.62], [0.40, 0.60, 0.72]] },                                  // 墩石：矮胖一块
    { k: 7, st: [[0.34, 0.00, 0.26], [0.28, 0.24, 0.58], [0.20, 0.56, 0.90], [0.10, 0.88, 1.02]] },              // 石笋：细高起尖
    { k: 9, st: [[0.68, 0.00, 0.22], [0.60, 0.18, 0.40]] },                                                      // 卧石：宽扁两层
    { k: 7, st: [[0.50, 0.00, 0.30], [0.58, 0.26, 0.50], [0.34, 0.46, 0.74]] },                                  // 错叠：中段外凸
    { k: 8, st: [[0.58, 0.00, 0.20], [0.50, 0.18, 0.44], [0.30, 0.40, 0.66], [0.14, 0.62, 0.78]] },              // 扇石：逐层收分
  ];
  function stoneMotif(mb, x, z, s, r, tag) {
    const h = Math.abs(Math.round((x * 131.7 + z * 977.3) * 1000));
    const mi = h % ROCK_MOTIF.length;
    const m = ROCK_MOTIF[mi];
    const ph = (h % 360) * 0.0174533;
    const lean = (r.next() - 0.5) * 0.10 * s;
    for (let i = 0; i < m.st.length; i++) {
      const seg = m.st[i];
      const pts = [];
      for (let j = 0; j < m.k; j++) {
        const a = ph + (j / m.k) * 6.2832 + i * 0.19;
        const rad = 0.5 * s * seg[0] * (1 + 0.05 * Math.sin(3 * a + ph));
        pts.push([x + Math.cos(a) * rad + lean * (seg[1] + seg[2]) * 0.5, z + Math.sin(a) * rad * 0.82]);
      }
      mb.prism(pts, seg[1] * s, seg[2] * s, 'stone', tag + '·石');
    }
    // 顶部压一块薄石：轮廓收口，顶面平，320 档不会看到空心的层口
    const tp = [];
    for (let j = 0; j < 7; j++) {
      const a = ph + (j / 7) * 6.2832 + 0.35;
      const rad = 0.5 * s * 0.30 * (0.92 + r.next() * 0.14);
      tp.push([x + Math.cos(a) * rad, z + Math.sin(a) * rad * 0.82]);
    }
    const ty = m.st[m.st.length - 1][2] * s;
    mb.prism(tp, ty - 0.004 * s, ty + 0.030 * s, 'stone', tag + '·顶石');
  }
  function rock(mb, x, z, s, rng, tag, kind) {
    s = s || 1;
    const r = rng || new GF.RNG(7);
    const kd = kind || (s >= 0.75 ? 'taihu' : 'motif');
    if (kd === 'taihu') taihuRock(mb, x, z, s, r, tag || '假山');
    else if (kd === 'qianshi') qianshiRock(mb, x, z, s, r, tag || '叠石');
    else {
      // 每五块石头里留一块给千层石，岸线才有层理与块石混搭，不会整排同一种
      const h = Math.abs(Math.round((x * 131.7 + z * 977.3) * 1000));
      if (h % 5 === 0) qianshiRock(mb, x, z, s, r, tag || '叠石');
      else stoneMotif(mb, x, z, s, r, tag || '叠石');
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
      // 榻 / 垫 / 枕 三件各让 2 cm：垫与枕都坐进下一件 2 cm，
      // 原来 垫底=榻面、枕底=垫顶 严格齐平（榻×榻·垫 2.94 m²、榻·垫×榻·枕 0.44 m² 的同面）
      mb.boxC(x, z, 1.3 * s, 0.9 * s, 0, 0.42 * s, 'wood', '榻');
      mb.boxC(x, z, 1.2 * s, 0.82 * s, 0.40 * s, 0.52 * s, 'cloth', '榻·垫');
      mb.boxC(x - 0.42 * s, z, 0.3 * s, 0.5 * s, 0.50 * s, 0.66 * s, 'cloth', '榻·枕');
      mb.boxC(x, z - 0.5 * s, 1.3 * s, 0.06 * s, 0, 1.0 * s, 'wood', '榻·屏');
    } else if (kind === 'altar') {
      mb.boxC(x, z, 1.6 * s, 0.6 * s, 0, 0.85 * s, 'wood', '香案');
      mb.boxC(x, z, 1.7 * s, 0.7 * s, 0.83 * s, 0.95 * s, 'timber', '香案·面');
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

    // 下槛坐进地面 4 cm：原来 下槛底 = 地板顶 严格齐平（地板×下槛 0.48–0.51 m²）
    localBox(mb, mp, u0, u1, v0 - 0.04, v0 + 0.14, -t, t, 'wood', tag + '·下槛');
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
      // 下裙板：底边压进下槛 4 cm、两侧咬进边柱/抱框 4 mm，
      // 原来 裙板底=下槛顶、裙板边=边柱边 两处都严格齐平
      localBox(mb, mp, a - 0.004, b + 0.004, v0 + 0.10, py0, -0.045, 0.045, o.lowerMat || 'wood', tag + '·裙板');
      // 上部格心（背衬窗纸）
      localBox(mb, mp, a - 0.004, b + 0.004, py0 + 0.04, v1 - 0.18, -0.03, -0.01, 'paper', tag + '·纱');
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
    mb.boxC(x, z, 0.36 * s, 0.36 * s, 0.778 * s, 1.06 * s, 'lamp', tag + '·灯室');
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
    mb.boxC(x, z, 0.6 * s, 0.16 * s, 0.218 * s, 1.7 * s, 'stone', tag + '·碑身');
    mb.boxC(x, z, 0.7 * s, 0.2 * s, 1.698 * s, 1.9 * s, 'stone', tag + '·碑首');
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
    mapper, localBox, wallWithHoles, windowAt, doorAt, plaque, dougong, dougongHeight, pingban, lintel,
    queti, platform, railing, horseHeadWall, courtWall, yingbi, lion, censer,
    loftRect, capRect, rectRing,
    lantern, banner, tree, rock, pond, furniture, latticeBars, partition,
    couplet, menZan, baogu, ceiling, caisson, stoneLantern, well, stele,
    bellDrum, penjing, quBridge, tieMaZhuang
  };
})(typeof window !== 'undefined' ? window : globalThis);