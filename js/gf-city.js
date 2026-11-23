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
    bastionGap: 26, blockWallH: 2.2, blockGateW: 3.6, blockWallOn: true, axisHalls: 1,
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
    return r;
  };

  function pbox(mb, x0, x1, y0, y1, z0, z1, mat, tag) {
    mb.box(Math.min(x0, x1), Math.max(x0, x1), Math.min(y0, y1), Math.max(y0, y1),
      Math.min(z0, z1), Math.max(z0, z1), mat, tag);
  }

  // 一段城墙：墙体 + 压顶 + 垛口 + 马面
  function wallRun(mb, a, b, H, T, o) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 0.5) return;
    const dx = (b[0] - a[0]) / len, dz = (b[1] - a[1]) / len;
    const nx = -dz * T / 2, nz = dx * T / 2;
    const p0 = [a[0] + nx, a[1] + nz], p1 = [b[0] + nx, b[1] + nz];
    const p2 = [b[0] - nx, b[1] - nz], p3 = [a[0] - nx, a[1] - nz];
    mb.prism([p0, p1, p2, p3], 0, H, o.wallMat, '城墙');
    mb.prism([p0, p1, p2, p3], H, H + 0.35, 'stoneDark', '城墙·压顶');

    const alongX = Math.abs(nz) > Math.abs(nx);
    const edge = T / 2 - 0.5;
    const n = Math.max(2, Math.round(len / 1.8));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
      if (alongX) mb.boxC(x, z + Math.sign(nz) * edge, 1.15, 1.0, H + 0.35, H + 1.3, 'brickB', '垛口');
      else mb.boxC(x + Math.sign(nx) * edge, z, 1.0, 1.15, H + 0.35, H + 1.3, 'brickB', '垛口');
    }

    if (o.matta && len > (o.bastionGap || 26) * 0.6) {
      const gap = o.bastionGap || 26;
      const m = Math.max(1, Math.floor(len / gap));
      for (let i = 1; i <= m; i++) {
        const t = i / (m + 1);
        const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
        const cx2 = alongX ? x : x + Math.sign(nx) * (T / 2 + 1.9);
        const cz2 = alongX ? z + Math.sign(nz) * (T / 2 + 1.9) : z;
        mb.boxC(cx2, cz2, alongX ? 8.0 : 4.2, alongX ? 4.2 : 8.0, 0, H + 0.35, 'brick', '马面');
        mb.boxC(cx2, cz2, alongX ? 8.0 : 4.2, alongX ? 4.2 : 8.0, H + 0.35, H + 0.55, 'stoneDark', '马面压顶');
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
      // 四座门桥：只跨护城河那一段
      const GW2 = (GW / 2) * 0.85;
      pbox(mb, -GW2, GW2, 0, 0.26, HD - 1.2, hd2 + 1.2, 'slab', '桥面');
      pbox(mb, -GW2, GW2, 0, 0.26, -hd2 - 1.2, -HD + 1.2, 'slab', '桥面');
      pbox(mb, HW - 1.2, hw2 + 1.2, 0, 0.26, -GW2, GW2, 'slab', '桥面');
      pbox(mb, -hw2 - 1.2, -HW + 1.2, 0, 0.26, -GW2, GW2, 'slab', '桥面');
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

    /* 街道 */
    const road = (x0, x1, z0, z1) => pbox(mb, x0, x1, 0, 0.06, z0, z1, 'slab', '街道');
    const rw = r.roadW;
    road(-HW + T, HW - T, -rw / 2, rw / 2);
    road(-rw / 2, rw / 2, -HD + T, HD - T);
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

    for (let c = 0; c < r.cols; c++) {
      for (let rr2 = 0; rr2 < r.rows; rr2++) {
        if (r.palace && c === Math.floor(r.cols / 2) && rr2 <= Math.floor(r.rows / 2)) continue;
        const x0 = -HW + T + cellW * c, z0 = -HD + T + cellD * rr2;
        const areaW = cellW - rw - 3, areaD = cellD - rw - 3;
        if (areaW < 6 || areaD < 6) continue;

        // 坊墙 + 南面坊门（blockWallOn:false 时不砌墙，适合宫城这类无里坊的城）
        if (r.blockWallOn !== false) {
          const fwx = 0.45, FH = r.blockWallH == null ? 2.2 : r.blockWallH;
          const GW2 = (r.blockGateW || 3.6) / 2;
          const px0 = x0 + rw / 2 + 0.4, px1 = x0 + cellW - rw / 2 - 0.4;
          const pz0 = z0 + rw / 2 + 0.4, pz1 = z0 + cellD - rw / 2 - 0.4;
          const fw = (ax, az, bx, bz) => {
            const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz);
            if (L < 1.2) return;
            const ux = dx / L, uz = dz / L;
            const qx = -uz * fwx / 2, qz = ux * fwx / 2;
            const pts = [[ax + qx, az + qz], [bx + qx, bz + qz], [bx - qx, bz - qz], [ax - qx, az - qz]];
            mb.prism(pts, 0, FH, 'brickB', '坊墙');
            mb.prism(pts, FH, FH + 0.22, 'stoneDark', '坊墙压顶');
          };
          fw(px0, pz0, px1, pz0);
          fw(px0, pz0, px0, pz1);
          fw(px1, pz0, px1, pz1);
          const fcx = (px0 + px1) / 2;
          fw(px0, pz1, fcx - GW2, pz1);
          fw(fcx + GW2, pz1, px1, pz1);
        }

        if (rng.next() > r.density) continue;
        const cx = x0 + cellW / 2, cz = z0 + cellD / 2;
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

    mb.cityInfo = { w: r.w, d: r.d, wallH: r.wallH, cells: r.cols * r.rows, seed: r.seed };
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
        palace: false, axisHalls: 1, bastionGap: 16, roofColor: 'grey' }
    },
    {
      key: 'palace', name: '宫城·三殿',
      recipe: { seed: 551188, w: 118, d: 104, wallH: 10, wallT: 5.2, gateW: 12, roadW: 10,
        moatW: 10, cols: 3, rows: 3, density: 0.7, matta: true, tower: true,
        palace: true, axisHalls: 3, roofColor: 'yellow' }
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
        axisHalls: 3, bastionGap: 30, blockWallH: 2.2, blockGateW: 4.0, roofColor: 'yellow' }
    },
    {
      key: 'gugong', name: '紫禁城',
      recipe: { seed: 404, w: 76, d: 96, wallH: 6.5, wallT: 3.4, gateW: 10, roadW: 12,
        moatW: 11, cols: 2, rows: 3, density: 0.3, matta: true, tower: true, palace: true,
        axisHalls: 3, bastionGap: 60, blockWallOn: false, roofColor: 'yellow' }
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
