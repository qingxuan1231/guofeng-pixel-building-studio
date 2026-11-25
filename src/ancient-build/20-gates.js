'use strict';
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
    // 门洞内衬：只给洞壁与券顶，洞底通地、前后贯通，绝不拿一个实心暗盒把洞填死
    {
      const zf0 = -D / 2 - 1.18, zf1 = D / 2 + 1.18;
      const wallT = 0.09;
      for (const s of [-1, 1]) {
        // 两侧洞壁：贴着列柱挖出来的洞口，竖直到底
        mb.box(s * gateW / 2 - wallT, s * gateW / 2 + wallT, 0, gateH * 0.98, zf0, zf1, 'brickB', '门洞·侧壁');
      }
      // 券顶内弧：沿起拱线以上半圆分段铺一圈弧面（内衬，不是实心）
      const R2 = gateW / 2 + 0.04, cy2 = gateH * 0.4;
      const segs = 10;
      for (let k = 0; k < segs; k++) {
        const a0 = Math.PI * (0.04 + 0.92 * k / segs), a1 = Math.PI * (0.04 + 0.92 * (k + 1) / segs);
        const p0 = [Math.cos(a0) * R2, cy2 + Math.sin(a0) * R2 * 0.82];
        const p1 = [Math.cos(a1) * R2, cy2 + Math.sin(a1) * R2 * 0.82];
        mb.quad([p0[0], p0[1], zf0], [p1[0], p1[1], zf0], [p1[0], p1[1], zf1], [p0[0], p0[1], zf1], 'brickB', '门洞·券顶');
        mb.quad([p0[0], p0[1], zf1], [p1[0], p1[1], zf1], [p1[0], p1[1], zf0], [p0[0], p0[1], zf0], 'brickB', '门洞·券顶');
      }
      // 洞底石板：只铺 0.06 厚一层，路面还是通的
      mb.box(-gateW / 2, gateW / 2, 0, 0.06, zf0, zf1, 'slab', '门洞·石道');
    }
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
        // 门扇退进洞内 0.35m：外看是一段有深度的门洞，不是一个贴在墙面上的门皮
        const z = sz * (D / 2 + 0.85);
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
      dougong: true, era: r.era, dgScale: 0.85, queti: true
    });
    if (!r.cut.roof) {
      GF.roofs.build(mb, {
        cx: 0, cz: 0,
        x0: -W2 / 2 - r.eave, x1: W2 / 2 + r.eave,
        z0: -D2 / 2 - r.eave, z1: D2 / 2 + r.eave,
        yb: top.roofY, rise: r.slope * (D2 / 2 + r.eave) * 1.1, type: 'gableHip',
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
  /* ------------- 多建筑院落：单体登记与逐栋改写 ------------- */
  // 每栋单体登记一条：id / 中文名 / 中心 / 平面尺寸 / 朝向 / 台基高 / 总高。
  // 应用侧按 id 写 r.units[id] 覆盖，构建时把覆盖并回这一栋的配方与体量。
  function unitOverride(r, id) {
    const u = r.units && id != null ? r.units[id] : null;
    return u && typeof u === 'object' ? u : null;
  }
  const UNIT_GEOM = ['W', 'D', 'bays', 'floors', 'roofType', 'eave', 'floorH', 'veranda', 'partition', 'plaque', 'cheap', 'parts'];
  const UNIT_RECIPE = ['baseH', 'floorH', 'slope', 'upturn', 'wallMat', 'colMat', 'winPattern', 'winW', 'winH',
    'doorStyle', 'doorW', 'doorH', 'plaque', 'tileColor', 'tile', 'tileB', 'railing', 'pedestal', 'steps'];
  function unitGeom(base, ov) {
    const out = Object.assign({}, base);
    if (!ov) return out;
    UNIT_GEOM.forEach((k) => { if (ov[k] != null) out[k] = ov[k]; });
    // 这一栋要求做格心 / 门式时，就不能再走 cheap 低模（低模的门窗是素板，格心与门扇都不建）
    if (ov.winPattern != null || ov.doorStyle != null) out.cheap = false;
    return out;
  }
  function unitRecipe(r, ov) {
    if (!ov) return r;
    const ru = Object.assign({}, r);
    UNIT_RECIPE.forEach((k) => { if (ov[k] != null) ru[k] = ov[k]; });
    const tileMap = {
      grey: ['tile', 'tileB'], celadon: ['glazeG', 'glazeGD'], yellow: ['glazeY', 'glazeYD'],
      blue: ['glazeB', 'glazeBD'], clay: ['terracotta', 'terracotta'], thatch: ['thatch', 'thatchB']
    };
    if (ov.tileColor && tileMap[ov.tileColor]) { ru.tile = tileMap[ov.tileColor][0]; ru.tileB = tileMap[ov.tileColor][1]; }
    return ru;
  }
  // 逐栋拖动：units[id].dx / dz 记这栋相对布局位置的位移，构建时只挪这一栋
  function unitShift(r, id) {
    const u = r.units && id != null ? r.units[id] : null;
    return { dx: u && u.dx != null ? +u.dx : 0, dz: u && u.dz != null ? +u.dz : 0 };
  }
  // 构件局部包围盒 → 世界坐标：先绕 Y 旋转，再平移到这一栋的落点
  function shiftPartBoxes(parts, x, z, rot, yOff) {
    const out = {};
    const a = ((rot || 0) * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
    yOff = yOff || 0;
    Object.keys(parts || {}).forEach((k) => {
      const b = parts[k];
      if (!b) return;
      let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
      for (const px of [b.x0, b.x1]) for (const pz of [b.z0, b.z1]) {
        const wx = px * ca + pz * sa + (x || 0);
        const wz = -px * sa + pz * ca + (z || 0);
        if (wx < x0) x0 = wx; if (wx > x1) x1 = wx;
        if (wz < z0) z0 = wz; if (wz > z1) z1 = wz;
      }
      out[k] = { x0, x1, z0, z1, y0: b.y0 + yOff, y1: b.y1 + yOff };
    });
    return out;
  }
  // 登记一栋（画布点选、线框与编辑器都靠这条；同时进 moves 供按点位拾取）
  function regUnit(mb, id, label, x, z, W, D, rot, topY, baseH, fixed, parts, yOff) {
    if (!mb.units) mb.units = [];
    mb.units.push({
      id: String(id), label: label || String(id), x: +(x || 0).toFixed(2), z: +(z || 0).toFixed(2),
      W: +W.toFixed(2), D: +D.toFixed(2), rot: Math.round(rot || 0),
      topY: +(topY || 0).toFixed(2), baseH: +(baseH || 0).toFixed(2), fixed: !!fixed,
      parts: parts ? shiftPartBoxes(parts, x, z, rot, yOff) : null
    });
    mb.moves.push({ key: 'u:' + id, label: label || String(id), x: x || 0, z: z || 0, r: Math.max(W, D) / 2 });
  }

  function houseUnit(r, o) {
    // 构件级拆分：台基 / 屋身 / 屋面各建一张子网格，再按需要合并。
    // 子网格的包围盒登记到 unit.parts，供古建页按「这一栋的台基 / 屋身 / 屋面」选中和隐藏。
    const kb = new GF.Mesh(), kbBody = new GF.Mesh(), kbRoof = new GF.Mesh();
    const m = new GF.Mesh();
    const W = o.W, D = o.D;    const b = base(kb, r, { W, D });
    const top = body(kbBody, {
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
        kbBody.cyl(x, vz, 0.16, b.h + 0.04, top.topY - 0.32, 8, r.colMat, '廊柱');
        kbBody.boxC(x, vz, 0.26, 0.26, b.h + 0.04, b.h + 0.17, 'stone', '柱础');
      }
      GF.beamBetween(kbBody, [-W / 2, top.topY - 0.42, vz], [W / 2, top.topY - 0.42, vz], 0.14, 0.26, 'wood', '檐枋');
      GF.beamBetween(kbBody, [-W / 2, top.topY - 0.7, vz], [W / 2, top.topY - 0.7, vz], 0.06, 0.16, 'wood', '挂落');
    }
    // 室内隔断（碧纱橱）
    if (o.partition != null) {
      P.partition(kbBody, {
        dir: 'front', at: o.partition,
        u0: -W / 2 + 0.6, u1: W / 2 - 0.6,
        v0: b.h + 0.06, v1: b.h + r.floorH - 0.3,
        style: 'screen', open: o.openW || 1.8, pattern: r.winPattern, tag: '碧纱橱'
      });
    }
    (o.interior || []).forEach((it) => {
      P.furniture(kbBody, it.kind, it.x, it.z, it.s || 1, 0, '陈设·' + it.kind);
    });
    if (!o.noRoof && !(o.cut || r.cut).roof) {
      GF.roofs.build(kbRoof, {
        cx: 0, cz: 0,
        x0: -W / 2 - eo, x1: W / 2 + eo,
        z0: -D / 2 - eo, z1: D / 2 + eo,
        yb: top.roofY, rise: r.slope * (D / 2 + eo),
        type: o.roofType || 'gable',
        tile: r.tile, tileB: r.tileB, upturn: r.upturn * 0.8,
        plain: o.plain || o.cheap,
        ridgeStyle: 'plain', beasts: 0, gableMat: r.wallMat, tag: '屋面'
      });
      if (o.horseWall) {
        P.horseHeadWall(kbRoof, { cx: 0, z: D / 2 + 0.1, halfLen: W / 2 + 0.4, y0: top.topY - 0.3, yTop: top.topY + r.slope * (D / 2 + r.eave) * 0.8, steps: 3, depth: 0.3 });
        P.horseHeadWall(kbRoof, { cx: 0, z: -D / 2 - 0.1, halfLen: W / 2 + 0.4, y0: top.topY - 0.3, yTop: top.topY + r.slope * (D / 2 + r.eave) * 0.8, steps: 3, depth: 0.3 });
      }
    }
    if (o.plaque) {
      P.plaque(kbBody, { dir: 'front', at: D / 2 - 0.02, uc: 0, vc: top.topY - 0.85, w: Math.min(2.2, W / 3), h: 0.52, chars: o.chars || 3 });
    }
    const hide = (o.parts && o.parts.hide) || {};
    // 屋身再按标签拆成：门 / 窗 / 廊柱 / 栏杆 / 其余墙体屋身。
    // 这样台基、屋身、屋面之外，门窗柱栏也能单独选中和隐藏。
    const isRail = (t) => /栏杆/.test(t);
    const isDoor = (t) => /^(门|隔扇|板门|门扇|门框|门钉|门环|门槛|门楣)/.test(t);
    const isWin = (t) => /^(窗|槛窗|格心|窗棂|窗纸|窗楣|窗台)/.test(t);
    const isCol = (t) => /柱/.test(t) && !isRail(t);
    const bodyCore = kbBody.subset((t) => !(isRail(t) || isDoor(t) || isWin(t) || isCol(t)));
    const bodyDoors = kbBody.subset((t) => isDoor(t));
    const bodyWins = kbBody.subset((t) => isWin(t));
    const bodyCols = kbBody.subset((t) => isCol(t));
    const bodyRails = kbBody.subset((t) => isRail(t));
    if (!hide.base) m.merge(kb);
    if (!hide.body) {
      m.merge(bodyCore);
      if (!hide.doors) m.merge(bodyDoors);
      if (!hide.windows) m.merge(bodyWins);
      if (!hide.columns) m.merge(bodyCols);
      if (!hide.railing) m.merge(bodyRails);
    }
    if (!hide.roof) m.merge(kbRoof);
    const box = (mm) => (mm.triCount ? mm.bounds() : null);
    return {
      mesh: m, topY: top.topY, baseH: b.h,
      parts: {
        base: box(kb), body: box(kbBody), roof: box(kbRoof),
        doors: box(bodyDoors), windows: box(bodyWins), columns: box(bodyCols), railing: box(bodyRails)
      }
    };
  }
