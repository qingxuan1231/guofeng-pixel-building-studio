'use strict';
  /* ----------------------------- 渲染与视图 ----------------------------- */
  // 预览预算：屏幕只看得见这么大，多出来的像素不必算（导出永远不传，全精度）
  // 高 DPI / 高倍缩放不再把像素数乘到失控；像素画最终是 CSS 放大显示，1.25x 足够。
  const PREVIEW_MAX_PIXELS = 2600000;
  function previewBudget(zoom) {
    const w = wrap.clientWidth || 1600;
    const h = wrap.clientHeight || 900;
    const dpr = Math.min(1.25, window.devicePixelRatio || 1);
    const z = Math.min(2.2, Math.max(1, (zoom == null ? state.zoom : zoom) / 2));
    return Math.min(PREVIEW_MAX_PIXELS, w * h * dpr * dpr * z * z);
  }

  // 记录完整预览的画幅比例，并预先算好轻量帧的固定画布尺寸。
  // 拖动俯角/转向时始终复用同一块 FBO，不会因为取景包围盒差 1px 反复重建。
  function rememberViewFrame() {
    if (!state.frame) return;
    const f = state.frame;
    state.viewAspect = f.w / f.h;
    const cap = 1050000;
    if (f.w * f.h <= cap) {
      // 完整预览本身就在轻量帧预算内：直接复用同尺寸 FBO，拖动时零重分配
      state.lightFrame = [f.w, f.h];
    } else {
      const px = Math.min(previewBudget(), cap);
      const fw = Math.max(4, Math.floor(Math.sqrt(px * state.viewAspect) / 4) * 4);
      const fh = Math.max(4, Math.floor(px / fw / 4) * 4);
      state.lightFrame = [fw, fh];
    }
  }

  function renderOpts(ppmOverride, pad, preview, extra) {
    const r = state.city.render;
    const o = {
      ppm: ppmOverride || r.ppm, pitch: r.pitch, yaw: r.yaw, palette: r.palette,
      style: r.style || 'pixel', styleAmount: r.styleAmount == null ? 0.7 : r.styleAmount,
      outline: r.outline !== false, shadow: r.shadow !== false,
      sunAz: r.sunAz == null ? null : Number(r.sunAz),
      shadowAngle: r.shadowAngle == null ? null : r.shadowAngle,
      persp: r.persp == null ? 1 : Math.max(0, Math.min(1, Number(r.persp))),
      transparent: r.transparent !== false, focus: false, seed: state.city.seed,
      pad: pad, gpu: state.gpu
    };
    if (preview) {
      o.preview = true;
      o.maxPixels = previewBudget();
    }
    if (extra) Object.assign(o, extra);
    return o;
  }

  function draw(skipLayout) {
    const f = state.frame;
    if (!f) return;
    if (state.gpu && f.gpu !== true) {
      state.gpuMiss = (state.gpuMiss || 0) + 1;
      if (state.gpuMiss >= 2) {
        state.gpu = false;
        try { localStorage.setItem('gf.renderMode', 'cpu'); } catch (e) {}
        paintMode();
        $('#stat').textContent = 'GPU 光栅不可用，已自动切回 CPU';
      }
    } else if (state.gpu) {
      state.gpuMiss = 0;
    }
    // 同尺寸不要反复设置 canvas.width/height：每次赋值都会清空画布并重置上下文。
    if (canvas.width !== f.w || canvas.height !== f.h) {
      canvas.width = f.w;
      canvas.height = f.h;
    }
    const ctx = canvas.getContext('2d');
    const img = (f.rgba instanceof Uint8ClampedArray)
      ? new ImageData(f.rgba, f.w, f.h)
      : new ImageData(new Uint8ClampedArray(f.rgba), f.w, f.h);
    ctx.putImageData(img, 0, 0);
    if (!skipLayout) layout();
  }

  function layout() {
    const f = state.frame;
    if (!f) return;
    const availW = wrap.clientWidth * 0.86;
    const availH = wrap.clientHeight * 0.86;
    const fit = Math.min(availW / f.w, availH / f.h);
    const scale = fit * (state.zoom / 2);
    const overX = Math.max(0, (f.w * scale - wrap.clientWidth) / 2 + wrap.clientWidth * 0.18);
    const overY = Math.max(0, (f.h * scale - wrap.clientHeight) / 2 + wrap.clientHeight * 0.18);
    state.panX = GF.clamp(state.panX, -overX, overX);
    state.panY = GF.clamp(state.panY, -overY, overY);
    canvas.style.width = (f.w * scale) + 'px';
    canvas.style.height = (f.h * scale) + 'px';
    canvas.style.transform = `translate(calc(-50% + ${state.panX}px), calc(-50% + ${state.panY}px))`;
  }

  /* 只重画，不重建几何：转视角、俯角、画风、像素密度都走这里
   * dynamic=true：俯角/透视滑条用当前投影内容的真实宽高比出轻量帧，
   * 避免固定 FBO 的画幅和当前角度不匹配，拖动时整座城缩成一小块。 */
  function renderPreview(orbit, tag, dynamic) {
    if (!state.mesh) return;
    if (state.busy) { state.pendingRender = true; return; }
    const t0 = performance.now();
    let o;
    if (orbit) {
      if (dynamic) {
        o = renderOpts(null, null, true, {
          orbit: true,
          orbitAspect: 0,
          maxPixels: Math.min(previewBudget(), 1050000),
          outline: false,
          style: 'pixel'
        });
      } else {
        const aspect = state.viewAspect || ((state.frame && state.frame.w) ? state.frame.w / state.frame.h : (wrap.clientWidth / wrap.clientHeight));
        let fw, fh;
        if (state.lightFrame) { fw = state.lightFrame[0]; fh = state.lightFrame[1]; }
        else {
          const px = Math.min(previewBudget(), 1050000);
          fw = Math.max(4, Math.floor(Math.sqrt(px * aspect) / 4) * 4);
          fh = Math.max(4, Math.floor(px / fw / 4) * 4);
        }
        o = renderOpts(null, null, true, {
          orbit: true,
          orbitAspect: fw / fh,
          orbitFrame: [fw, fh],
          maxPixels: Math.min(previewBudget(), 1050000),
          outline: false,
          style: 'pixel'
        });
      }
    } else {
      o = renderOpts(null, null, true);
    }
    state.frame = GF.render(state.mesh, o);
    if (!orbit) rememberViewFrame();
    draw(dynamic ? false : !!orbit);
    if (!orbit) {
      $('#stat').textContent = `预览 ${state.frame.w}×${state.frame.h}px · 三角面 ${state.mesh.triCount.toLocaleString()} · ${Math.round(performance.now() - t0)}ms`;
    } else {
      $('#stat').textContent = `${tag || '旋转'}预览 ${state.frame.w}×${state.frame.h}px · 轻量帧 ${Math.round(performance.now() - t0)}ms`;
    }
  }

  /* 俯角滑块：按住拖动时只出轻量相机帧（不筑城、不叠描边/画风），
   * 松手或停手后再补一张完整预览。俯角和转视角一样只动相机。 */
  let pitchDirty = false, pitchRAF = 0, pitchIdle = 0, pitchHeld = false;

  function pitchLightFrame() {
    if (pitchRAF) return;
    pitchRAF = requestAnimationFrame(() => {
      pitchRAF = 0;
      if (!pitchDirty) return;
      renderPreview(true, '俯角', true);
    });
  }

  function pitchCommit() {
    if (!pitchDirty) return;
    pitchDirty = false;
    if (pitchRAF) { cancelAnimationFrame(pitchRAF); pitchRAF = 0; }
    clearTimeout(pitchIdle); pitchIdle = 0;
    renderPreview(false);
  }

  function syncPitchUI() {
    const val = Math.round(state.city.render.pitch);
    const top = $('#pitchRange');
    if (top) top.value = val;
    if ($('#pitchVal')) $('#pitchVal').textContent = val;
    const rg = document.querySelector('input[data-k="render.pitch"]');
    if (rg) {
      rg.value = val;
      const valEl = rg.parentElement.querySelector('.val');
      if (valEl) valEl.textContent = val + '°';
    }
    setCamInfo();
  }

  function setPitch(v) {
    const val = Math.max(15, Math.min(88, Math.round(Number(v))));
    if (!isFinite(val)) return;
    state.city.render.pitch = val;
    syncPitchUI();
    pitchDirty = true;
    pitchLightFrame();
    clearTimeout(pitchIdle);
    pitchIdle = setTimeout(() => {
      if (!pitchHeld) pitchCommit();
    }, 260);
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

  /* 顶部透视滑杆：拖动时轻量帧，松手补完整图 */
  let perspDirty = false, perspRAF = 0, perspIdle = 0, perspHeld = false;
  function syncPerspUI() {
    const v = Math.max(0, Math.min(1, Number(state.city.render.persp) || 0));
    const pct = Math.round(v * 100);
    if ($('#perspRange')) $('#perspRange').value = pct;
    if ($('#perspVal')) $('#perspVal').textContent = pct;
    const rg = document.querySelector('input[data-k="render.persp"]');
    if (rg) {
      rg.value = v;
      const valEl = rg.parentElement.querySelector('.val');
      if (valEl) valEl.textContent = String(Math.round(v * 100) / 100);
    }
    setCamInfo();
  }
  function perspLightFrame() {
    if (perspRAF) return;
    perspRAF = requestAnimationFrame(() => {
      perspRAF = 0;
      if (!perspDirty) return;
      renderPreview(true, '透视', true);
    });
  }
  function perspCommit() {
    if (!perspDirty) return;
    perspDirty = false;
    if (perspRAF) { cancelAnimationFrame(perspRAF); perspRAF = 0; }
    clearTimeout(perspIdle); perspIdle = 0;
    renderPreview(false);
  }
  function setPersp(v) {
    const val = Math.max(0, Math.min(1, Math.round(Number(v) * 100) / 100));
    if (!isFinite(val)) return;
    state.city.render.persp = val;
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

  function rebuild(keepView) {
    if (state.busy) { state.pending = true; return; }
    state.busy = true;
    setBusy(true, '正在筑城…');
    setTimeout(() => {
      const t0 = performance.now();
      state.mesh = GF.buildCity(state.city);
      state.frame = GF.render(state.mesh, renderOpts(null, null, true));
      state.pendingRender = false;
      rememberViewFrame();
      draw();
      if (!keepView) { state.panX = state.panY = 0; state.zoom = 2; layout(); }
      $('#stat').textContent = `出图 ${state.frame.w}×${state.frame.h}px · 三角面 ${state.mesh.triCount.toLocaleString()} · ${Math.round(performance.now() - t0)}ms`;
      const info = state.mesh.cityInfo || {};
      const gateN = info.gates ? Object.values(info.gates).reduce((a, b) => a + b, 0) : 0;
      const exN = info.extras || 0;
      $('#cityStat').textContent = `${info.cells || state.city.cols * state.city.rows} 坊 · 城墙 ${state.city.wallH}m · ${gateN ? `坊门 ${gateN} 座 · ` : ''}${exN ? `古建 ${exN} 座 · ` : ''}${info.life ? `生活 ${info.life} 件 · ` : ''}种子 ${state.city.seed}`;
      if (extraCount()) {
        if (info.extrasSkipped) setAncientStatus(`已落位 ${exN} 座，${info.extrasSkipped} 座因城池太小未放入。`);
        else setAncientStatus(`已落位 ${exN} 座古建；换种子或扩坊可重新排布。`);
        renderAncientList();
      } else {
        setAncientStatus('导入的配方会按地块自动缩放。');
      }
      setBusy(false, '');
      state.busy = false;
      if (state.pending) { state.pending = false; rebuild(keepView); }
    }, 0);
  }

  let timer = 0, needRebuild = false, needRender = false;
  function onChange(path) {
    clearTimeout(timer);
    if (path && CAMERA_KEYS.has(path)) needRender = true;
    else needRebuild = true;
    const delay = needRebuild ? 160 : 80;
    timer = setTimeout(() => {
      const rb = needRebuild, rr = needRender;
      needRebuild = needRender = false;
      if (rb) rebuild(true);
      else if (rr) renderPreview(false);
    }, delay);
  }
