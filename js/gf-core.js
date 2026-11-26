/* ============================================================================
 * 国风古建像素工坊 · 核心
 * 向量工具 / 随机数 / 三角网格构建 / 材质调色板
 * 纯 JS，无依赖，浏览器与 Node 均可运行。
 * ==========================================================================*/
(function (global) {
  'use strict';
  const GF = (global.GF = global.GF || {});

  /* ------------------------------ 向量 ------------------------------ */
  const V = (GF.V = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
    cross: (a, b) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0]
    ],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    len: (a) => Math.hypot(a[0], a[1], a[2]),
    norm: (a) => {
      const l = Math.hypot(a[0], a[1], a[2]) || 1;
      return [a[0] / l, a[1] / l, a[2] / l];
    },
    lerp: (a, b, t) => a + (b - a) * t,
    mix: (a, b, t) => [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t
    ]
  });

  GF.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  /* ------------------------- 精度档（按出图密度自动切换） -------------------------
   * 0 草档（ppm<48）：只留大形，构件用最省面的写法
   * 1 中档（48~119）：瓦垄起棱、须弥座线脚、槅扇棂条
   * 2 细档（120~239）：瓦垄圆弧、棂条加密、斗拱铺作、望柱头、走兽
   * 3 精档（≥240，含 320）：瓦当滴水逐垄、石缝、门钉九路、细部全开
   * 320 px/m 下一毫米约 0.32 像素，0.03 m 的瓦垄棱即是 10 px，
   * 所以 2 档以上必须真做几何，不能靠色带。
   * ------------------------------------------------------------------------- */
  let _detail = 1;
  GF.detailFor = (ppm) => (ppm >= 240 ? 3 : ppm >= 120 ? 2 : ppm >= 48 ? 1 : 0);
  GF.setDetail = (v) => { _detail = Math.max(0, Math.min(3, v | 0)); };
  GF.detail = (n) => _detail >= n;
  GF.detailLevel = () => _detail;

  GF.lerp = V.lerp;
  GF.smoothstep = (t) => {
    t = GF.clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
  };

  /* --------------------------- 可复现随机数 --------------------------- */
  GF.hashStr = function (str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  };

  GF.RNG = class RNG {
    constructor(seed) {
      this.seed = (typeof seed === 'string' ? GF.hashStr(seed) : seed | 0 || 20261123) >>> 0;
      this.s = this.seed;
    }
    next() {
      // mulberry32
      this.s = (this.s + 0x6d2b79f5) >>> 0;
      let t = this.s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    range(a, b) {
      return a + (b - a) * this.next();
    }
    int(a, b) {
      return Math.floor(this.range(a, b + 1));
    }
    pick(arr) {
      return arr[Math.floor(this.next() * arr.length) % arr.length];
    }
    chance(p) {
      return this.next() < p;
    }
  };

  /* ------------------------------ 网格 ------------------------------ */
  // 三角面片汤：位置、法线、材质名、构件标签，另外记录每个面的世界中心（用于地面阴影采样）
  GF.Mesh = class Mesh {
    constructor() {
      this.pos = [];
      this.nrm = [];
      this.mat = [];
      this.tag = [];
      this.wx = [];
      this.wz = [];
    }
    get triCount() {
      return this.mat.length;
    }
    tri(a, b, c, mat, tag, nrm) {
      const n = nrm || V.norm(V.cross(V.sub(b, a), V.sub(c, a)));
      this.pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
      this.nrm.push(n[0], n[1], n[2]);
      this.mat.push(mat);
      this.tag.push(tag || mat);
      this.wx.push((a[0] + b[0] + c[0]) / 3);
      this.wz.push((a[2] + b[2] + c[2]) / 3);
    }
    quad(a, b, c, d, mat, tag) {
      // 同一四边形共用一条法线，避免两个三角面明暗不一致产生的斜向锯齿
      const n = V.norm(V.cross(V.sub(b, a), V.sub(d, a)));
      this.tri(a, b, c, mat, tag, n);
      this.tri(a, c, d, mat, tag, n);
    }
    /** 长方体：六面。任一边长超过 0.22 m 时按 0.22 m 步距自适应细分，杜绝大门板/大方框面上
     *  出现 >0.55 m 的超长三角。细分只在内部加网格顶点，边界坐标不变，不影响相邻构件的贴合。 */
    box(x0, x1, y0, y1, z0, z1, mat, tag) {
      if (x0 === x1 || y0 === y1 || z0 === z1) return;
      const STEP = 0.22;
      // 各轴分段（足 0.22m 才分，小件保持单面不增面数）
      const nx = Math.max(1, Math.ceil((x1 - x0) / STEP));
      const ny = Math.max(1, Math.ceil((y1 - y0) / STEP));
      const nz = Math.max(1, Math.ceil((z1 - z0) / STEP));
      const xs = [], ys = [], zs = [];
      for (let i = 0; i <= nx; i++) xs.push(x0 + (x1 - x0) * i / nx);
      for (let i = 0; i <= ny; i++) ys.push(y0 + (y1 - y0) * i / ny);
      for (let i = 0; i <= nz; i++) zs.push(z0 + (z1 - z0) * i / nz);
      // 前 (+z)
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++)
        this.quad([xs[i], ys[j], z1], [xs[i + 1], ys[j], z1], [xs[i + 1], ys[j + 1], z1], [xs[i], ys[j + 1], z1], mat, tag);
      // 后 (-z)
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++)
        this.quad([xs[i + 1], ys[j], z0], [xs[i], ys[j], z0], [xs[i], ys[j + 1], z0], [xs[i + 1], ys[j + 1], z0], mat, tag);
      // 左 (-x)
      for (let i = 0; i < ny; i++) for (let j = 0; j < nz; j++)
        this.quad([x0, ys[i], zs[j]], [x0, ys[i], zs[j + 1]], [x0, ys[i + 1], zs[j + 1]], [x0, ys[i + 1], zs[j]], mat, tag);
      // 右 (+x)
      for (let i = 0; i < ny; i++) for (let j = 0; j < nz; j++)
        this.quad([x1, ys[i], zs[j + 1]], [x1, ys[i], zs[j]], [x1, ys[i + 1], zs[j]], [x1, ys[i + 1], zs[j + 1]], mat, tag);
      // 顶 (+y)
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++)
        this.quad([xs[i], y1, zs[j]], [xs[i], y1, zs[j + 1]], [xs[i + 1], y1, zs[j + 1]], [xs[i + 1], y1, zs[j]], mat, tag);
      // 底 (-y)
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++)
        this.quad([xs[i], y0, zs[j + 1]], [xs[i], y0, zs[j]], [xs[i + 1], y0, zs[j]], [xs[i + 1], y0, zs[j + 1]], mat, tag);
    }
    /** 以中心定位的长方体 */
    boxC(cx, cz, w, d, y0, y1, mat, tag) {
      this.box(cx - w / 2, cx + w / 2, y0, y1, cz - d / 2, cz + d / 2, mat, tag);
    }
    /** 以中心定位的四棱台：上下截面不同（斗、柱础、收分构件用） */
    taper(cx, cz, w0, d0, w1, d1, y0, y1, mat, tag) {
      if (y0 === y1) return;
      // 上下截面完全一致时退化为长方体，走 box 的细分路径
      if (w0 === w1 && d0 === d1 && w0 > 0 && d0 > 0) {
        this.box(cx - w0 / 2, cx + w0 / 2, y0, y1, cz - d0 / 2, cz + d0 / 2, mat, tag);
        return;
      }
      const STEP = 0.22;
      const ring = (w, d, y) => ([
        [cx - w / 2, y, cz - d / 2], [cx + w / 2, y, cz - d / 2],
        [cx + w / 2, y, cz + d / 2], [cx - w / 2, y, cz + d / 2],
      ]);
      const s = ring(w0, d0, y0), t = ring(w1, d1, y1);
      // 四面侧板：环向 + 竖向双线性细分，杜绝几米长的斜侧板大三角（阶条/垂带）
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        const span = Math.max(
          Math.hypot(s[j][0] - s[i][0], s[j][2] - s[i][2]),
          Math.hypot(t[j][0] - t[i][0], t[j][2] - t[i][2])
        );
        const n = Math.max(1, Math.ceil(span / STEP));
        const ny = Math.max(1, Math.ceil((y1 - y0) / STEP));
        const ptsB = [], ptsT = [];
        for (let v = 0; v <= n; v++) {
          const e = v / n;
          ptsB.push([s[i][0] + (s[j][0] - s[i][0]) * e, s[i][1], s[i][2] + (s[j][2] - s[i][2]) * e]);
          ptsT.push([t[i][0] + (t[j][0] - t[i][0]) * e, t[i][1], t[i][2] + (t[j][2] - t[i][2]) * e]);
        }
        for (let v = 0; v < n; v++) {
          for (let w = 0; w < ny; w++) {
            const f0 = w / ny, f1 = (w + 1) / ny;
            const pt = (v2, f) => [
              ptsB[v2][0] * (1 - f) + ptsT[v2][0] * f,
              y0 + (y1 - y0) * f,
              ptsB[v2][2] * (1 - f) + ptsT[v2][2] * f
            ];
            this.quad(pt(v, f0), pt(v + 1, f0), pt(v + 1, f1), pt(v, f1), mat, tag);
          }
        }
      }
      // 底面 / 顶面网格细分（大截面时避免整块大方框）
      const cap = (w, d, y, flip) => {
        if (w <= 0 || d <= 0) return;
        const nx = Math.max(1, Math.ceil(w / STEP));
        const nz = Math.max(1, Math.ceil(d / STEP));
        const x0 = cx - w / 2, z0 = cz - d / 2;
        for (let i = 0; i < nx; i++) {
          for (let k = 0; k < nz; k++) {
            const xa = x0 + w * i / nx, xb = x0 + w * (i + 1) / nx;
            const za = z0 + d * k / nz, zb = z0 + d * (k + 1) / nz;
            if (flip) this.quad([xa, y, zb], [xb, y, zb], [xb, y, za], [xa, y, za], mat, tag);
            else this.quad([xa, y, za], [xb, y, za], [xb, y, zb], [xa, y, zb], mat, tag);
          }
        }
      };
      cap(w0, d0, y0, true); // 底 (-y)
      cap(w1, d1, y1, false); // 顶 (+y)
    }
    /** 竖向圆柱（多边形棱柱）。noCap=true 时不出顶底扇面：
     *  檐柱顶上被额枋/斗栱盖住、底上埋进柱础，这两片扇面平时看不见，
     *  但只要柱子贴着墙面（柱皮与墙皮只差 1~2 cm），扇面就会从墙缝里露出一角，
     *  在屏幕上就是柱身上那几块“红色半圆/钩子”——斜视转视角还会抖。 */
    cyl(cx, cz, r, y0, y1, n, mat, tag, rot, noCap) {
      const a0 = rot || 0;
      const pts = [];
      for (let i = 0; i < n; i++) {
        const a = a0 + (i / n) * Math.PI * 2;
        pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
      }
      // 高度方向按 0.22 m 细分，杜绝 3 m 高圆柱一侧是整条长矩形（对角超 0.55 m）
      const SPLIT = 0.22;
      const ny = Math.max(1, Math.ceil((y1 - y0) / SPLIT));
      for (let i = 0; i < n; i++) {
        const p = pts[i], q = pts[(i + 1) % n];
        for (let k = 0; k < ny; k++) {
          const ya = y0 + ((y1 - y0) * k) / ny, yb = y0 + ((y1 - y0) * (k + 1)) / ny;
          this.quad(
            [p[0], ya, p[1]],
            [q[0], ya, q[1]],
            [q[0], yb, q[1]],
            [p[0], yb, p[1]],
            mat, tag
          );
        }
      }
      if (noCap) return;
      const top = [cx, y1, cz], bot = [cx, y0, cz];
      for (let i = 0; i < n; i++) {
        const p = pts[i], q = pts[(i + 1) % n];
        this.tri(top, [q[0], y1, q[1]], [p[0], y1, p[1]], mat, tag); // 顶 (+y)
        this.tri(bot, [p[0], y0, p[1]], [q[0], y0, q[1]], mat, tag); // 底 (-y)
      }
    }
    /** XZ 平面多边形竖直拉伸（用于八边形塔身、拱门轮廓、月洞等） */
    prism(points, y0, y1, mat, tag) {
      const n = points.length;
      const STEP = 0.22;
      const ny = Math.max(1, Math.ceil((y1 - y0) / STEP));
      let cx = 0, cz = 0;
      for (const p of points) { cx += p[0]; cz += p[1]; }
      cx /= n; cz /= n;
      const triFan = (cy, flip) => {
        // 每边沿边细分 ns 段，同时从中心沿半径再细分 nr 层。
        // 环带从外圈向内圈逐环铺 quad（外环 k=0 在最外沿），最内环收成中心三角；
        // 绝不能反过来在最内先铺一个大三角——那会把中心到外层整片的面积盖住，
        // 与内层环带共面重叠（斜视转视角花边抖动），nr=1 时还会退化成 (center,center,p)。
        for (let i = 0; i < n; i++) {
          const p = points[i], q = points[(i + 1) % n];
          const span = Math.hypot(q[0] - p[0], q[1] - p[1]);
          const ns = Math.max(1, Math.ceil(span / STEP));
          const radMax = Math.max(Math.hypot(p[0] - cx, p[1] - cz), Math.hypot(q[0] - cx, q[1] - cz));
          const nr = Math.max(1, Math.ceil(radMax / STEP));
          // 环向采样 C+(1-f)*(p-C)：f=0 在外沿、f=1 收心，沿边线性过渡
          for (let u = 0; u < ns; u++) {
            const e0 = u / ns, e1 = (u + 1) / ns;
            const ax = p[0] + (q[0] - p[0]) * e0, az = p[1] + (q[1] - p[1]) * e0;
            const bx = p[0] + (q[0] - p[0]) * e1, bz = p[1] + (q[1] - p[1]) * e1;
            const pt = (X, Z, f) => [cx + (X - cx) * (1 - f), cy, cz + (Z - cz) * (1 - f)];
            for (let k = 0; k < nr; k++) {
              const f0 = k / nr, f1 = (k + 1) / nr;
              const pax = pt(ax, az, f0), pbx = pt(bx, bz, f0); // 本环外沿两点
              if (k === nr - 1) {
                // 最内环：内沿收成中心点，直接铺三角（避免中心退化）
                const c0 = [cx, cy, cz];
                if (flip) this.tri(pax, pbx, c0, mat, tag);
                else this.tri(c0, pbx, pax, mat, tag);
              } else {
                const qax = pt(ax, az, f1), qbx = pt(bx, bz, f1); // 本环内沿两点
                if (flip) this.quad(pax, pbx, qbx, qax, mat, tag);
                else this.quad(qax, qbx, pbx, pax, mat, tag);
              }
            }
          }
        }
      };
      for (let i = 0; i < n; i++) {
        const p = points[i], q = points[(i + 1) % n];
        const span = Math.hypot(q[0] - p[0], q[1] - p[1]);
        const ns = Math.max(1, Math.ceil(span / STEP));
        // 侧面：每边的 XZ 段 × 竖直段双细分
        for (let u = 0; u < ns; u++) {
          const e0 = u / ns, e1 = (u + 1) / ns;
          const ax = p[0] + (q[0] - p[0]) * e0, az = p[1] + (q[1] - p[1]) * e0;
          const bx = p[0] + (q[0] - p[0]) * e1, bz = p[1] + (q[1] - p[1]) * e1;
          for (let v = 0; v < ny; v++) {
            const f0 = y0 + (y1 - y0) * v / ny, f1 = y0 + (y1 - y0) * (v + 1) / ny;
            this.quad([ax, f0, az], [bx, f0, bz], [bx, f1, bz], [ax, f1, az], mat, tag);
          }
        }
      }
      // 顶底扇面：每种朝向只铺一次（见下注释）。这里用 triFan 网格细分，
      // 既躲开「中心大扇面」的超长边，也保持仅有单面朝向、不产生共面闪烁。
      triFan(y1, false);
      triFan(y0, true);
    }
    /** 旋转体：profile 为 [半径, 高度] 序列，自下而上 */
    lathe(cx, cz, profile, n, mat, tag) {
      const STEP = 0.22;
      for (let i = 0; i < profile.length - 1; i++) {
        const [r0, y0] = profile[i];
        const [r1, y1] = profile[i + 1];
        if (r0 <= 0 && r1 <= 0) continue;
        // 每段高度按 0.22 m 竖向细分，环向每边按弧长细分
        const ny = Math.max(1, Math.ceil((y1 - y0) / STEP));
        const arc = Math.max(r0, r1) * Math.PI * 2 / n; // 最大弧长
        const ns = Math.max(1, Math.ceil(arc / STEP));
        for (let seg = 0; seg < ny; seg++) {
          const yA = y0 + (y1 - y0) * seg / ny, yB2 = y0 + (y1 - y0) * (seg + 1) / ny;
          const a_r = r0 + (r1 - r0) * seg / ny, b_r = r0 + (r1 - r0) * (seg + 1) / ny;
          for (let k = 0; k < n * ns; k++) {
            const a = (k / (n * ns)) * Math.PI * 2, b = ((k + 1) / (n * ns)) * Math.PI * 2;
            this.quad(
              [cx + Math.cos(a) * a_r, yA, cz + Math.sin(a) * a_r],
              [cx + Math.cos(b) * a_r, yA, cz + Math.sin(b) * a_r],
              [cx + Math.cos(b) * b_r, yB2, cz + Math.sin(b) * b_r],
              [cx + Math.cos(a) * b_r, yB2, cz + Math.sin(a) * b_r],
              mat, tag
            );
          }
        }
      }
    }
    /** 竖直双面片（旗幡、门神、匾面） */
    panel(x0, x1, y0, y1, z, mat, tag) {
      const STEP = 0.22;
      const nx = Math.max(1, Math.ceil((x1 - x0) / STEP));
      const ny = Math.max(1, Math.ceil((y1 - y0) / STEP));
      for (let i = 0; i < nx; i++) {
        for (let j = 0; j < ny; j++) {
          const xa = x0 + (x1 - x0) * i / nx, xb = x0 + (x1 - x0) * (i + 1) / nx;
          const ya = y0 + (y1 - y0) * j / ny, yb = y0 + (y1 - y0) * (j + 1) / ny;
          this.quad([xa, ya, z], [xb, ya, z], [xb, yb, z], [xa, yb, z], mat, tag);
        }
      }
    }
    /** 合并另一个网格。key 非空时，把这一块三角形在合入结果里的起止区间记进 _mo 表，
     *  拖动时只平移区间内的顶点就能实现「单件移动」，无需整网重建。 */
    merge(other, key) {
      const t0 = this.mat.length;
      for (let i = 0; i < other.triCount; i++) {
        const o = i * 9;
        this.pos.push(
          other.pos[o], other.pos[o + 1], other.pos[o + 2],
          other.pos[o + 3], other.pos[o + 4], other.pos[o + 5],
          other.pos[o + 6], other.pos[o + 7], other.pos[o + 8]
        );
        this.nrm.push(other.nrm[i * 3], other.nrm[i * 3 + 1], other.nrm[i * 3 + 2]);
        this.mat.push(other.mat[i]);
        this.tag.push(other.tag[i]);
        this.wx.push(other.wx[i]);
        this.wz.push(other.wz[i]);
      }
      // 子网格自身的可拖区间整体平移偏移量后并入
      if (other._mo) {
        this._mo = this._mo || {};
        for (const k in other._mo) {
          const r = other._mo[k];
          this._mo[k] = [t0 + r[0], t0 + r[1]];
        }
      }
      if (key != null) {
        this._mo = this._mo || {};
        this._mo[key] = [t0, this.mat.length];
      }
      return this;
    }
    /** 只平移三角面区间 [t0, t1) 的顶点与世界中心（不动法线），用于拖动时单件落位 */
    moveRange(t0, t1, dx, dz) {
      if (dx === 0 && dz === 0) return 1;
      if (t0 == null || t1 == null || t1 <= t0) return 0;
      const pos = this.pos, wx = this.wx, wz = this.wz;
      for (let t = t0; t < t1; t++) {
        const o = t * 9;
        pos[o] += dx; pos[o + 2] += dz;
        pos[o + 3] += dx; pos[o + 5] += dz;
        pos[o + 6] += dx; pos[o + 8] += dz;
        wx[t] += dx; wz[t] += dz;
      }
      return 1;
    }
    /** 平移 */
    translate(dx, dy, dz) {
      for (let i = 0; i < this.pos.length; i += 3) {
        this.pos[i] += dx; this.pos[i + 1] += dy; this.pos[i + 2] += dz;
      }
      for (let i = 0; i < this.wx.length; i++) { this.wx[i] += dx; this.wz[i] += dz; }
      return this;
    }
    /** 等比缩放（城市落位时把外来配方缩到地块里；法线方向不变） */
    scale(s) {
      if (!isFinite(s) || Math.abs(s) < 1e-6 || s === 1) return this;
      for (let i = 0; i < this.pos.length; i++) this.pos[i] *= s;
      for (let i = 0; i < this.wx.length; i++) { this.wx[i] *= s; this.wz[i] *= s; }
      return this;
    }
    /** 绕 Y 轴旋转（以 (cx,cz) 为中心） */
    rotateY(deg, cx, cz) {
      const a = (deg * Math.PI) / 180;
      const ca = Math.cos(a), sa = Math.sin(a);
      cx = cx || 0; cz = cz || 0;
      const buf = [this.pos, this.nrm];
      for (const arr of buf) {
        const isN = arr === this.nrm;
        for (let i = 0; i < arr.length; i += 3) {
          const x = arr[i] - (isN ? 0 : cx), z = arr[i + 2] - (isN ? 0 : cz);
          arr[i] = x * ca + z * sa + (isN ? 0 : cx);
          arr[i + 2] = -x * sa + z * ca + (isN ? 0 : cz);
        }
      }
      for (let i = 0; i < this.wx.length; i++) {
        const x = this.wx[i] - cx, z = this.wz[i] - cz;
        this.wx[i] = x * ca + z * sa + cx;
        this.wz[i] = -x * sa + z * ca + cz;
      }
      return this;
    }
    bounds(skipTag) {
      const b = { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9, z0: 1e9, z1: -1e9 };
      for (let t = 0, i = 0; i < this.pos.length; t++, i += 9) {
        if (skipTag && this.tag[t] === skipTag) continue;
        for (let k = 0; k < 9; k += 3) {
          const x = this.pos[i + k], y = this.pos[i + k + 1], z = this.pos[i + k + 2];
          if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x;
          if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y;
          if (z < b.z0) b.z0 = z; if (z > b.z1) b.z1 = z;
        }
      }
      return b;
    }
    // 按标签筛出子网格：构件级拆分 / 隐藏用，不重建几何
    subset(pred) {
      const out = new GF.Mesh();
      for (let t = 0; t < this.tag.length; t++) {
        if (!pred(String(this.tag[t]), this.mat[t])) continue;
        const p = t * 9;
        for (let k = 0; k < 9; k++) { out.pos.push(this.pos[p + k]); out.nrm.push(this.nrm[p + k]); }
        out.mat.push(this.mat[t]); out.tag.push(this.tag[t]);
        out.wx.push(this.wx[t]); out.wz.push(this.wz[t]);
      }
      return out;
    }
  };

  /* ------------------------------ 颜色 ------------------------------ */
  function hex2rgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16)
    ];
  }
  GF.hex2rgb = hex2rgb;
  GF.rgb2hex = (c) =>
    '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

  function rgb2hsl(rgb) {
    const r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (mx + mn) / 2;
    if (mx !== mn) {
      const d = mx - mn;
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (mx === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
    }
    return [h, s, l];
  }
  function hsl2rgb(h, s, l) {
    if (s === 0) return [l * 255, l * 255, l * 255];
    const hue = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return [hue(p, q, h + 1 / 3) * 255, hue(p, q, h) * 255, hue(p, q, h - 1 / 3) * 255];
  }
  GF.shiftColor = function (hex, dh, ds, dl) {
    const hsl = rgb2hsl(hex2rgb(hex));
    return GF.rgb2hex(hsl2rgb((hsl[0] + (dh || 0) + 1) % 1, GF.clamp(hsl[1] * (ds == null ? 1 : ds), 0, 1), GF.clamp(hsl[2] * (dl == null ? 1 : dl), 0, 1)));
  };

  /* ----------------------------- 调色板 ----------------------------- */
  // 每种材质 3 级明度：暗 / 中 / 亮
  const BASE_MATS = {
    tile:     ['#3d4650', '#505b66', '#65717d'], // 青灰瓦
    tileB:    ['#48515b', '#5c6873', '#728091'], // 瓦垄交替（略亮）
    tileEnd:  ['#3f4650', '#525a64', '#656e78'], // 屋脊/瓦当：随瓦走冷灰
    glazeY:   ['#b8862c', '#dcb14c', '#f5d98a'], // 黄琉璃
    glazeG:   ['#2b5943', '#3b7a5a', '#559f78'], // 绿琉璃
    glazeB:   ['#28465c', '#376780', '#4d8aa6'], // 孔雀蓝琉璃
    glazeYD:  ['#96681f', '#c2963a', '#dfc070'], // 黄琉璃·暗垄
    glazeGD:  ['#1f4232', '#2c5f47', '#42805f'], // 绿琉璃·暗垄
    glazeBD:  ['#1e3546', '#2a4f66', '#3b6c84'], // 蓝琉璃·暗垄
    stone:    ['#666257', '#827e72', '#9d998d'], // 石
    marble:   ['#8f8c83', '#b0ada3', '#d2cfc4'], // 汉白玉
    brick:    ['#454d54', '#5b646c', '#74808a'], // 青砖
    plaster:  ['#aaa495', '#cdc7b6', '#e7e1cf'], // 白粉墙
    wood:     ['#4f3021', '#6d412c', '#8a573c'], // 木构
    timber:   ['#76251c', '#9c3426', '#bd4a32'], // 朱漆立柱
    zhu:      ['#84251a', '#ac3626', '#cc4f32'], // 朱红
    gold:     ['#83601e', '#b8913a', '#e3c674'], // 金
    paintBlue:  ['#22465c', '#30607c', '#427b98'], // 旋子彩画蓝
    paintGreen: ['#1f4d3a', '#2b6a50', '#3c8565'], // 彩画绿
    leaf:     ['#3a5730', '#517a3c', '#6f9a4c'], // 阔叶
    pine:     ['#24402a', '#325235', '#436a42'], // 松针
    bamboo:   ['#3c572b', '#527337', '#6f9c4a'], // 竹
    plum:     ['#a2637a', '#c4869a', '#e3afbe'], // 梅
    willow:   ['#4c6b33', '#668940', '#83a852'], // 柳
    soil:     ['#7d6444', '#9c7f56', '#bd9f74'], // 夯土
    grass:    ['#3e5a2d', '#547738', '#6c974a'], // 草地
    water:    ['#1a4a5f', '#286e8a', '#4194b0'], // 水面
    waterB:   ['#22414f', '#315c70', '#41788c'], // 水面·波光暗纹
    lantern:  ['#8a1b13', '#bd2a1c', '#e04a2c'], // 灯笼
    cloth:    ['#836f57', '#a68b6b', '#c5ab86'], // 布幡
    white:    ['#b3b6bb', '#d2d5d9', '#eff0f2'], // 雪
    dark:     ['#1d1a17', '#292421', '#37302b'], // 门洞深处
    terracotta:['#6f4430', '#8f5940', '#ab7253'], // 陶/素瓦
    stoneDark: ['#4a4740', '#5e5b53', '#737067'], // 深色石/台阶缝
    glass:    ['#4b6472', '#6a8c9c', '#8fb3c0'],  // 窗纸/玻璃
    paper:    ['#b3a688', '#d3c6a8', '#ede3c8'],  // 窗纸
    lamp:     ['#bf9440', '#e6c672', '#fff2c0'],  // 灯焰
    woodDark: ['#38231a', '#4b3024', '#61422f'],  // 深色木
    stoneB:   ['#5e5a50', '#79756a', '#948f83'],  // 石板·微差（铺装变化用）
    brickB:   ['#4a525a', '#606a73', '#79858f'],  // 砖·微差
    marbleB:  ['#848179', '#a5a299', '#c7c4b9'],  // 汉白玉·微差
    slab:     ['#565248', '#6f6b60', '#8a8579'],  // 大条石/阶条石
    thatch:   ['#6e5327', '#9a7838', '#c2a05a'], // 茅草顶
    thatchB:  ['#7d602e', '#ab8742', '#cdad66'], // 茅草垄交替
    mat:      ['#7d6f42', '#9c8c56', '#bcab74']  // 草席
  };

  // 铺装顶面：与条石同色，但走“顶面铺砖”肌理，不和立面砌缝混用
  BASE_MATS.slabTop = BASE_MATS.slab;
  BASE_MATS.stoneBTop = BASE_MATS.stoneB;

  // 修正一处笔误（保持表结构完整）
  BASE_MATS.marble = ['#8f8c83', '#b0ada3', '#d2cfc4'];

  const PALETTES = {
    qingya: {
      name: '清雅·白日',
      bg: '#efe8d8',
      ink: '#2b2722',
      light: [-0.42, 0.76, 0.5],
      mats: BASE_MATS
    },
    dusk: {
      name: '暮色·黄昏',
      bg: '#f4d9b6',
      ink: '#3a2a22',
      light: [-0.5, 0.62, 0.55],
      map: (hex) => GF.shiftColor(hex, -0.012, 1.06, 0.97)
    },
    night: {
      name: '夜色·灯影',
      bg: '#1d2331',
      ink: '#0f1219',
      light: [0.35, 0.7, -0.4],
      map: (hex) => GF.shiftColor(hex, 0.05, 0.82, 0.62)
    },
    snow: {
      name: '雪霁·素裹',
      bg: '#eef2f5',
      ink: '#39424a',
      light: [-0.4, 0.85, 0.3],
      map: (hex) => GF.shiftColor(hex, 0.004, 0.72, 1.02)
    },
    moxi: {
      name: '水墨·宣纸',
      bg: '#f6f2e6',
      ink: '#22201d',
      light: [-0.32, 0.84, 0.42],
      map: (hex) => GF.shiftColor(hex, 0, 0.22, 1.0),
      accent: ['zhu', 'timber', 'lantern', 'gold', 'tileEnd']
    },
    zheshi: {
      name: '赭石·双套印',
      bg: '#f3e6cf',
      ink: '#2f2119',
      light: [-0.45, 0.78, 0.46],
      map: (hex) => GF.shiftColor(hex, 0.012, 0.88, 1.03)
    },
    qinglv: {
      name: '青绿·绢本',
      bg: '#efeadb',
      ink: '#233029',
      light: [-0.38, 0.8, 0.44],
      map: (hex) => GF.shiftColor(hex, -0.03, 0.92, 1.04)
    }
  };

  GF.palette = function (key) {
    const p = PALETTES[key] || PALETTES.qingya;
    const mats = {};
    for (const k in BASE_MATS) {
      let ramp = BASE_MATS[k];
      if (p.map) ramp = ramp.map((hex) => p.map(hex));
      mats[k] = ramp.map(hex2rgb);
    }
    // 雪景：屋面覆雪
    if (key === 'snow') {
      mats.tile = BASE_MATS.white.map(hex2rgb);
      mats.tileB = ['#c7cace', '#e0e2e5', '#f7f8f9'].map(hex2rgb);
    }
    // 水墨：除朱红/金等“点染”外整体去彩，保留墨分五色
    if (key === 'moxi') {
      for (const k in mats) {
        if ((p.accent || []).indexOf(k) >= 0) mats[k] = BASE_MATS[k].map(hex2rgb);
        else mats[k] = BASE_MATS[k].map((hex) => {
          const h = GF.shiftColor(hex, 0, 0.16, 0.96);
          return hex2rgb(h);
        });
      }
      mats.tile = ['#3c3a36', '#52504a', '#6b6862'].map(hex2rgb);
      mats.tileB = ['#47443f', '#5d5a53', '#76726b'].map(hex2rgb);
      mats.plaster = ['#b0aa9a', '#d6d0bf', '#efe9d8'].map(hex2rgb);
    }
    return {
      name: p.name,
      bg: p.bg,
      ink: hex2rgb(p.ink),
      light: V.norm(p.light),
      mats
    };
  };
  GF.PALETTE_KEYS = Object.keys(PALETTES);

  /* ------------------------- 常用构件小工具 ------------------------- */
  // 在两点之间搭一根方木（用于椽子、栏杆、树枝）
  GF.beamBetween = function (mb, a, b, w, h, mat, tag, caps) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-4) return;
    const dir = [dx / len, dy / len, dz / len];
    // 构造正交基
    let up = [0, 1, 0];
    if (Math.abs(dir[1]) > 0.95) up = [0, 0, 1];
    const right = V.norm(V.cross(dir, up));
    const front = V.norm(V.cross(right, dir));
    const hw = w / 2, hh = h / 2;
    const corners = (p) => {
      const A = V.add(p, V.add(V.mul(right, -hw), V.mul(front, -hh)));
      const B = V.add(p, V.add(V.mul(right, hw), V.mul(front, -hh)));
      const C = V.add(p, V.add(V.mul(right, hw), V.mul(front, hh)));
      const D = V.add(p, V.add(V.mul(right, -hw), V.mul(front, hh)));
      return [A, B, C, D];
    };
    // 沿线长按 0.22 m 细分，杜绝几米长的整根方木每侧是一个长矩形大三角
    const SPLIT = 0.22;
    const ns = Math.max(1, Math.ceil(len / SPLIT));
    // 端面控制：链式调用时相邻段共享端点，同一截面只应出一块端面。
    // 'both'（默认）出两端，'start' 只出 a 端，'end' 只出 b 端，'none' 都不出。
    const capsStart = caps !== 'end' && caps !== 'none';
    const capsEnd = caps !== 'start' && caps !== 'none';
    const prev = corners(a);
    if (capsStart) mb.quad(prev[3], prev[2], prev[1], prev[0], mat, tag);
    for (let s = 1; s <= ns; s++) {
      const e = s / ns;
      const p = [a[0] + dx * e, a[1] + dy * e, a[2] + dz * e];
      const cur = corners(p);
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        mb.quad(prev[i], prev[j], cur[j], cur[i], mat, tag);
      }
      if (s === ns && capsEnd) {
        mb.quad(cur[3], cur[2], cur[1], cur[0], mat, tag);
      }
      for (let i = 0; i < 4; i++) prev[i] = cur[i];
    }
  };

  /** 任意方向圆杆（n 边棱柱）：寻杖、地栿、净瓶、椽子等，避免一眼全是方条 */
  GF.beamRound = function (mb, a, b, r, n, mat, tag) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-4 || r <= 0) return;
    const dir = [dx / len, dy / len, dz / len];
    let up = [0, 1, 0];
    if (Math.abs(dir[1]) > 0.95) up = [0, 0, 1];
    const right = V.norm(V.cross(dir, up));
    const front = V.norm(V.cross(right, dir));
    const ring = (p) => {
      const out = [];
      for (let i = 0; i < n; i++) {
        const t = (i / n) * Math.PI * 2;
        out.push(V.add(p, V.add(V.mul(right, Math.cos(t) * r), V.mul(front, Math.sin(t) * r))));
      }
      return out;
    };
    const r0 = ring(a);
    let prev = r0;
    // 沿线长按 0.22 m 细分侧面与中心扇面，杜绝长圆杆一段就成一个大棱面
    const SPLIT = 0.22;
    const ns = Math.max(1, Math.ceil(len / SPLIT));
    for (let s = 1; s <= ns; s++) {
      const e = s / ns;
      const p = [a[0] + dx * e, a[1] + dy * e, a[2] + dz * e];
      const cur = ring(p);
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        mb.quad(prev[i], prev[j], cur[j], cur[i], mat, tag);
      }
      if (s === ns) {
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          mb.tri(b, cur[i], cur[j], mat, tag);
        }
      }
      prev = cur;
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      mb.tri(a, r0[j], r0[i], mat, tag);
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);