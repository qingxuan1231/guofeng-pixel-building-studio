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
    bastionGap: 26, blockWallH: 2.2, blockGateW: 3.6, blockWallOn: false, blockJit: 1, axisHalls: 1,
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
    // 古建配方入城：数组里每项 { recipe, name?, rot?, ... }，由城池统一找地块落位
    r.extras = Array.isArray(r.extras) ? r.extras.filter((x) => x && (x.recipe || x.type)) : [];
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

  /* --------------------------------------------------------------------------
   * 古建配方入城
   * 城市里的“建筑群”优先取自古建工坊的 preset：主栋 + 可选厢房/牌坊，
   * 整组先量包围盒，只有真正塞得进地块才落位；外来 JSON 配方也走同一套。
   * ------------------------------------------------------------------------ */
  const HOUSE_KEYS = ['jiangnan', 'huizhou', 'hanMin', 'tangMin', 'songMin'];
  const SMALL_KEYS = ['ting', 'bajiaoting', 'yuandian', 'shuixie', 'paifang'];

  function presetSize(key) {
    if (!GF.getPreset) return { w: 10, d: 8 };
    const q = GF.getPreset(key);
    if (q.type === 'courtyard') return { w: (q.courtW || 20) + 1.6, d: (q.courtD || 18) + 1.6 };
    if (q.type === 'pagoda') {
      const w = Math.max(8.5, (q.tierR || 2) * 2 + 2.2);
      return { w, d: w };
    }
    if (q.type === 'archway') return { w: (q.bays || 3) * (q.bayW || 3) + 2.4, d: 3.4 };
    const w = (q.bays || 3) * (q.bayW || 3) + 2 * (q.eave || 1) + 2.4;
    const d = (q.depth || 6) + 2 * (q.eave || 1) + 2.2;
    return { w, d };
  }

  function cleanCityEnv(rec, city) {
    rec.env = Object.assign({}, rec.env || {}, {
      showGround: false, ground: 'none', groundSize: 0, trees: [], rocks: 0,
      pond: null, banners: 0, path: false, props: [], items: [], auto: [], move: null
    });
    rec.render = Object.assign({}, rec.render || {}, { transparent: true, ppm: city.render.ppm });
    return rec;
  }

  function buildPresetMesh(key, seed, city) {
    if (!GF.getPreset || !GF.build) return null;
    const rec = GF.getPreset(key);
    rec.seed = seed || rec.seed;
    cleanCityEnv(rec, city);
    try { return GF.build(rec, { ppm: city.render.ppm }); } catch (e) { return null; }
  }

  function buildRecipeMesh(src, seed, city) {
    if (!src || !GF.build) return null;
    let rec;
    try { rec = GF.normalize(JSON.parse(JSON.stringify(src))); } catch (e) { return null; }
    if (!rec || rec.type === 'city') return null;
    rec.seed = seed || rec.seed || city.seed;
    cleanCityEnv(rec, city);
    try { return GF.build(rec, { ppm: city.render.ppm }); } catch (e) { return null; }
  }

  function meshBox(m) {
    const b = m.bounds();
    return { x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, w: b.x1 - b.x0, d: b.z1 - b.z0 };
  }

  function centerMesh(m) {
    const b = meshBox(m);
    m.translate(-(b.x0 + b.x1) / 2, 0, -(b.z0 + b.z1) / 2);
    return m;
  }

  function fitsArea(m, areaW, areaD, margin) {
    const b = meshBox(m);
    return b.w <= areaW - (margin || 0) && b.d <= areaD - (margin || 0);
  }

  function appendIfFits(base, piece, areaW, areaD, margin) {
    const a = meshBox(base), b = meshBox(piece);
    const x0 = Math.min(a.x0, b.x0), x1 = Math.max(a.x1, b.x1);
    const z0 = Math.min(a.z0, b.z0), z1 = Math.max(a.z1, b.z1);
    if (x1 - x0 > areaW - (margin || 0) || z1 - z0 > areaD - (margin || 0)) return false;
    base.merge(piece);
    centerMesh(base);
    return true;
  }

  function chooseClusterKey(areaW, areaD, rng) {
    const pool = [];
    const add = (keys, weight) => {
      for (const k of keys) {
        const s = presetSize(k);
        if (s.w <= areaW - 1.2 && s.d <= areaD - 1.2) {
          for (let i = 0; i < weight; i++) pool.push(k);
        }
      }
    };
    if (areaW >= 20 && areaD >= 20) {
      add(['siyuan'], 10); add(['daoguan'], 4); add(['langyuan'], 5); add(['yuanlin'], 4);
    }
    if (areaW >= 15 && areaD >= 13) { add(['siheyuan'], 12); add(['xiaoxiang'], 7); }
    if (areaW >= 13 && areaD >= 8) {
      add(['qing', 'tang', 'wujian'], 8); add(['xieshan', 'juanpeng', 'luding'], 7);
    }
    if (areaW >= 8.5 && areaD >= 6) {
      add(['fanlou', 'chongge', 'shizijia', 'fanhuaju', 'shilou', 'lou', 'tengwang', 'feiyun'], 7);
    }
    if (areaW >= 7.2 && areaD >= 4.6) { add(HOUSE_KEYS, 9); }
    if (areaW >= 9 && areaD >= 6.2) { add(['ta', 'muta', 'leifeng', 'yingxian'], 5); }
    if (areaW >= 8 && areaD >= 5.6) { add(SMALL_KEYS, 5); }
    if (!pool.length) { add(HOUSE_KEYS.concat(SMALL_KEYS), 1); }
    if (!pool.length) return null;
    return pool[rng.int(0, pool.length - 1)];
  }

  // 主栋取古建 preset，再按剩余地块加一栋厢房/牌坊，形成“建筑群”而不是单体
  function buildPresetCluster(key, city, seed, rng, areaW, areaD) {
    let main = buildPresetMesh(key, seed, city);
    if (!main || !main.triCount) return null;
    const rots = [0, 90, 180, 270];
    main.rotateY(rots[rng.int(0, 3)]);
    centerMesh(main);
    if (!fitsArea(main, areaW, areaD, 1.2)) {
      main = buildPresetMesh(key, seed, city);
      if (!main) return null;
      centerMesh(main);
      if (!fitsArea(main, areaW, areaD, 1.2)) return null;
    }

    const mbBox = meshBox(main);
    const isHouse = HOUSE_KEYS.indexOf(key) >= 0;
    const sideKey = HOUSE_KEYS[rng.int(0, HOUSE_KEYS.length - 1)];

    // 宅院/殿宇旁边补一栋厢房或民居，形成有主次的院落群
    if (areaW >= mbBox.w + 7.8 && areaD >= Math.max(5.8, mbBox.d * 0.62)) {
      const side = buildPresetMesh(sideKey, seed + 17, city);
      if (side) {
        side.rotateY(rng.next() < 0.5 ? 0 : 180);
        const sb = meshBox(side);
        const dir = rng.next() < 0.5 ? -1 : 1;
        side.translate(dir * (mbBox.w / 2 + 1.1 + sb.w / 2), 0, rng.range(-1.4, 1.4));
        appendIfFits(main, side, areaW, areaD, 0.8);
      }
    }

    // 主栋前留出牌坊/小亭，作为建筑群的门面
    const now = meshBox(main);
    if (areaD >= now.d + 6.2 && areaW >= 8.5) {
      const frontKey = isHouse ? (rng.next() < 0.55 ? 'paifang' : 'ting') : 'paifang';
      const front = buildPresetMesh(frontKey, seed + 31, city);
      if (front) {
        const fb = meshBox(front);
        const dir = rng.next() < 0.5 ? -1 : 1;
        front.translate(rng.range(-2.0, 2.0), 0, dir * (now.d / 2 + 1.0 + fb.d / 2));
        appendIfFits(main, front, areaW, areaD, 0.8);
      }
    }
    return main;
  }

  function placeExtraMesh(mb, ex, cx, cz, areaW, areaD, city, rng) {
    const src = ex.recipe || ex;
    const m = buildRecipeMesh(src, city.seed + (ex.seedOffset || 0), city);
    if (!m || !m.triCount) return false;
    const rot = Number(ex.rot);
    m.rotateY(isFinite(rot) ? rot : [0, 90, 180, 270][rng.int(0, 3)]);
    const b = meshBox(m);
    const s = Math.min(1, (areaW - 1.2) / Math.max(0.1, b.w), (areaD - 1.2) / Math.max(0.1, b.d));
    if (!(s >= 0.3)) return false;
    if (s < 0.995) m.scale(s);
    m.translate(cx, 0, cz);
    mb.merge(m);
    return true;
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

    /* 街网：主街 + 随机宽度里坊（不再是一张等宽方格） */
    const road = (x0, x1, z0, z1, mat, tag) => pbox(mb, x0, x1, 0, 0.06, z0, z1, mat || 'slab', tag || '街道');
    const rw = r.roadW;
    road(-HW + T, HW - T, -rw / 2, rw / 2);
    road(-rw / 2, rw / 2, -HD + T, HD - T);
    // 御道：主街中间一条颜色更深的石带，宽约占主街四成
    const yd = rw * 0.22;
    road(-HW + T, HW - T, -yd, yd, 'stoneB', '御道');
    road(-yd, yd, -HD + T, HD - T, 'stoneB', '御道');

    const usableX0 = -HW + T, usableX1 = HW - T;
    const usableZ0 = -HD + T, usableZ1 = HD - T;
    const nCols = Math.max(2, Math.min(8, Math.round(r.cols || 3)));
    const nRows = Math.max(2, Math.min(8, Math.round(r.rows || 3)));
    // 中轴两侧各分一半列 / 行；列宽再随机，避免所有坊一个尺寸
    const halfCols = Math.max(1, Math.ceil(nCols / 2));
    const halfRows = Math.max(1, Math.ceil(nRows / 2));
    // 把一段长度切成 n 块：每块宽度随机，街缝宽度也随机，偶尔两块并成一坊
    function splitSpan(a, b, n, gapMin, gapMax, minLot) {
      n = Math.max(1, Math.round(n));
      if (n <= 1 || b - a < minLot) return { cells: [[a, b]], gaps: [] };
      const gaps = [];
      let gapSum = 0;
      for (let i = 0; i < n - 1; i++) {
        let g = rng.range(gapMin, gapMax);
        if (rng.next() < 0.24) g = 0;
        gaps.push(g); gapSum += g;
      }
      let avail = (b - a) - gapSum;
      if (avail < minLot * n) {
        const maxGap = Math.max(0, ((b - a) - minLot * n) / Math.max(1, n - 1));
        gapSum = 0;
        for (let i = 0; i < gaps.length; i++) { gaps[i] = Math.min(gaps[i], maxGap); gapSum += gaps[i]; }
        avail = (b - a) - gapSum;
      }
      if (avail <= 1) return { cells: [[a, b]], gaps: [] };
      const weights = [];
      let wsum = 0;
      for (let i = 0; i < n; i++) { const w = 0.72 + rng.next() * 0.62; weights.push(w); wsum += w; }
      const cells = [], outGaps = [];
      let cursor = a;
      for (let i = 0; i < n; i++) {
        const w = Math.max(2.8, avail * weights[i] / wsum);
        const end = Math.min(b, cursor + w);
        if (cells.length && gaps[i - 1] < 0.8) cells[cells.length - 1][1] = Math.min(b, end + gaps[i - 1]);
        else cells.push([cursor, end]);
        if (i < n - 1) {
          const g = gaps[i];
          if (g >= 0.8) outGaps.push({ p: end + g / 2, w: g });
          cursor = end + g;
        }
      }
      if (cells.length) cells[cells.length - 1][1] = b;
      return { cells, gaps: outGaps };
    }

    const gapMin = Math.max(2.0, rw * 0.30), gapMax = Math.max(gapMin, rw * 0.62);
    const leftX = splitSpan(usableX0, -rw / 2, halfCols, gapMin, gapMax, 7.0);
    const rightX = splitSpan(rw / 2, usableX1, halfCols, gapMin, gapMax, 7.0);
    const northZ = splitSpan(usableZ0, -rw / 2, halfRows, gapMin, gapMax, 7.0);
    const southZ = splitSpan(rw / 2, usableZ1, halfRows, gapMin, gapMax, 7.0);

    // 里坊街：宽度随地块变化，不再是等距线；偶尔并坊处不铺街，留出大宅基
    for (const g of leftX.gaps.concat(rightX.gaps)) {
      road(g.p - g.w / 2, g.p + g.w / 2, usableZ0, usableZ1, 'stoneB', '里坊街');
    }
    for (const g of northZ.gaps.concat(southZ.gaps)) {
      road(usableX0, usableX1, g.p - g.w / 2, g.p + g.w / 2, 'stoneB', '里坊街');
    }

    /* 地块：不设固定坊墙；建筑群优先从古建 preset 里取，塞不下才回落普通民居 */
    const nf = (v) => Math.round(v * 10) / 10;
    const kinds = [
      () => ({ type: 'house', bays: rng.int(2, 3), bayW: 2.3 + rng.next() * 0.6, depth: 4.4 + rng.next() * 1.2,
        floors: rng.int(1, 2), floorH: 2.7 + rng.next() * 0.3, baseH: 0.3, steps: 1, roofType: 'gable',
        tileColor: r.roofColor }),
      () => ({ type: 'hall', bays: 3, bayW: 2.8 + rng.next() * 0.4, depth: 6.0 + rng.next() * 1.2,
        floors: 1, floorH: 3.2, baseH: 0.5, steps: 2, roofType: 'gableHip', tileColor: r.roofColor,
        wallMat: 'plaster', colMat: 'timber', dougong: true, dgScale: 0.8 }),
      () => ({ type: 'ge', bays: 2, bayW: 2.8, depth: 5.4, floors: 2, floorH: 3.0, baseH: 0.5, steps: 1,
        roofType: 'gableHip', tileColor: r.roofColor, wallMat: 'timber', colMat: 'timber', pingzuo: true }),
      () => ({ type: 'pavilion', bays: 1, bayW: 3.2, depth: 3.2, floorH: 2.6, baseH: 0.3, steps: 1,
        roofType: 'pyramid', tileColor: r.roofColor, wallMat: 'timber', colMat: 'wood' })
    ];

    // 坊门只作为生活层的落点；没有固定坊墙后默认不生成，保留数组兼容旧逻辑
    const wardGates = [];
    const extras = (r.extras || []).slice();
    let extrasPlaced = 0, extrasSkipped = 0;
    let wardCount = 0;
    const emptyCells = [];

    const quads = [
      { xs: leftX.cells, zs: northZ.cells },
      { xs: rightX.cells, zs: northZ.cells },
      { xs: leftX.cells, zs: southZ.cells },
      { xs: rightX.cells, zs: southZ.cells }
    ];

    for (const q of quads) {
      for (const xc of q.xs) {
        for (const zc of q.zs) {
          const jit = r.blockJit == null ? 1 : r.blockJit;
          const pad = rng.range(0.8, 1.2 + 2.0 * jit);
          const areaW = (xc[1] - xc[0]) - pad * 2;
          const areaD = (zc[1] - zc[0]) - pad * 2;
          if (areaW < 5.2 || areaD < 5.2) continue;

          const cx = (xc[0] + xc[1]) / 2, cz = (zc[0] + zc[1]) / 2;
          // 宫城只占中轴一段：按地块中心判断，别把整片北城都留空
          if (r.palace && Math.abs(cx) < 17 && cz > -HD * 0.42 && cz < HD * 0.24) continue;
          wardCount++;

          // 外部导入的古建配方优先落位：找得到地块就直接入城，替代本坊的随机建筑
          if (extras.length) {
            const ex = extras[0];
            if (placeExtraMesh(mb, ex, cx, cz, areaW, areaD, r, rng)) {
              extrasPlaced++;
              extras.shift();
              continue;
            }
          }

          if (rng.next() > r.density) {
            emptyCells.push({ cx, cz, areaW, areaD });
            continue;
          }

          // 先从古建 preset 里选一栋主栋，再按剩余空间补厢房/牌坊
          let cluster = null;
          const key = chooseClusterKey(areaW, areaD, rng);
          if (key) cluster = buildPresetCluster(key, r, r.seed + wardCount * 37 + rng.int(0, 29), rng, areaW, areaD);
          if (cluster) {
            cluster.translate(nf(cx), 0, nf(cz));
            mb.merge(cluster);
          } else {
            // 地块太小 / preset 塞不下时，退回普通民居，但仍尽量贴着地块中心
            const cnt = rng.int(1, areaW > 12 ? 2 : 1);
            for (let k = 0; k < cnt; k++) {
              const sub = building(kinds[rng.int(0, kinds.length - 1)]());
              sub.rotateY(rng.int(0, 3) * 90, 0, 0);
              sub.translate(nf(cx + rng.range(-areaW * 0.18, areaW * 0.18)), 0,
                nf(cz + rng.range(-areaD * 0.18, areaD * 0.18)));
              mb.merge(sub);
            }
          }
        }
      }
    }

    // 空坊 / 低密度地块种树，不给每坊都塞满房子，城才有呼吸
    for (const ec of emptyCells) {
      const n = rng.int(1, ec.areaW > 12 ? 3 : 2);
      for (let i = 0; i < n; i++) {
        const kind = ['willow', 'pine', 'plum', 'gingko', 'bamboo'][rng.int(0, 4)];
        const px = ec.cx + rng.range(-ec.areaW * 0.34, ec.areaW * 0.34);
        const pz = ec.cz + rng.range(-ec.areaD * 0.34, ec.areaD * 0.34);
        GF.parts.tree(mb, px, pz, kind, rng, 0.9 + rng.next() * 0.4, '城树');
      }
      if (rng.next() < 0.45) GF.parts.rock(mb, ec.cx + rng.range(-2, 2), ec.cz + rng.range(-2, 2), 1.0 + rng.next() * 0.4, rng, '城石');
    }

    // 城太小、实在找不到地块的导入配方，统一记数，页面提示，不硬塞到街上
    extrasSkipped = extras.length;
    if (extrasSkipped) {
      const room = Math.max(10, Math.min(22, r.w * 0.18));
      for (const ex of extras) {
        if (placeExtraMesh(mb, ex, rng.range(-room, room), rng.range(-room, room), room * 2, room * 1.8, r, rng)) {
          extrasPlaced++; extrasSkipped--;
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
    mb.cityInfo = { w: r.w, d: r.d, wallH: r.wallH, cells: wardCount, seed: r.seed,
      wengcheng: r.wengcheng ? 4 : 0, tapered: r.wallTaper, life: lifeCount,
      extras: extrasPlaced, extrasSkipped: extrasSkipped, gates: gateStats };
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

