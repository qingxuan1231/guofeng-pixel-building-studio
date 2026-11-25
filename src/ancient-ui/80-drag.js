'use strict';
  /* ------------------------------ 拖动陈设 ------------------------------ */
  // 渲染器返回正交投影映射（ox/oy/ppm + 相机基向量），据此做屏幕拾取与地面反算
  function framePt(clientX, clientY) {
    const f = state.frame, r = canvas.getBoundingClientRect();
    return { fx: (clientX - r.left) * f.w / r.width, fy: (clientY - r.top) * f.h / r.height, rect: r };
  }
  function perspKAt(m, x, y, z) {
    if (!m || !m.persp || !m.camC || !m.camD) return 1;
    const depth = (x - m.camC[0]) * m.view[0] + (y - m.camC[1]) * m.view[1] + (z - m.camC[2]) * m.view[2];
    return 1 + (m.camD / Math.max(0.4, m.camD - depth) - 1) * m.persp;
  }
  // 地面网格 / 拾取都按当前相机投影；透视时和 3D 顶点用同一个 k 系数
  function projWorld(x, z) {
    const f = state.frame, m = f.map;
    const k = perspKAt(m, x, 0, z);
    const sx = (x * m.right[0] + z * m.right[2]) * k;
    const sy = (x * m.up[0] + z * m.up[2]) * k;
    return { fx: sx * m.ppm + m.ox, fy: -sy * m.ppm + m.oy };
  }
  function unproj(fx, fy) {
    return unprojM(state.frame.map, fx, fy);
  }
  // 拖拽建筑时相机映射会因重排而微调，用开始拖动那一刻的映射反算，抓取点才不跑
  function unprojM(m, fx, fy) {
    const px = m.ppm, right = m.right, up = m.up;
    const U = (fx - m.ox) / px, V = -(fy - m.oy) / px;
    const det = right[0] * up[2] - right[2] * up[0] || 1;
    const solve = (k) => {
      const sx = U / k, sy = V / k;
      return {
        x: (sx * up[2] - right[2] * sy) / det,
        z: (right[0] * sy - up[0] * sx) / det
      };
    };
    if (!m.persp || !m.camC || !m.camD) return solve(1);
    // 透视映射是非线性的：固定屏幕点，迭代求地面 (x, 0, z)
    let k = 1, q = solve(1);
    for (let i = 0; i < 12; i++) {
      const nk = perspKAt(m, q.x, 0, q.z);
      if (!isFinite(nk) || nk <= 0.05) break;
      if (Math.abs(nk - k) < 0.0005) { k = nk; break; }
      k = k * 0.65 + nk * 0.35;
      q = solve(k);
      if (!isFinite(q.x) || !isFinite(q.z)) break;
    }
    return q;
  }
  // 单体拾取：按这一栋的投影轮廓（地面四角 + 檐顶四角围成的凸包）判断，
  // 点房子身上任意处都算点中，不必对准一个看不见的锚点
  function hullHit(px, py, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[i], b = pts[j];
      if (((a.y > py) !== (b.y > py)) && (px < (b.x - a.x) * (py - a.y) / (b.y - a.y) + a.x)) inside = !inside;
    }
    return inside;
  }
  function pickUnitAt(clientX, clientY) {
    const us = bldUnits();
    const f = state.frame;
    if (!us || !f) return null;
    const p = framePt(clientX, clientY);
    const px = p.fx, py = p.fy, ppm = f.map.ppm;
    let best = null, bestA = Infinity;
    us.forEach((u) => {
      const swap = Math.abs(u.rot || 0) % 180 === 90;
      const hw = (swap ? u.D : u.W) / 2 + 0.5, hd = (swap ? u.W : u.D) / 2 + 0.5;
      const corners = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
      const bottom = corners.map(([x, z]) => {
        const q = projWorld(u.x + x, u.z + z);
        return { x: q.fx, y: q.fy };
      });
      const top = corners.map(([x, z]) => {
        const q = projWorld(u.x + x, u.z + z);
        return { x: q.fx, y: q.fy - Math.max(0.8, u.topY || 0) * ppm };
      });
      const poly = bottom.concat(top.slice().reverse());
      if (!hullHit(px, py, poly)) return;
      let area = 0;
      for (let i = 0; i < poly.length; i++) {
        const q = poly[i], w = poly[(i + 1) % poly.length];
        area += q.x * w.y - w.x * q.y;
      }
      area = Math.abs(area) / 2;
      if (area < bestA) { bestA = area; best = u; }
    });
    return best;
  }
  // 单栋建筑的整栋拾取：按整栋包围盒的投影（地面四角 + 顶面四角）判断
  function pickWholeAt(clientX, clientY) {
    const b = state.mesh && state.mesh.bldBox;
    const f = state.frame;
    if (!b || !f) return null;
    const p = framePt(clientX, clientY);
    const ppm = f.map.ppm;
    const corners = [[b.x0, b.z0], [b.x1, b.z0], [b.x1, b.z1], [b.x0, b.z1]];
    const bottom = corners.map(([x, z]) => { const q = projWorld(x, z); return { x: q.fx, y: q.fy }; });
    const top = corners.map(([x, z]) => { const q = projWorld(x, z); return { x: q.fx, y: q.fy - Math.max(0.8, b.y1) * ppm }; });
    const poly = bottom.concat(top.slice().reverse());
    return hullHit(p.fx, p.fy, poly) ? { key: 'bld', label: '建筑本体' } : null;
  }
  function pickMove(clientX, clientY) {
    const f = state.frame;
    if (!f || !state.moves) return null;
    const p = framePt(clientX, clientY);
    const k = p.rect.width / f.w;
    const tol = Math.max(18 * k, 24);
    let best = null, bestD = 1e9;
    for (const mv of state.moves) {
      const q = projWorld(mv.x, mv.z);
      const cy = q.fy - Math.min(2.2, mv.r) * f.map.ppm * 0.85; // 锚点抬到物体中部，好点中
      const d = Math.hypot(q.fx - p.fx, cy - p.fy);
      if (d < tol && d < bestD) { bestD = d; best = mv; }
    }
    return best;
  }
  let dragRaf = 0;
  let dragPreviewDirty = false, dragPreviewHeld = false, dragIdle = 0;
  function dragRender() {
    if (dragRaf) return;
    dragRaf = requestAnimationFrame(() => {
      dragRaf = 0;
      try {
        state.mesh = GF.build(state.recipe, { ppm: state.recipe.render.ppm });
        state.moves = state.mesh.moves || state.moves;
        const opts = previewOpts({ ppm: Math.min(state.recipe.render.ppm, 14), pad: 5 });
        state.frame = GF.render(state.mesh, opts);
        draw();
      } catch (e) { console.error(e); }
    });
  }
  // 陈设滑条：拖动时只出低像素预览，松手 / 停手后必须回到完整帧
  function compDragRender() {
    dragPreviewDirty = true;
    clearTimeout(dragIdle);
    dragIdle = setTimeout(() => { if (!dragPreviewHeld) commitDragPreview(); }, 260);
    dragRender();
  }
  function commitDragPreview() {
    if (!dragPreviewDirty) return;
    dragPreviewDirty = false;
    clearTimeout(dragIdle); dragIdle = 0;
    if (dragRaf) { cancelAnimationFrame(dragRaf); dragRaf = 0; }
    try {
      // 最后一次 input 可能还没被 rAF 画出来，收尾时按当前配方重建一次，再把完整帧补回来
      state.mesh = GF.build(state.recipe, { ppm: state.recipe.render.ppm });
      state.moves = state.mesh.moves || state.moves;
      renderFullPreview();
    } catch (e) { console.error(e); }
  }
  function bindCompSlider(el, fn) {
    el.addEventListener('pointerdown', () => { dragPreviewHeld = true; });
    el.addEventListener('input', fn);
    const end = () => {
      if (!dragPreviewHeld) return;
      dragPreviewHeld = false;
      commitDragPreview();
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('change', end);
  }
  window.addEventListener('pointerup', () => {
    if (!dragPreviewHeld) return;
    dragPreviewHeld = false;
    commitDragPreview();
  });
  window.addEventListener('pointercancel', () => {
    if (!dragPreviewHeld) return;
    dragPreviewHeld = false;
    commitDragPreview();
  });
