'use strict';
  /* ------------------------------ 事件绑定 ------------------------------ */
  function bindUI() {
    const chips = $('#presetChips');
    GF.presetList.forEach((p) => {
      const c = document.createElement('button');
      c.className = 'chip';
      c.textContent = p.name;
      c.dataset.key = p.key;
      c.addEventListener('click', () => {
        state.recipe = GF.getPreset(p.key);
        state.panX = state.panY = 0;
        state.view = 'all';
        state.refit = true;
        markChip(p.key);
        syncControls();
        rebuild();
      });
      chips.appendChild(c);
    });

    // 配方芯片最多展示 7 行，其余收进“展开”里
    const chipHead = chips.closest('.panel-head');
    const chipMore = document.createElement('button');
    chipMore.className = 'preset-more';
    chipMore.type = 'button';
    chipHead.appendChild(chipMore);
    let chipsExpanded = false;
    function fitPresetChips() {
      const items = Array.prototype.slice.call(chips.querySelectorAll('.chip'));
      if (!items.length) return;
      items.forEach((c) => { c.style.display = ''; });
      const tops = Array.from(new Set(items.map((c) => c.offsetTop))).sort((a, b) => a - b);
      const cut = tops[7] == null ? Infinity : tops[7];
      const hidden = items.filter((c) => c.offsetTop >= cut).length;
      if (!chipsExpanded) {
        items.forEach((c) => { if (c.offsetTop >= cut) c.style.display = 'none'; });
      }
      chipMore.style.display = (hidden || chipsExpanded) ? '' : 'none';
      chipMore.textContent = chipsExpanded ? '收起' : ('展开 +' + hidden);
    }
    chipMore.addEventListener('click', () => {
      chipsExpanded = !chipsExpanded;
      fitPresetChips();
    });
    requestAnimationFrame(fitPresetChips);
    window.addEventListener('resize', () => requestAnimationFrame(fitPresetChips));

    markChip('siheyuan');

    if ($('#pitchRange')) {
      $('#pitchRange').addEventListener('input', (e) => setPitch(Number(e.target.value)));
      bindPitchSlider($('#pitchRange'));
    }
    if ($('#perspRange')) {
      $('#perspRange').addEventListener('input', (e) => setPersp(Number(e.target.value) / 100));
      bindPerspSlider($('#perspRange'));
    }

    $('#btnRandom').addEventListener('click', () => {
      state.recipe = GF.randomRecipe(Date.now() % 1e9);
      state.view = 'all';
      state.refit = true;
      markChip(null);
      syncControls();
      rebuild();
    });
    $('#btnExport').addEventListener('click', exportPNG);
    $('#btnSheet').addEventListener('click', exportSheet);
    $('#btnZip').addEventListener('click', exportZip);
    $('#btnSave').addEventListener('click', saveRecipe);
    $('#btnLoad').addEventListener('click', () => $('#fileInput').click());
    $('#fileInput').addEventListener('change', (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const fr = new FileReader();
      fr.onload = () => {
        try {
          state.recipe = GF.normalize(JSON.parse(fr.result));
          state.view = 'all';
          state.refit = true;
          markChip(null);
          syncControls();
          rebuild();
        } catch (err) { alert('配方解析失败：' + err.message); }
      };
      fr.readAsText(f);
      e.target.value = '';
    });

    $('#rotL').addEventListener('click', () => {
      if (lockView()) return;
      state.recipe.render.yaw = (state.recipe.render.yaw + 45) % 360;
      updateCamInfo(); scheduleRender();
    });
    $('#rotR').addEventListener('click', () => {
      if (lockView()) return;
      state.recipe.render.yaw = (state.recipe.render.yaw - 45 + 360) % 360;
      updateCamInfo(); scheduleRender();
    });
    $('#btnAxis').addEventListener('click', () => {
      if (lockView()) return;
      // 中轴：只把旋向转到 0°（正立面），俯角与当前缩放/平移原样保留
      state.recipe.render.yaw = 0;
      state.view = null;
      document.querySelectorAll('[data-view]').forEach((b) => b.classList.remove('on'));
      updateCamInfo();
      syncControls();
      scheduleRender();
    });
    $('#btnBuild').addEventListener('click', playBuild);
    // 顶栏「像素密度」拉条：与面板里的 render.ppm 双向同步，拖动即重绘
    const densRange = $('#densRange'), densVal = $('#densVal');
    if (densRange) {
      const paintDens = (v) => { densRange.value = v; densVal.textContent = v; };
      paintDens(state.recipe.render.ppm);
      state.syncDens = paintDens;
      densRange.addEventListener('input', () => {
        const v = Number(densRange.value);
        state.recipe.render.ppm = v;
        densVal.textContent = v;
        registry.forEach((b) => {
          if (b.kind === 'range' && b.it && b.it.path === 'render.ppm') { b.el.value = v; b.valEl.textContent = b.fmt(v); }
        });
        onChange();
      });
    }
    document.querySelectorAll('[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => { if (!lockView()) viewAt(btn.dataset.view); });
    });
    $('#btnFull').addEventListener('click', () => {
      const root = document.documentElement;
      if (!document.fullscreenElement) {
        const p = root.requestFullscreen ? root.requestFullscreen() : null;
        if (p && p.catch) p.catch(() => setStat('此浏览器不允许全屏，可改用浏览器全屏键 F11'));
      } else {
        document.exitFullscreen();
      }
      setTimeout(layout, 120);
    });
    $('#btnCut').addEventListener('click', () => {
      const c = state.recipe.cut;
      const on = !(c.front && c.right && c.roof);
      c.front = on; c.right = on; c.roof = on;
      syncControls(); rebuild();
    });
    $('#btnGrid').addEventListener('click', () => {
      state.grid = !state.grid;
      try { localStorage.setItem('gf.grid', state.grid ? 'on' : 'off'); } catch (e) {}
      paintGrid();
      if (state.frame) draw();
      setStat(state.grid ? '地面栅格已打开' : '地面栅格已关闭');
    });

    $('#btnMode').addEventListener('click', () => {
      state.gpu = !state.gpu;
      try { localStorage.setItem('gf.renderMode', state.gpu ? 'gpu' : 'cpu'); } catch (e) {}
      paintMode();
      rebuild();
    });

    $('#btnHelp').addEventListener('click', () => $('#helpModal').classList.add('open'));
    $('#btnHelpClose').addEventListener('click', () => $('#helpModal').classList.remove('open'));
    $('#helpModal').addEventListener('click', (e) => {
      if (e.target.id === 'helpModal') e.currentTarget.classList.remove('open');
    });

    // 组件条 → 画面：拖进画布即按落点加一件（数量、位置、朝向都不再由配方写死）
    const cw = $('#canvasWrap');
    cw.addEventListener('dragover', (e) => {
      if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types, 'text/gf-comp') >= 0) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
    });
    cw.addEventListener('drop', (e) => {
      const k = e.dataTransfer ? e.dataTransfer.getData('text/gf-comp') : '';
      if (!k) return;
      e.preventDefault();
      addItem(k, e.clientX, e.clientY);
    });

    window.addEventListener('resize', layout);
    // 调试入口：便于命令行 / 浏览器脚本核对取景、拖动与配方状态
    window.__gf = { state: () => state, proj: (x, z) => projWorld(x, z), pick: (x, y) => pickMove(x, y) };
    document.addEventListener('fullscreenchange', () => setTimeout(layout, 60));
  }

  function markChip(key) {
    document.querySelectorAll('.chip').forEach((c) => {
      c.classList.toggle('active', c.dataset.key === key);
    });
  }

  function updateCamInfo() {
    $('#camInfo').textContent = `俯视 ${state.recipe.render.pitch}° · 旋向 ${Math.round(state.recipe.render.yaw)}° · 每次 45°`;
  }
