/* 城池工坊 · 页面逻辑：与古建工坊的控件体系、视图、导出保持一致 */
(function () {
  'use strict';
  const GF = window.GF;
  const $ = (s) => document.querySelector(s);
  const wrap = $('#canvasWrap');
  const canvas = $('#view');

  const state = {
    city: GF.getCityPreset('standard'),
    mesh: null, frame: null,
    zoom: 2, panX: 0, panY: 0,
    busy: false, pending: false, preset: 'standard'
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

  /* ----------------------------- 路径读写 ----------------------------- */
  function getPath(o, p) {
    return p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  }
  function setPath(o, p, v) {
    const ks = p.split('.'), last = ks.pop();
    let cur = o;
    for (const k of ks) { if (cur[k] == null) cur[k] = {}; cur = cur[k]; }
    cur[last] = v;
  }

  /* ----------------------------- 控件定义 ----------------------------- */
  const STYLES = [
    { v: 'pixel', t: '像素硬边（原味）' }, { v: 'ink', t: '水墨手绘' },
    { v: 'sketch', t: '枯笔速写' }, { v: 'wash', t: '双色套印' },
    { v: 'gongbi', t: '工笔重彩' }, { v: 'woodcut', t: '木刻版画' },
    { v: 'rubbing', t: '金石拓片' }, { v: 'watercolor', t: '水彩晕染' }
  ];
  const PALETTES = [
    { v: 'qingya', t: '清雅·白日' }, { v: 'dusk', t: '暮色·黄昏' },
    { v: 'night', t: '夜色·灯影' }, { v: 'snow', t: '雪霁·素裹' },
    { v: 'moxi', t: '水墨·宣纸' }, { v: 'zheshi', t: '赭石·双套印' },
    { v: 'qinglv', t: '青绿·绢本' }
  ];
  const SHADOW_DIRS = [
    { v: 0, t: '东' }, { v: 45, t: '东南' }, { v: 90, t: '南' },
    { v: 135, t: '西南' }, { v: 180, t: '西' }, { v: 225, t: '西北' },
    { v: 270, t: '北' }, { v: 315, t: '东北' }
  ];
  const ROOF_COLORS = [
    { v: 'grey', t: '青瓦' }, { v: 'celadon', t: '绿琉璃' }, { v: 'yellow', t: '黄琉璃' }
  ];

  const GROUPS = [
    { title: '一 · 城池尺度', items: [
      { path: 'w', label: '城宽', type: 'range', min: 60, max: 200, step: 2, unit: 'm' },
      { path: 'd', label: '城深', type: 'range', min: 50, max: 180, step: 2, unit: 'm' },
      { path: 'wallH', label: '城墙高', type: 'range', min: 6, max: 14, step: 0.5, unit: 'm' },
      { path: 'wallT', label: '墙底厚', type: 'range', min: 3, max: 8, step: 0.2, unit: 'm' },
      { path: 'wallTaper', label: '收分（顶厚比）', type: 'range', min: 0, max: 0.4, step: 0.02 },
      { path: 'gateW', label: '城门洞宽', type: 'range', min: 8, max: 16, step: 0.5, unit: 'm' }
    ] },
    { title: '二 · 街网与地块', items: [
      { path: 'cols', label: '街网·东西列', type: 'range', min: 2, max: 6, step: 1, unit: '坊' },
      { path: 'rows', label: '街网·南北行', type: 'range', min: 2, max: 6, step: 1, unit: '坊' },
      { path: 'roadW', label: '主街宽', type: 'range', min: 6, max: 16, step: 0.5, unit: 'm' },
      { path: 'life', label: '生活层（摊/幌/灯）', type: 'toggle' },
      { path: 'lifeDensity', label: '生活层密度', type: 'range', min: 0.1, max: 1, step: 0.05 },
      { path: 'night', label: '夜市模式（灯更多）', type: 'toggle' },
      { path: 'seed', label: '种子', type: 'number', min: 1, max: 1e9, step: 1 }
    ] },
    { title: '三 · 里坊肌理', items: [
      { path: 'density', label: '建筑密度', type: 'range', min: 0.2, max: 1, step: 0.05 },
      { path: 'blockJit', label: '地块随机度', type: 'range', min: 0, max: 1, step: 0.05 }
    ] },
    { title: '四 · 城墙与城防', items: [
      { path: 'merlon', label: '外侧垛口', type: 'toggle' },
      { path: 'merlonStep', label: '垛口间距', type: 'range', min: 0.8, max: 3.6, step: 0.1, unit: 'm' },
      { path: 'merlonW', label: '垛口宽', type: 'range', min: 0.3, max: 1.6, step: 0.05, unit: 'm' },
      { path: 'merlonH', label: '垛口高', type: 'range', min: 0.3, max: 1.8, step: 0.05, unit: 'm' },
      { path: 'parapet', label: '内侧女墙', type: 'toggle' },
      { path: 'parapetH', label: '内侧女墙高', type: 'range', min: 0.2, max: 1.4, step: 0.05, unit: 'm' },
      { path: 'moat', label: '护城河', type: 'toggle' },
      { path: 'moatW', label: '护城河宽', type: 'range', min: 4, max: 20, step: 0.5, unit: 'm' },
      { path: 'matta', label: '马面（墩台）', type: 'toggle' },
      { path: 'bastionGap', label: '马面间距', type: 'range', min: 12, max: 60, step: 2, unit: 'm' },
      { path: 'mattaW', label: '马面面宽', type: 'range', min: 4, max: 14, step: 0.5, unit: 'm' },
      { path: 'mattaOut', label: '马面突出', type: 'range', min: 1, max: 8, step: 0.2, unit: 'm' },
      { path: 'mattaTower', label: '马面敌楼', type: 'toggle' },
      { path: 'tower', label: '四角角楼', type: 'toggle' },
      { path: 'gateTowerOn', label: '城门楼', type: 'toggle' },
      { path: 'wengcheng', label: '瓮城（屈曲开门）', type: 'toggle' },
      { path: 'wengD', label: '瓮城进深', type: 'range', min: 5, max: 24, step: 0.5, unit: 'm' },
      { path: 'wengW', label: '瓮城面宽', type: 'range', min: 10, max: 36, step: 0.5, unit: 'm' },
      { path: 'wengOffset', label: '瓮城门偏移', type: 'range', min: 0, max: 0.5, step: 0.05 },
      { path: 'arrowTower', label: '瓮城箭楼', type: 'toggle' },
      { path: 'drawbridge', label: '吊桥（木桥）', type: 'toggle' },
      { path: 'bridgeUp', label: '吊桥收起', type: 'toggle' }
    ] },
    { title: '五 · 中轴与宫城', items: [
      { path: 'palace', label: '中轴宫殿', type: 'toggle' },
      { path: 'axisHalls', label: '中轴殿数', type: 'range', min: 1, max: 3, step: 1 },
      { path: 'roofColor', label: '城楼瓦色', type: 'select', opts: ROOF_COLORS }
    ] },
    { title: '六 · 绘画风格', items: [
      { path: 'render.style', label: '画风', type: 'select', opts: STYLES },
      { path: 'render.styleAmount', label: '风格强度', type: 'range', min: 0, max: 1, step: 0.05 },
      { path: 'render.palette', label: '配色底子', type: 'select', opts: PALETTES }
    ] },
    { title: '七 · 渲染与出图', items: [
      { path: 'render.ppm', label: '像素 / 米', type: 'range', min: 6, max: 44, step: 1 },
      { path: 'render.pitch', label: '俯角（Z 轴）', type: 'range', min: 15, max: 88, step: 1, unit: '°' },
      { path: 'render.outline', label: '描边', type: 'toggle' },
      { path: 'render.shadow', label: '投影', type: 'toggle' },
      { path: 'render.sunAz', label: '光照方位', type: 'select', opts: SHADOW_DIRS },
      { path: 'render.shadowAngle', label: '阴影长度', type: 'range', min: 0.6, max: 2.4, step: 0.05 },
      { path: 'render.transparent', label: '透明底', type: 'toggle' }
    ] }
  ];

  const registry = [];

  function buildRow(it) {
    const row = document.createElement('div');
    row.className = 'row' + (it.type === 'toggle' ? ' toggle-now' : '');

    if (it.type === 'toggle') {
      row.innerHTML = `<label>${it.label}</label><div class="ctl"><input type="checkbox" /></div>`;
      const cb = row.querySelector('input');
      cb.addEventListener('change', () => { setPath(state.city, it.path, cb.checked); onChange(); });
      registry.push({ el: cb, it, kind: 'toggle' });
      return row;
    }
    if (it.type === 'select') {
      row.innerHTML = `<label>${it.label}</label><div class="ctl"><select></select></div>`;
      const sel = row.querySelector('select');
      it.opts.forEach((o) => {
        const op = document.createElement('option');
        op.value = o.v; op.textContent = o.t;
        sel.appendChild(op);
      });
      sel.addEventListener('change', () => { setPath(state.city, it.path, sel.value); onChange(); });
      registry.push({ el: sel, it, kind: 'select' });
      return row;
    }
    if (it.type === 'number') {
      row.innerHTML = `<label>${it.label}</label><div class="ctl"><input type="number" min="${it.min}" max="${it.max}" step="${it.step}" /></div>`;
      const inp = row.querySelector('input');
      inp.addEventListener('change', () => {
        let v = Number(inp.value);
        if (!isFinite(v)) v = state.city.seed;
        v = Math.max(it.min, Math.min(it.max, Math.round(v)));
        inp.value = v;
        setPath(state.city, it.path, v);
        onChange();
      });
      registry.push({ el: inp, it, kind: 'number' });
      return row;
    }

    row.innerHTML = `<label>${it.label}</label>
      <div class="ctl"><input type="range" min="${it.min}" max="${it.max}" step="${it.step}">
      <span class="val"></span></div>`;
    const rg = row.querySelector('input');
    const val = row.querySelector('.val');
    const fmt = (v) => (it.step < 1 ? Number(v).toFixed(2) : Number(v)) + (it.unit || '');
    rg.addEventListener('input', () => {
      setPath(state.city, it.path, Number(rg.value));
      val.textContent = fmt(rg.value);
      if (it.path === 'render.ppm') syncDens(Number(rg.value));
      if (it.path === 'render.pitch') setCamInfo();
      onChange();
    });
    registry.push({ el: rg, it, kind: 'range', valEl: val, fmt });
    return row;
  }

  function buildControls() {
    const host = $('#controls');
    host.innerHTML = '';
    GROUPS.forEach((g, gi) => {
      const box = document.createElement('div');
      box.className = 'group' + (gi >= 2 ? ' collapsed' : '');
      const head = document.createElement('div');
      head.className = 'group-head';
      head.innerHTML = `<span class="dot"></span><h3>${g.title}</h3><span class="arrow">▾</span>`;
      head.addEventListener('click', () => box.classList.toggle('collapsed'));
      box.appendChild(head);
      const body = document.createElement('div');
      body.className = 'group-body';
      g.items.forEach((it) => body.appendChild(buildRow(it)));
      box.appendChild(body);
      host.appendChild(box);
    });
  }

  function syncControls() {
    const r = state.city;
    registry.forEach((b) => {
      const v = getPath(r, b.it.path);
      if (b.kind === 'toggle') b.el.checked = !!v;
      else if (b.kind === 'select') b.el.value = v;
      else if (b.kind === 'number') b.el.value = v;
      else if (b.kind === 'range') { b.el.value = v; b.valEl.textContent = b.fmt(v); }
    });
    const rp = r.render;
    if ($('#densRange')) { $('#densRange').value = rp.ppm; $('#densVal').textContent = rp.ppm; }
    if ($('#pitchRange')) { $('#pitchRange').value = rp.pitch; $('#pitchVal').textContent = rp.pitch; }
    setCamInfo();
  }

  function setCamInfo() {
    const r = state.city.render;
    $('#camInfo').textContent = `俯角 Z ${Math.round(r.pitch)}° · 方位 Y ${Math.round(r.yaw)}°`;
  }

  function syncDens(v) {
    state.city.render.ppm = v;
    const rg = $('#densRange');
    if (rg && Number(rg.value) !== v) rg.value = v;
    $('#densVal').textContent = v;
  }

  /* ----------------------------- 渲染与视图 ----------------------------- */
  // 预览预算：屏幕只看得见这么大，多出来的像素不必算（导出永远不传，全精度）
  function previewBudget(zoom) {
    const w = wrap.clientWidth || 1600;
    const h = wrap.clientHeight || 900;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const z = Math.min(2.5, Math.max(1, (zoom == null ? state.zoom : zoom) / 2));
    return w * h * dpr * dpr * z * z;
  }

  function renderOpts(ppmOverride, pad, preview) {
    const r = state.city.render;
    const o = {
      ppm: ppmOverride || r.ppm, pitch: r.pitch, yaw: r.yaw, palette: r.palette,
      style: r.style || 'pixel', styleAmount: r.styleAmount == null ? 0.7 : r.styleAmount,
      outline: r.outline !== false, shadow: r.shadow !== false,
      sunAz: r.sunAz == null ? null : Number(r.sunAz),
      shadowAngle: r.shadowAngle == null ? null : r.shadowAngle,
      transparent: r.transparent !== false, focus: false, seed: state.city.seed,
      pad: pad, gpu: state.gpu
    };
    if (preview) {
      o.preview = true;
      o.maxPixels = previewBudget();
    }
    return o;
  }

  function draw() {
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
    canvas.width = f.w;
    canvas.height = f.h;
    canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(f.rgba), f.w, f.h), 0, 0);
    layout();
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

  function rebuild(keepView) {
    if (state.busy) { state.pending = true; return; }
    state.busy = true;
    setBusy(true, '正在筑城…');
    setTimeout(() => {
      const t0 = performance.now();
      state.mesh = GF.buildCity(state.city);
      state.frame = GF.render(state.mesh, renderOpts(null, null, true));
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

  let timer = 0;
  function onChange() {
    clearTimeout(timer);
    timer = setTimeout(() => rebuild(true), 160);
  }

  /* ----------------------------- 交互 ----------------------------- */
  let dragging = null;
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('mousedown', (e) => {
    dragging = { x: e.clientX, y: e.clientY, pan: e.button !== 0 || e.shiftKey, yaw: state.city.render.yaw };
    canvas.classList.add('dragging');
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - dragging.x, dy = e.clientY - dragging.y;
    if (dragging.pan) {
      state.panX += dx; state.panY += dy;
      dragging.x = e.clientX; dragging.y = e.clientY;
      layout();
    } else {
      state.city.render.yaw = Math.round((dragging.yaw + dx * 0.4 + 360) % 360);
      setCamInfo();
      onChange();
    }
  });
  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    state.city.render.yaw = Math.round(state.city.render.yaw / 15) * 15 % 360;
    dragging = null;
    canvas.classList.remove('dragging');
    syncControls();
    onChange();
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const old = state.zoom;
    state.zoom = GF.clamp(state.zoom * (e.deltaY > 0 ? 0.9 : 1.1), 0.5, 8);
    const rect = canvas.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    const k = state.zoom / old;
    state.panX -= dx * (k - 1);
    state.panY -= dy * (k - 1);
    layout();
  }, { passive: false });
  canvas.addEventListener('dblclick', () => {
    state.panX = state.panY = 0; state.zoom = 2; layout();
  });

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

  /* ----------------------------- 古建配方入城 ----------------------------- */
  const ANCIENT_QUICK = [
    { key: 'siheyuan', ico: '院' },
    { key: 'siyuan', ico: '寺' },
    { key: 'fanlou', ico: '楼' },
    { key: 'qing', ico: '宫' },
    { key: 'jiangnan', ico: '居' },
    { key: 'lou', ico: '阁' },
    { key: 'ta', ico: '塔' },
    { key: 'paifang', ico: '坊' }
  ];
  const TYPE_LABEL = {
    house: '民居', hall: '殿', courtyard: '院落', ge: '楼阁', pagoda: '塔',
    pavilion: '亭', archway: '牌坊', gate: '城门', round: '圆殿', xie: '水榭',
    fang: '舫', corridor: '廊', tai: '台', que: '阙', bridge: '桥', cave: '穴居'
  };

  function extraList() { return state.city.extras || (state.city.extras = []); }
  function extraCount() { return extraList().length; }
  function setAncientStatus(text) {
    const el = $('#ancientStatus');
    if (el) el.textContent = text;
  }
  function recipeType(rec) { return TYPE_LABEL[rec.type] || rec.type || '古建'; }
  function recipeSize(rec) {
    if (rec.type === 'courtyard') return `${Math.round(rec.courtW || 20)}×${Math.round(rec.courtD || 18)}m`;
    const w = Math.round((rec.bays || 3) * (rec.bayW || 3));
    const d = Math.round(rec.depth || 6);
    return `${w}×${d}m`;
  }

  function renderAncientQuick() {
    const host = $('#ancientQuick');
    if (!host || !GF.getPreset) return;
    host.innerHTML = '';
    ANCIENT_QUICK.forEach((q) => {
      let rec;
      try { rec = GF.getPreset(q.key); } catch (e) { return; }
      const card = document.createElement('button');
      card.className = 'ancient-card';
      card.type = 'button';
      card.dataset.key = q.key;
      card.innerHTML = `<span class="ico">${q.ico}</span><b></b><span></span><em>＋</em>`;
      card.querySelector('b').textContent = rec.name || q.key;
      card.querySelector('span:last-of-type').textContent = `${recipeType(rec)} · ${recipeSize(rec)}`;
      card.addEventListener('click', () => {
        addExtraRecipe(rec, rec.name, '古建预设');
      });
      host.appendChild(card);
    });
  }

  function renderAncientList() {
    const host = $('#ancientList');
    const count = extraCount();
    const rail = $('#ancientRailCount');
    if (rail) rail.textContent = count;
    const num = $('#ancientCount');
    if (num) num.textContent = `${count} 座`;
    if (!host) return;
    host.innerHTML = '';
    if (!count) {
      const empty = document.createElement('div');
      empty.className = 'ancient-empty';
      empty.textContent = '还没有外部古建，先从上面的预设挑一座。';
      host.appendChild(empty);
      return;
    }
    extraList().forEach((ex, i) => {
      const rec = ex.recipe || ex;
      const row = document.createElement('div');
      row.className = 'ancient-item';
      const ico = document.createElement('span');
      ico.className = 'ico';
      ico.textContent = ANCIENT_QUICK.find((q) => q.key === (rec.preset || ''))?.ico || '古';
      const meta = document.createElement('div');
      meta.className = 'meta';
      const b = document.createElement('b');
      b.textContent = ex.name || rec.name || `古建 ${i + 1}`;
      const s = document.createElement('span');
      s.textContent = `${recipeType(rec)} · ${recipeSize(rec)} · ${ex.source || '导入'}`;
      meta.appendChild(b); meta.appendChild(s);
      const del = document.createElement('button');
      del.className = 'del';
      del.type = 'button';
      del.title = '移除';
      del.textContent = '×';
      del.addEventListener('click', () => removeExtra(ex.id));
      row.appendChild(ico); row.appendChild(meta); row.appendChild(del);
      host.appendChild(row);
    });
  }

  function pushExtra(recipe, name, source) {
    let rec;
    try { rec = GF.normalize(JSON.parse(JSON.stringify(recipe))); } catch (e) { return null; }
    if (!rec || rec.type === 'city') return null;
    const ex = {
      id: 'ex' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: name || rec.name || '导入古建',
      source: source || '导入',
      recipe: rec,
      rot: [0, 90, 180, 270][Math.floor(Math.random() * 4)]
    };
    extraList().push(ex);
    return ex;
  }

  function afterExtraChange() {
    state.preset = 'custom';
    markChip(null);
    renderAncientList();
    rebuild(true);
  }

  function addExtraRecipe(recipe, name, source) {
    const ex = pushExtra(recipe, name, source);
    if (!ex) { setAncientStatus('这个配方不是单体古建，无法入城。'); return false; }
    setAncientStatus(`已加入「${ex.name}」，正在找空坊落位…`);
    afterExtraChange();
    return true;
  }

  function addManyRecipes(items, source) {
    let n = 0;
    items.forEach((it) => { if (pushExtra(it.recipe, it.name, source)) n++; });
    if (!n) { setAncientStatus('没有解析到可入城的单体古建配方。'); return; }
    setAncientStatus(`已加入 ${n} 座古建，正在自动落位…`);
    afterExtraChange();
  }

  function extractRecipes(data) {
    const out = [];
    const pushOne = (v, name) => {
      if (!v || typeof v !== 'object') return;
      if (Array.isArray(v)) { v.forEach((x) => pushOne(x)); return; }
      if (v.recipe && typeof v.recipe === 'object') { pushOne(v.recipe, name || v.name); return; }
      if (v.buildings && Array.isArray(v.buildings)) { v.buildings.forEach((x) => pushOne(x)); return; }
      if (v.extras && Array.isArray(v.extras)) { v.extras.forEach((x) => pushOne(x)); return; }
      if (v.type && v.type !== 'city') out.push({ recipe: v, name: name || v.name });
    };
    pushOne(data);
    return out;
  }

  function parseAndAdd(text, source) {
    let data;
    try { data = JSON.parse(text); } catch (e) {
      setAncientStatus('JSON 解析失败：' + e.message);
      return;
    }
    const items = extractRecipes(data);
    if (!items.length) { setAncientStatus('没有找到 type 为古建的配方（city 配方不能入城）。'); return; }
    addManyRecipes(items, source);
  }

  function removeExtra(id) {
    state.city.extras = extraList().filter((x) => x.id !== id);
    setAncientStatus('已移除，正在重排城池…');
    afterExtraChange();
  }

  function bindAncient() {
    renderAncientQuick();
    renderAncientList();

    const dock = $('#ancientDock');
    const toggle = $('#ancientToggle');
    if (toggle) {
      let open = true;
      try { open = localStorage.getItem('gf.ancientPanel') !== '0'; } catch (e) {}
      dock.classList.toggle('open', open);
      toggle.addEventListener('click', () => {
        const next = !dock.classList.contains('open');
        dock.classList.toggle('open', next);
        try { localStorage.setItem('gf.ancientPanel', next ? '1' : '0'); } catch (e) {}
      });
    }
    const close = $('#ancientClose');
    if (close) close.addEventListener('click', () => {
      dock.classList.remove('open');
      try { localStorage.setItem('gf.ancientPanel', '0'); } catch (e) {}
    });

    const fileBtn = $('#ancientFileBtn'), file = $('#ancientFile');
    if (fileBtn && file) {
      fileBtn.addEventListener('click', () => file.click());
      file.addEventListener('change', (e) => {
        const f = e.target.files[0];
        if (!f) return;
        setAncientStatus('正在读取 ' + f.name + '…');
        const rd = new FileReader();
        rd.onload = () => parseAndAdd(String(rd.result), f.name.replace(/\.json$/i, ''));
        rd.readAsText(f);
        e.target.value = '';
      });
    }
    const pasteBtn = $('#ancientPasteBtn'), paste = $('#ancientPaste');
    if (pasteBtn && paste) pasteBtn.addEventListener('click', () => {
      const text = paste.value.trim();
      if (!text) { setAncientStatus('先粘贴一段古建配方 JSON。'); return; }
      parseAndAdd(text, '粘贴');
      paste.value = '';
    });
    const clear = $('#ancientClear');
    if (clear) clear.addEventListener('click', () => {
      if (!extraCount()) return;
      state.city.extras = [];
      setAncientStatus('已清空城外来源，正在恢复随机城池…');
      afterExtraChange();
    });
  }


  function markChip(key) {
    document.querySelectorAll('#presetChips .chip').forEach((c) => c.classList.toggle('active', c.dataset.key === key));
  }

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
        state.panX = state.panY = 0; state.zoom = 2;
        markChip(p.key);
        syncControls();
        renderAncientList();
        rebuild();
      });
      chips.appendChild(c);
    });
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
      onChange();
    });
    $('#btnFull').addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen();
    });

    $('#densRange').addEventListener('input', (e) => {
      syncDens(Number(e.target.value));
      const rg = document.querySelector('input[data-k="render.ppm"]');
      if (rg) { rg.value = state.city.render.ppm; const val = rg.parentElement.querySelector('.val'); if (val) val.textContent = state.city.render.ppm; }
      onChange();
    });
    $('#pitchRange').addEventListener('input', (e) => {
      state.city.render.pitch = Number(e.target.value);
      $('#pitchVal').textContent = e.target.value;
      setCamInfo();
      const rg = document.querySelector('input[data-k="render.pitch"]');
      if (rg) { rg.value = state.city.render.pitch; const val = rg.parentElement.querySelector('.val'); if (val) val.textContent = state.city.render.pitch + '°'; }
      onChange();
    });

    document.querySelectorAll('[data-view]').forEach((b) => {
      b.addEventListener('click', () => {
        const v = b.dataset.view;
        state.city.render.pitch = v === 'bird' ? 78 : v === 'iso' ? 52 : v === 'low' ? 30 : 16;
        syncControls();
        onChange();
      });
    });
    document.querySelectorAll('[data-rot]').forEach((b) => {
      b.addEventListener('click', () => {
        const step = Number(b.dataset.rot);
        state.city.render.yaw = (state.city.render.yaw + step + 360) % 360;
        syncControls();
        onChange();
      });
    });
    window.addEventListener('resize', layout);
    const bm = $('#btnMode');
    if (bm) bm.addEventListener('click', () => {
      state.gpu = !state.gpu;
      try { localStorage.setItem('gf.renderMode', state.gpu ? 'gpu' : 'cpu'); } catch (e) {}
      paintMode();
      rebuild();
    });
  }

  // 给 range 行加 data-k，供密度联动回写
  function tagRows() {
    registry.forEach((b) => {
      if (b.kind === 'range') b.el.dataset.k = b.it.path;
    });
  }

  buildControls();
  tagRows();
  paintMode();
  syncControls();
  bind();
  bindAncient();
  rebuild();
})();
