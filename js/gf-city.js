/* 城池工坊 · 城布局生成（复用 core/parts/roof/build/render） */
(function (global) {
  'use strict';
  const GF = (global.GF = global.GF || {});

  const DEF_CITY = {
    seed: 20261123,
    w: 100, d: 88,
    wallH: 9.0, wallT: 4.6, gateW: 11, roadW: 9.5, moatW: 9,
    cols: 3, rows: 3, density: 0.9,
    moat: true, matta: true, tower: true, palace: true, gateTowerOn: true,
    bastionGap: 26, blockWallH: 2.2, blockGateW: 3.6, blockWallOn: true, blockJit: 1, axisHalls: 1,
    wallTaper: 0.16, merlon: true, merlonStep: 1.8, merlonW: 1.0, merlonH: 0.95,
    parapet: false, parapetH: 0.8, mattaTower: true, mattaW: 8.0, mattaOut: 4.2,
    wengcheng: false, wengD: 10, wengW: 18, wengOffset: 0.35, arrowTower: true,
    drawbridge: false, bridgeUp: false,
    life: true, lifeDensity: 0.6, night: false, alleyW: 1.4,
    roofColor: 'grey', trimColor: 'green',
    render: {
      ppm: 14, pitch: 52, yaw: 35, palette: 'qingya',
      style: 'pixel', styleAmount: 0.7, outline: true, shadow: true,
      sunAz: null, shadowAngle: 1.1, transparent: true
    }
  };

  GF.cityDefault = function () { return JSON.parse(JSON.stringify(DEF_CITY)); };
  GF.cityNormalize = function (src) {
    const r = Object.assign({}, DEF_CITY, src || {});
    r.render = Object.assign({}, DEF_CITY.render, (src && src.render) || {});
    r.seed = Number(r.seed) || DEF_CITY.seed;
    r.wallTaper = GF.clamp ? GF.clamp(Number(r.wallTaper) || 0, 0, 0.4) : Number(r.wallTaper) || 0;
    r.merlonStep = Math.max(0.8, Number(r.merlonStep) || DEF_CITY.merlonStep);
    r.merlonW = Math.max(0.3, Number(r.merlonW) || DEF_CITY.merlonW);
    r.merlonH = Math.max(0.2, Number(r.merlonH) || DEF_CITY.merlonH);
    r.wengD = Math.max(4, Number(r.wengD) || DEF_CITY.wengD);
    r.wengW = Math.max(8, Number(r.wengW) || DEF_CITY.wengW);
    r.lifeDensity = Math.max(0, Math.min(1, r.lifeDensity == null ? DEF_CITY.lifeDensity : Number(r.lifeDensity)));
    r.blockJit = Math.max(0, Math.min(1, r.blockJit == null ? DEF_CITY.blockJit : Number(r.blockJit)));
    return r;
  };

  function pbox(mb, x0, x1, y0, y1, z0, z1, mat, tag) {
    mb.box(Math.min(x0, x1), Math.max(x0, x1), Math.min(y0, y1), Math.max(y0, y1),
      Math.min(z0, z1), Math.max(z0, z1), mat, tag);
  }

  // 一段城墙：墙体收分 + 压顶 + 垛口 + 内侧女墙 + 马面（台上可起敌楼）
  function wallRun(mb, a, b, H, T, o) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 0.5) return;
    const alongX = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]);
    const cx = (a[0] + b[0]) / 2, cz = (a[1] + b[1]) / 2;
    const topT = T * (1 - (o.wallTaper == null ? 0 : o.wallTaper));
    const walkH = H + 0.18;

    if (alongX) mb.taper(cx, cz, len, T, len, topT, 0, H, o.wallMat || 'brick', '城墙');
    else mb.taper(cx, cz, T, len, topT, len, 0, H, o.wallMat || 'brick', '城墙');
    if (alongX) mb.box(cx - len / 2, cx + len / 2, H, walkH, cz - topT / 2 - 0.1, cz + topT / 2 + 0.1, 'stoneDark', '城墙·压顶');
    else mb.box(cx - topT / 2 - 0.1, cx + topT / 2 + 0.1, H, walkH, cz - len / 2, cz + len / 2, 'stoneDark', '城墙·压顶');

    const outSign = alongX ? (cz >= 0 ? 1 : -1) : (cx >= 0 ? 1 : -1);
    const mw = o.merlonW == null ? 1.0 : o.merlonW;
    const mh = o.merlonH == null ? 0.95 : o.merlonH;
    if (o.merlon !== false) {
      const step = Math.max(0.8, o.merlonStep || 1.8);
      const n = Math.max(2, Math.round(len / step));
      const edge = topT / 2 - 0.22;
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
        if (alongX) {
          mb.boxC(x, z + outSign * edge, mw, 0.7, walkH, walkH + mh, 'brickB', '垛口');
          if (mh > 0.5) mb.boxC(x, z + outSign * (edge + 0.22), Math.min(0.18, mw * 0.25), 0.08, walkH + mh * 0.4, walkH + mh * 0.75, 'dark', '望孔');
        } else {
          mb.boxC(x + outSign * edge, z, 0.7, mw, walkH, walkH + mh, 'brickB', '垛口');
          if (mh > 0.5) mb.boxC(x + outSign * (edge + 0.22), z, 0.08, Math.min(0.18, mw * 0.25), walkH + mh * 0.4, walkH + mh * 0.75, 'dark', '望孔');
        }
      }
    }
    if (o.parapet) {
      const ph = o.parapetH == null ? 0.8 : o.parapetH;
      if (alongX) mb.box(cx - len / 2, cx + len / 2, walkH, walkH + ph, cz + outSign * (topT / 2 - 0.12), cz + outSign * (topT / 2 + 0.12), 'brickB', '内侧女墙');
      else mb.box(cx + outSign * (topT / 2 - 0.12), cx + outSign * (topT / 2 + 0.12), walkH, walkH + ph, cz - len / 2, cz + len / 2, 'brickB', '内侧女墙');
    }

    if (o.matta && len > (o.bastionGap || 26) * 0.6) {
      const gap = o.bastionGap || 26;
      const w = o.mattaW > 0 ? o.mattaW : topT + 4.6;
      const proj = o.mattaOut == null ? T / 2 + 1.9 : o.mattaOut;
      const m = Math.max(1, Math.floor(len / gap));
      for (let i = 1; i <= m; i++) {
        const t = i / (m + 1);
        const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
        const cxm = alongX ? x : x + outSign * (proj / 2);
        const czm = alongX ? z + outSign * (proj / 2) : z;
        if (alongX) {
          mb.taper(cxm, czm, w, proj + topT * 0.4, w * 0.94, (proj + topT * 0.4) * 0.94, 0, H, 'brick', '马面');
          mb.boxC(cxm, czm, w + 0.1, proj + topT * 0.4 + 0.1, H, walkH, 'stoneDark', '马面压顶');
        } else {
          mb.taper(cxm, czm, proj + topT * 0.4, w, (proj + topT * 0.4) * 0.94, w * 0.94, 0, H, 'brick', '马面');
          mb.boxC(cxm, czm, proj + topT * 0.4 + 0.1, w + 0.1, H, walkH, 'stoneDark', '马面压顶');
        }
        if (o.mattaTower !== false) {
          const sub = building({
            type: 'pavilion', bays: 1, bayW: Math.min(3.6, w * 0.55), depth: Math.min(3.6, w * 0.55),
            floorH: 2.5, baseH: 0.3, steps: 0, wallMat: 'timber', colMat: 'timber',
            tileColor: o.roofColor, eave: 0.8, slope: 0.5, upturn: 0.4, roofType: 'pyramid'
          });
          sub.translate(cxm, walkH, czm);
          mb.merge(sub);
        }
      }
    }
  }

  function building(o) {
    const r = Object.assign({
      type: 'house', bays: 3, bayW: 2.9, depth: 5.6, floors: 1, floorH: 2.9, baseH: 0.35, steps: 1,
      wallMat: 'plaster', colMat: 'wood', tileColor: 'grey', eave: 0.85, slope: 0.5,
      roofType: 'gable', upturn: 0.2, plaque: false, lanterns: false
    }, o);
    r.env = Object.assign({
      showGround: false, ground: 'none', groundSize: 0, trees: [], rocks: 0, pond: null,
      banners: 0, path: false, props: [], move: null
    }, o.env || {});
    return GF.build(r);
  }

  function gateHouse(mb, cx, cz, o, along) {
    const H = o.wallH, T = o.wallT, GW = o.gateW;
    const L = 16, TH = T + 1.6, leftW = (L - GW) / 2;
    for (const s of [-1, 1]) {
      if (along === 'x') mb.boxC(cx + s * (GW / 2 + leftW / 2), cz, leftW, TH, 0, H, 'brick', '城门墩');
      else mb.boxC(cx, cz + s * (GW / 2 + leftW / 2), TH, leftW, 0, H, 'brick', '城门墩');
    }
    if (along === 'x') mb.boxC(cx, cz, GW, TH, H - 1.4, H, 'brick', '城门过梁');
    else mb.boxC(cx, cz, TH, GW, H - 1.4, H, 'brick', '城门过梁');

    if (o.gateTowerOn === false) return;
    const sub = building({
      type: 'ge', bays: 3, bayW: 3.2, depth: 5.4, floors: 2, floorH: 3.0, baseH: 0.5, steps: 0,
      wallMat: 'timber', colMat: 'timber', tileColor: o.roofColor, eave: 1.0, slope: 0.5,
      upturn: 0.45, roofType: 'gableHip', dougong: true, dgScale: 0.8,
      cut: { front: false, back: false, left: false, right: false, roof: false }
    });
    sub.rotateY(along === 'x' ? 0 : 90, 0, 0);
    sub.translate(cx, H + 0.4, cz);
    mb.merge(sub);
  }

  // 瓮城：门外一圈小城，正面屈曲开门，门上起箭楼；跨濠铺石台
  function barbican(mb, o, gx, gz, axis, sign) {
    const bw = o.wallT, H = o.wallH * 0.96, th = bw * 0.78;
    const Ww = o.wengW || 18, wd = o.wengD || 10;
    const off = (o.wengOffset == null ? 0.35 : o.wengOffset) * (Ww / 2);
    const gw = Math.max(2.0, o.gateW * 0.9);
    const gap = gw + 2.0;
    const face = sign * (bw / 2 + wd);
    const wo = Object.assign({}, o, { matta: false, wallH: H, wallT: bw, merlon: o.merlon !== false });
    const W2 = Ww / 2;

    if (axis === 'x') {
      // 跨濠石台
      pbox(mb, gx - W2 - 0.3, gx + W2 + 0.3, -0.35, 0.06, gz + sign * (bw / 2 - 0.1), gz + face + sign * th / 2, 'stone', '瓮城台基');
      wallRun(mb, [gx - W2, gz + sign * bw / 2], [gx - W2, gz + face], H, th, wo);
      wallRun(mb, [gx + W2, gz + sign * bw / 2], [gx + W2, gz + face], H, th, wo);
      wallRun(mb, [gx - W2 - th / 2, gz + face], [gx + off - gap / 2, gz + face], H, th, wo);
      wallRun(mb, [gx + off + gap / 2, gz + face], [gx + W2 + th / 2, gz + face], H, th, wo);
      gateHouse(mb, gx + off, gz + face, Object.assign({}, o, { wallH: H, wallT: th, gateW: gw, gateTowerOn: false }), 'x');
      if (o.arrowTower !== false) arrowTower(mb, gx + off, gz + face, gw + 4, 4.4, H, o, 'x');
    } else {
      pbox(mb, gx + sign * (bw / 2 - 0.1), gx + face + sign * th / 2, -0.35, 0.06, gz - W2 - 0.3, gz + W2 + 0.3, 'stone', '瓮城台基');
      wallRun(mb, [gx + sign * bw / 2, gz - W2], [gx + face, gz - W2], H, th, wo);
      wallRun(mb, [gx + sign * bw / 2, gz + W2], [gx + face, gz + W2], H, th, wo);
      wallRun(mb, [gx + face, gz - W2 - th / 2], [gx + face, gz + off - gap / 2], H, th, wo);
      wallRun(mb, [gx + face, gz + off + gap / 2], [gx + face, gz + W2 + th / 2], H, th, wo);
      gateHouse(mb, gx + face, gz + off, Object.assign({}, o, { wallH: H, wallT: th, gateW: gw, gateTowerOn: false }), 'z');
      if (o.arrowTower !== false) arrowTower(mb, gx + face, gz + off, 4.4, gw + 4, H, o, 'z');
    }
  }

  // 箭楼：两层砖墩楼，正面密排箭窗
  function arrowTower(mb, cx, cz, w, d, H, o, along) {
    const sub = building({
      type: 'ge', bays: 3, bayW: w / 3, depth: d, floors: 2, floorH: 2.6, baseH: 0.4, steps: 0,
      wallMat: 'brick', colMat: 'timber', tileColor: o.roofColor, eave: 1.0, slope: 0.5,
      upturn: 0.4, roofType: 'gableHip', dougong: true, dgScale: 0.7,
      cut: { front: false, back: false, left: false, right: false, roof: false }
    });
    sub.rotateY(along === 'x' ? 0 : 90, 0, 0);
    sub.translate(cx, H + 0.4, cz);
    mb.merge(sub);
  }

  // 街边摊：案台 + 四柱布棚 + 三色货物
  function streetStall(mb, x, z, axis, s) {
    const w = 3.2 * s, d = 1.5 * s;
    const X = (a) => (axis === 'x' ? x + a : x);
    const Z = (a) => (axis === 'x' ? z : z + a);
    const box = (a0, a1, y0, y1, b0, b1, mat, tag) => {
      if (axis === 'x') mb.box(x + a0, x + a1, y0, y1, z + b0, z + b1, mat, tag);
      else mb.box(x + b0, x + b1, y0, y1, z + a0, z + a1, mat, tag);
    };
    box(-w / 2, w / 2, 0.82, 0.9, -d / 2, d / 2, 'wood', '摊·案台');
    for (const a of [-w / 2 + 0.18, w / 2 - 0.18]) {
      for (const b of [-d / 2 + 0.18, d / 2 - 0.18]) {
        box(a - 0.07, a + 0.07, 0, 0.82, b - 0.07, b + 0.07, 'woodDark', '摊·案腿');
      }
    }
    for (const a of [-w / 2 + 0.12, w / 2 - 0.12]) {
      for (const b of [-d / 2 + 0.12, d / 2 - 0.12]) {
        box(a - 0.06, a + 0.06, 0, 2.3, b - 0.06, b + 0.06, 'woodDark', '摊·棚柱');
      }
    }
    // 布棚：条纹棚顶 + 前檐垂布，远看就是市集摊
    const stripes = 6, sw = (w + 0.5) / stripes;
    for (let i = 0; i < stripes; i++) {
      const a0 = -w / 2 - 0.25 + sw * i;
      box(a0, a0 + sw, 2.3, 2.38, -d / 2 - 0.28, d / 2 + 0.28,
        i % 2 ? 'paintBlue' : 'paper', '摊·布棚');
    }
    box(-w / 2 - 0.3, w / 2 + 0.3, 2.4, 2.46, -0.03, 0.03, 'woodDark', '摊·棚脊');
    box(-w / 2 - 0.25, w / 2 + 0.25, 2.14, 2.3, d / 2 + 0.18, d / 2 + 0.3, 'paintBlue', '摊·前檐');
    const goods = [['gold', -0.7], ['paintGreen', 0], ['cloth', 0.7]];
    for (const [mat, a] of goods) box(a - 0.35, a + 0.35, 0.9, 1.16, -d / 2 + 0.2, -d / 2 + 0.75, mat, '摊·货物');
    if (s > 0.9) GF.parts.lantern(mb, X(-w / 2 + 0.2), 2.0, Z(d / 2 - 0.2), 0.45, '摊·灯笼');
  }

  // 幌子 / 招牌：一根杆挑一块竖板，板面朝向街心
  function shopSign(mb, x, z, axis, mat, w, h) {
    w = w || 1.0; h = h || 1.9;
    mb.boxC(x, z, 0.1, 0.1, 0, 3.8, 'wood', '幌杆');
    mb.boxC(x, z, 0.24, 0.24, 3.8, 3.94, 'gold', '幌杆·顶');
    if (axis === 'x') mb.box(x - w / 2, x + w / 2, 1.9, 1.9 + h, z - 0.04, z + 0.04, mat, '幌子');
    else mb.box(x - 0.04, x + 0.04, 1.9, 1.9 + h, z - w / 2, z + w / 2, mat, '幌子');
  }

  // 街灯：一根木杆挑一盏灯笼
  function streetLamp(mb, x, z, s) {
    s = s || 0.72;
    mb.boxC(x, z, 0.1, 0.1, 0, 2.9, 'wood', '灯杆');
    mb.boxC(x, z, 0.6, 0.6, 2.86, 2.94, 'woodDark', '灯杆·横担');
    GF.parts.lantern(mb, x, 2.2, z, s, '街灯');
  }

  GF.buildCity = function (src) {
    const r = GF.cityNormalize(src);
    const rng = new GF.RNG(r.seed);
    const mb = new GF.Mesh();
    const HW = r.w / 2, HD = r.d / 2, H = r.wallH, T = r.wallT, GW = r.gateW;

    /* 城内地面：夯土 + 沿墙砖铺 */
    pbox(mb, -HW + T, HW - T, -0.4, 0.02, -HD + T, HD - T, 'soil', '城内地面');
    const bw = 3.0;
    for (const s of [-1, 1]) {
      pbox(mb, -HW + T, HW - T, 0, 0.03, s > 0 ? HD - T - bw : -HD + T, s > 0 ? HD - T : -HD + T + bw, 'brickB', '墙根');
      pbox(mb, s > 0 ? HW - T - bw : -HW + T, s > 0 ? HW - T : -HW + T + bw, 0, 0.03, -HD + T, HD - T, 'brickB', '墙根');
    }

    /* 护城河：四条水面 + 外驳岸 + 四门桥 */
    if (r.moat) {
      const mw = r.moatW, hw2 = HW + mw, hd2 = HD + mw;
      pbox(mb, -hw2, hw2, -0.6, -0.02, hd2 - mw, hd2, 'water', '护城河');
      pbox(mb, -hw2, hw2, -0.6, -0.02, -hd2, -hd2 + mw, 'water', '护城河');
      pbox(mb, -hw2, -hw2 + mw, -0.6, -0.02, -hd2, hd2, 'water', '护城河');
      pbox(mb, hw2 - mw, hw2, -0.6, -0.02, -hd2, hd2, 'water', '护城河');
      for (const s of [-1, 1]) {
        pbox(mb, -hw2 - 0.9, hw2 + 0.9, -0.2, 0.5, s > 0 ? hd2 : -hd2 - 0.9, s > 0 ? hd2 + 0.9 : -hd2, 'stone', '驳岸');
        pbox(mb, s > 0 ? hw2 : -hw2 - 0.9, s > 0 ? hw2 + 0.9 : -hw2, -0.2, 0.5, -hd2, hd2, 'stone', '驳岸');
      }
      // 四座门桥：石桥或吊桥；有瓮城时从瓮城正门起步
      {
        const GW2 = (GW / 2) * 0.85;
        const half = GW2;
        const mat = r.drawbridge ? 'wood' : 'slab';
        const wOff = r.wengcheng ? (r.wengOffset == null ? 0.35 : r.wengOffset) * (r.wengW / 2) : 0;
        const s0 = T / 2 + (r.wengcheng ? (r.wengD || 10) + (T * 0.78 + 1.8) / 2 : -1.0);
        const s1 = T / 2 + r.moatW + 0.8;
        if (s1 - s0 > 0.6) {
          const make = (axis, sign) => {
            const a0 = sign > 0 ? s0 : -s1, a1 = sign > 0 ? s1 : -s0;
            const c0 = wOff;
            if (r.drawbridge && r.bridgeUp) {
              if (axis === 'x') pbox(mb, c0 - half, c0 + half, 0, s1 - s0, sign > 0 ? HD + s0 : -HD - s0 - 0.22, sign > 0 ? HD + s0 + 0.22 : -HD - s0, 'woodDark', '吊桥·收起');
              else pbox(mb, sign > 0 ? HW + s0 : -HW - s0 - 0.22, sign > 0 ? HW + s0 + 0.22 : -HW - s0, 0, s1 - s0, c0 - half, c0 + half, 'woodDark', '吊桥·收起');
            } else {
              if (axis === 'x') pbox(mb, c0 - half, c0 + half, 0, 0.24, HD + a0, HD + a1, mat, r.drawbridge ? '吊桥' : '桥面');
              else pbox(mb, HW + a0, HW + a1, 0, 0.24, c0 - half, c0 + half, mat, r.drawbridge ? '吊桥' : '桥面');
              if (r.drawbridge) {
                for (const s of [-1, 1]) {
                  if (axis === 'x') {
                    pbox(mb, c0 + s * half - 0.08, c0 + s * half + 0.08, 0.24, 1.3, HD + a0, HD + a0 + 0.2, 'wood', '吊桥栏杆');
                    pbox(mb, c0 + s * half - 0.08, c0 + s * half + 0.08, 0.24, 1.3, HD + a1 - 0.2, HD + a1, 'wood', '吊桥栏杆');
                  } else {
                    pbox(mb, HW + a0, HW + a0 + 0.2, 0.24, 1.3, c0 + s * half - 0.08, c0 + s * half + 0.08, 'wood', '吊桥栏杆');
                    pbox(mb, HW + a1 - 0.2, HW + a1, 0.24, 1.3, c0 + s * half - 0.08, c0 + s * half + 0.08, 'wood', '吊桥栏杆');
                  }
                }
              }
            }
          };
          make('x', 1); make('x', -1); make('z', 1); make('z', -1);
        }
      }
    }

    /* 城墙（四面，门处断开） */
    const seg = (a, b) => wallRun(mb, a, b, H, T, r);
    seg([-HW, HD], [-GW / 2, HD]); seg([GW / 2, HD], [HW, HD]);
    seg([-HW, -HD], [-GW / 2, -HD]); seg([GW / 2, -HD], [HW, -HD]);
    seg([HW, -HD], [HW, -GW / 2]); seg([HW, GW / 2], [HW, HD]);
    seg([-HW, -HD], [-HW, -GW / 2]); seg([-HW, GW / 2], [-HW, HD]);

    /* 四门城楼 + 四角角楼 */
    gateHouse(mb, 0, HD, r, 'x');
    gateHouse(mb, 0, -HD, r, 'x');
    gateHouse(mb, HW, 0, r, 'z');
    gateHouse(mb, -HW, 0, r, 'z');
    if (r.wengcheng) {
      barbican(mb, r, 0, HD, 'x', 1);
      barbican(mb, r, 0, -HD, 'x', -1);
      barbican(mb, r, HW, 0, 'z', 1);
      barbican(mb, r, -HW, 0, 'z', -1);
    }
    if (r.tower) {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const sub = building({
          type: 'pavilion', bays: 1, bayW: 4.2, depth: 4.2, floorH: 3.0, baseH: 0.5,
          wallMat: 'timber', colMat: 'timber', tileColor: r.roofColor, eave: 0.9, slope: 0.5,
          upturn: 0.5, roofType: 'pyramid', dougong: true, dgScale: 0.7
        });
        sub.translate(sx * (HW - T), H + 0.6, sz * (HD - T));
        mb.merge(sub);
      }
    }

    /* 街道：主街条石 + 御道石带 + 次街 + 坊内小巷 */
    const road = (x0, x1, z0, z1, mat, tag) => pbox(mb, x0, x1, 0, 0.06, z0, z1, mat || 'slab', tag || '街道');
    const rw = r.roadW;
    road(-HW + T, HW - T, -rw / 2, rw / 2);
    road(-rw / 2, rw / 2, -HD + T, HD - T);
    // 御道：主街中间一条颜色更深的石带，宽约占主街四成
    const yd = rw * 0.22;
    road(-HW + T, HW - T, -yd, yd, 'stoneB', '御道');
    road(-yd, yd, -HD + T, HD - T, 'stoneB', '御道');
    const cellW = (r.w - 2 * T) / r.cols, cellD = (r.d - 2 * T) / r.rows;
    for (let c = 1; c < r.cols; c++) {
      const x = -HW + T + cellW * c;
      road(x - 2.2, x + 2.2, -HD + T, HD - T);
    }
    for (let rr = 1; rr < r.rows; rr++) {
      const z = -HD + T + cellD * rr;
      road(-HW + T, HW - T, z - 2.2, z + 2.2);
    }

    /* 地块：坊墙 + 随机建筑 */
    const nf = (v) => Math.round(v * 10) / 10;
    const kinds = [
      () => ({ type: 'house', bays: rng.int(2, 4), bayW: 2.6 + rng.next() * 0.8, depth: 5.0 + rng.next() * 1.6,
        floors: rng.int(1, 2), floorH: 2.8 + rng.next() * 0.4, baseH: 0.3, steps: 1, roofType: 'gable',
        tileColor: r.roofColor }),
      () => ({ type: 'hall', bays: rng.int(3, 5), bayW: 3.0 + rng.next() * 0.6, depth: 7.0 + rng.next() * 2,
        floors: 1, floorH: 3.4, baseH: 0.5, steps: 2, roofType: 'gableHip', tileColor: r.roofColor,
        wallMat: 'plaster', colMat: 'timber', dougong: true, dgScale: 0.8 }),
      () => ({ type: 'ge', bays: 2, bayW: 3.0, depth: 6.0, floors: 2, floorH: 3.2, baseH: 0.5, steps: 1,
        roofType: 'gableHip', tileColor: r.roofColor, wallMat: 'timber', colMat: 'timber', pingzuo: true }),
      () => ({ type: 'pavilion', bays: 1, bayW: 3.6, depth: 3.6, floorH: 2.8, baseH: 0.3, steps: 1,
        roofType: 'pyramid', tileColor: r.roofColor, wallMat: 'timber', colMat: 'wood' }),
      () => ({ type: 'pagoda', floors: 5, bayW: 2.4, depth: 2.4, floorH: 2.2, baseH: 0.6, steps: 2,
        tierR: 2.0, tileColor: r.roofColor })
    ];

    const wardGates = [];

    for (let c = 0; c < r.cols; c++) {
      for (let rr2 = 0; rr2 < r.rows; rr2++) {
        if (r.palace && c === Math.floor(r.cols / 2) && rr2 <= Math.floor(r.rows / 2)) continue;
        const x0 = -HW + T + cellW * c, z0 = -HD + T + cellD * rr2;
        const laneW = r.alleyW == null ? 1.4 : r.alleyW;
        const jit = r.blockJit == null ? 1 : r.blockJit;
        const wallOn = r.blockWallOn !== false;

        // 坊墙不再贴着地块外框等距内缩：四边各留 0.35–1.5m 的随机退让，
        // 大小与位置都跟着变，坊与坊之间才会出现宽窄不一的夹道。
        let wx0, wx1, wz0, wz1;
        if (wallOn) {
          wx0 = x0 + rw / 2 + rng.range(0.35 * jit, 1.5 * jit);
          wx1 = x0 + cellW - rw / 2 - rng.range(0.35 * jit, 1.5 * jit);
          wz0 = z0 + rw / 2 + rng.range(0.35 * jit, 1.5 * jit);
          wz1 = z0 + cellD - rw / 2 - rng.range(0.35 * jit, 1.5 * jit);
        } else {
          wx0 = x0 + rw / 2 + 1.0; wx1 = x0 + cellW - rw / 2 - 1.0;
          wz0 = z0 + rw / 2 + 1.0; wz1 = z0 + cellD - rw / 2 - 1.0;
        }
        const areaW = (wx1 - wx0) - 2.2, areaD = (wz1 - wz0) - 2.2;
        if (areaW < 6 || areaD < 6) continue;

        // 坊内小巷贴着坊墙内皮走，不再按原 cell 边界算
        if (laneW > 0.4) {
          pbox(mb, wx0 + 0.75, wx1 - 0.75, 0, 0.045, wz0 + 0.75, wz0 + 0.75 + laneW, 'soil', '坊内小巷');
          pbox(mb, wx0 + 0.75, wx0 + 0.75 + laneW, 0, 0.045, wz0 + 0.75, wz1 - 0.75, 'soil', '坊内小巷');
        }

        // 坊墙：四面按随机退让砌；坊门按“临街面”选方向，位置沿墙偏 30%–70%，
        // 不再永远南面居中；另有约两成坊开两门。
        if (wallOn) {
          const fwx = 0.45, FH = r.blockWallH == null ? 2.2 : r.blockWallH;
          const gateW = Math.min(r.blockGateW || 3.6, Math.min(wx1 - wx0, wz1 - wz0) * 0.34);
          const avail = ['south'];
          if (rr2 > 0) avail.push('north');
          if (c < r.cols - 1) avail.push('east');
          if (c > 0) avail.push('west');
          const pickSide = () => {
            const w = avail.map((s) => (s === 'south' ? 1.6 : s === 'north' ? 0.8 : 1.2));
            let x = rng.next() * w.reduce((a, b) => a + b, 0);
            for (let i = 0; i < avail.length; i++) { x -= w[i]; if (x <= 0) return avail[i]; }
            return avail[0];
          };
          // 主门优先朝最近的纵向街：中轴以西的坊开东门，以东开西门；
          // 中轴这一列开南/北门；再留三成随机换向，避免又变成一条规律。
          let mainSide;
          if (r.cols >= 3 && c !== Math.floor(r.cols / 2)) mainSide = c < Math.floor(r.cols / 2) ? 'east' : 'west';
          else mainSide = rng.next() < 0.6 ? 'south' : 'north';
          if (avail.indexOf(mainSide) < 0) mainSide = avail[0];
          if (rng.next() < 0.3) mainSide = pickSide();
          const gateDefs = [[mainSide, rng.range(0.5 - 0.2 * jit, 0.5 + 0.2 * jit)]];
          // 开门数量也分档：约两成坊四面开门，四成多开第二门，其余只留一门
          const want = rng.next() < 0.18 ? 4 : (rng.next() < 0.45 ? 2 : 1);
          while (gateDefs.length < Math.min(want, avail.length)) {
            const s2 = pickSide();
            if (!gateDefs.some(([s]) => s === s2)) gateDefs.push([s2, rng.range(0.5 - 0.2 * jit, 0.5 + 0.2 * jit)]);
            if (gateDefs.length >= 4) break;
          }
          const sideGeom = {
            south: [wx0, wz1, wx1, wz1, 'x', 0, 1],
            north: [wx0, wz0, wx1, wz0, 'x', 0, -1],
            east: [wx1, wz0, wx1, wz1, 'z', 1, 0],
            west: [wx0, wz0, wx0, wz1, 'z', -1, 0]
          };
          const gmap = {};
          for (const [s, t] of gateDefs) gmap[s] = t;
          const wallSeg = (ax, az, bx, bz) => {
            const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz);
            if (L < 1.0) return;
            const ux = dx / L, uz = dz / L;
            const qx = -uz * fwx / 2, qz = ux * fwx / 2;
            const pts = [[ax + qx, az + qz], [bx + qx, bz + qz], [bx - qx, bz - qz], [ax - qx, az - qz]];
            mb.prism(pts, 0, FH, 'brickB', '坊墙');
            mb.prism(pts, FH, FH + 0.22, 'stoneDark', '坊墙压顶');
          };
          const drawSide = (s) => {
            const [ax, az, bx, bz, axis, ox, oz] = sideGeom[s];
            const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz);
            const ux = dx / L, uz = dz / L;
            const t = gmap[s];
            if (t == null) { wallSeg(ax, az, bx, bz); return; }
            const c0 = t * L - gateW / 2, c1 = t * L + gateW / 2;
            if (c0 < 0.9 || c1 > L - 0.9) { wallSeg(ax, az, bx, bz); return; }
            wallSeg(ax, az, ax + ux * c0, az + uz * c0);
            wallSeg(ax + ux * c1, az + uz * c1, bx, bz);
            const gx = ax + ux * (t * L), gz = az + uz * (t * L);
            wardGates.push({ x: gx, z: gz, axis, ox, oz, w: gateW });
            // 坊门门头：两根门柱 + 横枋 + 一道压顶瓦脊，让“朝哪边开门”一眼看得出来
            const postH = FH + 0.55;
            if (axis === 'x') {
              for (const s of [-1, 1]) mb.box(gx + s * gateW / 2 - 0.09, gx + s * gateW / 2 + 0.09, 0.05, postH, gz - 0.18, gz + 0.18, 'wood', '坊门·门柱');
              mb.box(gx - gateW / 2, gx + gateW / 2, postH - 0.08, postH, gz - 0.2, gz + 0.2, 'woodDark', '坊门·横枋');
              mb.box(gx - gateW / 2 + 0.15, gx + gateW / 2 - 0.15, postH - 0.55, postH - 0.3, gz - 0.23, gz + 0.23, 'gold', '坊门·门额');
              mb.box(gx - gateW / 2 - 0.3, gx + gateW / 2 + 0.3, postH + 0.35, postH + 0.5, gz - 0.7, gz + 0.7, 'stoneDark', '坊门·门头');
            } else {
              for (const s of [-1, 1]) mb.box(gx - 0.18, gx + 0.18, 0.05, postH, gz + s * gateW / 2 - 0.09, gz + s * gateW / 2 + 0.09, 'wood', '坊门·门柱');
              mb.box(gx - 0.2, gx + 0.2, postH - 0.08, postH, gz - gateW / 2, gz + gateW / 2, 'woodDark', '坊门·横枋');
              mb.box(gx - 0.23, gx + 0.23, postH - 0.55, postH - 0.3, gz - gateW / 2 + 0.15, gz + gateW / 2 - 0.15, 'gold', '坊门·门额');
              mb.box(gx - 0.7, gx + 0.7, postH + 0.35, postH + 0.5, gz - gateW / 2 - 0.3, gz + gateW / 2 + 0.3, 'stoneDark', '坊门·门头');
            }
          };
          drawSide('south'); drawSide('north'); drawSide('east'); drawSide('west');
        }

        if (rng.next() > r.density) continue;
        const cx = (wx0 + wx1) / 2, cz = (wz0 + wz1) / 2;
        if (areaW >= 13 && areaD >= 12 && rng.next() < 0.55) {
          const sub = building({
            type: 'courtyard', courtW: nf(Math.min(19, areaW)), courtD: nf(Math.min(16, areaD)),
            courtStyle: 'house', bays: 3, bayW: 2.6, depth: 5.0, floors: 1, floorH: 2.8,
            baseH: 0.3, steps: 1, roofType: 'gable', tileColor: r.roofColor
          });
          sub.rotateY(rng.int(0, 3) * 90, 0, 0);
          sub.translate(nf(cx), 0, nf(cz));
          mb.merge(sub);
        } else {
          const cnt = rng.int(1, areaW > 18 ? 3 : 2);
          for (let k = 0; k < cnt; k++) {
            const kind = kinds[rng.int(0, kinds.length - 1)]();
            const sub = building(kind);
            sub.rotateY(rng.int(0, 3) * 90, 0, 0);
            sub.translate(nf(cx + rng.range(-areaW * 0.24, areaW * 0.24)), 0,
              nf(cz + rng.range(-areaD * 0.24, areaD * 0.24)));
            mb.merge(sub);
          }
        }
      }
    }

    /* 中轴宫殿（axisHalls 决定纵深上排几座殿） */
    if (r.palace) {
      const halls = Math.max(1, Math.min(3, Math.round(r.axisHalls || 1)));
      const zTop = -HD * 0.34, zBot = HD * 0.06;
      for (let i = 0; i < halls; i++) {
        const t = halls === 1 ? 0.55 : i / (halls - 1);
        const z = zTop + (zBot - zTop) * t;
        const bays = i === 0 ? 5 : (i === halls - 1 ? 5 : 3);
        const depth = i === 0 ? 10 : 8;
        const h = building({
          type: 'hall', bays, bayW: 3.6, depth, floors: 1,
          floorH: i === 0 ? 4.6 : 4.0, baseH: i === 0 ? 1.2 : 0.9, steps: 3,
          roofType: 'gableHip', tileColor: 'yellow', wallMat: 'zhu', colMat: 'timber',
          dougong: true, dgScale: 1.0, dgStyle: 'full', plaque: true, beasts: 5
        });
        h.translate(0, 0, z);
        mb.merge(h);
      }
      const gate = building({
        type: 'gate', bays: 3, bayW: 3.2, depth: 4.4, floorH: 3.6, baseH: 0.8, steps: 2,
        roofType: 'gableHip', tileColor: 'yellow', wallMat: 'zhu', colMat: 'timber',
        dougong: true, dgScale: 0.9
      });
      gate.translate(0, 0, HD * 0.14);
      mb.merge(gate);
      pbox(mb, -14, 14, 0, 0.08, -HD * 0.42, HD * 0.22, 'slab', '宫殿广场');
    }

    /* 城树 */
    for (let i = 0; i < 22; i++) {
      const px = rng.range(-HW + 6, HW - 6), pz = rng.range(-HD + 6, HD - 6);
      const kind = ['willow', 'pine', 'plum', 'gingko', 'bamboo'][rng.int(0, 4)];
      GF.parts.tree(mb, px, pz, kind, rng, 0.9 + rng.next() * 0.4, '城树');
    }

    /* 生活层：沿主街的摊、幌子、街灯；夜里灯多、招牌多 */
    let lifeCount = 0;
    if (r.life) {
      const dens = r.lifeDensity;
      const step = 7 + (1 - dens) * 7;
      const edge = rw / 2 - 1.0;
      const signs = ['cloth', 'paintBlue', 'paintGreen', 'gold'];
      const put = (x, z, axis) => {
        const roll = rng.next();
        if (roll > 0.12 + 0.8 * dens) return;
        const pick = rng.next();
        if (pick < (r.night ? 0.34 : 0.44)) {
          streetStall(mb, x, z, axis, 0.9 + rng.next() * 0.25);
        } else if (pick < (r.night ? 0.48 : 0.72)) {
          shopSign(mb, x, z, axis, signs[rng.int(0, signs.length - 1)], 0.8 + rng.next() * 0.5, 1.6 + rng.next() * 0.7);
        } else {
          streetLamp(mb, x, z, r.night ? 0.9 : 0.65);
        }
        lifeCount++;
      };
      for (const side of [-1, 1]) {
        for (let x = -HW + T + 7; x < HW - T - 7; x += step) {
          if (Math.abs(x) < (r.gateW || 11) * 1.5 || Math.abs(x) < 9) continue;
          if (side < 0 && Math.abs(x) < 17) continue; // 北侧中轴留给宫城
          put(x + rng.range(-1.5, 1.5), side * edge, 'x');
        }
        for (let z = -HD + T + 7; z < HD - T - 7; z += step) {
          if (Math.abs(z) < (r.gateW || 11) * 1.5 || Math.abs(z) < 9) continue;
          if (z > -HD * 0.45 && z < HD * 0.16) continue; // 中轴宫殿段
          put(side * edge, z + rng.range(-1.5, 1.5), 'z');
        }
      }
      // 坊门口的小市：按每坊实际开门方向摆，门在南/北就沿街横排，门在东/西就沿街纵排
      for (const g of wardGates) {
        const bx = g.x + g.ox * 2.0, bz = g.z + g.oz * 2.0;
        if (Math.abs(bx) > HW - T - 2 || Math.abs(bz) > HD - T - 2) continue;
        if (Math.abs(bx) < 6 && Math.abs(bz) < 6) continue;
        const alongX = g.axis === 'x';
        if (rng.next() < 0.4 + 0.5 * dens) {
          streetLamp(mb, bx - (alongX ? 2.4 : 0), bz - (alongX ? 0 : 2.4), r.night ? 0.8 : 0.65);
          streetLamp(mb, bx + (alongX ? 2.4 : 0), bz + (alongX ? 0 : 2.4), r.night ? 0.8 : 0.65);
          lifeCount += 2;
        }
        if (rng.next() < 0.35 + 0.55 * dens) {
          streetStall(mb, bx - (alongX ? 5.4 : 0), bz - (alongX ? 0 : 5.4), g.axis, 0.85 + rng.next() * 0.2);
          if (rng.next() < 0.7) streetStall(mb, bx + (alongX ? 5.4 : 0), bz + (alongX ? 0 : 5.4), g.axis, 0.85 + rng.next() * 0.2);
          lifeCount += 2;
          shopSign(mb, bx + (alongX ? 7.6 : 0), bz + (alongX ? 0 : 7.6), g.axis, signs[rng.int(0, signs.length - 1)], 0.8, 1.8);
          lifeCount++;
        }
      }
    }

    const gateStats = { south: 0, north: 0, east: 0, west: 0 };
    for (const g of wardGates) {
      if (g.axis === 'x') gateStats[g.oz > 0 ? 'south' : 'north']++;
      else gateStats[g.ox > 0 ? 'east' : 'west']++;
    }
    mb.cityInfo = { w: r.w, d: r.d, wallH: r.wallH, cells: r.cols * r.rows, seed: r.seed,
      wengcheng: r.wengcheng ? 4 : 0, tapered: r.wallTaper, life: lifeCount,
      gates: gateStats };
    return mb;
  };

  /* ---------------------------- 城池配方（chips 用） ---------------------------- */
  const PRESETS = [
    {
      key: 'standard', name: '标准城',
      recipe: { seed: 20261123, w: 100, d: 88, wallH: 9, wallT: 4.6, gateW: 11, roadW: 9.5,
        moatW: 9, cols: 3, rows: 3, density: 0.9, moat: true, matta: true, tower: true,
        palace: true, axisHalls: 1, roofColor: 'grey' }
    },
    {
      key: 'capital', name: '都城·大城',
      recipe: { seed: 77102, w: 150, d: 128, wallH: 11, wallT: 5.4, gateW: 13, roadW: 11,
        moatW: 12, cols: 5, rows: 4, density: 0.95, matta: true, tower: true,
        palace: true, axisHalls: 3, bastionGap: 30, roofColor: 'grey' }
    },
    {
      key: 'water', name: '水城·护城河',
      recipe: { seed: 330517, w: 96, d: 84, wallH: 8, wallT: 4.2, gateW: 11, roadW: 8.5,
        moatW: 16, cols: 3, rows: 3, density: 0.85, matta: false, tower: true,
        palace: false, bastionGap: 34, roofColor: 'celadon' }
    },
    {
      key: 'pass', name: '关城·小城',
      recipe: { seed: 90211, w: 66, d: 58, wallH: 10, wallT: 5.0, gateW: 9, roadW: 7,
        moatW: 6, cols: 2, rows: 2, density: 0.8, matta: true, tower: true,
        palace: false, axisHalls: 1, bastionGap: 16, roofColor: 'grey', lifeDensity: 0.35 }
    },
    {
      key: 'palace', name: '宫城·三殿',
      recipe: { seed: 551188, w: 118, d: 104, wallH: 10, wallT: 5.2, gateW: 12, roadW: 10,
        moatW: 10, cols: 3, rows: 3, density: 0.7, matta: true, tower: true,
        palace: true, axisHalls: 3, roofColor: 'yellow', life: false }
    },
    {
      key: 'market', name: '坊市·密巷',
      recipe: { seed: 660122, w: 92, d: 80, wallH: 7.5, wallT: 4.0, gateW: 10, roadW: 7,
        moatW: 7, cols: 4, rows: 4, density: 1.0, matta: false, tower: false,
        palace: false, blockWallH: 1.8, bastionGap: 40, roofColor: 'grey' }
    },
    /* ---- 名城四座：从古建工坊迁来（原 type:'city' 的 401–404），
       按城池参数重写，落到本页能直接出图 ---- */
    {
      key: 'tangchangan', name: '唐长安',
      recipe: { seed: 401, w: 172, d: 152, wallH: 9, wallT: 5.0, gateW: 14, roadW: 10.5,
        moatW: 9, cols: 6, rows: 6, density: 0.9, matta: true, tower: true, palace: true,
        axisHalls: 1, bastionGap: 34, blockWallH: 2.0, blockGateW: 4.0, roofColor: 'grey' }
    },
    {
      key: 'luoyang', name: '洛阳',
      recipe: { seed: 402, w: 122, d: 118, wallH: 9, wallT: 4.6, gateW: 11, roadW: 10,
        moatW: 8, cols: 5, rows: 5, density: 0.85, matta: true, tower: true, palace: true,
        axisHalls: 2, bastionGap: 30, blockWallH: 2.0, blockGateW: 3.8, roofColor: 'grey' }
    },
    {
      key: 'beijing', name: '明清北京',
      recipe: { seed: 403, w: 146, d: 146, wallH: 11, wallT: 5.6, gateW: 14, roadW: 11,
        moatW: 12, cols: 6, rows: 6, density: 0.95, matta: true, tower: true, palace: true,
        axisHalls: 3, bastionGap: 30, blockWallH: 2.2, blockGateW: 4.0, roofColor: 'yellow',
        wengcheng: true, wengD: 14, wengW: 26, wengOffset: 0.35, arrowTower: true,
        drawbridge: true, bridgeUp: false }
    },
    {
      key: 'gugong', name: '紫禁城',
      recipe: { seed: 404, w: 76, d: 96, wallH: 6.5, wallT: 3.4, gateW: 10, roadW: 12,
        moatW: 11, cols: 2, rows: 3, density: 0.3, matta: true, tower: true, palace: true,
        axisHalls: 3, bastionGap: 60, blockWallOn: false, roofColor: 'yellow', life: false }
    }
  ];

  // 补齐每个配方的默认值，便于 chips 一键切换
  PRESETS.forEach((p) => { p.recipe = GF.cityNormalize(p.recipe); });
  GF.cityList = PRESETS.map((p) => ({ key: p.key, name: p.name }));
  GF.getCityPreset = function (key) {
    const p = PRESETS.find((x) => x.key === key);
    return JSON.parse(JSON.stringify(p ? p.recipe : DEF_CITY));
  };
  GF.cityDefault = GF.cityDefault || function () { return JSON.parse(JSON.stringify(DEF_CITY)); };
})(typeof window !== 'undefined' ? window : globalThis);

