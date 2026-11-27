'use strict';
  /* ------------------------------ 渲染 ------------------------------ */
  function renderOpts(extra) {
    const r = state.recipe;
    return Object.assign({
      ppm: r.render.ppm,
      pitch: r.render.pitch,
      yaw: r.render.yaw,
      palette: r.render.palette,
      style: r.render.style,
      styleAmount: r.render.styleAmount,
      outline: r.render.outline,
      shadow: r.render.shadow,
      sunAz: r.render.sunAz,
      shadowAngle: r.render.shadowAngle,
      transparent: r.render.transparent,
      persp: r.render.persp == null ? 0 : Math.max(0, Math.min(1, Number(r.render.persp))),
      focus: !(r.env.showGround === true),
      seed: r.seed
    }, extra || {});
  }

  // 预览预算：画布在屏幕上就那么大，多出来的像素算出来也看不见（导出永远不传，全精度）
  const PREVIEW_MAX_PIXELS = 2600000;
  function previewBudget(zoom) {
    const w = wrap.clientWidth || 1600;
    const h = wrap.clientHeight || 900;
    const dpr = Math.min(1.25, window.devicePixelRatio || 1);
    const z = Math.min(2.2, Math.max(1, (zoom == null ? state.zoom : zoom) / 2));
    return Math.min(PREVIEW_MAX_PIXELS, w * h * dpr * dpr * z * z);
  }
  function fitExtentForPreview() {
    if (!state.mesh) return null;
    const r = state.recipe.render;
    const key = [r.pitch, r.persp == null ? 0 : r.persp, ((r.yaw % 360) + 360) % 360, state.mesh.triCount].join('|');
    if (state.fitKey !== key) {
      state.fitExtent = GF.fitExtents(state.mesh, { pitch: r.pitch, persp: r.persp == null ? 0 : r.persp, yaw: r.yaw });
      state.fitKey = key;
    }
    return state.fitExtent;
  }
  function previewOpts(extra) {
    return renderOpts(Object.assign({
      preview: true,
      gpu: state.gpu,
      gridMask: !!state.grid,
      viewport: [wrap.clientWidth || 1200, wrap.clientHeight || 800],
      fitExtent: fitExtentForPreview(),
      // 视角中心一旦定下就锁住：拖动物体只改世界坐标，不再让相机跟着新包围盒重新居中
      centerPx: state.viewCenter
    }, extra || {}));
  }
  // 从当前帧反算“画面正中对应的投影坐标”，后续所有帧都以它为锚点
  function lockViewCenter(f) {
    if (state.viewCenter || !f || !f.map || !f.map.ppm) return;
    state.viewCenter = [
      (f.w * 0.5 - f.map.ox) / f.map.ppm,
      (f.h * 0.5 - f.map.oy) / f.map.ppm
    ];
  }

  // 记录完整预览的画幅比例，并预先算好交互轻量帧的固定画布尺寸。
  // 转动 / 调俯角时复用同一块 FBO，不会因取景包围盒差 1px 反复重建纹理。
  function rememberViewFrame() {
    if (!state.frame) return;
    state.orbitK = 1;
    const f = state.frame;
    state.viewAspect = f.w / f.h;
    const cap = 1300000;
    if (f.w * f.h <= cap) {
      // 完整预览已在轻量预算内，直接用同尺寸 FBO，拖动时不会重新分配
      state.lightFrame = [f.w, f.h];
    } else {
      const px = Math.min(previewBudget(), cap);
      const fw = Math.max(4, Math.floor(Math.sqrt(px * state.viewAspect) / 4) * 4);
      const fh = Math.max(4, Math.floor(px / fw / 4) * 4);
      state.lightFrame = [fw, fh];
    }
  }

  function orbitOpts() {
    return previewOpts({
      orbit: true,
      orbitFrame: state.lightFrame,
      viewport: null,
      outline: false,
      style: 'pixel',
      maxPixels: previewBudget()
    });
  }

  // 导出也走同一套内核：GPU 开着就用硬件光栅（全精度、不降像素），
  // 渲染失败会自动落回 CPU，所以这里只需要把开关透传下去。
  function exportOpts(extra) {
    return renderOpts(Object.assign({ gpu: state.gpu, preview: false }, extra || {}));
  }

  function rebuild(skipBld) {
    const r = state.recipe;
    if (state.playing) stopBuild(true);
    try {
      state.mesh = GF.build(r, { ppm: r.render.ppm });
      state.moves = state.mesh.moves || [];
      state.frame = GF.render(state.mesh, previewOpts());
      rememberViewFrame();
      draw();
      // build 展开（env.auto 已写入）之后再校验选中项是否仍有效，避免 build 前读 envItems() 把
      // 还没展开的 auto(null) 写成 []——那样 environment() 会误判已展开、跳过配方自带件展开。
      if (state.selItem != null && !envItems()[state.selItem]) state.selItem = null;
      const b = state.mesh.bounds('ground');
      $('#stat').textContent = `出图 ${state.frame.w}×${state.frame.h}px · 三角面 ${state.mesh.triCount.toLocaleString()} · 占地 ${(b.x1 - b.x0).toFixed(1)}×${(b.z1 - b.z0).toFixed(1)}m`;
      paintCompPanel();
      buildCompBar();
      buildBldBar();
      if (!skipBld) paintBldPanel();
    } catch (e) {
      console.error(e);
      $('#stat').textContent = '渲染出错：' + e.message;
    }
  }