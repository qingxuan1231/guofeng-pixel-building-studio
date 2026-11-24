'use strict';
  /* ------------------------------ 启动 ------------------------------ */
  buildCompBar();
  buildBldBar();
  buildControls();
  bindUI();
  paintMode();
  paintGrid();
  syncControls();
  updateCamInfo();
  rebuild();
  window.addEventListener('resize', () => setTimeout(layout, 60));








