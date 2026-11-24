'use strict';
  /* ------------------------------ 宅院（院落） ------------------------------ */
  function buildCourtyard(mb, r) {
    const jin = Math.max(1, Math.min(5, Math.round(r.jin || 1)));
    // 进数真的改院落尺度：每一进至少 9m 深，院墙 / 游廊 / 正房按总深重排
    const CD = Math.max(r.courtD || 18, jin * 9);
    const CW = r.courtW || 20;
    const wallH = 3.0;
    const style = r.courtStyle || 'siheyuan';
    // 院墙（前檐正中开门；园林用月洞门，墙上开漏窗）
    P.courtWall(mb, {
      x0: -CW / 2, x1: CW / 2, z0: -CD / 2, z1: CD / 2, y: wallH,
      gate: { side: 'front', w: style === 'garden' ? 2.4 : 2.6, h: 2.7, shape: style === 'garden' ? 'round' : 'rect' },
      windows: style === 'garden'
        ? [{ dir: 'right', u: 1.6, v: 1.5 }, { dir: 'left', u: 1.6, v: 1.5 }, { dir: 'right', u: -3.0, v: 1.5 }]
        : null,
      windowPattern: r.winPattern
    });
    const ctx = { CW, CD, wallH, jin };
    if (style === 'garden') return courtyardGarden(mb, r, ctx);
    if (style === 'temple') return courtyardTemple(mb, r, ctx);
    // ---- 阶段④ 布局类新路径（不动既有 temple / siheyuan / garden 三条）----
    if (style === 'temple5') return courtyardTemple5(mb, r, ctx);
    if (style === 'daoguan') return courtyardDao(mb, r, ctx);
    if (style === 'wujin') return courtyardWujin(mb, r, ctx);
    if (style === 'langyuan') return courtyardLangyuan(mb, r, ctx);
    if (style === 'jiafu') return courtyardJiafu(mb, r, ctx);
    return courtyardHouse(mb, r, ctx);
  }
