'use strict';
  /* ------------------------------ 宅院（院落） ------------------------------ */
  function buildCourtyard(mb, r) {
    const jin = Math.max(1, Math.min(5, Math.round(r.jin || 1)));
    // 进数真的改院落尺度：每一进至少 9m 深，院墙 / 游廊 / 正房按总深重排
    const CD = Math.max(r.courtD || 18, jin * 9);
    const CW = r.courtW || 20;
    // 院门门洞：与 40-layout.js 的垂花门读同一份 gate 覆盖配方（同一套归一化取值），
    // 编辑器里调门宽/门高时，院墙门洞与内部垂花门门扇、门楣始终对齐，不再墙开 2.6m、门做 2.0m 错位。
    // 非宅院风格各守各的固定洞：园林圆洞 2.4、寺院山门方洞 2.6，不受门宽/门高滑块影响。
    const style = r.courtStyle || 'siheyuan';
    const FORCE_FIXED_GATE = style === 'garden' || style === 'temple';
    const gOv = FORCE_FIXED_GATE ? null : unitOverride(r, 'gate');
    const gRu = unitRecipe(r, gOv);
    const gateW = FORCE_FIXED_GATE ? (style === 'garden' ? 2.4 : 2.6) : Math.min(3.0, Math.max(1.0, gRu.doorW == null ? 2.0 : +gRu.doorW));
    const gateH = FORCE_FIXED_GATE ? 2.7 : Math.min(3.6, Math.max(1.6, gRu.doorH == null ? 2.7 : +gRu.doorH));
    // 院墙随门高抬升：门洞必须整孔嵌在墙身里，墙顶最少留 0.3m 压顶带；
    // 默认门高 2.7 时墙仍 3.0m，门加高到 3.6 时墙升到 3.9m，门洞永远不会超出墙顶。
    const wallH = FORCE_FIXED_GATE ? 3.0 : Math.max(3.0, gateH + 0.3);
    // 布局类（进数/轴线的 temple5、daoguan、wujin、langyuan、jiafu）各自砌外围墙，
    // 这里再砌一圈就是两圈 0.3 m 厚的墙严格同面叠着（四合院整圈 437 m²），转到侧面必闪。
    const SELF_WALL = style === 'temple5' || style === 'daoguan' || style === 'wujin'
      || style === 'langyuan' || style === 'jiafu';
    if (!SELF_WALL) {
      P.courtWall(mb, {
        x0: -CW / 2, x1: CW / 2, z0: -CD / 2, z1: CD / 2, y: wallH,
        gate: { side: 'front', w: gateW, h: gateH, shape: style === 'garden' ? 'round' : 'rect' },
        windows: style === 'garden'
          ? [{ dir: 'right', u: 1.6, v: 1.5 }, { dir: 'left', u: 1.6, v: 1.5 }, { dir: 'right', u: -3.0, v: 1.5 }]
          : null,
        windowPattern: r.winPattern
      });
    }
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