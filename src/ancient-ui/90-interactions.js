'use strict';
  /* ------------------------------ 交互 ------------------------------ */
  let dragging = null;
  let movingItem = null;
  let dragItem = null;
  let bldDrag = null;
  let bldSel = null;
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('mousedown', (e) => {
    // 建筑模式：点画面里某一栋即选中；按住不放就能把这一栋拖到别处
    if (state.barMode === 'bld' && e.button === 0 && !e.shiftKey && !state.moveMode) {
      const uHit = pickUnitAt(e.clientX, e.clientY);
      const whole = uHit ? null : pickWholeAt(e.clientX, e.clientY);
      const hit = uHit ? { key: 'u:' + uHit.id, label: uHit.label } : (whole || pickMove(e.clientX, e.clientY));
      if (hit && (String(hit.key).slice(0, 2) === 'u:' || hit.key === 'bld')) {
        const isU = String(hit.key).slice(0, 2) === 'u:';
        const id = isU ? String(hit.key).slice(2) : null;
        const found = isU ? (state.mesh.units || []).filter((x) => x.id === id)[0] : null;
        const wasSel = isU ? !!(state.selPart && state.selPart.k === hit.key) : bldSel === 'bld';
        if (isU) { state.selPart = { k: hit.key }; bldSel = null; } else { bldSel = 'bld'; state.selPart = null; }
        state.selItem = null;
        paintCompPanel();
        paintBldBar();
        paintBldPanel();
        draw();
        if (found && found.fixed) {
          setStat('选中单体：' + hit.label + '（院门固定在院墙上，不可拖动）');
          return;
        }
        // 先点选、再按住拖：避免随手点一下就误把房子拖走
        if (!wasSel) {
          setStat('已选中：' + hit.label + '（再按住它即可拖到别处）');
          return;
        }
        const f = state.frame, rect = canvas.getBoundingClientRect();
        const kx = f.w / rect.width, ky = f.h / rect.height;
        const fx0 = (e.clientX - rect.left) * kx, fy0 = (e.clientY - rect.top) * ky;
        const w0 = unprojM(f.map, fx0, fy0);
        if (!state.recipe.units) state.recipe.units = {};
        const u = isU ? (state.recipe.units[id] || (state.recipe.units[id] = {})) : null;
        bldDrag = {
          id, whole: !isU, cx0: e.clientX, cy0: e.clientY, kx, ky, m0: f.map, fx0, fy0,
          w0x: w0.x, w0z: w0.z,
          dx0: isU ? (+u.dx || 0) : (+state.recipe.moveX || 0),
          dz0: isU ? (+u.dz || 0) : (+state.recipe.moveZ || 0)
        };
        canvas.style.cursor = 'grabbing';
        setStat('拖动：' + hit.label + '（松手落位' + (isU ? '，只动这一栋' : '，地面与陈设原地不动') + '）');
        return;
      }
    }
    // 组件条落进来的东西：左键按住就能拖，不用先进“拖动陈设”模式
    if (e.button === 0 && !e.shiftKey && !state.moveMode) {
      const hi = pickItem(e.clientX, e.clientY);
      if (hi >= 0) {
        const it = envItems()[hi];
        state.selItem = hi;
        state.selPart = null;
        paintBldBar();
        paintBldPanel();
        paintCompPanel();
        const p = framePt(e.clientX, e.clientY);
        const w = unproj(p.fx, p.fy);
        dragItem = { i: hi, dx: it.x - w.x, dz: it.z - w.z };
        setStat('拖动：' + compLabel(it.k) + '（松手落位）');
        return;
      }
    }
    if (state.barMode === 'env' && state.moveMode && e.button === 0 && !e.shiftKey) {
      const hit = pickMove(e.clientX, e.clientY);
      if (!hit) return; // 拖动模式下视角锁定：点空处不旋转、不平移
      const p = framePt(e.clientX, e.clientY);
      const w = unproj(p.fx, p.fy);
      movingItem = { key: hit.key, label: hit.label, dx: hit.x - w.x, dz: hit.z - w.z };
      setStat('拖动：' + hit.label + '（松手即落位）');
      return;
    }
    if (e.button !== 2) return;
    dragging = { x: e.clientX, y: e.clientY, pan: e.shiftKey, yaw: state.recipe.render.yaw, pitch: state.recipe.render.pitch, moved: false, yawMoved: false };
    canvas.classList.add('dragging');
    document.querySelectorAll('[data-view]').forEach((b) => b.classList.remove('on'));
  });
  window.addEventListener('mousemove', (e) => {
    if (bldDrag) {
      const fx = bldDrag.fx0 + (e.clientX - bldDrag.cx0) * bldDrag.kx;
      const fy = bldDrag.fy0 + (e.clientY - bldDrag.cy0) * bldDrag.ky;
      const w = unprojM(bldDrag.m0, fx, fy);
      const dx = +(bldDrag.dx0 + w.x - bldDrag.w0x).toFixed(2);
      const dz = +(bldDrag.dz0 + w.z - bldDrag.w0z).toFixed(2);
      if (bldDrag.whole) {
        state.recipe.moveX = dx;
        state.recipe.moveZ = dz;
      } else {
        const us = state.recipe.units;
        us[bldDrag.id] = Object.assign({}, us[bldDrag.id], { dx, dz });
      }
      setStat('拖动中：X ' + dx.toFixed(1) + ' m / Z ' + dz.toFixed(1) + ' m');
      dragRender();
      return;
    }
    if (dragItem) {
      const p = framePt(e.clientX, e.clientY);
      const w = unproj(p.fx, p.fy);
      const it = envItems()[dragItem.i];
      if (it) {
        it.x = +(w.x + dragItem.dx).toFixed(2);
        it.z = +(w.z + dragItem.dz).toFixed(2);
      }
      dragRender();
      return;
    }
    if (movingItem) {
      const p = framePt(e.clientX, e.clientY);
      const w = unproj(p.fx, p.fy);
      state.recipe.env.move = state.recipe.env.move || {};
      state.recipe.env.move[movingItem.key] = { x: w.x + movingItem.dx, z: w.z + movingItem.dz };
      state.moves.forEach((m) => { if (m.key === movingItem.key) { m.x = w.x + movingItem.dx; m.z = w.z + movingItem.dz; } });
      dragRender();
      return;
    }
    if (!dragging) return;
    const dx = e.clientX - dragging.x, dy = e.clientY - dragging.y;
    if (dragging.pan) {
      state.panX += dx; state.panY += dy;
      dragging.x = e.clientX; dragging.y = e.clientY;
      dragging.moved = true;
      layout();
      return;
    }
    if (Math.abs(dx) + Math.abs(dy) > 0.5) dragging.moved = true;
    if (Math.abs(dx) > 2) dragging.yawMoved = true;
    state.recipe.render.yaw = Math.round((dragging.yaw + dx * 0.4 + 360) % 360);
    // 上下拖动 = 俯视角度；向下拖看屋面，向上拖看立面
    state.recipe.render.pitch = Math.max(18, Math.min(55, Math.round(dragging.pitch + dy * 0.3)));
    syncPitchUI();
    renderOrbit('视角');
  });
  window.addEventListener('mouseup', () => {
    if (bldDrag) {
      const whole = bldDrag.whole;
      bldDrag = null;
      canvas.style.cursor = '';
      rebuild();
      setStat(whole ? '建筑已落位（地面与陈设原地不动）' : '这一栋已落位');
      return;
    }
    if (dragItem) {
      dragItem = null;
      state.frame = GF.render(state.mesh, previewOpts());
      draw();
      paintCompPanel();
      return;
    }
    if (movingItem) {
      movingItem = null;
      state.frame = GF.render(state.mesh, previewOpts());
      draw();
      return;
    }
    if (!dragging) return;
    const cameraMoved = dragging.moved && !dragging.pan;
    const yawMoved = dragging.yawMoved;
    if (cameraMoved) {
      // 只上下拖俯角时不要把旋向从 35° 硬吸到 30°
      if (yawMoved) state.recipe.render.yaw = Math.round(state.recipe.render.yaw / 15) * 15 % 360;
      state.recipe.render.pitch = Math.max(18, Math.min(55, Math.round(state.recipe.render.pitch)));
    }
    dragging = null;
    canvas.classList.remove('dragging');
    if (cameraMoved) {
      syncControls();
      renderFullPreview();
    }
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const old = state.zoom;
    state.zoom = GF.clamp(state.zoom * (e.deltaY > 0 ? 0.9 : 1.1), 0.5, 8);
    // 以光标为锚点缩放
    const rect = canvas.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    const k = state.zoom / old;
    state.panX -= dx * (k - 1);
    state.panY -= dy * (k - 1);
    document.querySelectorAll('[data-view]').forEach((b) => b.classList.remove('on'));
    layout();
  }, { passive: false });
  // 平移：方向键 / < > 左右上下都可；Shift+右键拖动也能平移
  let panLeft = false, panRight = false, panUp = false, panDown = false, panTimer = 0;
  function panNudge() {
    const dx = (panRight ? 1 : 0) - (panLeft ? 1 : 0);
    const dy = (panDown ? 1 : 0) - (panUp ? 1 : 0);
    if (!dx && !dy) return;
    state.panX += dx * 9;
    state.panY += dy * 9;
    layout();
  }
  function panStart() {
    if (panTimer) return;
    panNudge();
    panTimer = setInterval(panNudge, 16);
  }
  function panStop() {
    if (panLeft || panRight || panUp || panDown) return;
    if (panTimer) { clearInterval(panTimer); panTimer = 0; }
  }
  function isTypingTarget(el) {
    if (!el) return false;
    if (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable) return true;
    if (el.tagName === 'INPUT') {
      const type = (el.type || 'text').toLowerCase();
      return type !== 'range' && type !== 'button' && type !== 'checkbox' && type !== 'radio' && type !== 'file' && type !== 'color';
    }
    return false;
  }
  function panKey(e, down) {
    if (isTypingTarget(e.target)) return;
    const left = e.key === '<' || e.key === 'ArrowLeft' || e.code === 'Comma';
    const right = e.key === '>' || e.key === 'ArrowRight' || e.code === 'Period';
    const up = e.key === 'ArrowUp';
    const dn = e.key === 'ArrowDown';
    if (!left && !right && !up && !dn) return;
    e.preventDefault();
    if (left) panLeft = down;
    if (right) panRight = down;
    if (up) panUp = down;
    if (dn) panDown = down;
    if (down) panStart();
    else panStop();
  }
  window.addEventListener('keydown', (e) => panKey(e, true));
  window.addEventListener('keyup', (e) => panKey(e, false));
  window.addEventListener('blur', () => { panLeft = panRight = panUp = panDown = false; panStop(); });
  // 双击画面 = 居中复位
  canvas.addEventListener('dblclick', () => {
    if (state.moveMode) { setStat('拖动模式下视角已锁定'); return; }
    state.panX = state.panY = 0; viewAt('all');
  });

  let raf = 0;
  function scheduleRender() {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; renderFullPreview(); });
  }
