'use strict';
  /* ------------------------------ 组件条 ------------------------------ */
  // 键位提示上方的一条组件选取条：把组件直接拖进画面落位（数量不再由配方写死），
  // 落位后即选中、画面上打高亮环，面板里可调高度 / 旋转 / 大小，也可删除。
  const COMPONENTS = [
    { g: '树', k: 'pine', t: '松' }, { g: '树', k: 'plum', t: '梅' }, { g: '树', k: 'bamboo', t: '竹' },
    { g: '树', k: 'willow', t: '柳' }, { g: '树', k: 'maple', t: '枫' }, { g: '树', k: 'gingko', t: '银杏' },
    { g: '树', k: 'misc', t: '杂树' }, { g: '树', k: 'banana', t: '芭蕉' },
    { g: '石', k: 'taihu', t: '太湖石' }, { g: '石', k: 'qianshi', t: '千层石' },
    { g: '陈设', k: 'stonelamp', t: '石灯' }, { g: '陈设', k: 'well', t: '井' },
    { g: '陈设', k: 'stele', t: '碑' }, { g: '陈设', k: 'bell', t: '钟' },
    { g: '陈设', k: 'drum', t: '鼓' }, { g: '陈设', k: 'penjing', t: '盆景' },
    { g: '陈设', k: 'tiema', t: '拴马桩' }, { g: '陈设', k: 'table', t: '石桌' },
    { g: '陈设', k: 'stool', t: '石凳' }, { g: '陈设', k: 'banner', t: '幡' }
  ];
  const COMP_GROUPS = ['树', '石', '陈设'];
  // 组件编辑面板看到的是两段合起来的清单：预设自带件（env.auto，首次构建时由 trees / rocks / props 展开）
  // 在前，组件条新落进来的自由件（env.items）在后；数组里存的是对象引用，改一处直接落到配方上。
  function envItems() {
    const e = state.recipe.env;
    if (!Array.isArray(e.auto)) e.auto = [];
    if (!Array.isArray(e.items)) e.items = [];
    return e.auto.concat(e.items);
  }
  function autoCount() {
    const e = state.recipe.env;
    return Array.isArray(e.auto) ? e.auto.length : 0;
  }
  // 按合并视图里的序号删一件，回写到它所属的那段
  function removeEnvItem(idx) {
    const e = state.recipe.env;
    const n = autoCount();
    if (idx < n) e.auto.splice(idx, 1);
    else e.items.splice(idx - n, 1);
  }
  function compLabel(k) {
    const c = COMPONENTS.filter((x) => x.k === k)[0];
    return c ? c.t : k;
  }

  // 两套栏共用一个位置：用一个「切换类型」按钮在 陈设组件 ⇄ 建筑本体 之间换，
  // 换过去时清掉另一套的选中，面板也跟着换，任何时候只有一套栏和一套编辑器在场。
  function setBarMode(m) {
    state.barMode = m;
    state.selItem = null;
    state.selPart = null;
    bldSel = null;
    buildCompBar();
    buildBldBar();
    paintCompPanel();
    paintBldPanel();
    draw();
  }
  function modeBtn(target, label) {
    const b = document.createElement('button');
    b.className = 'comp-chip comp-mode';
    b.textContent = '⇄ 切换到' + label;
    b.title = '在「陈设组件」与「建筑本体」两套选择栏之间切换';
    b.addEventListener('click', () => setBarMode(target));
    return b;
  }

  function buildCompBar() {
    const bar = $('#compBar');
    if (!bar) return;
    if (state.barMode === 'bld') { bar.style.display = 'none'; return; }
    bar.style.display = '';
    bar.innerHTML = '';
    bar.appendChild(modeBtn('bld', '建筑本体'));
    COMP_GROUPS.forEach((g) => {
      const gEl = document.createElement('div');
      gEl.className = 'comp-group';
      const lab = document.createElement('span');
      lab.className = 'comp-glabel';
      lab.textContent = g;
      gEl.appendChild(lab);
      COMPONENTS.filter((c) => c.g === g).forEach((c) => {
        const chip = document.createElement('button');
        chip.className = 'comp-chip';
        chip.textContent = c.t;
        chip.dataset.k = c.k;
        chip.draggable = true;
        chip.title = '按住拖进画面即可落一件' + c.t + '；不方便拖时点一下也会落在画面中心';
        chip.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/gf-comp', c.k);
          e.dataTransfer.effectAllowed = 'copy';
          bar.classList.add('dragging');
        });
        chip.addEventListener('dragend', () => bar.classList.remove('dragging'));
        // 点一下＝落在画面中心（不依赖 HTML5 拖拽，触控板 / 触屏也能用）
        chip.addEventListener('click', () => {
          // 落点按画布实测矩形算（画布是居中偏移的，用外框会把落点带偏）；
          // 取中轴偏下一点，落在建筑前方的场地上，不会直接插进屋顶里
          const rr = canvas.getBoundingClientRect();
          addItem(c.k, rr.left + rr.width * 0.5, rr.top + rr.height * 0.72);
        });
        gEl.appendChild(chip);
      });
      bar.appendChild(gEl);
    });
  }

  function addItem(k, clientX, clientY) {
    const p = framePt(clientX, clientY);
    const w = unproj(p.fx, p.fy);
    const env = state.recipe.env;
    if (!Array.isArray(env.items)) env.items = [];
    // 新增件只进 env.items，预设件仍留在 env.auto，两段在面板里合起来排
    env.items.push({ k, x: +w.x.toFixed(2), z: +w.z.toFixed(2), y: 0, rot: 0, s: 1 });
    state.selItem = autoCount() + env.items.length - 1;
    state.mesh = GF.build(state.recipe);
    state.moves = state.mesh.moves || [];
    state.frame = GF.render(state.mesh, previewOpts());
    draw();
    paintCompPanel();
    setStat('已落位：' + compLabel(k) + '（共 ' + (autoCount() + env.items.length) + ' 件）· 拖动可移位，面板可调高度 / 旋转');
  }

  function pickItem(clientX, clientY) {
    // 建筑编辑模式下画布归建筑段，环境件一概不拾取，免得点空处选中一棵树
    if (state.barMode !== 'env') return -1;
    const f = state.frame;
    if (!f) return -1;
    const items = envItems();
    if (!items.length) return -1;
    const p = framePt(clientX, clientY);
    const k = p.rect.width / f.w;
    const tol = Math.max(16 * k, 22);
    let best = -1, bestD = 1e9;
    items.forEach((it, i) => {
      const q = projWorld(it.x, it.z);
      // 拾取锚点抬到物件中上部，与画面上看到的那棵树对得上
      const cy = q.fy - ((it.y || 0) + 0.85) * f.map.ppm;
      const d = Math.hypot(q.fx - p.fx, cy - p.fy);
      if (d < tol && d < bestD) { bestD = d; best = i; }
    });
    return best;
  }

  function paintSelection() {
    const f = state.frame;
    if (!f) return;
    const items = envItems();
    const it = state.selItem != null ? items[state.selItem] : null;
    if (!it) return;
    const q = projWorld(it.x, it.z);
    const yy = q.fy - ((it.y || 0) + 0.95) * f.map.ppm;
    const rad = Math.max(18, 0.95 * f.map.ppm);
    ctx.save();
    // 外圈：白色描边垫底，金色虚线压在上面，深浅背景都看得见
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = 'rgba(255,253,243,.92)';
    ctx.beginPath();
    ctx.arc(q.fx, yy, rad + 2.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = '#c9962e';
    ctx.setLineDash([9, 6]);
    ctx.beginPath();
    ctx.arc(q.fx, yy, rad + 2.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // 四角对焦框：对准物件，比单圈更明确
    const cs = rad * 0.86;
    ctx.strokeStyle = '#c9962e';
    ctx.lineWidth = 2.2;
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const cx0 = q.fx + sx * cs, cy0 = yy + sy * cs;
        ctx.beginPath();
        ctx.moveTo(cx0, cy0 - sy * cs * 0.34);
        ctx.lineTo(cx0, cy0);
        ctx.lineTo(cx0 - sx * cs * 0.34, cy0);
        ctx.stroke();
      }
    }
    // 名称牌：白底 + 金边 + 金字，压在选中件正上方
    const label = compLabel(it.k);
    ctx.font = '600 14px ui-sans-serif, system-ui, sans-serif';
    const tw = ctx.measureText(label).width;
    const bw = tw + 26, bh = 24;
    const bx = q.fx - bw / 2, by = yy - rad - 34;
    ctx.fillStyle = '#fffdf3';
    ctx.strokeStyle = '#c9962e';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(bx, by, bw, bh, 7); } else { ctx.rect(bx, by, bw, bh); }
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#8a5a18';
    ctx.fillText(label, bx + 13, by + 17);
    // 指示小三角：从牌子指向物件
    ctx.fillStyle = '#c9962e';
    ctx.beginPath();
    ctx.moveTo(q.fx - 5, by + bh);
    ctx.lineTo(q.fx + 5, by + bh);
    ctx.lineTo(q.fx, by + bh + 7);
    ctx.closePath();
    ctx.fill();
    // 落点：地面上的十字 + 半透明影圈，说明它踩在哪
    ctx.fillStyle = 'rgba(201,150,46,.18)';
    ctx.beginPath();
    ctx.ellipse(q.fx, q.fy, rad * 0.62, rad * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(201,150,46,.95)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(q.fx - 6, q.fy); ctx.lineTo(q.fx + 6, q.fy);
    ctx.moveTo(q.fx, q.fy - 6); ctx.lineTo(q.fx, q.fy + 6);
    ctx.stroke();
    ctx.restore();
  }

  function paintCompPanel() {
    const panel = $('#compPanel');
    if (!panel) return;
    // 栏与编辑器同步：建筑模式下这台编辑器整块让位，选建筑那一段时也收起
    if (state.barMode !== 'env' || state.selPart) {
      panel.classList.remove('open');
      return;
    }
    const items = envItems();
    const it = state.selItem != null ? items[state.selItem] : null;
    // 面板常开：没选中时也列出已放物件，滑条置灰，别让人以为功能没做
    panel.classList.add('open');
    const head = it
      ? '<div class="cp-head"><b>选中：' + compLabel(it.k) + '</b><span class="cp-tip">虚线框即当前件 · 拖标题可移面板</span>'
        + '<button class="cp-btn" id="cpClose">取消选中</button>'
        + '<button class="cp-btn danger" id="cpDel">删除</button></div>'
      : '<div class="cp-head"><b>组件编辑</b><span class="cp-tip">点画面里的物件即可选中 · 拖标题可移面板</span>'
        + '<button class="cp-btn" id="cpHide">收起</button></div>';
    const list = '<div class="cp-list">' + (items.length
      ? items.map((x, i) => {
        const preset = i < autoCount();
        return '<button class="cp-item' + (i === state.selItem ? ' on' : '') + (preset ? ' preset' : '') + '" data-i="' + i + '" title="' + (preset ? '配方自带件' : '新加件') + '">'
          + compLabel(x.k) + (preset ? '' : ' · 新') + '</button>';
      }).join('')
      : '<span class="cp-empty">还没有放置物件：从上面拖一件进来，或直接点组件卡</span>') + '</div>';
    const dis = it ? '' : ' disabled';
    const rows = '<label class="cp-row">高度<input type="range" id="cpY" min="-1" max="3" step="0.05" value="' + (it ? (it.y || 0) : 0) + '"' + dis + '><b id="cpYv">' + (it ? (it.y || 0).toFixed(2) : '—') + '</b></label>'
      + '<label class="cp-row">旋转<input type="range" id="cpR" min="0" max="360" step="5" value="' + (it ? (it.rot || 0) : 0) + '"' + dis + '><b id="cpRv">' + (it ? Math.round(it.rot || 0) + '°' : '—') + '</b></label>'
      + '<label class="cp-row">大小<input type="range" id="cpS" min="0.5" max="1.6" step="0.05" value="' + (it ? (it.s || 1) : 1) + '"' + dis + '><b id="cpSv">' + (it ? (it.s || 1).toFixed(2) : '—') + '</b></label>';
    panel.innerHTML = head + list + rows;
    panel.querySelectorAll('.cp-item').forEach((b) => {
      b.addEventListener('click', () => {
        state.selItem = +b.dataset.i;
        paintCompPanel();
        draw();
      });
    });
    const hide = $('#cpHide');
    if (hide) hide.addEventListener('click', () => panel.classList.remove('open'));
    makeDraggable(panel);
    if (!it) return;
    bindCompSlider($('#cpY'), (e) => {
      it.y = +e.target.value;
      $('#cpYv').textContent = it.y.toFixed(2);
      compDragRender();
    });
    bindCompSlider($('#cpR'), (e) => {
      it.rot = +e.target.value;
      $('#cpRv').textContent = Math.round(it.rot) + '°';
      compDragRender();
    });
    bindCompSlider($('#cpS'), (e) => {
      it.s = +e.target.value;
      $('#cpSv').textContent = it.s.toFixed(2);
      compDragRender();
    });
    $('#cpDel').addEventListener('click', () => {
      removeEnvItem(state.selItem);
      state.selItem = null;
      rebuild();
      paintCompPanel();
      setStat('已删除该件（余 ' + envItems().length + ' 件）');
    });
    $('#cpClose').addEventListener('click', () => {
      state.selItem = null;
      paintCompPanel();
      draw();
    });
  }
