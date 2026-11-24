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
