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
    dragging = { x: e.clientX, y: e.clientY, pan: e.button !== 0 || e.shiftKey, yaw: state.city.render.yaw, pitch: state.city.render.pitch, moved: false, yawMoved: false };
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
    } else {
      if (Math.abs(dx) + Math.abs(dy) > 0.5) dragging.moved = true;
      if (Math.abs(dx) > 2) dragging.yawMoved = true;
      state.city.render.yaw = Math.round((dragging.yaw + dx * 0.4 + 360) % 360);
      // 上下拖动 = Z 轴俯角；和 OrbitControls 同向：向下拖看屋面，向上拖看立面
      state.city.render.pitch = Math.max(15, Math.min(88, Math.round(dragging.pitch + dy * 0.3)));
      syncPitchUI();
      scheduleOrbit();
    }
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
