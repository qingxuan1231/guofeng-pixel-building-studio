/* ============================================================================
 * 国风古建像素工坊 · 界面与交互
 * ==========================================================================*/
'use strict';

  const state = {
    recipe: GF.getPreset('siheyuan'),
    mesh: null,
    frame: null,
    zoom: 2,
    panX: 0,
    panY: 0,
    view: 'all',
    refit: true,
    viewCenter: null,
    playing: false,
    moves: [],
    moveMode: false,
    busy: false,
    selItem: null,
    selPart: null,
    barMode: 'env',
    grid: true
  };

  const $ = (s, el) => (el || document).querySelector(s);
  const canvas = $('#view');
  const ctx = canvas.getContext('2d');
  // 出图先落到离屏画布，再 drawImage 叠到主画布：主画布先画地面网格，图像透明处就能透出网格
  const frameCanvas = document.createElement('canvas');
  const frameCtx = frameCanvas.getContext('2d');
  // 栅格单独一张画布：按遮挡遮罩抠掉被物件压住的部分，再叠到成品上
  const gridCanvas = document.createElement('canvas');
  const gridCtx = gridCanvas.getContext('2d', { willReadFrequently: true });
  const wrap = $('#canvasWrap');

  /* 渲染内核：GPU（WebGL2 硬件光栅） / CPU（软件光栅）。选择记在 localStorage，两页共用。 */
  state.gpu = (function () {
    let v = null;
    try { v = localStorage.getItem('gf.renderMode'); } catch (e) {}
    if (v === 'cpu') return false;
    if (v === 'gpu') return true;
    return GF.gpuAvailable ? GF.gpuAvailable() : false;
  })();
  state.grid = (function () {
    let v = null;
    try { v = localStorage.getItem('gf.grid'); } catch (e) {}
    return v === 'off' ? false : true;
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

  /* ------------------------------ 地面网格 ------------------------------ */
  function paintGrid() {
    const b = $('#btnGrid');
    if (!b) return;
    b.classList.toggle('on', !!state.grid);
    b.title = state.grid
      ? '地面栅格：世界米制，按视距 1/2/5m 分档，5 格加重；左上角线段比例尺可读真实尺寸'
      : '地面栅格：关着。点一下打开';
  }
