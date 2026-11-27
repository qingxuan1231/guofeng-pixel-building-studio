'use strict';
  function bind() {
    const chips = $('#presetChips');
    GF.cityList.forEach((p) => {
      const c = document.createElement('button');
      c.className = 'chip';
      c.textContent = p.name;
      c.dataset.key = p.key;
      c.addEventListener('click', () => {
        state.city = GF.getCityPreset(p.key);
        state.preset = p.key;
        state.panX = state.panY = 0; state.zoom = 1;
        markChip(p.key);
        syncControls();
        renderAncientList();
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

    markChip('standard');

    $('#btnSeed').addEventListener('click', () => {
      state.city.seed = Math.floor(Math.random() * 1e9);
      markChip(null);
      syncControls();
      rebuild();
    });
    $('#btnGrow').addEventListener('click', () => {
      state.city.cols = Math.min(6, state.city.cols + 1);
      state.city.rows = Math.min(6, state.city.rows + 1);
      markChip(null);
      syncControls();
      onChange();
    });
    $('#btnExport').addEventListener('click', exportPNG);
    $('#btnSheet').addEventListener('click', exportSheet);
    $('#btnZip').addEventListener('click', exportZip);
    $('#btnSave').addEventListener('click', saveRecipe);
    $('#btnLoad').addEventListener('click', () => $('#fileInput').click());
    $('#fileInput').addEventListener('change', (e) => {
      if (e.target.files[0]) loadRecipe(e.target.files[0]);
      e.target.value = '';
    });
    $('#btnHelp').addEventListener('click', () => $('#helpModal').classList.add('open'));
    $('#btnHelpClose').addEventListener('click', () => $('#helpModal').classList.remove('open'));
    $('#helpModal').addEventListener('click', (e) => {
      if (e.target.id === 'helpModal') e.currentTarget.classList.remove('open');
    });
    $('#btnAxis').addEventListener('click', () => {
      state.city.render.yaw = 0;
      state.panX = state.panY = 0;
      syncControls();
      onChange('render.yaw');
    });
    $('#btnFull').addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen();
    });

    $('#densRange').addEventListener('input', (e) => {
      syncDens(Number(e.target.value));
      const rg = document.querySelector('input[data-k="render.ppm"]');
      if (rg) { rg.value = state.city.render.ppm; const val = rg.parentElement.querySelector('.val'); if (val) val.textContent = state.city.render.ppm; }
      onChange('render.ppm');
    });
    bindRangeWheel($('#densRange'));
    $('#pitchRange').addEventListener('input', (e) => setPitch(Number(e.target.value)));
    bindPitchSlider($('#pitchRange'));
    $('#perspRange').addEventListener('input', (e) => setPersp(Number(e.target.value) / 100));
    bindPerspSlider($('#perspRange'));

    document.querySelectorAll('[data-view]').forEach((b) => {
      b.addEventListener('click', () => {
        const v = b.dataset.view;
        state.city.render.pitch = v === 'bird' ? 78 : v === 'iso' ? 52 : v === 'low' ? 30 : 16;
        syncControls();
        onChange('render.pitch');
      });
    });
    document.querySelectorAll('[data-rot]').forEach((b) => {
      b.addEventListener('click', () => {
        const step = Number(b.dataset.rot);
        state.city.render.yaw = (state.city.render.yaw + step + 360) % 360;
        syncControls();
        onChange('render.yaw');
      });
    });
    window.addEventListener('resize', layout);
    const bm = $('#btnMode');
    if (bm) bm.addEventListener('click', () => {
      state.gpu = !state.gpu;
      try { localStorage.setItem('gf.renderMode', state.gpu ? 'gpu' : 'cpu'); } catch (e) {}
      paintMode();
      renderPreview(false);
    });
  }

  // 给 range 行加 data-k，供密度联动回写
  function tagRows() {
    registry.forEach((b) => {
      if (b.kind === 'range') b.el.dataset.k = b.it.path;
    });
  }