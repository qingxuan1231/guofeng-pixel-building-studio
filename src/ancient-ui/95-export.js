'use strict';
  /* ------------------------------ 导出 ------------------------------ */
  function download(bytes, filename, mime) {
    const blob = new Blob([bytes], { type: mime || 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  }

  function renderDirs(n) {
    const r = state.recipe;
    const frames = [];
    for (let i = 0; i < n; i++) {
      frames.push(GF.render(state.mesh, {
        ppm: r.render.ppm, pitch: r.render.pitch,
        yaw: (i * 360) / n, palette: r.render.palette,
        style: r.render.style, styleAmount: r.render.styleAmount,
        outline: r.render.outline, shadow: r.render.shadow,
        transparent: r.render.transparent, seed: r.seed,
        persp: r.render.persp,
        gpu: state.gpu
      }));
    }
    return frames;
  }

  function recipeName() {
    return (state.recipe.preset || 'guofeng') + '_' + state.recipe.type;
  }

  function exportPNG() {
    if (state.busy) return;
    // 预览帧按屏幕像素降过档，单张导出必须按配方 ppm 全精度重算
    setBusy(true, '按全精度出图…');
    setTimeout(() => {
      try {
        const t0 = performance.now();
        const f = GF.render(state.mesh, exportOpts());
        const png = GF.encodePNG(f.w, f.h, f.rgba);
        download(png, `国风古建_${recipeName()}.png`, 'image/png');
        const ms = Math.round(performance.now() - t0);
        setStat(`全精度出图 ${f.w}×${f.h}px · ${f.gpu ? 'GPU' : 'CPU'} ${ms}ms`);
      } catch (e) { console.error(e); setStat('导出出错：' + e.message); }
      setBusy(false, '');
    }, 0);
  }

  // 多帧导出会连续渲染 8 / 4 次，必须分帧让出主线程，并给出「渲染中」反馈
  function nextFrame() {
    return new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0)));
  }
  function setStat(text) { const s = $('#stat'); if (s) s.textContent = text; }
  // 拖动陈设时锁视角：旋转 / 取舍景 / 双击复位都不生效，避免一拖就转跑偏
  function lockView() {
    if (!state.moveMode) return false;
    setStat('拖动模式下视角已锁定，先关掉「拖动陈设」再调视角');
    return true;
  }
  function setBusy(on, text) {
    state.busy = on;
    document.querySelectorAll('#btnExport,#btnSheet,#btnZip,#btnSave,#btnRandom').forEach((b) => { b.disabled = on; });
    if (text) setStat(text);
  }

  async function exportSheet() {
    if (state.busy) return;
    try {
      const frames = [];
      for (let i = 0; i < 8; i++) {
        setBusy(true, `渲染中… 八向精灵表 ${i + 1}/8`);
        await nextFrame();
        frames.push(renderOne(i * 45));
      }
      setBusy(true, '编码 PNG…');
      await nextFrame();
      const sheet = GF.composeSheet(frames, { pad: 10, cols: 4 });
      download(GF.encodePNG(sheet.w, sheet.h, sheet.rgba), `国风古建_${recipeName()}_八向.png`, 'image/png');
      setBusy(false, '八向精灵表已导出');
    } catch (e) { console.error(e); setBusy(false, '导出失败：' + e.message); }
  }

  function renderOne(yaw) {
    const r = state.recipe;
    return GF.render(state.mesh, {
      ppm: r.render.ppm, pitch: r.render.pitch, yaw,
      palette: r.render.palette, style: r.render.style,
      styleAmount: r.render.styleAmount, outline: r.render.outline,
      shadow: r.render.shadow, transparent: r.render.transparent, seed: r.seed,
      persp: r.render.persp,
      gpu: state.gpu
    });
  }

  async function exportZip() {
    if (state.busy) return;
    try {
      const r = state.recipe;
      const files = [];
      const frames = [];
      for (let i = 0; i < 4; i++) {
        setBusy(true, `渲染中… 四向分包 ${i + 1}/4`);
        await nextFrame();
        const f = renderOne(i * 90);
        frames.push(f);
        files.push({ name: `dir_${i}.png`, data: GF.encodePNG(f.w, f.h, f.rgba) });
      }
      setBusy(true, '合成精灵表…');
      await nextFrame();
      const sheet = GF.composeSheet(frames, { pad: 8, cols: 4 });
      files.push({ name: 'sheet.png', data: GF.encodePNG(sheet.w, sheet.h, sheet.rgba) });
      files.push({ name: 'recipe.json', data: new TextEncoder().encode(JSON.stringify(r, null, 2)) });
      download(GF.makeZip(files), `国风古建_${recipeName()}.zip`, 'application/zip');
      setBusy(false, 'ZIP 已导出');
    } catch (e) { console.error(e); setBusy(false, '导出失败：' + e.message); }
  }

  function saveRecipe() {
    const json = JSON.stringify(state.recipe, null, 2);
    download(new TextEncoder().encode(json), `国风配方_${recipeName()}.json`, 'application/json');
  }
