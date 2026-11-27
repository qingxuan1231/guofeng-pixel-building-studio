/* ============================================================================
 * 国风古建像素工坊 · 建筑装配
 * 殿 / 堂 / 民居 / 宫殿（重檐）/ 亭 / 塔 / 牌坊 / 城门楼 / 四合院 / 廊桥
 * ==========================================================================*/
'use strict';
  var GF = (window.GF = window.GF || {});
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
    // 檐口净空：有斗栱时，屋面必须抬到“斗栱顶 + 檐檩 + 檐椽”之上，
    // 否则斗栱整个埋进檐口，檐下没有放椽子的地方（就是“斗栱直接接瓦口”那一眼）。
    const ER = GF.era(o.era);
    const dgS = o.dougong ? (o.dgScale || 0.9) * ER.dgK : 0;
    const dgH = o.dougong ? P.dougongHeight(o.dgStyle || 'mid', dgS) : 0;
    const dgLift = o.dougong ? dgH + 0.34 : 0;

    for (let f = 0; f < floors; f++) {
      const fhF = (Array.isArray(o.floorHList) && o.floorHList[f] != null) ? o.floorHList[f] : fh;
      let yb = base;
      for (let k = 0; k < f; k++) yb += (Array.isArray(o.floorHList) && o.floorHList[k] != null) ? o.floorHList[k] : fh;
      const yt = yb + fhF;
      // 二层墙底压进下层墙顶 3 cm：原来 f=1 的墙底与 f=0 的墙顶同标高，
      // 两层墙的顶/底面在 3.39 处严格齐平（厅堂 16 对 0.176 m² = 3.70 m²）
      const wy0 = f === 0 ? yb : yb - 0.03;
      // 裙肩 / 下碱：明清民居白粉墙下段常见“青砖勒脚 + 上身抹灰”（清工部墙作：墙身下碱砖砌、
      // 上身收进抹灰；裙肩即两段的交线）。仅精档、白粉墙、首层启用——把一堵墙拆成
      // “青砖下碱 / 白灰上身”两段砌筑，其余材质与低档位完全保持原样（零回归、零增面）。
      const eraSkirt = !o.era || o.era === 'yuan' || o.era === 'ming' || o.era === 'qing';
      const skirtH = Math.min(1.05, Math.max(0.6, fhF * 0.34));
      const skirtOK = GF.detail(3) && f === 0 && o.wallMat === 'plaster' && eraSkirt;

      // 柱
      for (let i = 0; i <= bays; i++) {
        const cx = x0 + i * bayW;
        for (const cz of [z0 + 0.2, z1 - 0.2]) {
          mb.boxC(cx, cz, 0.18, 0.18, yb, yb + 0.12, 'stone', '柱础');
          // 檐柱不出顶底扇面：柱轴与墙中轴只差 0.1 m，柱皮几乎贴着墙皮，
          // 两片扇面会从墙面缝里露出一角（用户圈的那种“红色半圆/钩子”），斜视还闪。
          mb.cyl(cx, cz, colR, yb + 0.1, yt, 8, o.colMat, '檐柱', 0, true);
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
        const wHoles = holes.map((h) => side === 'front' ? h : ({ u0: -h.u1, u1: -h.u0, v0: h.v0, v1: h.v1 }));
        const wFace = { dir: side, at, u0, u1, thickness: wallT };
        const wallLab = '墙体·' + (side === 'front' ? '前' : '后');
        if (skirtOK) {
          P.wallWithHoles(mb, Object.assign({}, wFace, { y0: wy0, y1: wy0 + skirtH, holes: wHoles, mat: 'brick', tag: wallLab + '·下碱' }));
          P.wallWithHoles(mb, Object.assign({}, wFace, { y0: wy0 + skirtH + 0.005, y1: yt, holes: wHoles, mat: o.wallMat, tag: wallLab + '·上身' }));
        } else {
          P.wallWithHoles(mb, Object.assign({}, wFace, { y0: wy0, y1: yt, holes: wHoles, mat: o.wallMat, tag: wallLab }));
        }
        // 门窗构件
        for (let i = 0; i < bays; i++) {
          const bx = x0 + bayW * (i + 0.5);
          const uu = side === 'front' ? bx : -bx;
          if (f === 0 && i === Math.floor(bays / 2)) {
            P.doorAt(mb, { dir: side, at, uc: uu, w: o.doorW, h: o.doorH, y0: yb, style: o.doorStyle, pattern: o.winPattern, leaves: o.doorLeaves, plain: o.cheap, wt: wallT / 2, tag: '门·' + side });
          } else {
            P.windowAt(mb, {
              dir: side, at, uc: uu, vc: yb + fhF * 0.36 + o.winH / 2,
              w: o.winW, h: o.winH, pattern: o.winPattern, plain: o.cheap, wt: wallT / 2, tag: '窗·' + side
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
        const wHoles = holes.map((h) => side === 'right' ? h : ({ u0: -h.u1, u1: -h.u0, v0: h.v0, v1: h.v1 }));
        if (skirtOK) {
          P.wallWithHoles(mb, { dir: side, at, u0, u1, y0: wy0, y1: wy0 + skirtH, holes: wHoles, thickness: wallT, mat: 'brick', tag: '墙体·山面·下碱' });
          P.wallWithHoles(mb, { dir: side, at, u0, u1, y0: wy0 + skirtH + 0.005, y1: yt, holes: wHoles, thickness: wallT, mat: o.wallMat, tag: '墙体·山面·上身' });
        } else {
          P.wallWithHoles(mb, { dir: side, at, u0, u1, y0: wy0, y1: yt, holes: wHoles, thickness: wallT, mat: o.wallMat, tag: '墙体·山面' });
        }
        if (holes.length) {
          P.windowAt(mb, {
            dir: side, at, uc: 0, vc: holes[0].v0 + o.winH * 0.4,
            w: holes[0].u1 - holes[0].u0, h: o.winH * 0.8, pattern: 'straight', wt: wallT / 2, tag: '窗·山面'
          });
        }
      }

      // 硬山墀头（清工部·墙作：“硬山山墙里外分两段，近檐处盘头层层出挑”，前檐与山墙交角的
      // 砖垛即墀头）：宽 0.36、出进 0.30、下段拔檐 0.9、顶叠三层盘头各出挑 3/5/7 cm 而下口逐层上收，
      // 一似清官式“头层盘头、二层盘头”之制。仅精档 + 硬山 + 首层 + 正立面完整时生成，
      // 且不贴 ne 门脸（noChitou），其余风格与低档位零增面、完全前版一致。
      if (GF.detail(3) && o.hard && f === 0 && !cut.front && !o.noChitou) {
        const ctW = 0.36, ctD = 0.30;
        const zF = z1 + 0.04;
        for (const sd of ['left', 'right']) {
          if (cut[sd]) continue;
          const cx = sd === 'left' ? x0 + 0.1 : x1 - 0.1;
          const a = cx - ctW / 2, b = cx + ctW / 2;
          mb.box(a, b, yb, yb + 0.9, zF - ctD, zF, o.wallMat, '墀头·' + sd);
          for (let k = 0; k < 3; k++) {
            const pj = 0.03 + k * 0.02;
            mb.box(a - pj, b + pj, yb + 0.88 + k * 0.10, yb + 1.0 + k * 0.10, zF - ctD, zF + pj + 0.02, o.wallMat, '墀头·盘头');
          }
        }
      }

      // 阶条石（勒脚）：首层墙脚压一道条石，二层以上做腰线，避免“墙直接插进台基”
      // 环形做法：前后两条包到两山以外（转角一次成型），左右两条只走到前后条的里侧、
      // 咬进去 11 mm。原来四条盒各占满整条边，四个转角处两两顶面严格齐平
      // （前×右 1.15、后×左 1.15、前×左 1.08、右×后 1.01 m² 的同面），转视角整圈闪。
      {
        const b0 = f === 0 ? yb - 0.006 : yb - 0.02;   // 底面压进台基 6 mm
        const b1 = f === 0 ? yb + 0.2 : yb + 0.12;
        const out = 0.045;      // 外挑量
        const bite = 0.011;     // 左右条咬进前后条的深度（转角齐平改为咬边）
        const t0 = f === 0 ? '墙脚石' : '腰线';
        if (!cut.front) mb.box(x0 - out, x1 + out, b0, b1, z1 - 0.26, z1 + out, 'stone', t0 + '·前');
        if (!cut.back) mb.box(x0 - out, x1 + out, b0, b1, z0 - out, z0 + 0.26, 'stone', t0 + '·后');
        // 左右两条顶面压低 2 mm：转角处与前后条的顶面不再同平面
        if (!cut.left) mb.box(x0 - out, x0 + 0.26, b0, b1 - 0.002, z0 + 0.26 - bite, z1 - 0.26 + bite, 'stone', t0 + '·左');
        if (!cut.right) mb.box(x1 - 0.26, x1 + out, b0, b1 - 0.002, z0 + 0.26 - bite, z1 - 0.26 + bite, 'stone', t0 + '·右');
      }

      // 朝代做法：阑额断面、普拍枋有无与断面、斗栱密度与大小都按朝代定
      const pbH = ER.pb ? ER.lanT * ER.pb.h : 0;
      const pbW = ER.pb ? ER.lanT * ER.pb.w : 0;
      const lanH = ER.lanH, lanT = ER.lanT;

      // 额枋 + 彩画（明清高厚比约 2:1，唐宋更高瘦）
      // 唐宋辽金为丹粉刷饰／素枋，不加青绿彩画；元人好作月梁，阑额端部收分。
      const plainLintel = (o.era === 'han' || o.era === 'tang' || o.era === 'song' || o.era === 'jin' || o.era === 'yuan');
      for (const side of ['front', 'back']) {
        const at = side === 'front' ? z1 - 0.05 : z0 + 0.05;
        const ly = yt - 0.1 - pbH - lanH;
        if (plainLintel) {
          const zc = side === 'front' ? z1 - 0.05 : z0 + 0.05;
          mb.box(x0 - 0.06, x1 + 0.06, ly, ly + lanH, zc - lanT / 2 + 0.012, zc + lanT / 2 + 0.012, 'timber', '额枋·' + side);
          if (o.era === 'yuan') {
            // 月梁：两端下缘收进，中段略鼓（梁思成记阳和楼“阑额刻作假月梁形”）
            for (const ex of [x0 + 0.5, x1 - 0.5]) {
              mb.taper(ex, zc, lanT * 0.9, lanT * 1.05, lanT * 0.9, lanT * 0.4, ly + lanH * 0.3, ly + lanH, 'timber', '额枋·' + side + '·月梁头');
            }
          }
        } else {
          P.lintel(mb, {
            dir: side, at, uc: 0, w: W, y: ly, h: lanH, th: lanT,
            seg: o.cheap ? 2 : Math.max(4, bays * 2), tag: '额枋·' + side
          });
        }
      }
      // 普拍枋：唐辽无，宋辽扁宽成 T 字，金元渐厚，明清狭于阑额
      if (ER.pb && o.dougong) {
        P.pingban(mb, { x0, x1, z0, z1, y0: yt - 0.1 - pbH, y1: yt - 0.1, w: pbW, tag: '普拍枋' });
      }
      // 斗拱：唐宋每间柱头 + 一朵补间（两朵），明清铺作小而密
      if (o.dougong) {
        const n = ER.dg === 'dense' ? Math.max(6, Math.round(W / 0.62)) : Math.max(2, bays * (ER.dg === 'col' ? 1 : 2));
        const gap = W / n;
        const tone = (o.era === 'han' || o.era === 'tang' || o.era === 'song' || o.era === 'jin') ? 'dan' : 'green';
        for (let i = 0; i <= n; i++) {
          const cx = x0 + (W * i) / n;
          for (const cz of [z0 + 0.12, z1 - 0.12]) {
            P.dougong(mb, cx, yt - 0.1, cz, dgS, '斗拱', o.dgStyle || 'mid', { gap, tone });
          }
        }
        // 檐檩：压在斗栱柱头枋上的一根通长圆木，是“斗栱—椽子”之间的过渡层。
        // 没有它，屋面抬起来以后檐下会是一条悬空的缝。
        const dgH = P.dougongHeight(o.dgStyle || 'mid', dgS);
        const yT = yt - 0.1 + dgH + 0.1;
        for (const side of ['front', 'back']) {
          if (cut[side]) continue;
          const at = side === 'front' ? z1 - 0.14 : z0 + 0.14;
          GF.beamRound(mb, [x0, yT, at], [x1, yT, at], 0.11, 6, 'paintGreen', '檐檩·' + side);
        }
      }
      // 栱眼壁：阑额以上、檐檩以下、斗栱背后的三层——下段深色垫板、中段素壁、上段柱头枋。
      // 唐辽素壁（灰白），明清青绿；柱头枋是通长的，不能每朵斗栱各画一块。
      if (o.dougong) {
        const era = o.era || 'qing';
        const y0g = yt - 0.1 - pbH, y1g = yt - 0.1 + dgH;
        const stk = 0.38 * dgS;
        const gmat = (era === 'han' || era === 'tang' || era === 'song') ? 'plaster' : 'paintGreen';
        const b1 = y1g - 0.12 * dgS, b2 = y1g - stk;
        // 三层之间各压进 4 mm：原来是整层叠整层，层间分界处上下两张面严格同面，
        // 320 档转视角时这圈檐下会闪成一片。
        const lap = 0.004;
        if (!cut.front) {
          mb.box(x0 - 0.02, x1 + 0.02, y0g - lap, b2, z1 - 0.146, z1 - 0.054, 'woodDark', '栱眼壁·前垫板');   // 比栱眼壁收 4 mm：原来两者前后脸同一张平面
          mb.box(x0 - 0.02, x1 + 0.02, b2 - lap, b1, z1 - 0.15, z1 - 0.05, gmat, '栱眼壁·前');
          mb.box(x0 - 0.02, x1 + 0.02, b1 - lap, y1g, z1 - 0.18, z1 - 0.02, 'paintGreen', '柱头枋·前');
        }
        if (!cut.back) {
          mb.box(x0 - 0.02, x1 + 0.02, y0g - lap, b2, z0 + 0.054, z0 + 0.146, 'woodDark', '栱眼壁·后垫板');
          mb.box(x0 - 0.02, x1 + 0.02, b2 - lap, b1, z0 + 0.05, z0 + 0.15, gmat, '栱眼壁·后');
          mb.box(x0 - 0.02, x1 + 0.02, b1 - lap, y1g, z0 + 0.02, z0 + 0.18, 'paintGreen', '柱头枋·后');
        }
        // 栱眼壁雕饰（开关 dgEye）：在素壁外再加一层分间透雕板 + 竖棂，与整片素壁区分得出来
        if (o.dgEye) {
          for (let i = 0; i < bays; i++) {
            const bx0 = x0 + bayW * i + 0.1, bx1 = x0 + bayW * (i + 1) - 0.1;
            const rib = Math.max(0.05, bayW * 0.06);
            if (!cut.front) {
              mb.box(bx0, bx1, b2 + 0.02, b1 - 0.02, z1 - 0.2, z1 - 0.17, 'woodDark', '栱眼壁·透雕板前');
              for (let k = 1; k <= 3; k++) {
                const rx = bx0 + (bx1 - bx0) * k / 4;
                mb.box(rx - rib / 2, rx + rib / 2, b2 + 0.02, b1 - 0.02, z1 - 0.23, z1 - 0.2, 'paintGreen', '栱眼壁·竖棂前');
              }
            }
            if (!cut.back) {
              mb.box(bx0, bx1, b2 + 0.02, b1 - 0.02, z0 + 0.17, z0 + 0.2, 'woodDark', '栱眼壁·透雕板后');
              for (let k = 1; k <= 3; k++) {
                const rx = bx0 + (bx1 - bx0) * k / 4;
                mb.box(rx - rib / 2, rx + rib / 2, b2 + 0.02, b1 - 0.02, z0 + 0.2, z0 + 0.23, 'paintGreen', '栱眼壁·竖棂后');
              }
            }
          }
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
      if (f === 0 && !o.noFloor) interiorFloor(mb, W - 0.408, D - 0.408, yb + 0.022, '地板');

      // 腰檐（非顶层）：只做一层短披檐——檐口压柱头、内侧收到上层墙外 6cm，
      // 坡高必须小于上层楼板厚，否则瓦会顺着墙往上爬，看着像“瓦从屋里盖下来”
      if (f < floors - 1 && !cut.roof) {
        GF.roofs.skirt(mb, {
          cx: 0, cz: 0,
          x0: x0 - o.eave, x1: x1 + o.eave, z0: z0 - o.eave, z1: z1 + o.eave,
          xi: W / 2 + 0.06, zi: D / 2 + 0.06,
          yb: yt + dgLift, ytop: yt + dgLift + Math.min(0.56, fhF * 0.16),
          tile: o.tile, tileB: o.tileB, upturn: o.upturn * 0.6, tag: '腰檐' + (f + 1)
        });
      }
      lastTopY = yt;
    }
    return { topY: lastTopY, roofY: lastTopY + dgLift, x0, x1, z0, z1, bayW };
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
    // 墙顶铺舍 / 敌楼 / 角楼：直接坐在城墙压顶上，不再生成独立台明，避免白台悬空。
    if (r.baseOn === false) return { x0, x1, z0, z1, h: 0 };
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