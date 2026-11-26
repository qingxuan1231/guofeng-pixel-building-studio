'use strict';
  /* ---------------- 阶段④-1 寺·五进中轴（temple5） ---------------- */
  function courtyardTemple5(mb, r, ctx) {
    const { CW, CD } = ctx;
    const rng = new GF.RNG(r.seed + 21);
    const zF = CD / 2, zB = -CD / 2;
    P.courtWall(mb, {
      x0: -CW / 2, x1: CW / 2, z0: zB, z1: zF, y: 3.0,
      gate: { side: 'front', w: 2.8, h: 2.7, shape: 'rect' }, windows: null, windowPattern: r.winPattern
    });

    // 山门（一门三洞意象：三间门屋 + 两侧深色门洞）
    const gz = zF - 2.4;
    axisUnit(mb, r, {
      tag: '山门', z: gz, r: { baseH: 0.2, dougong: false },
      unit: { W: 7.8, D: 3.0, bays: 3, roofType: 'roll', eave: 0.8, plaque: true, chars: 3, cheap: true }
    });
    for (const sx of [-1, 1]) mb.box(sx * 2.55 - 0.5, sx * 2.55 + 0.5, 0.2, 2.3, gz + 1.35, gz + 1.5, 'dark', '山门·侧洞');

    // 钟鼓楼（山门院两侧）
    for (const sx of [-1, 1]) {
      const tx = sx * (CW / 2 - 3.4), tz = zF - 6.4;
      mb.box(tx - 1.6, tx + 1.6, 0, 0.4, tz - 1.6, tz + 1.6, 'stone', sx > 0 ? '钟楼台' : '鼓楼台');
      smallPavilion(mb, r, tx, tz, 1.5, 3.2, 'pyramid', sx > 0 ? '钟楼' : '鼓楼', 0.4);
      P.bellDrum(mb, tx, tz, 0.9, sx > 0 ? 'bell' : 'drum', sx > 0 ? '钟' : '鼓');
      layStats(mb).flanks.push({ tag: sx > 0 ? '钟楼' : '鼓楼', x: tx, z: tz, W: 3.0, D: 3.0, baseH: 0.4, rot: 0 });
    }

    // 一进隔墙：山门院 / 天王殿院
    crossWall(mb, r, { z: zF - 8.2, x0: -CW / 2, x1: CW / 2, gateW: 2.8, gateH: 2.5, tag: '一进隔墙' });

    // 天王殿
    const kz = zF - 11.2;
    axisUnit(mb, r, {
      tag: '天王殿', z: kz, r: { baseH: 0.35, dougong: false },
      unit: { W: 6.6, D: 3.8, bays: 3, roofType: 'gable', eave: 0.9, veranda: true, cheap: true }
    });
    // 东西配殿（伽蓝 / 祖师）
    for (const sx of [-1, 1]) {
      flankUnit(mb, r, {
        tag: sx > 0 ? '祖师殿' : '伽蓝殿', x: sx * (CW / 2 - 2.8), z: kz,
        r: { baseH: 0.3, dougong: false }, unit: { W: 4.4, D: 3.0, bays: 3, roofType: 'gable', eave: 0.7, cheap: true }
      });
    }

    // 二进隔墙：天王殿院 / 大雄宝殿院
    crossWall(mb, r, { z: 2.4, x0: -CW / 2, x1: CW / 2, gateW: 3.0, gateH: 2.6, tag: '二进隔墙' });

    // 大雄宝殿：全寺最高最大，须弥座台基 + 月台 + 庑殿
    // 台基由 axisUnit 走标准 platform 三档形制（须弥座），以殿身中心 (0, mz) 为心生成；
    // 台基自带中央踏跺（steps:3，与法堂同制），台基与台阶天然合成 parts.base 一件；
    // 月台改为殿前两翼露台，分列中央踏跺两侧，贴台基南立面之外 2 cm，顶面与须弥座台面等高，
    // 两翼各自成件仍独立可调，恢复古建「台基 + 台阶一体、月台翼出」形制。
    const mz = -3.2, mW = 9.6, mD = 5.4, mBase = 0.75;
    const baseMesh = new GF.Mesh();
    // 月台：殿前两翼露台（走断面环，不再 box 叠面；面阔 / 进深可被「月台」部件单独调整）
    // 整体在殿身本地坐标系里生成（殿身中心为原点，台基前缘 z=mD/2=2.7），
    // 由 axisUnit 连带殿身一起平移、一起登记进『u:大雄宝殿』拖动区间，
    // 拖动大雄宝殿时台基、两翼露台、踏跺、栏杆作为一个整体移动，不再留下悬空件。
    const mtOv = (r.units && r.units['大雄宝殿']) || {};
    // 面阔默认取殿身全宽 + 0.4 m，覆盖到最外两间檐廊柱（柱在 x=±mW/2）
    const mtW = mtOv.terraceW != null ? +mtOv.terraceW : mW + 0.4;
    const mtD = mtOv.terraceD != null ? +mtOv.terraceD : 1.4;
    // 露台顶面必须跟台基实际高度走（台基高可被「台基」部件覆盖）：
    // 与 axisUnit 同一套覆盖规则算出台基有效高度，台多高露台就多高。
    const govB = unitOverride(r, '大雄宝殿');
    const grrB = Object.assign({}, unitRecipe(r, govB), { railing: false }, { baseH: mBase });
    if (govB) UNIT_RECIPE.forEach((k) => { if (govB[k] != null) grrB[k] = govB[k]; });
    const mtTop = grrB.baseH;
    // 本地坐标系以殿身中心为原点；台基台明四周各外放 0.5 m，前立面在 z=mD/2+0.5：
    // 两翼露台贴台基前立面之外 2 cm 起，向前 → +z 方向翼出，与中央踏跺同制。
    const z0 = mD / 2 + 0.5 + 0.02, z1 = z0 + mtD;
    const stairHalf = 1.94, halfW = Math.max(mtW / 2, stairHalf + 0.15);
    for (const sg of [-1, 1]) {
      const xa = sg * stairHalf, xb = sg * halfW;
      const x0 = Math.min(xa, xb), x1 = Math.max(xa, xb), w = x1 - x0;
      P.loftRect(baseMesh, (x0 + x1) / 2, (z0 + z1) / 2, [
        { y: 0, w: w, d: mtD },
        { y: mtTop, w: w, d: mtD, m: 'stoneDark' },
        { y: mtTop, w: w - 0.04, d: mtD - 0.04, m: 'stoneDark' }
      ], '大雄月台');
      P.capRect(baseMesh, (x0 + x1) / 2, (z0 + z1) / 2, w - 0.08, mtD - 0.08, mtTop, 'slabTop', '月台台面');
      // 两翼栏杆：外缘竖边 + 前缘横边各一段（内缘贴踏跺留口）
      P.railing(baseMesh, { a: [x1, z0], b: [x1, z1], y: mtTop, style: 'marble', tag: '月台栏' });
      P.railing(baseMesh, { a: [x0, z1], b: [x1, z1], y: mtTop, style: 'marble', tag: '月台栏' });
    }
    // 月台显隐：隐藏台基时月台一并隐藏（一体台基），也可用「月台」开关单独隐藏；
    // 无论显隐都登记 parts.terrace 包围盒，部件条上「月台」仍可选中 / 调尺寸。
    const mtBlk = (r.units && r.units['大雄宝殿'] && r.units['大雄宝殿'].parts && r.units['大雄宝殿'].parts.hide) || {};
    const showMt = !mtBlk.base && !mtBlk.terrace;
    const bigBase = baseMesh.triCount ? baseMesh.bounds() : null;
    axisUnit(mb, r, {
      tag: '大雄宝殿', z: mz, statBaseH: mBase,
      extraMesh: showMt ? baseMesh : null,
      extraParts: bigBase ? { terrace: bigBase } : null,
      r: { baseH: mBase, steps: 3, railing: false, dougong: true, dgScale: 0.9, dgStyle: 'full' },
      unit: { W: mW, D: mD, bays: 5, roofType: 'hip', eave: 1.2, veranda: true, partition: 1.2 }
    });
    P.censer(mb, 0, mz + mD / 2 + 2.4, 1.3, '香炉');
    for (const sx of [-1, 1]) P.lion(mb, sx * (mW / 2 + 0.9), mz + mD / 2 + 1.6, 1.0, '石狮');

    // 三进隔墙：大殿院 / 法堂院
    crossWall(mb, r, { z: -6.8, x0: -CW / 2, x1: CW / 2, gateW: 2.6, gateH: 2.4, tag: '三进隔墙' });

    // 法堂：z 后移 0.1 m、踏跺 4 级减为 3 级，末级前立面停在 z=-6.2，
    // 与大雄宝殿须弥座后墙（z=-6.4）留出 0.2 m 间隙，消除台基全段共面。
    axisUnit(mb, r, {
      tag: '法堂', z: -9.7, r: { baseH: 0.95, steps: 3, dougong: false },
      unit: { W: 7.0, D: 4.2, bays: 3, roofType: 'gableHip', eave: 1.0, veranda: true, cheap: true }
    });

    // 四进隔墙：法堂 / 藏经阁（法堂后移后同步后移 0.2 m，避免与法堂须弥座后墙嵌入）
    crossWall(mb, r, { z: -12.6, x0: -CW / 2, x1: CW / 2, gateW: 2.4, gateH: 2.3, tag: '四进隔墙' });

    // 藏经阁（后阁，二层）
    axisUnit(mb, r, {
      tag: '藏经阁', z: -14.4, r: { baseH: 1.1, dougong: false },
      unit: { W: 6.0, D: 4.0, bays: 3, floors: 2, floorHList: [3.0, 2.6], roofType: 'gableHip', eave: 0.9, cheap: true }
    });

    // 东西院：禅堂 / 斋堂（主轴之外，体量低矮）
    for (const sx of [-1, 1]) {
      flankUnit(mb, r, {
        tag: sx > 0 ? '斋堂' : '禅堂', x: sx * (CW / 2 - 2.6), z: -14.4,
        r: { baseH: 0.85, dougong: false }, unit: { W: 3.6, D: 3.0, bays: 2, roofType: 'gable', eave: 0.6, cheap: true }
      });
    }
    P.tree(mb, -CW / 2 + 1.6, kz + 1.0, 'pine', rng, 1.0, '松');
    P.tree(mb, CW / 2 - 1.6, kz + 1.0, 'pine', rng, 1.0, '松');
  }

  /* ---------------- 阶段④-2 道观（daoguan） ---------------- */
  function courtyardDao(mb, r, ctx) {
    const { CW, CD } = ctx;
    const rng = new GF.RNG(r.seed + 22);
    const zF = CD / 2, zB = -CD / 2;
    P.courtWall(mb, {
      x0: -CW / 2, x1: CW / 2, z0: zB, z1: zF, y: 3.0,
      gate: { side: 'front', w: 2.6, h: 2.6, shape: 'rect' }, windows: null, windowPattern: r.winPattern
    });

    axisUnit(mb, r, {
      tag: '山门', z: zF - 2.4, r: { baseH: 0.25, dougong: false },
      unit: { W: 6.6, D: 2.8, bays: 3, roofType: 'roll', eave: 0.75, plaque: true, chars: 3, cheap: true }
    });

    const lz = zF - 6.6;
    axisUnit(mb, r, {
      tag: '灵官殿', z: lz, r: { baseH: 0.4, dougong: false },
      unit: { W: 5.6, D: 3.4, bays: 3, roofType: 'gable', eave: 0.85, veranda: true, cheap: true }
    });

    // 钟鼓楼
    for (const sx of [-1, 1]) {
      const tx = sx * (CW / 2 - 3.0), tz = zF - 3.4;
      mb.box(tx - 1.4, tx + 1.4, 0, 0.36, tz - 1.4, tz + 1.4, 'stone', sx > 0 ? '钟楼台' : '鼓楼台');
      smallPavilion(mb, r, tx, tz, 1.3, 3.0, 'pyramid', sx > 0 ? '钟楼' : '鼓楼', 0.36);
      P.bellDrum(mb, tx, tz, 0.85, sx > 0 ? 'bell' : 'drum', sx > 0 ? '钟' : '鼓');
      layStats(mb).flanks.push({ tag: sx > 0 ? '钟楼' : '鼓楼', x: tx, z: tz, W: 2.6, D: 2.6, baseH: 0.36, rot: 0 });
    }

    crossWall(mb, r, { z: zF - 8.6, x0: -CW / 2, x1: CW / 2, gateW: 2.6, gateH: 2.4, tag: '前院隔墙' });

    // 三清殿（主殿，月台，歇山）
    // 台基同样以殿身中心 (0, mz) 为心生成，由 axisUnit 走标准 platform 三档形制（须弥座）；
    // 月台为殿前附属石台，独立一件 —— 不再用 tieredTerrace 两层叠台 + 殿身自带须弥座两套台基叠置。
    const mz = -1.8, mW = 8.4, mD = 5.0, mBase = 0.7;
    const msh = unitShift(r, '三清殿');
    const baseMesh = new GF.Mesh();
    const mtOv = (r.units && r.units['三清殿']) || {};
    const mtW = mtOv.terraceW != null ? +mtOv.terraceW : mW * 0.68;
    const mtD = mtOv.terraceD != null ? +mtOv.terraceD : 1.6;
    const mtTop = mBase;
    const mtCz = mz + mD / 2 + 0.5 + 0.02 + mtD / 2;
    P.loftRect(baseMesh, 0, mtCz, [
      { y: 0, w: mtW, d: mtD },
      { y: mtTop, w: mtW, d: mtD, m: 'stoneDark' },
      { y: mtTop, w: mtW - 0.04, d: mtD - 0.04, m: 'stoneDark' }
    ], '三清月台');
    P.capRect(baseMesh, 0, mtCz, mtW - 0.08, mtD - 0.08, mtTop, 'slabTop', '月台台面');
    baseMesh.translate(msh.dx, 0, msh.dz);
    // 月台显隐：隐藏台基时月台一并隐藏（一体台基），也可用「月台」开关单独隐藏
    const mtBlk = (r.units && r.units['三清殿'] && r.units['三清殿'].parts && r.units['三清殿'].parts.hide) || {};
    if (!mtBlk.base && !mtBlk.terrace) mb.merge(baseMesh);
    axisUnit(mb, r, {
      tag: '三清殿', z: mz, statBaseH: mBase,
      r: { baseH: mBase, steps: 0, railing: false, dougong: true, dgScale: 0.85, dgStyle: 'full' },
      unit: { W: mW, D: mD, bays: 5, roofType: 'gableHip', eave: 1.1, veranda: true, partition: 1.2 }
    });
    // 月台注册为独立构件「月台」：自带选中框，不再并入台基包围盒，可单独选中 / 调尺寸 / 隐藏
    const bigBase = baseMesh.triCount ? baseMesh.bounds() : null;
    const su = mb.units && mb.units[mb.units.length - 1];
    if (bigBase && su && su.id === '三清殿' && su.parts) {
      su.parts.terrace = bigBase;
    }
    P.censer(mb, 0, mz + mD / 2 + 2.0, 1.2, '香炉');

    // 东西配殿：执事房 / 客堂
    for (const sx of [-1, 1]) {
      flankUnit(mb, r, {
        tag: sx > 0 ? '客堂' : '执事房', x: sx * (CW / 2 - 2.6), z: mz,
        r: { baseH: 0.4, dougong: false }, unit: { W: 4.0, D: 3.0, bays: 3, roofType: 'gable', eave: 0.7, cheap: true }
      });
    }

    crossWall(mb, r, { z: -5.6, x0: -CW / 2, x1: CW / 2, gateW: 2.4, gateH: 2.3, tag: '后院隔墙' });

    // 后阁（二层藏经 / 三清四御）
    axisUnit(mb, r, {
      tag: '三清阁', z: -8.8, r: { baseH: 0.95, dougong: false },
      unit: { W: 5.6, D: 3.8, bays: 3, floors: 2, floorHList: [2.9, 2.5], roofType: 'gableHip', eave: 0.85, cheap: true }
    });

    P.tree(mb, -CW / 2 + 1.5, 2.0, 'pine', rng, 0.95, '松');
    P.tree(mb, CW / 2 - 1.5, 2.0, 'pine', rng, 0.95, '松');
  }

  /* ---------------- 阶段④-3 五进四合院（wujin） ---------------- */
  function courtyardWujin(mb, r, ctx) {
    const { CW, CD } = ctx;
    const rng = new GF.RNG(r.seed + 23);
    const zF = CD / 2, zB = -CD / 2, wallH = 3.0;
    // 外围墙：东南隅开门（前墙东侧留门洞）
    const gateX = CW / 4, gateW = 2.4;
    mb.box(-CW / 2, gateX - gateW / 2, 0, wallH, zF - 0.15, zF + 0.15, 'plaster', '院墙·前');
    mb.box(gateX + gateW / 2, CW / 2, 0, wallH, zF - 0.15, zF + 0.15, 'plaster', '院墙·前');
    // 压顶与瓦脊由 courtWall 统一出（body:false 只出压顶/脊）：
    // 这里自己再建一条压顶，会与 courtWall 那条同面叠着，整条 20 m² 转到侧面就闪。
    P.courtWall(mb, {
      x0: -CW / 2, x1: CW / 2, z0: zB, z1: zF, y: wallH, body: false, windows: null
    });
    mb.box(-CW / 2, CW / 2, 0, wallH, zB - 0.15, zB + 0.15, 'plaster', '院墙·后');
    mb.box(-CW / 2 - 0.15, -CW / 2 + 0.15, 0, wallH, zB, zF, 'plaster', '院墙·左');
    mb.box(CW / 2 - 0.15, CW / 2 + 0.15, 0, wallH, zB, zF, 'plaster', '院墙·右');
    // 宅门（东南角）
    for (const sx of [-1, 1]) mb.box(gateX + sx * gateW / 2 - 0.1, gateX + sx * gateW / 2 + 0.1, 0.1, 2.5, zF - 0.2, zF + 0.2, 'woodDark', '宅门·框');
    mb.box(gateX - gateW / 2 + 0.05, gateX - 0.03, 0.1, 2.3, zF - 0.06, zF + 0.06, 'zhu', '宅门·扇');
    mb.box(gateX + 0.03, gateX + gateW / 2 - 0.05, 0.1, 2.3, zF - 0.06, zF + 0.06, 'zhu', '宅门·扇');
    if (!r.cut.roof) {
      GF.roofs.build(mb, {
        cx: gateX, cz: zF, x0: gateX - gateW / 2 - 0.7, x1: gateX + gateW / 2 + 0.7, z0: zF - 0.9, z1: zF + 0.9,
        yb: 2.78, rise: 0.7, type: 'gable', tile: r.tile, tileB: r.tileB,
        upturn: 0.25, ridgeStyle: 'plain', beasts: 0, gableMat: r.wallMat, tag: '宅门顶'
      });
    }
    layStats(mb).walls.push({ tag: '宅门（东南隅）', z: zF, gateW, x0: -CW / 2, x1: CW / 2, h: wallH, gateX });

    // 第一进：倒座（朝院内 -z）
    const dz = zF - 2.6;
    const dzOv = unitOverride(r, '倒座');
    const dzRu = unitRecipe(r, dzOv);
    const dzGeom = unitGeom({ W: 8.0, D: 3.2, bays: 3, roofType: 'gable', eave: 0.7, cheap: true }, dzOv);
    const dzUnit = houseUnit(Object.assign({}, dzRu, { baseH: dzOv && dzOv.baseH != null ? dzOv.baseH : 0.25, dougong: false }), dzGeom);
    dzUnit.mesh.rotateY(180);
    const dzSh = unitShift(r, '倒座');
    dzUnit.mesh.translate(dzSh.dx, 0, dz + dzSh.dz);
    mb.merge(dzUnit.mesh, 'u:倒座');
    regUnit(mb, '倒座', '倒座房', dzSh.dx, dz + dzSh.dz, dzGeom.W, dzGeom.D, 180, dzUnit.topY, 0.25, false, dzUnit.parts);
    layStats(mb).axis.push({ tag: '倒座', x: 0, z: dz, W: 8.0, D: 3.2, baseH: 0.25, topY: dzUnit.topY });

    // 垂花门（一进 / 二进）
    crossWall(mb, r, { z: zF - 6.6, x0: -CW / 2, x1: CW / 2, gateW: 2.6, gateH: 2.5, tag: '垂花门' });

    // 二进：东西厢 + 正房
    for (const sx of [-1, 1]) {
      flankUnit(mb, r, {
        tag: sx > 0 ? '东厢房' : '西厢房', x: sx * (CW / 2 - 2.6), z: zF - 10.6,
        r: { baseH: 0.35, dougong: false }, unit: { W: 5.2, D: 3.0, bays: 3, roofType: 'gable', eave: 0.7, cheap: true }
      });
    }
    const z2 = zF - 13.4;
    axisUnit(mb, r, {
      tag: '二进正房', z: z2, r: { baseH: 0.5, dougong: false },
      unit: { W: 6.4, D: 4.4, bays: 3, roofType: 'gable', eave: 0.9, veranda: true, partition: 0.9, cheap: true }
    });

    crossWall(mb, r, { z: z2 - 3.4, x0: -CW / 2, x1: CW / 2, gateW: 2.4, gateH: 2.4, tag: '二进隔墙' });

    // 三进：正房 + 耳房（耳房低于正房）
    const z3 = z2 - 6.4;
    axisUnit(mb, r, {
      tag: '三进正房', z: z3, r: { baseH: 0.65, dougong: false },
      unit: { W: 6.0, D: 4.2, bays: 3, roofType: 'gable', eave: 0.9, veranda: true }
    });
    for (const sx of [-1, 1]) {
      flankUnit(mb, r, {
        tag: sx > 0 ? '东耳房' : '西耳房', x: sx * (6.0 / 2 + 1.3), z: z3,
        r: { baseH: 0.4, dougong: false }, unit: { W: 2.4, D: 3.4, bays: 1, roofType: 'gable', eave: 0.55, cheap: true }
      });
    }

    crossWall(mb, r, { z: z3 - 3.2, x0: -CW / 2, x1: CW / 2, gateW: 2.2, gateH: 2.3, tag: '三进隔墙' });

    // 四进：正房（体量递减）
    const z4 = z3 - 6.0;
    axisUnit(mb, r, {
      tag: '四进正房', z: z4, r: { baseH: 0.55, dougong: false },
      unit: { W: 5.4, D: 3.8, bays: 3, roofType: 'gable', eave: 0.8, cheap: true }
    });

    // 后罩房
    const zb = zB + 2.2;
    const zbOv = unitOverride(r, '后罩房');
    const zbRu = unitRecipe(r, zbOv);
    const zbGeom = unitGeom({ W: 8.4, D: 3.0, bays: 3, roofType: 'gable', eave: 0.7, cheap: true }, zbOv);
    const zbUnit = houseUnit(Object.assign({}, zbRu, { baseH: zbOv && zbOv.baseH != null ? zbOv.baseH : 0.4, dougong: false }), zbGeom);
    zbUnit.mesh.rotateY(180);
    const zbSh = unitShift(r, '后罩房');
    zbUnit.mesh.translate(zbSh.dx, 0, zb + zbSh.dz);
    mb.merge(zbUnit.mesh, 'u:后罩房');
    regUnit(mb, '后罩房', '后罩房', zbSh.dx, zb + zbSh.dz, zbGeom.W, zbGeom.D, 180, zbUnit.topY, 0.4, false, zbUnit.parts);
    layStats(mb).axis.push({ tag: '后罩房', x: 0, z: zb, W: 8.4, D: 3.0, baseH: 0.4, topY: zbUnit.topY });

    // 抄手游廊：沿东西院墙串联各进
    if (!r.cut.roof) {
      for (const sx of [-1, 1]) {
        corridorRun(mb, r, sx * (CW / 2 - 1.1), zF - 4.2, sx * (CW / 2 - 1.1), zB + 4.0, 1.0, 0.02, '抄手游廊', { plain: true });
      }
    }
    P.tree(mb, -2.4, zF - 10.6, 'bamboo', rng, 0.9, '竹');
    P.tree(mb, 2.4, zF - 10.6, 'plum', rng, 0.9, '梅');
    P.rock(mb, 3.0, z3 + 1.0, 0.7, rng, '假山');
  }

  /* ---------------- 阶段④-4 廊院式祠庙（langyuan） ---------------- */
  function courtyardLangyuan(mb, r, ctx) {
    const { CW, CD } = ctx;
    const rng = new GF.RNG(r.seed + 24);
    const zF = CD / 2, zB = -CD / 2;
    P.courtWall(mb, {
      x0: -CW / 2, x1: CW / 2, z0: zB, z1: zF, y: 3.0,
      gate: { side: 'front', w: 2.6, h: 2.6, shape: 'rect' }, windows: null, windowPattern: r.winPattern
    });

    // 主殿居中（北）
    const mD = 4.6, mz = zB + 1.6 + mD / 2;
    axisUnit(mb, r, {
      tag: '主殿', z: mz, r: { baseH: 0.5, dougong: true, dgScale: 0.8 },
      unit: { W: 7.4, D: mD, bays: 5, roofType: 'gableHip', eave: 1.0, veranda: true, partition: 1.0 }
    });

    // 回廊围合：内圈矩形，北廊在主殿之后、南廊在殿前，四边连续；转角中心线交于角柱
    const rw = CW / 2 - 2.2, rzN = zB + 1.5, rzS = zF - 2.4, Wd = 1.2;
    corridorRun(mb, r, -rw, rzN, rw, rzN, Wd, 0.02, '北回廊', { plain: true });
    const gap = 2.4;
    corridorRun(mb, r, -rw, rzS, -gap / 2, rzS, Wd, 0.02, '南回廊', { plain: true });
    corridorRun(mb, r, gap / 2, rzS, rw, rzS, Wd, 0.02, '南回廊', { plain: true });
    corridorRun(mb, r, -rw, rzS, -rw, rzN, Wd, 0.02, '西回廊', { plain: true });
    corridorRun(mb, r, rw, rzS, rw, rzN, Wd, 0.02, '东回廊', { plain: true });
    // 四角角柱（两段廊中心线交点）
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const cx = sx * rw, cz = sz > 0 ? rzS : rzN;
      mb.cyl(cx, cz, 0.16, 0.02, 2.5, 8, r.colMat, '回廊·角柱');
      mb.boxC(cx, cz, 0.26, 0.26, 0.02, 0.16, 'stone', '角柱·础');
      layStats(mb).corners.push({ x: cx, z: cz, wallX: sx * (CW / 2 - 0.15), wallZ: sz > 0 ? zF : zB });
    }
    P.stele(mb, -3.2, 0, 0.9, '碑');
    P.stoneLantern(mb, 3.2, 0, 0.9, '石灯');
    P.tree(mb, -rw + 1.4, rzS - 1.6, 'pine', rng, 0.9, '松');
    P.tree(mb, rw - 1.4, rzS - 1.6, 'bamboo', rng, 0.9, '竹');
  }

  /* ---------------- 阶段④-5 贾府（府邸 + 后花园复合） ---------------- */
  function courtyardJiafu(mb, r, ctx) {
    const { CW, CD } = ctx;
    const rng = new GF.RNG(r.seed + 25);
    const zF = CD / 2, zB = -CD / 2;
    const zSplit = -6.0;
    P.courtWall(mb, {
      x0: -CW / 2, x1: CW / 2, z0: zB, z1: zF, y: 3.0,
      gate: { side: 'front', w: 2.8, h: 2.7, shape: 'rect' }, windows: null, windowPattern: r.winPattern
    });

    // 前部府邸中轴多进
    axisUnit(mb, r, {
      tag: '大门', z: zF - 2.4, r: { baseH: 0.3, dougong: false },
      unit: { W: 6.4, D: 3.0, bays: 3, roofType: 'gable', eave: 0.85, plaque: true, chars: 2, cheap: true }
    });
    crossWall(mb, r, { z: zF - 6.2, x0: -CW / 2, x1: CW / 2, gateW: 2.6, gateH: 2.5, tag: '仪门' });

    const hz = zF - 10.4;
    axisUnit(mb, r, {
      tag: '正厅', z: hz, r: { baseH: 0.65, dougong: true, dgScale: 0.85 },
      unit: { W: 8.0, D: 4.8, bays: 5, roofType: 'gableHip', eave: 1.1, veranda: true, partition: 1.2 }
    });

    const iz = zF - 16.0;
    axisUnit(mb, r, {
      tag: '内宅', z: iz, r: { baseH: 0.55, dougong: false },
      unit: { W: 7.0, D: 4.4, bays: 3, roofType: 'gable', eave: 0.9, veranda: true, cheap: true }
    });
    // 东西跨院（书房 / 花厅）
    for (const sx of [-1, 1]) {
      flankUnit(mb, r, {
        tag: sx > 0 ? '东跨院·花厅' : '西跨院·书房', x: sx * (CW / 2 - 2.8), z: iz,
        r: { baseH: 0.45, dougong: false }, unit: { W: 3.6, D: 3.4, bays: 2, roofType: 'gable', eave: 0.7, cheap: true }
      });
    }

    // 后罩楼（二层）
    axisUnit(mb, r, {
      tag: '后罩楼', z: zSplit + 2.4, r: { baseH: 0.5, dougong: false },
      unit: { W: 7.6, D: 3.4, bays: 3, floors: 2, floorHList: [2.9, 2.5], roofType: 'gable', eave: 0.8, cheap: true }
    });

    // 府园隔墙（月洞门贯通府邸与园林）
    crossWall(mb, r, { z: zSplit, x0: -CW / 2, x1: CW / 2, gateW: 2.4, gateH: 2.4, tag: '府园隔墙', roof: false });

    // 后部园林：叠山理水、亭榭自由布局
    const px = -1.0, pz = (zSplit + zB) / 2 - 0.5, pw = CW * 0.38, pd = 5.0;
    P.pond(mb, px, pz, pw, pd, '后园池');
    P.rock(mb, px + pw / 2 + 1.6, pz + pd / 2 + 0.8, 1.1, rng, '园山');
    P.rock(mb, px - pw / 2 - 1.4, pz - pd / 2 - 0.4, 0.8, rng, '园石');
    // 湖心小亭 + 石矶
    mb.taper(px + 1.0, pz, 2.2, 2.0, 2.1, 1.9, 0, 0.28, 'stoneDark', '亭矶');
    smallPavilion(mb, r, px + 1.0, pz, 0.72, 2.2, 'pyramid', '后园亭', 0.28);
    // 临水榭
    const xx = -CW / 2 + 2.2, xz = pz + 1.2;
    mb.box(xx, xx + 3.2, 0, 0.4, xz - 1.6, xz + 1.6, 'stoneDark', '水榭台');
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      mb.cyl(xx + 1.6 + sx * 1.2, xz + sz * 1.3, 0.12, 0.4, 2.5, 8, r.colMat, '水榭柱');
    }
    if (!r.cut.roof) {
      GF.roofs.build(mb, {
        cx: xx + 1.6, cz: xz, x0: xx - 0.4, x1: xx + 3.6, z0: xz - 2.0, z1: xz + 2.0,
        yb: 2.5, rise: 0.9, type: 'roll', tile: r.tile, tileB: r.tileB,
        upturn: 0.3, ridgeStyle: 'plain', gableMat: 'wood', tag: '水榭顶'
      });
    }
    P.tree(mb, CW / 2 - 1.8, pz + 1.6, 'willow', rng, 1.0, '柳');
    P.tree(mb, -CW / 2 + 1.6, zSplit - 2.0, 'plum', rng, 0.9, '梅');
    P.tree(mb, CW / 2 - 2.0, zSplit - 3.4, 'maple', rng, 0.9, '枫');
  }