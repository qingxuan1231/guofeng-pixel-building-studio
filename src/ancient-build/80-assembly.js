'use strict';
  /* ------------------------------ 总装 ------------------------------ */
  GF.build = function (recipe, opts) {
    const r = GF.normalize ? GF.normalize(recipe) : recipe;
    // 细部档位按真实调用参数决定：城池显式传 detail:3（保留完整高面数），
    // 古建页不传时回到按出图密度推导的原始档位，不再对所有页面强行拉满。
    if (opts && opts.detail != null) GF.setDetail(opts.detail);
    else GF.setDetail(GF.detailFor((opts && opts.ppm) || 0));
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
      const CD = Math.max(r.courtD || 18, jinN * 9);
      const CW = r.courtW || 20;
      const zF = CD / 2, zB = -CD / 2;
      // 院内竹木组件化：布局层不再硬画院内树 / 石 / 陈设，改由环境层统一把硬渲染清单
      // 展开进「组件编辑」——位置与数量完全沿用原布局坐标，画面不变，清单里则件件都能
      // 选中 / 删除 / 拖动。仅在首次展开（env.auto 未成形）时生效，用户改过的清单不回写。
      if (!Array.isArray(r.env.auto)) {
        const hard = [];
        if (!r.courtStyle || r.courtStyle === 'siheyuan') {
          // 宅院式：前两棵树落回原院内位置，外圈按原点位各补一棵复本，画面数量不变
          const zFront = CD / 2 - (CD / jinN) / 2;
          const trees = r.env.trees || [];
          if (trees.length >= 2) {
            const mv = r.env.move || (r.env.move = {});
            mv.tree0 = { x: -2.2, z: +(zFront + 1.0).toFixed(2) };
            mv.tree1 = { x: 2.2, z: +(zFront + 0.4).toFixed(2) };
            const n = trees.length;
            trees.push(trees[0], trees[1]);
            for (let k = 2; k < trees.length; k++) {
              const oi = k % n;
              const ang = (oi / n) * Math.PI * 2 + 0.6;
              const dist = 6.5 + (oi % 2) * 1.5;
              mv['tree' + k] = { x: +Math.cos(ang) * dist, z: +Math.sin(ang) * dist };
            }
          }
          // 庭院陈设（首进院心）：石桌、双石凳、假山——布局层不再硬画，改由环境层并入清单
          hard.push({ k: 'table', x: 0, z: +(zFront - 1.0).toFixed(2), s: 1 });
          hard.push({ k: 'stool', x: 0.9, z: +(zFront - 1.0).toFixed(2), s: 1 });
          hard.push({ k: 'stool', x: -0.9, z: +(zFront - 1.0).toFixed(2), s: 1 });
          hard.push({ k: 'taihu', x: -CW / 2 + 2.8, z: +(zFront + 0.6).toFixed(2), s: 0.9 });
        } else if (r.courtStyle === 'temple5') {
          // 寺·五进中轴：香炉、石狮、二松
          const kz = zF - 11.2, mz = -3.2, mD = 5.4, mW = 9.6;
          hard.push({ k: 'censer', x: 0, z: mz + mD / 2 + 2.4, s: 1.3 });
          for (const sx of [-1, 1]) hard.push({ k: 'lion', x: sx * (mW / 2 + 0.9), z: mz + mD / 2 + 1.6, s: 1 });
          for (const sx of [-1, 1]) hard.push({ k: 'pine', x: sx * (CW / 2 - 1.6), z: kz + 1.0, s: 1 });
        } else if (r.courtStyle === 'daoguan') {
          // 道观·中路紧凑：香炉、二松
          const mz = -1.8, mD = 5.0;
          hard.push({ k: 'censer', x: 0, z: mz + mD / 2 + 2.0, s: 1.2 });
          for (const sx of [-1, 1]) hard.push({ k: 'pine', x: sx * (CW / 2 - 1.5), z: 2.0, s: 0.95 });
        } else if (r.courtStyle === 'wujin') {
          // 五进四合院：竹、梅、假山
          const z2 = zF - 13.4, z3 = z2 - 6.4;
          hard.push({ k: 'bamboo', x: -2.4, z: zF - 10.6, s: 0.9 });
          hard.push({ k: 'plum', x: 2.4, z: zF - 10.6, s: 0.9 });
          hard.push({ k: 'motif', x: 3.0, z: z3 + 1.0, s: 0.7 });
        } else if (r.courtStyle === 'langyuan') {
          // 廊院式祠庙：碑、石灯、松、竹
          const rw = CW / 2 - 2.2, rzS = zF - 2.4;
          hard.push({ k: 'stele', x: -3.2, z: 0, s: 1 });
          hard.push({ k: 'stonelamp', x: 3.2, z: 0, s: 1 });
          hard.push({ k: 'pine', x: -rw + 1.4, z: rzS - 1.6, s: 0.9 });
          hard.push({ k: 'bamboo', x: rw - 1.4, z: rzS - 1.6, s: 0.9 });
        } else if (r.courtStyle === 'jiafu') {
          // 贾府·前府后园：园山、园石、柳、梅、枫
          const zSplit = -6.0;
          const px = -1.0, pz = (zSplit + zB) / 2 - 0.5, pw = CW * 0.38, pd = 5.0;
          hard.push({ k: 'taihu', x: px + pw / 2 + 1.6, z: pz + pd / 2 + 0.8, s: 1.1 });
          hard.push({ k: 'taihu', x: px - pw / 2 - 1.4, z: pz - pd / 2 - 0.4, s: 0.8 });
          hard.push({ k: 'willow', x: CW / 2 - 1.8, z: pz + 1.6, s: 1 });
          hard.push({ k: 'plum', x: -CW / 2 + 1.6, z: zSplit - 2.0, s: 0.9 });
          hard.push({ k: 'maple', x: CW / 2 - 2.0, z: zSplit - 3.4, s: 0.9 });
        } else if (r.courtStyle === 'garden') {
          // 宅园：花石、石灯、驳岸叠石、主峰次峰、竹芭蕉枫梅、盆景、石灯、石桌石凳、敞轩石桌
          const px = -1.1, pz = -0.1, pw = Math.min(CW * 0.4, 7.4), pd = Math.min(CD * 0.32, 4.6);
          hard.push({ k: 'motif', x: 1.9, z: CD / 2 - 2.6, s: 0.7 });
          hard.push({ k: 'stonelamp', x: -1.9, z: CD / 2 - 2.6, s: +(0.85 / 0.9).toFixed(3) });
          const rocks = [];
          for (let i = 0; i < 5; i++) rocks.push([px - pw / 2 + 0.4 + i * (pw - 0.8) / 4, pz + pd / 2 + 0.32]);
          for (let i = 0; i < 4; i++) rocks.push([px + pw / 2 + 0.32, pz + pd / 2 - 0.5 - i * (pd - 1.0) / 3]);
          rocks.forEach((p0, idx) => {
            const rx = p0[0], rz = p0[1];
            if (Math.hypot(rx + 0.1, rz - (pz + pd / 2 + 0.45)) < 1.15) return;
            if (Math.hypot(rx - (px + pw / 2 + 0.45), rz - 0.2) < 1.15) return;
            hard.push({ k: 'motif', x: +rx.toFixed(2), z: +rz.toFixed(2), s: +(0.28 + ((Math.abs(rx * 3 + rz * 5)) % 1) * 0.18).toFixed(3), seed: 1 + idx });
          });
          hard.push({ k: 'taihu', x: +((px + pw / 2 + 2.3) * 1).toFixed(2), z: +((pz + pd / 2 + 1.25) * 1).toFixed(2), s: 1.2 });
          hard.push({ k: 'taihu', x: +((px + pw / 2 + 2.3) * 1).toFixed(2), z: +((pz - pd / 2 - 0.55) * 1).toFixed(2), s: 0.8 });
          hard.push({ k: 'bamboo', x: -CW / 2 + 1.2, z: CD / 2 - 4.6, s: 0.95 });
          hard.push({ k: 'bamboo', x: CW / 2 - 1.4, z: CD / 2 - 5.0, s: 0.9 });
          hard.push({ k: 'banana', x: 2.6, z: 3.6, s: 1 });
          hard.push({ k: 'maple', x: CW / 2 - 2.0, z: -CD / 2 + 2.4, s: 1 });
          hard.push({ k: 'plum', x: -2.4, z: -CD / 2 + 3.0, s: 0.9 });
          hard.push({ k: 'penjing', x: -CW / 2 + 2.0, z: -CD / 2 + 4.4, s: +(0.85 / 0.9).toFixed(3) });
          hard.push({ k: 'penjing', x: CW / 2 - 4.2, z: -1.2, s: +(0.8 / 0.9).toFixed(3) });
          hard.push({ k: 'stonelamp', x: 1.2, z: 5.2, s: +(0.8 / 0.9).toFixed(3) });
          hard.push({ k: 'table', x: -3.4, z: 3.2, s: 0.95 });
          hard.push({ k: 'stool', x: -3.4, z: 2.65, s: 0.9 });
          hard.push({ k: 'table', x: -CW / 2 + 2.0 + 3.4 / 2, z: pz + 1.0, s: 1 });
        } else if (r.courtStyle === 'temple') {
          // 寺院·山门大殿：香炉、石狮、幡、石灯、二松、功德碑
          const gW = Math.min(CW * 0.42, 7.0), gz = CD / 2 - 2.95;
          hard.push({ k: 'censer', x: 0, z: 2.2, s: 1.3 });
          for (const sx of [-1, 1]) {
            hard.push({ k: 'lion', x: sx * (gW / 2 + 0.9), z: gz - 1.4, s: 1 });
            hard.push({ k: 'banner', x: sx * 2.6, z: 2.6, s: 1, h: 2.6, w: 0.6 });
            hard.push({ k: 'stonelamp', x: sx * 1.6, z: -1.0, s: 1 });
          }
          hard.push({ k: 'pine', x: -3.4, z: 4.2, s: 1.1 });
          hard.push({ k: 'pine', x: 3.4, z: 4.2, s: 1.1 });
          hard.push({ k: 'stele', x: -4.4, z: 5.8, s: 1 });
        }
        if (hard.length) r.env.hard = hard;
      }
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
    const bld0 = mb.mat.length;
    mb.merge(bm);
    // 整栋区间：环境之后到建筑结束的整段（含未单元化的院墙 / 大殿 / 佛龛等），拖动整栋建筑时按区间平移
    mb._mo = mb._mo || {};
    mb._mo.bld = [bld0, mb.mat.length];
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