/* ============================================================================
 * 国风古建像素工坊 · 屋面系统
 * 支持：庑殿（四阿）、歇山、悬山、硬山、攒尖（多边/圆）、腰檐（重檐）
 * 全部为参数化三维网格：凹曲举折、檐口起翘、瓦垄明暗、正脊/垂脊/脊兽/宝顶
 * ==========================================================================*/
(function (global) {
  'use strict';
  const GF = (global.GF = global.GF || {});
  const V = GF.V;

  // 举折曲线：v=0 檐口，v=1 屋脊；近檐平缓，近脊陡峻（中式凹曲屋面）
  const curve = (v) => Math.pow(v, 1.45);

  // 屋脊/瓦当材质：琉璃瓦用同色脊，青瓦用冷灰瓦当色
  function ridgeOf(o) {
    const t = o.tile || '';
    if (/thatch/.test(t)) return o.tileB || 'thatchB';
    // 琉璃瓦：瓦当/屋脊随瓦同色（金瓦配青灰瓦当会非常突兀）
    if (/glaze/.test(t)) return t;
    return o.tileEnd || 'tileEnd';
  }

  // 剪边：屋面最靠檐口的一圈改用另一种瓦色（故宫常见做法）
  let TRIM = null;

  // 瓦垄起伏：每条垄在 u 方向压出三角棱（脊顶 +1、垄沟 -0.6），檐口三行内淡出，
  // 这样瓦面本身有 4cm 级起伏，法线随之变化，像素渲染才有真实明暗而不只是色带。
  let RIB = 0.03;

  /** 参数化曲面片：fn(u,v) -> [x,y,z] */
  function patch(mb, nu, nv, fn, matA, matB, tag, rib) {
    const amp = rib == null ? RIB : rib;
    const NU = amp ? nu * 2 : nu;
    const fade = (j) => Math.min(1, j / Math.max(1, nv * 0.3));
    const grid = [];
    for (let j = 0; j <= nv; j++) {
      const row = [];
      for (let i = 0; i <= NU; i++) {
        const p = fn(i / NU, j / nv);
        if (amp) p[1] += amp * (i % 2 === 0 ? 1 : -0.6) * fade(j);
        row.push(p);
      }
      grid.push(row);
    }
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < NU; i++) {
        const a = grid[j][i], b = grid[j][i + 1];
        const c = grid[j + 1][i + 1], d = grid[j + 1][i];
        // 每隔一垄换一条色带，形成瓦垄明暗
        let mat = ((amp ? Math.floor(i / 2) : i) % 2 === 0) ? matA : matB;
        if (TRIM && j === 0) mat = TRIM;
        mb.quad(a, b, c, d, mat, tag);
      }
    }
  }

  // 檐角起翘：u 在两端（0/1）时最大
  const cornerLift = (u) => Math.pow(Math.abs(u * 2 - 1), 6);

  function bands(width) {
    return GF.clamp(Math.round(width / 0.2), 8, 96);
  }

  /* ------------------------------ 正脊 ------------------------------ */
  function addRidge(mb, cx, cz, xe, xr, yb, rise, o) {
    const RD = ridgeOf(o);
    const style = o.ridgeStyle || 'plain';
    if (style === 'none') return;
    const rh = style === 'ornate' ? 0.34 : 0.22;
    const rw = style === 'ornate' ? 0.36 : 0.26;
    const y = yb + rise;
    // 正脊主体
    mb.box(cx - xr - 0.1, cx + xr + 0.1, y - rh * 0.5, y + rh, cz - rw / 2, cz + rw / 2, RD, o.tag + '·正脊');
    // 脊上线条（金/白）
    if (style === 'ornate') {
      mb.box(cx - xr - 0.06, cx + xr + 0.06, y + rh, y + rh + 0.08, cz - rw * 0.28, cz + rw * 0.28, 'gold', o.tag + '·脊线');
    }
    // 两端鸱吻
    const beastN = o.beasts || 0;
    for (const s of [-1, 1]) {
      const ex = cx + s * (xr + 0.1);
      mb.boxC(ex, cz, 0.34, 0.3, y - 0.1, y + 0.52, RD, o.tag + '·鸱吻');
      mb.boxC(ex + s * 0.04, cz, 0.2, 0.22, y + 0.5, y + 0.78, RD, o.tag + '·鸱吻');
      if (style === 'ornate') {
        mb.boxC(ex, cz, 0.16, 0.16, y + 0.72, y + 0.86, 'gold', o.tag + '·吻金');
      }
    }
    // 脊兽（沿正脊向中间排布）
    for (let i = 0; i < beastN; i++) {
      for (const s of [-1, 1]) {
        const bx = cx + s * (xr - 0.18 - i * 0.42);
        if (Math.abs(bx - cx) > xr - 0.1) continue;
        mb.boxC(bx, cz, 0.16, 0.18, y + rh, y + rh + 0.2 + i * 0.02, RD, o.tag + '·脊兽');
      }
    }
    // 宝顶
    if (o.finial) {
      mb.lathe(cx, cz, [
        [0, y + 0.1], [0.26, y + 0.12], [0.3, y + 0.24], [0.16, y + 0.42],
        [0.22, y + 0.56], [0.1, y + 0.76], [0.06, y + 0.92], [0, y + 0.96]
      ], 8, 'gold', o.tag + '·宝顶');
    }
  }

  /* ------------------------------ 垂脊 ------------------------------ */
  function addHipRidges(mb, cx, cz, xe, ze, xr, yb, rise, o) {
    const RD = ridgeOf(o);
    // 沿四条斜脊铺细石条（简化：把檐角到脊端的折线串起来）
    const ptsAlong = (sx, sz) => {
      const out = [];
      const steps = 5;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = sx * V.lerp(xe, xr, t);
        const z = sz * V.lerp(ze, 0, t);
        const y = yb + rise * curve(t) + (i === 0 ? o.upturn || 0.3 : 0);
        out.push([cx + x, y + 0.04, cz + z]);
      }
      return out;
    };
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const pts = ptsAlong(sx, sz);
        for (let i = 0; i < pts.length - 1; i++) {
          GF.beamBetween(mb, pts[i], pts[i + 1], 0.16, 0.12, RD, o.tag + '·垂脊');
        }
        // 檐角套兽
        const tip = pts[0];
        mb.boxC(tip[0], tip[2], 0.2, 0.2, tip[1] - 0.1, tip[1] + 0.16, RD, o.tag + '·套兽');
      }
    }
  }

  /* ---------------------------- 檐口瓦当 ---------------------------- */
  function addEaveTiles(mb, pts, o) {
    const RD = ridgeOf(o);
    // pts: 檐口折线（世界坐标）
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      // 檐口连檐：瓦口下方一道通长木条，把瓦当滴水托住，檐口不再“悬空”
      GF.beamBetween(mb, [a[0], a[1] - 0.1, a[2]], [b[0], b[1] - 0.1, b[2]], 0.11, 0.15, 'woodDark', o.tag + '·连檐');
      const len = Math.hypot(b[0] - a[0], b[2] - a[2]);
      const n = Math.max(1, Math.round(len / 0.42));
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n;
        const x = a[0] + (b[0] - a[0]) * t;
        const z = a[2] + (b[2] - a[2]) * t;
        const y = a[1] + (b[1] - a[1]) * t;
        mb.cyl(x, z, 0.085, y - 0.16, y + 0.02, 8, RD, o.tag + '·瓦当');
        // 滴水：瓦当之间再垂一片舌形瓦，上宽下窄，形成“瓦当—滴水”相间的檐口节奏
        const t2 = k / n;
        const x2 = a[0] + (b[0] - a[0]) * t2;
        const z2 = a[2] + (b[2] - a[2]) * t2;
        const y2 = a[1] + (b[1] - a[1]) * t2;
        mb.taper(x2, z2, 0.115, 0.115, 0.07, 0.07, y2 - 0.24, y2 - 0.1, RD, o.tag + '·滴水');
      }
    }
  }

  /* ---------------------------- 悬鱼 · 惹草 ---------------------------- */
  // 山面博风板下垂的鱼形木饰，两侧各一片卷草纹小木（惹草）
  function addXuanYu(mb, x, zc, yTop, tag) {
    const y0 = yTop - 0.78;
    mb.box(x - 0.05, x + 0.05, y0, yTop - 0.02, zc - 0.2, zc + 0.2, 'wood', tag + '·悬鱼');
    mb.box(x - 0.07, x + 0.07, y0 + 0.18, yTop - 0.14, zc - 0.29, zc + 0.29, 'wood', tag + '·悬鱼');
    for (const s of [-1, 1]) {
      mb.box(x - 0.04, x + 0.04, y0 + 0.34, yTop - 0.26, zc + s * 0.3, zc + s * 0.46, 'wood', tag + '·惹草');
    }
  }

  /* ---------------------------- 檐角风铎 ---------------------------- */
  function addWindDuo(mb, x, y, z, tag) {
    mb.boxC(x, z, 0.05, 0.05, y - 0.3, y - 0.02, 'gold', tag + '·风铎');
    mb.boxC(x, z, 0.13, 0.13, y - 0.46, y - 0.3, 'gold', tag + '·风铎');
  }
  function windDuoAtCorners(mb, cx, cz, xe, ze, y, tag) {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) addWindDuo(mb, cx + sx * xe, y, cz + sz * ze, tag);
    }
  }

  /* ------------------------------ 庑殿顶 ------------------------------ */
  function hipRoof(mb, o) {
    const { cx, cz, x0, x1, z0, z1, yb, rise } = o;
    const xe = (x1 - x0) / 2, ze = (z1 - z0) / 2;
    const xr = Math.max(0.2, xe - ze); // 45° 斜脊
    const nu = bands(xe * 2), nv = 6;
    const up = o.upturn == null ? 0.35 : o.upturn;

    const slopeZ = (sign) => (u, v) => {
      const x = V.lerp(-xe + 2 * xe * u, -xr + 2 * xr * u, v);
      const z = sign * ze * (1 - v);
      const y = yb + rise * curve(v) + up * cornerLift(u) * Math.pow(1 - v, 1.5);
      return [cx + x, y, cz + z];
    };
    const slopeX = (sign) => (u, v) => {
      const x = sign * V.lerp(xe, xr, v);
      const z = V.lerp(-ze + 2 * ze * u, 0, v);
      const y = yb + rise * curve(v) + up * cornerLift(u) * Math.pow(1 - v, 1.5);
      return [cx + x, y, cz + z];
    };

    patch(mb, nu, nv, slopeZ(1), o.tile, o.tileB, o.tag + '·前坡');
    patch(mb, nu, nv, slopeZ(-1), o.tile, o.tileB, o.tag + '·后坡');
    patch(mb, Math.max(6, bands(ze * 2)), nv, slopeX(1), o.tile, o.tileB, o.tag + '·右坡');
    patch(mb, Math.max(6, bands(ze * 2)), nv, slopeX(-1), o.tile, o.tileB, o.tag + '·左坡');

    // 檐口瓦当
    const eave = (u) => {
      const vals = [];
      const seg = 8;
      for (let i = 0; i < seg; i++) {
        const t = i / seg;
        vals.push([
          cx + (-xe + 2 * xe * t), yb + up * cornerLift(t), cz + ze
        ]);
      }
      return vals;
    };
    addEaveTiles(mb, eave(), o);
    const eaveB = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      eaveB.push([cx + (-xe + 2 * xe * t), yb + up * cornerLift(t), cz - ze]);
    }
    addEaveTiles(mb, eaveB, o);

    addHipRidges(mb, cx, cz, xe, ze, xr, yb, rise, o);
    if (o.windDuo) windDuoAtCorners(mb, cx, cz, xe, ze, yb + up, o.tag);
    // 十字脊的横向顶不另立正脊，否则脊端会在交叉点堆成小塔
    if (!o.noRidge) addRidge(mb, cx, cz, xe, xr, yb, rise, o);
  }

  /* ------------------------------ 悬山/硬山顶 ------------------------------ */
  function gableRoof(mb, o) {
    const { cx, cz, x0, x1, z0, z1, yb, rise } = o;
    const xe = (x1 - x0) / 2, ze = (z1 - z0) / 2;
    const nu = bands(xe * 2), nv = 6;
    const up = o.upturn == null ? 0.3 : o.upturn;

    const slope = (sign) => (u, v) => {
      const x = -xe + 2 * xe * u;
      const z = sign * ze * (1 - v);
      const y = yb + rise * curve(v) + up * cornerLift(u) * Math.pow(1 - v, 1.5);
      return [cx + x, y, cz + z];
    };
    patch(mb, nu, nv, slope(1), o.tile, o.tileB, o.tag + '·前坡');
    patch(mb, nu, nv, slope(-1), o.tile, o.tileB, o.tag + '·后坡');

    // 山面（三角山花）：悬山为木板，硬山为墙体
    const gableMat = o.gableMat || 'plaster';
    for (const s of [-1, 1]) {
      const x = cx + s * xe;
      mb.tri(
        [x, yb, cz - ze], [x, yb, cz + ze], [x, yb + rise, cz],
        gableMat, o.tag + '·山花'
      );
      mb.tri(
        [x, yb, cz + ze], [x, yb, cz - ze], [x, yb + rise, cz],
        gableMat, o.tag + '·山花'
      );
      // 博风板（沿两坡边缘的木条）
      GF.beamBetween(mb, [x, yb, cz - ze], [x, yb + rise, cz], 0.12, 0.2, 'wood', o.tag + '·博风');
      GF.beamBetween(mb, [x, yb, cz + ze], [x, yb + rise, cz], 0.12, 0.2, 'wood', o.tag + '·博风');
    }

    const eavePts = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      eavePts.push([cx + (-xe + 2 * xe * t), yb + up * cornerLift(t), cz + ze]);
    }
    addEaveTiles(mb, eavePts, o);
    const eavePts2 = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      eavePts2.push([cx + (-xe + 2 * xe * t), yb + up * cornerLift(t), cz - ze]);
    }
    addEaveTiles(mb, eavePts2, o);

    if (o.xuanYu) {
      for (const s of [-1, 1]) addXuanYu(mb, cx + s * xe, cz, yb + rise, o.tag);
    }
    if (o.windDuo) windDuoAtCorners(mb, cx, cz, xe, ze, yb + up, o.tag);
    addRidge(mb, cx, cz, xe, xe, yb, rise, o);
  }

  /* ------------------------------ 卷棚顶 ------------------------------ */
  // 元宝脊：两坡相交处不做硬脊，代之以圆弧曲面（卷棚悬山/硬山/歇山均由此派生）
  function rollRoof(mb, o) {
    const { cx, cz, x0, x1, z0, z1, yb, rise } = o;
    const xe = (x1 - x0) / 2, ze = (z1 - z0) / 2;
    const up = o.upturn == null ? 0.3 : o.upturn;
    const rr = Math.min(0.36, Math.max(0.18, rise * 0.4));
    const yApex = yb + rise - rr;

    const slope = (sign) => (u, v) => {
      const x = -xe + 2 * xe * u;
      const z = sign * (rr + (ze - rr) * (1 - v));
      const y = yb + (yApex - yb) * curve(v) + up * cornerLift(u) * Math.pow(1 - v, 1.6);
      return [cx + x, y, cz + z];
    };
    patch(mb, bands(xe * 2), 6, slope(1), o.tile, o.tileB, o.tag + '·前坡');
    patch(mb, bands(xe * 2), 6, slope(-1), o.tile, o.tileB, o.tag + '·后坡');

    // 圆弧脊背
    const arcSeg = 6;
    const rowPts = [];
    for (let k = 0; k <= arcSeg; k++) {
      const a = Math.PI * (1 - k / arcSeg);
      rowPts.push([cz + Math.cos(a) * rr, yApex + Math.sin(a) * rr]);
    }
    const X = bands(xe * 2);
    for (let i = 0; i < X; i++) {
      const xa = cx - xe + (2 * xe * i) / X, xb = cx - xe + (2 * xe * (i + 1)) / X;
      for (let k = 0; k < arcSeg; k++) {
        const p = rowPts[k], q = rowPts[k + 1];
        mb.quad([xa, p[1], p[0]], [xb, p[1], p[0]], [xb, q[1], q[0]], [xa, q[1], q[0]],
          i % 2 === 0 ? o.tile : o.tileB, o.tag + '·元宝脊');
      }
    }
    if (o.ridgeStyle === 'ornate') {
      mb.box(cx - xe, cx + xe, yApex + rr - 0.03, yApex + rr + 0.03, cz - 0.08, cz + 0.08, 'gold', o.tag + '·罗锅脊');
    }

    // 山面（木山花：轮廓必须贴着卷棚的凹曲屋面，不能是一刀平的三角形）
    const gMat = o.gableMat || 'wood';
    for (const s of [-1, 1]) {
      const x = cx + s * xe;
      const gp = [[x, yb, cz - ze]];
      const VS = 6;
      for (let k = 1; k <= VS; k++) {
        const v = k / VS;
        gp.push([x, yb + (yApex - yb) * curve(v) + up * Math.pow(1 - v, 1.6), cz - (rr + (ze - rr) * (1 - v))]);
      }
      const T = [x, yApex + rr, cz];
      for (let k = VS; k >= 1; k--) {
        const v = k / VS;
        gp.push([x, yb + (yApex - yb) * curve(v) + up * Math.pow(1 - v, 1.6), cz + (rr + (ze - rr) * (1 - v))]);
      }
      gp.push([x, yb, cz + ze]);
      for (let i = 0; i < gp.length - 1; i++) {
        mb.tri(gp[i], gp[i + 1], T, gMat, o.tag + '·山花');
        mb.tri(gp[i + 1], gp[i], T, gMat, o.tag + '·山花');
      }
      GF.beamBetween(mb, [x, yb, cz - ze], [x, yb + (yApex - yb) * 0.6, cz - rr], 0.12, 0.18, 'wood', o.tag + '·博风');
      GF.beamBetween(mb, [x, yb, cz + ze], [x, yb + (yApex - yb) * 0.6, cz + rr], 0.12, 0.18, 'wood', o.tag + '·博风');
      if (o.xuanYu) addXuanYu(mb, x, cz, yApex + rr - 0.05, o.tag);
    }

    // 檐口瓦当
    for (const sz of [1, -1]) {
      const pts = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        pts.push([cx + (-xe + 2 * xe * t), yb + up * cornerLift(t), cz + sz * ze]);
      }
      addEaveTiles(mb, pts, o);
    }
    if (o.windDuo) windDuoAtCorners(mb, cx, cz, xe, ze, yb + up, o.tag);
  }

  /* ------------------------------ 盝顶 ------------------------------ */
  // 四面坡 + 顶部平顶，平顶四周环绕一圈围脊
  function luRoof(mb, o) {
    const RD = ridgeOf(o);
    const { cx, cz, x0, x1, z0, z1, yb, rise } = o;
    const xe = (x1 - x0) / 2, ze = (z1 - z0) / 2;
    const xi = Math.max(0.8, xe * 0.42), zi = Math.max(0.6, ze * 0.38);
    skirtRoof(mb, {
      cx, cz, x0, x1, z0, z1, xi, zi, yb, ytop: yb + rise,
      upturn: o.upturn, tile: o.tile, tileB: o.tileB, tag: o.tag
    });
    // 平顶
    mb.box(cx - xi - 0.05, cx + xi + 0.05, yb + rise - 0.05, yb + rise + 0.02, cz - zi - 0.05, cz + zi + 0.05, 'tile', o.tag + '·平顶');
    // 围脊（圈脊）
    const rh = 0.2;
    for (const sz of [-1, 1]) {
      mb.box(cx - xi - 0.1, cx + xi + 0.1, yb + rise, yb + rise + rh, cz + sz * zi - 0.09, cz + sz * zi + 0.09, RD, o.tag + '·围脊');
    }
    for (const sx of [-1, 1]) {
      mb.box(cx + sx * xi - 0.09, cx + sx * xi + 0.09, yb + rise, yb + rise + rh, cz - zi - 0.1, cz + zi + 0.1, RD, o.tag + '·围脊');
    }
    if (o.finial) {
      mb.lathe(cx, cz, [[0, yb + rise], [0.22, yb + rise + 0.05], [0.26, yb + rise + 0.2], [0.1, yb + rise + 0.38], [0, yb + rise + 0.44]], 8, 'gold', o.tag + '·宝顶');
    }
    if (o.windDuo) windDuoAtCorners(mb, cx, cz, xe, ze, yb + (o.upturn || 0.3), o.tag);
  }

  /* ------------------------------ 十字歇山 ------------------------------ */
  // 两个歇山正脊呈十字相交（故宫角楼式）：横向一坡略低略收，避免屋面互相穿插
  function crossRoof(mb, o) {
    const { cx, cz, x0, x1, z0, z1 } = o;
    const hx = (x1 - x0) / 2, hz = (z1 - z0) / 2;
    const tag = o.tag || '屋面';
    // 十字脊：两座等大的四坡顶正交叠落。四坡顶四面闭合，不存在山面开口，
    // 正交后自动形成 X 形十字脊；用歇山会因“山花只朝一个轴”而在脊交处漏出内部。
    hipRoof(mb, Object.assign({}, o, { tag: tag + '·纵' }));
    hipRoof(mb, Object.assign({}, o, {
      tag: tag + '·横',
      xuanYu: false, windDuo: false, beasts: 0, noRidge: true,
      x0: cx - hz, x1: cx + hz, z0: cz - hx, z1: cz + hx,
      yb: o.yb + (o.rise || 1) * 0.05,
      rise: (o.rise || 1) * 0.95
    }));
  }

  /* ------------------------------ 歇山顶 ------------------------------ */
  function gableHipRoof(mb, o) {
    const { cx, cz, x0, x1, z0, z1, yb, rise } = o;
    const xe = (x1 - x0) / 2, ze = (z1 - z0) / 2;
    const up = o.upturn == null ? 0.35 : o.upturn;

    // 下檐：四坡收进到内矩形
    const xi = xe * 0.56, zi = ze * 0.5;
    const y1 = yb + rise * 0.46;

    const lowZ = (sign) => (u, v) => {
      const x = V.lerp(-xe + 2 * xe * u, -xi + 2 * xi * u, v);
      const z = sign * V.lerp(ze, zi, v);
      const y = yb + (y1 - yb) * curve(v) + up * cornerLift(u) * Math.pow(1 - v, 1.5);
      return [cx + x, y, cz + z];
    };
    const lowX = (sign) => (u, v) => {
      const x = sign * V.lerp(xe, xi, v);
      const z = V.lerp(-ze + 2 * ze * u, -zi + 2 * zi * u, v);
      const y = yb + (y1 - yb) * curve(v) + up * cornerLift(u) * Math.pow(1 - v, 1.5);
      return [cx + x, y, cz + z];
    };
    patch(mb, bands(xe * 2), 4, lowZ(1), o.tile, o.tileB, o.tag + '·下檐前');
    patch(mb, bands(xe * 2), 4, lowZ(-1), o.tile, o.tileB, o.tag + '·下檐后');
    patch(mb, bands(ze * 2), 4, lowX(1), o.tile, o.tileB, o.tag + '·下檐右');
    patch(mb, bands(ze * 2), 4, lowX(-1), o.tile, o.tileB, o.tag + '·下檐左');

    // 上檐：前后两坡（自内矩形到正脊）
    const xr = xi * 0.92;
    const slope = (sign) => (u, v) => {
      const x = -xi + 2 * xi * u;
      const z = sign * V.lerp(zi, 0, v);
      const y = y1 + (yb + rise - y1) * curve(v);
      return [cx + x, y, cz + z];
    };
    patch(mb, bands(xi * 2), 4, slope(1), o.tile, o.tileB, o.tag + '·上檐前');
    patch(mb, bands(xi * 2), 4, slope(-1), o.tile, o.tileB, o.tag + '·上檐后');

    // 山花（三角形）
    for (const s of [-1, 1]) {
      const x = cx + s * xi;
      if (!o.bare) {
        mb.tri([x, y1, cz - zi], [x, y1, cz + zi], [x, yb + rise, cz], 'wood', o.tag + '·山花');
        mb.tri([x, y1, cz + zi], [x, y1, cz - zi], [x, yb + rise, cz], 'wood', o.tag + '·山花');
        GF.beamBetween(mb, [x, y1, cz - zi], [x, yb + rise, cz], 0.12, 0.18, 'wood', o.tag + '·博风');
        GF.beamBetween(mb, [x, y1, cz + zi], [x, yb + rise, cz], 0.12, 0.18, 'wood', o.tag + '·博风');
      }
    }

    // 下檐檐口瓦当
    const eavePts = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      eavePts.push([cx + (-xe + 2 * xe * t), yb + up * cornerLift(t), cz + ze]);
    }
    addEaveTiles(mb, eavePts, o);
    const e2 = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      e2.push([cx + (-xe + 2 * xe * t), yb + up * cornerLift(t), cz - ze]);
    }
    addEaveTiles(mb, e2, o);

    addHipRidges(mb, cx, cz, xe, ze, xi, yb, y1 - yb, o);
    if (o.xuanYu) {
      for (const s of [-1, 1]) addXuanYu(mb, cx + s * xi, cz, yb + rise, o.tag);
    }
    if (o.windDuo) windDuoAtCorners(mb, cx, cz, xe, ze, yb + up, o.tag);
    addRidge(mb, cx, cz, xe, xr, yb + rise * 0.54, rise * 0.46, o);
  }

  /* ------------------------------ 攒尖顶 ------------------------------ */
  function pyramidRoof(mb, o) {
    const RD = ridgeOf(o);
    const { cx, cz, xe, ze, yb, rise } = o;
    const sides = o.sides || 4;
    const up = o.upturn == null ? 0.45 : o.upturn;
    const apex = [cx, yb + rise + 0.05, cz];
    const rings = 5;
    const per = Math.max(2, sides); // 每边细分，檐口只有角上起翘，边中落在柱头上

    // 由多边形底边向顶点收敛；u 为所在边的归一位置，用来只抬角、不抬整圈檐口
    const ringPts = (s) => {
      const out = [];
      const segs = sides * per;
      for (let i = 0; i <= segs; i++) {
        const side = Math.min(sides - 1, Math.floor(i / per));
        const u = (i / per) - side;
        const a = (side / sides) * Math.PI * 2 + (o.rot || 0);
        const b = ((side + 1) / sides) * Math.PI * 2 + (o.rot || 0);
        const ea = [cx + Math.cos(a) * Math.max(0.02, xe * (1 - s)), cz + Math.sin(a) * Math.max(0.02, ze * (1 - s))];
        const eb = [cx + Math.cos(b) * Math.max(0.02, xe * (1 - s)), cz + Math.sin(b) * Math.max(0.02, ze * (1 - s))];
        const px = ea[0] + (eb[0] - ea[0]) * u;
        const pz = ea[1] + (eb[1] - ea[1]) * u;
        out.push([px, yb + rise * curve(s) + up * cornerLift(u) * Math.pow(1 - s, 1.8), pz]);
      }
      return out;
    };
    const rows = [];
    for (let j = 0; j <= rings; j++) rows.push(ringPts(j / rings));
    for (let j = 0; j < rings; j++) {
      for (let i = 0; i < rows[j].length - 1; i++) {
        const seg = Math.floor(i / per);
        const mat = (o.trim && j === 0) ? o.trim : (seg % 2 === 0 ? o.tile : o.tileB);
        mb.quad(rows[j][i], rows[j][i + 1], rows[j + 1][i + 1], rows[j + 1][i], mat, o.tag + '·坡面');
      }
    }
    // 檐口瓦当（沿起翘后的檐口折线走）
    addEaveTiles(mb, rows[0], o);

    // 垂脊（每条棱）
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2 + (o.rot || 0);
      const base = [cx + Math.cos(a) * xe, yb + up, cz + Math.sin(a) * ze];
      GF.beamBetween(mb, base, apex, 0.14, 0.12, RD, o.tag + '·垂脊');
      if (o.windDuo) addWindDuo(mb, base[0], base[1], base[2], o.tag);
    }
    // 宝顶（攒尖顶没有正脊，宝顶单独画，不再借 addRidge，否则 ridgeStyle='none' 会把它一起省掉）
    addRidge(mb, cx, cz, xe, 0, yb, rise, Object.assign({}, o, { ridgeStyle: 'none', finial: false }));
    if (o.finial !== false) {
      const yTop = yb + rise;
      mb.lathe(cx, cz, [
        [0, yTop + 0.1], [0.26, yTop + 0.12], [0.3, yTop + 0.24], [0.16, yTop + 0.42],
        [0.22, yTop + 0.56], [0.1, yTop + 0.76], [0.06, yTop + 0.92], [0, yTop + 0.96]
      ], 8, 'gold', o.tag + '·宝顶');
    }
  }

  /* ------------------------------ 腰檐（裙檐） ------------------------------ */
  // 由外檐矩形收到内矩形，用于重檐下檐、塔檐、楼阁平座
  function skirtRoof(mb, o) {
    const RD = ridgeOf(o);
    const { cx, cz, x0, x1, z0, z1, xi, zi, yb, ytop } = o;
    const xe = (x1 - x0) / 2, ze = (z1 - z0) / 2;
    const up = o.upturn == null ? 0.3 : o.upturn;
    const rings = 4;
    const yTop = ytop == null ? yb + 1.2 : ytop;

    const ring = (s) => {
      const X = V.lerp(xe, xi, s), Z = V.lerp(ze, zi, s);
      const y = yb + (yTop - yb) * curve(s);
      const lift = up * Math.pow(1 - s, 1.6);
      const out = [];
      const per = 8;
      // 顺时针走一圈：前 -> 右 -> 后 -> 左
      for (let i = 0; i <= per; i++) { // 前檐 x: -X..X
        const t = i / per;
        out.push([cx + (-X + 2 * X * t), y + lift * cornerLift(t) * 0.15, cz + Z]);
      }
      for (let i = 1; i <= per; i++) { // 右檐 z: Z..-Z
        const t = i / per;
        out.push([cx + X, y + lift * cornerLift(t) * 0.15, cz + (Z - 2 * Z * t)]);
      }
      for (let i = 1; i <= per; i++) { // 后檐 x: X..-X
        const t = i / per;
        out.push([cx + (X - 2 * X * t), y + lift * cornerLift(t) * 0.15, cz - Z]);
      }
      for (let i = 1; i <= per; i++) { // 左檐 z: -Z..Z
        const t = i / per;
        out.push([cx - X, y + lift * cornerLift(t) * 0.15, cz + (-Z + 2 * Z * t)]);
      }
      return out;
    };

    const rows = [];
    for (let j = 0; j <= rings; j++) rows.push(ring(j / rings));
    for (let j = 0; j < rings; j++) {
      const n = rows[j].length;
      for (let i = 0; i < n - 1; i++) {
        const mat = (o.trim && j === 0) ? o.trim : (i % 2 === 0 ? o.tile : o.tileB);
        mb.quad(rows[j][i], rows[j][i + 1], rows[j + 1][i + 1], rows[j + 1][i], mat, o.tag + '·腰檐');
      }
    }
    // 檐口瓦当
    const eavePts = rows[0].slice(0, 9);
    addEaveTiles(mb, eavePts, o);
    // 四角套兽
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        mb.boxC(cx + sx * xe, cz + sz * ze, 0.22, 0.22, yb - 0.12, yb + up + 0.16, RD, o.tag + '·套兽');
      }
    }
  }

  /* ------------------------------ 统一入口 ------------------------------ */
  // 统一的默认值注入：剪边 / 悬鱼 / 风铎 / 山花材质 直接从配方透传，避免每处调用都重复写
  let ROOF_DEF = {};
  function withDefaults(o) {
    return Object.assign({}, ROOF_DEF, o || {});
  }

  GF.roofs = {
    setDefaults(d) { ROOF_DEF = d || {}; },
    build(mb, o) {
      const oo = withDefaults(o);
      const type = oo.type || 'hip';
      TRIM = oo.trim || null;
      // LOD plain：后进 / 跨院 / 廊顶省瓦垄起伏与分档（纯增量开关，默认关闭）
      const savedRib = RIB; let savedBands = null;
      if (oo.plain) {
        RIB = 0;
        savedBands = bands;
        bands = (w) => Math.max(4, Math.round(savedBands(w) / 2));
      }
      try {
        if (type === 'roll' || oo.roll) rollRoof(mb, oo);
        else if (type === 'hip') hipRoof(mb, oo);
        else if (type === 'gable' || type === 'gableHard') gableRoof(mb, oo);
        else if (type === 'gableHip') gableHipRoof(mb, oo);
        else if (type === 'pyramid') pyramidRoof(mb, oo);
        else if (type === 'skirt') skirtRoof(mb, oo);
        else if (type === 'lu') luRoof(mb, oo);
        else if (type === 'cross') crossRoof(mb, oo);
        else hipRoof(mb, oo);
      } finally {
        RIB = savedRib;
        if (savedBands) bands = savedBands;
      }
      TRIM = null;
    },
    skirt(mb, o) {
      const oo = withDefaults(o);
      TRIM = oo.trim || null;
      skirtRoof(mb, oo);
      TRIM = null;
    },
    roll: rollRoof,
    lu: luRoof,
    cross: crossRoof
  };
})(typeof window !== 'undefined' ? window : globalThis);


