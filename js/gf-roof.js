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

  // 瓦垄起伏：每条垄在 u 方向压出断面。
  // 中档以上不再是“三角棱”，而是按半圆断面的筒瓦垄（沟—坡—顶—坡—沟），
  // 320 px/m 时垄距 0.33 m ≈ 105 px、垄高 0.024 m ≈ 8 px，圆垄在像素上才读得出“瓦”。
  let RIB = 0.024;
  // 半圆断面：5 点一垄，两端落在垄沟、中点为瓦顶，避免出现“平顶亮带”
  const RIB5 = [0, 0.6, 1, 0.6, 0];
  const PROF2 = [1, -0.6];

  /** 参数化曲面片：fn(u,v) -> [x,y,z] */
  function patch(mb, nu, nv, fn, matA, matB, tag, rib) {
    const amp = rib == null ? RIB : rib;
    const per = amp ? (GF.detail(2) ? 5 : 2) : 1;
    const NU = amp ? nu * per : nu;
    const prof = per === 5 ? RIB5 : PROF2;
    // 檐口最外一行略收（35%），防止瓦垄在檐边形成一排“梳齿”；脊侧保持满垄高。
    const fade = (j) => (amp ? (per === 5 ? (j === 0 ? 0.35 : 1) : Math.min(1, j / Math.max(1, nv * 0.3))) : 0);
    // 剪边只在檐口最外一条窄带上：把 v 采样在 0 附近加密，第一条只有 5% 坡长（≈0.1–0.2 m），
    // 否则整皮瓦（1.5 m 宽）都会变成一条光板绿带。
    const vs = [];
    if (TRIM && nv >= 3) {
      vs.push(0, 0.05);
      for (let j = 1; j <= nv; j++) if (j / nv > 0.0501) vs.push(j / nv);
    } else {
      for (let j = 0; j <= nv; j++) vs.push(j / nv);
    }
    const grid = [];
    for (let j = 0; j < vs.length; j++) {
      const row = [];
      for (let i = 0; i <= NU; i++) {
        const p = fn(i / NU, vs[j]);
        if (amp) p[1] += amp * prof[i % per] * fade(vs[j] * nv);
        row.push(p);
      }
      grid.push(row);
    }
    for (let j = 0; j < grid.length - 1; j++) {
      for (let i = 0; i < NU; i++) {
        const a = grid[j][i], b = grid[j][i + 1];
        const c = grid[j + 1][i + 1], d = grid[j + 1][i];
        // 瓦垄色带只在低档用；中档以上同一瓦色，靠圆垄的明暗分垄
        const tileIdx = amp ? Math.floor(i / per) : i;
        let mat = (GF.detail(2) || tileIdx % 2 === 0) ? matA : matB;
        if (TRIM && j === 0) mat = TRIM;
        mb.quad(a, b, c, d, mat, tag);
      }
    }
  }

  // 檐角起翘：u 在两端（0/1）时最大
  const cornerLift = (u) => Math.pow(Math.abs(u * 2 - 1), 6);

  /* 环形屋面（攒尖 / 腰檐）的瓦垄：
   * 这类屋面沿边参数 u 展开，瓦垄必须按“每条边多少垄”对齐，
   * 不能按累积弧长——否则每圈半径不同，垄位会错开，整片屋面叠出鱼骨状褶皱。 */
  const TILE_PITCH = 0.33;
  function ribOffset(u, tiles) {
    if (!GF.detail(2)) return 0;
    const q = (u * tiles) % 1;
    return RIB * (Math.sin(Math.PI * q) * 1.15 - 0.15);
  }


  function bands(width) {
    return GF.clamp(Math.round(width / 0.2), 8, 96);
  }

  /* ------------------------------ 正脊 ------------------------------ */
  function addRidge(mb, cx, cz, xe, xr, yb, rise, o) {
    const RD = ridgeOf(o);
    const style = o.ridgeStyle || 'plain';
    if (style === 'none') return;
    const det = GF.detailLevel();
    const rh = style === 'ornate' ? 0.34 : 0.22;
    const rw = style === 'ornate' ? 0.36 : 0.26;
    const y = yb + rise;
    if (det >= 2) {
      // 三道线脚的正脊断面：脊座（出檐小挑）→ 脊筒（收分）→ 脊帽（出唇）
      mb.box(cx - xr - 0.14, cx + xr + 0.14, y - rh * 0.62, y - rh * 0.34, cz - (rw + 0.14) / 2, cz + (rw + 0.14) / 2, RD, o.tag + '·脊座');
      mb.taper(cx, cz, rw + 0.02, rw + 0.02, rw - 0.04, rw - 0.04, y - rh * 0.5, y + rh * 0.32, RD, o.tag + '·脊筒');
      mb.taper(cx, cz, rw - 0.02, rw - 0.02, rw + 0.06, rw + 0.06, y + rh * 0.3, y + rh * 0.52, RD, o.tag + '·脊帽');
      // 瓦条：脊筒上压两道细线，近看才有“叠瓦”的层次。
      // 上一条的顶面正好落在下一条的底面上（rh*0.06+0.022 恰好 = rh*0.16，严丝合缝），
      // 两条细线贴成一张同面孔，转视角时整条脊闪一道——下面那条压进上一条 5 mm。
      for (const dy of [0.06, 0.16]) {
        const y0 = y + rh * dy - (dy > 0.1 ? 0.005 : 0);
        mb.box(cx - xr - 0.02, cx + xr + 0.02, y0, y0 + 0.022, cz - rw / 2 - 0.014, cz + rw / 2 + 0.014, RD, o.tag + '·瓦条');
      }
    } else {
      mb.box(cx - xr - 0.1, cx + xr + 0.1, y - rh * 0.5, y + rh, cz - rw / 2, cz + rw / 2, RD, o.tag + '·正脊');
    }
    // 脊上线条（金/白）
    if (style === 'ornate') {
      mb.box(cx - xr - 0.06, cx + xr + 0.06, y + rh * 0.52, y + rh * 0.52 + 0.08, cz - rw * 0.28, cz + rw * 0.28, 'gold', o.tag + '·脊线');
    }
    // 两端鸱吻（吞口朝内、卷尾朝外挑）：四段叠出剪影，而不是两个方盒子
    const beastN = o.beasts || 0;
    for (const s of [-1, 1]) {
      const ex = cx + s * (xr + 0.1);
      const yo = y + rh * 0.34;
      mb.boxC(ex, cz, 0.4, 0.34, yo - 0.12, yo + 0.1, RD, o.tag + '·吻座');
      mb.taper(ex, cz, 0.3, 0.3, 0.24, 0.26, yo + 0.08, yo + 0.42, RD, o.tag + '·吻身');
      mb.boxC(ex - s * 0.03, cz, 0.26, 0.3, yo + 0.4, yo + 0.6, RD, o.tag + '·吻头');
      // 卷尾：向外上方挑出
      mb.taper(ex + s * 0.08, cz, 0.16, 0.2, 0.05, 0.08, yo + 0.58, yo + 0.86, RD, o.tag + '·吻尾');
      if (det >= 2) {
        // 剑把：吻背上的小金饰
        mb.boxC(ex + s * 0.02, cz, 0.06, 0.1, yo + 0.84, yo + 0.96, 'gold', o.tag + '·剑把');
      }
      if (style === 'ornate') {
        mb.boxC(ex, cz, 0.16, 0.16, yo + 0.72, yo + 0.86, 'gold', o.tag + '·吻金');
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
    const det = GF.detailLevel();
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
        // 檐角套兽：包住角梁头的兽面，微微向下颌
        const tip = pts[0];
        mb.taper(tip[0], tip[2], 0.24, 0.24, 0.15, 0.15, tip[1] + 0.12, tip[1] - 0.03, RD, o.tag + '·套兽');
        mb.boxC(tip[0], tip[2], 0.1, 0.16, tip[1] - 0.1, tip[1] + 0.02, RD, o.tag + '·套兽颌');

        // 走兽（仙人骑凤 + 若干蹲兽）：320 档才做，沿垂脊自檐角向脊端排
        if (det >= 3) {
          const nBeast = 5;
          const at = (t) => {
            const x = sx * V.lerp(xe, xr, t);
            const z = sz * V.lerp(ze, 0, t);
            const y = yb + rise * curve(t);
            return [cx + x, y, cz + z];
          };
          // 仙人骑凤：位置最靠檐角，形体最高
          const fi = at(0.03);
          mb.taper(fi[0], fi[2], 0.14, 0.16, 0.1, 0.12, fi[1] + 0.08, fi[1] + 0.34, RD, o.tag + '·仙人');
          mb.boxC(fi[0], fi[2], 0.12, 0.13, fi[1] + 0.32, fi[1] + 0.42, RD, o.tag + '·仙人首');
          for (let b = 0; b < nBeast; b++) {
            const t = 0.1 + b * 0.045;
            const p = at(t);
            mb.taper(p[0], p[2], 0.11, 0.13, 0.09, 0.1, p[1] + 0.06, p[1] + 0.24, RD, o.tag + '·走兽');
            mb.boxC(p[0], p[2], 0.1, 0.11, p[1] + 0.22, p[1] + 0.3, RD, o.tag + '·兽首');
          }
        }
      }
    }
  }

  /* ---------------------------- 檐口瓦当 ---------------------------- */
  function addEaveTiles(mb, pts, o) {
    const RD = ridgeOf(o);
    const TM = o.tileEnd || o.tile || RD;   // 瓦当/滴水用瓦色，别用脊色（脊色偏紫棕，檐口会读成一圈项链）
    const det = GF.detailLevel();
    // 瓦当间距跟着垄距走：320 px/m 时每垄一枚瓦当。
    // 按整条檐口的累积长度排布（不是按每一小段），否则檐口细分一加密就变成“一圈尖刺”。
    const pitch = det >= 3 ? 0.33 : det >= 2 ? 0.36 : 0.42;
    const rw = det >= 2 ? 0.075 : 0.085;
    let ccx = 0, ccz = 0;
    for (const p of pts) { ccx += p[0]; ccz += p[2]; }
    ccx /= pts.length; ccz /= pts.length;

    // 预计算每段长度与朝外法线
    const segs = [];
    let total = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const len = Math.hypot(b[0] - a[0], b[2] - a[2]);
      if (len < 1e-6) continue;
      const mx = (a[0] + b[0]) / 2, mz = (a[2] + b[2]) / 2;
      let nx = mx - ccx, nz = mz - ccz;
      const nl = Math.hypot(nx, nz) || 1;
      segs.push({ a, b, len, s0: total, nx: nx / nl, nz: nz / nl });
      total += len;
    }
    if (!segs.length) return;

    // 连檐 + 瓦口板：逐段贴合檐口（做薄一点，太粗会把整条檐口读成一圈木箍）
    for (const s of segs) {
      GF.beamBetween(mb, [s.a[0], s.a[1] - 0.08, s.a[2]], [s.b[0], s.b[1] - 0.08, s.b[2]], 0.08, 0.1, o.tileEnd || 'woodDark', o.tag + '·连檐');
      if (det >= 2 && o.woodEdge !== false) {
        GF.beamBetween(mb, [s.a[0] + s.nx * 0.03, s.a[1] - 0.15, s.a[2] + s.nz * 0.03],
          [s.b[0] + s.nx * 0.03, s.b[1] - 0.15, s.b[2] + s.nz * 0.03], 0.035, 0.06, 'wood', o.tag + '·瓦口');
      }
    }

    const at = (dist) => {
      let s = segs[segs.length - 1];
      for (const g of segs) { if (dist <= g.s0 + g.len) { s = g; break; } }
      const t = Math.min(1, (dist - s.s0) / s.len);
      return {
        x: s.a[0] + (s.b[0] - s.a[0]) * t, z: s.a[2] + (s.b[2] - s.a[2]) * t,
        y: s.a[1] + (s.b[1] - s.a[1]) * t, nx: s.nx, nz: s.nz
      };
    };

    const n = Math.max(1, Math.round(total / pitch));
    for (let k = 0; k < n; k++) {
      const p = at((k + 0.5) * total / n);
      // 瓦当：短圆柱 + 圆帽，从上方看是一枚圆鼓
      mb.cyl(p.x + p.nx * 0.015, p.z + p.nz * 0.015, rw, p.y - 0.06, p.y + 0.01, det >= 2 ? 10 : 8, TM, o.tag + '·瓦当');
      if (det >= 2) mb.lathe(p.x + p.nx * 0.015, p.z + p.nz * 0.015, [[0.001, 0], [rw * 0.9, 0.004], [rw, 0.016], [0.001, 0.026]], 8, TM, o.tag + '·瓦当心');
      // 滴水：瓦当之间一片舌尖瓦
      const q = at(k * total / n);
      mb.taper(q.x + q.nx * 0.035, q.z + q.nz * 0.035, 0.1, 0.1, 0.07, 0.07, q.y - 0.19, q.y - 0.07, TM, o.tag + '·滴水');
    }
  }

  /* ------------------------ 檐下木作：檐椽 / 飞椽 / 椽头 ------------------------ */
  // 320 档以前，檐口到柱头之间是空的：瓦面直接搭在斗栱上，从 30° 视角能看到瓦背，
  // 檐下像被削平了一样。这里沿檐口真排两排椽子，把这段填成木作：
  //   檐椽（圆断面）从檐檩侧斜下到檐口，椽头露在檐下一排；
  //   飞椽（方断面）压在檐椽外段、比檐椽多出 0.2 m，头上再压瓦口板。
  // outer/inner 是同一根椽在檐口与檐内的两个取样点（由各屋面自己的参数面取），
  // 这样举折、起翘、斜脊怎么变，椽子都贴着真瓦面走，不再另算一套角度。
  function rafterBand(mb, outer, inner, o, tag) {
    const det = GF.detailLevel();
    if (det < 2 || outer.length < 2) return;
    const fine = det >= 3;
    const gap = fine ? 0.30 : 0.34;        // 椽当（两椽中距）
    const rad = fine ? 0.055 : 0.072;      // 檐椽半径
    const sec = fine ? 0.075 : 0.095;      // 飞椽断面
    const dyA = fine ? 0.30 : 0.32;        // 檐椽中心距瓦面
    const dyB = fine ? 0.19 : 0.21;        // 飞椽中心距瓦面
    const headA = fine ? 0.30 : 0.26;      // 檐椽头比飞椽头缩进多少
    const tailA = fine ? 1.75 : 1.5;       // 檐椽长度
    const outB = fine ? 0.20 : 0.16;       // 飞椽出头
    const lenB = fine ? 0.85 : 0.7;        // 飞椽长度
    const matA = o.rafterMat || 'wood';
    const matB = o.rafterHeadMat || 'timber';   // 飞椽头刷朱：官式檐下一排红椽头，别用深木色（320 档会糊成一排黑牙）

    // 沿檐口累计弧长，按椽当均分（拐角处也不挤成一堆）
    const cum = [0];
    let total = 0;
    for (let i = 1; i < outer.length; i++) {
      total += Math.hypot(outer[i][0] - outer[i - 1][0], outer[i][2] - outer[i - 1][2]);
      cum.push(total);
    }
    if (total < 0.6) return;
    const n = Math.max(2, Math.round(total / gap));
    const pick = (dist) => {   // 由弧长反查两个取样点
      let i = 1;
      while (i < cum.length - 1 && cum[i] < dist) i++;
      const seg = cum[i] - cum[i - 1] || 1;
      const t = Math.max(0, Math.min(1, (dist - cum[i - 1]) / seg));
      const a = outer[i - 1], b = outer[i];
      const a2 = inner[i - 1], b2 = inner[i];
      return {
        p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
        q: [a2[0] + (b2[0] - a2[0]) * t, a2[1] + (b2[1] - a2[1]) * t, a2[2] + (b2[2] - a2[2]) * t]
      };
    };
    for (let k = 0; k < n; k++) {
      const { p, q } = pick((k + 0.5) * (total / n));
      let dx = q[0] - p[0], dy = q[1] - p[1], dz = q[2] - p[2];
      const dl = Math.hypot(dx, dy, dz);
      if (dl < 1e-3) continue;
      dx /= dl; dy /= dl; dz /= dl;
      const at = (d, drop) => [p[0] + dx * d, p[1] + dy * d - drop, p[2] + dz * d];
      // 檐椽：圆杆 + 端头（beamRound 自带端面，圆椽头就出来了）
      GF.beamRound(mb, at(headA, dyA), at(tailA, dyA), rad, fine ? 5 : 4, matA, tag + '·檐椽');
      // 飞椽：方料，压在檐椽外段，出头在瓦口下面；端面单独用暗木色，椽头才分得清
      GF.beamBetween(mb, at(-outB, dyB), at(-outB + 0.06, dyB), sec, sec, matB, tag + '·飞椽头');
      GF.beamBetween(mb, at(-outB + 0.06, dyB), at(lenB, dyB), sec, sec, matA, tag + '·飞椽');
    }
  }

  // 参数面版：把 uv 采样成两条折线交给 rafterBand
  function rafterBandUV(mb, fn, o, tag) {
    if (GF.detailLevel() < 2) return;
    const N = GF.detailLevel() >= 3 ? 72 : 40;
    const outer = [], inner = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      outer.push(fn(u, 0));
      inner.push(fn(u, 0.10));
    }
    rafterBand(mb, outer, inner, o, tag);
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

    // 檐下木作：四面各排一溜椽子，先把瓦面与斗栱之间垫实
    rafterBandUV(mb, slopeZ(1), o, o.tag + '·前檐椽');
    rafterBandUV(mb, slopeZ(-1), o, o.tag + '·后檐椽');
    rafterBandUV(mb, slopeX(1), o, o.tag + '·右檐椽');
    rafterBandUV(mb, slopeX(-1), o, o.tag + '·左檐椽');

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
    // 檐下木作（悬山两侧是山花，只有前后两坡排椽）
    rafterBandUV(mb, slope(1), o, o.tag + '·前檐椽');
    rafterBandUV(mb, slope(-1), o, o.tag + '·后檐椽');

    // 山面（三角山花）：悬山为木板，硬山为墙体。
    // 只铺一面——以前正反两片都铺，两片严格同面（四合院整片屋面 16 m²），斜视必然闪。
    // 山花 / 博风必须跟着“抬高后的瓦面边线”走：
    // 老版本按平标高 yb 画三角，檐角起翘 0.7 m 时屋面翘了、山花与博风还压在 yb 上，
    // 于是转角只剩瓦面一边起翘，山面/博风一侧是平的 —— 即“连接处只有一边翘”。
    const gableMat = o.gableMat || 'plaster';
    const GS = 6;
    for (const s of [-1, 1]) {
      const x = cx + s * xe;
      const u = s > 0 ? 1 : 0;
      const T = [x, yb + rise, cz];
      // 轮廓：前坡边线（檐 → 脊）→ 脊点 → 后坡边线（脊 → 檐）
      const outline = [];
      for (let k = 0; k < GS; k++) outline.push(slope(1)(u, k / GS));
      outline.push(T);
      for (let k = GS - 1; k >= 0; k--) outline.push(slope(-1)(u, k / GS));
      // 上片：以脊点为心向两侧边线做三角扇（边线是鼓的，不能把底角也算进扇心，否则面会自交）
      for (let i = 0; i < outline.length - 1; i++) {
        const p = outline[i], q = outline[i + 1];
        if (p === T || q === T) continue;
        mb.tri(p, q, T, gableMat, o.tag + '·山花');
      }
      // 下片：檐角起翘后，檐口(8.7)与墙顶(8.0)之间那条带宽 0.7 m，用一块矩形补齐，
      // 这样既不会在山面留缝，也不会为了补缝把山花做成自交的扇面
      const pA = outline[0], pB = outline[outline.length - 1];
      if (up > 0.02) {
        mb.quad(pA, pB, [x, yb, cz - ze], [x, yb, cz + ze], gableMat, o.tag + '·山花');
      }
      // 博风板：沿同一条边线串成短梁，起翘处自动一起抬
      if (up < 0.02) {
        GF.beamBetween(mb, [x, yb, cz - ze], T, 0.12, 0.2, 'wood', o.tag + '·博风');
        GF.beamBetween(mb, [x, yb, cz + ze], T, 0.12, 0.2, 'wood', o.tag + '·博风');
      } else {
        for (let i = 0; i < outline.length - 1; i++) {
          GF.beamBetween(mb, outline[i], outline[i + 1], 0.12, 0.2, 'wood', o.tag + '·博风');
        }
      }
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
    // 檐下木作：卷棚前后两坡各排一溜椽
    rafterBandUV(mb, slope(1), o, o.tag + '·前檐椽');
    rafterBandUV(mb, slope(-1), o, o.tag + '·后檐椽');

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
      const gp = [[x, yb + up, cz - ze]];
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
      gp.push([x, yb + up, cz + ze]);
      for (let i = 0; i < gp.length - 1; i++) {
        // 只铺一面：另一面（反绕向）与它严格同面，渲染器本来就不做背面剔除、法线朝相机翻正
        mb.tri(gp[i], gp[i + 1], T, gMat, o.tag + '·山花');
      }
      GF.beamBetween(mb, [x, yb + up, cz - ze], [x, yb + (yApex - yb) * 0.6 + up * 0.4, cz - rr], 0.12, 0.18, 'wood', o.tag + '·博风');
      GF.beamBetween(mb, [x, yb + up, cz + ze], [x, yb + (yApex - yb) * 0.6 + up * 0.4, cz + rr], 0.12, 0.18, 'wood', o.tag + '·博风');
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
    // 下檐檐下木作：四坡各排椽（上檐坐在收山线以内，檐下看不见，不排）
    rafterBandUV(mb, lowZ(1), o, o.tag + '·下檐前椽');
    rafterBandUV(mb, lowZ(-1), o, o.tag + '·下檐后椽');
    rafterBandUV(mb, lowX(1), o, o.tag + '·下檐右椽');
    rafterBandUV(mb, lowX(-1), o, o.tag + '·下檐左椽');

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
    const rings = GF.detail(2) ? 7 : 5;
    // 每边细分：按真实边长定垄数（原来按 2*xe/sides 估，六角亭只有 2 垄，
    // 2.4 cm 的小起伏拉成 1 m 一浪，整片屋面读成一块布）。
    const cA = [cx + Math.cos(o.rot || 0) * xe, cz + Math.sin(o.rot || 0) * ze];
    const cB = [cx + Math.cos((1 / sides) * Math.PI * 2 + (o.rot || 0)) * xe,
    cz + Math.sin((1 / sides) * Math.PI * 2 + (o.rot || 0)) * ze];
    const edgeLen = Math.max(Math.hypot(cB[0] - cA[0], cB[1] - cA[1]), 0.3);
    const tilesPerEdge = Math.max(2, Math.round(edgeLen / TILE_PITCH));
    const per = GF.detail(2)
      ? Math.max(4, Math.min(320, tilesPerEdge * 5))
      : Math.max(2, sides);

    // 由多边形底边向顶点收敛；u 为所在边的归一位置，用来只抬角、不抬整圈檐口
    const ringPts = (s, dy) => {
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
        // 瓦垄沿半径对齐（u 为常量），近檐满高、近脊收平
        out.push([px, yb + rise * curve(s) + up * cornerLift(u) * Math.pow(1 - s, 1.8) + ribOffset(u, tilesPerEdge) * (1 - 0.45 * s) + (dy || 0), pz]);
      }
      return out;
    };

    // 瓦面分“垄”与“筒”：沿坡向按一垄瓦的长度分皮，每皮之间起 1.2 cm 叠压唇口，
    // 唇口用暗瓦色画一条横线——屋面才有横向的瓦皮节奏，不再是一整块垂布。
    const slant = Math.hypot(rise, edgeLen / 2);
    const nC = GF.detail(2) ? Math.max(3, Math.min(26, Math.round(slant / 0.32))) : 4;
    const LIP = 0.012;
    const rows = [];
    const pushR = (pts, k) => rows.push({ p: pts, k });
    pushR(ringPts(0, 0), o.trim ? 'trim' : 'tile');
    if (o.trim) pushR(ringPts(0.16 / nC, 0), 'tile');   // 剪边只占最外一条窄边
    for (let j = 1; j < nC; j++) { pushR(ringPts(j / nC, 0), 'tile'); pushR(ringPts(j / nC, LIP), 'lip'); }
    pushR(ringPts(1, 0), 'tile');

    for (let j = 0; j < rows.length - 1; j++) {
      const cur = rows[j].k, nxt = rows[j + 1].k;
      const mat = nxt === 'lip' ? RD : cur === 'trim' ? o.trim : o.tile;
      for (let i = 0; i < rows[j].p.length - 1; i++) {
        mb.quad(rows[j].p[i], rows[j].p[i + 1], rows[j + 1].p[i + 1], rows[j + 1].p[i], mat, o.tag + (nxt === 'lip' ? '·瓦皮' : '·坡面'));
      }
    }
    // 檐口瓦当（沿起翘后的檐口折线走）
    addEaveTiles(mb, rows[0].p, o);
    // 檐下木作：攒尖是一圈连续檐口，椽子沿整圈排，方向取指向顶点的径向
    if (o.rafters !== false) rafterBand(mb, rows[0].p, ringPts(0.18, 0), o, o.tag + '·檐椽');

    // 垂脊（每条棱）：沿举折曲线折线连到宝顶，不再是角点到顶点的直线（凹曲屋面上会悬空）
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2 + (o.rot || 0);
      const steps = 6;
      let prev = null;
      for (let k = 0; k <= steps; k++) {
        const s = k / steps;
        const p = [
          cx + Math.cos(a) * Math.max(0.02, xe * (1 - s)),
          yb + rise * curve(s) + (k === 0 ? up : 0) + 0.03,
          cz + Math.sin(a) * Math.max(0.02, ze * (1 - s))
        ];
        if (prev) GF.beamBetween(mb, prev, p, 0.14, 0.12, RD, o.tag + '·垂脊');
        prev = p;
      }
      if (o.windDuo) addWindDuo(mb, cx + Math.cos(a) * xe, yb + up, cz + Math.sin(a) * ze, o.tag);
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
    // 檐面细分：原来每边固定 8 段（33 m 宽的重檐，一段就是 4 m），
    // 320 档下整圈是折线、也没有瓦垄。按边长定段数，再沿周长叠瓦垄起伏。
    const perX = GF.detail(2) ? Math.max(8, Math.min(320, Math.round(2 * xe / TILE_PITCH * 5))) : 8;
    const perZ = GF.detail(2) ? Math.max(8, Math.min(320, Math.round(2 * ze / TILE_PITCH * 5))) : 8;
    const tilesX = Math.max(2, Math.round(2 * xe / TILE_PITCH));
    const tilesZ = Math.max(2, Math.round(2 * ze / TILE_PITCH));

    const ring = (s, dy) => {
      const X = V.lerp(xe, xi, s), Z = V.lerp(ze, zi, s);
      const y = yb + (yTop - yb) * curve(s) + (dy || 0);
      const lift = up * Math.pow(1 - s, 1.6);
      const shrink = 1 - 0.3 * s;
      const out = [];
      // 顺时针走一圈：前 -> 右 -> 后 -> 左（u 沿边参数，瓦垄按边对齐）
      for (let i = 0; i <= perX; i++) { // 前檐 x: -X..X
        const t = i / perX;
        out.push([cx + (-X + 2 * X * t), y + lift * cornerLift(t) * 0.15 + ribOffset(t, tilesX) * shrink, cz + Z]);
      }
      for (let i = 1; i <= perZ; i++) { // 右檐 z: Z..-Z
        const t = i / perZ;
        out.push([cx + X, y + lift * cornerLift(t) * 0.15 + ribOffset(t, tilesZ) * shrink, cz + (Z - 2 * Z * t)]);
      }
      for (let i = 1; i <= perX; i++) { // 后檐 x: X..-X
        const t = i / perX;
        out.push([cx + (X - 2 * X * t), y + lift * cornerLift(t) * 0.15 + ribOffset(t, tilesX) * shrink, cz - Z]);
      }
      for (let i = 1; i <= perZ; i++) { // 左檐 z: -Z..Z
        const t = i / perZ;
        out.push([cx - X, y + lift * cornerLift(t) * 0.15 + ribOffset(t, tilesZ) * shrink, cz + (-Z + 2 * Z * t)]);
      }
      return out;
    };

    const slant = Math.hypot(yTop - yb, Math.max(xe - xi, ze - zi)) * 1.2;
    const nC = GF.detail(2) ? Math.max(3, Math.min(24, Math.round(slant / 0.32))) : 4;
    const LIPS = 0.012;
    const rows = [];
    const pushR = (pts, k) => rows.push({ p: pts, k });
    pushR(ring(0, 0), o.trim ? 'trim' : 'tile');
    if (o.trim) pushR(ring(0.16 / nC, 0), 'tile');
    for (let j = 1; j < nC; j++) { pushR(ring(j / nC, 0), 'tile'); pushR(ring(j / nC, LIPS), 'lip'); }
    pushR(ring(1, 0), 'tile');
    for (let j = 0; j < rows.length - 1; j++) {
      const cur = rows[j].k, nxt = rows[j + 1].k;
      const mat = nxt === 'lip' ? RD : cur === 'trim' ? o.trim : o.tile;
      const n = rows[j].p.length;
      for (let i = 0; i < n - 1; i++) {
        mb.quad(rows[j].p[i], rows[j].p[i + 1], rows[j + 1].p[i + 1], rows[j + 1].p[i], mat, o.tag + '·腰檐');
      }
    }
    // 檐口瓦当：整圈（原来只取前 9 个点，细分加密后等于只在正面铺了一小段）
    addEaveTiles(mb, rows[0].p, o);
    // 檐下木作：腰檐一圈四边坡，椽子沿整圈排（重檐下檐、塔檐下都靠这一圈填实）
    // 腰檐默认不排椽：腰檐下沿就是柱头，没有净空，排了也埋在檐里（要排得先把逐层斗栱抬高，见 README）
    if (o.rafters === true) rafterBand(mb, rows[0].p, ring(0.22), o, o.tag + '·檐椽');
    // 四条垂脊：沿举折曲线从外角走到内角，中段才贴住瓦面
    if (GF.detail(2)) {
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          let prev = null;
          for (let k = 0; k <= 5; k++) {
            const s = k / 5;
            const p = [
              cx + sx * V.lerp(xe, xi, s),
              yb + (yTop - yb) * curve(s) + (k === 0 ? up * 0.5 : 0) + 0.02,
              cz + sz * V.lerp(ze, zi, s)
            ];
            if (prev) GF.beamBetween(mb, prev, p, 0.13, 0.11, RD, o.tag + '·垂脊');
            prev = p;
          }
        }
      }
    }
    // 四角套兽
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        mb.boxC(cx + sx * xe, cz + sz * ze, 0.22, 0.22, yb - 0.12, yb + up + 0.16, RD, o.tag + '·套兽');
      }
    }
  }

  /* ------------------------------ 环形檐（塔檐 / 八角檐） ------------------------------ */
  // 塔檐原来只是两圈 8 段的 polyRing：8 个平面三角面拼成的“伞”，既没有瓦垄，
  // 也没有瓦皮叠压和瓦当。这里按边展开，跟攒尖、腰檐共用同一套垄—皮—瓦当。
  function coneRoof(mb, o) {
    const RD = ridgeOf(o);
    const cx = o.cx || 0, cz = o.cz || 0;
    const rOut = o.rOut, rIn = Math.max(0.05, o.rIn == null ? rOut * 0.6 : o.rIn);
    const sides = Math.max(4, o.sides || 8);
    const rot = o.rot || 0;
    const yb = o.yb, ytop = o.ytop == null ? yb + 0.8 : o.ytop;
    const edgeLen = 2 * rOut * Math.sin(Math.PI / sides);
    const tilesPerEdge = Math.max(2, Math.round(edgeLen / TILE_PITCH));
    const per = GF.detail(2) ? Math.max(4, Math.min(200, tilesPerEdge * 5)) : 2;
    const shrinkRib = (s) => 1 - 0.4 * s;

    const ringAt = (s, dy) => {
      const r = V.lerp(rOut, rIn, s);
      const y0 = yb + (ytop - yb) * curve(s) + (dy || 0);
      const out = [];
      const segs = sides * per;
      for (let i = 0; i <= segs; i++) {
        const k = Math.min(sides - 1, Math.floor(i / per));
        const u = i / per - k;
        const a = ((k + u) / sides) * Math.PI * 2 + rot;
        out.push([cx + Math.cos(a) * r, y0 + ribOffset(u, tilesPerEdge) * shrinkRib(s), cz + Math.sin(a) * r]);
      }
      return out;
    };

    const slant = Math.hypot(ytop - yb, rOut - rIn) * 1.15;
    const nC = GF.detail(2) ? Math.max(2, Math.min(14, Math.round(slant / 0.34))) : 2;
    const LIPC = 0.012;
    const rows = [];
    const pushR = (pts, k) => rows.push({ p: pts, k });
    pushR(ringAt(0, 0), o.trim ? 'trim' : 'tile');
    if (o.trim) pushR(ringAt(0.14 / nC, 0), 'tile');
    for (let j = 1; j < nC; j++) { pushR(ringAt(j / nC, 0), 'tile'); pushR(ringAt(j / nC, LIPC), 'lip'); }
    pushR(ringAt(1, 0), 'tile');

    for (let j = 0; j < rows.length - 1; j++) {
      const cur = rows[j].k, nxt = rows[j + 1].k;
      const mat = nxt === 'lip' ? RD : cur === 'trim' ? o.trim : o.tile;
      for (let i = 0; i < rows[j].p.length - 1; i++) {
        mb.quad(rows[j].p[i], rows[j].p[i + 1], rows[j + 1].p[i + 1], rows[j + 1].p[i], mat, o.tag + (nxt === 'lip' ? '·瓦皮' : '·檐面'));
      }
    }
    addEaveTiles(mb, rows[0].p, o);
    // 檐下木作：塔檐一圈八面，椽子沿整圈排，头一排露在八角檐下
    if (o.rafters === true) rafterBand(mb, rows[0].p, ringAt(0.28, 0), o, o.tag + '·檐椽');
    // 檐角起翘：贴着檐口外沿压一小段翘尖（原来是横在外面的方块，读成“须”）
    if (GF.detail(2) && o.cornerTip !== false) {
      for (let k = 0; k < sides; k++) {
        const a = (k / sides) * Math.PI * 2 + rot;
        const dir = [Math.cos(a), Math.sin(a)];
        const p0 = [cx + dir[0] * (rOut - 0.18), yb + 0.015, cz + dir[1] * (rOut - 0.18)];
        const p1 = [cx + dir[0] * (rOut + 0.04), yb + 0.07 + (o.upturn == null ? 0.3 : o.upturn) * 0.18, cz + dir[1] * (rOut + 0.04)];
        GF.beamBetween(mb, p0, p1, 0.13, 0.06, RD, o.tag + '·翘角');
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
        else if (type === 'cone') coneRoof(mb, oo);
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
    cone(mb, o) {
      const oo = withDefaults(o);
      TRIM = oo.trim || null;
      coneRoof(mb, oo);
      TRIM = null;
    },
    roll: rollRoof,
    lu: luRoof,
    cross: crossRoof
  };
})(typeof window !== 'undefined' ? window : globalThis);


