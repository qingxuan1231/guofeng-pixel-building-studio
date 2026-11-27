'use strict';
  /* ----------------------------- 路径读写 ----------------------------- */
  // 拉条滚轮增减：悬浮在 range 上滚动鼠标，按 step 精度调值并复用原 input 逻辑
  function bindRangeWheel(el) {
    if (!el) return;
    let acc = 0;
    el.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey) { // 保留浏览器缩放
        return;
      }
      e.preventDefault();
      acc += e.deltaY;
      const step = Number(el.step) || 1;
      let dv = 0;
      while (acc >= 60) { acc -= 60; dv += step; }
      while (acc <= -60) { acc += 60; dv -= step; }
      if (!dv) return;
      const min = Number(el.min), max = Number(el.max);
      const v = Math.max(min, Math.min(max, Number(el.value) + dv));
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, { passive: false });
  }
  function getPath(o, p) {
    return p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  }
  function setPath(o, p, v) {
    const ks = p.split('.'), last = ks.pop();
    let cur = o;
    for (const k of ks) { if (cur[k] == null) cur[k] = {}; cur = cur[k]; }
    cur[last] = v;
  }
  function depOK(it, r) {
    const d = it.dep;
    if (!d) return true;
    const v = getPath(r, d.path);
    if (d.truthy && !v) return false;
    if (d.falsy && v) return false;
    if (d.oneOf && d.oneOf.indexOf(v) < 0) return false;
    if (d.notOneOf && d.notOneOf.indexOf(v) >= 0) return false;
    if (d.equals !== undefined && v !== d.equals) return false;
    if (d.notEquals !== undefined && v === d.notEquals) return false;
    return true;
  }
  function applyVisibility() {
    registry.forEach((b) => {
      const row = b.el.closest('.row');
      if (!row) return;
      const ok = depOK(b.it, state.city);
      row.classList.toggle('dimmed', !ok);
      row.querySelectorAll('input, select').forEach((inp) => { inp.disabled = !ok; });
    });
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
      { path: 'wallT', label: '墙底厚', type: 'range', min: 3, max: 8, step: 0.2, unit: 'm', dep: { path: 'wallProfile', equals: 'custom' } },
      { path: 'wallProfile', label: '城墙收分档', type: 'select', opts: GF.WALL_PROFILE_OPTS },
      { path: 'wallTaper', label: '收分（顶厚比）', type: 'range', min: 0, max: 0.5, step: 0.02, digits: 4, dep: { path: 'wallProfile', equals: 'custom' } },
      { path: 'gateW', label: '城门洞宽', type: 'range', min: 8, max: 16, step: 0.5, unit: 'm' },
      { path: 'gateArch', label: '门洞样式', type: 'select', opts: [{ v: 'arch', t: '券门（半圆拱）' }, { v: 'guijiao', t: '圭角门（平顶抹角）' }] }
    ] },
    { title: '二 · 街网与地块', items: [
      { path: 'cols', label: '街网·东西列', type: 'range', min: 2, max: 6, step: 1, unit: '坊' },
      { path: 'rows', label: '街网·南北行', type: 'range', min: 2, max: 6, step: 1, unit: '坊' },
      { path: 'roadW', label: '主街宽', type: 'range', min: 6, max: 16, step: 0.5, unit: 'm' },
      { path: 'streetMode', label: '街市模式', type: 'select', opts: [{ v: 'market', t: '街市（开放街巷）' }, { v: 'ward', t: '坊制（坊墙+坊门）' }] },
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
      { path: 'render.ppm', label: '像素 / 米', type: 'range', min: 8, max: 44, step: 1 },
      { path: 'render.pitch', label: '俯角（Z 轴）', type: 'range', min: 15, max: 88, step: 1, unit: '°' },
      { path: 'render.persp', label: '人眼透视（0=轴测）', type: 'range', min: 0, max: 1, step: 0.05 },
      { path: 'render.outline', label: '描边', type: 'toggle' },
      { path: 'render.shadow', label: '投影', type: 'toggle' },
      { path: 'render.sunAz', label: '光照方位', type: 'select', opts: SHADOW_DIRS },
      { path: 'render.shadowAngle', label: '阴影长度', type: 'range', min: 0.6, max: 2.4, step: 0.05 },
      { path: 'render.transparent', label: '透明底', type: 'toggle' }
    ] }
  ];

  const registry = [];
  // 只影响相机/成像、不需要重新筑城的参数。拖这些滑块只重渲染，不重建几何。
  const CAMERA_KEYS = new Set([
    'render.yaw', 'render.pitch', 'render.ppm', 'render.palette', 'render.style',
    'render.styleAmount', 'render.outline', 'render.shadow', 'render.sunAz',
    'render.shadowAngle', 'render.transparent', 'render.persp'
  ]);

  function buildRow(it) {
    const row = document.createElement('div');
    row.className = 'row' + (it.type === 'toggle' ? ' toggle-now' : '');

    if (it.type === 'toggle') {
      row.innerHTML = `<label>${it.label}</label><div class="ctl"><input type="checkbox" /></div>`;
      const cb = row.querySelector('input');
      cb.addEventListener('change', () => { setPath(state.city, it.path, cb.checked); onChange(it.path); });
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
      sel.addEventListener('change', () => {
        setPath(state.city, it.path, sel.value);
        if (it.path === 'wallProfile' || it.path === 'wallH') {
          const sec = GF.wallProfileSection ? GF.wallProfileSection(state.city.wallProfile, state.city.wallH, state.city.wallT) : null;
          if (sec) {
            state.city.wallT = sec.base;
            state.city.wallTaper = +(1 - sec.top / sec.base).toFixed(4);
          } else {
            const p = GF.WALL_PROFILES && GF.WALL_PROFILES[state.city.wallProfile];
            if (p && p.ratio) state.city.wallTaper = +(1 - 1 / p.ratio).toFixed(4);
          }
          syncControls();
        }
        onChange(it.path);
      });
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
        onChange(it.path);
      });
      registry.push({ el: inp, it, kind: 'number' });
      return row;
    }

    row.innerHTML = `<label>${it.label}</label>
      <div class="ctl"><input type="range" min="${it.min}" max="${it.max}" step="${it.step}">
      <span class="val"></span></div>`;
    const rg = row.querySelector('input');
    const val = row.querySelector('.val');
    const fmt = (v) => {
      const dec = it.digits != null ? it.digits : (it.step < 1 ? 2 : 0);
      return Number(v).toFixed(dec) + (it.unit || '');
    };
    rg.addEventListener('input', () => {
      if (it.path === 'render.pitch') {
        val.textContent = fmt(rg.value);
        setPitch(Number(rg.value));
        return;
      }
      if (it.path === 'render.persp') {
        val.textContent = fmt(rg.value);
        setPersp(Number(rg.value));
        return;
      }
      setPath(state.city, it.path, Number(rg.value));
      val.textContent = fmt(rg.value);
      if (it.path === 'render.ppm') syncDens(Number(rg.value));
      onChange(it.path);
    });
    if (it.path === 'render.ppm') bindRangeWheel(rg);
    if (it.path === 'render.pitch') bindPitchSlider(rg);
    if (it.path === 'render.persp') bindPerspSlider(rg);
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
    applyVisibility();
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
    const pct = Math.round((rp.persp == null ? 1 : rp.persp) * 100);
    if ($('#perspRange')) { $('#perspRange').value = pct; $('#perspVal').textContent = pct; }
    setCamInfo();
    applyVisibility();
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