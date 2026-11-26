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
  const RIB5 = [-0.5, 0.55, 1, 0.55, -0.5];   // 垄沟由 −0.3 加深到 −0.5：RIB 0.024 时凹曲 12 mm（原 7 mm 在 320 档只够一条浅线）
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
        if (GF._dbgPatch && /下檐/.test(tag)) {
          const E = (p,q) => Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2]);
          if (Math.max(E(a,b),E(b,c),E(c,d),E(d,a),E(a,c),E(b,d)) > 0.5)
            console.error(`PATCH ${tag}: cx=${GF._dbgCX} cz=${GF._dbgCZ} xe=${GF._dbgXE} ze=${GF._dbgZE} nu=${nu} nv=${nv} per=${per} amp=${amp} TRIM=${TRIM} NU=${NU} i=${i} j=${j} vs=${vs[j].toFixed(3)},${vs[j+1].toFixed(3)} Eaxc=${E(a,c).toFixed(3)} quad=[${[a,b,c,d].map(p=>p.map(v2=>v2.toFixed(2)).join(',')).join(' | ')}]`);
        }
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


  /* 连续檐口带：把一串折线点做成一节完整的矩形断面带（上/下/外/内四张面，相邻段共用顶点）。
   * 原来连檐、瓦口、博风都是“逐段各一根梁”，相邻两段首尾端面严格同面，
   * 檐口细分一密就是几十对共面，320 档整条檐口与山面博风各闪一道。
   * dyC 断面中心相对折线的高差，w/h 断面宽高，ox 沿外法线的水平推移。 */
  function ribbon(mb, pts, dyC, w, h, mat, tag, ox) {
    const n = pts.length;
    if (n < 2) return;
    let cx = 0, cz = 0;
    for (const p of pts) { cx += p[0]; cz += p[2]; }
    cx /= n; cz /= n;
    ox = ox || 0;
    const LT = [], RT = [], LB = [], RB = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      const dx = b[0] - a[0], dz = b[2] - a[2];
      const nl = Math.hypot(dx, dz) || 1;
      let nx = dz / nl, nz = -dx / nl;
      if ((nx * (pts[i][0] - cx) + nz * (pts[i][2] - cz)) < 0) { nx = -nx; nz = -nz; }
      const yt = pts[i][1] + dyC + h / 2, yb = yt - h, hw = w / 2;
      LT.push([pts[i][0] + nx * (ox - hw), yt, pts[i][2] + nz * (ox - hw)]);
      RT.push([pts[i][0] + nx * (ox + hw), yt, pts[i][2] + nz * (ox + hw)]);
      LB.push([pts[i][0] + nx * (ox - hw), yb, pts[i][2] + nz * (ox - hw)]);
      RB.push([pts[i][0] + nx * (ox + hw), yb, pts[i][2] + nz * (ox + hw)]);
    }
    for (let i = 0; i < n - 1; i++) {
      mb.quad(LT[i], RT[i], RT[i + 1], LT[i + 1], mat, tag);
      mb.quad(LB[i], RB[i], RB[i + 1], LB[i + 1], mat, tag);
      mb.quad(RT[i], RB[i], RB[i + 1], RT[i + 1], mat, tag);
      mb.quad(LT[i], LB[i], LB[i + 1], LT[i + 1], mat, tag);
    }
    mb.quad(LT[0], LB[0], RB[0], RT[0], mat, tag);
    mb.quad(LT[n - 1], RT[n - 1], RB[n - 1], LB[n - 1], mat, tag);
  }

  function bands(width) {
    return GF.clamp(Math.round(width / 0.2), 8, 96);
  }

  // 檐口采样：沿 x 跨度按 0.22 m/段加密。老版固定 8/9 段，20 m 长厦下一段连檐就是 2.5 m
  // 整条（瓦当间距另在 addEaveTiles 里按累距排 pitch 0.33 m），像素风读成大长条。
  function eaveSamples(fn, span) {
    const nx = Math.max(2, Math.round(span / 0.22));
    const pts = [];
    for (let i = 0; i <= nx; i++) pts.push(fn(i / nx));
    return pts;
  }

  /* ------------------------------ 山花三角面（统一） ------------------------------ */
  // 悬山/硬山/卷棚/歇山上檐共用同一套路：
  // 沿前后坡边线采样成“横向行带”网格，行列均按 0.22 m 步距细分：
  //   行 = 同一档高度处前坡点→后坡点的横弦，每行再按实长 0.22 m 分格；
  //   相邻两行按 max(行格数) 缝合，网格行列边长全 ≤ ~0.31 m（含对角）。
  // 彻底取代老版“以脊顶为扇心的三角扇”：扇形的底边（前檐角→后檐角，
  // 门顶/长屋脊下可达 1.8 m）与扇心斜边（脊顶→檐角）都是大长边，
  // 像素风下会读成一个整块大三角。行带网格把整面切成 0.2 m 级小格，无大三角。
  // 卷棚（元宝脊）两坡顶不收敛到一点，顶线之上再叠一层圆弧顶行带；
  // 檐角起翘时补充檐口→墙顶的竖向条带（同网格密度），山面从墙顶一路闭合到屋檐。
  // 返回“檐→脊→檐”的轮廓折线，供博风板 ribbon 复用同一批顶点，不产生错缝。
  function gablePanel(mb, s) {
    const apex = s.apex, yFloor = s.yFloor;
    // 行数按斜坡弧长 0.22 m/行（与瓦面 bands 同密度，不再硬编码固定段数）
    const nv = GF.clamp(Math.round(s.edgeL / 0.22), 4, 48);
    const fpts = [], bpts = [];
    for (let k = 0; k <= nv; k++) {
      const v = k / nv;
      fpts.push(s.fwd(v));
      bpts.push(s.bwd(v));
    }
    const dist = (p, q) => Math.hypot(p[0]-q[0], p[1]-q[1], p[2]-q[2]);
    const rows = [];
    // 檐角起翘 → 檐口高于墙顶：先补竖向条带（逐段细分到墙顶，与横向网格同密度）。
    // 老版条带每条横跨整条底边（门顶下 1.8 m），也会读成大方框，这里整带入网格统一按 0.22 m 分格。
    const eA = fpts[0], eB = bpts[0];
    const lift = Math.min(eA[1], eB[1]) - yFloor;
    if (lift > 0.02) {
      // 竖向条带按 0.22 m/行 从墙顶(yFloor)细分到檐口高度，填补墙顶→起翘檐口的梯形区。
      // 顶部不推到檐口行本身：檐口行已由主网格的第 0 行（fpts[0]→bpts[0]）铺出，
      // 这里只铺到“差一格”，最后缝合到檐口行闭合，避免零高度折叠面。
      const bs = Math.max(Math.round(lift / 0.22), 1);
      for (let r = 0; r < bs; r++) {
        const y = yFloor + lift * (r / bs);
        rows.push([[eA[0], y, eA[2]], [eB[0], y, eB[2]]]);
      }
    }
    // 主体行带：前坡点→后坡点（v=0 檐口 → v=1 脊端/弧底）
    for (let k = 0; k <= nv; k++) rows.push([fpts[k], bpts[k]]);
    // 卷棚圆弧顶：fwd(1)/bwd(1) 是弧底两端、脊顶（apex）在弧心正上方，
    // 再叠一层半圆弧弦行带；弦按 0.22 m 分格，弧顶行退化为顶点走扇形收口。
    const fTop = fpts[nv], bTop = bpts[nv];
    const topGap = dist(fTop, bTop);
    const arcOutline = [];   // 博风板轮廓的弧上中间点（不含弧底两端，那两点已在 fpts/bpts 里）
    let capCX = 0, capCY = 0, capCZ = 0;
    if (topGap > 1e-6) {
      capCX = (fTop[0] + bTop[0]) / 2;
      capCY = (fTop[1] + bTop[1]) / 2;
      capCZ = (fTop[2] + bTop[2]) / 2;
      const na = GF.clamp(Math.round((Math.PI * topGap / 2) / 0.22), 2, 12);
      for (let a = 1; a <= na; a++) {
        const t = a / na;   // 0=弧底 → 1=脊顶
        const hw = topGap / 2 * Math.cos(t * Math.PI / 2);
        const y = capCY + (apex[1] - capCY) * Math.sin(t * Math.PI / 2);
        rows.push([[capCX, y, capCZ - hw], [capCX, y, capCZ + hw]]);
      }
      for (let a = 1; a < na; a++) {
        const th = Math.PI * (1 - a / na);
        arcOutline.push([capCX, capCY + (apex[1] - capCY) * Math.sin(th), capCZ + topGap / 2 * Math.cos(th)]);
      }
    }
    // 行带缝合：相邻两行按 max(行宽/0.22) 统一分格数（无 T 型缝、无 0.22 m 以上格边）；
    // 顶行退化为顶点时改扇形收口（最后一小行很窄，扇心斜边 ≤ ~0.31 m）。
    for (let r = 0; r < rows.length - 1; r++) {
      const A = rows[r], B = rows[r + 1];
      const lenA = dist(A[0], A[1]), lenB = dist(B[0], B[1]);
      const nA = GF.clamp(Math.round(lenA / 0.22), 1, 220);
      const nB = GF.clamp(Math.round(lenB / 0.22), 1, 220);
      if (lenB < 1e-6) {
        const pa = [];
        for (let i = 0; i <= nA; i++) {
          const t = i / nA;
          pa.push([A[0][0]+(A[1][0]-A[0][0])*t, A[0][1]+(A[1][1]-A[0][1])*t, A[0][2]+(A[1][2]-A[0][2])*t]);
        }
        for (let i = 0; i < nA; i++) mb.tri(pa[i], pa[i + 1], B[0], s.mat, s.tag);
      } else {
        // 相邻两行统一取 max(行格数) 缝合：每行重新按 0.22 m 采样（不共用上一行的点，
        // 两端点锚定），逐格出一个四边形，行列全 ≤0.22 m，无 T 型缝。
        const n = Math.max(nA, nB);
        const pa = [], pb = [];
        for (let i = 0; i <= n; i++) {
          const t = i / n;
          pa.push([A[0][0]+(A[1][0]-A[0][0])*t, A[0][1]+(A[1][1]-A[0][1])*t, A[0][2]+(A[1][2]-A[0][2])*t]);
          pb.push([B[0][0]+(B[1][0]-B[0][0])*t, B[0][1]+(B[1][1]-B[0][1])*t, B[0][2]+(B[1][2]-B[0][2])*t]);
        }
        for (let i = 0; i < n; i++) mb.quad(pa[i], pa[i + 1], pb[i + 1], pb[i], s.mat, s.tag);
      }
    }
    // 博风轮廓：前坡边线（檐→脊/弧底）→ 圆弧顶中间点 → 后坡边线（弧底/脊→檐）。
    // 首尾就是檐角点（y=yb+up），与山花网格共用同一批顶点，不产生错缝。
    // 卷棚时再附加弧上的中间点（arcOutline），端点 fTop/bTop 已含在 fpts/bpts 里。
    const outline = [];
    for (let k = 0; k < fpts.length; k++) outline.push(fpts[k]);
    if (topGap > 1e-6) for (let k = 0; k < arcOutline.length; k++) outline.push(arcOutline[k]);
    for (let k = bpts.length - 1; k >= 0; k--) outline.push(bpts[k]);
    return outline;
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
    // 全局细分步距：正脊沿 x 是整条长构件，门顶/长屋脊下 320 档会读成一条大方框。
    // 与院墙/隔墙/山花同密度（0.22m 一条）沿 x 切段；相邻段盒盖同高，错开 0~2mm 防共面闪烁。
    const RSP = 0.22, RMAX = 220;
    const rbox = (x0, x1, y0, y1, z0, z1, mat, tagLabel) => {
      const nx = Math.min(Math.max(1, Math.ceil((x1 - x0) / RSP)), RMAX);
      for (let k = 0; k < nx; k++) {
        const a = x0 + (x1 - x0) * k / nx, b = x0 + (x1 - x0) * (k + 1) / nx;
        mb.box(a, b, y0, y1, z0, z1, mat, tagLabel);
      }
    };
    if (det >= 2) {
      // 三道线脚的正脊断面：脊座（出檐小挑）→ 脊筒（收分）→ 脊帽（出唇）
      rbox(cx - xr - 0.14, cx + xr + 0.14, y - rh * 0.62, y - rh * 0.34, cz - (rw + 0.14) / 2, cz + (rw + 0.14) / 2, RD, o.tag + '·脊座');
      // 脊筒拆成三段收分：原来一整段只有上下两个断面，中段在 320 档看是一块平板。
      // 三段按 rh 的 0.50/0.44/0.32 分段，每段底比上段顶压进 4 mm，接缝处不会出现同尺寸盖面。
      mb.taper(cx, cz, rw + 0.020, rw + 0.020, rw + 0.002, rw + 0.002, y - rh * 0.500, y - rh * 0.060, RD, o.tag + '·脊筒下');
      mb.taper(cx, cz, rw + 0.002, rw + 0.002, rw - 0.018, rw - 0.018, y - rh * 0.064, y + rh * 0.140, RD, o.tag + '·脊筒中');
      mb.taper(cx, cz, rw - 0.018, rw - 0.018, rw - 0.040, rw - 0.040, y + rh * 0.136, y + rh * 0.324, RD, o.tag + '·脊筒上');
      mb.taper(cx, cz, rw - 0.02, rw - 0.02, rw + 0.06, rw + 0.06, y + rh * 0.3, y + rh * 0.52, RD, o.tag + '·脊帽');
      // 瓦条：脊筒上压两道细线，近看才有“叠瓦”的层次。
      // 上一条的顶面正好落在下一条的底面上（rh*0.06+0.022 恰好 = rh*0.16，严丝合缝），
      // 两条细线贴成一张同面孔，转视角时整条脊闪一道——下面那条压进上一条 5 mm。
      for (const dy of [0.06, 0.16]) {
        const y0 = y + rh * dy - (dy > 0.1 ? 0.005 : 0) + 0.003;   // 整体抬 3 mm：原来瓦条某一面正落在脊筒上的盖面高度上
        const wz = rw / 2 + (dy > 0.1 ? 0.006 : 0.010);   // 两道瓦条进深错开 4 mm：原来两者 cz 两侧面完全同面
        rbox(cx - xr - 0.02, cx + xr + 0.02, y0, y0 + 0.022, cz - wz, cz + wz, RD, o.tag + '·瓦条');
      }
    } else {
      rbox(cx - xr - 0.1, cx + xr + 0.1, y - rh * 0.5, y + rh, cz - rw / 2, cz + rw / 2, RD, o.tag + '·正脊');
    }
    // 脊上线条（金/白）
    if (style === 'ornate') {
      rbox(cx - xr - 0.06, cx + xr + 0.06, y + rh * 0.514, y + rh * 0.52 + 0.08, cz - rw * 0.28, cz + rw * 0.28, 'gold', o.tag + '·脊线');
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
    // 步数按脊长 0.22 m 动态计算，避免固定 5 段在长脊上产生 >0.55m 大段
    const ptsAlong = (sx, sz) => {
      const out = [];
      const rLen = Math.max(0.3, Math.hypot(xe - xr, ze, rise));
      const steps = Math.max(3, Math.round(rLen / 0.22));
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
          GF.beamBetween(mb, pts[i], pts[i + 1], 0.16, 0.12, RD, o.tag + '·垂脊', i === 0 ? 'both' : 'end');
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
      // 连檐整条改由下方 ribbon() 一次成型（逐段梁首尾端面同面，320 档整条檐口闪一道）
      if (det >= 2 && o.woodEdge !== false) {
        // 瓦口同样交给 ribbon()
      }
    }

    const eavePtsX = segs.map((q) => q.a).concat([segs[segs.length - 1].b]);
    ribbon(mb, eavePtsX, -0.090, -0.052, 0.1, o.tileEnd || 'woodDark', o.tag + '·连檐', 0);
    if (det >= 2 && o.woodEdge !== false) ribbon(mb, eavePtsX, -0.048, -0.016, 0.06, 'wood', o.tag + '·瓦口', -0.006);

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
      mb.cyl(p.x + p.nx * 0.016, p.z + p.nz * 0.016, rw, p.y - 0.050, p.y - 0.004, det >= 2 ? 10 : 8, TM, o.tag + '·瓦当');
      if (det >= 2) mb.lathe(p.x + p.nx * 0.016, p.z + p.nz * 0.016, [[0.001, p.y - 0.004], [rw * 0.9, p.y + 0.000], [rw * 0.012, p.y + 0.012], [0.001, p.y + 0.022]], 8, TM, o.tag + '·瓦当心');
      // 滴水：瓦当之间一片舌尖瓦
      const q = at(k * total / n);
      mb.taper(q.x + q.nx * 0.030, q.z + q.nz * 0.030, 0.1, 0.1, 0.07, 0.07, q.y - 0.180, q.y - 0.054, TM, o.tag + '·滴水');
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
      GF.beamBetween(mb, at(-outB + 0.056, dyB), at(lenB, dyB), sec - 0.004, sec - 0.004, matA, tag + '·飞椽');
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
    const up = o.upturn == null ? 0.35 : o.upturn;
    // 瓦面坡长（沿 v 坡向，含斜脊水平分量）：按 0.22 m/行细分，不再固定 6 行
    // （大屋面 rise 2m+、ze 2m+，六行每行就 0.6m 级，320 档读成整块大三角）。
    const nv = GF.clamp(Math.round(Math.hypot(rise, ze * Math.SQRT2) / 0.22), 4, 40);
    const nu = bands(xe * 2);

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
    const eavePtsF = eaveSamples((t) => [cx + (-xe + 2 * xe * t), yb + up * cornerLift(t), cz + ze], 2 * xe);
    addEaveTiles(mb, eavePtsF, o);
    const eaveB = eaveSamples((t) => [cx + (-xe + 2 * xe * t), yb + up * cornerLift(t), cz - ze], 2 * xe);
    addEaveTiles(mb, eaveB, o);

    addHipRidges(mb, cx, cz, xe, ze, xr, yb, rise, o);
    if (o.windDuo) windDuoAtCorners(mb, cx, cz, xe, ze, yb + up, o.tag);
    // 十字脊的横向顶不另立正脊，否则脊端会在交叉点堆成小塔
    if (!o.noRidge) addRidge(mb, cx, cz, xe, xr, yb, rise, o);
  }

  /* ------------------------------ 悬山/硬山顶 ------------------------------ */
  // 悬山：屋面两端挑出山墙，山面用山花板（墙料/木料）封闭，沿瓦面边线走博风板、梁头下挂悬鱼。
  // 硬山：屋面两端不挑出山墙，屋面沿 x 方向只出到墙体外皮（需传入 wallHW = W/2 + 墙厚/2），
  // 山墙直接顶到屋面封山，不出博风板、不挂悬鱼。
  function gableRoof(mb, o) {
    const { cx, cz, x0, x1, z0, z1, yb, rise } = o;
    const xe = (x1 - x0) / 2, ze = (z1 - z0) / 2;
    const up = o.upturn == null ? 0.3 : o.upturn;
    const hard = o.hard || o.type === 'gableHard';
    const xg = (hard && o.wallHW != null) ? Math.max(0.3, o.wallHW) : xe;
    // 坡长按 0.22 m/行细分（与瓦垄 bands / 山花同密度）
    const nv = GF.clamp(Math.round(Math.hypot(rise, ze) / 0.22), 4, 40);
    const nu = bands(xg * 2);

    const slope = (sign) => (u, v) => {
      const x = -xg + 2 * xg * u;
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
    const edgeL = Math.hypot(rise, ze);
    for (const s of [-1, 1]) {
      const x = cx + s * xg;
      const u = s > 0 ? 1 : 0;
      const T = [x, yb + rise, cz];
      // 统一轮廓：前坡边线（檐→脊）→ 脊点 → 后坡边线（脊→檐）。
      // 采样密度按轮廓弧长 0.22 m/段（与瓦面 bands 同密度），不再是固定 6 段。
      const outline = gablePanel(mb, {
        apex: T,
        yFloor: yb,
        edgeL,
        fwd: (v) => slope(1)(u, v),
        bwd: (v) => slope(-1)(u, v),
        mat: gableMat,
        tag: o.tag + '·山花'
      });
      // 博风板：悬山沿同一条边线串成短梁，起翘处自动一起抬；硬山封山不出博风
      if (!hard) {
        if (up < 0.02) {
          GF.beamBetween(mb, [x, yb, cz - ze], T, 0.12, 0.2, 'wood', o.tag + '·博风');
          GF.beamBetween(mb, [x, yb, cz + ze], T, 0.12, 0.2, 'wood', o.tag + '·博风');
        } else {
          ribbon(mb, outline, 0, 0.12, 0.2, 'wood', o.tag + '·博风', 0);   // 整条一次成型，不再逐段各一根梁
        }
      }
    }

    const eavePts = eaveSamples((t) => [cx + (-xg + 2 * xg * t), yb + up * cornerLift(t), cz + ze], 2 * xg);
    addEaveTiles(mb, eavePts, o);
    const eavePts2 = eaveSamples((t) => [cx + (-xg + 2 * xg * t), yb + up * cornerLift(t), cz - ze], 2 * xg);
    addEaveTiles(mb, eavePts2, o);

    if (o.xuanYu && !hard) {
      for (const s of [-1, 1]) addXuanYu(mb, cx + s * xg, cz, yb + rise, o.tag);
    }
    if (o.windDuo) windDuoAtCorners(mb, cx, cz, xg, ze, yb + up, o.tag);
    addRidge(mb, cx, cz, xg, xg, yb, rise, o);
  }

  /* ------------------------------ 卷棚顶 ------------------------------ */
  // 元宝脊：两坡相交处不做硬脊，代之以圆弧曲面（卷棚悬山/硬山/歇山均由此派生）
  function rollRoof(mb, o) {
    const { cx, cz, x0, x1, z0, z1, yb, rise } = o;
    const xe = (x1 - x0) / 2, ze = (z1 - z0) / 2;
    const up = o.upturn == null ? 0.3 : o.upturn;
    const hard = o.hard || o.type === 'gableHard';
    const xg = (hard && o.wallHW != null) ? Math.max(0.3, o.wallHW) : xe;
    const rr = Math.min(0.36, Math.max(0.18, rise * 0.4));
    const yApex = yb + rise - rr;
    // 坡长按 0.22 m/行细分（卷棚坡长略短：从檐口到弧底，去除圆弧顶的 rr）
    const nv = GF.clamp(Math.round(Math.hypot(rise - rr, ze - rr) / 0.22), 4, 40);

    const slope = (sign) => (u, v) => {
      const x = -xg + 2 * xg * u;
      const z = sign * (rr + (ze - rr) * (1 - v));
      const y = yb + (yApex - yb) * curve(v) + up * cornerLift(u) * Math.pow(1 - v, 1.6);
      return [cx + x, y, cz + z];
    };
    patch(mb, bands(xg * 2), nv, slope(1), o.tile, o.tileB, o.tag + '·前坡');
    patch(mb, bands(xg * 2), nv, slope(-1), o.tile, o.tileB, o.tag + '·后坡');
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
    const X = bands(xg * 2);
    for (let i = 0; i < X; i++) {
      const xa = cx - xg + (2 * xg * i) / X, xb = cx - xg + (2 * xg * (i + 1)) / X;
      for (let k = 0; k < arcSeg; k++) {
        const p = rowPts[k], q = rowPts[k + 1];
        mb.quad([xa, p[1], p[0]], [xb, p[1], p[0]], [xb, q[1], q[0]], [xa, q[1], q[0]],
          i % 2 === 0 ? o.tile : o.tileB, o.tag + '·元宝脊');
      }
    }
    if (o.ridgeStyle === 'ornate') {
      mb.box(cx - xg, cx + xg, yApex + rr - 0.03, yApex + rr + 0.03, cz - 0.08, cz + 0.08, 'gold', o.tag + '·罗锅脊');
    }

    // 山面（轮廓必须贴着卷棚的凹曲屋面，不能是一刀平的三角形）：
    // 悬山为木山花 + 博风 + 悬鱼；硬山为砖砌山墙，封山只到墙体外皮，不出博风/悬鱼
    const gMat = o.gableMat || (hard ? 'plaster' : 'wood');
    const edgeL = Math.hypot(yApex - yb + up, ze);
    for (const s of [-1, 1]) {
      const x = cx + s * xg;
      // 轮廓必须贴着卷棚的凹曲屋面：前坡边线（檐→弧顶）→ 凸脊顶点 → 后坡边线（弧顶→檐）。
      // 采样密度按轮廓弧长 0.22 m/段（与瓦面 bands 同密度），不再是固定 6 段。
      const outline = gablePanel(mb, {
        apex: [x, yApex + rr, cz],
        yFloor: yb,
        edgeL,
        fwd: (v) => [x, yb + (yApex - yb) * curve(v) + up * Math.pow(1 - v, 1.6), cz - (rr + (ze - rr) * (1 - v))],
        bwd: (v) => [x, yb + (yApex - yb) * curve(v) + up * Math.pow(1 - v, 1.6), cz + (rr + (ze - rr) * (1 - v))],
        mat: gMat,
        tag: o.tag + '·山花'
      });
      // outline 首尾就是檐角点（y=yb+up），不要再多造一套重复点（零面积三角的根源）。
      // 博风板沿整条山面轮廓走（原来两根短梁只到弧顶的半路，檐角一起翘就露空）；硬山封山不出博风
      if (!hard) {
        ribbon(mb, outline, 0, 0.12, 0.18, 'wood', o.tag + '·博风', 0);
        if (o.xuanYu) addXuanYu(mb, x, cz, yApex + rr - 0.05, o.tag);
      }
    }

    // 檐口瓦当
    for (const sz of [1, -1]) {
      addEaveTiles(mb, eaveSamples((t) => [cx + (-xg + 2 * xg * t), yb + up * cornerLift(t), cz + sz * ze], 2 * xg), o);
    }
    if (o.windDuo) windDuoAtCorners(mb, cx, cz, xg, ze, yb + up, o.tag);
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
    // 下檐坡长（外檐角到收山线）按 0.22 m/行细分，不再固定 4 行
    const nvLow = GF.clamp(Math.round(Math.hypot(y1 - yb, Math.hypot(xe - xi, ze - zi)) / 0.22), 4, 40);

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
    patch(mb, bands(xe * 2), nvLow, lowZ(1), o.tile, o.tileB, o.tag + '·下檐前');
    patch(mb, bands(xe * 2), nvLow, lowZ(-1), o.tile, o.tileB, o.tag + '·下檐后');
    patch(mb, bands(ze * 2), nvLow, lowX(1), o.tile, o.tileB, o.tag + '·下檐右');
    patch(mb, bands(ze * 2), nvLow, lowX(-1), o.tile, o.tileB, o.tag + '·下檐左');
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
    const nvTop = GF.clamp(Math.round(Math.hypot(yb + rise - y1, zi) / 0.22), 4, 40);
    patch(mb, bands(xi * 2), nvTop, slope(1), o.tile, o.tileB, o.tag + '·上檐前');
    patch(mb, bands(xi * 2), nvTop, slope(-1), o.tile, o.tileB, o.tag + '·上檐后');

    // 山花 + 博风板：贴着上檐瓦面的边线收口。
    // 老版本一刀平三角：山花/博风是直边，而上檐是凹曲举折（v^1.45），
    // 中段山花会从屋面里戳出来、博风悬在半空；改为沿举折边线采样成三角扇，
    // 博风沿同一条边线走，与悬山/卷棚同一套收口逻辑。
    // 采样密度按上檐斜边弧长 0.22 m/段（与瓦面 bands / 围墙同密度），不再是固定 6 段。
    const edgeL = Math.hypot(zi, yb + rise - y1);
    for (const s of [-1, 1]) {
      const x = cx + s * xi;
      if (!o.bare) {
        const u = s > 0 ? 1 : 0;
        // 山花底部坐在下檐瓦面上（y1），顶部在正脊（yb+rise）——歇山两坡向中间收，
        // 因此扇心取脊心；yFloor=y1 使 lift=0，不误补竖向条带
        const outline = gablePanel(mb, {
          apex: [x, yb + rise, cz],
          yFloor: y1,
          edgeL,
          fwd: (v) => slope(1)(u, v),
          bwd: (v) => slope(-1)(u, v),
          mat: 'wood',
          tag: o.tag + '·山花'
        });
        ribbon(mb, outline, 0, 0.12, 0.18, 'wood', o.tag + '·博风', 0);
      }
    }

    // 下檐檐口瓦当
    const eavePts = eaveSamples((t) => [cx + (-xe + 2 * xe * t), yb + up * cornerLift(t), cz + ze], 2 * xe);
    addEaveTiles(mb, eavePts, o);
    const e2 = eaveSamples((t) => [cx + (-xe + 2 * xe * t), yb + up * cornerLift(t), cz - ze], 2 * xe);
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
    // 低档没有瓦垄起伏，只按 0.22 m 定每边点数，杜绝长边大三角形
    // 角部起翘是幂 6 曲线，起翘集中在前 ~6% 边长内；固定档数时角点到邻点
    // 一段会有 0.45 m 垂直落差（连檐实测 0.51 m 斜边），须按角部第一段
    // 三维距离 ≤0.26 m 再加密每边点数，让起翘被连续细分吃掉。
    let perLow = Math.max(sides * 2, Math.round(edgeLen / 0.22));
    if (!GF.detail(2)) {
      for (; perLow <= 320; perLow++) {
        const hor = edgeLen / perLow;
        const liftDrop = up * (1 - Math.pow(1 - 2 / perLow, 6));
        if (Math.hypot(hor, liftDrop) <= 0.26) break;
      }
    }
    const per = GF.detail(2)
      ? Math.max(4, Math.min(320, tilesPerEdge * 5))
      : Math.max(2, Math.min(320, perLow));

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
    const nC = GF.detail(2) ? Math.max(3, Math.min(26, Math.round(slant / 0.32)))
      : Math.max(3, Math.min(32, Math.round(slant / 0.22)));
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
    // 檐口起翘 up 只抬角点，若 k=0 一次性加满、k=1 归零，第一段垂直落差 0.5 m 会出超长三角；
    // 起翘量沿前 ceil(up/0.22) 段线性衰减，每段落差 ≤0.22 m
    const hipN = Math.max(4, Math.round(Math.hypot(xe, ze, rise) / 0.22));
    const kup = Math.max(2, Math.ceil(up / 0.22));
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2 + (o.rot || 0);
      let prev = null;
      for (let k = 0; k <= hipN; k++) {
        const s = k / hipN;
        const p = [
          cx + Math.cos(a) * Math.max(0.02, xe * (1 - s)),
          yb + rise * curve(s) + up * Math.max(0, 1 - k / kup) + 0.03,
          cz + Math.sin(a) * Math.max(0.02, ze * (1 - s))
        ];
        if (prev) GF.beamBetween(mb, prev, p, 0.14, 0.12, RD, o.tag + '·垂脊', k === 1 ? 'both' : 'end');
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
    // 檐面细分：原来低档固定每边 8 段（33 m 宽的重檐，一段就是 4 m），
    // 320 档下整圈是折线、也没有瓦垄。按边长定段数，再沿周长叠瓦垄起伏。
    // 高档沿每股保留 5 点瓦垄断面；低档无瓦垄，也按 0.22 m/段加密，杜绝大框。
    const perX = GF.detail(2)
      ? Math.max(8, Math.min(320, Math.round(2 * xe / TILE_PITCH * 5)))
      : Math.max(8, Math.min(320, Math.round(2 * xe / 0.22)));
    const perZ = GF.detail(2)
      ? Math.max(8, Math.min(320, Math.round(2 * ze / TILE_PITCH * 5)))
      : Math.max(8, Math.min(320, Math.round(2 * ze / 0.22)));
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
    const nC = GF.detail(2)
      ? Math.max(3, Math.min(24, Math.round(slant / 0.32)))
      : Math.max(3, Math.min(24, Math.round(slant / 0.22)));
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
      const hipN = Math.max(3, Math.round(Math.hypot(xe - xi, ze - zi, yTop - yb) / 0.22));
      const kup2 = Math.max(2, Math.ceil(up * 0.5 / 0.22));
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          let prev = null;
          for (let k = 0; k <= hipN; k++) {
            const s = k / hipN;
            const p = [
              cx + sx * V.lerp(xe, xi, s),
              yb + (yTop - yb) * curve(s) + up * 0.5 * Math.max(0, 1 - k / kup2) + 0.02,
              cz + sz * V.lerp(ze, zi, s)
            ];
            if (prev) GF.beamBetween(mb, prev, p, 0.13, 0.11, RD, o.tag + '·垂脊', k === 1 ? 'both' : 'end');
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
    // 低档没有瓦垄起伏，只按 0.22 m 定每边点数，杜绝长边大三角形
    const perLowC = Math.max(sides, Math.round(edgeLen / 0.22));
    const per = GF.detail(2)
      ? Math.max(4, Math.min(200, tilesPerEdge * 5))
      : Math.max(4, Math.min(200, perLowC));
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
    const nC = GF.detail(2) ? Math.max(2, Math.min(14, Math.round(slant / 0.34)))
      : Math.max(2, Math.min(20, Math.round(slant / 0.22)));
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
      // LOD plain：后进 / 跨院 / 廊顶省瓦垄起伏（纯增量开关，默认关闭）
      // 注：不再对 bands 减半——0.22m 分段本就满足边长标准，减半会造出 >0.55m 大三角
      const savedRib = RIB;
      if (oo.plain) {
        RIB = 0;
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