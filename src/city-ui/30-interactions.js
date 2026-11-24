'use strict';
  /* ----------------------------- 交互 ----------------------------- */
  let dragging = null;
  let orbitRAF = 0;

  /* 拖拽转视角：只触发 rAF 一次的轻量轨道帧（不重建城池、不读第二张 GPU 缓冲、不做描边）。
   * 鼠标停下来后，mouseup 再补一张完整预览；这样拖动过程不再被 400ms 的筑城卡住。 */
  function scheduleOrbit() {
    if (orbitRAF) return;
    orbitRAF = requestAnimationFrame(() => {
      orbitRAF = 0;
      if (!dragging || dragging.pan) return;
      renderPreview(true, '视角');
    });
  }

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 2) return;
    dragging = { x: e.clientX, y: e.clientY, pan: e.shiftKey, yaw: state.city.render.yaw, pitch: state.city.render.pitch, moved: false, yawMoved: false };
    canvas.classList.add('dragging');
  });
  window.addEventListener('mousemove', (e) => {
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
    state.city.render.yaw = Math.round((dragging.yaw + dx * 0.4 + 360) % 360);
    // 上下拖动 = Z 轴俯角；和 OrbitControls 同向：向下拖看屋面，向上拖看立面
    state.city.render.pitch = Math.max(15, Math.min(88, Math.round(dragging.pitch + dy * 0.3)));
    syncPitchUI();
    scheduleOrbit();
  });
  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    if (orbitRAF) { cancelAnimationFrame(orbitRAF); orbitRAF = 0; }
    const cameraMoved = dragging.moved && !dragging.pan;
    const yawMoved = dragging.yawMoved;
    if (cameraMoved) {
      // 只上下拖俯角时不要把方位从 35° 硬吸到 30°
      if (yawMoved) state.city.render.yaw = Math.round(state.city.render.yaw / 15) * 15 % 360;
      state.city.render.pitch = Math.max(15, Math.min(88, Math.round(state.city.render.pitch)));
    }
    dragging = null;
    canvas.classList.remove('dragging');
    syncControls();
    if (cameraMoved) renderPreview(false);
  });
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
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const old = state.zoom;
    state.zoom = GF.clamp(state.zoom * (e.deltaY > 0 ? 0.9 : 1.1), 0.5, 8);
    const rect = canvas.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    const k = state.zoom / old;
    state.panX -= dx * (k - 1);
    state.panY -= dy * (k - 1);
    layout();
  }, { passive: false });
  canvas.addEventListener('dblclick', () => {
    state.panX = state.panY = 0; state.zoom = 2; layout();
  });
