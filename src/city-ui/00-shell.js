/* 城池工坊 · 页面逻辑：与古建工坊的控件体系、视图、导出保持一致 */
'use strict';
  const $ = (s) => document.querySelector(s);
  const wrap = $('#canvasWrap');
  const canvas = $('#view');

  const state = {
    city: GF.getCityPreset('standard'),
    mesh: null, frame: null,
    zoom: 2, panX: 0, panY: 0,
    busy: false, pending: false, preset: 'standard',
    pendingRender: false
  };

  /* 渲染内核：GPU（WebGL2 硬件光栅） / CPU（软件光栅）。与古建页共用同一个记忆。 */
  state.gpu = (function () {
    let v = null;
    try { v = localStorage.getItem('gf.renderMode'); } catch (e) {}
    if (v === 'cpu') return false;
    if (v === 'gpu') return true;
    return GF.gpuAvailable ? GF.gpuAvailable() : false;
  })();

  function paintMode() {
    const b = $('#btnMode');
    if (!b) return;
    const ok = GF.gpuAvailable ? GF.gpuAvailable() : false;
    if (!ok) state.gpu = false;
    const gi = ok && GF.gpuInfo ? GF.gpuInfo() : null;
    b.textContent = state.gpu ? 'GPU' : 'CPU';
    b.classList.toggle('ghost', !state.gpu);
    b.title = !ok
      ? '当前环境不支持 WebGL2，只能用 CPU'
      : state.gpu
        ? '当前：GPU 硬件光栅（' + (gi ? gi.renderer : 'WebGL2') + '）· 预览与导出都走它；点一下切到 CPU'
        : '当前：CPU 软件光栅；点一下切到 GPU';
  }
