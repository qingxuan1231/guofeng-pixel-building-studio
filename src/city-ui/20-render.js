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
    state.orbitK = 1;
    const f = state.frame;
    state.viewAspect = f.w / f.h;
    // 完整帧的原生尺寸记下来：转向时轻量帧像素少，但画布 CSS 尺寸仍锁在这个尺寸，
    // 不会因为轻量帧变小而在舞台上突然缩成一小块。
    state.viewW = f.w; state.viewH = f.h;
    const cap = 1050000;
    if (f.w * f.h <= cap) {
      state.lightFrame = [f.w, f.h];
      state.lightPPM = state.city.render.ppm;
    } else {
      const px = Math.min(previewBudget(), cap);
      const fw = Math.max(4, Math.floor(Math.sqrt(px * state.viewAspect) / 4) * 4);
      const fh = Math.max(4, Math.floor(px / fw / 4) * 4);
      state.lightFrame = [fw, fh];
      // 轻量帧和完整帧同一画幅比例；按面积比换算真实像素密度，状态栏不再把轻量帧谎报成 44px/m
      state.lightPPM = state.city.render.ppm * Math.min(1, Math.sqrt((fw * fh) / (f.w * f.h)));
    }
  }

  function fitExtentForPreview() {
    if (!state.mesh) return null;
    const r = state.city.render;
    const key = [r.pitch, r.persp == null ? 1 : r.persp, state.mesh.triCount].join('|');
    if (state.fitKey !== key) {
      state.fitExtent = GF.fitExtents(state.mesh, { pitch: r.pitch, persp: r.persp == null ? 1 : r.persp });
      state.fitKey = key;
    }
    return state.fitExtent;
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
      // 拖动/滑杆过程中的轻量帧才降像素；松手后的完整预览严格按用户 ppm 出图，
      // 不再把 44px/m 偷偷降到 5px/m。画布用 1:1 像素显示，靠平移看大图。
      if (extra && extra.light) o.maxPixels = previewBudget();
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

  function fitZoom() {
    const w = state.viewW || (state.frame && state.frame.w) || wrap.clientWidth || 1;
    const h = state.viewH || (state.frame && state.frame.h) || wrap.clientHeight || 1;
    const vw = wrap.clientWidth || 1200, vh = wrap.clientHeight || 800;
    return GF.clamp(Math.min(vw / w, vh / h) * 0.96, 0.08, 8);
  }

  function layout() {
    const f = state.frame;
    if (!f) return;
    // 像素视图：画布按完整帧的原生像素显示，1 帧像素 = 1 CSS 像素，滚轮只放大 CSS，
    // 不再把高密度帧压回舞台宽度，导致 44px/m 看起来像 5px/m。
    const scale = state.zoom;
    const bw = state.viewW || f.w, bh = state.viewH || f.h;
    // 平移限制：即使整城刚好铺满舞台，也留出可以左右/上下挪动的余量
    const overX = Math.max(wrap.clientWidth * 0.3, (bw * scale - wrap.clientWidth) / 2 + wrap.clientWidth * 0.18);
    const overY = Math.max(wrap.clientHeight * 0.3, (bh * scale - wrap.clientHeight) / 2 + wrap.clientHeight * 0.18);
    state.panX = GF.clamp(state.panX, -overX, overX);
    state.panY = GF.clamp(state.panY, -overY, overY);
    canvas.style.width = (bw * scale) + 'px';
    canvas.style.height = (bh * scale) + 'px';
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
      // 转向 / 俯角都走视口尺寸的轻量帧：画布始终铺满舞台，取景按全朝向最大范围锁定
      o = renderOpts(null, null, true, {
        orbit: true,
        outline: false,
        style: 'pixel',
        light: true,
        // 转向/俯角用固定画幅和固定像素密度：画面比例不随角度跳动，
        // 也不会因为包围盒一秒一变而出现整块取景被裁掉/拉伸。
        orbitFrame: state.lightFrame,
        orbitPPM: state.lightPPM
      });
    } else {
      o = renderOpts(null, null, true);
    }
    state.frame = GF.render(state.mesh, o);
    if (!orbit) rememberViewFrame();
    const ppmNow = state.city.render.ppm;
    if (!orbit && state.previewPpm != null && state.previewPpm !== ppmNow) {
      // 用户改密度就是要看这个密度本身，直接切到 1:1 原生像素；初始载入仍按适应全城。
      state.panX = state.panY = 0;
      state.zoom = 1;
    }
    state.previewPpm = ppmNow;
    draw(false);
    if (!orbit) {
      $('#stat').textContent = `预览 ${state.frame.w}×${state.frame.h}px · 三角面 ${state.mesh.triCount.toLocaleString()} · ${Math.round(performance.now() - t0)}ms`;
    } else {
      const pm = state.frame.map && state.frame.map.ppm ? state.frame.map.ppm : 0;
      $('#stat').textContent = `${tag || '旋转'}预览 ${state.frame.w}×${state.frame.h}px · 实际 ${pm.toFixed(1)}px/m · 松手后按 ${state.city.render.ppm}px/m 出全图`;
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
      state.previewPpm = state.city.render.ppm;
      draw();
      if (!keepView) { state.panX = state.panY = 0; state.zoom = fitZoom(); layout(); }
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
