'use strict';
  /* ============================ 阶段④ 布局共用 ============================ */
  function layStats(mb) {
    if (!mb.layoutStats) mb.layoutStats = { axis: [], flanks: [], walls: [], corners: [], segs: [] };
    return mb.layoutStats;
  }
  // 轴上单体：rr 可覆盖 baseH / dougong 等；记录轴线核查数据
  function axisUnit(mb, r, o) {
    const ov = unitOverride(r, o.tag);
    const ru = unitRecipe(r, ov);
    const rr = Object.assign({}, ru, { railing: false }, o.r || {});
    if (ov) UNIT_RECIPE.forEach((k) => { if (ov[k] != null) rr[k] = ov[k]; });
    if (r.axisRaise === false && o.statBaseH == null) rr.baseH = ru.baseH;
    const unit = unitGeom(o.unit, ov);
    const u = houseUnit(rr, unit);
    const sh = unitShift(r, o.tag);
    const ux = (o.x || 0) + sh.dx, uz = (o.z || 0) + sh.dz;
    u.mesh.translate(ux, o.y || 0, uz);
    mb.merge(u.mesh);
    regUnit(mb, o.tag, o.tag, ux, uz, unit.W, unit.D, 0, u.topY + (o.y || 0), rr.baseH, false, u.parts, o.y || 0);
    const bh = o.statBaseH != null ? o.statBaseH : rr.baseH;
    layStats(mb).axis.push({
      tag: o.tag, x: ux, z: uz, W: unit.W, D: unit.D,
      baseH: +bh.toFixed(3), topY: +(u.topY + (o.y || 0)).toFixed(3)
    });
    return u;
  }
  // 跨院 / 配殿单体：默认朝院内（左 x<0 朝 +x，右 x>0 朝 -x）
  function flankUnit(mb, r, o) {
    const ov = unitOverride(r, o.tag);
    const ru = unitRecipe(r, ov);
    const rr = Object.assign({}, ru, { railing: false }, o.r || {});
    if (ov) UNIT_RECIPE.forEach((k) => { if (ov[k] != null) rr[k] = ov[k]; });
    const unit = unitGeom(o.unit, ov);
    const u = houseUnit(rr, unit);
    const rot = o.rot != null ? o.rot : (o.x < 0 ? 90 : -90);
    const sh = unitShift(r, o.tag);
    const ux = o.x + sh.dx, uz = o.z + sh.dz;
    u.mesh.rotateY(rot);
    u.mesh.translate(ux, 0, uz);
    mb.merge(u.mesh);
    regUnit(mb, o.tag, o.tag, ux, uz, unit.W, unit.D, rot, u.topY, rr.baseH, false, u.parts);
    layStats(mb).flanks.push({
      tag: o.tag, x: ux, z: uz, W: unit.W, D: unit.D,
      baseH: o.r && o.r.baseH != null ? o.r.baseH : rr.baseH, rot
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
    const gov = unitOverride(r, 'gate');
    const gRu = unitRecipe(r, gov);
    if (!r.cut.roof) {
      GF.roofs.build(mb, {
        cx: 0, cz: gz, x0: -2.75, x1: 2.75, z0: gz - 1.0, z1: gz + 1.0,
        yb: 3.2, rise: 0.8, type: 'gable', tile: gRu.tile, tileB: gRu.tileB,
        upturn: gRu.upturn == null ? 0.3 : Math.min(0.7, gRu.upturn), ridgeStyle: 'plain', beasts: 0, gableMat: gRu.wallMat, tag: '垂花门顶'
      });
    }
    regUnit(mb, 'gate', '院门 · 垂花门', 0, gz, 5.5, 2.0, 0, 3.95, gRu.baseH == null ? 0.3 : gRu.baseH, true);

    // 进数：院深按进数分段，每进一座正房；进与进之间砌内隔墙、中留内门。
    // 首进另有厢房 + 抄手游廊 + 庭内陈设，后几进只留正房与隔墙，深宅的层次靠这个出来。
    const jin = Math.max(1, Math.min(5, Math.round(ctx.jin || r.jin || 1)));
    const jd = CD / jin;
    const W1 = Math.min(CW * 0.38, 7.0), D1 = Math.min(4.8, jd * 0.44);
    const zFront = CD / 2 - jd / 2;
    const interiorMain = r.interior.length ? r.interior : [
      { kind: 'bed', x: -1.2, z: -1.9 },
      { kind: 'table', x: 1.0, z: -1.4 },
      { kind: 'screen', x: 0.2, z: -2.4 },
      { kind: 'shelf', x: -2.8, z: -1.0 },
      { kind: 'lamp', x: 2.7, z: 0.1 },
      { kind: 'altar', x: 0, z: 0.2 },
      { kind: 'table', x: 0, z: 2.2 },
      { kind: 'stool', x: 0.95, z: 2.2 },
      { kind: 'stool', x: -0.95, z: 2.2 }
    ];
    for (let j = 0; j < jin; j++) {
      const zBack = CD / 2 - (j + 1) * jd;                 // 该进北界
      const zMain = zBack + D1 / 2 + (j === jin - 1 ? 1.2 : 0.7);
      // 逐栋改写：第几进正房各自一份 r.units[id]，尺寸 / 层高 / 屋顶 / 瓦色都能单独调
      const id = 'main' + (j + 1);
      const ov = unitOverride(r, id);
      const ru = unitRecipe(r, ov);
      const um = unitGeom({
        W: W1, D: D1, bays: 3,
        cut: r.cut, veranda: true, eave: 0.9,
        partition: 0.9,
        interior: interiorMain,
        plaque: j === jin - 1 ? r.plaque : false
      }, ov);
      const main = houseUnit(ru, um);
      const sh = unitShift(r, id);
      main.mesh.translate(sh.dx, 0, zMain + sh.dz);
      mb.merge(main.mesh);
      regUnit(mb, id, '第 ' + (j + 1) + ' 进正房', sh.dx, zMain + sh.dz, um.W, um.D, 0, main.topY, ru.baseH, false, main.parts);
      // 内隔墙（末进不砌）：两侧各一段，中留 1.6m 内门，门上压门楣与小门罩
      if (j < jin - 1) {
        const zW = zBack;
        mb.box(-CW / 2 + 0.55, -0.8, 0, 2.7, zW - 0.13, zW + 0.13, 'brickB', '内隔墙');
        mb.box(0.8, CW / 2 - 0.55, 0, 2.7, zW - 0.13, zW + 0.13, 'brickB', '内隔墙');
        mb.box(-0.8, 0.8, 2.3, 2.7, zW - 0.13, zW + 0.13, 'brickB', '内门·门楣');
        for (const sx of [-1, 1]) {
          mb.boxC(sx * 0.9, zW, 0.2, 0.34, 0, 2.4, 'woodDark', '内门·框');
          mb.boxC(sx * 0.32, zW, 0.62, 0.07, 0, 2.1, 'zhu', '内门·扇');
        }
        if (!r.cut.roof) {
          GF.roofs.build(mb, {
            cx: 0, cz: zW, x0: -1.5, x1: 1.5, z0: zW - 0.62, z1: zW + 0.62,
            yb: 2.7, rise: 0.45, type: 'hip', tile: r.tile, tileB: r.tileB,
            upturn: 0.18, ridgeStyle: 'plain', beasts: 0, tag: '内门·门罩'
          });
        }
      }
    }

    // 东西厢房（只首进有，后几进是正房之间的窄院）
    const W2 = Math.min(6.0, Math.max(3.6, jd * 0.62)), D2 = 3.2;
    const zWing = zFront;
    for (const sx of [-1, 1]) {
      const id = sx > 0 ? 'wingE' : 'wingW';
      const ov = unitOverride(r, id);
      const ru = unitRecipe(r, ov);
      const um = unitGeom({
        W: W2, D: D2, bays: 3, roofType: 'gable', eave: 0.7,
        interior: [
          { kind: 'table', x: 0, z: 0.2 },
          { kind: 'shelf', x: -2.2, z: -0.9 },
          { kind: 'bed', x: 2.0, z: -0.8 },
          { kind: 'stool', x: 1.0, z: 0.2 }
        ]
      }, ov);
      const wing = houseUnit(ru, um);
      const rot = sx > 0 ? -90 : 90;
      wing.mesh.rotateY(rot);
      const wx = sx * (CW / 2 - 2.9);
      const sh = unitShift(r, id);
      wing.mesh.translate(wx + sh.dx, 0, zWing + sh.dz);
      mb.merge(wing.mesh);
      regUnit(mb, id, sx > 0 ? '东厢房' : '西厢房', wx + sh.dx, zWing + sh.dz, um.W, um.D, rot, wing.topY, ru.baseH, false, wing.parts);
    }

    // 抄手游廊（首进两侧，从门内直抵首进正房前）
    if (!r.cut.roof) {
      const L = Math.max(3.2, jd - 3.0);
      for (const sx of [-1, 1]) {
        const cor = corridorMesh(r, L, 1.1, 0.02, {});
        cor.rotateY(90);
        cor.translate(sx * (CW / 2 - (1.1 / 2 + 0.55)), 0, CD / 2 - 1.1 - L / 2);
        mb.merge(cor);
      }
    }

    // 院内竹木
    const inTrees = r.env.trees || [];
    for (let i = 0; i < Math.min(2, inTrees.length); i++) {
      P.tree(mb, (i ? 1 : -1) * 2.2, zFront + 1.0 - i * 0.6, inTrees[i], new GF.RNG(r.seed + i * 13), 0.85, '院内树');
    }

    // 庭院陈设（首进院心）
    P.furniture(mb, 'table', 0, zFront - 1.0, 1, 0, '石桌');
    P.furniture(mb, 'stool', 0.9, zFront - 1.0, 1, 0, '石凳');
    P.furniture(mb, 'stool', -0.9, zFront - 1.0, 1, 0, '石凳');
    P.rock(mb, -CW / 2 + 2.8, zFront + 0.6, 0.9, new GF.RNG(r.seed + 5), '假山');
    if (r.env.pond && r.env.showGround !== false && r.env.groundType !== 'lake') {
      P.pond(mb, r.env.pond.x || CW / 2 - 3.4, r.env.pond.z || zFront + 0.6, r.env.pond.w || 2.2, r.env.pond.d || 1.5);
    }
    // 花池
    for (const sx of [-1, 1]) {
      mb.boxC(sx * 3.0, zFront - 2.2, 1.4, 1.0, 0, 0.35, 'stone', '花池');
      mb.boxC(sx * 3.0, zFront - 2.2, 1.2, 0.8, 0.35, 0.6, 'leaf', '花草');
    }
  }

  /* 圆屋顶/圆腰檐：自写环形坡面（逐段逐环 quad），段边经描边就是瓦垄，
     不依赖方环的 skirt，也不会出现大扇错位 */
  function roundRing(mb, o) {
    const sides = o.sides || 48, rings = o.rings || 12;
    const rOut = o.rOut, rIn = o.rIn, yb = o.yb, yTop = o.ytop;
    const P = (r, y, a) => [Math.cos(a) * r, y, Math.sin(a) * r];
    const rr = (s) => rOut + (rIn - rOut) * Math.pow(s, 0.85);
    const yy = (s) => yb + (yTop - yb) * Math.pow(s, 1.2);
    for (let j = 0; j < rings; j++) {
      const s0 = j / rings, s1 = (j + 1) / rings;
      for (let i = 0; i < sides; i++) {
        const a0 = (i / sides) * Math.PI * 2, a1 = ((i + 1) / sides) * Math.PI * 2;
        const A = P(rr(s0), yy(s0), a0), B = P(rr(s0), yy(s0), a1);
        const C = P(rr(s1), yy(s1), a1), D = P(rr(s1), yy(s1), a0);
        // 隔一垄换瓦色：段边就是瓦垄沟，远看有竖垄，不是一整张伞面
        mb.quad(A, B, C, D, (i & 1) ? (o.tileB || o.tile) : o.tile, o.tag);
      }
    }
    // 檐口：一圈深色收边，压住最外一环的接缝
    for (let i = 0; i < sides; i++) {
      const a0 = (i / sides) * Math.PI * 2, a1 = ((i + 1) / sides) * Math.PI * 2;
      const A = P(rOut + 0.03, yb, a0), B = P(rOut + 0.03, yb, a1);
      const C = P(rOut + 0.03, yb - 0.13, a1), D = P(rOut + 0.03, yb - 0.13, a0);
      mb.quad(A, B, C, D, o.tileB, o.tag + '·檐口');
    }
  }

  /* 圆形平面（圆殿 / 圆楼）：圆台基 → 环柱 + 圆墙 → 圆攒尖（可叠层，层间用环坡腰檐） */
  function buildRound(mb, r) {
    const floors = Math.max(1, Math.min(3, r.floors || 1));
    const seg = 44;
    const R0 = r.roundR || Math.max(3.4, (r.bays || 3) * (r.bayW || 3.0) * 0.46);
    const colH = r.floorH || 4.0;
    const wallMat = r.wallMat || 'plaster';
    const colMat = r.colMat || 'timber';
    const nR = R0 + 1.35;
    // 台基：两层圆台 + 前置踏跺
    mb.cyl(0, 0, nR + 0.36, 0, 0.26, seg, 'stoneB', '圆台·下');
    mb.cyl(0, 0, nR, 0.26, 0.5, seg, 'stone', '圆台·上');
    mb.cyl(0, 0, nR - 0.14, 0.5, 0.54, 24, 'slab', '圆台·台面');
    for (let k = 0; k < 4; k++) {
      const w = 1.3 - k * 0.28;
      mb.box(-w, w, 0, 0.54 - k * 0.13, nR - 0.36 + k * 0.44, nR + 0.06 + k * 0.44, 'stone', '踏跺');
    }
    let y = 0.54;
    const gateA = 0.4;               // 前门半角（弧度）
    for (let f = 0; f < floors; f++) {
      const isTop = f === floors - 1;
      const R = R0 * Math.pow(0.9, f);
      const colTop = y + colH;
      // 圆墙：整圈实砌（顶面被屋面压住），省掉逐段 quad 拼接的接缝与缺扇
      mb.cyl(0, 0, R - 0.06, y, colTop, seg, wallMat, '圆墙');
      mb.cyl(0, 0, R - 0.02, colTop - 0.16, colTop, seg, 'stoneB', '圆墙·压顶');
      const nCol = Math.max(8, Math.round(R * 1.6));
      // 环柱：立在墙外一圈，柱头连额枋
      for (let i = 0; i < nCol; i++) {
        const a = (i / nCol) * Math.PI * 2;
        mb.cyl(Math.cos(a) * R, Math.sin(a) * R, 0.15, y, colTop, 8, colMat, '檐柱');
        mb.boxC(Math.cos(a) * R, Math.sin(a) * R, 0.24, 0.24, y, y + 0.12, 'stone', '柱础');
        const a2 = ((i + 1) / nCol) * Math.PI * 2;
        GF.beamBetween(mb, [Math.cos(a) * R, colTop - 0.22, Math.sin(a) * R],
          [Math.cos(a2) * R, colTop - 0.22, Math.sin(a2) * R], 0.11, 0.16, 'woodDark', '额枋');
      }
      if (f === 0) {
        // 前门：沿圆弧排的门扇（弧面片）+ 两侧门框柱 + 门楣，贴墙皮之外，不会切进圆墙
        const gA = gateA * 0.92, dA2 = 0.09;
        for (let k = -4; k <= 4; k++) {
          const a0 = Math.PI / 2 + (k - 0.5) * dA2, a1 = Math.PI / 2 + (k + 0.5) * dA2;
          if (Math.abs((k) * dA2) > gA) continue;
          const rr = R + 0.02;
          const q0 = [Math.cos(a0) * rr, y, Math.sin(a0) * rr];
          const q1 = [Math.cos(a1) * rr, y, Math.sin(a1) * rr];
          const q2 = [Math.cos(a1) * rr, colTop - 0.72, Math.sin(a1) * rr];
          const q3 = [Math.cos(a0) * rr, colTop - 0.72, Math.sin(a0) * rr];
          mb.quad(q0, q1, q2, q3, 'zhu', '圆殿·门扇');
          mb.quad(q3, q2, q1, q0, 'zhu', '圆殿·门扇');
        }
        for (let k = -4; k <= 4; k++) {
          const a0 = Math.PI / 2 + (k - 0.5) * dA2, a1 = Math.PI / 2 + (k + 0.5) * dA2;
          if (Math.abs(k * dA2) > gA) continue;
          const rr = R + 0.06;
          // 门楣：门顶一圈横带
          mb.quad([Math.cos(a0) * rr, colTop - 0.72, Math.sin(a0) * rr], [Math.cos(a1) * rr, colTop - 0.72, Math.sin(a1) * rr],
            [Math.cos(a1) * rr, colTop - 0.5, Math.sin(a1) * rr], [Math.cos(a0) * rr, colTop - 0.5, Math.sin(a0) * rr], 'woodDark', '圆殿·门楣');
          mb.quad([Math.cos(a0) * rr, colTop - 0.5, Math.sin(a0) * rr], [Math.cos(a1) * rr, colTop - 0.5, Math.sin(a1) * rr],
            [Math.cos(a1) * rr, colTop - 0.72, Math.sin(a1) * rr], [Math.cos(a0) * rr, colTop - 0.72, Math.sin(a0) * rr], 'woodDark', '圆殿·门楣');
          // 门槛：贴地一道
          const rq = R + 0.16;
          mb.quad([Math.cos(a0) * rq, y, Math.sin(a0) * rq], [Math.cos(a1) * rq, y, Math.sin(a1) * rq],
            [Math.cos(a1) * rq, y + 0.13, Math.sin(a1) * rq], [Math.cos(a0) * rq, y + 0.13, Math.sin(a0) * rq], 'stone', '圆殿·门槛');
          mb.quad([Math.cos(a0) * rq, y + 0.13, Math.sin(a0) * rq], [Math.cos(a1) * rq, y + 0.13, Math.sin(a1) * rq],
            [Math.cos(a1) * rq, y, Math.sin(a1) * rq], [Math.cos(a0) * rq, y, Math.sin(a0) * rq], 'stone', '圆殿·门槛');
        }
      }
      if (isTop) {
        if (!r.cut.roof) {
          const yTop = colTop + R * 0.88 + 0.3;
          roundRing(mb, {
            rOut: R + (r.eave || 0.9) * 0.72, rIn: Math.max(0.4, R * 0.12),
            yb: colTop, ytop: yTop, sides: 48, rings: 14,
            tile: r.tile, tileB: r.tileB, tag: '圆顶'
          });
          // 宝顶
          mb.cyl(0, 0, 0.22, yTop, yTop + 0.3, 10, 'stoneB', '宝顶·座');
          mb.cyl(0, 0, 0.14, yTop + 0.3, yTop + 0.62, 10, 'gold', '宝顶·珠');
        }
      } else {
        // 层间：环坡腰檐（外圈挑出、内圈收到上层圆墙外） + 平座圆盘
        const Rnext = R0 * Math.pow(0.9, f + 1);
        if (!r.cut.roof) {
          roundRing(mb, {
            rOut: R + (r.eave || 0.9), rIn: Rnext + 0.04,
            yb: colTop - 0.62, ytop: colTop - 0.06, sides: 48, rings: 5,
            tile: r.tile, tileB: r.tileB, tag: '圆腰檐' + (f + 1)
          });
        }
        mb.cyl(0, 0, R + (r.eave || 0.9), colTop - 0.02, colTop + 0.04, seg, 'wood', '圆平座');
        y = colTop + 0.04;
      }
    }
    if (r.plaque) P.plaque(mb, { dir: 'front', at: R0 + 0.7, uc: 0, vc: colH * 0.72, w: 1.5, h: 0.5, chars: 3 });
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
