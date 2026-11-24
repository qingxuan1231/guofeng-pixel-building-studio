'use strict';
  /* ------------------------------ 总装 ------------------------------ */
  GF.build = function (recipe, opts) {
    const r = GF.normalize ? GF.normalize(recipe) : recipe;
    // 出图密度决定细部档位：320 px/m 会启用瓦当逐垄、门钉九路、斗拱铺作等
    const ppm = (opts && opts.ppm) || (r.render && r.render.ppm) || 40;
    GF.setDetail(GF.detailFor(ppm));
    const mb = new GF.Mesh();
    // 屋面通用参数（剪边 / 悬鱼 / 风铎 / 山花材质）统一透传，任何屋顶都会生效
    GF.roofs.setDefaults({
      trim: r.trimMat || null, xuanYu: !!r.xuanYu, windDuo: !!r.windDuo, gableMat: r.wallMat
    });
    // 院落进数会把院深拉长：地面尺寸跟着放大，否则院外一圈会露空
    if (r.type === 'courtyard') {
      const jinN = Math.max(1, Math.min(5, Math.round(r.jin || 1)));
      const needD = Math.max(r.courtD || 18, jinN * 9) + 4;
      const needW = (r.courtW || 20) + 4;
      r.env.groundSize = Math.max(r.env.groundSize || 8, needD, needW);
    }
    // 环境与建筑分两张网格：拖动整栋建筑时只挪建筑本体，地面 / 树 / 水池原地不动
    const em = new GF.Mesh();
    environment(em, r);
    // 预设件首次展开的结果回写到调用方那份配方上，面板与保存的配方才拿得到同一份清单
    if (recipe && recipe.env) recipe.env.auto = r.env.auto;
    const bm = new GF.Mesh();
    bm.moves = [];
    bm.units = [];
    switch (r.type) {
      case 'cave': buildCave(bm, r); break;
      case 'house': buildHouse(bm, r); break;
      case 'pavilion': buildPavilion(bm, r); break;
      case 'round': buildRound(bm, r); break;
      case 'pagoda': buildPagoda(bm, r); break;
      case 'archway': buildArchway(bm, r); break;
      case 'gate': buildGate(bm, r); break;
      case 'courtyard': buildCourtyard(bm, r); break;
      case 'bridge': buildBridge(bm, r); break;
      case 'xie': buildXie(bm, r); break;
      case 'fang': buildFang(bm, r); break;
      case 'ge': buildGe(bm, r); break;
      case 'que': buildQue(bm, r); break;
      case 'corridor': buildCorridor(bm, r); break;
      case 'tai': buildTai(bm, r); break;
      case 'city': buildCity(bm, r); break;
      default: buildHall(bm, r);
    }
    // 整栋拖动：moveX / moveZ 只平移建筑本体，登记的锚点跟着走
    const ox = +r.moveX || 0, oz = +r.moveZ || 0;
    if (ox || oz) {
      bm.translate(ox, 0, oz);
      (bm.units || []).forEach((u) => { u.x = +(u.x + ox).toFixed(2); u.z = +(u.z + oz).toFixed(2); });
      (bm.moves || []).forEach((m) => { m.x += ox; m.z += oz; });
    }
    mb.merge(em);
    mb.merge(bm);
    mb.moves = (em.moves || []).concat(bm.moves || []);
    mb.units = bm.units || [];
    if (bm.cityStats) mb.cityStats = bm.cityStats;
    // 单栋建筑给一个「整栋」抓取点：建筑模式下按住它就能拖着整栋走
    if (!mb.units.length && bm.wx.length) {
      let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, y1 = 0;
      for (let i = 0; i < bm.wx.length; i++) {
        const x = bm.wx[i], z = bm.wz[i];
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (z < z0) z0 = z; if (z > z1) z1 = z;
      }
      for (let i = 1; i < bm.pos.length; i += 3) if (bm.pos[i] > y1) y1 = bm.pos[i];
      mb.bldBox = { x0, x1, z0, z1, y1 };
      mb.moves.unshift({
        key: 'bld', label: '建筑本体', x: +((x0 + x1) / 2).toFixed(2), z: +((z0 + z1) / 2).toFixed(2),
        r: Math.max(x1 - x0, z1 - z0) / 2
      });
    }
    GF.roofs.setDefaults({});
    return mb;
  };

  GF.builders = { ground, body, base, interior, environment };



