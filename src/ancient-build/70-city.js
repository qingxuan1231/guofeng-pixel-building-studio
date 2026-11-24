'use strict';
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
      const step = (opt && opt.merlonStep) || r.merlonStep || 2.2;
      const mw = (opt && opt.merlonW) || r.merlonW || 0.55;
      const mh = opt && opt.merlonH != null ? opt.merlonH : (r.merlonH == null ? 0.66 : r.merlonH);
      const n = Math.max(1, Math.floor(L / step));
      for (let i = 0; i <= n; i++) {
        const x = (L * i) / n;
        sub.boxC(x, tw / 2 + 0.14, mw, 0.7, H + 0.06, H + 0.06 + mh, 'brick', '垛口·雉堞');
        if (mh > 0.5) sub.boxC(x, tw / 2 + 0.5, Math.min(0.16, mw * 0.3), 0.06, H + 0.06 + mh * 0.42, H + 0.06 + mh * 0.78, 'dark', '望孔');
      }
    }
    if (doParapet) {
      const ph = opt && opt.parapetH != null ? opt.parapetH : (r.parapetH == null ? 0.42 : r.parapetH);
      sub.box(0, L, H, H + ph, -tw / 2 - 0.12, -tw / 2 + 0.1, 'brickB', '内侧女墙');
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

  // 马面（敌台）：突出墙外，台上铺舍 / 橹顶；可关敌楼，只留平台
  function cityBastion(mb, r, p, n, H) {
    const w = r.bastionW > 0 ? r.bastionW : r.wallTopW + 1.2;
    const proj = r.bastionProj;
    const cx = p[0] + n[0] * (proj / 2 + r.wallTopW / 2);
    const cz = p[1] + n[1] * (proj / 2 + r.wallTopW / 2);
    const d = proj + r.wallTopW;
    const nx = n[0] !== 0;
    const w0 = nx ? d : w, d0 = nx ? w : d;
    const w1 = nx ? d * 0.94 : w * 0.94, d1 = nx ? w * 0.94 : d * 0.94;
    mb.boxC(cx, cz, w0, d0, 0, 0.9, 'stone', '马面·石脚');
    mb.taper(cx, cz, w0, d0, w1, d1, 0.9, H - 0.22, 'brick', '马面·台身');
    mb.boxC(cx, cz, nx ? d + 0.1 : w + 0.1, nx ? w + 0.1 : d + 0.1, H - 0.22, H, 'stoneB', '马面·压顶');
    if (r.bastionTower === false) return;
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

  // 里坊（狠 LOD）：四面坊墙 + 南面坊门 + 一片屋面体量 + 低模顶；不套院落装配器，不铺坊内街
  // 里坊（狠 LOD）：四面坊墙 + 一座坊门 + 一片屋面体量 + 低模顶；
  // 每坊用坐标派生随机数：墙框收放 12%–16%，门位不居中，开门方向在南/东/西之间轮换。
  function cityBlock(mb, r, cx, cz, bw, bd) {
    const rng = new GF.RNG((((Number(r.seed) || 1) ^ Math.round((cx + 500) * 131 + (cz + 500) * 17)) >>> 0));
    bw *= 0.84 + rng.next() * 0.16;
    bd *= 0.84 + rng.next() * 0.16;
    const wh = r.blockWallH, t = 0.22;
    const gw = Math.min(3.4, Math.max(2.2, bw * 0.24));
    const side = rng.next() < 0.32 ? (rng.next() < 0.5 ? 'east' : 'west') : 'south';
    let gx = cx, gz = cz + bd / 2;
    let axis = 'x', ox = 0, oz = 1;
    if (side === 'south') {
      gx = Math.max(cx - bw / 2 + gw / 2 + 0.7, Math.min(cx + bw / 2 - gw / 2 - 0.7, cx + rng.range(-bw * 0.24, bw * 0.24)));
      gz = cz + bd / 2;
    } else {
      const sx = cx + (side === 'east' ? bw / 2 : -bw / 2);
      gx = sx;
      gz = Math.max(cz - bd / 2 + gw / 2 + 0.7, Math.min(cz + bd / 2 - gw / 2 - 0.7, cz + rng.range(-bd * 0.24, bd * 0.24)));
      axis = 'z'; ox = side === 'east' ? 1 : -1; oz = 0;
    }
    mb.box(cx - bw / 2, cx - bw / 2 + t, 0.05, wh, cz - bd / 2, cz + bd / 2, 'plaster', '坊墙');
    mb.box(cx + bw / 2 - t, cx + bw / 2, 0.05, wh, cz - bd / 2, cz + bd / 2, 'plaster', '坊墙');
    mb.box(cx - bw / 2, cx + bw / 2, 0.05, wh, cz - bd / 2, cz - bd / 2 + t, 'plaster', '坊墙');
    if (side === 'south') {
      mb.box(cx - bw / 2, gx - gw / 2, 0.05, wh, cz + bd / 2 - t, cz + bd / 2, 'plaster', '坊墙');
      mb.box(gx + gw / 2, cx + bw / 2, 0.05, wh, cz + bd / 2 - t, cz + bd / 2, 'plaster', '坊墙');
    } else {
      mb.box(cx - bw / 2, cx + bw / 2, 0.05, wh, cz + bd / 2 - t, cz + bd / 2, 'plaster', '坊墙');
      const wx = cx + (side === 'east' ? bw / 2 - t : -bw / 2);
      mb.box(wx, wx + t, 0.05, wh, cz - bd / 2, gz - gw / 2, 'plaster', '坊墙');
      mb.box(wx, wx + t, 0.05, wh, gz + gw / 2, cz + bd / 2, 'plaster', '坊墙');
    }
    // 坊门：两根门柱 + 横枋 + 门额 + 小瓦顶，门口留 2.2~3.4m 宽
    if (axis === 'x') {
      for (const s of [-1, 1]) {
        mb.box(gx + s * gw / 2 - 0.11, gx + s * gw / 2 + 0.11, 0.05, wh + 1.15, gz - 0.5, gz + 0.08, 'wood', '坊门·门柱');
      }
      mb.box(gx - gw / 2, gx + gw / 2, wh + 0.72, wh + 0.95, gz - 0.14, gz + 0.1, 'woodDark', '坊门·横枋');
      mb.box(gx - 0.55, gx + 0.55, wh + 0.3, wh + 0.68, gz + 0.02, gz + 0.1, 'gold', '坊门·门额');
      cityCheapRoof(mb, gx, gz, gw + 1.4, 1.7, wh + 1.0, 0.42, r.tile, r.tileB, '坊门·瓦顶');
    } else {
      for (const s of [-1, 1]) {
        mb.box(gx - 0.5, gx + 0.08, 0.05, wh + 1.15, gz + s * gw / 2 - 0.11, gz + s * gw / 2 + 0.11, 'wood', '坊门·门柱');
      }
      mb.box(gx - 0.14, gx + 0.1, wh + 0.72, wh + 0.95, gz - gw / 2, gz + gw / 2, 'woodDark', '坊门·横枋');
      mb.box(gx + 0.02, gx + 0.1, wh + 0.3, wh + 0.68, gz - 0.55, gz + 0.55, 'gold', '坊门·门额');
      cityCheapRoof(mb, gx, gz, 1.7, gw + 1.4, wh + 1.0, 0.42, r.tile, r.tileB, '坊门·瓦顶');
    }
    const bodyH = wh * (1.0 + rng.next() * 0.25);
    const bz = cz - bd * (0.1 + rng.next() * 0.1);
    mb.boxC(cx, bz, bw * 0.4, bd * 0.24, wh, wh + bodyH, 'plaster', '坊内屋面体量');
    cityCheapRoof(mb, cx, bz, bw * 0.4 + 0.5, bd * 0.24 + 0.5, wh + bodyH, 0.55, r.tile, r.tileB, '坊内屋顶');
    return { x: gx, z: gz, axis, ox, oz, w: gw };
  }

  // 街边摊：细案台 + 四腿 + 蓝白条纹布棚 + 三色货；轴 x 时摊面沿 x 展开
  function cityStall(mb, x, z, axis, s, night) {
    s = s || 1;
    const w = 2.6 * s, d = 1.4 * s;
    const box = (a0, a1, y0, y1, b0, b1, mat, tag) => {
      if (axis === 'x') mb.box(x + a0, x + a1, y0, y1, z + b0, z + b1, mat, tag);
      else mb.box(x + b0, x + b1, y0, y1, z + a0, z + a1, mat, tag);
    };
    box(-w / 2, w / 2, 0.78, 0.86, -d / 2, d / 2, 'wood', '摊·案台');
    for (const a of [-w / 2 + 0.14, w / 2 - 0.14]) for (const b of [-d / 2 + 0.14, d / 2 - 0.14]) {
      box(a - 0.06, a + 0.06, 0, 0.78, b - 0.06, b + 0.06, 'woodDark', '摊·案腿');
    }
    box(-w / 2, w / 2, 0, 0.16, -d / 2, d / 2, 'woodDark', '摊·底架');
    const stripes = 5, sw = (w + 0.4) / stripes;
    for (let i = 0; i < stripes; i++) {
      const a0 = -w / 2 - 0.2 + sw * i;
      box(a0, a0 + sw, 2.1, 2.18, -d / 2 - 0.24, d / 2 + 0.24, i % 2 ? 'paintBlue' : 'paper', '摊·布棚');
    }
    box(-w / 2 - 0.25, w / 2 + 0.25, 2.2, 2.26, -0.03, 0.03, 'woodDark', '摊·棚脊');
    box(-w / 2 - 0.2, w / 2 + 0.2, 1.96, 2.1, d / 2 + 0.16, d / 2 + 0.26, 'paintBlue', '摊·前檐');
    const goods = [['gold', -0.62], ['paintGreen', 0], ['cloth', 0.62]];
    for (const [mat, a] of goods) box(a - 0.28, a + 0.28, 0.86, 1.08, -d / 2 + 0.18, -d / 2 + 0.62, mat, '摊·货物');
    if (night) P.lantern(mb, x, 1.8, z + (axis === 'x' ? d / 2 - 0.1 : 0), 0.36, '摊·灯笼');
  }

  // 幌子：木杆挑一块竖板，板面横跨街面方向
  function citySign(mb, x, z, axis, mat, w, h) {
    mb.boxC(x, z, 0.08, 0.08, 0, 3.3, 'wood', '幌杆');
    mb.boxC(x, z, 0.2, 0.2, 3.3, 3.42, 'gold', '幌杆·顶');
    if (axis === 'x') mb.box(x - w / 2, x + w / 2, 1.7, 1.7 + h, z - 0.03, z + 0.03, mat, '幌子');
    else mb.box(x - 0.03, x + 0.03, 1.7, 1.7 + h, z - w / 2, z + w / 2, mat, '幌子');
  }

  // 街灯：木杆 + 横担 + 灯笼
  function cityLamp(mb, x, z, night) {
    mb.boxC(x, z, 0.08, 0.08, 0, 2.6, 'wood', '灯杆');
    mb.boxC(x, z, 0.5, 0.5, 2.56, 2.64, 'woodDark', '灯杆·横担');
    P.lantern(mb, x, 2.0, z, night ? 0.5 : 0.38, '街灯');
  }

  // 街巷生活层：主街两侧摊、幌、灯；横竖街按密度点缀，坊门口成小市
  function cityLife(mb, r, o) {
    if (r.life === false) return 0;
    const rng = new GF.RNG((Number(r.seed) || 1) ^ 0x9e3779b9);
    const dens = GF.clamp ? GF.clamp(r.lifeDensity == null ? 0.55 : r.lifeDensity, 0, 1) : 0.55;
    const night = !!r.night;
    const step = 9 + (1 - dens) * 8;
    let n = 0;
    const place = (x, z, axis, prob) => {
      if (rng.next() > prob) return;
      const pick = rng.next();
      if (pick < (night ? 0.36 : 0.46)) cityStall(mb, x, z, axis, 0.9 + rng.next() * 0.2, night);
      else if (pick < (night ? 0.52 : 0.74)) citySign(mb, x, z, axis, rng.next() < 0.5 ? 'paintBlue' : 'cloth', 0.9 + rng.next() * 0.4, 1.4 + rng.next() * 0.6);
      else cityLamp(mb, x, z, night);
      n++;
    };
    const edge = Math.max(0.8, o.aveW / 2 - 0.5);
    // 中轴主街：两侧成行
    for (let z = -o.Di / 2 + 8; z < o.Di / 2 - 8; z += step) {
      if (Math.abs(z) < r.gateW * 1.4) continue;
      for (const s of [-1, 1]) {
        if (o.inCompound(s * edge, z)) continue;
        place(s * edge, z, 'z', 0.2 + 0.55 * dens);
      }
    }
    // 横街 / 竖街：沿街隔一段一摊，避免整条街铺满
    for (let j = 1; j < o.nz; j++) {
      const cz = -o.Di / 2 + o.cellD * j;
      if (o.inCompound(0, cz)) continue;
      for (let i = 0; i < o.nx; i++) {
        if (rng.next() > 0.35 + 0.35 * dens) continue;
        const x = -o.Wi / 2 + o.cellW * (i + (rng.next() < 0.5 ? 0.28 : 0.72));
        if (o.inCompound(x, cz)) continue;
        if (Math.abs(x) < o.aveW / 2 + 0.8) continue;
        place(x, cz - o.sw / 2 - 0.5, 'x', 0.85);
      }
    }
    for (let i = 1; i < o.nx; i++) {
      const cx = -o.Wi / 2 + o.cellW * i;
      if (o.inCompound(cx, 0)) continue;
      for (let j = 0; j < o.nz; j++) {
        if (rng.next() > 0.3 + 0.35 * dens) continue;
        const z = -o.Di / 2 + o.cellD * (j + (rng.next() < 0.5 ? 0.28 : 0.72));
        if (o.inCompound(cx, z)) continue;
        if (Math.abs(z) < o.cellD * 0.5) continue;
        place(cx - o.sw / 2 - 0.5, z, 'z', 0.8);
      }
    }
    // 坊门口的小市：按每坊实际门位与朝向摆，不再假设“南门正中”
    for (const g of (o.gates || [])) {
      if (rng.next() > 0.4 + 0.4 * dens) continue;
      const bx = g.x + g.ox * 1.7, bz = g.z + g.oz * 1.7;
      if (Math.abs(bx) > o.Wi / 2 - 2 || Math.abs(bz) > o.Di / 2 - 2) continue;
      if (o.inCompound(bx, bz)) continue;
      const ax = g.axis === 'x';
      place(bx - (ax ? 2.3 : 0), bz - (ax ? 0 : 2.3), g.axis, 0.9);
      if (rng.next() < 0.6) place(bx + (ax ? 2.3 : 0), bz + (ax ? 0 : 2.3), g.axis, 0.8);
      if (night || rng.next() < 0.45) { cityLamp(mb, bx - (ax ? 3.9 : 0), bz - (ax ? 0 : 3.9), night); n++; }
    }
    return n;
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

  // 箭楼：砖砌墩台式高楼，正面与两山密排箭窗，顶作简化歇山
  function cityArrowTower(mb, r, Wg, Dg, H) {
    const W2 = Wg * 0.78, D2 = Dg * 0.66;
    const y0 = H + 0.06, hgt = 5.6;
    mb.box(-W2 / 2, W2 / 2, y0, y0 + hgt, -D2 / 2, D2 / 2, 'brick', '箭楼·楼身');
    mb.box(-W2 / 2 - 0.12, W2 / 2 + 0.12, y0 + hgt - 0.22, y0 + hgt, -D2 / 2 - 0.1, D2 / 2 + 0.1, 'stoneB', '箭楼·压顶');
    mb.box(-W2 / 2 - 0.1, W2 / 2 + 0.1, y0 + 1.9, y0 + 2.02, -D2 / 2 - 0.08, D2 / 2 + 0.08, 'woodDark', '箭楼·腰枋');
    for (let row = 0; row < 4; row++) {
      const yy = y0 + 0.75 + row * 1.15;
      const n = Math.max(4, Math.round(W2 / 0.75));
      for (let i = 0; i < n; i++) {
        const x = -W2 / 2 + (W2 * (i + 0.5)) / n;
        mb.boxC(x, D2 / 2 + 0.02, 0.2, 0.1, yy, yy + 0.46, 'dark', '箭窗');
        mb.boxC(x, -D2 / 2 - 0.02, 0.2, 0.1, yy, yy + 0.46, 'dark', '箭窗');
      }
      const m = Math.max(2, Math.round(D2 / 1.1));
      for (let i = 0; i < m; i++) {
        const z = -D2 / 2 + (D2 * (i + 0.5)) / m;
        mb.boxC(W2 / 2 + 0.02, z, 0.1, 0.2, yy, yy + 0.46, 'dark', '箭窗');
        mb.boxC(-W2 / 2 - 0.02, z, 0.1, 0.2, yy, yy + 0.46, 'dark', '箭窗');
      }
    }
    cityCheapRoof(mb, 0, 0, W2 + r.eave * 1.4, D2 + r.eave * 1.4, y0 + hgt, 1.1, r.tile, r.tileB, '箭楼顶');
  }

  // 瓮城：城门外再套一圈小城，正面开门并与主门错开（屈曲开门），门上可起箭楼
  function cityBarbican(mb, r, g, H) {
    const bw = r.wallBaseW, tw = r.wallTopW;
    const Ww = Math.max(8, r.wengW || 18);
    const wd = Math.max(4, r.wengD || 10);
    const th = bw * 0.78, tth = tw * 0.78;
    const frontZ = bw / 2 + wd;
    const off = (r.wengOffset == null ? 0.35 : r.wengOffset) * (Ww / 2);
    const gw = Math.max(1.6, (g.main ? r.gateW : r.gateW * 0.8) * 0.9);
    const gh = Math.max(2.0, r.gateH * 0.9);
    const WH = H * 0.96;
    const sub = new GF.Mesh();

    // 跨濠台基：瓮城落在一条石台上，河面从台下穿过
    sub.box(-Ww / 2 - 0.25, Ww / 2 + 0.25, -0.55, 0.06, bw / 2 - 0.1, frontZ + th / 2 + 0.25, 'stoneB', '瓮城台基');

    // 两侧墙（顺城墙法线向外）
    for (const s of [-1, 1]) {
      const sx = s * (Ww / 2);
      sub.taper(sx, (bw / 2 + frontZ) / 2, th, wd, tth, wd, 0.06, WH - 0.12, 'brick', '瓮城侧墙');
      sub.box(sx - tth / 2 - 0.12, sx + tth / 2 + 0.12, WH - 0.12, WH, bw / 2, frontZ, 'stoneB', '瓮城侧墙·压顶');
      const step = Math.max(1.0, r.merlonStep || 2.2);
      const mw = Math.max(0.3, r.merlonW || 0.55);
      const mh = r.merlonH == null ? 0.66 : r.merlonH;
      const n2 = Math.max(1, Math.floor(wd / step));
      for (let i = 0; i <= n2; i++) {
        const z = bw / 2 + (wd * i) / n2;
        sub.boxC(sx + s * (tth / 2 + 0.14), z, 0.7, mw, WH, WH + mh, 'brick', '瓮城垛口');
      }
    }

    // 正面墙，留出屈曲门洞；门洞左右各一段
    const gap = gw + 2.2;
    const segs = [[-Ww / 2 - th / 2, off - gap / 2], [off + gap / 2, Ww / 2 + th / 2]];
    for (const [x0, x1] of segs) {
      const L2 = x1 - x0;
      if (L2 < 1.2) continue;
      sub.taper((x0 + x1) / 2, frontZ, L2, th, L2, tth, 0.06, WH - 0.12, 'brick', '瓮城正面墙');
      sub.box(x0, x1, WH - 0.12, WH, frontZ - tth / 2 - 0.12, frontZ + tth / 2 + 0.12, 'stoneB', '瓮城正面墙·压顶');
      const step = Math.max(1.0, r.merlonStep || 2.2);
      const mw = Math.max(0.3, r.merlonW || 0.55);
      const mh = r.merlonH == null ? 0.66 : r.merlonH;
      const n2 = Math.max(1, Math.floor(L2 / step));
      for (let i = 0; i <= n2; i++) {
        const x = x0 + (L2 * i) / n2;
        sub.boxC(x, frontZ + tth / 2 + 0.14, mw, 0.7, WH, WH + mh, 'brick', '瓮城垛口');
      }
    }

    // 瓮城正门 + 箭楼
    const gt = new GF.Mesh();
    cityGateTerrace(gt, r, gap, th + 1.8, [{ u: 0, w: gw, h: gh }], WH);
    gt.translate(off, 0, frontZ);
    sub.merge(gt);
    if (r.arrowTower !== false) {
      const at = new GF.Mesh();
      cityArrowTower(at, r, gap, th + 1.8, WH);
      at.translate(off, 0, frontZ);
      sub.merge(at);
    }

    const gateAng = -Math.atan2(g.dir[1], g.dir[0]) * 180 / Math.PI;
    sub.rotateY(gateAng, 0, 0);
    sub.translate(g.cx, 0, g.cz);
    mb.merge(sub);
  }

  // 门桥：石桥 / 吊桥（可收起），带栏杆；有瓮城时从瓮城正门跨到濠外
  function cityGateBridge(mb, r, g, mw) {
    const bw = r.wallBaseW;
    const hasW = !!r.wengcheng;
    const wd = hasW ? Math.max(4, r.wengD || 10) : 0;
    const start = bw / 2 + (hasW ? wd + (bw * 0.78 + 1.8) / 2 : -0.2);
    const end = bw / 2 + mw + 1.0;
    const len = end - start;
    if (len < 0.8) return;
    const u = hasW ? (r.wengOffset == null ? 0.35 : r.wengOffset) * (Math.max(8, r.wengW || 18) / 2) : 0;
    const half = Math.max(1.0, (g.Wg * 0.42) / 2);
    const sub = new GF.Mesh();

    if (r.drawbridge && r.bridgeUp) {
      // 收起的桥面：立在门洞外的一整块木板，高度取河宽
      const stand = start + (hasW ? 0.2 : (bw + 2.6) / 2 + 0.1);
      sub.box(u - half, u + half, 0, Math.min(len, 11), stand, stand + 0.22, 'woodDark', '吊桥·收起');
      for (const s of [-1, 1]) {
        sub.box(u + s * half - 0.1, u + s * half + 0.1, 0.2, 1.4, stand - 0.2, stand + 0.3, 'wood', '吊桥·立柱');
      }
    } else {
      const mat = r.drawbridge ? 'wood' : 'stone';
      sub.box(u - half, u + half, 0, 0.2, start, end, mat, r.drawbridge ? '吊桥' : '护城河石桥');
      if (r.drawbridge) {
        for (let i = 1; i < 6; i++) {
          const z = start + (len * i) / 6;
          sub.box(u - half, u + half, 0.2, 0.205, z - 0.035, z + 0.035, 'woodDark', '吊桥板缝');
        }
        for (const s of [-1, 1]) {
          const x = u + s * (half - 0.12);
          for (const z of [start + 0.25, end - 0.25]) {
            sub.boxC(x, z, 0.16, 0.16, 0.2, 1.3, 'wood', '吊桥栏杆');
          }
          sub.box(x - 0.06, x + 0.06, 1.2, 1.32, start, end, 'wood', '吊桥寻杖');
        }
      }
    }
    const gateAng = -Math.atan2(g.dir[1], g.dir[0]) * 180 / Math.PI;
    sub.rotateY(gateAng, 0, 0);
    sub.translate(g.cx, 0, g.cz);
    mb.merge(sub);
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

    // 城门：城台券洞 + 城楼；再加瓮城（屈曲开门 + 箭楼）
    let wengCount = 0;
    for (const g of gates) {
      const sub = new GF.Mesh();
      cityGateTerrace(sub, r, g.Wg, g.Dg, g.doors, H);
      if (r.gateTower) cityGateTower(sub, r, g.Wg, g.Dg, H, !g.main);
      const gateAng = -Math.atan2(g.dir[1], g.dir[0]) * 180 / Math.PI;
      sub.rotateY(gateAng, 0, 0);
      sub.translate(g.cx, 0, g.cz);
      mb.merge(sub);
      if (r.wengcheng) { cityBarbican(mb, r, g, H); wengCount++; }
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
        for (const g of gates) cityGateBridge(mb, r, g, mw);
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
    const wardGates = [];
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        const cx = -Wi / 2 + cellW * (i + 0.5);
        const cz = -Di / 2 + cellD * (j + 0.5);
        if (inCompound(cx, cz)) continue;
        const b2w = Math.max(2, cellW - sw), b2d = Math.max(2, cellD - sw);
        const g = cityBlock(mb, r, cx, cz, b2w, b2d);
        if (g) wardGates.push(g);
      }
    }

    // 街巷生活层：沿主街与横竖街摆摊挂幌点灯
    const lifeN = cityLife(mb, r, {
      Wi, Di, nx, nz, cellW, cellD, aveW, sw, inCompound, gates: wardGates
    });

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
    mb.cityStats = { bastionCount, bastionSpacings, wengcheng: wengCount, life: lifeN, wards: (function () {
      let n = 0;
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        const cx = -Wi / 2 + cellW * (i + 0.5), cz = -Di / 2 + cellD * (j + 0.5);
        if (!inCompound(cx, cz)) n++;
      }
      return n;
    })(), nx, nz, palace: [px, pz, pW, pD] };
  }
