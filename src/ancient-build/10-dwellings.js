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
      dougong: r.dougong, era: r.era, dgScale: r.dgScale, dgStyle: r.dgStyle, dgEye: r.dgEye, queti: r.queti
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
          yb: top.roofY + 0.2, rise: rise * 0.85,
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
          yb: top.roofY, rise, type: r.roofType,
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
      dougong: r.dougong, era: r.era, dgScale: r.dgScale, dgStyle: r.dgStyle, dgEye: r.dgEye, queti: r.queti,
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
        GF.roofs.cone(mb, {
          cx: 0, cz: 0, rOut, rIn, sides, rot,
          yb: y + tierHi, ytop: y + tierHi + eaveH,
          tile: r.tile, tileB: r.tileB, tag: '塔檐', tileEnd: 'tileEnd', woodEdge: false,
          upturn: up, trim: r.trim
        });
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
