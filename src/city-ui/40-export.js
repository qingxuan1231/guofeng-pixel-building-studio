  /* ----------------------------- 导出 ----------------------------- */
  function download(bytes, filename, mime) {
    const blob = new Blob([bytes], { type: mime || 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  }
  function nextFrame() { return new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0))); }
  function setBusy(on, text) {
    ['#btnExport', '#btnSheet', '#btnZip', '#btnSave', '#btnSeed', '#btnGrow'].forEach((s) => {
      const b = $(s);
      if (b) b.disabled = on;
    });
    const busy = $('#busy');
    if (text) { busy.textContent = text; busy.classList.add('on'); }
    else busy.classList.remove('on');
  }
  function renderYaw(yaw) {
    const o = renderOpts();
    o.yaw = yaw;
    return GF.render(state.mesh, o);
  }
  function cityName() { return '城池_' + state.preset + '_' + state.city.seed; }

  function exportPNG() {
    if (state.busy) return;
    // 预览图是按屏幕像素降档的，单张导出必须按配方 ppm 全精度重算
    setBusy(true, '按全精度出图…');
    setTimeout(() => {
      try {
        const t0 = performance.now();
        const f = GF.render(state.mesh, renderOpts());
        download(GF.encodePNG(f.w, f.h, f.rgba), `国风${cityName()}.png`, 'image/png');
        $('#stat').textContent = `全精度出图 ${f.w}×${f.h}px · ${f.gpu ? 'GPU' : 'CPU'} ${Math.round(performance.now() - t0)}ms`;
      } catch (e) { console.error(e); }
      setBusy(false, '');
    }, 0);
  }
  async function exportSheet() {
    if (state.busy) return;
    try {
      const frames = [];
      for (let i = 0; i < 4; i++) {
        setBusy(true, `渲染中… 四向环视 ${i + 1}/4`);
        await nextFrame();
        frames.push(renderYaw(i * 90));
      }
      setBusy(true, '编码 PNG…');
      await nextFrame();
      const sheet = GF.composeSheet(frames, { pad: 10, cols: 4 });
      download(GF.encodePNG(sheet.w, sheet.h, sheet.rgba), `国风${cityName()}_四向.png`, 'image/png');
      setBusy(false, '');
      $('#stat').textContent = '四向环视图已导出';
    } catch (e) { console.error(e); setBusy(false, ''); }
  }
  async function exportZip() {
    if (state.busy) return;
    try {
      const files = [];
      const frames = [];
      for (let i = 0; i < 4; i++) {
        setBusy(true, `渲染中… 四向分包 ${i + 1}/4`);
        await nextFrame();
        const f = renderYaw(i * 90);
        frames.push(f);
        files.push({ name: `dir_${i}.png`, data: GF.encodePNG(f.w, f.h, f.rgba) });
      }
      setBusy(true, '合成 ZIP…');
      await nextFrame();
      const sheet = GF.composeSheet(frames, { pad: 8, cols: 4 });
      files.push({ name: 'sheet.png', data: GF.encodePNG(sheet.w, sheet.h, sheet.rgba) });
      files.push({ name: 'city.json', data: new TextEncoder().encode(JSON.stringify(state.city, null, 2)) });
      download(GF.makeZip(files), `国风${cityName()}.zip`, 'application/zip');
      setBusy(false, '');
      $('#stat').textContent = 'ZIP 已导出';
    } catch (e) { console.error(e); setBusy(false, ''); }
  }
  function saveRecipe() {
    download(new TextEncoder().encode(JSON.stringify(state.city, null, 2)),
      `国风城池配方_${state.preset}_${state.city.seed}.json`, 'application/json');
  }
  function loadRecipe(file) {
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const obj = JSON.parse(rd.result);
        state.city = GF.cityNormalize(obj);
        state.preset = 'custom';
        markChip(null);
        syncControls();
        renderAncientList();
        rebuild();
      } catch (e) { $('#stat').textContent = '配方读取失败：' + e.message; }
    };
    rd.readAsText(file);
  }
