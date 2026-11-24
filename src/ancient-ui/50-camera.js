  /* ----------------------- 相机轻量帧（不重建几何） ----------------------- */
  let camRaf = 0;
  function renderOrbit(tag) {
    if (!state.mesh || state.playing || camRaf) return;
    camRaf = requestAnimationFrame(() => {
      camRaf = 0;
      if (!state.mesh || state.playing) return;
      const t0 = performance.now();
      state.frame = GF.render(state.mesh, orbitOpts());
      draw();
      $('#stat').textContent = `${tag || '视角'}预览 ${state.frame.w}×${state.frame.h}px · 三角面 ${state.mesh.triCount.toLocaleString()} · 轻量帧 ${Math.round(performance.now() - t0)}ms`;
    });
  }

  function renderFullPreview() {
    if (!state.mesh || state.playing) return;
    if (camRaf) { cancelAnimationFrame(camRaf); camRaf = 0; }
    const t0 = performance.now();
    state.frame = GF.render(state.mesh, previewOpts());
    rememberViewFrame();
    draw();
    $('#stat').textContent = `预览 ${state.frame.w}×${state.frame.h}px · 三角面 ${state.mesh.triCount.toLocaleString()} · ${Math.round(performance.now() - t0)}ms`;
  }

  /* 俯视角度滑块：拖动时只出轻量帧，松手/停手后补完整预览 */
  let pitchDirty = false, pitchRaf = 0, pitchIdle = 0, pitchHeld = false;
  function syncPitchUI() {
    const val = Math.round(state.recipe.render.pitch);
    if ($('#pitchRange')) $('#pitchRange').value = val;
    if ($('#pitchVal')) $('#pitchVal').textContent = val;
    registry.forEach((b) => {
      if (b.kind === 'range' && b.it && b.it.path === 'render.pitch') {
        b.el.value = val;
        if (b.valEl) b.valEl.textContent = b.fmt(val);
      }
    });
    updateCamInfo();
  }
  function pitchLightFrame() {
    if (pitchRaf) return;
    // 与透视滑条一致：先用同取景规则的轻量预览，避免轨道固定帧和完整帧之间跳一下。
    if (camRaf) { cancelAnimationFrame(camRaf); camRaf = 0; }
    pitchRaf = requestAnimationFrame(() => {
      pitchRaf = 0;
      if (!pitchDirty) return;
      if (!state.mesh || state.playing) return;
      const t0 = performance.now();
      state.frame = GF.render(state.mesh, previewOpts({ outline: false, style: 'pixel' }));
      draw();
      $('#stat').textContent = `俯角预览 ${state.frame.w}×${state.frame.h}px · 三角面 ${state.mesh.triCount.toLocaleString()} · 轻量帧 ${Math.round(performance.now() - t0)}ms`;
    });
  }
  function pitchCommit() {
    if (!pitchDirty) return;
    pitchDirty = false;
    if (pitchRaf) { cancelAnimationFrame(pitchRaf); pitchRaf = 0; }
    clearTimeout(pitchIdle); pitchIdle = 0;
    renderFullPreview();
  }
  function setPitch(v) {
    const val = Math.max(18, Math.min(55, Math.round(Number(v))));
    if (!isFinite(val)) return;
    state.recipe.render.pitch = val;
    syncPitchUI();
    pitchDirty = true;
    pitchLightFrame();
    clearTimeout(pitchIdle);
    pitchIdle = setTimeout(() => { if (!pitchHeld) pitchCommit(); }, 260);
  }
  function bindPitchSlider(el) {
    if (!el) return;
    el.addEventListener('pointerdown', () => { pitchHeld = true; });
    el.addEventListener('change', () => { pitchHeld = false; pitchCommit(); });
  }
  window.addEventListener('pointerup', () => {
    if (!pitchHeld) return;
    pitchHeld = false;
    pitchCommit();
  });
  window.addEventListener('pointercancel', () => {
    if (!pitchHeld) return;
    pitchHeld = false;
    pitchCommit();
  });

  /* 透视强度：拖动时轻量帧，松手/停手后补完整预览 */
  let perspDirty = false, perspRaf = 0, perspIdle = 0, perspHeld = false;
  function syncPerspUI() {
    const v = Math.max(0, Math.min(1, Number(state.recipe.render.persp) || 0));
    const pct = Math.round(v * 100);
    if ($('#perspRange')) $('#perspRange').value = pct;
    if ($('#perspVal')) $('#perspVal').textContent = pct;
    registry.forEach((b) => {
      if (b.kind === 'range' && b.it && b.it.path === 'render.persp') {
        b.el.value = v;
        if (b.valEl) b.valEl.textContent = String(Math.round(v * 100) / 100);
      }
    });
    updateCamInfo();
  }
  function perspLightFrame() {
    if (perspRaf) return;
    // 透视滑条不复用轨道固定帧：轨道帧的取景框和当前完整预览不同，
    // 拉到 0 时容易在“轻量帧 → 完整帧”之间跳一下；这里直接走同取景规则的轻量预览。
    if (camRaf) { cancelAnimationFrame(camRaf); camRaf = 0; }
    perspRaf = requestAnimationFrame(() => {
      perspRaf = 0;
      if (!perspDirty) return;
      if (!state.mesh || state.playing) return;
      const t0 = performance.now();
      state.frame = GF.render(state.mesh, previewOpts({ outline: false, style: 'pixel' }));
      draw();
      $('#stat').textContent = `透视预览 ${state.frame.w}×${state.frame.h}px · 三角面 ${state.mesh.triCount.toLocaleString()} · 轻量帧 ${Math.round(performance.now() - t0)}ms`;
    });
  }
  function perspCommit() {
    if (!perspDirty) return;
    perspDirty = false;
    if (perspRaf) { cancelAnimationFrame(perspRaf); perspRaf = 0; }
    clearTimeout(perspIdle); perspIdle = 0;
    renderFullPreview();
  }
  function setPersp(v) {
    const val = Math.max(0, Math.min(1, Math.round(Number(v) * 100) / 100));
    if (!isFinite(val)) return;
    state.recipe.render.persp = val;
    syncPerspUI();
    perspDirty = true;
    perspLightFrame();
    clearTimeout(perspIdle);
    perspIdle = setTimeout(() => { if (!perspHeld) perspCommit(); }, 260);
  }
  function bindPerspSlider(el) {
    if (!el) return;
    el.addEventListener('pointerdown', () => { perspHeld = true; });
    el.addEventListener('change', () => { perspHeld = false; perspCommit(); });
  }
  window.addEventListener('pointerup', () => {
    if (!perspHeld) return;
    perspHeld = false;
    perspCommit();
  });
  window.addEventListener('pointercancel', () => {
    if (!perspHeld) return;
    perspHeld = false;
    perspCommit();
  });
