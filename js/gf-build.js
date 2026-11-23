/* ============================================================================
 * 国风古建像素工坊 · 建筑装配
 * 殿 / 堂 / 民居 / 宫殿（重檐）/ 亭 / 塔 / 牌坊 / 城门楼 / 四合院 / 廊桥
 * ==========================================================================*/
(function (global) {
  'use strict';
  const GF = (global.GF = global.GF || {});
  const V = GF.V;
  const P = GF.parts;

  /* --------------------------- 地面铺装 --------------------------- */
  // 回到最初的做法：真实方砖平铺成一块完整铺装地面，砖缝、磨损、色差都由几何与材质体现
  function ground(mb, r) {
    // 默认只出建筑：场地要靠“显示场地”开关才铺
    const type = r.env.groundType || 'plain';
    if (r.env.showGround === false || r.env.ground === 'none' || type === 'none') return;
    const S = r.env.groundSize || 8;
    const axis = (r.env.waterSide === 'left' || r.env.waterSide === 'right') ? 'x' : 'z';
    const neg = (r.env.waterSide === 'back' || r.env.waterSide === 'left');
    const W = Math.max(1.5, r.env.waterW == null ? 6 : r.env.waterW);

    // 铺砖 / 铺石：一块一块排，砖缝靠几何与材质体现
    const mats = {
      stone: ['stone', 'stoneB'], soil: ['soil', 'stoneB'], grass: ['grass', 'leaf'],
      brick: ['brick', 'brickB'], marble: ['marble', 'marbleB']
    };
    const [mA, mB] = mats[r.env.ground] || mats.stone;
    const cell = 1.2;
    const fill = (u0, u1, v0, v1, tag) => {
      // u 沿 x、v 沿 z；水面单独由 fillWater 处理
      const nu = Math.max(0, Math.round((u1 - u0) / cell));
      const nv = Math.max(0, Math.round((v1 - v0) / cell));
      for (let i = 0; i < nu; i++) {
        for (let j = 0; j < nv; j++) {
          const x = u0 + (i + 0.5) * (u1 - u0) / nu;
          const z = v0 + (j + 0.5) * (v1 - v0) / nv;
          const useB = (i * 7 + j * 5) % 13 === 0;
          mb.box(x - cell / 2, x + cell / 2, -0.06, 0.0, z - cell / 2, z + cell / 2, useB ? mB : mA, tag || 'ground');
        }
      }
    };
    const fillWater = (u0, u1, v0, v1) => {
      mb.box(u0, u1, -0.2, -0.06, v0, v1, 'water', '水面');
      // 水纹：横向细线，靠材质明暗差做出波光
      const span = u1 - u0, dep = v1 - v0;
      for (let z = v0 + 0.7; z < v1; z += 1.15) {
        mb.box(u0 + 0.2, u0 + span * 0.55, -0.055, -0.045, z, z + 0.1, 'waterB', '水纹');
      }
      for (let z = v0 + 1.25; z < v1; z += 1.5) {
        mb.box(u0 + span * 0.45, u1 - 0.2, -0.05, -0.04, z, z + 0.08, 'waterB', '水纹');
      }
      void dep;
    };
    // 驳岸：水面两侧各压一道矮石墙，避免“水分界线是一刀切”
    const quay = (u0, u1, v0, v1) => {
      mb.box(u0, u1, -0.06, 0.22, v0, v1, 'stone', '驳岸');
      mb.box(u0, u1, 0.22, 0.28, v0 - 0.04, v1 + 0.04, 'stoneB', '驳岸压顶');
    };

    if (type === 'lake') {
      // 整片水面：建筑像落在水面上（水榭 / 画舫 / 临水殿）
      fillWater(-S, S, -S, S);
      return;
    }

    if (type === 'shore' || type === 'banks') {
      // 岸线：建筑脚下留出岸地（按场地半径取 40%，保证不会切进建筑），水在岸线外侧
      const line = type === 'banks' ? Math.max(3, S * 0.26) : Math.max(4, S * 0.4);
      let near0, near1, far0, far1, w0, w1;
      if (axis === 'z') {
        if (!neg) { // 水在前方（-z）
          near0 = -line; near1 = S; w0 = -line - W; w1 = -line;
          far0 = -S; far1 = w0;
        } else { // 水在后方（+z）
          near0 = -S; near1 = line; w0 = line; w1 = line + W;
          far0 = w1; far1 = S;
        }
        // 湖畔：水一直铺到场地边缘；两岸：只留一道水道 + 对岸
        if (type === 'shore' && !neg) { w0 = -S; w1 = -line; }
        if (type === 'shore' && neg) { w0 = line; w1 = S; }
        fill(-S, S, near0, near1);
        if (type === 'banks' && far1 > far0) fill(-S, S, far0, far1);
        fillWater(-S, S, Math.min(w0, w1), Math.max(w0, w1));
        quay(-S, S, -line - 0.18, -line + 0.06);
        if (type === 'banks') {
          const b0 = neg ? line + W : -line - W;
          quay(-S, S, b0 - 0.06, b0 + 0.18);
        }
      } else {
        if (!neg) { // 水在右侧（+x）
          near0 = -S; near1 = line; w0 = line; w1 = line + W;
          far0 = w1; far1 = S;
        } else { // 水在左侧（-x）
          near0 = -line; near1 = S; w0 = -line - W; w1 = -line;
          far0 = -S; far1 = w0;
        }
        if (type === 'shore' && !neg) { w0 = line; w1 = S; }
        if (type === 'shore' && neg) { w0 = -S; w1 = -line; }
        fill(near0, near1, -S, S);
        if (type === 'banks' && far1 > far0) fill(far0, far1, -S, S);
        fillWater(Math.min(w0, w1), Math.max(w0, w1), -S, S);
        quay(line - 0.18, line + 0.06, -S, S);
        if (type === 'banks') {
          const b0 = neg ? -line - W : line + W;
          quay(b0 - 0.06, b0 + 0.18, -S, S);
        }
      }
    } else {
      fill(-S, S, -S, S);
    }

    // 踏跺前的甬道（阶条石铺法）
    if (r.env.path) {
      mb.box(-1.1, 1.1, 0, 0.05, -0.5, S, 'marble', 'ground');
      for (let z = 0; z < S; z += 0.9) {
        mb.box(-1.14, 1.14, 0.05, 0.06, z, z + 0.06, 'marbleB', 'ground');
      }
    }
  }

  /* --------------------------- 室内地板 --------------------------- */
  function interiorFloor(mb, W, D, y, tag) {
    const plank = 0.34;
    const nx = Math.round(W / plank);
    for (let i = 0; i < nx; i++) {
      const x0 = -W / 2 + i * plank;
      mb.box(x0, x0 + plank - 0.02, y, y + 0.06, -D / 2, D / 2, i % 2 ? 'wood' : 'terracotta', tag || '室内地板');
    }
  }

  /* --------------------------- 主体结构 --------------------------- */
  // 返回顶部标高
  function body(mb, o) {
    const W = o.W, D = o.D;
    const x0 = -W / 2, x1 = W / 2, z0 = -D / 2, z1 = D / 2;
    const floors = o.floors || 1;
    const fh = o.floorH || 3.4;
    const base = o.baseY;
    const bays = o.bays || 3;
    const bayW = W / bays;
    const colR = o.colR || 0.19;
    const cut = o.cut || {};
    const wallT = o.wallT || 0.22;
    let lastTopY = base;

    for (let f = 0; f < floors; f++) {
      const fhF = (Array.isArray(o.floorHList) && o.floorHList[f] != null) ? o.floorHList[f] : fh;
      let yb = base;
      for (let k = 0; k < f; k++) yb += (Array.isArray(o.floorHList) && o.floorHList[k] != null) ? o.floorHList[k] : fh;
      const yt = yb + fhF;

      // 柱
      for (let i = 0; i <= bays; i++) {
        const cx = x0 + i * bayW;
        for (const cz of [z0 + 0.2, z1 - 0.2]) {
          mb.boxC(cx, cz, 0.18, 0.18, yb, yb + 0.12, 'stone', '柱础');
          mb.cyl(cx, cz, colR, yb + 0.1, yt, 8, o.colMat, '檐柱');
        }
      }
      // 前后墙（带门窗洞）
      for (const side of ['front', 'back']) {
        if (cut[side]) continue;
        const at = side === 'front' ? z1 - 0.1 : z0 + 0.1;
        const holes = [];
        for (let i = 0; i < bays; i++) {
          const bx = x0 + bayW * (i + 0.5);
          if (f === 0 && i === Math.floor(bays / 2)) {
            holes.push({ u0: bx - o.doorW / 2, u1: bx + o.doorW / 2, v0: yb, v1: yb + o.doorH });
          } else {
            holes.push({ u0: bx - o.winW / 2, u1: bx + o.winW / 2, v0: yb + fhF * 0.36, v1: yb + fhF * 0.36 + o.winH });
          }
        }
        const u0 = side === 'front' ? x0 : -x1;
        const u1 = side === 'front' ? x1 : -x0;
        P.wallWithHoles(mb, {
          dir: side, at, u0, u1, y0: yb, y1: yt,
          holes: holes.map((h) => side === 'front' ? h : ({ u0: -h.u1, u1: -h.u0, v0: h.v0, v1: h.v1 })),
          thickness: wallT, mat: o.wallMat, tag: '墙体·' + (side === 'front' ? '前' : '后')
        });
        // 门窗构件
        for (let i = 0; i < bays; i++) {
          const bx = x0 + bayW * (i + 0.5);
          const uu = side === 'front' ? bx : -bx;
          if (f === 0 && i === Math.floor(bays / 2)) {
            P.doorAt(mb, { dir: side, at, uc: uu, w: o.doorW, h: o.doorH, y0: yb, style: o.doorStyle, pattern: o.winPattern, leaves: o.doorLeaves, plain: o.cheap, tag: '门·' + side });
          } else {
            P.windowAt(mb, {
              dir: side, at, uc: uu, vc: yb + fhF * 0.36 + o.winH / 2,
              w: o.winW, h: o.winH, pattern: o.winPattern, plain: o.cheap, tag: '窗·' + side
            });
          }
        }
      }
      // 左右山墙
      for (const side of ['left', 'right']) {
        if (cut[side]) continue;
        const at = side === 'right' ? x1 - 0.1 : x0 + 0.1;
        const holes = (o.sideWindows === false) ? [] : [
          { u0: -D * 0.18, u1: D * 0.18, v0: yb + fhF * 0.36, v1: yb + fhF * 0.36 + o.winH * 0.8 }
        ];
        const u0 = side === 'right' ? z0 : -z1;
        const u1 = side === 'right' ? z1 : -z0;
        P.wallWithHoles(mb, {
          dir: side, at, u0, u1, y0: yb, y1: yt,
          holes: holes.map((h) => side === 'right' ? h : ({ u0: -h.u1, u1: -h.u0, v0: h.v0, v1: h.v1 })),
          thickness: wallT, mat: o.wallMat, tag: '墙体·山面'
        });
        if (holes.length) {
          P.windowAt(mb, {
            dir: side, at, uc: 0, vc: holes[0].v0 + o.winH * 0.4,
            w: holes[0].u1 - holes[0].u0, h: o.winH * 0.8, pattern: 'straight', tag: '窗·山面'
          });
        }
      }

      // 阶条石（勒脚）：首层墙脚压一道条石，二层以上做腰线，避免“墙直接插进台基”
      {
        const b0 = f === 0 ? yb : yb - 0.02;
        const b1 = f === 0 ? yb + 0.2 : yb + 0.12;
        if (!cut.front) mb.box(x0, x1, b0, b1, z1 - 0.26, z1 + 0.04, 'stone', f === 0 ? '墙脚石·前' : '腰线·前');
        if (!cut.back) mb.box(x0, x1, b0, b1, z0 - 0.04, z0 + 0.26, 'stone', f === 0 ? '墙脚石·后' : '腰线·后');
        if (!cut.left) mb.box(x0 - 0.04, x0 + 0.26, b0, b1, z0, z1, 'stone', f === 0 ? '墙脚石·左' : '腰线·左');
        if (!cut.right) mb.box(x1 - 0.26, x1 + 0.04, b0, b1, z0, z1, 'stone', f === 0 ? '墙脚石·右' : '腰线·右');
      }

      // 额枋 + 彩画
      for (const side of ['front', 'back']) {
        const at = side === 'front' ? z1 - 0.05 : z0 + 0.05;
        P.lintel(mb, {
          dir: side, at, uc: 0, w: W, y: yt - 0.42, h: 0.3, th: 0.26,
          seg: o.cheap ? 2 : Math.max(4, bays * 2), tag: '额枋·' + side
        });
      }
      // 斗拱
      if (o.dougong) {
        const n = Math.max(6, Math.round(W / 0.62));
        for (let i = 0; i <= n; i++) {
          const cx = x0 + (W * i) / n;
          for (const cz of [z0 + 0.12, z1 - 0.12]) {
            P.dougong(mb, cx, yt - 0.1, cz, o.dgScale || 0.9, '斗拱', o.dgStyle || 'mid');
          }
        }
      }
      // 栱眼壁（斗拱之间的垫板）
      if (o.dougong && o.dgEye) {
        for (const side of ['front', 'back']) {
          const at = side === 'front' ? z1 - 0.1 : z0 + 0.1;
          P.lintel(mb, {
            dir: side, at, uc: 0, w: W, y: yt + 0.42, h: 0.22, th: 0.18,
            seg: Math.max(3, bays), tag: '栱眼壁'
          });
        }
      }
      // 雀替（每间两端）
      if (o.queti) {
        for (let i = 0; i < bays; i++) {
          const bx0 = x0 + i * bayW, bx1 = x0 + (i + 1) * bayW;
          for (const side of ['front', 'back']) {
            const at = side === 'front' ? z1 - 0.18 : z0 + 0.18;
            P.queti(mb, side, at, bx0 + 0.05, yt - 0.72, 0.7, '雀替');
            P.queti(mb, side, at, bx1 - 0.75, yt - 0.72, 0.7, '雀替');
          }
        }
      }
      // 室内地板（首层；城制等大群组可用 noFloor 关闭以控三角面）
      if (f === 0 && !o.noFloor) interiorFloor(mb, W - 0.4, D - 0.4, yb + 0.02, '地板');

      // 腰檐（非顶层）
      if (f < floors - 1 && !cut.roof) {
        GF.roofs.skirt(mb, {
          cx: 0, cz: 0,
          x0: x0 - o.eave, x1: x1 + o.eave, z0: z0 - o.eave, z1: z1 + o.eave,
          xi: W / 2 + 0.1, zi: D / 2 + 0.1,
          yb: yt, ytop: yt + Math.min(1.6, fhF * 0.42),
          tile: o.tile, tileB: o.tileB, upturn: o.upturn * 0.6, tag: '腰檐' + (f + 1)
        });
      }
      lastTopY = yt;
    }
    return { topY: lastTopY, x0, x1, z0, z1, bayW };
  }

  /* ------------------------------ 殿堂副阶 ------------------------------ */
  // 殿 / 厅堂的副阶周匝：四周一圈廊柱 + 一层下檐，主屋顶仍在上面，形成重檐感
  function hallFujie(mb, r, o) {
    const W = o.W, D = o.D, y0 = o.y0, fj = o.fj;
    const colH = o.colH;
    const x = W / 2 + fj, z = D / 2 + fj;
    const bays = Math.max(2, o.bays || 3);
    // 转角柱 + 前后檐逐间柱 + 两山各一根中柱
    const spots = [];
    for (const sz of [-1, 1]) {
      for (let i = 0; i <= bays; i++) spots.push([-W / 2 + (W * i) / bays, sz * z]);
      spots.push([sz * x, 0]);
    }
    for (const [px, pz] of spots) {
      mb.boxC(px, pz, 0.34, 0.34, y0, y0 + 0.12, 'stoneB', '副阶柱础');
      mb.cyl(px, pz, 0.16, y0 + 0.12, y0 + colH, 8, r.colMat, '副阶柱');
    }
    const cy = y0 + colH;
    // 额枋：四面各一道，柱头连成圈
    for (const sz of [-1, 1]) {
      GF.beamBetween(mb, [-x, cy - 0.24, sz * z], [x, cy - 0.24, sz * z], 0.22, 0.3, 'woodDark', '副阶额枋');
    }
    for (const sx of [-1, 1]) {
      GF.beamBetween(mb, [sx * x, cy - 0.24, -z], [sx * x, cy - 0.24, z], 0.22, 0.3, 'woodDark', '副阶额枋');
    }
    // 下檐：内檐贴殿身、外檐压柱头，坡短而薄
    const eo = (r.eave || 0.9) * 0.85;
    GF.roofs.skirt(mb, {
      cx: 0, cz: 0,
      x0: -x - eo, x1: x + eo, z0: -z - eo, z1: z + eo,
      xi: W / 2 + 0.12, zi: D / 2 + 0.12,
      yb: cy - 0.02, ytop: cy + 0.5,
      tile: r.tile, tileB: r.tileB, upturn: (r.upturn == null ? 0.3 : r.upturn) * 0.8,
      trim: r.trimMat, windDuo: r.windDuo, tag: '副阶下檐'
    });
    // 檐下一圈挂落，把下檐和柱头之间的空隙填实
    for (const sz of [-1, 1]) {
      GF.beamBetween(mb, [-x + 0.1, cy - 0.5, sz * z], [x - 0.1, cy - 0.5, sz * z], 0.08, 0.24, 'wood', '副阶挂落');
    }
    for (const sx of [-1, 1]) {
      GF.beamBetween(mb, [sx * x, cy - 0.5, -z + 0.1], [sx * x, cy - 0.5, z - 0.1], 0.08, 0.24, 'wood', '副阶挂落');
    }
  }

  /* ------------------------------ 臺基与栏杆 ------------------------------ */
  function base(mb, r, o) {
    const W = o.W, D = o.D, h = r.baseH;
    const x0 = -W / 2 - 0.5, x1 = W / 2 + 0.5, z0 = -D / 2 - 0.5, z1 = D / 2 + 0.5;
    // 水上桩基（临水楼台）：台基四周密排、内部隔一搭一，桩身伸进水里
    if (r.stilts) {
      const pad = 0.75;
      const sx0 = x0 - pad, sx1 = x1 + pad, sz0 = z0 - pad, sz1 = z1 + pad;
      for (let x = sx0; x <= sx1 + 0.01; x += 0.95) {
        for (let z = sz0; z <= sz1 + 0.01; z += 0.95) {
          const edge = x - sx0 < 1.05 || sx1 - x < 1.05 || z - sz0 < 1.05 || sz1 - z < 1.05;
          if (!edge && ((Math.round(x / 0.95) + Math.round(z / 0.95)) % 3 !== 0)) continue;
          mb.cyl(x, z, 0.075, -0.95, 0.03, 5, 'woodDark', '桩基');
        }
      }
    }
    P.platform(mb, {
      x0, x1, z0, z1, h, steps: r.steps, stepW: o.stepW != null ? o.stepW : Math.min(3.2, W * 0.5), stepDir: 'front',
      style: r.pedestal || 'xumizuo', lotus: (r.pedestal || 'xumizuo') === 'xumizuo'
    });
    if (r.railing) {
      const st = r.railStyle || 'marble';
      // 三面栏杆（前留踏跺口）
      P.railing(mb, { a: [x0, z0], b: [x1, z0], y: h, style: st, tag: '栏杆' });
      P.railing(mb, { a: [x0, z0], b: [x0, z1], y: h, style: st, tag: '栏杆' });
      P.railing(mb, { a: [x1, z0], b: [x1, z1], y: h, style: st, tag: '栏杆' });
      P.railing(mb, { a: [x0, z1], b: [-1.4, z1], y: h, style: st, tag: '栏杆' });
      P.railing(mb, { a: [1.4, z1], b: [x1, z1], y: h, style: st, tag: '栏杆' });
    }
    return { x0, x1, z0, z1, h };
  }

  /* ------------------------------ 室内陈设 ------------------------------ */
  function interior(mb, r, o) {
    const items = r.interior || [];
    for (const it of items) {
      P.furniture(mb, it.kind, it.x, it.z, it.s || 1, 0, '陈设·' + it.kind);
    }
  }

  /* ------------------------------ 穴居（半地穴） ------------------------------ */
  // 地面下沉 0.6~1.0m 的袋状 / 圆形竖穴：土壁 + 地面以上矮土垄 + 茅草穹顶，
  // 室内仅火塘与草席；无台基、无踏跺、无格心窗、无斗拱。
  function buildCave(mb, r) {
    const Rp = r.radius || 2.0;
    const pit = Math.max(0.6, Math.min(1.0, r.pitDepth || 0.8));
    const rimH = r.rimH || 0.55;
    const seg = 12;
    const dh = 0.52; // 门洞张角（正面 +z）

    // 环形土墙：内外双面 + 上下 annular 封口，正面留门洞
    const ringWall = (radOut, radIn, y0, y1, mat, tag, skipDoor) => {
      for (let k = 0; k < seg; k++) {
        const a0 = (k / seg) * Math.PI * 2, a1 = ((k + 1) / seg) * Math.PI * 2;
        if (skipDoor) {
          let d = (a0 + a1) / 2 - Math.PI / 2;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          if (Math.abs(d) < dh) continue;
        }
        const po0 = [Math.cos(a0) * radOut, Math.sin(a0) * radOut];
        const po1 = [Math.cos(a1) * radOut, Math.sin(a1) * radOut];
        const pi0 = [Math.cos(a0) * radIn, Math.sin(a0) * radIn];
        const pi1 = [Math.cos(a1) * radIn, Math.sin(a1) * radIn];
        mb.quad([po0[0], y0, po0[1]], [po1[0], y0, po1[1]], [po1[0], y1, po1[1]], [po0[0], y1, po0[1]], mat, tag);
        mb.quad([pi1[0], y0, pi1[1]], [pi0[0], y0, pi0[1]], [pi0[0], y1, pi0[1]], [pi1[0], y1, pi1[1]], mat, tag);
        mb.quad([po0[0], y1, po0[1]], [po1[0], y1, po1[1]], [pi1[0], y1, pi1[1]], [pi0[0], y1, pi0[1]], mat, tag);
        mb.quad([po1[0], y0, po1[1]], [po0[0], y0, po0[1]], [pi0[0], y0, pi0[1]], [pi1[0], y0, pi1[1]], mat, tag);
      }
    };

    // 坑底室内地面（半径压过内壁，不留地板与壁面之间的缝隙）
    const floorPts = [];
    for (let k = 0; k < seg; k++) {
      const a = (k / seg) * Math.PI * 2;
      floorPts.push([Math.cos(a) * (Rp - 0.10), Math.sin(a) * (Rp - 0.10)]);
    }
    mb.prism(floorPts, -pit, -pit + 0.06, 'soil', '穴底');

    // 坑壁（自坑底到地面）+ 地面以上矮土垄，正面留门洞
    ringWall(Rp, Rp - 0.18, -pit, 0, 'soil', '穴壁', true);
    ringWall(Rp, Rp - 0.16, 0, rimH, 'soil', '土垄', true);
    ringWall(Rp + 0.04, Rp - 0.16, rimH, rimH + 0.06, 'soil', '土垄压顶', true);

    // 门洞木骨：两根立柱 + 门楣（柱顶齐土垄压顶，门楣藏进茅草檐口之下；无格心窗、无板门门扇）
    for (const s of [-1, 1]) {
      const a = Math.PI / 2 + s * dh;
      const px = Math.cos(a) * (Rp - 0.05), pz = Math.sin(a) * (Rp - 0.05);
      mb.cyl(px, pz, 0.09, 0, rimH, 8, 'wood', '门洞·木柱');
    }
    {
      const aL = Math.PI / 2 - dh, aR = Math.PI / 2 + dh;
      GF.beamBetween(mb,
        [Math.cos(aL) * (Rp - 0.05), rimH - 0.08, Math.sin(aL) * (Rp - 0.05)],
        [Math.cos(aR) * (Rp - 0.05), rimH - 0.08, Math.sin(aR) * (Rp - 0.05)],
        0.12, 0.16, 'wood', '门洞·门楣');
    }

    // 入口坡道：两级土阶自地面降至坑底，与门洞对齐
    mb.box(-0.7, 0.7, -pit * 0.5, 0, Rp + 0.1, Rp + 0.75, 'soil', '入口·土阶');
    mb.box(-0.7, 0.7, -pit, -pit * 0.5, Rp - 0.35, Rp + 0.1, 'soil', '入口·土阶');

    // 室内：火塘 + 草席（落在坑底标高上）
    const fy = -pit + 0.06;
    mb.boxC(0, 0, 0.9, 0.9, fy, fy + 0.12, 'stoneDark', '火塘·石圈');
    mb.boxC(0, 0, 0.55, 0.55, fy + 0.12, fy + 0.16, 'dark', '火塘·灶心');
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + Math.PI / 4;
      mb.boxC(Math.cos(a) * 0.36, Math.sin(a) * 0.36, 0.18, 0.18, fy + 0.1, fy + 0.26, 'stone', '火塘·石块');
    }
    mb.lathe(0, 0, [[0.02, fy + 0.16], [0.16, fy + 0.24], [0.1, fy + 0.42], [0.02, fy + 0.5]], 6, 'lamp', '火塘·火焰');
    mb.boxC(0.85, -0.7, 1.3, 0.9, fy, fy + 0.06, 'mat', '草席');

    // 茅草穹顶：檐口压在土垄压顶之下 0.04m，不留浮空缝
    ringWall(Rp + 0.24, Rp + 0.08, rimH - 0.1, rimH + 0.04, 'thatchB', '茅草檐口', false);
    mb.lathe(0, 0, [
      [Rp + 0.22, rimH - 0.02],
      [Rp + 0.05, rimH + 0.28],
      [Rp * 0.74, rimH + 0.62],
      [Rp * 0.42, rimH + 0.92],
      [Rp * 0.16, rimH + 1.10],
      [0.03, rimH + 1.16]
    ], 12, 'thatch', '茅草穹顶');
  }

  /* ------------------------------ 殿 / 堂 ------------------------------ */
  function buildHall(mb, r) {
    const bays = r.bays, bayW = r.bayW;
    const W = bays * bayW;
    const D = r.depth;
    const fjh = r.fujie ? (r.fujieR || 1.6) : 0;
    // 台基托底：台基至少盖住檐口的六成投影，避免“屋顶大、脚下空”的头重脚轻
    const overhang = (r.tiers === 2 ? r.eave * 1.15 : r.eave) * 0.62 + 0.35 + (fjh ? fjh + 0.5 : 0);
    const b = base(mb, r, { W: W + overhang * 2, D: D + overhang * 2 });
    const top = body(mb, {
      W, D, baseY: b.h + 0.04, floors: r.floors, floorH: r.floorH, floorHList: r.floorHList,
      bays, wallMat: r.wallMat, colMat: r.colMat, cut: r.cut,
      winW: r.winW, winH: r.winH, winPattern: r.winPattern,
      doorW: r.doorW, doorH: r.doorH, doorStyle: r.doorStyle, doorLeaves: r.doorLeaves,
      eave: r.eave, tile: r.tile, tileB: r.tileB, upturn: r.upturn,
      dougong: r.dougong, dgScale: r.dgScale, dgStyle: r.dgStyle, dgEye: r.dgEye, queti: r.queti
    });
    interior(mb, r, { W, D, bayW });

    // 副阶周匝（殿 / 厅堂）：四周廊柱 + 一层下檐
    if (fjh && !r.cut.roof) {
      hallFujie(mb, r, {
        W, D, bays, fj: fjh,
        y0: b.h + 0.04,
        colH: Math.max(1.9, Math.min(r.floorH * 0.55, r.floorH - 0.6))
      });
    }

    // 天花 / 藻井
    if (r.ceiling && r.ceiling !== 'none') {
      const cy = top.topY - 0.32;
      P.ceiling(mb, { x0: -W / 2 + 0.3, x1: W / 2 - 0.3, z0: -D / 2 + 0.3, z1: D / 2 - 0.3, y: cy });
      if (r.ceiling === 'caisson') {
        P.caisson(mb, 0, 0, cy, Math.min(W * 0.52, 3.4), Math.min(D * 0.5, 3.2));
      }
    }

    const eo = r.eave;
    const rise = r.slope * (D / 2 + eo);
    if (!r.cut.roof) {
      // 重檐：下檐 + 上层身 + 上檐
      if (r.tiers === 2) {
        const eo2 = eo * 1.15;
        // 下檐做成贴在上层身腰部的“副阶腰檐”，只留一层薄檐，别把整面墙盖住
        const yMid = top.topY - r.floorH * 0.55;
        GF.roofs.skirt(mb, {
          cx: 0, cz: 0,
          x0: -W / 2 - eo2, x1: W / 2 + eo2, z0: -D / 2 - eo2, z1: D / 2 + eo2,
          xi: W / 2 - 0.5, zi: D / 2 - 0.5,
          yb: yMid, ytop: yMid + 0.46,
          tile: r.tile, tileB: r.tileB, upturn: r.upturn,
          trim: r.trimMat, windDuo: r.windDuo, tag: '下檐'
        });
        GF.roofs.build(mb, {
          cx: 0, cz: 0, x0: -W / 2 - eo * 0.78, x1: W / 2 + eo * 0.78,
          z0: -D / 2 - eo * 0.78, z1: D / 2 + eo * 0.78,
          yb: top.topY + 0.2, rise: rise * 0.85,
          type: r.roofType === 'cross' ? 'cross'
            : r.roofType === 'lu' ? 'lu'
            : (r.roofType === 'gable' || r.roofType === 'gableHip') ? 'gableHip' : 'hip',
          tile: r.tile, tileB: r.tileB, upturn: r.upturn,
          ridgeStyle: r.ridgeStyle, beasts: r.beasts, finial: r.finial,
          trim: r.trimMat, xuanYu: r.xuanYu, windDuo: r.windDuo,
          gableMat: r.wallMat, tag: '上檐'
        });
      } else {
        GF.roofs.build(mb, {
          cx: 0, cz: 0,
          x0: -W / 2 - eo, x1: W / 2 + eo, z0: -D / 2 - eo, z1: D / 2 + eo,
          yb: top.topY, rise, type: r.roofType,
          tile: r.tile, tileB: r.tileB, upturn: r.upturn,
          ridgeStyle: r.ridgeStyle, beasts: r.beasts, finial: r.finial,
          trim: r.trimMat, xuanYu: r.xuanYu, windDuo: r.windDuo,
          gableMat: r.wallMat, tag: '屋面'
        });
      }
    }

    // 匾额（前檐正中）
    if (r.plaque && !r.cut.front && r.floors === 1) {
      P.plaque(mb, { dir: 'front', at: D / 2 - 0.02, uc: 0, vc: top.topY - 0.85, w: Math.min(2.4, bayW * 0.8), h: 0.62, chars: 3 });
    }
    // 楹联 / 门簪 / 抱鼓石
    if (!r.cut.front) {
      if (r.couplet) {
        P.couplet(mb, {
          dir: 'front', at: D / 2 - 0.01, uc: 0, y0: b.h + 0.5, y1: top.topY - 1.15,
          off: Math.min(2.2, r.doorW / 2 + 0.45)
        });
      }
      if (r.menZan) {
        P.menZan(mb, { dir: 'front', at: D / 2 - 0.01, uc: 0, v: top.topY - 0.45, n: 3, gap: Math.min(0.5, r.doorW * 0.3) });
      }
      if (r.baogu) {
        for (const sx of [-1, 1]) P.baogu(mb, sx * (r.doorW / 2 + 0.4), D / 2 + 0.35, 0.9);
      }
    }
    // 灯笼
    if (r.lanterns) {
      for (const sx of [-1, 1]) {
        P.lantern(mb, sx * (W / 2 - 0.6), top.topY - 0.9, D / 2 + 0.3, 0.9, '灯笼');
      }
    }
    // 石狮
    if (r.lions) {
      for (const sx of [-1, 1]) P.lion(mb, sx * (W / 2 + 0.5), D / 2 + 1.2, 0.9, '石狮');
    }
    // 香炉
    if (r.censer) P.censer(mb, 0, D / 2 + 2.2, 0.9, '香炉');
  }

  /* ------------------------------ 民居 ------------------------------ */
  function buildHouse(mb, r) {
    const W = r.bays * r.bayW;
    const D = r.depth;
    const fjh = r.fujie ? (r.fujieR || 1.6) : 0;
    const b = base(mb, r, { W: W + (r.eave * 0.45 + 0.25 + (fjh ? fjh + 0.5 : 0)) * 2, D: D + (r.eave * 0.45 + 0.25 + (fjh ? fjh + 0.5 : 0)) * 2 });
    const top = body(mb, {
      W, D, baseY: b.h + 0.04, floors: r.floors, floorH: r.floorH, floorHList: r.floorHList,
      bays: r.bays, wallMat: r.wallMat, colMat: r.colMat, colR: r.colR, cut: r.cut,
      winW: r.winW, winH: r.winH, winPattern: r.winPattern,
      doorW: r.doorW, doorH: r.doorH, doorStyle: r.doorStyle, doorLeaves: r.doorLeaves,
      eave: r.eave, tile: r.tile, tileB: r.tileB, upturn: r.upturn,
      dougong: r.dougong, dgScale: r.dgScale, dgStyle: r.dgStyle, dgEye: r.dgEye, queti: r.queti,
      sideWindows: true
    });
    interior(mb, r, { W, D });
    // 副阶周匝（厅堂同理）
    if (fjh && !r.cut.roof) {
      hallFujie(mb, r, {
        W, D, bays: r.bays, fj: fjh,
        y0: b.h + 0.04,
        colH: Math.max(1.8, Math.min(r.floorH * 0.52, r.floorH - 0.6))
      });
    }
    if (r.ceiling && r.ceiling !== 'none') {
      const cy = top.topY - 0.3;
      P.ceiling(mb, { x0: -W / 2 + 0.3, x1: W / 2 - 0.3, z0: -D / 2 + 0.3, z1: D / 2 - 0.3, y: cy });
      if (r.ceiling === 'caisson') P.caisson(mb, 0, 0, cy, Math.min(W * 0.5, 3.0), Math.min(D * 0.5, 2.8));
    }
    if (!r.cut.roof) {
      const eo = r.eave;
      const rise = r.slope * (D / 2 + eo);
      GF.roofs.build(mb, {
        cx: 0, cz: 0,
        x0: -W / 2 - eo, x1: W / 2 + eo, z0: -D / 2 - eo, z1: D / 2 + eo,
        yb: top.topY, rise, type: r.roofType || 'gable',
        tile: r.tile, tileB: r.tileB, upturn: r.upturn * 0.7,
        ridgeStyle: r.ridgeStyle, beasts: r.beasts || 0, finial: !!r.finial,
        trim: r.trimMat, xuanYu: r.xuanYu, windDuo: r.windDuo,
        gableMat: r.wallMat, tag: '屋面'
      });
      // 马头墙
      if (r.horseWall) {
        P.horseHeadWall(mb, {
          cx: 0, z: D / 2 + 0.1, halfLen: W / 2 + 0.5, y0: top.topY - 0.3,
          yTop: top.topY + rise * 0.85, steps: 3, depth: 0.3
        });
        P.horseHeadWall(mb, {
          cx: 0, z: -D / 2 - 0.1, halfLen: W / 2 + 0.5, y0: top.topY - 0.3,
          yTop: top.topY + rise * 0.85, steps: 3, depth: 0.3
        });
      }
    }
    if (r.plaque && !r.cut.front) {
      P.plaque(mb, { dir: 'front', at: D / 2 - 0.02, uc: 0, vc: top.topY - 0.8, w: 1.6, h: 0.5, chars: 2 });
    }
    if (r.lanterns) {
      for (const sx of [-1, 1]) P.lantern(mb, sx * (W / 2 - 0.5), top.topY - 0.9, D / 2 + 0.3, 0.8, '灯笼');
    }
    // 楹联 / 门簪 / 抱鼓石 / 石狮 / 香炉（与殿堂同一套门面构件）
    if (!r.cut.front) {
      if (r.couplet) {
        P.couplet(mb, {
          dir: 'front', at: D / 2 - 0.01, uc: 0, y0: b.h + 0.4, y1: top.topY - 1.1,
          off: Math.min(2.0, r.doorW / 2 + 0.42)
        });
      }
      if (r.menZan) {
        P.menZan(mb, { dir: 'front', at: D / 2 - 0.01, uc: 0, v: top.topY - 0.42, n: 3, gap: Math.min(0.5, r.doorW * 0.3) });
      }
      if (r.baogu) {
        for (const sx of [-1, 1]) P.baogu(mb, sx * (r.doorW / 2 + 0.4), D / 2 + 0.3, 0.8);
      }
    }
    if (r.lions) {
      for (const sx of [-1, 1]) P.lion(mb, sx * (W / 2 + 0.4), D / 2 + 1.1, 0.8, '石狮');
    }
    if (r.censer) P.censer(mb, 0, D / 2 + 2.0, 0.8, '香炉');
  }

  /* ------------------------------ 亭 ------------------------------ */
  function buildPavilion(mb, r) {
    const R = r.radius || 1.9;
    const sides = r.sides || 4;
    // 多边形柱位：让 +z（正前方）正好落在一个面的中点上，台阶 / 开口 / 匾额才对得齐
    const rot = Math.PI / 2 - Math.PI / sides;
    const apothem = R * Math.cos(Math.PI / sides);
    const faceW = 2 * R * Math.sin(Math.PI / sides);
    const b = base(mb, r, {
      W: R * 2 + (r.eave * 0.4 + 0.25) * 2, D: R * 2 + (r.eave * 0.4 + 0.25) * 2,
      stepW: Math.max(1.0, faceW - 0.3)
    });
    const cy = b.h + 0.04;
    const colH = r.floorH;
    // 柱按多边形布置
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2 + rot;
      const cx = Math.cos(a) * R, cz = Math.sin(a) * R;
      mb.boxC(cx, cz, 0.2, 0.2, cy, cy + 0.12, 'stone', '柱础');
      mb.cyl(cx, cz, 0.17, cy + 0.1, cy + colH, 8, r.colMat, '亭柱');
    }
    // 挂落 / 美人靠（正面留开口）
    for (let i = 0; i < sides; i++) {
      const a0 = (i / sides) * Math.PI * 2 + rot;
      const a1 = ((i + 1) / sides) * Math.PI * 2 + rot;
      const p0 = [Math.cos(a0) * R, Math.sin(a0) * R];
      const p1 = [Math.cos(a1) * R, Math.sin(a1) * R];
      if (i === 0) continue; // 正面开口
      GF.beamBetween(mb, [p0[0], cy + colH - 0.45, p0[1]], [p1[0], cy + colH - 0.45, p1[1]], 0.08, 0.34, 'wood', '挂落');
      // 三面坐槛：美人靠 / 寻杖栏杆 / 石栏
      const railStyle = r.railStyle || 'beauty';
      if (railStyle === 'marble') {
        P.railing(mb, { a: [p0[0], p0[1]], b: [p1[0], p1[1]], y: cy + 0.05, style: 'marble', tag: '亭栏' });
      } else {
        GF.beamBetween(mb, [p0[0], cy + 0.55, p0[1]], [p1[0], cy + 0.55, p1[1]], 0.07, 0.1, 'wood', '美人靠');
        GF.beamBetween(mb, [p0[0], cy + 0.55, p0[1]], [p1[0], cy + 0.55, p1[1]], 0.3, 0.06, 'wood', '坐板');
        const nPost = railStyle === 'beauty' ? 4 : 3;
        for (let k = 1; k < nPost; k++) {
          const t = k / nPost;
          const x = V.lerp(p0[0], p1[0], t), z = V.lerp(p0[1], p1[1], t);
          mb.boxC(x, z, 0.05, 0.05, cy + 0.55, cy + colH - 0.45, 'wood', '靠背');
        }
      }
    }
    // 攒尖屋顶
    if (!r.cut.roof) {
      GF.roofs.build(mb, {
        cx: 0, cz: 0, xe: R + r.eave, ze: R + r.eave, yb: cy + colH,
        rise: r.slope * (R + r.eave) * 1.5, type: 'pyramid', sides,
        rot, tile: r.tile, tileB: r.tileB,
        upturn: (r.upturn === undefined ? 0.55 : r.upturn),
        ridgeStyle: r.ridgeStyle || 'none', finial: (r.finial === undefined ? true : !!r.finial),
        trim: r.trimMat, windDuo: r.windDuo, tag: '攒尖顶'
      });
    }
    // 匾额：挂正面（+z 那个面）的枋心，宽度按该面宽收
    if (r.plaque) P.plaque(mb, { dir: 'front', at: apothem + 0.02, uc: 0, vc: cy + colH - 0.5, w: Math.min(1.2, faceW - 0.4), h: 0.42, chars: 2 });
    // 灯笼（正面檐下两角，带吊索）
    if (r.lanterns) {
      for (const sx of [-1, 1]) {
        const lx = sx * faceW * 0.34, lz = apothem + 0.06;
        mb.boxC(lx, lz, 0.03, 0.03, cy + colH - 0.42, cy + colH - 0.05, 'wood', '灯索');
        P.lantern(mb, lx, cy + colH - 1.05, lz, 0.72, '灯笼');
      }
    }
    // 石桌石凳
    if (r.table) {
      P.furniture(mb, 'stool', 0.9, -0.6, 1, 0, '石凳');
      P.furniture(mb, 'stool', -0.9, -0.6, 1, 0, '石凳');
      mb.boxC(0, -0.6, 1.1, 1.1, cy, cy + 0.7, 'stone', '石桌');
      mb.boxC(0, -0.6, 1.2, 1.2, cy + 0.7, cy + 0.76, 'marble', '石桌面');
    }
  }

  /* ------------------------------ 塔 ------------------------------ */
  function buildPagoda(mb, r) {
    const tiers = r.tiers || 5;
    const sides = 8;
    const baseR = r.radius || 2.6;
    // 副阶周匝：底层一圈围廊，台基必须再放大一圈，否则围廊柱站得比台明还外
    const fj = r.fujie ? (r.fujieR || 1.6) : 0;
    // 塔台放大到能托住底层出檐，视觉重心才落得下去
    const pad = (r.eave || 0.75) * 0.85 + 0.4 + (fj ? fj + 0.55 : 0);
    const b = base(mb, r, { W: baseR * 2 + pad * 2, D: baseR * 2 + pad * 2 });
    let y = b.h + 0.04;
    const tierH = r.floorH;
    let topR = baseR;
    mb.schedule = [];
    // 第 i 层塔身半径（逐层收分按 shrinkList 连乘，否则 0.86 连乘）
    const tierR = (i) => {
      if (Array.isArray(r.shrinkList) && r.shrinkList.length) {
        let acc = 1;
        for (let k = 0; k < i; k++) acc *= (r.shrinkList[k] || 0.86);
        return baseR * acc;
      }
      return baseR * Math.pow(0.86, i);
    };
    for (let i = 0; i < tiers; i++) {
      const tierHi = (Array.isArray(r.floorHList) && r.floorHList[i]) || tierH;
      const rT = tierR(i);
      const rot = Math.PI / 8;
      topR = rT;
      // 塔身
      const pts = [];
      for (let k = 0; k < sides; k++) {
        const a = (k / sides) * Math.PI * 2 + rot;
        pts.push([Math.cos(a) * rT, Math.sin(a) * rT]);
      }
      mb.prism(pts, y, y + tierHi, i % 2 ? 'brick' : 'plaster', '塔身');
      // 每层楼板：塔身内一层面板，剖切或俯视时不是一根空心筒子
      const floorPts = [];
      for (let k = 0; k < sides; k++) {
        const a = (k / sides) * Math.PI * 2 + rot;
        floorPts.push([Math.cos(a) * (rT - 0.2), Math.sin(a) * (rT - 0.2)]);
      }
      mb.prism(floorPts, y + 0.02, y + 0.16, 'wood', '塔楼板');
      // 四面开窗（贴面片：直接贴在八角形的一个侧面上，不再用方块戳出塔身）
      for (const k of [0, 2, 4, 6]) {
        const a0 = (k / sides) * Math.PI * 2 + rot;
        const a1 = ((k + 1) / sides) * Math.PI * 2 + rot;
        const fr = rT + 0.012, fr2 = rT + 0.02;
        const winQuad = (t0, t1, y0, y1, rad, mat, tg) => {
          const p = (t, y) => {
            const x0 = Math.cos(a0) * rad, z0 = Math.sin(a0) * rad;
            const x1 = Math.cos(a1) * rad, z1 = Math.sin(a1) * rad;
            return [x0 + (x1 - x0) * t, y, z0 + (z1 - z0) * t];
          };
          mb.quad(p(t0, y0), p(t1, y0), p(t1, y1), p(t0, y1), mat, tg);
        };
        const wy0 = y + tierHi * 0.42, wy1 = y + tierHi * 0.8;
        winQuad(0.22, 0.78, wy0 - 0.12, wy1 + 0.12, fr, 'wood', '塔窗·框');
        winQuad(0.28, 0.72, wy0, wy1, fr2, 'dark', '塔窗');
      }
      // 每层檐
      let stepY = tierHi + 0.35;
      let eaveH = 0;
      let pzY = null;
      if (!r.cut.roof) {
        // 逐层出檐：给了 eaveList 就按层取值，否则沿用统一出檐
        const ev = (Array.isArray(r.eaveList) && r.eaveList[i] != null) ? r.eaveList[i] : r.eave;
        // 出檐随塔身收分一起收，避免上层的檐比下层还宽
        const kEave = 0.62 + 0.38 * (rT / baseR);
        const rOut = rT + ev * kEave;
        // 檐内沿要收到上一层塔身里（不能留出一圈缝），否则从上往下能看穿每层檐
        const rIn = Math.max(0.06, tierR(Math.min(tiers - 1, i + 1)) - 0.06);
        const eaveH0 = (0.55 + (r.slope || 0.5) * 0.72) * (0.8 + 0.2 * kEave);
        eaveH = eaveH0;
        const up = r.upturn == null ? 0.3 : r.upturn;
        // 逐层斗拱铺作：0=无，1≈一斗三升，2≈五踩，3≈七踩（出跳越深、斗越大）
        const dgLv = (Array.isArray(r.dgList) && r.dgList[i]) || 0;
        if (dgLv > 0) {
          // 斗拱贴在檐口下沿（檐底最外一圈），从俯视角度才看得见这一圈
          const rEdge = rOut - 0.2;
          const dgY0 = y + tierHi - 0.12, dgY1 = y + tierHi + 0.06;
          const dep = 0.14 + 0.07 * dgLv;
          for (let k = 0; k < sides; k++) {
            for (const u of [0.2, 0.5, 0.8]) {
              const a = ((k + u) / sides) * Math.PI * 2 + rot;
              const dx = Math.cos(a), dz = Math.sin(a);
              mb.boxC(dx * rEdge, dz * rEdge, 0.18, 0.18, dgY0, dgY1, 'woodDark', '斗拱·斗');
              GF.beamBetween(mb,
                [dx * (rEdge - dep), dgY1 - 0.08, dz * (rEdge - dep)],
                [dx * (rEdge + 0.02), dgY1 - 0.08, dz * (rEdge + 0.02)],
                0.24, 0.12, 'woodDark', '斗拱·栱');
            }
          }
        }
        polyRing(mb, 0, 0, rOut, rIn, sides, y + tierHi, y + tierHi + eaveH, r.tile, r.tileB, '塔檐', rot);
        // 檐口连檐：一道深色瓦口压住檐外沿，檐口不是一条薄薄的悬空线
        polyRing(mb, 0, 0, rOut, rOut - 0.16, sides, y + tierHi - 0.18, y + tierHi - 0.02, 'tileEnd', 'tileEnd', '塔檐连檐', rot);
        // 檐角起翘：小翘角从檐口边缘长出来，别悬在半空当碎点
        for (let k = 0; k < sides; k++) {
          const a = (k / sides) * Math.PI * 2 + rot;
          mb.boxC(Math.cos(a) * rOut, Math.sin(a) * rOut, 0.14, 0.14,
            y + tierHi - 0.08, y + tierHi + 0.1 + up * 0.45, 'tileEnd', '檐角');
        }
        // 平座：檐上一层挑出的坐凳栏杆，楼阁式塔的竖向节奏就靠它
        if (i < tiers - 1 && r.pingzuo) {
          // 平座宽度对齐檐口（原来只比塔身宽 0.5，压在大出檐下面，俯视只剩一条窄边，看着像透空）
          const pz = rOut - 0.4;
          const yy = y + tierHi + eaveH;
          pzY = yy;
          const pm = r.pingzuoStyle === 'marble' ? ['marble', 'marbleB'] : ['wood', 'woodDark'];
          polyRing(mb, 0, 0, pz + 0.06, pz - 0.3, sides, yy, yy + 0.1, pm[0], pm[1], '平座', rot);
          // 平座铺板：整片盖到塔身脚下，别只画一圈环形平台，否则一层层都透空
          const deckPts = [];
          for (let k = 0; k < sides; k++) {
            const a = (k / sides) * Math.PI * 2 + rot;
            deckPts.push([Math.cos(a) * (pz + 0.04), Math.sin(a) * (pz + 0.04)]);
          }
          mb.prism(deckPts, yy - 0.26, yy + 0.06, pm[0], '平座铺板');
          // 平座挑出的支撑斗，压在檐上，别让整圈平台凭空悬着
          for (let k = 0; k < sides; k++) {
            const a = (k / sides) * Math.PI * 2 + rot;
            mb.boxC(Math.cos(a) * (pz - 0.28), Math.sin(a) * (pz - 0.28), 0.22, 0.22,
              yy - 0.42, yy - 0.02, 'woodDark', '平座·撑斗');
          }
          // 地栿 + 坐凳楣子 + 寻杖，三段连着做，栏杆底部与中段都不透空
          polyRing(mb, 0, 0, pz, pz - 0.16, sides, yy + 0.1, yy + 0.2, pm[1], pm[1], '平座地栿', rot);
          polyRing(mb, 0, 0, pz - 0.02, pz - 0.1, sides, yy + 0.2, yy + 0.48, pm[1], pm[1], '平座楣子', rot);
          polyRing(mb, 0, 0, pz, pz - 0.14, sides, yy + 0.5, yy + 0.58, pm[1], pm[1], '平座寻杖', rot);
          for (let k = 0; k < sides; k++) {
            const a0 = (k / sides) * Math.PI * 2 + rot;
            mb.boxC(Math.cos(a0) * (pz - 0.06), Math.sin(a0) * (pz - 0.06), 0.1, 0.1, yy + 0.1, yy + 0.52, pm[1], '平座望柱');
          }
          // 上层塔身直接坐在平座面上，别再留一道断缝
          stepY = tierHi + eaveH + 0.14;
        }
      }
      y += stepY;
      mb.schedule.push({
        floor: i + 1, baseY: y - stepY, colTop: y - stepY + tierHi,
        eaveBottom: y - stepY + tierHi, eaveH,
        pingzuo: pzY, nextBase: y, roofEave: null,
        gapEaveCol: 0, gapPingzuoBody: pzY == null ? null : y - pzY
      });
    }
    // 副阶周匝：底层一圈围廊（应县木塔最显眼的那一圈）
    if (fj && !r.cut.roof) {
      const rotF = Math.PI / 8;
      const y0 = b.h + 0.04;
      const colR = baseR + fj;
      const colH = Math.max(1.6, Math.min(tierH * 0.68, tierH - 1.0));
      // 柱：每面两根，柱础落在台明上
      for (let k = 0; k < sides; k++) {
        for (const u of [0.34, 0.66]) {
          const a = ((k + u) / sides) * Math.PI * 2 + rotF;
          const px = Math.cos(a) * colR, pz = Math.sin(a) * colR;
          mb.boxC(px, pz, 0.32, 0.32, y0, y0 + 0.12, 'stoneB', '副阶柱础');
          mb.cyl(px, pz, 0.15, y0 + 0.12, y0 + colH, 8, r.colMat, '副阶柱');
        }
      }
      // 额枋：一圈通长木环，柱头连成整体
      polyRing(mb, 0, 0, colR + 0.08, colR - 0.32, sides, y0 + colH - 0.26, y0 + colH - 0.08, 'woodDark', 'woodDark', '副阶额枋', rotF);
      // 围廊屋面：内檐贴第一层塔身、外檐压住柱头
      polyRing(mb, 0, 0, colR + 0.66, baseR + 0.04, sides, y0 + colH - 0.02, y0 + colH + 0.66, r.tile, r.tileB, '副阶屋面', rotF);
      // 檐口连檐：一道木环托住瓦口，檐口不悬空
      polyRing(mb, 0, 0, colR + 0.7, colR + 0.52, sides, y0 + colH - 0.2, y0 + colH - 0.02, 'woodDark', 'woodDark', '副阶连檐', rotF);
      for (let k = 0; k < sides; k++) {
        const a = (k / sides) * Math.PI * 2 + rotF;
        mb.boxC(Math.cos(a) * (colR + 0.66), Math.sin(a) * (colR + 0.66), 0.14, 0.14,
          y0 + colH - 0.18, y0 + colH + 0.12, 'tileEnd', '副阶檐角');
      }
    }

    // 塔刹
    if (!r.cut.roof) {
      const rTop = topR + 0.35;
      GF.roofs.build(mb, {
        cx: 0, cz: 0, xe: rTop, ze: rTop, yb: y, rise: rTop * 1.1,
        type: 'pyramid', sides, rot: Math.PI / 8,
        tile: r.tile, tileB: r.tileB,
        upturn: (r.upturn == null ? 0.5 : r.upturn),
        ridgeStyle: 'none', finial: false, tag: '塔顶'
      });
      if (r.finial !== false) {
        mb.lathe(0, 0, [[0.05, y + 1.2], [0.3, y + 1.3], [0.22, y + 1.7], [0.44, y + 1.9], [0.3, y + 2.4], [0.12, y + 2.9], [0, y + 3.2]], 8, 'gold', '塔刹');
      }
    }
  }

  // 多边形环形檐（塔檐/圆攒尖檐）
  function polyRing(mb, cx, cz, rOut, rIn, sides, yb, ytop, tile, tileB, tag, rot) {
    const rings = 3;
    const rows = [];
    for (let j = 0; j <= rings; j++) {
      const s = j / rings;
      const rr = V.lerp(rOut, rIn, s);
      const y = yb + (ytop - yb) * Math.pow(s, 1.2);
      const row = [];
      for (let i = 0; i <= sides; i++) {
        const a = (i / sides) * Math.PI * 2 + rot;
        row.push([cx + Math.cos(a) * rr, y, cz + Math.sin(a) * rr]);
      }
      rows.push(row);
    }
    for (let j = 0; j < rings; j++) {
      for (let i = 0; i < sides; i++) {
        const mat = i % 2 ? tileB : tile;
        mb.quad(rows[j][i], rows[j][i + 1], rows[j + 1][i + 1], rows[j + 1][i], mat, tag);
      }
    }
  }

  /* ------------------------------ 牌坊 ------------------------------ */
  function buildArchway(mb, r) {
    const bw = r.bayW, bays = 3;
    const H = r.floorH + 1.0;
    const D = 1.0;
    // 台明：一条薄石台把四柱落位托住，避免柱子直接插在空地上显“脚细”
    mb.box(-bays / 2 * bw - 0.85, bays / 2 * bw + 0.85, 0, 0.16, -D / 2 - 0.7, D / 2 + 0.7, 'stoneB', '牌坊台明');
    // 夹杆石 + 柱
    for (let i = 0; i <= bays; i++) {
      const x = (i - bays / 2) * bw;
      for (const sz of [-1, 1]) {
        const z = sz * D / 2;
        mb.boxC(x, z, 0.56, 0.56, 0.1, 0.56, 'stone', '夹杆石');
        mb.boxC(x, z, 0.4, 0.4, 0.1, 1.0, 'stoneDark', '夹杆石');
        mb.cyl(x, z, 0.26, 0, H, 8, r.colMat, '牌坊柱');
      }
    }
    // 额枋
    for (let i = 0; i < bays; i++) {
      const cx = (i - bays / 2 + 0.5) * bw;
      const w = bw - 0.2;
      for (const sz of [-1, 1]) {
        const at = sz * D / 2;
        P.lintel(mb, { dir: sz > 0 ? 'front' : 'back', at, uc: cx, w, y: H - 0.75, h: 0.38, th: 0.24, seg: 4, tag: '牌坊额枋' });
        P.lintel(mb, { dir: sz > 0 ? 'front' : 'back', at, uc: cx, w, y: H - 1.5, h: 0.3, th: 0.2, seg: 3, tag: '牌坊下枋' });
      }
    }
    // 匾额（明间）
    if (r.plaque) {
      P.plaque(mb, { dir: 'front', at: D / 2 + 0.06, uc: 0, vc: H - 0.35, w: bw * 0.8, h: 0.5, chars: 3 });
    }
    // 每间小屋顶
    if (!r.cut.roof) {
      for (let i = 0; i < bays; i++) {
        const cx = (i - bays / 2 + 0.5) * bw;
        const wHalf = bw / 2 + 0.35;
        const isMid = i === 1;
        const rise = isMid ? 0.9 : 0.65;
        // 用庑殿小顶
        GF.roofs.build(mb, {
          cx, cz: 0, x0: cx - wHalf, x1: cx + wHalf, z0: -D / 2 - 0.5, z1: D / 2 + 0.5,
          yb: H + (isMid ? 0.1 : -0.3), rise: rise, type: 'hip',
          tile: r.tile, tileB: r.tileB, upturn: 0.3, ridgeStyle: isMid ? 'ornate' : 'plain',
          beasts: 0, finial: false, tag: '牌坊顶'
        });
      }
    }
  }

  /* ------------------------------ 城门楼 ------------------------------ */
  /* ------------------------------ 城台 + 券洞（城门楼 / 城关式楼阁复用） ------------------------------ */
  // o: W, D, wallH, gateW, gateH, closed(是否装门扇/门钉)
  function buildTerrace(mb, r, o) {
    const W = o.W, D = o.D, wallH = o.wallH;
    const gateW = o.gateW, gateH = o.gateH;
    const closed = o.closed !== false;
    // 城台：下部石脚 → 砖身 → 压顶条石，三层收分更接近真实城墙
    mb.box(-W / 2 - 0.25, -gateW / 2 - 0.1, 0, 0.9, -D / 2 - 1.4, D / 2 + 1.4, 'stone', '城台石脚');
    mb.box(gateW / 2 + 0.1, W / 2 + 0.25, 0, 0.9, -D / 2 - 1.4, D / 2 + 1.4, 'stone', '城台石脚');
    mb.box(-W / 2, W / 2, 0.9, wallH - 0.22, -D / 2 - 1.2, D / 2 + 1.2, 'brick', '城台');
    mb.box(-W / 2 - 0.18, W / 2 + 0.18, wallH - 0.22, wallH, -D / 2 - 1.32, D / 2 + 1.32, 'stoneB', '城台压顶');
    // 城台顶面铺装：0.06 厚的一层石面，压住压顶与垛脚共面的地方（否则斜看会出现一层“花”的矩形）
    mb.box(-W / 2 - 0.15, W / 2 + 0.15, wallH, wallH + 0.06, -D / 2 - 1.29, D / 2 + 1.29, 'slab', '城台铺装');
    // 城台砖缝：横向皮条线，让大面青砖不至于糊成一整块
    for (let y = 1.5; y < wallH - 0.45; y += 0.85) {
      mb.box(-W / 2 + 0.1, W / 2 - 0.1, y, y + 0.045, D / 2 + 1.16, D / 2 + 1.24, 'brickB', '城台砖缝');
      mb.box(-W / 2 + 0.1, W / 2 - 0.1, y, y + 0.045, -D / 2 - 1.24, -D / 2 - 1.16, 'brickB', '城台砖缝');
    }
    // 城门洞：用列柱式挖洞
    const nx = 14;
    for (let i = 0; i < nx; i++) {
      const x0 = -W / 2 + (W * i) / nx;
      const x1 = -W / 2 + (W * (i + 1)) / nx;
      // 计算该列拱高
      const cxm = (x0 + x1) / 2;
      let hTop = wallH;
      if (Math.abs(cxm) < gateW / 2 + 0.2) {
        const t = Math.min(1, Math.abs(cxm) / (gateW / 2));
        hTop = gateH - Math.sqrt(Math.max(0, 1 - t * t)) * (gateW / 2) * 0.9;
      }
      if (hTop > 0.3) {
        mb.box(x0, x1, hTop, wallH, -D / 2 - 1.2, D / 2 + 1.2, 'brick', '城台');
      }
    }
    // 门洞内的暗面（隧道）
    mb.box(-gateW / 2 - 0.1, gateW / 2 + 0.1, 0, gateH * 0.95, -D / 2 - 1.0, D / 2 + 1.0, 'dark', '门洞');
    // 券脸石：沿门洞拱圈排一圈石券，两面对称
    const archR = gateW / 2 + 0.12;
    const archCy = gateH * 0.4;
    for (const sz of [-1, 1]) {
      const zf = sz * (D / 2 + 1.2);
      for (let k = 0; k <= 9; k++) {
        const a = Math.PI * (0.06 + 0.88 * k / 9);
        const px = Math.cos(a) * archR, py = archCy + Math.sin(a) * archR * 0.78;
        mb.boxC(px, zf + sz * 0.17, 0.3, 0.16, py - 0.18, py + 0.18, 'stoneB', '券脸石');
      }
      // 券脚（起拱石）
      mb.boxC(-archR, zf + sz * 0.17, 0.36, 0.18, archCy - 0.6, archCy - 0.1, 'stone', '券脚');
      mb.boxC(archR, zf + sz * 0.17, 0.36, 0.18, archCy - 0.6, archCy - 0.1, 'stone', '券脚');
    }
    if (closed) {
      // 城门板：两扇实木门 + 门框 + 门钉（钉距按门扇实际尺寸排，转视角不再糊成栅格）
      for (const sz of [-1, 1]) {
        const z = sz * (D / 2 + 1.11);
        const zt = z + sz * 0.1;
        // 门框：抱框 + 上槛
        mb.box(-gateW / 2 - 0.06, -gateW / 2 + 0.06, 0.1, gateH * 0.8, z, zt, 'woodDark', '门框');
        mb.box(gateW / 2 - 0.06, gateW / 2 + 0.06, 0.1, gateH * 0.8, z, zt, 'woodDark', '门框');
        mb.box(-gateW / 2 - 0.1, gateW / 2 + 0.1, gateH * 0.76, gateH * 0.82, z, zt, 'woodDark', '门上槛');
        // 两扇门板
        mb.box(-gateW / 2 + 0.06, -0.03, 0.1, gateH * 0.76, z, zt, 'zhu', '城门');
        mb.box(0.03, gateW / 2 - 0.06, 0.1, gateH * 0.76, z, zt, 'zhu', '城门');
        // 中缝
        mb.box(-0.03, 0.03, 0.1, gateH * 0.76, z, z + sz * 0.12, 'woodDark', '门缝');
        // 门钉：每扇 3 列 4 行，钉径按门宽比例给足，避免亚像素糊成网格
        const leafW = gateW / 2 - 0.14;
        const studR = 0.055;
        for (const s of [-1, 1]) {
          const uc = s * (gateW / 4);
          for (let c = 0; c < 4; c++) {
            for (let rr = 0; rr < 6; rr++) {
              const u = uc + (c - 1.5) * (leafW / 4.6);
              const v = 0.45 + rr * (gateH * 0.76 - 0.9) / 5;
              mb.boxC(u, z + sz * 0.05, studR * 2, studR * 1.2, v, v + studR * 2, 'gold', '门钉');
            }
          }
          // 铺首衔环
          const hy = gateH * 0.42;
          mb.boxC(uc, z + sz * 0.06, 0.26, 0.26, hy - 0.12, hy + 0.12, 'gold', '铺首');
        }
        // 门槛
        mb.box(-gateW / 2, gateW / 2, 0.02, 0.16, z - 0.02, z + sz * 0.22, 'stone', '门槛');
      }
    }
    // 城垛 + 垛上望孔
    const n = Math.round(W / 1.1);
    for (let i = 0; i <= n; i++) {
      const x = -W / 2 + (W * i) / n;
      for (const sz of [-1, 1]) {
        mb.boxC(x, sz * (D / 2 + 1.0), 0.5, 1.0, wallH + 0.08, wallH + 0.92, 'brick', '城垛');
        mb.boxC(x, sz * (D / 2 + 1.56), 0.16, 0.06, wallH + 0.36, wallH + 0.68, 'dark', '望孔');
      }
    }
    return { wallH, topY: wallH + 0.06 };
  }

  function buildGate(mb, r) {
    const W = r.width || 9, D = r.depthTower || 5;
    const wallH = r.wallH || 5.2;
    const gateW = r.gateW || 3.2, gateH = r.gateH || 4.2;
    buildTerrace(mb, r, { W, D, wallH, gateW, gateH, closed: true });
    // 城台上的楼
    const W2 = W * 0.78, D2 = D * 0.7;
    const b2 = { h: wallH + 0.2 };
    const top = body(mb, {
      W: W2, D: D2, baseY: wallH + 0.05, floors: 1, floorH: r.floorH,
      bays: 3, wallMat: r.wallMat, colMat: r.colMat, cut: r.cut,
      winW: r.winW, winH: r.winH, winPattern: r.winPattern,
      doorW: r.doorW, doorH: r.doorH, doorStyle: r.doorStyle,
      eave: r.eave, tile: r.tile, tileB: r.tileB, upturn: r.upturn,
      dougong: true, dgScale: 0.85, queti: true
    });
    if (!r.cut.roof) {
      GF.roofs.build(mb, {
        cx: 0, cz: 0,
        x0: -W2 / 2 - r.eave, x1: W2 / 2 + r.eave,
        z0: -D2 / 2 - r.eave, z1: D2 / 2 + r.eave,
        yb: top.topY, rise: r.slope * (D2 / 2 + r.eave) * 1.1, type: 'gableHip',
        tile: r.tile, tileB: r.tileB, upturn: r.upturn,
        ridgeStyle: 'ornate', beasts: 2, finial: false, tag: '城楼顶'
      });
    }
    if (r.plaque) P.plaque(mb, { dir: 'front', at: D2 / 2 - 0.02, uc: 0, vc: top.topY - 0.9, w: 2.2, h: 0.6, chars: 4 });
  }

  /* --------------------------- 游廊（可旋转） --------------------------- */
  function corridorMesh(r, L, Wd, y0, opts) {
    opts = opts || {};
    const m = new GF.Mesh();
    const n = opts.plain ? Math.max(2, Math.round(L / 2.8)) : Math.max(2, Math.round(L / 1.8));
    for (let i = 0; i <= n; i++) {
      const x = -L / 2 + (L * i) / n;
      for (const sz of [-1, 1]) {
        m.cyl(x, sz * (Wd / 2 - 0.16), 0.13, y0, y0 + 2.5, 8, r.colMat, '廊柱');
        m.boxC(x, sz * (Wd / 2 - 0.16), 0.2, 0.2, y0, y0 + 0.1, 'stone', '柱础');
      }
      GF.beamBetween(m, [x, y0 + 2.05, -Wd / 2 + 0.16], [x, y0 + 2.05, Wd / 2 - 0.16], 0.06, 0.18, 'wood', '挂落');
    }
    GF.beamBetween(m, [-L / 2, y0 + 2.45, -Wd / 2 + 0.16], [L / 2, y0 + 2.45, -Wd / 2 + 0.16], 0.1, 0.2, 'wood', '廊梁');
    GF.beamBetween(m, [-L / 2, y0 + 2.45, Wd / 2 - 0.16], [L / 2, y0 + 2.45, Wd / 2 - 0.16], 0.1, 0.2, 'wood', '廊梁');
    // 卷棚顶
    GF.roofs.build(m, {
      cx: 0, cz: 0, x0: -L / 2 - 0.2, x1: L / 2 + 0.2,
      z0: -Wd / 2 - 0.3, z1: Wd / 2 + 0.3,
      yb: y0 + 2.55, rise: 0.55, type: 'gable',
      tile: r.tile, tileB: r.tileB, upturn: 0.12, plain: opts.plain,
      ridgeStyle: 'none', beasts: 0,
      gableMat: 'wood', tag: '廊顶'
    });
    return m;
  }

  /* --------------------------- 单栋房屋（可平移/旋转） --------------------------- */
  function houseUnit(r, o) {
    const m = new GF.Mesh();
    const W = o.W, D = o.D;
    const b = base(m, r, { W, D });
    const top = body(m, {
      W, D, baseY: b.h + 0.04, floors: o.floors || 1, floorH: r.floorH, floorHList: o.floorHList,
      bays: o.bays || 3, wallMat: r.wallMat, colMat: r.colMat, cut: o.cut || {},
      winW: r.winW, winH: r.winH, winPattern: r.winPattern,
      doorW: r.doorW, doorH: r.doorH, doorStyle: r.doorStyle, doorLeaves: r.doorLeaves,
      eave: r.eave, tile: r.tile, tileB: r.tileB, upturn: r.upturn,
      dougong: false, queti: false, sideWindows: false, cheap: o.cheap
    });
    // 前廊（檐廊柱）
    const eo = o.eave || r.eave;
    if (o.veranda) {
      const vz = D / 2 + eo * 0.78;
      for (let i = 0; i <= (o.bays || 3); i++) {
        const x = -W / 2 + (W * i) / (o.bays || 3);
        m.cyl(x, vz, 0.16, b.h + 0.04, top.topY - 0.32, 8, r.colMat, '廊柱');
        m.boxC(x, vz, 0.26, 0.26, b.h + 0.04, b.h + 0.17, 'stone', '柱础');
      }
      GF.beamBetween(m, [-W / 2, top.topY - 0.42, vz], [W / 2, top.topY - 0.42, vz], 0.14, 0.26, 'wood', '檐枋');
      GF.beamBetween(m, [-W / 2, top.topY - 0.7, vz], [W / 2, top.topY - 0.7, vz], 0.06, 0.16, 'wood', '挂落');
    }
    // 室内隔断（碧纱橱）
    if (o.partition != null) {
      P.partition(m, {
        dir: 'front', at: o.partition,
        u0: -W / 2 + 0.6, u1: W / 2 - 0.6,
        v0: b.h + 0.06, v1: b.h + r.floorH - 0.3,
        style: 'screen', open: o.openW || 1.8, pattern: r.winPattern, tag: '碧纱橱'
      });
    }
    (o.interior || []).forEach((it) => {
      P.furniture(m, it.kind, it.x, it.z, it.s || 1, 0, '陈设·' + it.kind);
    });
    if (!o.noRoof && !(o.cut || r.cut).roof) {
      GF.roofs.build(m, {
        cx: 0, cz: 0,
        x0: -W / 2 - eo, x1: W / 2 + eo,
        z0: -D / 2 - eo, z1: D / 2 + eo,
        yb: top.topY, rise: r.slope * (D / 2 + eo),
        type: o.roofType || 'gable',
        tile: r.tile, tileB: r.tileB, upturn: r.upturn * 0.8,
        plain: o.plain || o.cheap,
        ridgeStyle: 'plain', beasts: 0, gableMat: r.wallMat, tag: '屋面'
      });
      if (o.horseWall) {
        P.horseHeadWall(m, { cx: 0, z: D / 2 + 0.1, halfLen: W / 2 + 0.4, y0: top.topY - 0.3, yTop: top.topY + r.slope * (D / 2 + r.eave) * 0.8, steps: 3, depth: 0.3 });
        P.horseHeadWall(m, { cx: 0, z: -D / 2 - 0.1, halfLen: W / 2 + 0.4, y0: top.topY - 0.3, yTop: top.topY + r.slope * (D / 2 + r.eave) * 0.8, steps: 3, depth: 0.3 });
      }
    }
    if (o.plaque) {
      P.plaque(m, { dir: 'front', at: D / 2 - 0.02, uc: 0, vc: top.topY - 0.85, w: Math.min(2.2, W / 3), h: 0.52, chars: o.chars || 3 });
    }
    return { mesh: m, topY: top.topY, baseH: b.h };
  }

  /* ------------------------------ 宅院（院落） ------------------------------ */
  function buildCourtyard(mb, r) {
    const CW = r.courtW || 20, CD = r.courtD || 18;
    const wallH = 3.0;
    const style = r.courtStyle || 'siheyuan';
    // 院墙（前檐正中开门；园林用月洞门，墙上开漏窗）
    P.courtWall(mb, {
      x0: -CW / 2, x1: CW / 2, z0: -CD / 2, z1: CD / 2, y: wallH,
      gate: { side: 'front', w: style === 'garden' ? 2.4 : 2.6, h: 2.7, shape: style === 'garden' ? 'round' : 'rect' },
      windows: style === 'garden'
        ? [{ dir: 'right', u: 1.6, v: 1.5 }, { dir: 'left', u: 1.6, v: 1.5 }, { dir: 'right', u: -3.0, v: 1.5 }]
        : null,
      windowPattern: r.winPattern
    });
    const ctx = { CW, CD, wallH };
    if (style === 'garden') return courtyardGarden(mb, r, ctx);
    if (style === 'temple') return courtyardTemple(mb, r, ctx);
    // ---- 阶段④ 布局类新路径（不动既有 temple / siheyuan / garden 三条）----
    if (style === 'temple5') return courtyardTemple5(mb, r, ctx);
    if (style === 'daoguan') return courtyardDao(mb, r, ctx);
    if (style === 'wujin') return courtyardWujin(mb, r, ctx);
    if (style === 'langyuan') return courtyardLangyuan(mb, r, ctx);
    if (style === 'jiafu') return courtyardJiafu(mb, r, ctx);
    return courtyardHouse(mb, r, ctx);
  }

  /* ============================ 阶段④ 布局共用 ============================ */
  function layStats(mb) {
    if (!mb.layoutStats) mb.layoutStats = { axis: [], flanks: [], walls: [], corners: [], segs: [] };
    return mb.layoutStats;
  }
  // 轴上单体：rr 可覆盖 baseH / dougong 等；记录轴线核查数据
  function axisUnit(mb, r, o) {
    const rr = Object.assign({}, r, { railing: false }, o.r || {});
    if (r.axisRaise === false && o.statBaseH == null) rr.baseH = r.baseH;
    const u = houseUnit(rr, o.unit);
    u.mesh.translate(o.x || 0, o.y || 0, o.z);
    mb.merge(u.mesh);
    const bh = o.statBaseH != null ? o.statBaseH : rr.baseH;
    layStats(mb).axis.push({
      tag: o.tag, x: o.x || 0, z: o.z, W: o.unit.W, D: o.unit.D,
      baseH: +bh.toFixed(3), topY: +(u.topY + (o.y || 0)).toFixed(3)
    });
    return u;
  }
  // 跨院 / 配殿单体：默认朝院内（左 x<0 朝 +x，右 x>0 朝 -x）
  function flankUnit(mb, r, o) {
    const rr = Object.assign({}, r, { railing: false }, o.r || {});
    const u = houseUnit(rr, o.unit);
    const rot = o.rot != null ? o.rot : (o.x < 0 ? 90 : -90);
    u.mesh.rotateY(rot);
    u.mesh.translate(o.x, 0, o.z);
    mb.merge(u.mesh);
    layStats(mb).flanks.push({
      tag: o.tag, x: o.x, z: o.z, W: o.unit.W, D: o.unit.D,
      baseH: o.r && o.r.baseH != null ? o.r.baseH : r.baseH, rot
    });
    return u;
  }
  // 横向隔墙（全宽，轴上留门洞）：进与进之间的明确分界
  function crossWall(mb, r, o) {
    const d = 0.3, h = o.h || 2.6, g = o.gateW || 2.6;
    const z = o.z, x0 = o.x0, x1 = o.x1, tag = o.tag || '隔墙';
    mb.box(x0, -g / 2 - d / 2, 0, h, z - d / 2, z + d / 2, 'plaster', tag);
    mb.box(g / 2 + d / 2, x1, 0, h, z - d / 2, z + d / 2, 'plaster', tag);
    mb.box(x0, x1, h, h + 0.16, z - d / 2 - 0.08, z + d / 2 + 0.08, 'tile', tag + '·压顶');
    mb.box(x0, x1, h + 0.16, h + 0.28, z - 0.08, z + 0.08, 'tileEnd', tag + '·脊');
    // 门框 + 门扇
    for (const sx of [-1, 1]) {
      mb.box(sx * g / 2 - 0.1, sx * g / 2 + 0.1, 0.1, o.gateH || 2.5, z - d / 2 - 0.06, z + d / 2 + 0.06, 'woodDark', tag + '·门框');
      mb.box(sx * (g / 2 - 0.05), sx * 0.03, 0.1, (o.gateH || 2.5) * 0.92, z - 0.05, z + 0.05, 'zhu', tag + '·门扇');
    }
    // 隔墙门顶（垂花 / 仪门小屋顶）
    if (o.roof !== false && !r.cut.roof) {
      GF.roofs.build(mb, {
        cx: 0, cz: z, x0: -g / 2 - 0.7, x1: g / 2 + 0.7, z0: z - 0.9, z1: z + 0.9,
        yb: h + 0.28, rise: 0.7, type: 'gable', tile: r.tile, tileB: r.tileB,
        upturn: 0.25, ridgeStyle: 'plain', beasts: 0, gableMat: r.wallMat, tag: tag + '·门顶'
      });
    }
    layStats(mb).walls.push({ tag, z, gateW: g, x0, x1, h });
  }
  // 直线游廊：两点之间连续廊身，转角由两段廊中心线交于角柱闭合
  function corridorRun(mb, r, x0, z0, x1, z1, Wd, y0, tag, opts) {
    const L = Math.hypot(x1 - x0, z1 - z0);
    if (L < 0.3) return;
    const cor = corridorMesh(r, L, Wd, y0 || 0.02, opts || {});
    const ang = Math.atan2(-(z1 - z0), x1 - x0) * 180 / Math.PI;
    cor.rotateY(ang);
    cor.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
    mb.merge(cor);
    layStats(mb).corridors = layStats(mb).corridors || [];
    layStats(mb).corridors.push({ tag: tag || '游廊', x0, z0, x1, z1, w: Wd });
  }
  // 多层收分台基（主殿三层台基）+ 前置月台
  function tieredTerrace(mb, W, D, h, tiers, tag) {
    let y = 0;
    for (let i = 0; i < tiers; i++) {
      const hh = h / tiers;
      const w = W + 1.1 - i * 0.32, d = D + 1.1 - i * 0.32;
      mb.taper(0, 0, w, d, w - 0.22, d - 0.22, y, y + hh, 'stoneDark', tag + '·台');
      y += hh;
    }
    mb.box(-W / 2 - 0.4, W / 2 + 0.4, y, y + 0.06, -D / 2 - 0.4, D / 2 + 0.4, 'stone', tag + '·台面');
    return y + 0.06;
  }

  /* 四合院 / 宅院（怡红院、潇湘馆一路） */
  function courtyardHouse(mb, r, ctx) {
    const { CW, CD } = ctx;

    // 垂花门
    const gz = CD / 2 - 0.2;
    for (const sx of [-1, 1]) {
      mb.boxC(sx * 1.95, gz, 0.36, 0.36, 0, 0.36, 'stone', '门枕石');
      mb.cyl(sx * 1.95, gz, 0.19, 0.3, 3.2, 8, r.colMat, '垂花柱');
      mb.boxC(sx * 1.95, gz, 0.14, 0.5, 2.2, 2.35, 'wood', '垂莲柱·头');
    }
    for (const sx of [-1, 1]) {
      mb.boxC(sx * 0.66, gz, 1.2, 0.09, 0.25, 2.5, 'zhu', '门扇');
      mb.boxC(sx * 0.2, gz + 0.06, 0.22, 0.06, 1.2, 1.32, 'gold', '门环');
    }
    mb.box(-2.05, 2.05, 2.95, 3.1, gz - 0.12, gz + 0.12, 'wood', '门楣');
    P.plaque(mb, { dir: 'front', at: gz + 0.16, uc: 0, vc: 2.66, w: 1.15, h: 0.38, chars: 2 });
    if (!r.cut.roof) {
      GF.roofs.build(mb, {
        cx: 0, cz: gz, x0: -2.75, x1: 2.75, z0: gz - 1.0, z1: gz + 1.0,
        yb: 3.2, rise: 0.8, type: 'gable', tile: r.tile, tileB: r.tileB,
        upturn: 0.3, ridgeStyle: 'plain', beasts: 0, gableMat: r.wallMat, tag: '垂花门顶'
      });
    }

    // 正房（带前廊）
    const W1 = Math.min(CW * 0.38, 7.0), D1 = 4.8;
    const zMain = -CD / 2 + 1.5 + D1 / 2;
    const main = houseUnit(r, {
      W: W1, D: D1, bays: 3,
      cut: r.cut, veranda: true, eave: 0.9,
      partition: 0.9,
      interior: r.interior.length ? r.interior : [
        { kind: 'bed', x: -1.2, z: -1.9 },
        { kind: 'table', x: 1.0, z: -1.4 },
        { kind: 'screen', x: 0.2, z: -2.4 },
        { kind: 'shelf', x: -2.8, z: -1.0 },
        { kind: 'lamp', x: 2.7, z: 0.1 },
        { kind: 'altar', x: 0, z: 0.2 },
        { kind: 'table', x: 0, z: 2.2 },
        { kind: 'stool', x: 0.95, z: 2.2 },
        { kind: 'stool', x: -0.95, z: 2.2 }
      ],
      plaque: r.plaque
    });
    main.mesh.translate(0, 0, zMain);
    mb.merge(main.mesh);

    // 东西厢房
    const W2 = 6.0, D2 = 3.2;
    const zWing = 2.4;
    for (const sx of [-1, 1]) {
      const wing = houseUnit(r, {
        W: W2, D: D2, bays: 3, roofType: 'gable', eave: 0.7,
        interior: [
          { kind: 'table', x: 0, z: 0.2 },
          { kind: 'shelf', x: -2.2, z: -0.9 },
          { kind: 'bed', x: 2.0, z: -0.8 },
          { kind: 'stool', x: 1.0, z: 0.2 }
        ]
      });
      wing.mesh.rotateY(sx > 0 ? -90 : 90);
      wing.mesh.translate(sx * (CW / 2 - 2.9), 0, zWing);
      mb.merge(wing.mesh);
    }

    // 抄手游廊（沿东西院墙，从门内直到正房前）
    if (!r.cut.roof) {
      for (const sx of [-1, 1]) {
        const L = CD * 0.55;
        const cor = corridorMesh(r, L, 1.1, 0.02, {});
        cor.rotateY(90);
        cor.translate(sx * (CW / 2 - (1.1 / 2 + 0.55)), 0, CD / 2 - 1.3 - L / 2);
        mb.merge(cor);
      }
    }

    // 院内竹木
    const inTrees = r.env.trees || [];
    for (let i = 0; i < Math.min(2, inTrees.length); i++) {
      P.tree(mb, (i ? 1 : -1) * 2.2, 5.8 - i * 0.6, inTrees[i], new GF.RNG(r.seed + i * 13), 0.85, '院内树');
    }

    // 庭院陈设
    P.furniture(mb, 'table', 0, 3.4, 1, 0, '石桌');
    P.furniture(mb, 'stool', 0.9, 3.4, 1, 0, '石凳');
    P.furniture(mb, 'stool', -0.9, 3.4, 1, 0, '石凳');
    P.rock(mb, -3.4, 5.4, 0.9, new GF.RNG(r.seed + 5), '假山');
    if (r.env.pond && r.env.showGround !== false && r.env.groundType !== 'lake') P.pond(mb, r.env.pond.x || 3.6, r.env.pond.z || 5.4, r.env.pond.w || 2.2, r.env.pond.d || 1.5);
    // 花池
    for (const sx of [-1, 1]) {
      mb.boxC(sx * 3.0, 1.0, 1.4, 1.0, 0, 0.35, 'stone', '花池');
      mb.boxC(sx * 3.0, 1.0, 1.2, 0.8, 0.35, 0.6, 'leaf', '花草');
    }
  }

  /* 小亭（园林湖心亭 / 钟鼓楼） */
  function smallPavilion(mb, r, x, z, R, colH, roofType, tag, y0, opt) {
    const yb = y0 || 0;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        mb.cyl(x + sx * R, z + sz * R, 0.14, yb, yb + colH, 8, r.colMat, tag + '·柱');
        mb.boxC(x + sx * R, z + sz * R, 0.24, 0.24, yb + colH - 0.3, yb + colH - 0.16, 'woodDark', tag + '·箍头');
      }
    }
    for (const sz of [-1, 1]) {
      GF.beamBetween(mb, [x - R, yb + colH - 0.34, z + sz * R], [x + R, yb + colH - 0.34, z + sz * R], 0.12, 0.2, 'woodDark', tag + '·额枋');
      GF.beamBetween(mb, [x + sz * R, yb + colH - 0.34, z - R], [x + sz * R, yb + colH - 0.34, z + R], 0.12, 0.2, 'woodDark', tag + '·额枋');
    }
    if (!r.cut.roof) {
      // 檐檩 + 角梁（仅 opt.eaveBeam 打开时生成）：把出檐压回柱头，檐口边中正好落在檩面
      if (opt && opt.eaveBeam) {
        const RE = R + 0.55, ye = yb + colH - 0.09;
        for (const s of [-1, 1]) {
          GF.beamBetween(mb, [x - RE, ye, z + s * RE], [x + RE, ye, z + s * RE], 0.14, 0.18, 'woodDark', tag + '·檐檩');
          GF.beamBetween(mb, [x + s * RE, ye, z - RE], [x + s * RE, ye, z + RE], 0.14, 0.18, 'woodDark', tag + '·檐檩');
        }
        for (const sx of [-1, 1]) {
          for (const sz of [-1, 1]) {
            GF.beamRound(mb, [x + sx * R, yb + colH - 0.12, z + sz * R], [x + sx * RE, ye + 0.09, z + sz * RE], 0.09, 6, 'woodDark', tag + '·角梁');
          }
        }
      }
      GF.roofs.build(mb, {
        cx: x, cz: z, xe: R + 0.55, ze: R + 0.55, yb: yb + colH, rise: R * 0.95,
        type: roofType || 'pyramid', tile: r.tile, tileB: r.tileB,
        upturn: 0.55, ridgeStyle: 'plain', beasts: 0, finial: true, tag: tag + '·顶'
      });
    }
  }

  /* 山门：一门三洞、前后贯通、内外均有踏跺 */
  function templeGate(mb, r, o) {
    const W = o.W, D = o.D, z = o.z;
    const baseH = o.baseH != null ? o.baseH : 0.35;
    const h = o.h != null ? o.h : 3.0;
    const t = 0.26;
    const stepW = o.stepW != null ? o.stepW : 2.6;
    const holes = o.holes || [];
    // 台基
    mb.box(-W / 2, W / 2, 0, baseH, z - D / 2, z + D / 2, 'stone', '山门·台基');
    // 内外踏跺（各 3 级，顶面接台基面）
    for (const sz of [-1, 1]) {
      const n = 3, sd = 0.30;
      for (let i = 0; i < n; i++) {
        const y1 = baseH - (baseH * i) / n;
        const y0 = baseH - (baseH * (i + 1)) / n;
        const za = z + sz * (D / 2 + i * sd);
        const zb = z + sz * (D / 2 + (i + 1) * sd);
        mb.box(-stepW / 2, stepW / 2, y0, y1, Math.min(za, zb), Math.max(za, zb), 'stone', '山门·踏跺');
      }
    }
    // 墙身：前后各三门洞，左右实墙
    const wh = { thickness: t, mat: r.wallMat };
    P.wallWithHoles(mb, Object.assign({ dir: 'front', at: z + D / 2, u0: -W / 2, u1: W / 2, y0: baseH, y1: h, holes: holes, tag: '山门·前墙' }, wh));
    P.wallWithHoles(mb, Object.assign({ dir: 'back', at: z - D / 2, u0: -W / 2, u1: W / 2, y0: baseH, y1: h, holes: holes, tag: '山门·后墙' }, wh));
    P.wallWithHoles(mb, Object.assign({ dir: 'right', at: W / 2, u0: z - D / 2, u1: z + D / 2, y0: baseH, y1: h, holes: [], tag: '山门·东墙' }, wh));
    P.wallWithHoles(mb, Object.assign({ dir: 'left', at: -W / 2, u0: z - D / 2, u1: z + D / 2, y0: baseH, y1: h, holes: [], tag: '山门·西墙' }, wh));
    // 门框 ∕ 门楣（三洞，前后各一道）
    for (const hl of holes) {
      for (const sz of [-1, 1]) {
        const zz = z + sz * (D / 2 + 0.02);
        for (const u of [hl.u0, hl.u1]) {
          mb.box(u - 0.07, u + 0.07, baseH, hl.v1 + 0.12, zz - t / 2 - 0.02, zz + t / 2 + 0.02, 'woodDark', '山门·门框');
        }
        mb.box(hl.u0, hl.u1, hl.v1, hl.v1 + 0.14, zz - t / 2 - 0.02, zz + t / 2 + 0.02, 'woodDark', '山门·门楣');
      }
    }
    // 屋面（悬山）
    if (!r.cut.roof) {
      GF.roofs.build(mb, {
        cx: 0, cz: z, x0: -W / 2 - 0.7, x1: W / 2 + 0.7, z0: z - D / 2 - 0.7, z1: z + D / 2 + 0.7,
        yb: h, rise: 1.05, type: 'gable', tile: r.tile, tileB: r.tileB,
        upturn: 0.3, ridgeStyle: 'plain', beasts: 0, gableMat: r.wallMat, tag: '山门·顶'
      });
    }
  }

  /* 江南园林：叠山理水、框景漏景、对景添景 */
  function courtyardGarden(mb, r, ctx) {
    const { CW, CD } = ctx;
    const rng = new GF.RNG(r.seed + 7);

    // 正厅（卷棚，临水而筑）
    const W1 = Math.min(CW * 0.36, 6.6), D1 = 4.6;
    const zHall = -CD / 2 + 1.3 + D1 / 2;
    for (const sx of [-1, 1]) {
      const h = houseUnit(r, {
        W: W1, D: D1, bays: 3, cut: r.cut, veranda: true, eave: 0.95,
        roofType: 'roll', partition: 0.6
      });
      if (sx < 0) { h.mesh.translate(0, 0, zHall); mb.merge(h.mesh); }
    }

    // 入口影壁（对景）
    P.yingbi(mb, { cx: 0, cz: CD / 2 - 2.5, w: 3.2, h: 2.3 });
    // 影壁前的花石（框景）
    P.rock(mb, 1.9, CD / 2 - 2.6, 0.7, rng, '花石');
    P.stoneLantern(mb, -1.9, CD / 2 - 2.6, 0.85, '石灯');

    // 水池（居中偏左）
    const px = -1.1, pz = -0.1, pw = Math.min(CW * 0.4, 7.4), pd = Math.min(CD * 0.32, 4.6);
    P.pond(mb, px, pz, pw, pd, '池');
    // 驳岸叠石（叠山）：只沿南岸、东岸贴水立石——北岸紧贴正厅台基、西岸让给敞轩
    const rocks = [];
    for (let i = 0; i < 5; i++) rocks.push([px - pw / 2 + 0.4 + i * (pw - 0.8) / 4, pz + pd / 2 + 0.32]);
    for (let i = 0; i < 4; i++) rocks.push([px + pw / 2 + 0.32, pz + pd / 2 - 0.5 - i * (pd - 1.0) / 3]);
    for (const [rx, rz] of rocks) {
      // 让开两条曲桥的桥头，免得石头压住桥口
      if (Math.hypot(rx + 0.1, rz - (pz + pd / 2 + 0.45)) < 1.15) continue;
      if (Math.hypot(rx - (px + pw / 2 + 0.45), rz - 0.2) < 1.15) continue;
      P.rock(mb, rx, rz, 0.28 + ((Math.abs(rx * 3 + rz * 5)) % 1) * 0.18, rng, '叠石');
    }
    // 主峰、次峰：水面之外（东南角、东北角），不压水面也不压桥
    P.rock(mb, px + pw / 2 + 2.3, pz + pd / 2 + 1.25, 1.2, rng, '主峰');
    P.rock(mb, px + pw / 2 + 2.3, pz - pd / 2 - 0.55, 0.8, rng, '次峰');
    // 湖心亭 + 曲桥（桥头一律留在石矶之外，不铺到亭子平台上）
    const iX = px + 1.3, iZ = pz + 0.2;
    // 石矶：台身略收分（下大上小），顶面压边一层，边缘不再是直角方块
    mb.taper(iX, iZ, 2.44, 2.24, 2.34, 2.14, 0, 0.30, 'stoneDark', '湖心亭·石矶');
    mb.taper(iX, iZ, 2.38, 2.18, 2.4, 2.2, 0.30, 0.34, 'stone', '湖心亭·石矶');
    smallPavilion(mb, r, iX, iZ, 0.78, 2.3, 'pyramid', '湖心亭');
    // 石矶西、南、北三面立栏（东面留桥口），把台面围起来，桥与台面才分得开
    P.railing(mb, { a: [iX - 1.2, iZ - 1.1], b: [iX - 1.2, iZ + 1.1], y: 0.34, style: 'wood', tag: '石矶栏' });
    P.railing(mb, { a: [iX - 1.2, iZ - 1.1], b: [iX + 1.2, iZ - 1.1], y: 0.34, style: 'wood', tag: '石矶栏' });
    P.railing(mb, { a: [iX - 1.2, iZ + 1.1], b: [iX + 1.2, iZ + 1.1], y: 0.34, style: 'wood', tag: '石矶栏' });
    // 两条桥的桥头都落在平台矩形（x iX±1.2 / z iZ±1.1）之外 0.08m，桥面 0.26 低于台面 0.34，只能“搭边”不能“入台”
    P.quBridge(mb, [[iX - 1.28, iZ + 0.45], [iX - 1.85, 1.45], [iX - 1.9, pz + pd / 2 + 0.55]], 0.72, '曲桥', { y: 0.26 });
    P.quBridge(mb, [[iX + 1.48, iZ + 0.45], [iX + 2.25, iZ + 0.85], [px + pw / 2 + 0.55, iZ - 0.35]], 0.72, '曲桥', { y: 0.26 });

    // 临水敞轩（添景）：石台 + 四柱 + 卷棚 + 美人靠
    const xx = -CW / 2 + 2.0, xz = pz + 1.0, xw = 3.4, xd = 3.2;
    mb.box(xx, xx + xw, 0, 0.42, xz - xd / 2, xz + xd / 2, 'stoneDark', '敞轩台');
    mb.box(xx - 0.06, xx + xw + 0.06, 0.42, 0.46, xz - xd / 2 - 0.06, xz + xd / 2 + 0.06, 'slab', '敞轩台面');
    const xcx = xx + xw / 2;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        mb.cyl(xcx + sx * (xw / 2 - 0.2), xz + sz * (xd / 2 - 0.2), 0.12, 0.46, 2.6, 8, r.colMat, '敞轩柱');
      }
    }
    P.railing(mb, { a: [xx, xz - xd / 2], b: [xx, xz + xd / 2], y: 0.46, style: 'beauty', tag: '敞轩靠' });
    // 四柱之间补额枋，把屋顶实实在在压在柱头上（原来顶面比柱头高 0.12，看着整片悬空）
    for (const sz of [-1, 1]) {
      GF.beamBetween(mb, [xx + 0.2, 2.44, xz + sz * (xd / 2 - 0.2)], [xx + xw - 0.2, 2.44, xz + sz * (xd / 2 - 0.2)], 0.16, 0.22, 'woodDark', '敞轩额枋');
      GF.beamBetween(mb, [xx + (sz > 0 ? xw - 0.2 : 0.2), 2.44, xz - xd / 2 + 0.2], [xx + (sz > 0 ? xw - 0.2 : 0.2), 2.44, xz + xd / 2 - 0.2], 0.16, 0.22, 'woodDark', '敞轩额枋');
    }
    if (!r.cut.roof) {
      GF.roofs.build(mb, {
        cx: xcx, cz: xz, x0: xx - 0.5, x1: xx + xw + 0.5, z0: xz - xd / 2 - 0.5, z1: xz + xd / 2 + 0.5,
        yb: 2.60, rise: 1.0, type: 'roll', tile: r.tile, tileB: r.tileB,
        upturn: 0.3, ridgeStyle: 'plain', gableMat: 'wood', tag: '敞轩顶'
      });
    }
    P.furniture(mb, 'table', xcx, xz, 1, 0, '敞轩石桌');

    // 抄手游廊（右）
    if (!r.cut.roof) {
      const L = CD * 0.5;
      const cor = corridorMesh(r, L, 1.1, 0.02, {});
      cor.rotateY(90);
      cor.translate(CW / 2 - (1.1 / 2 + 0.55), 0, CD / 2 - 1.3 - L / 2);
      mb.merge(cor);
    }

    // 花木（添景：竹、芭蕉、枫、梅）
    P.tree(mb, -CW / 2 + 1.2, CD / 2 - 4.6, 'bamboo', rng, 0.95, '竹');
    P.tree(mb, CW / 2 - 1.4, CD / 2 - 5.0, 'bamboo', rng, 0.9, '竹');
    P.tree(mb, 2.6, 3.6, 'banana', rng, 1.0, '芭蕉');
    P.tree(mb, CW / 2 - 2.0, -CD / 2 + 2.4, 'maple', rng, 1.0, '枫');
    P.tree(mb, -2.4, -CD / 2 + 3.0, 'plum', rng, 0.9, '梅');
    // 花池（石沿 + 花木，不用水面）
    const fx = CW / 2 - 2.2, fz = 4.6, fw = 2.2, fd = 1.6;
    mb.box(fx - fw / 2, fx + fw / 2, 0, 0.28, fz - fd / 2, fz + fd / 2, 'stone', '花池');
    mb.box(fx - fw / 2 + 0.12, fx + fw / 2 - 0.12, 0.28, 0.3, fz - fd / 2 + 0.12, fz + fd / 2 - 0.12, 'soil', '花池土');
    // 花丛：矮绿丛 + 零碎花头，避免大色块读成砖堆
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 2; j++) {
        const hx = fx - 0.55 + i * 0.55, hz = fz - 0.3 + j * 0.55;
        mb.boxC(hx, hz, 0.44, 0.4, 0.3, 0.5, 'leaf', '花池花');
        mb.boxC(hx + 0.06, hz - 0.05, 0.2, 0.18, 0.5, 0.6, i % 2 ? 'bamboo' : 'leaf', '花池花');
        mb.boxC(hx - 0.1, hz + 0.1, 0.12, 0.12, 0.5, 0.56, 'bamboo', '花池花');
      }
    }
    P.penjing(mb, -CW / 2 + 2.0, -CD / 2 + 4.4, 0.85, '盆景');
    P.penjing(mb, CW / 2 - 4.2, -1.2, 0.8, '盆景');
    P.stoneLantern(mb, 1.2, 5.2, 0.8, '石灯');
    // 石桌石凳：摆在池南的岸上（原来落在水面里）
    P.furniture(mb, 'table', -3.4, 3.2, 0.95, 0, '石桌');
    P.furniture(mb, 'stool', -3.4, 2.65, 0.9, 0, '石凳');
  }

  /* 寺院：山门、钟鼓楼、大殿、香炉、幡杆 */
  function courtyardTemple(mb, r, ctx) {
    const { CW, CD } = ctx;
    const rng = new GF.RNG(r.seed + 9);

    // 山门（一门三洞，前后贯通；内外都有踏跺）
    const gW = Math.min(CW * 0.42, 7.0), gD = 3.2;
    const gz = CD / 2 - 2.95;
    templeGate(mb, r, {
      W: gW, D: gD, z: gz, baseH: 0.35, h: 3.0, stepW: 2.6,
      holes: [
        { u0: -1.05, u1: 1.05, v0: 0.35, v1: 2.55 },
        { u0: -2.30, u1: -1.20, v0: 0.35, v1: 2.10 },
        { u0: 1.20, u1: 2.30, v0: 0.35, v1: 2.10 }
      ]
    });
    // 山门与院墙门之间的甬道
    mb.box(-1.35, 1.35, 0, 0.06, gz + gD / 2 + 0.55, CD / 2, 'stone', '甬道');
    // 山门匾
    P.plaque(mb, { dir: 'front', at: gz + gD / 2 + 0.06, uc: 0, vc: 2.78, w: 1.9, h: 0.36, chars: 3 });

    // 钟楼 · 鼓楼
    for (const sx of [-1, 1]) {
      const tx = sx * (CW / 2 - 3.2), tz = CD / 2 - 6.0;
      smallPavilion(mb, r, tx, tz, 1.5, 3.4, 'pyramid', sx > 0 ? '钟楼' : '鼓楼', 0, { eaveBeam: true });
      mb.box(tx - 1.6, tx + 1.6, 0, 0.4, tz - 1.6, tz + 1.6, 'stone', sx > 0 ? '钟楼台' : '鼓楼台');
      P.bellDrum(mb, tx, tz, 0.9, sx > 0 ? 'bell' : 'drum', sx > 0 ? '钟' : '鼓');
    }

    // 大殿（五间庑殿）
    const W1 = Math.min(CW * 0.5, 9.4), D1 = 5.2;
    const zMain = -CD / 2 + 1.3 + D1 / 2;
    const main = houseUnit(r, {
      W: W1, D: D1, bays: r.bays,
      cut: r.cut, veranda: true, eave: 1.1,
      roofType: r.roofType,
      interior: []
    });
    main.mesh.translate(0, 0, zMain);
    mb.merge(main.mesh);
    // 殿内佛龛组（正中，沿中轴对称；按殿内地面标高抬升，不埋进台基）
    const floorY = (r.baseH || 0.9) + 0.12; // 台基面 + 地板厚
    const fm = new GF.Mesh();
    P.furniture(fm, 'shrine', 0, -1.65, 1.25, 0, '佛龛·中');
    P.furniture(fm, 'altar', 0, -0.5, 1.15, 0, '香案');
    P.furniture(fm, 'shrine', -2.05, -1.5, 0.85, 0, '佛龛·西');
    P.furniture(fm, 'shrine', 2.05, -1.5, 0.85, 0, '佛龛·东');
    fm.translate(0, floorY, zMain);
    mb.merge(fm);

    // 甬道两侧陈设
    P.censer(mb, 0, 2.2, 1.3, '香炉');
    for (const sx of [-1, 1]) {
      P.lion(mb, sx * (gW / 2 + 0.9), gz - 1.4, 1.0, '石狮');
      P.banner(mb, sx * 2.6, 0, 2.6, 2.6, 0.6, '幡');
      P.stoneLantern(mb, sx * 1.6, -1.0, 0.9, '石灯');
    }
    // 廊（沿两厢）
    if (!r.cut.roof) {
      for (const sx of [-1, 1]) {
        const L = CD * 0.42;
        const cor = corridorMesh(r, L, 1.0, 0.02, {});
        cor.rotateY(90);
        cor.translate(sx * (CW / 2 - (1.0 / 2 + 0.55)), 0, 1.2 - L / 2);
        mb.merge(cor);
      }
    }
    // 松柏与碑（碑移出殿外，立于前院西侧）
    P.tree(mb, -3.4, 4.2, 'pine', rng, 1.1, '松');
    P.tree(mb, 3.4, 4.2, 'pine', rng, 1.1, '松');
    P.stele(mb, -4.4, 5.8, 0.9, '功德碑');
  }

  /* ---------------- 阶段④-1 寺·五进中轴（temple5） ---------------- */
  function courtyardTemple5(mb, r, ctx) {
    const { CW, CD } = ctx;
    const rng = new GF.RNG(r.seed + 21);
    const zF = CD / 2, zB = -CD / 2;
    P.courtWall(mb, {
      x0: -CW / 2, x1: CW / 2, z0: zB, z1: zF, y: 3.0,
      gate: { side: 'front', w: 2.8, h: 2.7, shape: 'rect' }, windows: null, windowPattern: r.winPattern
    });

    // 山门（一门三洞意象：三间门屋 + 两侧深色门洞）
    const gz = zF - 2.4;
    axisUnit(mb, r, {
      tag: '山门', z: gz, r: { baseH: 0.2, dougong: false },
      unit: { W: 7.8, D: 3.0, bays: 3, roofType: 'roll', eave: 0.8, plaque: true, chars: 3, cheap: true }
    });
    for (const sx of [-1, 1]) mb.box(sx * 2.55 - 0.5, sx * 2.55 + 0.5, 0.2, 2.3, gz + 1.35, gz + 1.5, 'dark', '山门·侧洞');

    // 钟鼓楼（山门院两侧）
    for (const sx of [-1, 1]) {
      const tx = sx * (CW / 2 - 3.4), tz = zF - 6.4;
      mb.box(tx - 1.6, tx + 1.6, 0, 0.4, tz - 1.6, tz + 1.6, 'stone', sx > 0 ? '钟楼台' : '鼓楼台');
      smallPavilion(mb, r, tx, tz, 1.5, 3.2, 'pyramid', sx > 0 ? '钟楼' : '鼓楼', 0.4);
      P.bellDrum(mb, tx, tz, 0.9, sx > 0 ? 'bell' : 'drum', sx > 0 ? '钟' : '鼓');
      layStats(mb).flanks.push({ tag: sx > 0 ? '钟楼' : '鼓楼', x: tx, z: tz, W: 3.0, D: 3.0, baseH: 0.4, rot: 0 });
    }

    // 一进隔墙：山门院 / 天王殿院
    crossWall(mb, r, { z: zF - 8.2, x0: -CW / 2, x1: CW / 2, gateW: 2.8, gateH: 2.5, tag: '一进隔墙' });

    // 天王殿
    const kz = zF - 11.2;
    axisUnit(mb, r, {
      tag: '天王殿', z: kz, r: { baseH: 0.35, dougong: false },
      unit: { W: 6.6, D: 3.8, bays: 3, roofType: 'gable', eave: 0.9, veranda: true, cheap: true }
    });
    // 东西配殿（伽蓝 / 祖师）
    for (const sx of [-1, 1]) {
      flankUnit(mb, r, {
        tag: sx > 0 ? '祖师殿' : '伽蓝殿', x: sx * (CW / 2 - 2.8), z: kz,
        r: { baseH: 0.3, dougong: false }, unit: { W: 4.4, D: 3.0, bays: 3, roofType: 'gable', eave: 0.7, cheap: true }
      });
    }

    // 二进隔墙：天王殿院 / 大雄宝殿院
    crossWall(mb, r, { z: 2.4, x0: -CW / 2, x1: CW / 2, gateW: 3.0, gateH: 2.6, tag: '二进隔墙' });

    // 大雄宝殿：全寺最高最大，三层台基 + 月台 + 庑殿
    const mz = -3.2, mW = 9.6, mD = 5.4, mBase = 0.75;
    const terrTop = tieredTerrace(mb, mW, mD, mBase, 3, '大雄台基');
    mb.box(-mW * 0.36, mW * 0.36, 0, mBase, mz + mD / 2, mz + mD / 2 + 1.8, 'stoneDark', '大雄月台');
    mb.box(-mW * 0.36, mW * 0.36, mBase, mBase + 0.06, mz + mD / 2, mz + mD / 2 + 1.8, 'stone', '月台台面');
    for (let i = 0; i < 3; i++) {
      const d = (i + 1) * mBase / 3;
      mb.box(-1.6, 1.6, 0, mBase - d, mz + mD / 2 + 1.8 + i * 0.3, mz + mD / 2 + 1.8 + (i + 1) * 0.3, 'stone', '月台踏跺');
    }
    axisUnit(mb, r, {
      tag: '大雄宝殿', z: mz, y: terrTop - 0.12, statBaseH: mBase,
      r: { baseH: 0.12, dougong: true, dgScale: 0.9, dgStyle: 'full', railing: true },
      unit: { W: mW, D: mD, bays: 5, roofType: 'hip', eave: 1.2, veranda: true, partition: 1.2 }
    });
    P.railing(mb, { a: [-mW * 0.36, mz + mD / 2 + 1.8], b: [-mW * 0.36, mz + mD / 2], y: mBase + 0.06, style: 'marble', tag: '月台栏' });
    P.railing(mb, { a: [mW * 0.36, mz + mD / 2 + 1.8], b: [mW * 0.36, mz + mD / 2], y: mBase + 0.06, style: 'marble', tag: '月台栏' });
    P.censer(mb, 0, mz + mD / 2 + 2.4, 1.3, '香炉');
    for (const sx of [-1, 1]) P.lion(mb, sx * (mW / 2 + 0.9), mz + mD / 2 + 1.6, 1.0, '石狮');

    // 三进隔墙：大殿院 / 法堂院
    crossWall(mb, r, { z: -6.8, x0: -CW / 2, x1: CW / 2, gateW: 2.6, gateH: 2.4, tag: '三进隔墙' });

    // 法堂
    axisUnit(mb, r, {
      tag: '法堂', z: -9.6, r: { baseH: 0.95, dougong: false },
      unit: { W: 7.0, D: 4.2, bays: 3, roofType: 'gableHip', eave: 1.0, veranda: true, cheap: true }
    });

    // 四进隔墙：法堂 / 藏经阁
    crossWall(mb, r, { z: -12.4, x0: -CW / 2, x1: CW / 2, gateW: 2.4, gateH: 2.3, tag: '四进隔墙' });

    // 藏经阁（后阁，二层）
    axisUnit(mb, r, {
      tag: '藏经阁', z: -14.4, r: { baseH: 1.1, dougong: false },
      unit: { W: 6.0, D: 4.0, bays: 3, floors: 2, floorHList: [3.0, 2.6], roofType: 'gableHip', eave: 0.9, cheap: true }
    });

    // 东西院：禅堂 / 斋堂（主轴之外，体量低矮）
    for (const sx of [-1, 1]) {
      flankUnit(mb, r, {
        tag: sx > 0 ? '斋堂' : '禅堂', x: sx * (CW / 2 - 2.6), z: -14.4,
        r: { baseH: 0.85, dougong: false }, unit: { W: 3.6, D: 3.0, bays: 2, roofType: 'gable', eave: 0.6, cheap: true }
      });
    }
    P.tree(mb, -CW / 2 + 1.6, kz + 1.0, 'pine', rng, 1.0, '松');
    P.tree(mb, CW / 2 - 1.6, kz + 1.0, 'pine', rng, 1.0, '松');
  }

  /* ---------------- 阶段④-2 道观（daoguan） ---------------- */
  function courtyardDao(mb, r, ctx) {
    const { CW, CD } = ctx;
    const rng = new GF.RNG(r.seed + 22);
    const zF = CD / 2, zB = -CD / 2;
    P.courtWall(mb, {
      x0: -CW / 2, x1: CW / 2, z0: zB, z1: zF, y: 3.0,
      gate: { side: 'front', w: 2.6, h: 2.6, shape: 'rect' }, windows: null, windowPattern: r.winPattern
    });

    axisUnit(mb, r, {
      tag: '山门', z: zF - 2.4, r: { baseH: 0.25, dougong: false },
      unit: { W: 6.6, D: 2.8, bays: 3, roofType: 'roll', eave: 0.75, plaque: true, chars: 3, cheap: true }
    });

    const lz = zF - 6.6;
    axisUnit(mb, r, {
      tag: '灵官殿', z: lz, r: { baseH: 0.4, dougong: false },
      unit: { W: 5.6, D: 3.4, bays: 3, roofType: 'gable', eave: 0.85, veranda: true, cheap: true }
    });

    // 钟鼓楼
    for (const sx of [-1, 1]) {
      const tx = sx * (CW / 2 - 3.0), tz = zF - 3.4;
      mb.box(tx - 1.4, tx + 1.4, 0, 0.36, tz - 1.4, tz + 1.4, 'stone', sx > 0 ? '钟楼台' : '鼓楼台');
      smallPavilion(mb, r, tx, tz, 1.3, 3.0, 'pyramid', sx > 0 ? '钟楼' : '鼓楼', 0.36);
      P.bellDrum(mb, tx, tz, 0.85, sx > 0 ? 'bell' : 'drum', sx > 0 ? '钟' : '鼓');
      layStats(mb).flanks.push({ tag: sx > 0 ? '钟楼' : '鼓楼', x: tx, z: tz, W: 2.6, D: 2.6, baseH: 0.36, rot: 0 });
    }

    crossWall(mb, r, { z: zF - 8.6, x0: -CW / 2, x1: CW / 2, gateW: 2.6, gateH: 2.4, tag: '前院隔墙' });

    // 三清殿（主殿，月台，歇山）
    const mz = -1.8, mW = 8.4, mD = 5.0, mBase = 0.7;
    const terrTop = tieredTerrace(mb, mW, mD, mBase, 2, '三清台基');
    mb.box(-mW * 0.34, mW * 0.34, 0, mBase, mz + mD / 2, mz + mD / 2 + 1.6, 'stoneDark', '三清月台');
    mb.box(-mW * 0.34, mW * 0.34, mBase, mBase + 0.06, mz + mD / 2, mz + mD / 2 + 1.6, 'stone', '月台台面');
    axisUnit(mb, r, {
      tag: '三清殿', z: mz, y: terrTop - 0.12, statBaseH: mBase,
      r: { baseH: 0.12, dougong: true, dgScale: 0.85, dgStyle: 'full', railing: true },
      unit: { W: mW, D: mD, bays: 5, roofType: 'gableHip', eave: 1.1, veranda: true, partition: 1.2 }
    });
    P.censer(mb, 0, mz + mD / 2 + 2.0, 1.2, '香炉');

    // 东西配殿：执事房 / 客堂
    for (const sx of [-1, 1]) {
      flankUnit(mb, r, {
        tag: sx > 0 ? '客堂' : '执事房', x: sx * (CW / 2 - 2.6), z: mz,
        r: { baseH: 0.4, dougong: false }, unit: { W: 4.0, D: 3.0, bays: 3, roofType: 'gable', eave: 0.7, cheap: true }
      });
    }

    crossWall(mb, r, { z: -5.6, x0: -CW / 2, x1: CW / 2, gateW: 2.4, gateH: 2.3, tag: '后院隔墙' });

    // 后阁（二层藏经 / 三清四御）
    axisUnit(mb, r, {
      tag: '三清阁', z: -8.8, r: { baseH: 0.95, dougong: false },
      unit: { W: 5.6, D: 3.8, bays: 3, floors: 2, floorHList: [2.9, 2.5], roofType: 'gableHip', eave: 0.85, cheap: true }
    });

    P.tree(mb, -CW / 2 + 1.5, 2.0, 'pine', rng, 0.95, '松');
    P.tree(mb, CW / 2 - 1.5, 2.0, 'pine', rng, 0.95, '松');
  }

  /* ---------------- 阶段④-3 五进四合院（wujin） ---------------- */
  function courtyardWujin(mb, r, ctx) {
    const { CW, CD } = ctx;
    const rng = new GF.RNG(r.seed + 23);
    const zF = CD / 2, zB = -CD / 2, wallH = 3.0;
    // 外围墙：东南隅开门（前墙东侧留门洞）
    const gateX = CW / 4, gateW = 2.4;
    mb.box(-CW / 2, gateX - gateW / 2, 0, wallH, zF - 0.15, zF + 0.15, 'plaster', '院墙·前');
    mb.box(gateX + gateW / 2, CW / 2, 0, wallH, zF - 0.15, zF + 0.15, 'plaster', '院墙·前');
    mb.box(-CW / 2, CW / 2, wallH, wallH + 0.16, zF - 0.23, zF + 0.23, 'tile', '院墙·压顶');
    mb.box(-CW / 2, CW / 2, 0, wallH, zB - 0.15, zB + 0.15, 'plaster', '院墙·后');
    mb.box(-CW / 2 - 0.15, -CW / 2 + 0.15, 0, wallH, zB, zF, 'plaster', '院墙·左');
    mb.box(CW / 2 - 0.15, CW / 2 + 0.15, 0, wallH, zB, zF, 'plaster', '院墙·右');
    // 宅门（东南角）
    for (const sx of [-1, 1]) mb.box(gateX + sx * gateW / 2 - 0.1, gateX + sx * gateW / 2 + 0.1, 0.1, 2.5, zF - 0.2, zF + 0.2, 'woodDark', '宅门·框');
    mb.box(gateX - gateW / 2 + 0.05, gateX - 0.03, 0.1, 2.3, zF - 0.06, zF + 0.06, 'zhu', '宅门·扇');
    mb.box(gateX + 0.03, gateX + gateW / 2 - 0.05, 0.1, 2.3, zF - 0.06, zF + 0.06, 'zhu', '宅门·扇');
    if (!r.cut.roof) {
      GF.roofs.build(mb, {
        cx: gateX, cz: zF, x0: gateX - gateW / 2 - 0.7, x1: gateX + gateW / 2 + 0.7, z0: zF - 0.9, z1: zF + 0.9,
        yb: 2.78, rise: 0.7, type: 'gable', tile: r.tile, tileB: r.tileB,
        upturn: 0.25, ridgeStyle: 'plain', beasts: 0, gableMat: r.wallMat, tag: '宅门顶'
      });
    }
    layStats(mb).walls.push({ tag: '宅门（东南隅）', z: zF, gateW, x0: -CW / 2, x1: CW / 2, h: wallH, gateX });

    // 第一进：倒座（朝院内 -z）
    const dz = zF - 2.6;
    const dzUnit = houseUnit(Object.assign({}, r, { baseH: 0.25, dougong: false }), { W: 8.0, D: 3.2, bays: 3, roofType: 'gable', eave: 0.7, cheap: true });
    dzUnit.mesh.rotateY(180);
    dzUnit.mesh.translate(0, 0, dz);
    mb.merge(dzUnit.mesh);
    layStats(mb).axis.push({ tag: '倒座', x: 0, z: dz, W: 8.0, D: 3.2, baseH: 0.25, topY: dzUnit.topY });

    // 垂花门（一进 / 二进）
    crossWall(mb, r, { z: zF - 6.6, x0: -CW / 2, x1: CW / 2, gateW: 2.6, gateH: 2.5, tag: '垂花门' });

    // 二进：东西厢 + 正房
    for (const sx of [-1, 1]) {
      flankUnit(mb, r, {
        tag: sx > 0 ? '东厢房' : '西厢房', x: sx * (CW / 2 - 2.6), z: zF - 10.6,
        r: { baseH: 0.35, dougong: false }, unit: { W: 5.2, D: 3.0, bays: 3, roofType: 'gable', eave: 0.7, cheap: true }
      });
    }
    const z2 = zF - 13.4;
    axisUnit(mb, r, {
      tag: '二进正房', z: z2, r: { baseH: 0.5, dougong: false },
      unit: { W: 6.4, D: 4.4, bays: 3, roofType: 'gable', eave: 0.9, veranda: true, partition: 0.9, cheap: true }
    });

    crossWall(mb, r, { z: z2 - 3.4, x0: -CW / 2, x1: CW / 2, gateW: 2.4, gateH: 2.4, tag: '二进隔墙' });

    // 三进：正房 + 耳房（耳房低于正房）
    const z3 = z2 - 6.4;
    axisUnit(mb, r, {
      tag: '三进正房', z: z3, r: { baseH: 0.65, dougong: false },
      unit: { W: 6.0, D: 4.2, bays: 3, roofType: 'gable', eave: 0.9, veranda: true }
    });
    for (const sx of [-1, 1]) {
      flankUnit(mb, r, {
        tag: sx > 0 ? '东耳房' : '西耳房', x: sx * (6.0 / 2 + 1.3), z: z3,
        r: { baseH: 0.4, dougong: false }, unit: { W: 2.4, D: 3.4, bays: 1, roofType: 'gable', eave: 0.55, cheap: true }
      });
    }

    crossWall(mb, r, { z: z3 - 3.2, x0: -CW / 2, x1: CW / 2, gateW: 2.2, gateH: 2.3, tag: '三进隔墙' });

    // 四进：正房（体量递减）
    const z4 = z3 - 6.0;
    axisUnit(mb, r, {
      tag: '四进正房', z: z4, r: { baseH: 0.55, dougong: false },
      unit: { W: 5.4, D: 3.8, bays: 3, roofType: 'gable', eave: 0.8, cheap: true }
    });

    // 后罩房
    const zb = zB + 2.2;
    const zbUnit = houseUnit(Object.assign({}, r, { baseH: 0.4, dougong: false }), { W: 8.4, D: 3.0, bays: 3, roofType: 'gable', eave: 0.7, cheap: true });
    zbUnit.mesh.rotateY(180);
    zbUnit.mesh.translate(0, 0, zb);
    mb.merge(zbUnit.mesh);
    layStats(mb).axis.push({ tag: '后罩房', x: 0, z: zb, W: 8.4, D: 3.0, baseH: 0.4, topY: zbUnit.topY });

    // 抄手游廊：沿东西院墙串联各进
    if (!r.cut.roof) {
      for (const sx of [-1, 1]) {
        corridorRun(mb, r, sx * (CW / 2 - 1.1), zF - 4.2, sx * (CW / 2 - 1.1), zB + 4.0, 1.0, 0.02, '抄手游廊', { plain: true });
      }
    }
    P.tree(mb, -2.4, zF - 10.6, 'bamboo', rng, 0.9, '竹');
    P.tree(mb, 2.4, zF - 10.6, 'plum', rng, 0.9, '梅');
    P.rock(mb, 3.0, z3 + 1.0, 0.7, rng, '假山');
  }

  /* ---------------- 阶段④-4 廊院式祠庙（langyuan） ---------------- */
  function courtyardLangyuan(mb, r, ctx) {
    const { CW, CD } = ctx;
    const rng = new GF.RNG(r.seed + 24);
    const zF = CD / 2, zB = -CD / 2;
    P.courtWall(mb, {
      x0: -CW / 2, x1: CW / 2, z0: zB, z1: zF, y: 3.0,
      gate: { side: 'front', w: 2.6, h: 2.6, shape: 'rect' }, windows: null, windowPattern: r.winPattern
    });

    // 主殿居中（北）
    const mD = 4.6, mz = zB + 1.6 + mD / 2;
    axisUnit(mb, r, {
      tag: '主殿', z: mz, r: { baseH: 0.5, dougong: true, dgScale: 0.8 },
      unit: { W: 7.4, D: mD, bays: 5, roofType: 'gableHip', eave: 1.0, veranda: true, partition: 1.0 }
    });

    // 回廊围合：内圈矩形，北廊在主殿之后、南廊在殿前，四边连续；转角中心线交于角柱
    const rw = CW / 2 - 2.2, rzN = zB + 1.5, rzS = zF - 2.4, Wd = 1.2;
    corridorRun(mb, r, -rw, rzN, rw, rzN, Wd, 0.02, '北回廊', { plain: true });
    const gap = 2.4;
    corridorRun(mb, r, -rw, rzS, -gap / 2, rzS, Wd, 0.02, '南回廊', { plain: true });
    corridorRun(mb, r, gap / 2, rzS, rw, rzS, Wd, 0.02, '南回廊', { plain: true });
    corridorRun(mb, r, -rw, rzS, -rw, rzN, Wd, 0.02, '西回廊', { plain: true });
    corridorRun(mb, r, rw, rzS, rw, rzN, Wd, 0.02, '东回廊', { plain: true });
    // 四角角柱（两段廊中心线交点）
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const cx = sx * rw, cz = sz > 0 ? rzS : rzN;
      mb.cyl(cx, cz, 0.16, 0.02, 2.5, 8, r.colMat, '回廊·角柱');
      mb.boxC(cx, cz, 0.26, 0.26, 0.02, 0.16, 'stone', '角柱·础');
      layStats(mb).corners.push({ x: cx, z: cz, wallX: sx * (CW / 2 - 0.15), wallZ: sz > 0 ? zF : zB });
    }
    P.stele(mb, -3.2, 0, 0.9, '碑');
    P.stoneLantern(mb, 3.2, 0, 0.9, '石灯');
    P.tree(mb, -rw + 1.4, rzS - 1.6, 'pine', rng, 0.9, '松');
    P.tree(mb, rw - 1.4, rzS - 1.6, 'bamboo', rng, 0.9, '竹');
  }

  /* ---------------- 阶段④-5 贾府（府邸 + 后花园复合） ---------------- */
  function courtyardJiafu(mb, r, ctx) {
    const { CW, CD } = ctx;
    const rng = new GF.RNG(r.seed + 25);
    const zF = CD / 2, zB = -CD / 2;
    const zSplit = -6.0;
    P.courtWall(mb, {
      x0: -CW / 2, x1: CW / 2, z0: zB, z1: zF, y: 3.0,
      gate: { side: 'front', w: 2.8, h: 2.7, shape: 'rect' }, windows: null, windowPattern: r.winPattern
    });

    // 前部府邸中轴多进
    axisUnit(mb, r, {
      tag: '大门', z: zF - 2.4, r: { baseH: 0.3, dougong: false },
      unit: { W: 6.4, D: 3.0, bays: 3, roofType: 'gable', eave: 0.85, plaque: true, chars: 2, cheap: true }
    });
    crossWall(mb, r, { z: zF - 6.2, x0: -CW / 2, x1: CW / 2, gateW: 2.6, gateH: 2.5, tag: '仪门' });

    const hz = zF - 10.4;
    axisUnit(mb, r, {
      tag: '正厅', z: hz, r: { baseH: 0.65, dougong: true, dgScale: 0.85 },
      unit: { W: 8.0, D: 4.8, bays: 5, roofType: 'gableHip', eave: 1.1, veranda: true, partition: 1.2 }
    });

    const iz = zF - 16.0;
    axisUnit(mb, r, {
      tag: '内宅', z: iz, r: { baseH: 0.55, dougong: false },
      unit: { W: 7.0, D: 4.4, bays: 3, roofType: 'gable', eave: 0.9, veranda: true, cheap: true }
    });
    // 东西跨院（书房 / 花厅）
    for (const sx of [-1, 1]) {
      flankUnit(mb, r, {
        tag: sx > 0 ? '东跨院·花厅' : '西跨院·书房', x: sx * (CW / 2 - 2.8), z: iz,
        r: { baseH: 0.45, dougong: false }, unit: { W: 3.6, D: 3.4, bays: 2, roofType: 'gable', eave: 0.7, cheap: true }
      });
    }

    // 后罩楼（二层）
    axisUnit(mb, r, {
      tag: '后罩楼', z: zSplit + 2.4, r: { baseH: 0.5, dougong: false },
      unit: { W: 7.6, D: 3.4, bays: 3, floors: 2, floorHList: [2.9, 2.5], roofType: 'gable', eave: 0.8, cheap: true }
    });

    // 府园隔墙（月洞门贯通府邸与园林）
    crossWall(mb, r, { z: zSplit, x0: -CW / 2, x1: CW / 2, gateW: 2.4, gateH: 2.4, tag: '府园隔墙', roof: false });

    // 后部园林：叠山理水、亭榭自由布局
    const px = -1.0, pz = (zSplit + zB) / 2 - 0.5, pw = CW * 0.38, pd = 5.0;
    P.pond(mb, px, pz, pw, pd, '后园池');
    P.rock(mb, px + pw / 2 + 1.6, pz + pd / 2 + 0.8, 1.1, rng, '园山');
    P.rock(mb, px - pw / 2 - 1.4, pz - pd / 2 - 0.4, 0.8, rng, '园石');
    // 湖心小亭 + 石矶
    mb.taper(px + 1.0, pz, 2.2, 2.0, 2.1, 1.9, 0, 0.28, 'stoneDark', '亭矶');
    smallPavilion(mb, r, px + 1.0, pz, 0.72, 2.2, 'pyramid', '后园亭', 0.28);
    // 临水榭
    const xx = -CW / 2 + 2.2, xz = pz + 1.2;
    mb.box(xx, xx + 3.2, 0, 0.4, xz - 1.6, xz + 1.6, 'stoneDark', '水榭台');
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      mb.cyl(xx + 1.6 + sx * 1.2, xz + sz * 1.3, 0.12, 0.4, 2.5, 8, r.colMat, '水榭柱');
    }
    if (!r.cut.roof) {
      GF.roofs.build(mb, {
        cx: xx + 1.6, cz: xz, x0: xx - 0.4, x1: xx + 3.6, z0: xz - 2.0, z1: xz + 2.0,
        yb: 2.5, rise: 0.9, type: 'roll', tile: r.tile, tileB: r.tileB,
        upturn: 0.3, ridgeStyle: 'plain', gableMat: 'wood', tag: '水榭顶'
      });
    }
    P.tree(mb, CW / 2 - 1.8, pz + 1.6, 'willow', rng, 1.0, '柳');
    P.tree(mb, -CW / 2 + 1.6, zSplit - 2.0, 'plum', rng, 0.9, '梅');
    P.tree(mb, CW / 2 - 2.0, zSplit - 3.4, 'maple', rng, 0.9, '枫');
  }

  /* ------------------------------ 廊桥 ------------------------------ */
  function buildBridge(mb, r) {
    const span = r.span || 12, w = r.bridgeW || 3.0;
    const deckY = r.baseH || 1.0;
    // 拱桥面（分段抬高）
    const segs = 12;
    for (let i = 0; i < segs; i++) {
      const t = (i + 0.5) / segs;
      const x = -span / 2 + span * t;
      const y = deckY + Math.sin(Math.PI * t) * (r.arch || 1.2);
      mb.box(x - span / segs / 2, x + span / segs / 2, y - 0.3, y, -w / 2, w / 2, 'stone', '桥面');
      // 桥墩/拱石
      mb.box(x - span / segs / 2, x + span / segs / 2, 0, y - 0.3, -w / 2 - 0.1, -w / 2 + 0.1, 'stone', '桥身');
      mb.box(x - span / segs / 2, x + span / segs / 2, 0, y - 0.3, w / 2 - 0.1, w / 2 + 0.1, 'stone', '桥身');
    }
    // 栏杆
    for (let i = 0; i < segs; i++) {
      const t = (i + 0.5) / segs;
      const x = -span / 2 + span * t;
      const y = deckY + Math.sin(Math.PI * t) * (r.arch || 1.2);
      for (const sz of [-1, 1]) {
        mb.boxC(x, sz * (w / 2 - 0.1), 0.16, 0.16, y, y + 0.6, 'marble', '桥栏');
      }
    }
    // 廊（柱 + 卷棚顶 + 挂落）
    const nCol = 5;
    for (let i = 0; i <= nCol; i++) {
      const t = i / nCol;
      const x = -span / 2 + span * (0.1 + t * 0.8);
      const y = deckY + Math.sin(Math.PI * (0.1 + t * 0.8)) * (r.arch || 1.2);
      for (const sz of [-1, 1]) {
        mb.cyl(x, sz * (w / 2 - 0.25), 0.16, y, y + 2.5, 8, r.colMat, '廊柱');
      }
      // 挂落
      GF.beamBetween(mb, [x, y + 2.1, -w / 2 + 0.25], [x, y + 2.1, w / 2 - 0.25], 0.06, 0.2, 'wood', '挂落');
    }
    if (!r.cut.roof) {
      // 连续卷棚顶：沿拱线逐站放样，檐口落在各柱柱头上，别按每段取平均高度（那样会浮空/柱头穿顶）
      const zE = w / 2 + 0.5;
      const yCol = (t) => deckY + Math.sin(Math.PI * t) * (r.arch || 1.2) + 2.5;
      const stations = [];
      for (let i = 0; i <= nCol; i++) {
        const t = 0.1 + (i / nCol) * 0.8;
        const x = -span / 2 + span * t;
        const yc = yCol(t);
        stations.push({
          x,
          eaveL: [x, yc + 0.04, -zE],
          eaveR: [x, yc + 0.04, zE],
          ridge: [x, yc + 0.66, 0]
        });
      }
      // 两端各再放一跨短的，让屋顶探出端柱一点，端头不再顶在柱子上
      for (const s of [1, -1]) {
        const src = s > 0 ? stations[stations.length - 1] : stations[0];
        const dx = s * 0.45;
        stations.splice(s > 0 ? stations.length : 0, 0, {
          x: src.x + dx,
          eaveL: [src.x + dx, src.eaveL[1], -zE],
          eaveR: [src.x + dx, src.eaveR[1], zE],
          ridge: [src.x + dx, src.ridge[1], 0]
        });
      }
      for (let i = 0; i < stations.length - 1; i++) {
        const a = stations[i], b = stations[i + 1];
        // 两侧坡面
        mb.quad(a.eaveR, b.eaveR, b.ridge, a.ridge, r.tile, '廊顶');
        mb.quad(b.eaveL, a.eaveL, a.ridge, b.ridge, r.tile, '廊顶');
        // 瓦垄：脊上补一道深色压顶，檐口收边
        mb.quad([a.ridge[0], a.ridge[1] + 0.02, -0.1], [b.ridge[0], b.ridge[1] + 0.02, -0.1],
          [b.ridge[0], b.ridge[1] + 0.02, 0.1], [a.ridge[0], a.ridge[1] + 0.02, 0.1], r.tileB, '廊顶·脊');
        GF.beamBetween(mb, [a.eaveR[0], a.eaveR[1] - 0.1, a.eaveR[2]], [b.eaveR[0], b.eaveR[1] - 0.1, b.eaveR[2]], 0.12, 0.14, 'woodDark', '廊顶·连檐');
        GF.beamBetween(mb, [a.eaveL[0], a.eaveL[1] - 0.1, a.eaveL[2]], [b.eaveL[0], b.eaveL[1] - 0.1, b.eaveL[2]], 0.12, 0.14, 'woodDark', '廊顶·连檐');
      }
      // 两端山面封口，避免从端头看进空腔
      for (const s of [stations[0], stations[stations.length - 1]]) {
        mb.tri(s.eaveL, s.eaveR, s.ridge, 'wood', '廊顶·山面');
        mb.tri(s.eaveR, s.eaveL, s.ridge, 'wood', '廊顶·山面');
      }
    }
  }

  /* ------------------------------ 阁（多层+平座） ------------------------------ */
  // 旧配方（未开 pingzuo / 抱厦 / 城关 / 欢门）走原路径，几何与既有预置完全一致
  function buildGeLegacy(mb, r) {
    const bays = Math.max(1, r.bays);
    let W = bays * r.bayW, D = r.depth;
    // 楼阁：底层平座 + 腰檐出挑很宽，台基必须跟着放大，否则整座“头大脚细”
    const pad = 0.62 + r.eave * 0.35 + 0.2;
    const b = base(mb, r, { W: W + pad * 2, D: D + pad * 2 });
    let y = b.h + 0.04;
    const floors = Math.max(1, r.floors);
    const fh = r.floorH;

    for (let f = 0; f < floors; f++) {
      const isTop = f === floors - 1;
      const top = body(mb, {
        W, D, baseY: y, floors: 1, floorH: (Array.isArray(r.floorHList) && r.floorHList[f]) || fh, bays,
        wallMat: r.wallMat, colMat: r.colMat, cut: f === 0 ? r.cut : { roof: r.cut.roof },
        winW: r.winW, winH: r.winH, winPattern: r.winPattern,
        doorW: r.doorW, doorH: r.doorH, doorStyle: r.doorStyle, doorLeaves: r.doorLeaves,
        eave: r.eave, tile: r.tile, tileB: r.tileB, upturn: r.upturn,
        dougong: r.dougong, dgScale: r.dgScale, dgStyle: r.dgStyle, dgEye: r.dgEye,
        queti: r.queti, sideWindows: false
      });
      if (isTop) {
        if (r.ceiling && r.ceiling !== 'none') {
          const cy = top.topY - 0.3;
          P.ceiling(mb, { x0: -W / 2 + 0.25, x1: W / 2 - 0.25, z0: -D / 2 + 0.25, z1: D / 2 - 0.25, y: cy });
          if (r.ceiling === 'caisson') P.caisson(mb, 0, 0, cy, Math.min(W * 0.5, 3.0), Math.min(D * 0.5, 2.8));
        }
        if (!r.cut.roof) {
          GF.roofs.build(mb, {
            cx: 0, cz: 0,
            x0: -W / 2 - r.eave, x1: W / 2 + r.eave,
            z0: -D / 2 - r.eave, z1: D / 2 + r.eave,
            yb: top.topY, rise: r.slope * (D / 2 + r.eave) * 0.92,
            type: r.roofType === 'gable' ? 'gableHip' : r.roofType,
            tile: r.tile, tileB: r.tileB, upturn: r.upturn,
            ridgeStyle: r.ridgeStyle, beasts: r.beasts, finial: !!r.finial,
            xuanYu: r.xuanYu, windDuo: r.windDuo, trim: r.trimColor ? r.trimMat : null,
            gableMat: r.wallMat, tag: '阁顶'
          });
        }
        break;
      }
      // 平座挑台
      const py = top.topY + 0.04;
      const ex = 0.62;
      mb.box(-W / 2 - ex, W / 2 + ex, py - 0.3, py, -D / 2 - ex, D / 2 + ex, 'wood', '平座');
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          mb.boxC(sx * (W / 2 + ex - 0.25), sz * (D / 2 + ex - 0.25), 0.16, 0.16, py - 0.66, py - 0.3, 'wood', '平座·撑木');
        }
      }
      P.railing(mb, { a: [-W / 2 - ex, D / 2 + ex], b: [W / 2 + ex, D / 2 + ex], y: py, style: 'wood', tag: '平座栏杆' });
      P.railing(mb, { a: [-W / 2 - ex, -D / 2 - ex], b: [-W / 2 - ex, D / 2 + ex], y: py, style: 'wood', tag: '平座栏杆' });
      P.railing(mb, { a: [W / 2 + ex, -D / 2 - ex], b: [W / 2 + ex, D / 2 + ex], y: py, style: 'wood', tag: '平座栏杆' });
      // 腰檐（围一圈披檐，把上下层衔接起来）
      if (!r.cut.roof) {
        GF.roofs.skirt(mb, {
          cx: 0, cz: 0, x0: -W / 2 - ex, x1: W / 2 + ex, z0: -D / 2 - ex, z1: D / 2 + ex,
          xi: (W * 0.88) / 2 + 0.12, zi: (D * 0.88) / 2 + 0.12,
          yb: py + 0.02, ytop: py + 0.06 + fh * 0.46,
          tile: r.tile, tileB: r.tileB, upturn: r.upturn * 0.8, tag: '腰檐' + (f + 1)
        });
      }
      y = py + 0.34;
      W *= 0.92; D *= 0.92;
    }
    if (r.plaque) {
      P.plaque(mb, { dir: 'front', at: D / 2 - 0.02, uc: 0, vc: y + fh * 0.62, w: 1.7, h: 0.55, chars: 3 });
    }
  }

  // 抱厦：侧向突出体量，屋面内檐插进主体墙皮 0.12m（留叠压，不留三角缝），
  // 外檐挑出抱厦进深；四角转角与主体屋面在墙皮线交圈。
  function addBaoxia(mb, r, o) {
    const { W, D, baseY, colTop, fhF, ev, floor } = o;
    const bp = r.baoxiaD || 1.3;
    const bwZ = W * (r.baoxiaW || 0.44);   // 前后抱厦面宽
    const bwX = D * (r.baoxiaW || 0.44);   // 左右抱厦面宽
    const tuck = 0.12;
    const joints = [];
    const sides = [
      { dir: 'front', axis: 'z', s: 1, bw: bwZ },
      { dir: 'back', axis: 'z', s: -1, bw: bwZ },
      { dir: 'right', axis: 'x', s: 1, bw: bwX },
      { dir: 'left', axis: 'x', s: -1, bw: bwX }
    ];
    for (const sd of sides) {
      const face = sd.axis === 'z' ? D / 2 : W / 2;
      const inner = sd.s * (face - tuck);   // 内檐：插进墙皮
      const outer = sd.s * (face + bp + ev * 0.7);
      const projEnd = sd.s * (face + bp * 0.8);
      const roofO = { tile: r.tile, tileB: r.tileB, upturn: r.upturn * 0.85, ridgeStyle: 'plain', beasts: 0, finial: false, tag: '抱厦·' + sd.dir };
      if (sd.axis === 'z') {
        // 两山 cheek wall
        for (const sx of [-1, 1]) {
          mb.box(sx * sd.bw / 2 - 0.09, sx * sd.bw / 2 + 0.09, baseY, colTop - 0.28,
            Math.min(face - tuck, projEnd), Math.max(face - tuck, projEnd), r.wallMat, '抱厦·山墙');
          mb.cyl(sx * sd.bw / 2, projEnd, 0.14, baseY, colTop, 8, r.colMat, '抱厦·角柱');
        }
        // 前脸墙（带窗暗面）
        mb.box(-sd.bw / 2, sd.bw / 2, baseY, colTop - 0.28, Math.min(projEnd - 0.09, projEnd + 0.09), Math.max(projEnd - 0.09, projEnd + 0.09), r.wallMat, '抱厦·脸墙');
        mb.box(-sd.bw * 0.28, sd.bw * 0.28, baseY + fhF * 0.34, baseY + fhF * 0.72, projEnd - 0.1, projEnd + 0.02, 'dark', '抱厦·窗');
        if (!r.cut.roof) {
          GF.roofs.build(mb, Object.assign(roofO, {
            cx: 0, cz: 0,
            x0: -sd.bw / 2 - ev * 0.5, x1: sd.bw / 2 + ev * 0.5,
            z0: Math.min(inner, outer), z1: Math.max(inner, outer),
            yb: colTop, rise: r.slope * (bp + ev * 0.7) * 0.8, type: 'gableHip',
            gableMat: r.wallMat
          }));
        }
      } else {
        for (const sz of [-1, 1]) {
          mb.box(Math.min(face - tuck, projEnd), Math.max(face - tuck, projEnd), baseY, colTop - 0.28,
            sz * sd.bw / 2 - 0.09, sz * sd.bw / 2 + 0.09, r.wallMat, '抱厦·山墙');
          mb.cyl(projEnd, sz * sd.bw / 2, 0.14, baseY, colTop, 8, r.colMat, '抱厦·角柱');
        }
        mb.box(Math.min(projEnd - 0.09, projEnd + 0.09), Math.max(projEnd - 0.09, projEnd + 0.09), baseY, colTop - 0.28, -sd.bw / 2, sd.bw / 2, r.wallMat, '抱厦·脸墙');
        mb.box(projEnd - 0.1, projEnd + 0.02, baseY + fhF * 0.34, baseY + fhF * 0.72, -sd.bw * 0.28, sd.bw * 0.28, 'dark', '抱厦·窗');
        if (!r.cut.roof) {
          GF.roofs.build(mb, Object.assign(roofO, {
            cx: 0, cz: 0,
            x0: Math.min(inner, outer), x1: Math.max(inner, outer),
            z0: -sd.bw / 2 - ev * 0.5, z1: sd.bw / 2 + ev * 0.5,
            yb: colTop, rise: r.slope * (bp + ev * 0.7) * 0.8, type: 'gableHip',
            gableMat: r.wallMat
          }));
        }
      }
      joints.push({
        side: sd.dir, axis: sd.axis,
        wallFace: sd.s * face, innerEave: inner, outerEave: outer,
        overlap: tuck,
        // 负值＝内檐叠压进墙皮（无三角缝），0＝齐墙，正值＝留缝
        gap: sd.s * inner - face
      });
    }
    return joints;
  }

  // 彩楼欢门：临时门楼意象——两根高杆 + 横额 + 一道挑出的披檐（不设虚构米数，比例随层高）
  function addHuamen(mb, r, W, D, y0, h) {
    const z = D / 2 + 0.8;
    const ph = h * 1.12;
    const px = W / 2 - 0.9;
    for (const sx of [-1, 1]) {
      mb.cyl(sx * px, z, 0.12, y0, y0 + ph, 8, r.colMat, '欢门·杆');
      mb.boxC(sx * px, z, 0.22, 0.22, y0, y0 + 0.12, 'stone', '欢门·杆础');
    }
    GF.beamBetween(mb, [-px, y0 + ph - 0.28, z], [px, y0 + ph - 0.28, z], 0.14, 0.26, 'woodDark', '欢门·横额');
    if (!r.cut.roof) {
      GF.roofs.skirt(mb, {
        cx: 0, cz: z,
        x0: -W / 2 - 0.25, x1: W / 2 + 0.25, z0: z - 0.35, z1: z + 0.55,
        xi: W / 2 - 0.4, zi: 0.1,
        yb: y0 + ph, ytop: y0 + ph + 0.42,
        tile: r.tile, tileB: r.tileB, upturn: r.upturn * 0.7, tag: '欢门·披檐'
      });
    }
    // 两侧垂挂彩幡条（简化为竖向木板）
    for (const sx of [-1, 1]) {
      mb.box(sx * (px - 0.35) - 0.08, sx * (px - 0.35) + 0.08, y0 + ph - 1.05, y0 + ph - 0.32, z - 0.05, z + 0.05, 'cloth', '欢门·彩幡');
    }
  }

  // 分层修正路径：腰檐檐底压柱头、平座面接住上层屋身、逐层斗拱 / 收分 / 出檐数组化
  function buildGeLayered(mb, r) {
    const bays = Math.max(1, r.bays);
    const W0 = bays * r.bayW, D0 = r.depth;
    const floors = Math.max(1, r.floors);
    const fh = r.floorH;
    const schedule = [];
    mb.schedule = schedule;

    // 台基 / 城关城台
    let y0;
    let terrace = null;
    if (r.terraceGate) {
      const TW = r.width || W0 + 3.6, TD = r.depthTower || D0 + 2.6;
      terrace = buildTerrace(mb, r, {
        W: TW, D: TD, wallH: r.wallH || 4.6, gateW: r.gateW || 2.8, gateH: r.gateH || 3.4, closed: false
      });
      y0 = terrace.topY + 0.04;
      // 台上四角陪亭（低于主阁，落城台边角、探出主楼轮廓）
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          smallPavilion(mb, r, sx * (TW / 2 - 0.95), sz * (TD / 2 - 0.95), 0.78, 2.1, 'pyramid', '角亭', y0);
        }
      }
    } else {
      const pad = 0.62 + r.eave * 0.35 + 0.2;
      const b = base(mb, r, { W: W0 + pad * 2, D: D0 + pad * 2 });
      y0 = b.h + 0.04;
    }

    const shrinkAt = (i) => {
      if (Array.isArray(r.shrinkList) && r.shrinkList.length) {
        let acc = 1;
        for (let k = 0; k < i; k++) acc *= (r.shrinkList[k] || 0.92);
        return acc;
      }
      return Math.pow(0.92, i);
    };
    const eaveAt = (i) => (Array.isArray(r.eaveList) && r.eaveList[i] != null) ? r.eaveList[i] : r.eave;
    const dgAt = (i) => (Array.isArray(r.dgList) && r.dgList[i]) || 0;

    let y = y0;
    for (let f = 0; f < floors; f++) {
      const isTop = f === floors - 1;
      const k = shrinkAt(f);
      const Wf = W0 * k, Df = D0 * k;
      const fhF = (Array.isArray(r.floorHList) && r.floorHList[f]) || fh;
      const evF = eaveAt(f);
      const baseY = y;
      const dgLvF = dgAt(f);
      const top = body(mb, {
        W: Wf, D: Df, baseY, floors: 1, floorH: fhF, bays,
        wallMat: r.wallMat, colMat: r.colMat, cut: f === 0 ? r.cut : { roof: r.cut.roof },
        winW: r.winW, winH: r.winH, winPattern: r.winPattern,
        doorW: r.doorW, doorH: r.doorH, doorStyle: r.doorStyle, doorLeaves: r.doorLeaves,
        eave: evF, tile: r.tile, tileB: r.tileB, upturn: r.upturn,
        dougong: dgLvF > 0 ? false : r.dougong, dgScale: r.dgScale, dgStyle: r.dgStyle, dgEye: r.dgEye,
        queti: r.queti, sideWindows: false
      });
      const colTop = top.topY;
      const rec = { floor: f + 1, baseY, colTop, eaveBottom: null, pingzuo: null, nextBase: null, roofEave: null, joints: [] };

      // 抱厦（逐层）
      if (r.baoxia) {
        rec.joints = addBaoxia(mb, r, { W: Wf, D: Df, baseY, colTop, fhF, ev: evF, floor: f + 1 });
      }

      if (isTop) {
        if (r.ceiling && r.ceiling !== 'none') {
          const cy = colTop - 0.3;
          P.ceiling(mb, { x0: -Wf / 2 + 0.25, x1: Wf / 2 - 0.25, z0: -Df / 2 + 0.25, z1: Df / 2 - 0.25, y: cy });
          if (r.ceiling === 'caisson') P.caisson(mb, 0, 0, cy, Math.min(Wf * 0.5, 3.0), Math.min(Df * 0.5, 2.8));
        }
        if (!r.cut.roof) {
          GF.roofs.build(mb, {
            cx: 0, cz: 0,
            x0: -Wf / 2 - evF, x1: Wf / 2 + evF,
            z0: -Df / 2 - evF, z1: Df / 2 + evF,
            yb: colTop, rise: r.slope * (Df / 2 + evF) * 0.92,
            type: r.roofType === 'gable' ? 'gableHip' : r.roofType,
            tile: r.tile, tileB: r.tileB, upturn: r.upturn,
            ridgeStyle: r.ridgeStyle, beasts: r.beasts, finial: !!r.finial,
            xuanYu: r.xuanYu, windDuo: r.windDuo, trim: r.trimColor ? r.trimMat : null,
            gableMat: r.wallMat, tag: '阁顶'
          });
          rec.roofEave = colTop;
        }
        schedule.push(rec);
        break;
      }

      // 滴水数多于层数时：底层腰部再加一道下檐（副阶腰檐，四滴水之类）
      if (r.tiers > floors && f === 0 && !r.cut.roof) {
        const yMid = baseY + fhF * 0.5;
        GF.roofs.skirt(mb, {
          cx: 0, cz: 0,
          x0: -Wf / 2 - evF * 1.15, x1: Wf / 2 + evF * 1.15,
          z0: -Df / 2 - evF * 1.15, z1: Df / 2 + evF * 1.15,
          xi: Wf / 2 - 0.5, zi: Df / 2 - 0.5,
          yb: yMid, ytop: yMid + 0.46,
          tile: r.tile, tileB: r.tileB, upturn: r.upturn, trim: r.trimColor ? r.trimMat : null,
          tag: '底层下檐'
        });
        rec.midEave = yMid;
      }

      // 腰檐：外檐底压柱头（yb = colTop），内檐收到上层身轮廓之下，不插进上层墙身
      const eaveH = 0.5 + (r.slope || 0.5) * 0.3;
      const kNext = shrinkAt(f + 1);
      const Wn = W0 * kNext, Dn = D0 * kNext;
      if (!r.cut.roof) {
        const dgLv = dgAt(f);
        if (dgLv > 0) {
          // 逐层斗拱：贴腰檐外檐下沿，沿四面排布
          const dgS = (r.dgScale || 0.9) * (0.85 + 0.05 * dgLv);
          const nX = Math.max(2, Math.round(Wf / 1.8));
          const nZ = Math.max(2, Math.round(Df / 1.8));
          for (let i = 0; i <= nX; i++) {
            const cx = -Wf / 2 + (Wf * i) / nX;
            for (const cz of [Df / 2 + 0.1, -Df / 2 - 0.1]) {
              P.dougong(mb, cx, colTop - 0.12, cz, dgS, '斗拱·腰檐', r.dgStyle || 'mid');
            }
          }
          for (let i = 0; i <= nZ; i++) {
            const cz = -Df / 2 + (Df * i) / nZ;
            for (const cx of [Wf / 2 + 0.1, -Wf / 2 - 0.1]) {
              P.dougong(mb, cx, colTop - 0.12, cz, dgS, '斗拱·腰檐', r.dgStyle || 'mid');
            }
          }
        }
        GF.roofs.skirt(mb, {
          cx: 0, cz: 0,
          x0: -Wf / 2 - evF, x1: Wf / 2 + evF,
          z0: -Df / 2 - evF, z1: Df / 2 + evF,
          xi: Wn / 2 - 0.06, zi: Dn / 2 - 0.06,
          yb: colTop, ytop: colTop + eaveH,
          tile: r.tile, tileB: r.tileB, upturn: r.upturn * 0.8,
          trim: r.trimColor ? r.trimMat : null, tag: '腰檐' + (f + 1)
        });
        rec.eaveBottom = colTop;
      }

      // 平座：面板顶面 pzY 即上层屋身起始标高（nextBase = pzY，间隙 0，不留缝）
      const pzY = colTop + eaveH + 0.02;
      const ex = 0.62;
      mb.box(-Wf / 2 - ex, Wf / 2 + ex, pzY - 0.28, pzY, -Df / 2 - ex, Df / 2 + ex, 'wood', '平座');
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          mb.boxC(sx * (Wf / 2 + ex - 0.25), sz * (Df / 2 + ex - 0.25), 0.16, 0.16, pzY - 0.62, pzY - 0.28, 'woodDark', '平座·撑斗');
        }
      }
      const pzStyle = r.pingzuoStyle === 'marble' ? 'marble' : 'wood';
      P.railing(mb, { a: [-Wf / 2 - ex, Df / 2 + ex], b: [Wf / 2 + ex, Df / 2 + ex], y: pzY, style: pzStyle, tag: '平座栏杆' });
      P.railing(mb, { a: [-Wf / 2 - ex, -Df / 2 - ex], b: [-Wf / 2 - ex, Df / 2 + ex], y: pzY, style: pzStyle, tag: '平座栏杆' });
      P.railing(mb, { a: [Wf / 2 + ex, -Df / 2 - ex], b: [Wf / 2 + ex, Df / 2 + ex], y: pzY, style: pzStyle, tag: '平座栏杆' });
      rec.pingzuo = pzY;
      y = pzY;
      rec.nextBase = y;
      schedule.push(rec);
    }

    if (r.huamen) addHuamen(mb, r, W0, D0, y0, fh);
    if (r.plaque) {
      P.plaque(mb, { dir: 'front', at: D0 / 2 - 0.02, uc: 0, vc: y0 + fh * 0.62, w: 1.7, h: 0.55, chars: 3 });
    }
  }

  function buildGe(mb, r) {
    const layered = r.pingzuo === true || r.baoxia || r.terraceGate || r.huamen;
    if (layered) buildGeLayered(mb, r);
    else buildGeLegacy(mb, r);
  }

  /* ------------------------------ 水榭 ------------------------------ */
  function buildXie(mb, r) {
    const bays = Math.max(1, r.bays);
    const W = bays * r.bayW * 0.94, D = r.depth * 0.66;
    const h = Math.max(0.6, r.baseH) + 0.22;
    // 临水石台（柱插入水中）
    mb.box(-W / 2 - 0.45, W / 2 + 0.45, 0, h - 0.1, -D / 2 - 0.45, D / 2 + 0.45, 'stoneDark', '水榭·石台');
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        mb.boxC(sx * (W / 2 + 0.16), sz * (D / 2 + 0.16), 0.36, 0.36, 0, h, 'stone', '水榭·石柱');
      }
    }
    mb.box(-W / 2 - 0.47, W / 2 + 0.47, h - 0.1, h, -D / 2 - 0.47, D / 2 + 0.47, 'slab', '榭台面');

    const colH = r.floorH;
    for (let i = 0; i <= bays; i++) {
      const x = -W / 2 + (W * i) / bays;
      for (const sz of [-1, 1]) {
        mb.cyl(x, sz * (D / 2 - 0.16), 0.16, h, h + colH, 8, r.colMat, '榭柱');
        mb.boxC(x, sz * (D / 2 - 0.16), 0.26, 0.26, h, h + 0.12, 'stone', '柱础');
      }
    }
    for (const sz of [-1, 1]) {
      P.lintel(mb, { dir: sz > 0 ? 'front' : 'back', at: sz * (D / 2 - 0.16), uc: 0, w: W, y: h + colH - 0.36, h: 0.28, th: 0.2, seg: Math.max(3, bays), tag: '榭额枋' });
      GF.beamBetween(mb, [-W / 2, h + colH - 0.62, sz * (D / 2 - 0.16)], [W / 2, h + colH - 0.62, sz * (D / 2 - 0.16)], 0.06, 0.16, 'wood', '挂落');
    }
    // 三面美人靠（正面 +z 留出入口）
    P.railing(mb, { a: [-W / 2, -D / 2], b: [W / 2, -D / 2], y: h, style: 'beauty', tag: '美人靠' });
    P.railing(mb, { a: [-W / 2, -D / 2], b: [-W / 2, D / 2], y: h, style: 'beauty', tag: '美人靠' });
    P.railing(mb, { a: [W / 2, -D / 2], b: [W / 2, D / 2], y: h, style: 'beauty', tag: '美人靠' });
    // 正面石阶：两级，正对门口与匾额
    const stairW = Math.min(2.4, W * 0.42);
    mb.box(-stairW / 2, stairW / 2, h - 0.18, h - 0.02, D / 2 + 0.47, D / 2 + 0.95, 'slab', '榭前石阶');
    mb.box(-stairW / 2, stairW / 2, h * 0.5 - 0.14, h * 0.5, D / 2 + 0.95, D / 2 + 1.45, 'slab', '榭前石阶');
    // 室内：石桌
    P.furniture(mb, 'table', 0, 0, 1, 0, '榭中石桌');
    // 榭顶（卷棚或歇山）
    if (!r.cut.roof) {
      GF.roofs.build(mb, {
        cx: 0, cz: 0,
        x0: -W / 2 - r.eave, x1: W / 2 + r.eave,
        z0: -D / 2 - r.eave, z1: D / 2 + r.eave,
        yb: h + colH, rise: r.slope * (D / 2 + r.eave) * 0.8,
        type: r.roofType || 'roll',
        tile: r.tile, tileB: r.tileB, upturn: r.upturn * 1.1,
        ridgeStyle: r.ridgeStyle, beasts: 0, finial: false,
        xuanYu: r.xuanYu, windDuo: true, gableMat: r.wallMat, tag: '榭顶'
      });
    }
    if (r.plaque) P.plaque(mb, { dir: 'front', at: D / 2 - 0.02, uc: 0, vc: h + colH - 0.8, w: 1.3, h: 0.44, chars: 2 });
    // 接岸曲桥：从正面石阶接出去，与门口、匾额同一轴
    if (r.env.path) {
      P.quBridge(mb, [[0, D / 2 + 1.4], [0.9, D / 2 + 3.0], [0, D / 2 + 4.6]], 1.1, '接岸曲桥');
    }
  }

  /* ------------------------------ 画舫 ------------------------------ */
  function buildFang(mb, r) {
    if (r.fangStyle === 'shifang') return buildFang3(mb, r);
    const L = r.span || 12, Wd = r.bridgeW || 3.4;
    const deckY = 0.86;
    const half = Wd / 2;
    const pts = [
      [-L / 2, 0], [-L / 2 + 1.3, -half], [L / 2 - 2.6, -half],
      [L / 2 + 1.7, 0], [L / 2 - 2.6, half], [-L / 2 + 1.3, half]
    ];
    mb.prism(pts, 0, deckY, 'woodDark', '船体');
    mb.prism(pts.map((p) => [p[0] * 0.94, p[1] * 0.9]), deckY, deckY + 0.08, 'wood', '甲板');
    // 船头翘起的雕饰
    mb.boxC(L / 2 + 1.5, 0, 0.3, 0.3, deckY, deckY + 0.32, 'zhu', '船首');
    // 舱（前舱高、后舱低）
    const cx0 = -L / 4, cabW = L * 0.42, cabD = Wd * 0.66;
    const cabH = r.floorH * 0.86;
    for (const [ox, wMul, hMul] of [[-0.12, 1.0, 1.0], [0.3, 0.72, 0.74]]) {
      const cw = cabW * wMul, cw0 = cx0 + L * ox;
      const ch = cabH * hMul;
      const y0 = deckY + 0.08;
      // 舱壁
      for (const sz of [-1, 1]) {
        mb.box(cw0 - cw / 2, cw0 + cw / 2, y0, y0 + ch, sz * cabD / 2 - 0.08, sz * cabD / 2 + 0.08, 'wood', '舱壁');
      }
      mb.box(cw0 - cw / 2, cw0 + cw / 2, y0 + ch - 0.16, y0 + ch, -cabD / 2, cabD / 2, 'wood', '舱顶梁');
      // 格心窗
      for (let i = 0; i < 3; i++) {
        const wx = cw0 - cw / 2 + cw * (i + 0.5) / 3;
        mb.boxC(wx, cabD / 2, cw / 4.2, 0.1, y0 + ch * 0.42, y0 + ch * 0.78, 'paper', '舫窗');
      }
      // 卷棚舱顶
      if (!r.cut.roof) {
        GF.roofs.build(mb, {
          cx: cw0, cz: 0,
          x0: cw0 - cw / 2 - 0.25, x1: cw0 + cw / 2 + 0.25,
          z0: -cabD / 2 - 0.28, z1: cabD / 2 + 0.28,
          yb: y0 + ch, rise: 0.62, type: 'roll',
          tile: r.tile, tileB: r.tileB, upturn: 0.14, ridgeStyle: 'plain',
          gableMat: 'wood', tag: '舱顶'
        });
      }
    }
    // 舷边美人靠 + 橹
    for (const sz of [-1, 1]) {
      P.railing(mb, { a: [-L / 2 + 1.4, sz * (half - 0.12)], b: [L / 2 - 1.0, sz * (half - 0.12)], y: deckY + 0.08, style: 'beauty', tag: '舷栏' });
    }
    mb.boxC(-L / 2 - 0.2, half * 0.5, 0.1, 0.1, deckY, deckY + 1.9, 'wood', '橹');
  }

  /* ---------------- 阶段④-6 石舫 / 旱船（三段：尾舱二层 > 前舱敞亭 > 中舱船篷） ---------------- */
  function buildFang3(mb, r) {
    const L = r.span || 13, Wd = r.bridgeW || 3.6;
    const deckY = 0.86, half = Wd / 2;
    const pts = [
      [-L / 2, 0], [-L / 2 + 1.2, -half], [L / 2 - 2.4, -half],
      [L / 2 + 1.6, 0], [L / 2 - 2.4, half], [-L / 2 + 1.2, half]
    ];
    mb.prism(pts, 0, deckY, 'woodDark', '石舫·船体');
    mb.prism(pts.map((p) => [p[0] * 0.94, p[1] * 0.9]), deckY, deckY + 0.08, 'wood', '石舫·甲板');
    mb.boxC(L / 2 + 1.5, 0, 0.3, 0.3, deckY, deckY + 0.32, 'zhu', '船首');
    const stats = layStats(mb);

    // 尾舱（-x，二层楼阁，最高）
    const tail = { x: -L / 2 + L * 0.19, len: L * 0.30, D: Wd * 0.66 };
    const tailU = houseUnit(Object.assign({}, r, { baseH: 0.08, dougong: false, interior: [] }), {
      W: tail.len, D: tail.D, bays: 3, floors: 2, floorHList: [2.6, 2.3],
      roofType: 'gableHip', eave: 0.6, interior: [], cheap: true
    });
    tailU.mesh.translate(tail.x, deckY + 0.08, 0);
    mb.merge(tailU.mesh);
    stats.segs.push({ tag: '尾舱·二层楼阁', x: tail.x, z: 0, W: tail.len, D: tail.D, baseH: deckY + 0.08, topY: +(tailU.topY + deckY + 0.08).toFixed(3) });

    // 中舱（中段，最低，两坡船篷）
    const mid = { x: 0, len: L * 0.34, D: Wd * 0.6 };
    const midU = houseUnit(Object.assign({}, r, { baseH: 0.08, dougong: false, interior: [] }), {
      W: mid.len, D: mid.D, bays: 3, roofType: 'gable', eave: 0.5, interior: [], cheap: true
    });
    midU.mesh.translate(mid.x, deckY + 0.08, 0);
    mb.merge(midU.mesh);
    stats.segs.push({ tag: '中舱·船篷', x: mid.x, z: 0, W: mid.len, D: mid.D, baseH: deckY + 0.08, topY: +(midU.topY + deckY + 0.08).toFixed(3) });

    // 前舱（+x，高敞歇山敞亭，开敞无墙）
    const bow = { x: L / 2 - L * 0.19, len: L * 0.26, D: Wd * 0.7, colH: 2.6 };
    const bx0 = bow.x - bow.len / 2, bx1 = bow.x + bow.len / 2;
    for (const cx of [bx0 + 0.25, bow.x, bx1 - 0.25]) {
      for (const sz of [-1, 1]) {
        mb.cyl(cx, sz * (bow.D / 2 - 0.18), 0.14, deckY + 0.08, deckY + 0.08 + bow.colH, 8, r.colMat, '前舱·柱');
        mb.boxC(cx, sz * (bow.D / 2 - 0.18), 0.24, 0.24, deckY + 0.08, deckY + 0.2, 'stone', '前舱·础');
      }
    }
    for (const sz of [-1, 1]) {
      GF.beamBetween(mb, [bx0, deckY + 0.08 + bow.colH - 0.3, sz * (bow.D / 2 - 0.18)], [bx1, deckY + 0.08 + bow.colH - 0.3, sz * (bow.D / 2 - 0.18)], 0.14, 0.24, 'woodDark', '前舱·额枋');
    }
    if (!r.cut.roof) {
      GF.roofs.build(mb, {
        cx: bow.x, cz: 0, x0: bx0 - 0.3, x1: bx1 + 0.3, z0: -bow.D / 2 - 0.3, z1: bow.D / 2 + 0.3,
        yb: deckY + 0.08 + bow.colH, rise: 0.9, type: 'gableHip', tile: r.tile, tileB: r.tileB,
        upturn: 0.2, ridgeStyle: 'plain', beasts: 0, gableMat: 'wood', tag: '前舱·顶'
      });
    }
    stats.segs.push({ tag: '前舱·敞亭', x: bow.x, z: 0, W: bow.len, D: bow.D, baseH: deckY + 0.08, topY: +(deckY + 0.08 + bow.colH + 0.9).toFixed(3) });

    // 舷边美人靠
    for (const sz of [-1, 1]) {
      P.railing(mb, { a: [-L / 2 + 1.4, sz * (half - 0.12)], b: [L / 2 - 1.0, sz * (half - 0.12)], y: deckY + 0.08, style: 'beauty', tag: '舷栏' });
    }

    // 船头平桥接岸：桥面落在岸地标高（y≈0.12），不架在甲板高度
    const shoreX = L / 2 + 4.4, deckBridgeY = 0.12;
    mb.box(L / 2 + 1.2, shoreX, 0, deckBridgeY, -0.6, 0.6, 'stone', '接岸平桥');
    mb.box(L / 2 + 1.2, shoreX, deckBridgeY, deckBridgeY + 0.06, -0.6, 0.6, 'slab', '桥面');
    stats.bridge = { x0: L / 2 + 1.2, x1: shoreX, y: deckBridgeY, groundY: 0.1, width: 1.2 };
  }

  /* ------------------------------ 阙 ------------------------------ */
  function buildQue(mb, r) {
    const W = r.width || 11, D = 3.6, wallH = (r.wallH || 5) * 0.55;
    const t = 0.7, gw = 3.4, gh = wallH - 0.9;
    // 券洞：下部直墙 + 上部半圆（分 4 条横带近似）
    const gr = gw / 2, springY = Math.max(1.8, gh - gr * 0.9);
    const bands = [{ u0: -gw / 2, u1: gw / 2, v0: 0, v1: springY }];
    for (let k = 0; k < 4; k++) {
      const vc = k / 4 + 0.125;
      const hw = gr * Math.sqrt(Math.max(0.04, 1 - vc * vc));
      bands.push({ u0: -hw, u1: hw, v0: springY + (gr * 0.9 * k) / 4, v1: springY + (gr * 0.9 * (k + 1)) / 4 });
    }
    // 阙台（砖砌，中开券洞）
    P.wallWithHoles(mb, {
      dir: 'front', at: D / 2, u0: -W / 2, u1: W / 2, y0: 0, y1: wallH,
      holes: bands, thickness: t, mat: 'brick', tag: '阙台'
    });
    P.wallWithHoles(mb, {
      dir: 'back', at: -D / 2, u0: -W / 2, u1: W / 2, y0: 0, y1: wallH,
      holes: bands, thickness: t, mat: 'brick', tag: '阙台'
    });
    for (const side of ['left', 'right']) {
      const at = side === 'right' ? W / 2 : -W / 2;
      P.wallWithHoles(mb, {
        dir: side, at, u0: -D / 2, u1: D / 2, y0: 0, y1: wallH,
        holes: [], thickness: t, mat: 'brick', tag: '阙台'
      });
    }
    // 券洞内壁（暗）+ 券石
    for (const b of bands) {
      mb.box(b.u0 + 0.02, b.u1 - 0.02, b.v0, b.v1, -D / 2 + 0.05, D / 2 - 0.05, 'dark', '门洞');
    }
    for (let k = 0; k <= 10; k++) {
      const a = Math.PI * (k / 10);
      const ux = Math.cos(a) * (gr + 0.08), vy = springY + Math.sin(a) * (gr * 0.9 + 0.08);
      for (const sz of [-1, 1]) {
        mb.box(ux - 0.18, ux + 0.18, vy - 0.14, vy + 0.14, sz * D / 2 - 0.1, sz * D / 2 + 0.1, 'slab', '券石');
      }
    }
    // 台面 + 城垛
    mb.box(-W / 2, W / 2, wallH - 0.2, wallH, -D / 2, D / 2, 'brick', '阙台面');
    const nb = Math.round(W / 1.1);
    for (let i = 0; i <= nb; i++) {
      const x = -W / 2 + (W * i) / nb;
      for (const sz of [-1, 1]) mb.boxC(x, sz * (D / 2 - 0.2), 0.5, 0.7, wallH, wallH + 0.7, 'brick', '城垛');
    }
    // 两侧子阙（高台 + 小屋顶）
    for (const sx of [-1, 1]) {
      const tx = sx * (W / 2 - 1.0);
      const tw = 2.0, td = 2.6, th = wallH + 2.2;
      mb.box(tx - tw / 2, tx + tw / 2, 0, th, -td / 2, td / 2, 'brick', '子阙');
      mb.box(tx - tw / 2 - 0.3, tx + tw / 2 + 0.3, th, th + 0.16, -td / 2 - 0.3, td / 2 + 0.3, 'slab', '子阙·台面');
      if (!r.cut.roof) {
        GF.roofs.build(mb, {
          cx: tx, cz: 0, x0: tx - tw / 2 - 0.5, x1: tx + tw / 2 + 0.5,
          z0: -td / 2 - 0.5, z1: td / 2 + 0.5, yb: th + 0.16,
          rise: 0.9, type: 'gableHip', tile: r.tile, tileB: r.tileB,
          upturn: 0.3, ridgeStyle: 'plain', beasts: 0, tag: '子阙顶'
        });
      }
    }
    if (r.plaque) P.plaque(mb, { dir: 'front', at: D / 2 + 0.06, uc: 0, vc: wallH - 0.55, w: 2.0, h: 0.5, chars: 3 });
  }

  /* ------------------------------ 长廊 ------------------------------ */
  function buildCorridor(mb, r) {
    const L = r.span || 14, Wd = r.bridgeW || 2.8;
    const m = corridorMesh(r, L, Wd, 0.32, {});
    mb.merge(m);
    // 两端台阶
    for (const sx of [-1, 1]) {
      mb.box(sx * L / 2, sx * (L / 2 + 1.4), 0, 0.32, -Wd / 2, Wd / 2, 'stone', '廊端石阶');
    }
  }

  /* ------------------------------ 露台 ------------------------------ */
  function buildTai(mb, r) {
    const W = r.width || 8, D = r.depth || 6, h = Math.max(0.6, r.baseH);
    P.platform(mb, {
      x0: -W / 2, x1: W / 2, z0: -D / 2, z1: D / 2, h,
      steps: r.steps, stepW: Math.min(3.4, W * 0.5), stepDir: 'front',
      style: r.pedestal || 'xumizuo', lotus: (r.pedestal || 'xumizuo') === 'xumizuo'
    });
    if (r.railing) {
      const st = r.railStyle || 'marble';
      for (const [a, b] of [
        [[-W / 2, -D / 2], [W / 2, -D / 2]],
        [[-W / 2, -D / 2], [-W / 2, D / 2]],
        [[W / 2, -D / 2], [W / 2, D / 2]]
      ]) P.railing(mb, { a, b, y: h, style: st, tag: '露台栏杆' });
    }
    // 台上陈设
    if (r.censer) P.censer(mb, 0, -0.6, 1.1, '露台香炉');
    for (const sx of [-1, 1]) {
      P.stoneLantern(mb, sx * (W / 2 - 1.2), D / 2 - 1.0, 1.0, '石灯');
    }
    if (r.lanterns) {
      for (const sx of [-1, 1]) P.lantern(mb, sx * (W / 2 - 0.9), h + 2.4, D / 2 - 0.4, 0.9, '灯笼');
    }
    // 一座小亭或碑，避免台面太空
    if (r.plaque) P.stele(mb, 0, D / 2 - 1.6, 1.0, '露台碑');
  }

  /* ------------------------------ 环境 ------------------------------ */
  function environment(mb, r) {
    ground(mb, r);
    const rng = new GF.RNG(r.seed + 91);
    const env = r.env;
    // 拖动结果：按 key 覆盖默认落位（key 稳定，列表变动时只影响同序号）
    const mv = env.move || {};
    const at = (key, x, z) => (mv[key] ? { x: mv[key].x, z: mv[key].z } : { x, z });
    mb.moves = [];
    const reg = (key, label, p, rad) => mb.moves.push({ key, label, x: p.x, z: p.z, r: rad || 0.8 });
    // 树
    const kinds = env.trees || [];
    kinds.forEach((k, i) => {
      const ang = (i / kinds.length) * Math.PI * 2 + 0.6;
      const dist = 6.5 + (i % 2) * 1.5;
      const p = at('tree' + i, Math.cos(ang) * dist, Math.sin(ang) * dist);
      P.tree(mb, p.x, p.z, k, rng, 0.9 + (i % 3) * 0.15, '树');
      reg('tree' + i, '树 ' + (i + 1), p, 1.1);
    });
    // 假山
    for (let i = 0; i < (env.rocks || 0); i++) {
      const ang = 2.4 + i * 0.9;
      const p = at('rock' + i, Math.cos(ang) * 5.2, Math.sin(ang) * 5.2);
      P.rock(mb, p.x, p.z, 1.0, rng, '假山');
      reg('rock' + i, '假山 ' + (i + 1), p, 1.2);
    }
    // 水池
    if (env.pond && env.showGround !== false && env.groundType !== 'lake') {
      const p = at('pond', env.pond.x || 5.5, env.pond.z || 4.5);
      P.pond(mb, p.x, p.z, env.pond.w || 3.4, env.pond.d || 2.4, '水池');
      reg('pond', '水池', p, Math.max(env.pond.w || 3.4, env.pond.d || 2.4) * 0.6);
    }
    // 幡旗：对称立在甬道两侧，避免正中挡门
    if (env.banners) {
      const nb = env.banners;
      for (let i = 0; i < nb; i++) {
        const s = i % 2 ? 1 : -1;
        const k = Math.floor(i / 2);
        const p = at('banner' + i, s * (3.4 + k * 3.2), 0);
        P.banner(mb, p.x, p.z, 4.2, 3.0, 0.7, '幡', 'cloth');
        reg('banner' + i, '幡 ' + (i + 1), p, 0.9);
      }
    }
    // 陈设道具（每项一件，沿院外散置）
    const props = env.props || [];
    props.forEach((p, i) => {
      const ang = 2.1 + i * 0.68;
      const d = 4.2 + (i % 3) * 1.2;
      const q = at('prop' + i, Math.cos(ang) * d, Math.sin(ang) * d);
      switch (p) {
        case 'stonelamp': P.stoneLantern(mb, q.x, q.z, 0.9, '石灯'); reg('prop' + i, '石灯', q); break;
        case 'well': P.well(mb, q.x, q.z, 0.9, '井'); reg('prop' + i, '井', q); break;
        case 'stele': P.stele(mb, q.x, q.z, 0.9, '碑'); reg('prop' + i, '碑', q); break;
        case 'bell': P.bellDrum(mb, q.x, q.z, 0.85, 'bell', '钟'); reg('prop' + i, '钟', q); break;
        case 'drum': P.bellDrum(mb, q.x, q.z, 0.85, 'drum', '鼓'); reg('prop' + i, '鼓', q); break;
        case 'penjing': P.penjing(mb, q.x, q.z, 0.9, '盆景'); reg('prop' + i, '盆景', q); break;
        case 'tiema': P.tieMaZhuang(mb, q.x, q.z, 0.9, '拴马桩'); reg('prop' + i, '拴马桩', q); break;
        case 'qubridge': P.quBridge(mb, [[3.0, 3.8], [4.8, 1.6], [3.4, -0.8]], 1.0, '曲桥'); break;
        default: break;
      }
    });
  }

  /* ============================ 阶段③ 城 ============================ */
  // 局部坐标（沿 +x 展布，+z 为外侧）网格 → 落到世界两点
  function placeRun(mb, sub, a, b) {
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const ang = -Math.atan2(dz, dx) * 180 / Math.PI;
    sub.rotateY(ang, 0, 0);
    sub.translate(a[0], 0, a[1]);
    mb.merge(sub);
  }

  // 一段城垣：石脚 → 砖身（收分 + 皮条线）→ 压顶条石；外侧雉堞望孔，内侧女墙
  function cityWallRun(mb, a, b, r, opt) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 0.5) return;
    const H = (opt && opt.wallH) || r.wallH;
    const bw = (opt && opt.baseW) || r.wallBaseW;
    const tw = (opt && opt.topW) || r.wallTopW;
    const sub = new GF.Mesh();
    const panels = Math.max(1, Math.ceil(L / 5));
    const pl = L / panels;
    for (let i = 0; i < panels; i++) {
      const x0 = i * pl, x1 = x0 + pl;
      sub.box(x0, x1, 0, 0.9, -bw / 2, bw / 2, 'stone', '城墙·石脚');
      sub.taper(pl / 2, 0, pl, bw, pl, tw, 0.9, H - 0.22, 'brick', '城墙·砖身');
      sub.box(x0, x1, H - 0.22, H, -tw / 2 - 0.12, tw / 2 + 0.12, 'stoneB', '城墙·压顶条石');
      sub.box(x0, x1, H, H + 0.06, -tw / 2 - 0.1, tw / 2 + 0.1, 'slab', '城墙顶面');
      const cy = 0.9 + (H - 1.12) * 0.5;
      sub.box(x0 + 0.05, x1 - 0.05, cy, cy + 0.05, tw / 2 - 0.02, tw / 2 + 0.05, 'brickB', '城墙·砖缝');
    }
    const doMerlon = !opt || opt.merlon !== false;
    const doParapet = !opt || opt.parapet !== false;
    if (doMerlon) {
      const step = 2.2;
      const n = Math.max(1, Math.floor(L / step));
      for (let i = 0; i <= n; i++) {
        const x = (L * i) / n;
        sub.boxC(x, tw / 2 + 0.14, 0.55, 0.7, H + 0.06, H + 0.72, 'brick', '垛口·雉堞');
        sub.boxC(x, tw / 2 + 0.5, 0.14, 0.06, H + 0.36, H + 0.6, 'dark', '望孔');
      }
    }
    if (doParapet) {
      sub.box(0, L, H, H + 0.42, -tw / 2 - 0.12, -tw / 2 + 0.1, 'brickB', '内侧女墙');
    }
    placeRun(mb, sub, a, b);
  }

  // 闭合城垣矩形圈（外郭 / 内城 / 宫城共用），可平移到 (cx, cz)
  function cityRing(mb, r, W, D, opt, cx, cz) {
    cx = cx || 0; cz = cz || 0;
    const a = [cx - W / 2, cz - D / 2], b = [cx + W / 2, cz - D / 2], c = [cx + W / 2, cz + D / 2], d = [cx - W / 2, cz + D / 2];
    cityWallRun(mb, a, b, r, opt);
    cityWallRun(mb, b, c, r, opt);
    cityWallRun(mb, c, d, r, opt);
    cityWallRun(mb, d, a, r, opt);
  }

  // 沿墙身的投影条带（环濠 / 驳岸用），u 沿墙、v 沿外法线，端部外延 ext 保证转角相接
  function cityStrip(mb, a, b, n, v0, v1, y0, y1, mat, tag, ext) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 0.5) return;
    const dir = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
    const e = ext || 0;
    const p = (u, v) => [a[0] + dir[0] * u + n[0] * v, a[1] + dir[1] * u + n[1] * v];
    const c00 = p(-e, v0), c10 = p(L + e, v0), c11 = p(L + e, v1), c01 = p(-e, v1);
    mb.quad([c00[0], y1, c00[1]], [c10[0], y1, c10[1]], [c11[0], y1, c11[1]], [c01[0], y1, c01[1]], mat, tag);
    mb.quad([c01[0], y0, c01[1]], [c11[0], y0, c11[1]], [c11[0], y1, c11[1]], [c01[0], y1, c01[1]], mat, tag);
    mb.quad([c10[0], y0, c10[1]], [c00[0], y0, c00[1]], [c00[0], y1, c00[1]], [c10[0], y1, c10[1]], mat, tag);
  }

  // 角台（转角咬合墙体）
  function cornerPlatform(mb, x, z, H, tw) {
    mb.boxC(x, z, tw + 0.7, tw + 0.7, 0, 0.9, 'stone', '角台·石脚');
    mb.boxC(x, z, tw + 0.5, tw + 0.5, 0.9, H - 0.22, 'brick', '角台·砖身');
    mb.boxC(x, z, tw + 0.62, tw + 0.62, H - 0.22, H, 'stoneB', '角台·压顶');
  }

  // 城门城台：多门道并排真券洞（doors: [{u, w, h}]）；台身加深，门洞内凹不被砖身吞并
  function cityGateTerrace(sub, r, Wg, Dg, doors, H) {
    const face = Dg / 2 + 0.5;
    sub.box(-Wg / 2, Wg / 2, 0, 0.9, -face - 0.2, face + 0.2, 'stone', '城门·石脚');
    sub.box(-Wg / 2, Wg / 2, 0.9, H - 0.22, -face, face, 'brick', '城门·城台');
    sub.box(-Wg / 2 - 0.18, Wg / 2 + 0.18, H - 0.22, H, -face - 0.1, face + 0.1, 'stoneB', '城门·压顶');
    sub.box(-Wg / 2 - 0.15, Wg / 2 + 0.15, H, H + 0.06, -face - 0.08, face + 0.08, 'slab', '城门台面');
    for (let y = 1.5; y < H - 0.45; y += 0.85) {
      sub.box(-Wg / 2 + 0.1, Wg / 2 - 0.1, y, y + 0.045, face - 0.08, face, 'brickB', '城门·砖缝');
      sub.box(-Wg / 2 + 0.1, Wg / 2 - 0.1, y, y + 0.045, -face, -face + 0.08, 'brickB', '城门·砖缝');
    }
    const nx = Math.max(8, Math.round(Wg / 0.9));
    for (let i = 0; i < nx; i++) {
      const x0 = -Wg / 2 + (Wg * i) / nx, x1 = -Wg / 2 + (Wg * (i + 1)) / nx;
      const cxm = (x0 + x1) / 2;
      let hTop = H;
      for (const d of doors) {
        const t = Math.min(1, Math.abs(cxm - d.u) / (d.w / 2));
        const hh = d.h - Math.sqrt(Math.max(0, 1 - t * t)) * (d.w / 2) * 0.9;
        if (hh < hTop) hTop = hh;
      }
      if (hTop > 0.3) sub.box(x0, x1, hTop, H, -face, face, 'brick', '城门·城台');
    }
    for (const d of doors) {
      // 门洞深色内膛：两侧留砖壳，券洞从台身贯通
      sub.box(d.u - d.w / 2 - 0.1, d.u + d.w / 2 + 0.1, 0, d.h * 0.95, -(face - 0.1), face - 0.1, 'dark', '门洞');
      // 贴正/背面的深色洞口板，保证五券洞内膛一致发暗，不透台身砖面
      for (const sz of [-1, 1]) {
        sub.box(d.u - d.w / 2 + 0.04, d.u + d.w / 2 - 0.04, 0.05, d.h * 0.86, sz * (face - 0.14), sz * (face + 0.02), 'dark', '门洞');
      }
      const archR = d.w / 2 + 0.12, archCy = d.h * 0.4;
      for (const sz of [-1, 1]) {
        const zf = sz * (face + 0.05);
        for (let k = 0; k <= 9; k++) {
          const a = Math.PI * (0.06 + 0.88 * k / 9);
          const px = d.u + Math.cos(a) * archR, py = archCy + Math.sin(a) * archR * 0.78;
          sub.boxC(px, zf + sz * 0.17, 0.3, 0.16, py - 0.18, py + 0.18, 'stoneB', '券脸石');
        }
        sub.boxC(d.u - archR, zf + sz * 0.17, 0.36, 0.18, archCy - 0.6, archCy - 0.1, 'stone', '券脚');
        sub.boxC(d.u + archR, zf + sz * 0.17, 0.36, 0.18, archCy - 0.6, archCy - 0.1, 'stone', '券脚');
      }
      for (const sz of [-1, 1]) {
        const z = sz * (face - 0.18);
        sub.box(d.u - d.w / 2 + 0.06, d.u - 0.03, 0.1, d.h * 0.76, z, z + sz * 0.1, 'zhu', '城门');
        sub.box(d.u + 0.03, d.u + d.w / 2 - 0.06, 0.1, d.h * 0.76, z, z + sz * 0.1, 'zhu', '城门');
        sub.box(d.u - 0.03, d.u + 0.03, 0.1, d.h * 0.76, z, z + sz * 0.12, 'woodDark', '门缝');
      }
    }
  }

  // 城门楼（城台上的简化殿身 + 歇山顶；cheap 时低模屋顶）
  function cityGateTower(sub, r, Wg, Dg, H, cheap) {
    const W2 = Wg * 0.66, D2 = Dg * 0.7;
    const top = body(sub, {
      W: W2, D: D2, baseY: H + 0.06, floors: 1, floorH: 3.0, bays: 3,
      wallMat: r.wallMat, colMat: r.colMat, cut: {},
      winW: 1.0, winH: 1.1, winPattern: 'straight', doorW: 1.5, doorH: 2.2,
      eave: r.eave, tile: r.tile, tileB: r.tileB, upturn: r.upturn, dougong: false, sideWindows: false, noFloor: true
    });
    if (cheap) {
      cityCheapRoof(sub, 0, 0, W2 + r.eave * 2, D2 + r.eave * 2, top.topY, r.slope * (D2 / 2 + r.eave), r.tile, r.tileB, '城楼顶');
    } else {
      GF.roofs.build(sub, {
        cx: 0, cz: 0, x0: -W2 / 2 - r.eave, x1: W2 / 2 + r.eave,
        z0: -D2 / 2 - r.eave, z1: D2 / 2 + r.eave,
        yb: top.topY, rise: r.slope * (D2 / 2 + r.eave) * 1.1, type: 'gableHip',
        tile: r.tile, tileB: r.tileB, upturn: r.upturn, ridgeStyle: 'ornate', beasts: 2, tag: '城楼顶'
      });
    }
  }

  // 马面（敌台）：突出墙外，台上铺舍 / 橹顶
  function cityBastion(mb, r, p, n, H) {
    const w = r.wallTopW + 1.2, proj = r.bastionProj;
    const cx = p[0] + n[0] * (proj / 2 + r.wallTopW / 2);
    const cz = p[1] + n[1] * (proj / 2 + r.wallTopW / 2);
    mb.boxC(cx, cz, w, proj + r.wallTopW, 0, 0.9, 'stone', '马面·石脚');
    mb.boxC(cx, cz, w * 0.94, proj + r.wallTopW * 0.9, 0.9, H - 0.22, 'brick', '马面·台身');
    mb.boxC(cx, cz, w + 0.1, proj + r.wallTopW * 0.9 + 0.1, H - 0.22, H, 'stoneB', '马面·压顶');
    const hw = w * 0.5;
    mb.boxC(cx, cz, hw, hw * 0.8, H, H + 0.5, 'wood', '马面·铺舍');
    cityCheapRoof(mb, cx, cz, hw + 0.4, hw * 0.8 + 0.4, H + 0.5, 0.5, r.tile, r.tileB, '马面·橹顶');
  }

  // 角楼：角台上一座小十字脊楼阁，体量小于城门楼
  function cityCornerTower(mb, r, x, z, H) {
    cornerPlatform(mb, x, z, H, r.wallTopW);
    const sub = new GF.Mesh();
    const W = 3.2, D = 3.2;
    const top = body(sub, {
      W, D, baseY: H + 0.08, floors: 1, floorH: 2.4, bays: 2,
      wallMat: r.wallMat, colMat: r.colMat, cut: {},
      winW: 0.8, winH: 0.9, winPattern: 'straight', doorW: 1.2, doorH: 1.8,
      eave: r.eave * 0.8, tile: r.tile, tileB: r.tileB, upturn: r.upturn, dougong: false, sideWindows: false, noFloor: true
    });
    cityCheapRoof(sub, 0, 0, W + r.eave * 1.6, D + r.eave * 1.6, top.topY, r.slope * (D / 2 + r.eave * 0.8), r.tile, r.tileB, '角楼顶');
    sub.translate(x, 0, z);
    mb.merge(sub);
  }

  // 城制低模屋顶：四坡简化体（前后坡 + 两山三角 + 正脊），远景坊 / 铺舍 / 内廷用，省瓦当滴水
  function cityCheapRoof(mb, cx, cz, W, D, yb, rise, tile, tileB, tag) {
    const hx = W / 2, hz = D / 2, ry = yb + rise, ridge = W * 0.35;
    mb.quad([cx - hx, yb, cz + hz], [cx + hx, yb, cz + hz], [cx + ridge / 2, ry, cz], [cx - ridge / 2, ry, cz], tile, tag);
    mb.quad([cx + hx, yb, cz - hz], [cx - hx, yb, cz - hz], [cx - ridge / 2, ry, cz], [cx + ridge / 2, ry, cz], tile, tag);
    mb.tri([cx - hx, yb, cz + hz], [cx - hx, yb, cz - hz], [cx - ridge / 2, ry, cz], tileB, tag);
    mb.tri([cx + hx, yb, cz - hz], [cx + hx, yb, cz + hz], [cx + ridge / 2, ry, cz], tileB, tag);
    mb.box(cx - ridge / 2 - 0.1, cx + ridge / 2 + 0.1, ry - 0.05, ry + 0.12, cz - 0.12, cz + 0.12, tileB, tag + '·脊');
  }

  // 里坊（狠 LOD）：四面坊墙 + 一片屋面体量 + 低模顶；不套院落装配器，不铺坊内街
  function cityBlock(mb, r, cx, cz, bw, bd) {
    const wh = r.blockWallH, t = 0.22;
    mb.box(cx - bw / 2, cx + bw / 2, 0.05, wh, cz - bd / 2, cz - bd / 2 + t, 'plaster', '坊墙');
    mb.box(cx - bw / 2, cx + bw / 2, 0.05, wh, cz + bd / 2 - t, cz + bd / 2, 'plaster', '坊墙');
    mb.box(cx - bw / 2, cx - bw / 2 + t, 0.05, wh, cz - bd / 2, cz + bd / 2, 'plaster', '坊墙');
    mb.box(cx + bw / 2 - t, cx + bw / 2, 0.05, wh, cz - bd / 2, cz + bd / 2, 'plaster', '坊墙');
    const bodyH = wh * 1.1;
    mb.boxC(cx, cz - bd * 0.15, bw * 0.4, bd * 0.24, wh, wh + bodyH, 'plaster', '坊内屋面体量');
    cityCheapRoof(mb, cx, cz - bd * 0.15, bw * 0.4 + 0.5, bd * 0.24 + 0.5, wh + bodyH, 0.55, r.tile, r.tileB, '坊内屋顶');
  }

  // 中轴宫殿单体：三层汉白玉台基 + 殿身 + 殿前广场 + 两侧配殿（递减）；cheap 时低模屋顶
  function cityPalaceHall(r, W, D, floorH, baseH, cheap, withSide) {
    const sub = new GF.Mesh();
    P.platform(sub, {
      x0: -W / 2 - 0.5, x1: W / 2 + 0.5, z0: -D / 2 - 0.5, z1: D / 2 + 0.5,
      h: baseH, steps: 0, style: 'xumizuo', lotus: false
    });
    sub.box(-W / 2 - 0.28, W / 2 + 0.28, baseH, baseH + 0.16, -D / 2 - 0.28, D / 2 + 0.28, 'marble', '殿台·中层');
    sub.box(-W / 2 - 0.08, W / 2 + 0.08, baseH + 0.16, baseH + 0.3, -D / 2 - 0.08, D / 2 + 0.08, 'marble', '殿台·上层');
    const y0 = baseH + 0.3;
    const top = body(sub, {
      W, D, baseY: y0, floors: 1, floorH, bays: 3,
      wallMat: r.wallMat, colMat: r.colMat, cut: {},
      winW: 1.0, winH: 1.1, winPattern: 'straight', doorW: 1.6, doorH: 2.4,
      eave: r.eave, tile: r.tile, tileB: r.tileB, upturn: r.upturn,
      dougong: false, sideWindows: false, noFloor: true
    });
    if (cheap) {
      cityCheapRoof(sub, 0, 0, W + r.eave * 2, D + r.eave * 2, top.topY, r.slope * (D / 2 + r.eave), r.tile, r.tileB, '宫殿·殿顶');
    } else {
      GF.roofs.build(sub, {
        cx: 0, cz: 0, x0: -W / 2 - r.eave, x1: W / 2 + r.eave,
        z0: -D / 2 - r.eave, z1: D / 2 + r.eave,
        yb: top.topY, rise: r.slope * (D / 2 + r.eave), type: 'hip',
        tile: r.tile, tileB: r.tileB, upturn: r.upturn, ridgeStyle: 'ornate', beasts: 3, tag: '宫殿·殿顶'
      });
    }
    // 殿前广场（石板）
    const plazaD = D * 0.7;
    sub.box(-W / 2 - 1.2, W / 2 + 1.2, 0, 0.08, D / 2 + 0.1, D / 2 + 0.1 + plazaD, 'stoneB', '殿前广场');
    // 两侧配殿，体量递减，低模顶
    if (withSide) {
      const sw = W * 0.4, sd = D * 0.6;
      for (const s of [-1, 1]) {
        const sx = s * (W / 2 + sw / 2 + 0.9);
        sub.boxC(sx, 0, sw + 0.3, sd + 0.3, 0, baseH * 0.7, 'marble', '配殿台基');
        sub.boxC(sx, 0, sw, sd, baseH * 0.7, baseH * 0.7 + floorH * 0.8, 'plaster', '配殿身');
        cityCheapRoof(sub, sx, 0, sw + 0.4, sd + 0.4, baseH * 0.7 + floorH * 0.8, 0.45, r.tile, r.tileB, '配殿顶');
      }
    }
    return sub;
  }

  function buildCity(mb, r) {
    const W = r.cityW, D = r.cityD;
    const Ws = W / 2;
    const Wn = r.northW > 0 ? r.northW / 2 : (r.cityShape === 'trapezoid' ? W * 0.425 : W / 2);
    const H = r.wallH, bw = r.wallBaseW, tw = r.wallTopW;

    // 城内地面
    mb.box(-Ws, Ws, -0.06, 0, -D / 2, D / 2, 'soil', '城内地面');

    // 四边：端点 + 外法线
    const sides = [
      { key: 'south', a: [-Ws, D / 2], b: [Ws, D / 2], n: [0, 1] },
      { key: 'north', a: [Wn, -D / 2], b: [-Wn, -D / 2], n: [0, -1] },
      { key: 'east', a: [Wn, -D / 2], b: [Ws, D / 2], n: [1, 0] },
      { key: 'west', a: [-Ws, D / 2], b: [-Wn, -D / 2], n: [-1, 0] }
    ];
    const gateSides = ['south'];
    if (r.gateSide === 'two') gateSides.push('north');
    if (r.gateSide === 'four') gateSides.push('north', 'east', 'west');

    // 先定各门（位置 + 门道），供城墙分段 / 马面避让 / 架桥共用
    const gates = [];
    for (const s of sides) {
      if (gateSides.indexOf(s.key) < 0) continue;
      const L = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
      const dir = [(s.b[0] - s.a[0]) / L, (s.b[1] - s.a[1]) / L];
      const main = s.key === 'south';
      const nDoors = main ? r.gateCount : 1;
      const gw = main ? r.gateW : r.gateW * 0.8;
      const gh = r.gateH;
      const doors = [];
      const span = gw + 0.5;
      for (let i = 0; i < nDoors; i++) {
        doors.push({ u: (i - (nDoors - 1) / 2) * span, w: gw, h: gh });
      }
      const Wg = nDoors * gw + (nDoors - 1) * 0.5 + 1.6;
      const Dg = bw + 2.6;
      const cx = (s.a[0] + s.b[0]) / 2, cz = (s.a[1] + s.b[1]) / 2;
      gates.push({ side: s, L, dir, n: s.n, cx, cz, Wg, Dg, doors, main });
    }

    // 宫城 / 皇城方位（先定，供坊格与街网避让）：北部居中 / 居中 / 西北偏隅
    const pW = r.palaceW > 0 ? r.palaceW : 0;
    const pD = r.palaceD > 0 ? r.palaceD : 0;
    let px = 0, pz = 0;
    if (r.palaceCorner === 'north') pz = -D / 2 + 2 + pD / 2;
    else if (r.palaceCorner === 'corner') { px = -W * 0.26; pz = -D * 0.24; }
    const palaceRect = pW > 0 ? [px - pW / 2, px + pW / 2, pz - pD / 2, pz + pD / 2] : null;
    let ix = 0, iz = 0, innerRect = null;
    if (r.innerW > 0 && r.innerD > 0) {
      if (r.palaceCorner === 'north') iz = -D / 2 + 1 + r.innerD / 2;
      innerRect = [ix - r.innerW / 2, ix + r.innerW / 2, iz - r.innerD / 2, iz + r.innerD / 2];
    }
    const inRect = (x, z, rc, m) => rc && x > rc[0] - m && x < rc[1] + m && z > rc[2] - m && z < rc[3] + m;
    const inCompound = (x, z) => inRect(x, z, palaceRect, 1) || inRect(x, z, innerRect, 1);

    // 街网铺装：纵街 / 横街石板，中轴御道加宽加深
    const inset = bw + 2;
    const Wi = W - inset * 2, Di = D - inset * 2;
    const nx = Math.max(1, r.blocksX), nz = Math.max(1, r.blocksZ);
    const cellW = Wi / nx, cellD = Di / nz;
    const sw = r.streetW, aveW = sw * 2.1;
    for (let j = 1; j < nz; j++) {
      const cz = -Di / 2 + cellD * j;
      if (inCompound(0, cz)) continue;
      mb.box(-Wi / 2, Wi / 2, 0, 0.055, cz - sw / 2, cz + sw / 2, 'stoneB', '街巷铺装');
    }
    for (let i = 1; i < nx; i++) {
      const cx = -Wi / 2 + cellW * i;
      if (inCompound(cx, 0)) continue;
      mb.box(cx - sw / 2, cx + sw / 2, 0, 0.055, -Di / 2, Di / 2, 'stoneB', '街巷铺装');
    }
    mb.box(-aveW / 2, aveW / 2, 0, 0.07, -Di / 2, Di / 2, 'stoneDark', '中轴御道');

    // 城墙分段（避让城门开口）+ 马面（每面 N 座等距）
    let bastionCount = 0; const bastionSpacings = [];
    for (const s of sides) {
      const L = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
      const dir = [(s.b[0] - s.a[0]) / L, (s.b[1] - s.a[1]) / L];
      const gaps = gates.filter((g) => g.side === s).map((g) => {
        const u = ((g.cx - s.a[0]) * dir[0] + (g.cz - s.a[1]) * dir[1]);
        return [u - g.Wg / 2 - 0.2, u + g.Wg / 2 + 0.2];
      });
      let cursor = 0;
      const segs = [];
      for (const [g0, g1] of gaps) {
        if (g0 > cursor) segs.push([cursor, g0]);
        cursor = Math.max(cursor, g1);
      }
      if (cursor < L) segs.push([cursor, L]);
      for (const [t0, t1] of segs) {
        const p0 = [s.a[0] + dir[0] * t0, s.a[1] + dir[1] * t0];
        const p1 = [s.a[0] + dir[0] * t1, s.a[1] + dir[1] * t1];
        cityWallRun(mb, p0, p1, r, {});
      }
      const bN = r.bastionN > 0 ? Math.round(r.bastionN) : 0;
      if (bN > 0) {
        const sp = L / bN;
        bastionSpacings.push(sp);
        for (let i = 0; i < bN; i++) {
          const u = (i + 0.5) * sp;
          if (u < 1.5 || u > L - 1.5) continue;
          if (gaps.some(([g0, g1]) => u > g0 - 1.0 && u < g1 + 1.0)) continue;
          const p = [s.a[0] + dir[0] * u, s.a[1] + dir[1] * u];
          cityBastion(mb, r, p, s.n, H);
          bastionCount++;
        }
      }
    }

    // 城门：城台券洞 + 城楼
    for (const g of gates) {
      const sub = new GF.Mesh();
      cityGateTerrace(sub, r, g.Wg, g.Dg, g.doors, H);
      if (r.gateTower) cityGateTower(sub, r, g.Wg, g.Dg, H, !g.main);
      const gateAng = -Math.atan2(g.dir[1], g.dir[0]) * 180 / Math.PI;
      sub.rotateY(gateAng, 0, 0);
      sub.translate(g.cx, 0, g.cz);
      mb.merge(sub);
    }

    // 四角角楼
    if (r.cornerTower) {
      const corners = [[-Wn, -D / 2], [Wn, -D / 2], [Ws, D / 2], [-Ws, D / 2]];
      for (const [x, z] of corners) cityCornerTower(mb, r, x, z, H);
    }

    // 护城河：沿四边投影条带，端部外延相接成闭合环濠；驳岸贴墙基脚；城门石桥
    if (r.moatW > 0) {
      const mw = r.moatW, md = r.moatD;
      for (const s of sides) {
        cityStrip(mb, s.a, s.b, s.n, bw / 2 + 0.05, bw / 2 + 0.05 + mw, -md, -0.04, 'water', '护城河', mw + bw);
        cityStrip(mb, s.a, s.b, s.n, bw / 2 - 0.15, bw / 2 + 0.22, -0.06, 0.18, 'stone', '护城河驳岸', bw);
      }
      if (r.moatBridge) {
        for (const g of gates) {
          const bw2 = g.Wg * 0.5;
          if (g.n[0] !== 0) {
            const bx = g.cx + g.n[0] * (mw / 2 + 0.2);
            mb.box(bx - mw / 2 - 0.2, bx + mw / 2 + 0.2, 0, 0.18, g.cz - bw2 / 2, g.cz + bw2 / 2, 'stone', '护城河石桥');
          } else {
            const bz = g.cz + g.n[1] * (mw / 2 + 0.2);
            mb.box(g.cx - bw2 / 2, g.cx + bw2 / 2, 0, 0.18, bz - mw / 2 - 0.2, bz + mw / 2 + 0.2, 'stone', '护城河石桥');
          }
        }
      }
    }

    // 内城（皇城）重墙
    if (innerRect) {
      cityRing(mb, r, r.innerW, r.innerD, { wallH: H * 0.8, baseW: bw * 0.7, topW: tw * 0.7, merlon: false }, ix, iz);
    }

    // 宫城围墙
    if (palaceRect) {
      const pr = { wallH: H * 0.62, baseW: bw * 0.55, topW: tw * 0.55, merlon: false, parapet: true };
      cityWallRun(mb, [palaceRect[0], palaceRect[2]], [palaceRect[1], palaceRect[2]], r, pr);
      cityWallRun(mb, [palaceRect[1], palaceRect[2]], [palaceRect[1], palaceRect[3]], r, pr);
      cityWallRun(mb, [palaceRect[1], palaceRect[3]], [palaceRect[0], palaceRect[3]], r, pr);
      cityWallRun(mb, [palaceRect[0], palaceRect[3]], [palaceRect[0], palaceRect[2]], r, pr);
    }

    // 里坊方格网（宫城 / 皇城范围内的坊跳过）
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        const cx = -Wi / 2 + cellW * (i + 0.5);
        const cz = -Di / 2 + cellD * (j + 0.5);
        if (inCompound(cx, cz)) continue;
        const b2w = Math.max(2, cellW - sw), b2d = Math.max(2, cellD - sw);
        cityBlock(mb, r, cx, cz, b2w, b2d);
      }
    }

    // 中轴宫殿群：殿宇面阔按城宽百分比递减；三层台基 + 广场 + 配殿；整轴收在宫城内
    if (r.axisHalls > 0) {
      const hallN = r.axisHalls;
      const zoneD = pD > 0 ? pD * 0.7 : Di * 0.5;
      const zSouth = pz + (pD > 0 ? pD / 2 : 0) - 3;
      const step = zoneD / hallN;
      for (let i = 0; i < hallN; i++) {
        const k = i / Math.max(1, hallN - 1);
        const hW = Math.max(3.2, W * 0.07 * (1 - k * 0.16));
        const hD = hW * 0.55;
        const baseH = 0.5 + k * 0.3;
        const hall = cityPalaceHall(r, hW, hD, 3.0 - k * 0.25, baseH, i > 0, i === 0);
        hall.translate(px, 0, zSouth - step * (i + 0.5));
        mb.merge(hall);
      }
      // 内廷三宫（轴线后段，体量递减，低模屋顶）
      if (r.axisPalace) {
        const rearN = Math.min(3, hallN);
        const zRear = pz - (pD > 0 ? pD / 2 : 0) + 4;
        const rStep = Math.max(2.5, pD * 0.09);
        for (let i = 0; i < rearN; i++) {
          const hW = Math.max(2.6, W * 0.055 * (1 - i * 0.15));
          const hD = hW * 0.55;
          const hall = cityPalaceHall(r, hW, hD, 2.6, 0.4 + i * 0.2, true, false);
          hall.translate(px, 0, zRear + i * rStep);
          mb.merge(hall);
        }
      }
    }

    // 供报告探针读取的计数
    mb.cityStats = { bastionCount, bastionSpacings, wards: (function () {
      let n = 0;
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        const cx = -Wi / 2 + cellW * (i + 0.5), cz = -Di / 2 + cellD * (j + 0.5);
        if (!inCompound(cx, cz)) n++;
      }
      return n;
    })(), nx, nz, palace: [px, pz, pW, pD] };
  }

  /* ------------------------------ 总装 ------------------------------ */
  GF.build = function (recipe) {
    const r = GF.normalize ? GF.normalize(recipe) : recipe;
    const mb = new GF.Mesh();
    // 屋面通用参数（剪边 / 悬鱼 / 风铎 / 山花材质）统一透传，任何屋顶都会生效
    GF.roofs.setDefaults({
      trim: r.trimMat || null, xuanYu: !!r.xuanYu, windDuo: !!r.windDuo, gableMat: r.wallMat
    });
    environment(mb, r);
    switch (r.type) {
      case 'cave': buildCave(mb, r); break;
      case 'house': buildHouse(mb, r); break;
      case 'pavilion': buildPavilion(mb, r); break;
      case 'pagoda': buildPagoda(mb, r); break;
      case 'archway': buildArchway(mb, r); break;
      case 'gate': buildGate(mb, r); break;
      case 'courtyard': buildCourtyard(mb, r); break;
      case 'bridge': buildBridge(mb, r); break;
      case 'xie': buildXie(mb, r); break;
      case 'fang': buildFang(mb, r); break;
      case 'ge': buildGe(mb, r); break;
      case 'que': buildQue(mb, r); break;
      case 'corridor': buildCorridor(mb, r); break;
      case 'tai': buildTai(mb, r); break;
      case 'city': buildCity(mb, r); break;
      default: buildHall(mb, r);
    }
    GF.roofs.setDefaults({});
    return mb;
  };

  GF.builders = { ground, body, base, interior, environment };
})(typeof window !== 'undefined' ? window : globalThis);
