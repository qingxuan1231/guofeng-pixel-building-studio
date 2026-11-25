'use strict';
  /* ------------------------------ 廊桥 ------------------------------ */
  function buildBridge(mb, r) {
    const span = r.span || 12, w = r.bridgeW || 3.0;
    const deckY = r.baseH || 1.0;
    // 拱桥面（分段抬高）
    const segs = 12;
    for (let i = 0; i < segs; i++) {
      const t = (i + 0.5) / segs;
      const x = -span / 2 + span * t;
      const y = deckY + Math.sin(Math.PI * t) * (r.arch || 1.2);
      mb.box(x - span / segs / 2, x + span / segs / 2, y - 0.3, y, -w / 2, w / 2, 'stone', '桥面');
      // 桥墩/拱石
      mb.box(x - span / segs / 2, x + span / segs / 2, 0, y - 0.3, -w / 2 - 0.1, -w / 2 + 0.1, 'stone', '桥身');
      mb.box(x - span / segs / 2, x + span / segs / 2, 0, y - 0.3, w / 2 - 0.1, w / 2 + 0.1, 'stone', '桥身');
    }
    // 栏杆
    for (let i = 0; i < segs; i++) {
      const t = (i + 0.5) / segs;
      const x = -span / 2 + span * t;
      const y = deckY + Math.sin(Math.PI * t) * (r.arch || 1.2);
      for (const sz of [-1, 1]) {
        mb.boxC(x, sz * (w / 2 - 0.1), 0.16, 0.16, y, y + 0.6, 'marble', '桥栏');
      }
    }
    // 廊（柱 + 卷棚顶 + 挂落）
    const nCol = 5;
    for (let i = 0; i <= nCol; i++) {
      const t = i / nCol;
      const x = -span / 2 + span * (0.1 + t * 0.8);
      const y = deckY + Math.sin(Math.PI * (0.1 + t * 0.8)) * (r.arch || 1.2);
      for (const sz of [-1, 1]) {
        mb.cyl(x, sz * (w / 2 - 0.25), 0.16, y, y + 2.5, 8, r.colMat, '廊柱');
      }
      // 挂落
      GF.beamBetween(mb, [x, y + 2.1, -w / 2 + 0.25], [x, y + 2.1, w / 2 - 0.25], 0.06, 0.2, 'wood', '挂落');
    }
    if (!r.cut.roof) {
      // 连续卷棚顶：沿拱线逐站放样，檐口落在各柱柱头上，别按每段取平均高度（那样会浮空/柱头穿顶）
      const zE = w / 2 + 0.5;
      const yCol = (t) => deckY + Math.sin(Math.PI * t) * (r.arch || 1.2) + 2.5;
      const stations = [];
      for (let i = 0; i <= nCol; i++) {
        const t = 0.1 + (i / nCol) * 0.8;
        const x = -span / 2 + span * t;
        const yc = yCol(t);
        stations.push({
          x,
          eaveL: [x, yc + 0.04, -zE],
          eaveR: [x, yc + 0.04, zE],
          ridge: [x, yc + 0.66, 0]
        });
      }
      // 两端各再放一跨短的，让屋顶探出端柱一点，端头不再顶在柱子上
      for (const s of [1, -1]) {
        const src = s > 0 ? stations[stations.length - 1] : stations[0];
        const dx = s * 0.45;
        stations.splice(s > 0 ? stations.length : 0, 0, {
          x: src.x + dx,
          eaveL: [src.x + dx, src.eaveL[1], -zE],
          eaveR: [src.x + dx, src.eaveR[1], zE],
          ridge: [src.x + dx, src.ridge[1], 0]
        });
      }
      for (let i = 0; i < stations.length - 1; i++) {
        const a = stations[i], b = stations[i + 1];
        // 两侧坡面
        mb.quad(a.eaveR, b.eaveR, b.ridge, a.ridge, r.tile, '廊顶');
        mb.quad(b.eaveL, a.eaveL, a.ridge, b.ridge, r.tile, '廊顶');
        // 瓦垄：脊上补一道深色压顶，檐口收边
        mb.quad([a.ridge[0], a.ridge[1] + 0.02, -0.1], [b.ridge[0], b.ridge[1] + 0.02, -0.1],
          [b.ridge[0], b.ridge[1] + 0.02, 0.1], [a.ridge[0], a.ridge[1] + 0.02, 0.1], r.tileB, '廊顶·脊');
        GF.beamBetween(mb, [a.eaveR[0], a.eaveR[1] - 0.1, a.eaveR[2]], [b.eaveR[0], b.eaveR[1] - 0.1, b.eaveR[2]], 0.12, 0.14, 'woodDark', '廊顶·连檐');
        GF.beamBetween(mb, [a.eaveL[0], a.eaveL[1] - 0.1, a.eaveL[2]], [b.eaveL[0], b.eaveL[1] - 0.1, b.eaveL[2]], 0.12, 0.14, 'woodDark', '廊顶·连檐');
      }
      // 两端山面封口，避免从端头看进空腔
      for (const s of [stations[0], stations[stations.length - 1]]) {
        mb.tri(s.eaveL, s.eaveR, s.ridge, 'wood', '廊顶·山面');
        mb.tri(s.eaveR, s.eaveL, s.ridge, 'wood', '廊顶·山面');
      }
    }
  }

  /* ------------------------------ 阁（多层+平座） ------------------------------ */
  // 旧配方（未开 pingzuo / 抱厦 / 城关 / 欢门）走原路径，几何与既有预置完全一致
  function buildGeLegacy(mb, r) {
    const bays = Math.max(1, r.bays);
    let W = bays * r.bayW, D = r.depth;
    // 楼阁：底层平座 + 腰檐出挑很宽，台基必须跟着放大，否则整座“头大脚细”
    const pad = 0.62 + r.eave * 0.35 + 0.2;
    const b = base(mb, r, { W: W + pad * 2, D: D + pad * 2 });
    let y = b.h + 0.04;
    const floors = Math.max(1, r.floors);
    const fh = r.floorH;

    for (let f = 0; f < floors; f++) {
      const isTop = f === floors - 1;
      const top = body(mb, {
        W, D, baseY: y, floors: 1, floorH: (Array.isArray(r.floorHList) && r.floorHList[f]) || fh, bays,
        wallMat: r.wallMat, colMat: r.colMat, cut: f === 0 ? r.cut : { roof: r.cut.roof },
        winW: r.winW, winH: r.winH, winPattern: r.winPattern,
        doorW: r.doorW, doorH: r.doorH, doorStyle: r.doorStyle, doorLeaves: r.doorLeaves,
        eave: r.eave, tile: r.tile, tileB: r.tileB, upturn: r.upturn,
        dougong: r.dougong, era: r.era, dgScale: r.dgScale, dgStyle: r.dgStyle, dgEye: r.dgEye,
        queti: r.queti, sideWindows: false
      });
      if (isTop) {
        if (r.ceiling && r.ceiling !== 'none') {
          const cy = top.topY - 0.3;
          P.ceiling(mb, { x0: -W / 2 + 0.25, x1: W / 2 - 0.25, z0: -D / 2 + 0.25, z1: D / 2 - 0.25, y: cy });
          if (r.ceiling === 'caisson') P.caisson(mb, 0, 0, cy, Math.min(W * 0.5, 3.0), Math.min(D * 0.5, 2.8));
        }
        if (!r.cut.roof) {
          GF.roofs.build(mb, {
            cx: 0, cz: 0,
            x0: -W / 2 - r.eave, x1: W / 2 + r.eave,
            z0: -D / 2 - r.eave, z1: D / 2 + r.eave,
            yb: top.roofY, rise: r.slope * (D / 2 + r.eave) * 0.92,
            tile: r.tile, tileB: r.tileB, upturn: r.upturn,
            ridgeStyle: r.ridgeStyle, beasts: r.beasts, finial: !!r.finial,
            xuanYu: r.xuanYu, windDuo: r.windDuo, trim: r.trimColor ? r.trimMat : null,
            gableMat: r.wallMat, tag: '阁顶'
          });
        }
        break;
      }
      // 平座挑台：平台外沿按出檐定，栏杆立在台边（瓦檐永远在台边之外，不越过台面）
      const py = top.topY + 0.04;
      const ex = Math.max(0.66, (r.eave || 0.9) * 0.78);
      mb.box(-W / 2 - ex, W / 2 + ex, py - 0.3, py, -D / 2 - ex, D / 2 + ex, 'wood', '平座');
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          mb.boxC(sx * (W / 2 + ex - 0.22), sz * (D / 2 + ex - 0.22), 0.14, 0.14, py - 0.26, py - 0.02, 'woodDark', '平座·角撑');
        }
      }
      P.railing(mb, { a: [-W / 2 - ex, D / 2 + ex], b: [W / 2 + ex, D / 2 + ex], y: py, style: 'wood', tag: '平座栏杆' });
      P.railing(mb, { a: [-W / 2 - ex, -D / 2 - ex], b: [-W / 2 - ex, D / 2 + ex], y: py, style: 'wood', tag: '平座栏杆' });
      P.railing(mb, { a: [W / 2 + ex, -D / 2 - ex], b: [W / 2 + ex, D / 2 + ex], y: py, style: 'wood', tag: '平座栏杆' });
      // 腰檐：台边之外的一圈短披檐。内圈落在平台外沿，顶面压到平台板底以下，
      // 从平台上看永远看不到瓦，只有站在台边栏杆外才见一圈檐。
      if (!r.cut.roof) {
        const exE = W / 2 + ex;
        const ezE = D / 2 + ex;
        GF.roofs.skirt(mb, {
          cx: 0, cz: 0,
          x0: -exE - 0.8, x1: exE + 0.8, z0: -ezE - 0.8, z1: ezE + 0.8,
          xi: exE + 0.02, zi: ezE + 0.02,
          yb: py - 0.94, ytop: py - 0.34,
          tile: r.tile, tileB: r.tileB, upturn: r.upturn * 0.8, tag: '腰檐' + (f + 1)
        });
      }
      y = py + 0.06;
      W *= 0.92; D *= 0.92;
    }
    if (r.plaque) {
      P.plaque(mb, { dir: 'front', at: D / 2 - 0.02, uc: 0, vc: y + fh * 0.62, w: 1.7, h: 0.55, chars: 3 });
    }
  }

  // 抱厦：侧向突出体量，屋面内檐插进主体墙皮 0.12m（留叠压，不留三角缝），
  // 外檐挑出抱厦进深；四角转角与主体屋面在墙皮线交圈。
  function addBaoxia(mb, r, o) {
    const { W, D, baseY, colTop, fhF, ev, floor } = o;
    const bp = r.baoxiaD || 1.3;
    const bwZ = W * (r.baoxiaW || 0.44);   // 前后抱厦面宽
    const bwX = D * (r.baoxiaW || 0.44);   // 左右抱厦面宽
    const tuck = 0.12;
    const joints = [];
    const sides = [
      { dir: 'front', axis: 'z', s: 1, bw: bwZ },
      { dir: 'back', axis: 'z', s: -1, bw: bwZ },
      { dir: 'right', axis: 'x', s: 1, bw: bwX },
      { dir: 'left', axis: 'x', s: -1, bw: bwX }
    ];
    for (const sd of sides) {
      const face = sd.axis === 'z' ? D / 2 : W / 2;
      const inner = sd.s * (face - tuck);   // 内檐：插进墙皮
      const outer = sd.s * (face + bp + ev * 0.7);
      const projEnd = sd.s * (face + bp * 0.8);
      const roofO = { tile: r.tile, tileB: r.tileB, upturn: r.upturn * 0.85, ridgeStyle: 'plain', beasts: 0, finial: false, tag: '抱厦·' + sd.dir };
      if (sd.axis === 'z') {
        // 两山 cheek wall
        for (const sx of [-1, 1]) {
          mb.box(sx * sd.bw / 2 - 0.09, sx * sd.bw / 2 + 0.09, baseY, colTop - 0.28,
            Math.min(face - tuck, projEnd), Math.max(face - tuck, projEnd), r.wallMat, '抱厦·山墙');
          mb.cyl(sx * sd.bw / 2, projEnd, 0.14, baseY, colTop, 8, r.colMat, '抱厦·角柱');
        }
        // 前脸墙（带窗暗面）
        mb.box(-sd.bw / 2, sd.bw / 2, baseY, colTop - 0.28, Math.min(projEnd - 0.09, projEnd + 0.09), Math.max(projEnd - 0.09, projEnd + 0.09), r.wallMat, '抱厦·脸墙');
        mb.box(-sd.bw * 0.28, sd.bw * 0.28, baseY + fhF * 0.34, baseY + fhF * 0.72, projEnd - 0.1, projEnd + 0.02, 'dark', '抱厦·窗');
        if (!r.cut.roof) {
          GF.roofs.build(mb, Object.assign(roofO, {
            cx: 0, cz: 0,
            x0: -sd.bw / 2 - ev * 0.5, x1: sd.bw / 2 + ev * 0.5,
            z0: Math.min(inner, outer), z1: Math.max(inner, outer),
            yb: colTop, rise: r.slope * (bp + ev * 0.7) * 0.8, type: 'gableHip',
            gableMat: r.wallMat
          }));
        }
      } else {
        for (const sz of [-1, 1]) {
          mb.box(Math.min(face - tuck, projEnd), Math.max(face - tuck, projEnd), baseY, colTop - 0.28,
            sz * sd.bw / 2 - 0.09, sz * sd.bw / 2 + 0.09, r.wallMat, '抱厦·山墙');
          mb.cyl(projEnd, sz * sd.bw / 2, 0.14, baseY, colTop, 8, r.colMat, '抱厦·角柱');
        }
        mb.box(Math.min(projEnd - 0.09, projEnd + 0.09), Math.max(projEnd - 0.09, projEnd + 0.09), baseY, colTop - 0.28, -sd.bw / 2, sd.bw / 2, r.wallMat, '抱厦·脸墙');
        mb.box(projEnd - 0.1, projEnd + 0.02, baseY + fhF * 0.34, baseY + fhF * 0.72, -sd.bw * 0.28, sd.bw * 0.28, 'dark', '抱厦·窗');
        if (!r.cut.roof) {
          GF.roofs.build(mb, Object.assign(roofO, {
            cx: 0, cz: 0,
            x0: Math.min(inner, outer), x1: Math.max(inner, outer),
            z0: -sd.bw / 2 - ev * 0.5, z1: sd.bw / 2 + ev * 0.5,
            yb: colTop, rise: r.slope * (bp + ev * 0.7) * 0.8, type: 'gableHip',
            gableMat: r.wallMat
          }));
        }
      }
      joints.push({
        side: sd.dir, axis: sd.axis,
        wallFace: sd.s * face, innerEave: inner, outerEave: outer,
        overlap: tuck,
        // 负值＝内檐叠压进墙皮（无三角缝），0＝齐墙，正值＝留缝
        gap: sd.s * inner - face
      });
    }
    return joints;
  }

  // 彩楼欢门：临时门楼意象——两根高杆 + 横额 + 一道挑出的披檐（不设虚构米数，比例随层高）
  function addHuamen(mb, r, W, D, y0, h) {
    const z = D / 2 + 0.8;
    const ph = h * 1.12;
    const px = W / 2 - 0.9;
    for (const sx of [-1, 1]) {
      mb.cyl(sx * px, z, 0.12, y0, y0 + ph, 8, r.colMat, '欢门·杆');
      mb.boxC(sx * px, z, 0.22, 0.22, y0, y0 + 0.12, 'stone', '欢门·杆础');
    }
    GF.beamBetween(mb, [-px, y0 + ph - 0.28, z], [px, y0 + ph - 0.28, z], 0.14, 0.26, 'woodDark', '欢门·横额');
    if (!r.cut.roof) {
      GF.roofs.skirt(mb, {
        cx: 0, cz: z,
        x0: -W / 2 - 0.25, x1: W / 2 + 0.25, z0: z - 0.35, z1: z + 0.55,
        xi: W / 2 - 0.4, zi: 0.1,
        yb: y0 + ph, ytop: y0 + ph + 0.42,
        tile: r.tile, tileB: r.tileB, upturn: r.upturn * 0.7, tag: '欢门·披檐'
      });
    }
    // 两侧垂挂彩幡条（简化为竖向木板）
    for (const sx of [-1, 1]) {
      mb.box(sx * (px - 0.35) - 0.08, sx * (px - 0.35) + 0.08, y0 + ph - 1.05, y0 + ph - 0.32, z - 0.05, z + 0.05, 'cloth', '欢门·彩幡');
    }
  }

  // 分层修正路径：腰檐檐底压柱头、平座面接住上层屋身、逐层斗拱 / 收分 / 出檐数组化
  function buildGeLayered(mb, r) {
    const bays = Math.max(1, r.bays);
    const W0 = bays * r.bayW, D0 = r.depth;
    const floors = Math.max(1, r.floors);
    const fh = r.floorH;
    const schedule = [];
    mb.schedule = schedule;

    // 台基 / 城关城台
    let y0;
    let terrace = null;
    if (r.terraceGate) {
      const TW = r.width || W0 + 3.6, TD = r.depthTower || D0 + 2.6;
      terrace = buildTerrace(mb, r, {
        W: TW, D: TD, wallH: r.wallH || 4.6, gateW: r.gateW || 2.8, gateH: r.gateH || 3.4, closed: false
      });
      y0 = terrace.topY + 0.04;
      // 台上四角陪亭（低于主阁，落城台边角、探出主楼轮廓）
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          smallPavilion(mb, r, sx * (TW / 2 - 0.95), sz * (TD / 2 - 0.95), 0.78, 2.1, 'pyramid', '角亭', y0);
        }
      }
    } else {
      const pad = 0.62 + r.eave * 0.35 + 0.2;
      const b = base(mb, r, { W: W0 + pad * 2, D: D0 + pad * 2 });
      y0 = b.h + 0.04;
    }

    const shrinkAt = (i) => {
      if (Array.isArray(r.shrinkList) && r.shrinkList.length) {
        let acc = 1;
        for (let k = 0; k < i; k++) acc *= (r.shrinkList[k] || 0.92);
        return acc;
      }
      return Math.pow(0.92, i);
    };
    const eaveAt = (i) => (Array.isArray(r.eaveList) && r.eaveList[i] != null) ? r.eaveList[i] : r.eave;
    const dgAt = (i) => (Array.isArray(r.dgList) && r.dgList[i]) || 0;

    let y = y0;
    for (let f = 0; f < floors; f++) {
      const isTop = f === floors - 1;
      const k = shrinkAt(f);
      const Wf = W0 * k, Df = D0 * k;
      const fhF = (Array.isArray(r.floorHList) && r.floorHList[f]) || fh;
      const evF = eaveAt(f);
      const baseY = y;
      const dgLvF = dgAt(f);
      const top = body(mb, {
        W: Wf, D: Df, baseY, floors: 1, floorH: fhF, bays,
        wallMat: r.wallMat, colMat: r.colMat, cut: f === 0 ? r.cut : { roof: r.cut.roof },
        winW: r.winW, winH: r.winH, winPattern: r.winPattern,
        doorW: r.doorW, doorH: r.doorH, doorStyle: r.doorStyle, doorLeaves: r.doorLeaves,
        eave: evF, tile: r.tile, tileB: r.tileB, upturn: r.upturn,
        dougong: dgLvF > 0 ? false : r.dougong, era: r.era, dgScale: r.dgScale, dgStyle: r.dgStyle, dgEye: r.dgEye,
        queti: r.queti, sideWindows: false
      });
      const colTop = top.topY;
      const rec = { floor: f + 1, baseY, colTop, eaveBottom: null, pingzuo: null, nextBase: null, roofEave: null, joints: [] };

      // 抱厦（逐层）
      if (r.baoxia) {
        rec.joints = addBaoxia(mb, r, { W: Wf, D: Df, baseY, colTop, fhF, ev: evF, floor: f + 1 });
      }

      if (isTop) {
        if (r.ceiling && r.ceiling !== 'none') {
          const cy = colTop - 0.3;
          P.ceiling(mb, { x0: -Wf / 2 + 0.25, x1: Wf / 2 - 0.25, z0: -Df / 2 + 0.25, z1: Df / 2 - 0.25, y: cy });
          if (r.ceiling === 'caisson') P.caisson(mb, 0, 0, cy, Math.min(Wf * 0.5, 3.0), Math.min(Df * 0.5, 2.8));
        }
        if (!r.cut.roof) {
          GF.roofs.build(mb, {
            cx: 0, cz: 0,
            x0: -Wf / 2 - evF, x1: Wf / 2 + evF,
            z0: -Df / 2 - evF, z1: Df / 2 + evF,
            yb: colTop, rise: r.slope * (Df / 2 + evF) * 0.92,
            type: r.roofType === 'gable' ? 'gableHip' : r.roofType,
            tile: r.tile, tileB: r.tileB, upturn: r.upturn,
            ridgeStyle: r.ridgeStyle, beasts: r.beasts, finial: !!r.finial,
            xuanYu: r.xuanYu, windDuo: r.windDuo, trim: r.trimColor ? r.trimMat : null,
            gableMat: r.wallMat, tag: '阁顶'
          });
          rec.roofEave = colTop;
        }
        schedule.push(rec);
        break;
      }

      // 滴水数多于层数时：底层腰部再加一道下檐（副阶腰檐，四滴水之类）
      if (r.tiers > floors && f === 0 && !r.cut.roof) {
        const yMid = baseY + fhF * 0.5;
        GF.roofs.skirt(mb, {
          cx: 0, cz: 0,
          x0: -Wf / 2 - evF * 1.15, x1: Wf / 2 + evF * 1.15,
          z0: -Df / 2 - evF * 1.15, z1: Df / 2 + evF * 1.15,
          xi: Wf / 2 - 0.5, zi: Df / 2 - 0.5,
          yb: yMid, ytop: yMid + 0.46,
          tile: r.tile, tileB: r.tileB, upturn: r.upturn, trim: r.trimColor ? r.trimMat : null,
          tag: '底层下檐'
        });
        rec.midEave = yMid;
      }

      // 腰檐：外檐底压柱头（yb = colTop），内檐收到上层身轮廓之下，不插进上层墙身
      const eaveH = 0.5 + (r.slope || 0.5) * 0.3;
      const kNext = shrinkAt(f + 1);
      const Wn = W0 * kNext, Dn = D0 * kNext;
      // 平座挑出与腰檐位置先定下来：腰檐要落在平台外沿之外、顶面压到平台板底以下，
      // 否则瓦会从平台内侧往上层墙身铺，看着像“瓦从栏杆里往屋里长”
      const ex = Math.max(0.66, evF * 0.78);
      const pzY = colTop + eaveH + 0.02;
      const exE = Wf / 2 + ex, ezE = Df / 2 + ex;
      if (!r.cut.roof) {
        const dgLv = dgAt(f);
        if (dgLv > 0) {
          // 逐层斗拱：贴腰檐外檐下沿，沿四面排布
          const dgS = (r.dgScale || 0.9) * (0.85 + 0.05 * dgLv);
          const nX = Math.max(2, Math.round(Wf / 1.8));
          const nZ = Math.max(2, Math.round(Df / 1.8));
          const tone = (r.era === 'han' || r.era === 'tang' || r.era === 'song' || r.era === 'jin') ? 'dan' : 'green';
          for (let i = 0; i <= nX; i++) {
            const cx = -Wf / 2 + (Wf * i) / nX;
            for (const cz of [Df / 2 + 0.1, -Df / 2 - 0.1]) {
              P.dougong(mb, cx, colTop - 0.12, cz, dgS, '斗拱·腰檐', r.dgStyle || 'mid', { gap: Wf / nX, tone });
            }
          }
          for (let i = 0; i <= nZ; i++) {
            const cz = -Df / 2 + (Df * i) / nZ;
            for (const cx of [Wf / 2 + 0.1, -Wf / 2 - 0.1]) {
              P.dougong(mb, cx, colTop - 0.12, cz, dgS, '斗拱·腰檐', r.dgStyle || 'mid', { gap: Df / nZ, tone });
            }
          }
        }
        GF.roofs.skirt(mb, {
          cx: 0, cz: 0,
          x0: -exE - 0.8, x1: exE + 0.8,
          z0: -ezE - 0.8, z1: ezE + 0.8,
          xi: exE + 0.02, zi: ezE + 0.02,
          yb: pzY - 0.92, ytop: pzY - 0.32,
          tile: r.tile, tileB: r.tileB, upturn: r.upturn * 0.8,
          trim: r.trimColor ? r.trimMat : null, tag: '腰檐' + (f + 1)
        });
        rec.eaveBottom = colTop;
      }

      // 平座：面板顶面 pzY 即上层屋身起始标高（nextBase = pzY，间隙 0，不留缝）
      mb.box(-exE, exE, pzY - 0.28, pzY, -ezE, ezE, 'wood', '平座');
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          mb.boxC(sx * (exE - 0.22), sz * (ezE - 0.22), 0.14, 0.14, pzY - 0.26, pzY - 0.02, 'woodDark', '平座·角撑');
        }
      }
      const pzStyle = r.pingzuoStyle === 'marble' ? 'marble' : 'wood';
      P.railing(mb, { a: [-exE, ezE], b: [exE, ezE], y: pzY, style: pzStyle, tag: '平座栏杆' });
      P.railing(mb, { a: [-exE, -ezE], b: [-exE, ezE], y: pzY, style: pzStyle, tag: '平座栏杆' });
      P.railing(mb, { a: [exE, -ezE], b: [exE, ezE], y: pzY, style: pzStyle, tag: '平座栏杆' });
      rec.pingzuo = pzY;
      y = pzY;
      rec.nextBase = y;
      schedule.push(rec);
    }

    if (r.huamen) addHuamen(mb, r, W0, D0, y0, fh);
    if (r.plaque) {
      P.plaque(mb, { dir: 'front', at: D0 / 2 - 0.02, uc: 0, vc: y0 + fh * 0.62, w: 1.7, h: 0.55, chars: 3 });
    }
  }

  function buildGe(mb, r) {
    const layered = r.pingzuo === true || r.baoxia || r.terraceGate || r.huamen;
    if (layered) buildGeLayered(mb, r);
    else buildGeLegacy(mb, r);
  }

  /* ------------------------------ 水榭 ------------------------------ */
  function buildXie(mb, r) {
    const bays = Math.max(1, r.bays);
    const W = bays * r.bayW * 0.94, D = r.depth * 0.66;
    const h = Math.max(0.6, r.baseH) + 0.22;
    // 临水石台（柱插入水中）：石台顶收在台面下 2 cm、石柱顶再收到 h−0.04，
    // 原来 石台顶 = 榭台面底（45.03 m²）、石柱顶 = 榭台面顶（0.52 m²）两处严格齐平，
    // 一个水榭就把 45 m² 的同面顶在台面底下，转视角整片台面在闪。
    mb.box(-W / 2 - 0.45, W / 2 + 0.45, 0, h - 0.02, -D / 2 - 0.45, D / 2 + 0.45, 'stoneDark', '水榭·石台');
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        mb.boxC(sx * (W / 2 + 0.16), sz * (D / 2 + 0.16), 0.36, 0.36, 0.02, h - 0.04, 'stone', '水榭·石柱');
      }
    }
    mb.box(-W / 2 - 0.47, W / 2 + 0.47, h - 0.08, h, -D / 2 - 0.47, D / 2 + 0.47, 'slab', '榭台面');

    const colH = r.floorH;
    for (let i = 0; i <= bays; i++) {
      const x = -W / 2 + (W * i) / bays;
      for (const sz of [-1, 1]) {
        mb.cyl(x, sz * (D / 2 - 0.16), 0.16, h, h + colH, 8, r.colMat, '榭柱');
        mb.boxC(x, sz * (D / 2 - 0.16), 0.26, 0.26, h - 0.06, h + 0.12, 'stone', '柱础');
      }
    }
    for (const sz of [-1, 1]) {
      P.lintel(mb, { dir: sz > 0 ? 'front' : 'back', at: sz * (D / 2 - 0.16), uc: 0, w: W, y: h + colH - 0.36, h: 0.28, th: 0.2, seg: Math.max(3, bays), tag: '榭额枋' });
      GF.beamBetween(mb, [-W / 2, h + colH - 0.62, sz * (D / 2 - 0.16)], [W / 2, h + colH - 0.62, sz * (D / 2 - 0.16)], 0.06, 0.16, 'wood', '挂落');
    }
    // 三面美人靠（正面 +z 留出入口）
    P.railing(mb, { a: [-W / 2, -D / 2], b: [W / 2, -D / 2], y: h, style: 'beauty', tag: '美人靠' });
    P.railing(mb, { a: [-W / 2, -D / 2], b: [-W / 2, D / 2], y: h, style: 'beauty', tag: '美人靠' });
    P.railing(mb, { a: [W / 2, -D / 2], b: [W / 2, D / 2], y: h, style: 'beauty', tag: '美人靠' });
    // 正面石阶：两级，正对门口与匾额
    const stairW = Math.min(2.4, W * 0.42);
    mb.box(-stairW / 2, stairW / 2, h - 0.18, h - 0.02, D / 2 + 0.47, D / 2 + 0.95, 'slab', '榭前石阶');
    mb.box(-stairW / 2, stairW / 2, h * 0.5 - 0.14, h * 0.5, D / 2 + 0.95, D / 2 + 1.45, 'slab', '榭前石阶');
    // 室内：石桌
    P.furniture(mb, 'table', 0, 0, 1, 0, '榭中石桌');
    // 榭顶（卷棚或歇山）
    if (!r.cut.roof) {
      GF.roofs.build(mb, {
        cx: 0, cz: 0,
        x0: -W / 2 - r.eave, x1: W / 2 + r.eave,
        z0: -D / 2 - r.eave, z1: D / 2 + r.eave,
        yb: h + colH, rise: r.slope * (D / 2 + r.eave) * 0.8,
        type: r.roofType || 'roll',
        tile: r.tile, tileB: r.tileB, upturn: r.upturn * 1.1,
        ridgeStyle: r.ridgeStyle, beasts: 0, finial: false,
        xuanYu: r.xuanYu, windDuo: true, gableMat: r.wallMat, tag: '榭顶'
      });
    }
    if (r.plaque) P.plaque(mb, { dir: 'front', at: D / 2 - 0.02, uc: 0, vc: h + colH - 0.8, w: 1.3, h: 0.44, chars: 2 });
    // 接岸曲桥：从正面石阶接出去，与门口、匾额同一轴
    if (r.env.path) {
      P.quBridge(mb, [[0, D / 2 + 1.4], [0.9, D / 2 + 3.0], [0, D / 2 + 4.6]], 1.1, '接岸曲桥');
    }
  }

  /* ------------------------------ 画舫 ------------------------------ */
  function buildFang(mb, r) {
    if (r.fangStyle === 'shifang') return buildFang3(mb, r);
    const L = r.span || 12, Wd = r.bridgeW || 3.4;
    const deckY = 0.86;
    const half = Wd / 2;
    const pts = [
      [-L / 2, 0], [-L / 2 + 1.3, -half], [L / 2 - 2.6, -half],
      [L / 2 + 1.7, 0], [L / 2 - 2.6, half], [-L / 2 + 1.3, half]
    ];
    mb.prism(pts, 0, deckY, 'woodDark', '船体');
    mb.prism(pts.map((p) => [p[0] * 0.94, p[1] * 0.9]), deckY, deckY + 0.08, 'wood', '甲板');
    // 船头翘起的雕饰
    mb.boxC(L / 2 + 1.5, 0, 0.3, 0.3, deckY, deckY + 0.32, 'zhu', '船首');
    // 舱（前舱高、后舱低）
    const cx0 = -L / 4, cabW = L * 0.42, cabD = Wd * 0.66;
    const cabH = r.floorH * 0.86;
    for (const [ox, wMul, hMul] of [[-0.12, 1.0, 1.0], [0.3, 0.72, 0.74]]) {
      const cw = cabW * wMul, cw0 = cx0 + L * ox;
      const ch = cabH * hMul;
      const y0 = deckY + 0.08;
      // 舱壁
      for (const sz of [-1, 1]) {
        mb.box(cw0 - cw / 2, cw0 + cw / 2, y0, y0 + ch, sz * cabD / 2 - 0.08, sz * cabD / 2 + 0.08, 'wood', '舱壁');
      }
      mb.box(cw0 - cw / 2, cw0 + cw / 2, y0 + ch - 0.16, y0 + ch, -cabD / 2, cabD / 2, 'wood', '舱顶梁');
      // 格心窗
      for (let i = 0; i < 3; i++) {
        const wx = cw0 - cw / 2 + cw * (i + 0.5) / 3;
        mb.boxC(wx, cabD / 2, cw / 4.2, 0.1, y0 + ch * 0.42, y0 + ch * 0.78, 'paper', '舫窗');
      }
      // 卷棚舱顶
      if (!r.cut.roof) {
        GF.roofs.build(mb, {
          cx: cw0, cz: 0,
          x0: cw0 - cw / 2 - 0.25, x1: cw0 + cw / 2 + 0.25,
          z0: -cabD / 2 - 0.28, z1: cabD / 2 + 0.28,
          yb: y0 + ch, rise: 0.62, type: 'roll',
          tile: r.tile, tileB: r.tileB, upturn: 0.14, ridgeStyle: 'plain',
          gableMat: 'wood', tag: '舱顶'
        });
      }
    }
    // 舷边美人靠 + 橹
    for (const sz of [-1, 1]) {
      P.railing(mb, { a: [-L / 2 + 1.4, sz * (half - 0.12)], b: [L / 2 - 1.0, sz * (half - 0.12)], y: deckY + 0.08, style: 'beauty', tag: '舷栏' });
    }
    mb.boxC(-L / 2 - 0.2, half * 0.5, 0.1, 0.1, deckY, deckY + 1.9, 'wood', '橹');
  }

  /* ---------------- 阶段④-6 石舫 / 旱船（三段：尾舱二层 > 前舱敞亭 > 中舱船篷） ---------------- */
  function buildFang3(mb, r) {
    const L = r.span || 13, Wd = r.bridgeW || 3.6;
    const deckY = 0.86, half = Wd / 2;
    const pts = [
      [-L / 2, 0], [-L / 2 + 1.2, -half], [L / 2 - 2.4, -half],
      [L / 2 + 1.6, 0], [L / 2 - 2.4, half], [-L / 2 + 1.2, half]
    ];
    mb.prism(pts, 0, deckY, 'woodDark', '石舫·船体');
    mb.prism(pts.map((p) => [p[0] * 0.94, p[1] * 0.9]), deckY, deckY + 0.08, 'wood', '石舫·甲板');
    mb.boxC(L / 2 + 1.5, 0, 0.3, 0.3, deckY, deckY + 0.32, 'zhu', '船首');
    const stats = layStats(mb);

    // 尾舱（-x，二层楼阁，最高）
    const tail = { x: -L / 2 + L * 0.19, len: L * 0.30, D: Wd * 0.66 };
    const tailU = houseUnit(Object.assign({}, r, { baseH: 0.08, dougong: false, interior: [] }), {
      W: tail.len, D: tail.D, bays: 3, floors: 2, floorHList: [2.6, 2.3],
      roofType: 'gableHip', eave: 0.6, interior: [], cheap: true
    });
    tailU.mesh.translate(tail.x, deckY + 0.08, 0);
    mb.merge(tailU.mesh);
    stats.segs.push({ tag: '尾舱·二层楼阁', x: tail.x, z: 0, W: tail.len, D: tail.D, baseH: deckY + 0.08, topY: +(tailU.topY + deckY + 0.08).toFixed(3) });

    // 中舱（中段，最低，两坡船篷）
    const mid = { x: 0, len: L * 0.34, D: Wd * 0.6 };
    const midU = houseUnit(Object.assign({}, r, { baseH: 0.08, dougong: false, interior: [] }), {
      W: mid.len, D: mid.D, bays: 3, roofType: 'gable', eave: 0.5, interior: [], cheap: true
    });
    midU.mesh.translate(mid.x, deckY + 0.08, 0);
    mb.merge(midU.mesh);
    stats.segs.push({ tag: '中舱·船篷', x: mid.x, z: 0, W: mid.len, D: mid.D, baseH: deckY + 0.08, topY: +(midU.topY + deckY + 0.08).toFixed(3) });

    // 前舱（+x，高敞歇山敞亭，开敞无墙）
    const bow = { x: L / 2 - L * 0.19, len: L * 0.26, D: Wd * 0.7, colH: 2.6 };
    const bx0 = bow.x - bow.len / 2, bx1 = bow.x + bow.len / 2;
    for (const cx of [bx0 + 0.25, bow.x, bx1 - 0.25]) {
      for (const sz of [-1, 1]) {
        mb.cyl(cx, sz * (bow.D / 2 - 0.18), 0.14, deckY + 0.08, deckY + 0.08 + bow.colH, 8, r.colMat, '前舱·柱');
        mb.boxC(cx, sz * (bow.D / 2 - 0.18), 0.24, 0.24, deckY + 0.08, deckY + 0.2, 'stone', '前舱·础');
      }
    }
    for (const sz of [-1, 1]) {
      GF.beamBetween(mb, [bx0, deckY + 0.08 + bow.colH - 0.3, sz * (bow.D / 2 - 0.18)], [bx1, deckY + 0.08 + bow.colH - 0.3, sz * (bow.D / 2 - 0.18)], 0.14, 0.24, 'woodDark', '前舱·额枋');
    }
    if (!r.cut.roof) {
      GF.roofs.build(mb, {
        cx: bow.x, cz: 0, x0: bx0 - 0.3, x1: bx1 + 0.3, z0: -bow.D / 2 - 0.3, z1: bow.D / 2 + 0.3,
        yb: deckY + 0.08 + bow.colH, rise: 0.9, type: 'gableHip', tile: r.tile, tileB: r.tileB,
        upturn: 0.2, ridgeStyle: 'plain', beasts: 0, gableMat: 'wood', tag: '前舱·顶'
      });
    }
    stats.segs.push({ tag: '前舱·敞亭', x: bow.x, z: 0, W: bow.len, D: bow.D, baseH: deckY + 0.08, topY: +(deckY + 0.08 + bow.colH + 0.9).toFixed(3) });

    // 舷边美人靠
    for (const sz of [-1, 1]) {
      P.railing(mb, { a: [-L / 2 + 1.4, sz * (half - 0.12)], b: [L / 2 - 1.0, sz * (half - 0.12)], y: deckY + 0.08, style: 'beauty', tag: '舷栏' });
    }

    // 船头平桥接岸：桥面落在岸地标高（y≈0.12），不架在甲板高度
    const shoreX = L / 2 + 4.4, deckBridgeY = 0.12;
    mb.box(L / 2 + 1.2, shoreX, 0, deckBridgeY, -0.6, 0.6, 'stone', '接岸平桥');
    mb.box(L / 2 + 1.2, shoreX, deckBridgeY, deckBridgeY + 0.06, -0.6, 0.6, 'slab', '桥面');
    stats.bridge = { x0: L / 2 + 1.2, x1: shoreX, y: deckBridgeY, groundY: 0.1, width: 1.2 };
  }

  /* ------------------------------ 阙 ------------------------------ */
  function buildQue(mb, r) {
    const W = r.width || 11, D = 3.6, wallH = (r.wallH || 5) * 0.55;
    const t = 0.7, gw = 3.4, gh = wallH - 0.9;
    // 券洞：下部直墙 + 上部半圆（分 4 条横带近似）
    const gr = gw / 2, springY = Math.max(1.8, gh - gr * 0.9);
    const bands = [{ u0: -gw / 2, u1: gw / 2, v0: 0, v1: springY }];
    for (let k = 0; k < 4; k++) {
      const vc = k / 4 + 0.125;
      const hw = gr * Math.sqrt(Math.max(0.04, 1 - vc * vc));
      bands.push({ u0: -hw, u1: hw, v0: springY + (gr * 0.9 * k) / 4, v1: springY + (gr * 0.9 * (k + 1)) / 4 });
    }
    // 阙台（砖砌，中开券洞）
    P.wallWithHoles(mb, {
      dir: 'front', at: D / 2, u0: -W / 2, u1: W / 2, y0: 0, y1: wallH,
      holes: bands, thickness: t, mat: 'brick', tag: '阙台'
    });
    P.wallWithHoles(mb, {
      dir: 'back', at: -D / 2, u0: -W / 2, u1: W / 2, y0: 0, y1: wallH,
      holes: bands, thickness: t, mat: 'brick', tag: '阙台'
    });
    for (const side of ['left', 'right']) {
      const at = side === 'right' ? W / 2 : -W / 2;
      P.wallWithHoles(mb, {
        dir: side, at, u0: -D / 2, u1: D / 2, y0: 0, y1: wallH,
        holes: [], thickness: t, mat: 'brick', tag: '阙台'
      });
    }
    // 券洞内壁（暗）：五条横带互相咬进 3 mm。原来的带与带上下两条大面严格齐平
    // （每张 3.4×3.5 m，四条接缝合 37.31 m²），是阙身上最大的一处同面。
    bands.forEach((b, bi) => {
      const v0 = bi > 0 ? b.v0 - 0.003 : b.v0;
      const v1 = bi < bands.length - 1 ? b.v1 + 0.003 : b.v1;
      mb.box(b.u0 + 0.02, b.u1 - 0.02, v0, v1, -D / 2 + 0.05, D / 2 - 0.05, 'dark', '门洞');
    });
    for (let k = 0; k <= 10; k++) {
      const a = Math.PI * (k / 10);
      const ux = Math.cos(a) * (gr + 0.08), vy = springY + Math.sin(a) * (gr * 0.9 + 0.08);
      for (const sz of [-1, 1]) {
        mb.box(ux - 0.18, ux + 0.18, vy - 0.14, vy + 0.14, sz * D / 2 - 0.1, sz * D / 2 + 0.1, 'slab', '券石');
      }
    }
    // 台面 + 城垛：台面顶抬到墙顶以上 2 cm（墙顶原来与台面顶同平面，整圈 7.7 m² 在闪），
    // 城垛再坐进台面 2 cm（原来 城垛底 = 台面顶 5.98 m²、城垛侧面 = 阙台立面 5.25 m²）
    mb.box(-W / 2, W / 2, wallH - 0.2, wallH + 0.02, -D / 2, D / 2, 'brick', '阙台面');
    const nb = Math.round(W / 1.1);
    for (let i = 0; i <= nb; i++) {
      const x = -W / 2 + (W * i) / nb;
      for (const sz of [-1, 1]) mb.boxC(x, sz * (D / 2 - 0.36), 0.5, 0.62, wallH - 0.02, wallH + 0.7, 'brick', '城垛');
    }
    // 两侧子阙（高台 + 小屋顶）
    for (const sx of [-1, 1]) {
      const tx = sx * (W / 2 - 1.0);
      const tw = 2.0, td = 2.6, th = wallH + 2.2;
      // 子阙右/左侧面原来与阙台山墙内皮严格同面（1.82 m²）：向外多咬 6 cm 进墙
      mb.box(tx - tw / 2, tx + tw / 2 + sx * 0.06, -0.03, th, -td / 2, td / 2, 'brick', '子阙');
      mb.box(tx - tw / 2 - 0.3, tx + tw / 2 + sx * 0.06 + 0.3 * sx, th - 0.02, th + 0.16, -td / 2 - 0.3, td / 2 + 0.3, 'slab', '子阙·台面');
      if (!r.cut.roof) {
        GF.roofs.build(mb, {
          cx: tx, cz: 0, x0: tx - tw / 2 - 0.5, x1: tx + tw / 2 + 0.5,
          z0: -td / 2 - 0.5, z1: td / 2 + 0.5, yb: th + 0.16,
          rise: 0.9, type: 'gableHip', tile: r.tile, tileB: r.tileB,
          upturn: 0.3, ridgeStyle: 'plain', beasts: 0, tag: '子阙顶'
        });
      }
    }
    if (r.plaque) P.plaque(mb, { dir: 'front', at: D / 2 + 0.06, uc: 0, vc: wallH - 0.55, w: 2.0, h: 0.5, chars: 3 });
  }

  /* ------------------------------ 长廊 ------------------------------ */
  function buildCorridor(mb, r) {
    const L = r.span || 14, Wd = r.bridgeW || 2.8;
    const m = corridorMesh(r, L, Wd, 0.32, {});
    mb.merge(m);
    // 两端台阶
    for (const sx of [-1, 1]) {
      mb.box(sx * L / 2, sx * (L / 2 + 1.4), 0, 0.32, -Wd / 2, Wd / 2, 'stone', '廊端石阶');
    }
  }

  /* ------------------------------ 露台 ------------------------------ */
  function buildTai(mb, r) {
    const W = r.width || 8, D = r.depth || 6, h = Math.max(0.6, r.baseH);
    P.platform(mb, {
      x0: -W / 2, x1: W / 2, z0: -D / 2, z1: D / 2, h,
      steps: r.steps, stepW: Math.min(3.4, W * 0.5), stepDir: 'front',
      style: r.pedestal || 'xumizuo', lotus: (r.pedestal || 'xumizuo') === 'xumizuo'
    });
    if (r.railing) {
      const st = r.railStyle || 'marble';
      for (const [a, b] of [
        [[-W / 2, -D / 2], [W / 2, -D / 2]],
        [[-W / 2, -D / 2], [-W / 2, D / 2]],
        [[W / 2, -D / 2], [W / 2, D / 2]]
      ]) P.railing(mb, { a, b, y: h, style: st, tag: '露台栏杆' });
    }
    // 台上陈设
    if (r.censer) P.censer(mb, 0, -0.6, 1.1, '露台香炉');
    for (const sx of [-1, 1]) {
      P.stoneLantern(mb, sx * (W / 2 - 1.2), D / 2 - 1.0, 1.0, '石灯');
    }
    if (r.lanterns) {
      for (const sx of [-1, 1]) P.lantern(mb, sx * (W / 2 - 0.9), h + 2.4, D / 2 - 0.4, 0.9, '灯笼');
    }
    // 一座小亭或碑，避免台面太空
    if (r.plaque) P.stele(mb, 0, D / 2 - 1.6, 1.0, '露台碑');
  }

  /* ------------------------------ 环境 ------------------------------ */
  function environment(mb, r) {
    ground(mb, r);
    const rng = new GF.RNG(r.seed + 91);
    const env = r.env;
    // 拖动结果：按 key 覆盖默认落位（key 稳定，列表变动时只影响同序号）
    const mv = env.move || {};
    const at = (key, x, z) => (mv[key] ? { x: mv[key].x, z: mv[key].z } : { x, z });
    mb.moves = [];
    const reg = (key, label, p, rad) => mb.moves.push({ key, label, x: p.x, z: p.z, r: rad || 0.8 });
    const ITEM_LABEL = {
      pine: '松', plum: '梅', bamboo: '竹', willow: '柳', maple: '枫', gingko: '银杏',
      misc: '杂树', banana: '芭蕉', taihu: '太湖石', qianshi: '千层石',
      stonelamp: '石灯', well: '井', stele: '碑', bell: '钟', drum: '鼓',
      penjing: '盆景', tiema: '拴马桩', table: '石桌', stool: '石凳', banner: '幡'
    };
    // 建一件（原点局部坐标）
    const buildItem = (sub, it, s) => {
      const rr = new GF.RNG((r.seed || 1) + 977 + (it.k || '').length * 31);
      switch (it.k) {
        case 'pine': case 'plum': case 'bamboo': case 'willow': case 'maple':
        case 'gingko': case 'misc': case 'banana':
          P.tree(sub, 0, 0, it.k, rr, s, '组件树');
          break;
        case 'taihu': case 'qianshi':
          P.rock(sub, 0, 0, s, rr, '组件石', it.k);
          break;
        case 'stonelamp': P.stoneLantern(sub, 0, 0, 0.9 * s, '石灯'); break;
        case 'well': P.well(sub, 0, 0, 0.9 * s, '井'); break;
        case 'stele': P.stele(sub, 0, 0, 0.9 * s, '碑'); break;
        case 'bell': P.bellDrum(sub, 0, 0, 0.85 * s, 'bell', '钟'); break;
        case 'drum': P.bellDrum(sub, 0, 0, 0.85 * s, 'drum', '鼓'); break;
        case 'penjing': P.penjing(sub, 0, 0, 0.9 * s, '盆景'); break;
        case 'tiema': P.tieMaZhuang(sub, 0, 0, 0.9 * s, '拴马桩'); break;
        case 'table': P.furniture(sub, 'table', 0, 0, s, 0, '石桌'); break;
        case 'stool': P.furniture(sub, 'stool', 0, 0, s, 0, '石凳'); break;
        case 'banner': P.banner(sub, 0, 0, 0, 4.2 * s, 1.15 * s, '幡', 'cloth'); break;
        default: break;
      }
    };
    const renderEntry = (it, key, i, n) => {
      const p = { x: it.x || 0, z: it.z || 0 };
      const s = it.s == null ? 1 : it.s;
      const sub = new GF.Mesh();
      buildItem(sub, it, s);
      sub.rotateY(it.rot || 0);
      sub.translate(p.x, it.y || 0, p.z);
      mb.merge(sub);
      reg(key, (ITEM_LABEL[it.k] || it.k) + ' ' + (i + 1), p, 1.0);
    };

    // 预设自带的环境陈设（树 / 假山 / 幡 / 道具）一次性展开成可编辑条目：
    // 展开后与组件条落进来的自由件走同一套渲染和拾取，配方里的选择才能在「组件编辑」里逐件调。
    if (!Array.isArray(env.auto)) {
      const auto = [];
      const trees = env.trees || [];
      trees.forEach((k, i) => {
        const ang = (i / (trees.length || 1)) * Math.PI * 2 + 0.6;
        const dist = 6.5 + (i % 2) * 1.5;
        const p = at('tree' + i, Math.cos(ang) * dist, Math.sin(ang) * dist);
        auto.push({ k, x: +p.x.toFixed(2), z: +p.z.toFixed(2), y: 0, rot: Math.round(rng.range(-14, 14)), s: +(0.9 + (i % 3) * 0.15).toFixed(2) });
      });
      for (let i = 0; i < (env.rocks || 0); i++) {
        const ang = 2.4 + i * 0.9;
        const p = at('rock' + i, Math.cos(ang) * 5.2, Math.sin(ang) * 5.2);
        auto.push({ k: 'taihu', x: +p.x.toFixed(2), z: +p.z.toFixed(2), y: 0, rot: Math.round(rng.range(-16, 16)), s: 1 });
      }
      for (let i = 0; i < (env.banners || 0); i++) {
        const sgn = i % 2 ? 1 : -1, bi = Math.floor(i / 2);
        const p = at('banner' + i, sgn * (3.4 + bi * 3.2), 0);
        auto.push({ k: 'banner', x: +p.x.toFixed(2), z: +p.z.toFixed(2), y: 0, rot: 0, s: 1 });
      }
      (env.props || []).forEach((pp, i) => {
        if (pp === 'qubridge') return;   // 曲桥不走单件，仍按整组做
        const ang = 2.1 + i * 0.68, d = 4.2 + (i % 3) * 1.2;
        const q = at('prop' + i, Math.cos(ang) * d, Math.sin(ang) * d);
        auto.push({ k: pp, x: +q.x.toFixed(2), z: +q.z.toFixed(2), y: 0, rot: Math.round(rng.range(-20, 20)), s: 1 });
      });
      env.auto = auto;
    }
    (env.auto || []).forEach((it, i) => renderEntry(it, 'auto' + i, i));
    // 水池与曲桥：整组构造，不参与单件编辑
    if (env.pond && env.showGround !== false && env.groundType !== 'lake') {
      const p = at('pond', env.pond.x || 5.5, env.pond.z || 4.5);
      P.pond(mb, p.x, p.z, env.pond.w || 3.4, env.pond.d || 2.4, '水池');
      reg('pond', '水池', p, Math.max(env.pond.w || 3.4, env.pond.d || 2.4) * 0.6);
    }
    if ((env.props || []).indexOf('qubridge') >= 0) {
      P.quBridge(mb, [[3.0, 3.8], [4.8, 1.6], [3.4, -0.8]], 1.0, '曲桥');
    }
    // 组件条落进来的自由件：类型、落点、高度、旋转、大小全存在 env.items 里，数量不限。
    (env.items || []).forEach((it, i) => {
      const p = at('item' + i, it.x || 0, it.z || 0);
      const sub = new GF.Mesh();
      buildItem(sub, it, it.s == null ? 1 : it.s);
      sub.rotateY(it.rot || 0);
      sub.translate(p.x, it.y || 0, p.z);
      mb.merge(sub);
      reg('item' + i, (ITEM_LABEL[it.k] || it.k) + ' #' + (i + 1), p, 1.0);
    });
  }
