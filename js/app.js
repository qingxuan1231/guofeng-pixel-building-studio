/* ============================================================================
 * 国风古建像素工坊 · 界面与交互
 * ==========================================================================*/
(function () {
  'use strict';
  const GF = window.GF;

  const state = {
    recipe: GF.getPreset('siheyuan'),
    mesh: null,
    frame: null,
    zoom: 2,
    panX: 0,
    panY: 0,
    view: 'all',
    refit: true,
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
      ? '地面栅格：开着（1 m 一格，5 格加重；X 轴偏红、Z 轴偏蓝）。点一下关掉'
      : '地面栅格：关着。点一下打开';
  }

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
    $('#cpY').addEventListener('input', (e) => {
      it.y = +e.target.value;
      $('#cpYv').textContent = it.y.toFixed(2);
      dragRender();
    });
    $('#cpR').addEventListener('input', (e) => {
      it.rot = +e.target.value;
      $('#cpRv').textContent = Math.round(it.rot) + '°';
      dragRender();
    });
    $('#cpS').addEventListener('input', (e) => {
      it.s = +e.target.value;
      $('#cpSv').textContent = it.s.toFixed(2);
      dragRender();
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

  /* ------------------------------ 建筑本体：第二套选择栏 + 编辑器 ------------------------------ */
  // 思路：把一栋楼拆成「台基 / 第 N 层 / 屋面」几件，点栏上的卡就选中那一段，
  // 画布上给那一段画一个金色线框；右侧（可拖动的）编辑器只动这一段对应的配方字段。
  const ROOF_NAMES = [
    { v: 'gable', t: '悬山 / 硬山' }, { v: 'gableHip', t: '歇山' }, { v: 'hip', t: '庑殿' },
    { v: 'pyramid', t: '攒尖' }, { v: 'roll', t: '卷棚' }, { v: 'cross', t: '十字歇山' }
  ];
  const PED_NAMES = [{ v: 'xumizuo', t: '须弥座' }, { v: 'plain', t: '直台基' }, { v: 'stone', t: '毛石台' }];
  const DG_NAMES = ['无', '一斗三升', '五踩', '七踩'];

  // 建筑编辑器：按段（台基 / 每层 / 屋面）列出这一段所有可调字段。
  // 行统一带 data-path / data-kind，改动直接写回配方；range 只轻量重建，避免拖到一半
  // 面板被 innerHTML 换掉（那样滑条会断、只走一格就失效）。
  function bldFloors() {
    const r = state.recipe;
    return Math.max(1, Math.min(9, Math.round((r.type === 'pagoda' ? (r.tiers || r.floors) : r.floors) || 1)));
  }
  function bldH() {
    const r = state.recipe;
    const list = Array.isArray(r.floorHList) ? r.floorHList : [];
    const out = [];
    for (let i = 0; i < bldFloors(); i++) out.push(+(list[i] != null ? list[i] : (r.floorH || 3.2)));
    return out;
  }
  function bldParts() {
    // 多建筑院落：栏上给每一栋单独一张卡（id 来自 gf-build 的 mb.units），
    // 这样点「东厢房」就只改东厢房，不再整院共用一套参数。
    const us = bldUnits();
    if (us) return us.map((u) => ({ k: 'u:' + u.id, t: u.label || u.id }));
    const hs = bldH();
    const parts = [{ k: 'base', t: '台基' }];
    hs.forEach((h, i) => parts.push({ k: 'f' + i, t: hs.length === 1 ? '屋身' : '第 ' + (i + 1) + ' 层' }));
    parts.push({ k: 'roof', t: '屋面 · 脊饰' });
    return parts;
  }
  function bldUnits() {
    const u = state.mesh && state.mesh.units;
    return Array.isArray(u) && u.length ? u : null;
  }
  function bldCur() {
    // 换预设后旧的段位可能不存在（单栋的「台基」→ 院落是逐栋），先校验再给默认
    if (state.selPart && !bldParts().some((p) => p.k === state.selPart.k)) state.selPart = null;
    return state.selPart || { k: null };
  }
  function buildBldBar() {
    const bar = $('#bldBar');
    if (!bar) return;
    if (state.barMode !== 'bld') { bar.style.display = 'none'; return; }
    bar.style.display = '';
    bar.innerHTML = '';
    bar.appendChild(modeBtn('env', '陈设组件'));
    const lab = document.createElement('span');
    lab.className = 'comp-glabel';
    lab.textContent = '建筑本体';
    bar.appendChild(lab);
    bldParts().forEach((p) => {
      const b = document.createElement('button');
      b.className = 'comp-chip' + (bldCur().k === p.k ? ' on' : '');
      b.textContent = p.t;
      b.dataset.k = p.k;
      b.addEventListener('click', () => {
        state.selPart = { k: p.k };
        state.selItem = null;
        paintCompPanel();
        paintBldBar();
        paintBldPanel();
        draw();
      });
      bar.appendChild(b);
    });
    const off = document.createElement('button');
    off.className = 'comp-chip';
    off.textContent = '不选';
    off.addEventListener('click', () => {
      state.selPart = null;
      paintBldBar();
      paintBldPanel();
      draw();
    });
    bar.appendChild(off);
  }
  function paintBldBar() {
    const bar = $('#bldBar');
    if (!bar) return;
    const cur = bldCur();
    bar.querySelectorAll('.comp-chip[data-k]').forEach((b) => {
      b.classList.toggle('on', b.dataset.k === cur.k);
    });
  }
  // 选中段的包围盒（世界坐标），用于画线框
  function bldBox(k) {
    const r = state.recipe;
    if (k && k.slice(0, 2) === 'u:') {
      const us = bldUnits() || [];
      const u = us.filter((x) => 'u:' + x.id === k)[0];
      if (!u) return null;
      const swap = Math.abs(u.rot || 0) % 180 === 90;
      const hw = (swap ? u.D : u.W) / 2, hd = (swap ? u.W : u.D) / 2;
      return { x0: u.x - hw, x1: u.x + hw, z0: u.z - hd, z1: u.z + hd, y0: 0, y1: Math.max(0.9, u.topY || 0) };
    }
    if (['courtyard', 'city', 'bridge'].indexOf(r.type) >= 0) return null;
    const eave0 = r.eave == null ? 1.0 : r.eave;
    const W = (r.bays || 3) * (r.bayW || 3.0) + 2 * eave0 + 0.4;
    const D = (r.depth || ((r.bays || 3) * (r.bayW || 3.0) * 0.72)) + 2 * eave0 + 0.4;
    const hs = bldH();
    const y0b = 0, y1b = Math.max(0.3, r.baseH || 0.8);
    if (k === 'base') return { x0: -W / 2, x1: W / 2, z0: -D / 2, z1: D / 2, y0: y0b, y1: y1b };
    let y = y1b;
    for (let i = 0; i < hs.length; i++) {
      const top = y + hs[i];
      if (k === 'f' + i) return { x0: -W / 2, x1: W / 2, z0: -D / 2, z1: D / 2, y0: y, y1: top };
      y = top;
    }
    const slope = r.slope == null ? 0.5 : r.slope;
    const eave = (Array.isArray(r.eaveList) && r.eaveList[hs.length - 1]) || (r.eave == null ? 1.0 : r.eave);
    // 屋面框贴着屋脊收：按举折算出脊高，别再框到半空里
    return { x0: -W / 2 - eave, x1: W / 2 + eave, z0: -D / 2 - eave, z1: D / 2 + eave, y0: y, y1: y + (D / 2 + eave) * slope * 0.92 + 0.5 };
  }
  function paintPartSelection() {
    const f = state.frame;
    if (!f || !state.selPart) return;
    const b = bldBox(state.selPart.k);
    if (!b) return;
    const px = (x, y, z) => {
      const q = projWorld(x, z);
      return { x: q.fx, y: q.fy - y * f.map.ppm };
    };
    const c = [];
    for (const zz of [b.z0, b.z1]) for (const yy of [b.y0, b.y1]) for (const xx of [b.x0, b.x1]) c.push(px(xx, yy, zz));
    // 索引：0..7 = (z0,y0,x0)(z0,y0,x1)(z0,y1,x0)(z0,y1,x1)(z1,y0,x0)(z1,y0,x1)(z1,y1,x0)(z1,y1,x1)
    const edges = [[0, 1], [0, 2], [1, 3], [2, 3], [4, 5], [4, 6], [5, 7], [6, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    ctx.save();
    ctx.strokeStyle = 'rgba(201,150,46,.95)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    edges.forEach((e) => {
      const a = c[e[0]], bb = c[e[1]];
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(bb.x, bb.y);
      ctx.stroke();
    });
    ctx.setLineDash([]);
    const top = c[2];
    const label = (bldParts().filter((p) => p.k === state.selPart.k)[0] || {}).t || '';
    ctx.font = '600 13px ui-sans-serif, system-ui, sans-serif';
    const tw = ctx.measureText(label).width;
    const bw = tw + 16, bh = 22;
    const bx = top.x - bw / 2, by = top.y - 12 - bh;
    ctx.strokeStyle = 'rgba(201,150,46,.95)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.rect(bx, by, bw, bh);
    ctx.fillStyle = '#fffdf3';
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(top.x - 5, by + bh);
    ctx.lineTo(top.x + 5, by + bh);
    ctx.lineTo(top.x, by + bh + 7);
    ctx.closePath();
    ctx.fillStyle = '#fffdf3';
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#7a4f12';
    ctx.fillText(label, bx + 8, by + 15);
    ctx.restore();
  }
  // 面板拖动：抓住头部就能把它挪到画面任意处
  function makeDraggable(panel) {
    if (!panel || panel.dataset.dragReady) return;
    panel.dataset.dragReady = '1';
    panel.addEventListener('pointerdown', (e) => {
      const head = e.target.closest ? e.target.closest('.cp-head') : null;
      if (!head || e.target.closest('button')) return;
      // 面板是 absolute 定位在画布容器里的：把屏幕坐标换算回容器坐标再写 left/top，
      // 同时先量“当下真正落在屏幕上的位置”，撤掉居中用的 translateX(-50%)，面板才不会在按下时横跳半个身位
      const par = panel.offsetParent || panel.parentElement || document.body;
      const pr = par.getBoundingClientRect();
      const pL = pr.left + (par.clientLeft || 0), pT = pr.top + (par.clientTop || 0);
      const r = panel.getBoundingClientRect();
      const ox = e.clientX - r.left, oy = e.clientY - r.top;
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      panel.style.left = (r.left - pL) + 'px';
      panel.style.top = (r.top - pT) + 'px';
      panel.style.transform = 'none';
      const move = (ev) => {
        const maxL = Math.max(6, window.innerWidth - pL - r.width - 6);
        const maxT = Math.max(6, window.innerHeight - pT - r.height - 6);
        panel.style.left = Math.max(6, Math.min(maxL, ev.clientX - pL - ox)) + 'px';
        panel.style.top = Math.max(6, Math.min(maxT, ev.clientY - pT - oy)) + 'px';
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      e.preventDefault();
    });
  }

  let bldT = 0;
  function scheduleBld() {
    if (bldT) clearTimeout(bldT);
    bldT = setTimeout(() => { bldT = 0; rebuild(true); }, 80);
  }
  function bldSetPath(path, v) {
    const ps = path.split('.');
    let o = state.recipe;
    for (let i = 0; i < ps.length - 1; i++) {
      const k = ps[i];
      if (o[k] == null) o[k] = /^\d+$/.test(ps[i + 1]) ? [] : {};
      o = o[k];
    }
    o[ps[ps.length - 1]] = v;
    // 瓦色跟着换材质：绿琉璃在配方里写作 celadon，只改 tileColor 而不改 tile 是没效果的
    if (path === 'tileColor') {
      const tm = {
        grey: ['tile', 'tileB'], celadon: ['glazeG', 'glazeGD'], yellow: ['glazeY', 'glazeYD'],
        blue: ['glazeB', 'glazeBD'], clay: ['terracotta', 'terracotta'], thatch: ['thatch', 'thatchB']
      }[v];
      if (tm) { state.recipe.tile = tm[0]; state.recipe.tileB = tm[1]; }
    }
    // 首层层高同时写 floorH：亭 / 门 / 台 / 桥一类不走逐层数组，读的是 floorH
    if (path === 'floorHList.0' || path === 'eaveList.0') {
      const flat = path === 'floorHList.0' ? 'floorH' : 'eave';
      if (state.recipe[flat] == null || ps.length === 2) state.recipe[flat] = v;
    }
  }
  const BLD_SEL_T = ['hall', 'house', 'ge', 'xie'];
  const BLD_WALLED = ['hall', 'house', 'ge', 'courtyard', 'gate'];
  const BLD_RAILED = ['hall', 'house', 'ge', 'que', 'tai', 'xie', 'pagoda'];
  const BLD_PLAQUED = ['hall', 'house', 'courtyard', 'ge', 'gate', 'que', 'xie', 'archway', 'tai', 'pavilion'];
  const DG_LIST = [{ v: 0, t: '无' }, { v: 1, t: '一斗三升' }, { v: 2, t: '五踩' }, { v: 3, t: '七踩' }];

  function paintBldPanel() {
    const panel = $('#bldPanel');
    if (!panel) return;
    if (state.barMode !== 'bld') { panel.classList.remove('open'); panel.innerHTML = ''; return; }
    const r = state.recipe;
    if (state.selPart && !bldParts().some((p) => p.k === state.selPart.k)) state.selPart = null;
    const cur = state.selPart;
    if (!cur) {
      panel.classList.add('open');
      panel.innerHTML = '<div class="cp-head"><b>建筑本体编辑</b><span class="cp-tip">点下面一段，或点栏上的段位</span>'
        + '<span class="cp-grip">拖动标题可移动面板</span></div>'
        + '<div class="cp-list">' + bldParts().map((p) =>
          '<button class="cp-item bld-pick" data-k="' + p.k + '">' + p.t + '</button>').join('') + '</div>'
        + '<div class="cp-row cp-tip2">院落/寺观是一院多栋：点栏上任一栋（或直接点画面里的房子）就只编辑那一栋——面阔 / 进深 / 层高 / 屋顶 / 瓦色 / 台基 / 门窗都算这一栋自己的；单栋建筑则按台基 / 每层 / 屋面分段调</div>';
      makeDraggable(panel);
      panel.querySelectorAll('.bld-pick').forEach((b) => {
        b.addEventListener('click', () => {
          state.selPart = { k: b.dataset.k };
          state.selItem = null;
          paintCompPanel();
          paintBldBar();
          paintBldPanel();
          draw();
        });
      });
      return;
    }
    panel.classList.add('open');
    const type = r.type || 'hall';
    const label = (bldParts().filter((p) => p.k === cur.k)[0] || {}).t || '';

    // —— 行构造：range / select / toggle ——
    const fmt = (v, d) => (typeof v === 'number' ? v.toFixed(d) : v);
    const rng = (lab, path, min, max, step, val, unit, on) => {
      if (on === false) return '';
      const v = +val;
      return '<label class="cp-row">' + lab + '<input type="range" data-kind="rng" data-lab="' + lab + '" data-path="' + path
        + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + v + '"><b>'
        + v.toFixed(2) + (unit || '') + '</b></label>';
    };
    const sel = (lab, path, list, val, on) => {
      if (on === false) return '';
      return '<label class="cp-row">' + lab + '<select data-kind="sel" data-path="' + path + '">'
        + list.map((o) => '<option value="' + o.v + '"' + (String(o.v) === String(val) ? ' selected' : '') + '>' + o.t + '</option>').join('')
        + '</select></label>';
    };
    const tog = (lab, path, val, on) => {
      if (on === false) return '';
      return '<label class="cp-row">' + lab + '<input type="checkbox" data-kind="chk" data-path="' + path + '"' + (val ? ' checked' : '') + '></label>';
    };
    const head = (t) => '<div class="cp-sub">' + t + '</div>';
    let body = '';

    if (cur.k.slice(0, 2) === 'u:') {
      // —— 单体建筑编辑：只改这一栋（写 r.units[id]，构建时并回这一栋的配方）
      const id = cur.k.slice(2);
      const us = bldUnits() || [];
      const u = us.filter((x) => x.id === id)[0] || { W: 4, D: 3, topY: 4, baseH: 0.3 };
      if (!r.units) r.units = {};
      const ov = r.units[id] || (r.units[id] = {});
      const p = 'units.' + id + '.';
      const g = (key, dflt) => (ov[key] != null ? ov[key] : (r[key] != null ? r[key] : dflt));
      body += head('这一栋 · ' + (u.label || id));
      body += '<div class="cp-row cp-tip2">面阔 ' + fmt(u.W, 2) + ' × 进深 ' + fmt(u.D, 2) + ' m · 总高 ' + fmt(u.topY, 2)
        + ' m（尺寸只动这一栋，别的栋不变）</div>';
      body += rng('面阔', p + 'W', 2.4, 16, 0.1, u.W, 'm');
      body += rng('进深', p + 'D', 2.0, 9.0, 0.1, u.D, 'm');
      body += rng('开间数', p + 'bays', 1, 7, 1, g('bays', 3));
      body += rng('层数', p + 'floors', 1, 3, 1, g('floors', 1));
      body += rng('层高', p + 'floorH', 2.0, 5.4, 0.05, g('floorH', 3.2), 'm');
      body += rng('台基高', p + 'baseH', 0.1, 1.4, 0.05, g('baseH', u.baseH || 0.3), 'm');
      body += rng('出檐', p + 'eave', 0.3, 2.0, 0.05, g('eave', 1.0), 'm');
      body += sel('屋顶形制', p + 'roofType', ROOF_TYPES, g('roofType', 'gable'));
      body += sel('瓦色', p + 'tileColor', TILE_COLORS, g('tileColor', 'grey'));
      body += rng('举折', p + 'slope', 0.32, 0.8, 0.01, g('slope', 0.5));
      body += rng('起翘', p + 'upturn', 0, 0.7, 0.02, g('upturn', 0.4));
      body += sel('墙面材质', p + 'wallMat', WALL_MATS, g('wallMat', 'plaster'));
      body += sel('立柱材质', p + 'colMat', COL_MATS, g('colMat', 'timber'));
      body += sel('格心样式', p + 'winPattern', WINS, g('winPattern', 'step'));
      body += rng('窗宽', p + 'winW', 0.6, 2.4, 0.05, g('winW', 1.2), 'm');
      body += rng('窗高', p + 'winH', 0.7, 2.6, 0.05, g('winH', 1.4), 'm');
      body += sel('门式', p + 'doorStyle', [{ v: 'leaf', t: '隔扇门' }, { v: 'panel', t: '板门' }], g('doorStyle', 'leaf'));
      body += rng('门宽', p + 'doorW', 1.0, 3.0, 0.05, g('doorW', 1.8), 'm');
      body += rng('门高', p + 'doorH', 1.8, 3.6, 0.05, g('doorH', 2.6), 'm');
      body += tog('匾额', p + 'plaque', !!g('plaque', false));
    } else if (cur.k === 'base') {
      body += head('台基');
      body += rng('台基高', 'baseH', 0.2, 1.4, 0.05, r.baseH == null ? 0.8 : r.baseH, 'm');
      body += rng('踏跺级数', 'steps', 0, 6, 1, r.steps == null ? 2 : r.steps);
      body += sel('台基形制', 'pedestal', PEDESTALS, r.pedestal || 'xumizuo');
      body += tog('台基栏杆', 'railing', !!r.railing);
      body += sel('栏杆样式', 'railStyle', RAILS, r.railStyle || 'wood', !!r.railing);
      body += tog('门前甬道', 'env.path', r.env ? r.env.path !== false : true, r.env ? r.env.showGround !== false : true);
    } else if (cur.k === 'roof') {
      body += head('屋面 · 脊饰');
      body += sel('屋顶形制', 'roofType', ROOF_TYPES, r.roofType || 'gable');
      body += sel('瓦色', 'tileColor', TILE_COLORS, r.tileColor || 'grey');
      body += rng('出檐', 'eave', 0.4, 2.0, 0.05, r.eave == null ? 1.0 : r.eave, 'm');
      body += rng('举折', 'slope', 0.32, 0.8, 0.01, r.slope == null ? 0.5 : r.slope);
      body += rng('起翘', 'upturn', 0, 0.7, 0.02, r.upturn == null ? 0.4 : r.upturn);
      body += rng('重檐层数', 'tiers', 1, 2, 1, r.tiers == null ? 1 : r.tiers, '', type === 'hall' || type === 'pagoda');
      body += sel('正脊', 'ridgeStyle', [{ v: 'none', t: '无' }, { v: 'plain', t: '素脊' }, { v: 'ornate', t: '雕饰脊' }], r.ridgeStyle || 'plain', BLD_SEL_T.indexOf(type) >= 0);
      body += rng('脊兽数', 'beasts', 0, 5, 1, r.beasts == null ? 0 : r.beasts, '', BLD_SEL_T.indexOf(type) >= 0 && (r.ridgeStyle || 'plain') !== 'none');
      body += tog('宝顶', 'finial', !!r.finial);
      body += sel('檐口剪边', 'trimColor', TRIM_COLORS, r.trimColor || 'grey');
      body += tog('悬鱼 · 惹草', 'xuanYu', !!r.xuanYu, ['gable', 'gableHip', 'lu', 'roll'].indexOf(r.roofType || 'gable') >= 0);
      body += tog('檐角风铎', 'windDuo', !!r.windDuo);
    } else {
      const i = +cur.k.slice(1);
      const hs = bldH();
      if (!Array.isArray(r.floorHList)) r.floorHList = [];
      while (r.floorHList.length < bldFloors()) r.floorHList.push(hs[r.floorHList.length]);
      if (!Array.isArray(r.eaveList)) r.eaveList = [];
      while (r.eaveList.length < bldFloors()) r.eaveList.push(r.eave == null ? 1.0 : r.eave);
      if (!Array.isArray(r.dgList)) r.dgList = [];
      while (r.dgList.length < bldFloors()) r.dgList.push(0);
      if (!Array.isArray(r.shrinkList)) r.shrinkList = [];
      while (r.shrinkList.length < bldFloors()) r.shrinkList.push(0.92);
      const perFloor = type === 'pagoda' || type === 'ge';
      body += head('第 ' + (i + 1) + ' 层 · 屋身');
      body += rng('层高', 'floorHList.' + i, 1.6, 5.4, 0.05, hs[i], 'm');
      body += rng('出檐', perFloor ? ('eaveList.' + i) : 'eave', 0.3, 2.2, 0.05, perFloor ? r.eaveList[i] : (r.eave == null ? 1.0 : r.eave), 'm');
      body += rng('收分', 'shrinkList.' + i, 0.6, 1.05, 0.01, r.shrinkList[i], '', type === 'pagoda' || type === 'ge');
      body += tog('斗拱', 'dougong', !!r.dougong, BLD_SEL_T.indexOf(type) >= 0);
      body += sel('铺作样式', 'dgStyle', DG_STYLES, r.dgStyle || 'mid', BLD_SEL_T.indexOf(type) >= 0 && !!r.dougong);
      body += sel('逐层铺作档', 'dgList.' + i, DG_LIST, r.dgList[i] || 0, perFloor);
      body += tog('栱眼壁', 'dgEye', !!r.dgEye, BLD_SEL_T.indexOf(type) >= 0 && !!r.dougong);
      body += tog('雀替', 'queti', !!r.queti, BLD_SEL_T.indexOf(type) >= 0);
      body += sel('墙面材质', 'wallMat', WALL_MATS, r.wallMat || 'plaster', BLD_WALLED.indexOf(type) >= 0);
      body += sel('立柱材质', 'colMat', COL_MATS, r.colMat || 'timber');
      body += sel('格心样式', 'winPattern', WINS, r.winPattern || 'step', BLD_WALLED.indexOf(type) >= 0);
      body += rng('窗宽', 'winW', 0.6, 2.4, 0.05, r.winW == null ? 1.2 : r.winW, 'm', BLD_WALLED.indexOf(type) >= 0);
      body += rng('窗高', 'winH', 0.7, 2.6, 0.05, r.winH == null ? 1.4 : r.winH, 'm', BLD_WALLED.indexOf(type) >= 0);
      body += sel('门式', 'doorStyle', [{ v: 'leaf', t: '隔扇门' }, { v: 'panel', t: '板门' }], r.doorStyle || 'leaf', BLD_WALLED.indexOf(type) >= 0);
      body += rng('门宽', 'doorW', 1.0, 3.0, 0.05, r.doorW == null ? 1.8 : r.doorW, 'm', BLD_WALLED.indexOf(type) >= 0);
      body += rng('门高', 'doorH', 1.8, 3.6, 0.05, r.doorH == null ? 2.6 : r.doorH, 'm', BLD_WALLED.indexOf(type) >= 0);
      body += tog('匾额', 'plaque', !!r.plaque, BLD_PLAQUED.indexOf(type) >= 0);
      body += tog('楹联', 'couplet', !!r.couplet, ['hall', 'house'].indexOf(type) >= 0);
      body += tog('门簪', 'menZan', !!r.menZan, ['hall', 'house'].indexOf(type) >= 0);
      body += tog('抱鼓石', 'baogu', !!r.baogu, ['hall', 'house'].indexOf(type) >= 0);
      body += sel('天花 / 藻井', 'ceiling', CEILINGS, r.ceiling || 'none', ['hall', 'house', 'ge'].indexOf(type) >= 0 && !!(r.cut && r.cut.roof));
      body += tog('层间平座', 'pingzuo', !!r.pingzuo, type === 'ge' || type === 'pagoda');
      body += sel('平座栏杆', 'pingzuoStyle', [{ v: 'wood', t: '木栏杆' }, { v: 'marble', t: '石栏' }], r.pingzuoStyle || 'wood', (type === 'ge' || type === 'pagoda') && !!r.pingzuo);
      body += tog('副阶周匝', 'fujie', !!r.fujie, type === 'pagoda' || type === 'hall' || type === 'house');
      body += rng('副阶出挑', 'fujieR', 0.8, 3.0, 0.1, r.fujieR == null ? 1.6 : r.fujieR, 'm', (type === 'pagoda' || type === 'hall' || type === 'house') && !!r.fujie);
      body += tog('灯笼', 'lanterns', !!r.lanterns, ['hall', 'house', 'tai', 'pavilion'].indexOf(type) >= 0);
      body += tog('石狮', 'lions', !!r.lions, ['hall', 'house'].indexOf(type) >= 0);
      body += tog('香炉', 'censer', !!r.censer, ['hall', 'house', 'tai'].indexOf(type) >= 0);
      body += tog('马头墙', 'horseWall', !!r.horseWall, type === 'house');
      body += tog('抱厦', 'baoxia', !!r.baoxia, type === 'ge');
      body += tog('城关城台', 'terraceGate', !!r.terraceGate, type === 'ge');
      body += tog('彩楼欢门', 'huamen', !!r.huamen, type === 'ge');
    }
    panel.innerHTML = '<div class="cp-head"><b>' + label + '</b><span class="cp-tip">线框即选中段 · 拖标题可移面板</span>'
      + '<button class="cp-btn" id="bpHide">收起</button></div>' + body;
    makeDraggable(panel);
    const hide = $('#bpHide');
    if (hide) hide.addEventListener('click', () => { state.selPart = null; paintBldBar(); paintBldPanel(); draw(); });

    panel.querySelectorAll('[data-path]').forEach((el) => {
      const path = el.dataset.path;
      const kind = el.dataset.kind;
      if (kind === 'rng') {
        el.addEventListener('input', () => {
          const v = +el.value;
          bldSetPath(path, v);
          const b = el.parentNode.querySelector('b');
          if (b) b.textContent = v.toFixed(2) + (b.textContent.indexOf('m') >= 0 ? 'm' : '');
          setStat('调整 ' + (el.dataset.lab || '') + ' = ' + v.toFixed(2));
          scheduleBld();
        });
      } else if (kind === 'sel') {
        el.addEventListener('change', () => {
          let v = el.value;
          if (/^-?\d+$/.test(v)) v = +v;
          bldSetPath(path, v);
          rebuild();
        });
      } else {
        el.addEventListener('change', () => { bldSetPath(path, el.checked); rebuild(); });
      }
    });
  }
  /* ------------------------------ 路径读写 ------------------------------ */
  function getPath(obj, path) {
    return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
  }
  function setPath(obj, path, val) {
    const parts = path.split('.');
    let o = obj;
    for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
    o[parts[parts.length - 1]] = val;
  }

  /* ------------------------------ 控件定义 ------------------------------ */
  const TYPES = [
    { v: 'hall', t: '殿 / 堂' },
    { v: 'house', t: '民居' },
    { v: 'courtyard', t: '院落（宅院 / 园林 / 寺院）' },
    { v: 'pavilion', t: '亭' },
    { v: 'round', t: '圆殿 / 圆楼（圆形平面）' },
    { v: 'xie', t: '水榭' },
    { v: 'fang', t: '画舫' },
    { v: 'ge', t: '楼阁（带平座）' },
    { v: 'pagoda', t: '塔' },
    { v: 'archway', t: '牌坊' },
    { v: 'gate', t: '城门楼' },
    { v: 'que', t: '阙' },
    { v: 'corridor', t: '长廊' },
    { v: 'tai', t: '露台' },
    { v: 'bridge', t: '廊桥' },
  ];

  const WALL_MATS = [
    { v: 'plaster', t: '白粉墙' }, { v: 'brick', t: '青砖墙' },
    { v: 'zhu', t: '朱红墙' }, { v: 'wood', t: '木板壁' }, { v: 'stone', t: '石墙' }
  ];
  const COL_MATS = [
    { v: 'timber', t: '朱漆柱' }, { v: 'wood', t: '素木柱' }, { v: 'stone', t: '石柱' }
  ];
  const TILE_COLORS = [
    { v: 'grey', t: '青瓦' }, { v: 'clay', t: '陶瓦' }, { v: 'yellow', t: '黄琉璃' },
    { v: 'celadon', t: '绿琉璃' }, { v: 'blue', t: '孔雀蓝琉璃' }
  ];
  const ROOF_TYPES = [
    { v: 'gable', t: '悬山 / 硬山' }, { v: 'gableHip', t: '歇山' },
    { v: 'hip', t: '庑殿' }, { v: 'pyramid', t: '攒尖' },
    { v: 'roll', t: '卷棚（元宝脊）' }, { v: 'cross', t: '十字歇山' },
    { v: 'lu', t: '盝顶' }
  ];
  const WINS = [
    { v: 'step', t: '步步锦' }, { v: 'straight', t: '直棂' },
    { v: 'ice', t: '冰裂纹' }, { v: 'lantern', t: '灯笼框' }, { v: 'wanzi', t: '万字纹' },
    { v: 'haitang', t: '海棠纹' }, { v: 'liujiao', t: '六角龟背锦' }
  ];
  const GROUNDS = [
    { v: 'stone', t: '石板地' }, { v: 'brick', t: '砖地' },
    { v: 'soil', t: '夯土' }, { v: 'grass', t: '草地' }, { v: 'marble', t: '汉白玉' }
  ];
  // 场地类型：不等于一定是“陆地”，可以整片湖面、湖畔、两岸水道
  const SCENES = [
    { v: 'plain', t: '平地（铺装）' }, { v: 'lake', t: '整片湖面' },
    { v: 'shore', t: '湖畔（单岸）' }, { v: 'banks', t: '两岸（水道）' }
  ];
  const SHADOW_DIRS = [
    { v: 0, t: '东' }, { v: 45, t: '东南' }, { v: 90, t: '南' },
    { v: 135, t: '西南' }, { v: 180, t: '西' }, { v: 225, t: '西北' },
    { v: 270, t: '北' }, { v: 315, t: '东北' }
  ];
  const TREES = [
    { v: 'pine', t: '松' }, { v: 'plum', t: '梅' }, { v: 'bamboo', t: '竹' },
    { v: 'willow', t: '柳' }, { v: 'gingko', t: '银杏' }, { v: 'leaf', t: '阔叶' },
    { v: 'banana', t: '芭蕉' }, { v: 'maple', t: '红枫' }
  ];
  const PALETTES = [
    { v: 'qingya', t: '清雅·白日' }, { v: 'dusk', t: '暮色·黄昏' },
    { v: 'night', t: '夜色·灯影' }, { v: 'snow', t: '雪霁·素裹' },
    { v: 'moxi', t: '水墨·宣纸' }, { v: 'zheshi', t: '赭石·双套印' },
    { v: 'qinglv', t: '青绿·绢本' }
  ];
  const PEDESTALS = [
    { v: 'xumizuo', t: '须弥座' }, { v: 'plain', t: '直台基（阶条石）' }, { v: 'stone', t: '毛石台' }
  ];
  // 朝代做法见 README「形制依据」：普拍枋自唐初已见，但唐辽大木多省用；宋辽扁宽成 T 字；
  // 金元渐厚；明清反狭于阑额。斗栱尺度与补间密度同步变。
  const ERAS = [
    { v: 'han', t: '汉（无普拍枋，斗栱简拙）' },
    { v: 'tang', t: '唐辽（无普拍枋，铺作硕大）' },
    { v: 'song', t: '宋（普拍枋扁宽成 T 字）' },
    { v: 'jin', t: '金（普拍枋加厚）' },
    { v: 'yuan', t: '元（普拍枋近阑额）' },
    { v: 'ming', t: '明（普拍枋狭于阑额）' },
    { v: 'qing', t: '清（平板枋狭而厚，铺作小而密）' }
  ];
  const RAILS = [
    { v: 'marble', t: '石栏（望柱栏板）' }, { v: 'wood', t: '木寻杖栏杆' }, { v: 'beauty', t: '美人靠（吴王靠）' }
  ];
  const DG_STYLES = [
    { v: 'simple', t: '一斗三升' }, { v: 'mid', t: '五踩斗拱' }, { v: 'full', t: '七踩重拱' }
  ];
  const TRIM_COLORS = [
    { v: '', t: '不剪边' }, { v: 'gold', t: '黄琉璃剪边' }, { v: 'green', t: '绿琉璃剪边' },
    { v: 'blue', t: '孔雀蓝剪边' }, { v: 'grey', t: '青瓦剪边' }
  ];
  const STYLES = [
    { v: 'pixel', t: '像素硬边（原味）' }, { v: 'ink', t: '水墨手绘' },
    { v: 'sketch', t: '枯笔速写' }, { v: 'wash', t: '双色套印' },
    { v: 'gongbi', t: '工笔重彩' }, { v: 'woodcut', t: '木刻版画' },
    { v: 'rubbing', t: '金石拓片' }, { v: 'watercolor', t: '水彩晕染' }
  ];
  const COURT_STYLES = [
    { v: 'siheyuan', t: '四合院 / 宅院' }, { v: 'garden', t: '江南园林（叠山理水）' },
    { v: 'temple', t: '寺院（山门·钟鼓楼·大殿）' },
    { v: 'temple5', t: '寺·五进中轴' }, { v: 'daoguan', t: '道观（中路紧凑）' },
    { v: 'wujin', t: '五进四合院' }, { v: 'langyuan', t: '廊院式祠庙' },
    { v: 'jiafu', t: '贾府（前府后园）' }
  ];
  const FANG_STYLES = [
    { v: 'classic', t: '画舫（舱楼式）' }, { v: 'shifang', t: '石舫 / 旱船（三段）' }
  ];
  const CEILINGS = [
    { v: 'none', t: '无（露明）' }, { v: 'flat', t: '井口天花' }, { v: 'caisson', t: '藻井' }
  ];
  const PROPS = [
    { v: 'stonelamp', t: '石灯' }, { v: 'well', t: '井' }, { v: 'stele', t: '碑' },
    { v: 'bell', t: '钟' }, { v: 'drum', t: '鼓' }, { v: 'penjing', t: '盆景' },
    { v: 'tiema', t: '拴马桩' }, { v: 'qubridge', t: '曲桥' }
  ];

  // 有屋顶的形制 / 有墙有门窗的形制：用于控件的 only 显隐
  const ROOFED = ['hall', 'house', 'courtyard', 'ge', 'xie', 'fang', 'gate', 'que', 'pavilion', 'pagoda', 'archway', 'bridge', 'corridor'];
  const ROOF_ONLY = ['hall', 'house', 'ge', 'xie', 'gate', 'pavilion', 'pagoda'];
  const WALLED = ['hall', 'house', 'ge', 'courtyard', 'gate'];
  const BODY = ['hall', 'house', 'ge'];
  const RAILED = ['hall', 'house', 'ge', 'que', 'tai', 'xie', 'pagoda'];

  const GROUPS = [
    {
      title: '一 · 形制与尺度',
      items: [
        { path: 'type', label: '建筑类型', type: 'select', opts: TYPES },
        { path: 'era', label: '朝代做法', type: 'select', opts: ERAS },
        { path: 'bays', label: '面阔间数', type: 'range', min: 1, max: 7, step: 1, only: ['hall', 'house', 'ge', 'xie'] },
        { path: 'bayW', label: '每间面阔', type: 'range', min: 2.0, max: 4.4, step: 0.1, unit: 'm', only: ['hall', 'house', 'ge', 'xie'] },
        { path: 'depth', label: '进深', type: 'range', min: 3.6, max: 11, step: 0.2, unit: 'm', only: ['hall', 'house', 'ge', 'xie'] },
        { path: 'floors', label: '层数', type: 'range', min: 1, max: 3, step: 1, only: ['hall', 'house', 'ge'] },
        { path: 'radius', label: '亭 / 塔半径', type: 'range', min: 1.4, max: 4.0, step: 0.1, unit: 'm', only: ['pavilion', 'pagoda'] },
        { path: 'sides', label: '亭身面数', type: 'range', min: 4, max: 12, step: 2, only: ['pavilion'] },
        { path: 'tiers', label: '塔层数', type: 'range', min: 3, max: 9, step: 1, only: ['pagoda'] },
        { path: 'courtStyle', label: '院落类型', type: 'select', opts: COURT_STYLES, only: ['courtyard'] },
        { path: 'courtW', label: '院落面宽', type: 'range', min: 14, max: 26, step: 0.5, unit: 'm', only: ['courtyard'] },
        { path: 'courtD', label: '院落进深', type: 'range', min: 14, max: 40, step: 0.5, unit: 'm', only: ['courtyard'] },
        { path: 'jin', label: '院落进数', type: 'range', min: 1, max: 5, step: 1, only: ['courtyard'] },
        { path: 'axisRaise', label: '轴线逐级抬高', type: 'toggle', only: ['courtyard'] },
        { path: 'fangStyle', label: '舫式', type: 'select', opts: FANG_STYLES, only: ['fang'] },
        { path: 'width', label: '城台 / 台面宽', type: 'range', min: 7, max: 18, step: 0.5, unit: 'm', only: ['gate', 'que', 'tai'] },
        { path: 'depth', label: '露台 / 画舫进深', type: 'range', min: 3, max: 12, step: 0.2, unit: 'm', only: ['tai', 'fang'] },
        { path: 'wallH', label: '城台高', type: 'range', min: 3.4, max: 8, step: 0.2, unit: 'm', only: ['gate', 'que'] },
        { path: 'span', label: '跨度 / 长度', type: 'range', min: 7, max: 20, step: 0.5, unit: 'm', only: ['bridge', 'fang', 'corridor'] }
      ]
    },
    {
      title: '二 · 剖切（室内外无缝）',
      items: [
        { path: 'cut.front', label: '隐藏前墙', type: 'toggle', only: WALLED },
        { path: 'cut.back', label: '隐藏后墙', type: 'toggle', only: WALLED },
        { path: 'cut.left', label: '隐藏左墙', type: 'toggle', only: WALLED },
        { path: 'cut.right', label: '隐藏右墙', type: 'toggle', only: WALLED },
        { path: 'cut.roof', label: '隐藏屋面', type: 'toggle', only: ROOFED }
      ]
    },
    {
      title: '三 · 环境与陈设',
      items: [
        { path: 'env.showGround', label: '显示场地', type: 'toggle' },
        { path: 'env.groundType', label: '场地类型', type: 'select', opts: SCENES, dep: { path: 'env.showGround', equals: true } },
        { path: 'env.ground', label: '岸面材质', type: 'select', opts: GROUNDS, dep: { path: 'env.showGround', equals: true } },
        { path: 'env.groundSize', label: '场地半径', type: 'range', min: 4, max: 16, step: 0.5, unit: 'm', dep: { path: 'env.showGround', equals: true } },
        { path: 'env.waterW', label: '水面宽度', type: 'range', min: 3, max: 12, step: 0.5, unit: 'm', dep: { path: 'env.showGround', equals: true } },
        { path: 'env.waterSide', label: '水面在', type: 'select', opts: [{ v: 'front', t: '前方' }, { v: 'back', t: '后方' }, { v: 'left', t: '左侧' }, { v: 'right', t: '右侧' }], dep: { path: 'env.showGround', equals: true } },
        { path: 'pondOn', label: '水池', type: 'toggle' },
      ]
    },
    {
      title: '四 · 绘画风格',
      items: [
        { path: 'render.style', label: '画风', type: 'select', opts: STYLES },
        { path: 'render.styleAmount', label: '风格强度', type: 'range', min: 0, max: 1, step: 0.05, dep: { path: 'render.style', notEquals: 'pixel' } },
        { path: 'render.palette', label: '配色底子', type: 'select', opts: PALETTES }
      ]
    },
    {
      title: '五 · 城制',
      items: [
        { path: 'cityShape', label: '平面形制', type: 'select', opts: [{ v: 'rect', t: '矩形' }, { v: 'trapezoid', t: '梯形（南宽北窄）' }], only: ['city'] },
        { path: 'cityW', label: '城垣面宽', type: 'range', min: 80, max: 420, step: 5, unit: '工具单位', only: ['city'] },
        { path: 'cityD', label: '城垣进深', type: 'range', min: 80, max: 400, step: 5, unit: '工具单位', only: ['city'] },
        { path: 'northW', label: '北墙宽（梯形）', type: 'range', min: 0, max: 300, step: 4, unit: '工具单位', only: ['city'], dep: { path: 'cityShape', equals: 'trapezoid' } },
        { path: 'wallH', label: '城墙高', type: 'range', min: 2.0, max: 7.0, step: 0.2, unit: 'm', only: ['city'] },
        { path: 'wallBaseW', label: '墙底宽', type: 'range', min: 1.0, max: 4.0, step: 0.1, unit: 'm', only: ['city'] },
        { path: 'wallTopW', label: '墙顶宽', type: 'range', min: 0.6, max: 3.0, step: 0.1, unit: 'm', only: ['city'] },
        { path: 'merlon', label: '外侧垛口（雉堞）', type: 'toggle', only: ['city'] },
        { path: 'parapet', label: '内侧女墙', type: 'toggle', only: ['city'] },
        { path: 'gateCount', label: '正门门道数', type: 'select', opts: [{ v: 1, t: '1 门道' }, { v: 3, t: '3 门道' }, { v: 5, t: '5 门道' }], only: ['city'] },
        { path: 'gateW', label: '门道宽', type: 'range', min: 1.5, max: 3.5, step: 0.1, unit: 'm', only: ['city'] },
        { path: 'gateH', label: '门洞高', type: 'range', min: 2.5, max: 4.5, step: 0.1, unit: 'm', only: ['city'] },
        { path: 'gateTower', label: '城门楼', type: 'toggle', only: ['city'] },
        { path: 'gateSide', label: '开门面', type: 'select', opts: [{ v: 'front', t: '仅正门' }, { v: 'two', t: '南北两面' }, { v: 'four', t: '四面' }], only: ['city'] },
        { path: 'bastionN', label: '每面马面数（0 为不设）', type: 'range', min: 0, max: 12, step: 1, only: ['city'] },
        { path: 'bastionProj', label: '马面突出量', type: 'range', min: 0.8, max: 2.5, step: 0.1, unit: 'm', only: ['city'], dep: { path: 'bastionN', notEquals: 0 } },
        { path: 'cornerTower', label: '四角角楼', type: 'toggle', only: ['city'] },
        { path: 'blocksX', label: '坊格·东西列数', type: 'range', min: 1, max: 14, step: 1, only: ['city'] },
        { path: 'blocksZ', label: '坊格·南北行数', type: 'range', min: 1, max: 14, step: 1, only: ['city'] },
        { path: 'streetW', label: '街宽', type: 'range', min: 1.0, max: 4.0, step: 0.2, unit: 'm', only: ['city'] },
        { path: 'blockWallH', label: '坊墙高', type: 'range', min: 0.6, max: 1.8, step: 0.1, unit: 'm', only: ['city'] },
        { path: 'axisHalls', label: '中轴殿数', type: 'range', min: 0, max: 3, step: 1, only: ['city'] },
        { path: 'axisPalace', label: '内廷后宫', type: 'toggle', only: ['city'] },
        { path: 'palaceCorner', label: '宫城方位', type: 'select', opts: [{ v: 'center', t: '居中' }, { v: 'north', t: '北部居中' }, { v: 'corner', t: '偏隅（西北）' }], only: ['city'] },
        { path: 'moatW', label: '护城河宽', type: 'range', min: 0, max: 10, step: 0.2, unit: 'm', only: ['city'] },
        { path: 'moatD', label: '护城河深', type: 'range', min: 0.4, max: 2.0, step: 0.1, unit: 'm', only: ['city'], dep: { path: 'moatW', notEquals: 0 } },
        { path: 'moatBridge', label: '城门石桥', type: 'toggle', only: ['city'], dep: { path: 'moatW', notEquals: 0 } }
      ]
    },
    {
      title: '六 · 渲染与出图',
      items: [
        { path: 'render.ppm', label: '像素 / 米', type: 'range', min: 8, max: 320, step: 4 },
        { path: 'render.pitch', label: '俯视角度', type: 'range', min: 18, max: 55, step: 1, unit: '°' },
        { path: 'render.outline', label: '描边', type: 'toggle' },
        { path: 'render.shadow', label: '投影', type: 'toggle' },
        { path: 'render.sunAz', label: '光照方位', type: 'select', opts: SHADOW_DIRS, dep: { path: 'render.shadow', equals: true } },
        { path: 'render.shadowAngle', label: '阴影长度', type: 'range', min: 0.6, max: 2.4, step: 0.05, dep: { path: 'render.shadow', equals: true } },
        { path: 'render.transparent', label: '透明底', type: 'toggle' }
      ]
    }
  ];

  const registry = [];

  function buildControls() {
    const host = $('#controls');
    host.innerHTML = '';
    GROUPS.forEach((g, gi) => {
      const box = document.createElement('div');
      box.className = 'group' + (gi === GROUPS.length - 1 ? ' collapsed' : '');
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

  function buildRow(it) {
    const row = document.createElement('div');
    row.className = 'row' + (it.type === 'toggle' ? ' toggle-now' : '');
    if (it.only) row.dataset.only = it.only.join(',');
    if (it.dep) row.dataset.dep = JSON.stringify(it.dep);

    if (it.type === 'toggle') {
      row.innerHTML = `<label>${it.label}</label><div class="ctl"><input type="checkbox" /></div>`;
      const cb = row.querySelector('input');
      cb.addEventListener('change', () => { setPath(state.recipe, it.path, cb.checked); onChange(it); });
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
      sel.addEventListener('change', () => { setPath(state.recipe, it.path, sel.value); onChange(it); });
      registry.push({ el: sel, it, kind: 'select' });
      return row;
    }

    if (it.type === 'multi') {
      row.style.display = 'block';
      const lab = document.createElement('div');
      lab.innerHTML = `<label style="flex:none">${it.label}</label>`;
      const box = document.createElement('div');
      box.className = 'toggle-row';
      it.opts.forEach((o) => {
        const l = document.createElement('label');
        const cb = document.createElement('input');
        cb.type = 'checkbox'; cb.value = o.v;
        cb.addEventListener('change', () => {
          let arr = getPath(state.recipe, it.path);
          if (!Array.isArray(arr)) { arr = []; setPath(state.recipe, it.path, arr); }
          if (cb.checked) { if (arr.indexOf(o.v) < 0) arr.push(o.v); }
          else { const i = arr.indexOf(o.v); if (i >= 0) arr.splice(i, 1); }
          onChange(it);
        });
        l.appendChild(cb); l.appendChild(document.createTextNode(o.t));
        box.appendChild(l);
        registry.push({ el: cb, it, kind: 'multi', value: o.v });
      });
      row.appendChild(lab);
      row.appendChild(box);
      return row;
    }

    if (it.type === 'series') {
      row.style.display = 'block';
      row.innerHTML = `<label style="flex:none">${it.label}</label><div class="series-box"></div>`;
      const box = row.querySelector('.series-box');
      const node = {
        el: box, it, kind: 'series',
        render() {
          const r = state.recipe;
          const n = Math.max(it.minCount || 1, Math.min(it.maxCount || 9, Number(getPath(r, it.countPath)) || 1));
          const base = it.baseValue != null ? it.baseValue : (Number(getPath(r, it.basePath || 'floorH')) || 3.2);
          let arr = getPath(r, it.path);
          if (!Array.isArray(arr) || arr.length !== n) {
            const fixed = Array.isArray(arr) ? arr : [];
            const out = [];
            for (let i = 0; i < n; i++) out.push(fixed[i] != null ? fixed[i] : base);
            arr = out; setPath(r, it.path, arr);
          }
          box.innerHTML = '';
          for (let i = 0; i < n; i++) {
            const wrap = document.createElement('span');
            wrap.className = 'series-cell';
            const tag = document.createElement('i');
            tag.textContent = (i + 1) + '';
            const inp = document.createElement('input');
            inp.type = 'number';
            inp.min = it.min; inp.max = it.max; inp.step = it.step;
            inp.value = arr[i];
            inp.addEventListener('change', () => {
              let v = Number(inp.value);
              if (!isFinite(v)) v = base;
              v = Math.max(it.min, Math.min(it.max, v));
              inp.value = v;
              const cur = getPath(state.recipe, it.path);
              if (!Array.isArray(cur)) setPath(state.recipe, it.path, []);
              getPath(state.recipe, it.path)[i] = v;
              onChange(it);
            });
            wrap.appendChild(tag); wrap.appendChild(inp);
            box.appendChild(wrap);
          }
        }
      };
      node.render();
      registry.push(node);
      return row;
    }

    // range
    row.innerHTML = `<label>${it.label}</label>
      <div class="ctl"><input type="range" min="${it.min}" max="${it.max}" step="${it.step}">
      <span class="val"></span></div>`;
    const rg = row.querySelector('input');
    const val = row.querySelector('.val');
    const fmt = (v) => (it.step < 1 ? Number(v).toFixed(2) : Number(v)) + (it.unit || '');
    rg.addEventListener('input', () => {
      setPath(state.recipe, it.path, Number(rg.value));
      // 拖动“层高”＝整体统一层高，清掉逐层自定义值，避免滑块看起来没反应
      if (it.path === 'floorH') state.recipe.floorHList = [];
      val.textContent = fmt(rg.value);
      if (it.path === 'render.ppm' && state.syncDens) state.syncDens(Number(rg.value));
      onChange(it);
    });
    registry.push({ el: rg, it, kind: 'range', valEl: val, fmt });
    return row;
  }

  function syncControls() {
    const r = state.recipe;
    if (typeof r.pondOn !== 'boolean') r.pondOn = !!r.env.pond;
    registry.forEach((b) => {
      const v = getPath(r, b.it.path);
      if (b.kind === 'toggle') b.el.checked = !!v;
      else if (b.kind === 'select') b.el.value = v;
      else if (b.kind === 'range') { b.el.value = v; b.valEl.textContent = b.fmt(v); }
      else if (b.kind === 'multi') b.el.checked = (getPath(r, b.it.path) || []).indexOf(b.value) >= 0;
      else if (b.kind === 'series' && b.render) b.render();
    });
    if (state.syncDens) state.syncDens(r.render.ppm);
    applyVisibility();
  }

  /* 按「建筑类型」与「依赖开关」显隐 / 置灰控件：
     - only：该控件只对列出的类型有效
     - dep：依赖某个开关（或某个 select 的取值），不满足时置灰 */
  function depOK(it, r) {
    const d = it.dep;
    if (!d) return true;
    // 某些形制的该开关有专门语义（如亭的「栏杆样式」直接控制美人靠），不受通用依赖约束
    if (d.ignoreTypes && d.ignoreTypes.indexOf(r.type) >= 0) return true;
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
    const r = state.recipe;
    const seen = new Set();
    registry.forEach((b) => {
      const row = b.el.closest('.row');
      if (!row || seen.has(row)) return;
      seen.add(row);
      let show = true;
      if (b.it.only) show = b.it.only.indexOf(r.type) >= 0;
      const ok = show && depOK(b.it, r);
      row.style.display = show ? '' : 'none';
      row.classList.toggle('dimmed', !ok);
      // 置灰的控件同时禁用，避免“点了没反应”的错觉
      row.querySelectorAll('input, select').forEach((inp) => { inp.disabled = !ok; });
    });
    // 空分组折叠提示
    document.querySelectorAll('.group').forEach((g) => {
      const rows = Array.prototype.slice.call(g.querySelectorAll('.row'));
      const anyVisible = rows.some((x) => x.style.display !== 'none');
      g.classList.toggle('empty', !anyVisible);
    });
  }

  let timer = null;
  function onChange() {
    // 水池开关联动
    if (state.recipe.pondOn && !state.recipe.env.pond) {
      state.recipe.env.pond = { x: 3.6, z: 5.4, w: 2.2, d: 1.5 };
    }
    if (!state.recipe.pondOn) state.recipe.env.pond = null;
    applyVisibility();
    clearTimeout(timer);
    timer = setTimeout(rebuild, 60);
  }

  /* ------------------------------ 渲染 ------------------------------ */
  function renderOpts(extra) {
    const r = state.recipe;
    return Object.assign({
      ppm: r.render.ppm,
      pitch: r.render.pitch,
      yaw: r.render.yaw,
      palette: r.render.palette,
      style: r.render.style,
      styleAmount: r.render.styleAmount,
      outline: r.render.outline,
      shadow: r.render.shadow,
      sunAz: r.render.sunAz,
      shadowAngle: r.render.shadowAngle,
      transparent: r.render.transparent,
      focus: !(r.env.showGround === true),
      seed: r.seed
    }, extra || {});
  }

  // 预览预算：画布在屏幕上就那么大，多出来的像素算出来也看不见（导出永远不传，全精度）
  function previewBudget(zoom) {
    const w = wrap.clientWidth || 1600;
    const h = wrap.clientHeight || 900;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const z = Math.min(2.5, Math.max(1, (zoom == null ? state.zoom : zoom) / 2));
    return w * h * dpr * dpr * z * z;
  }
  function previewOpts(extra) {
    return renderOpts(Object.assign({ preview: true, maxPixels: previewBudget(), gpu: state.gpu, gridMask: !!state.grid }, extra || {}));
  }

  // 导出也走同一套内核：GPU 开着就用硬件光栅（全精度、不降像素），
  // 渲染失败会自动落回 CPU，所以这里只需要把开关透传下去。
  function exportOpts(extra) {
    return renderOpts(Object.assign({ gpu: state.gpu, preview: false }, extra || {}));
  }

  function rebuild(skipBld) {
    const r = state.recipe;
    if (state.playing) stopBuild(true);
    if (state.selItem != null && !envItems()[state.selItem]) state.selItem = null;
    try {
      state.mesh = GF.build(r);
      state.moves = state.mesh.moves || [];
      state.frame = GF.render(state.mesh, previewOpts());
      draw();
      const b = state.mesh.bounds('ground');
      $('#stat').textContent = `出图 ${state.frame.w}×${state.frame.h}px · 三角面 ${state.mesh.triCount.toLocaleString()} · 占地 ${(b.x1 - b.x0).toFixed(1)}×${(b.z1 - b.z0).toFixed(1)}m`;
      paintCompPanel();
      buildBldBar();
      if (!skipBld) paintBldPanel();
    } catch (e) {
      console.error(e);
      $('#stat').textContent = '渲染出错：' + e.message;
    }
  }

  /* --------------------------- 落成演示 --------------------------- */
  // 参考 threejs-architecture-effects 的做法：用一条 0–1 时间线驱动“基础→台基→柱梁→墙面→屋面→脊饰”
  // 自下而上逐层生长；演示时会降低渲染分辨率保证流畅，播完再回到设定精度。
  let buildRaf = 0;
  function stopBuild() {
    if (buildRaf) cancelAnimationFrame(buildRaf);
    buildRaf = 0;
    state.playing = false;
    const b = $('#btnBuild');
    if (b) b.classList.remove('on');
    if (b) b.textContent = '落成演示';
  }

  function playBuild() {
    if (!state.mesh) return;
    if (state.playing) { stopBuild(); rebuild(); return; }
    const b = state.mesh.bounds('ground');
    const y0 = Math.min(b.y0, -0.1), y1 = b.y1;
    const dur = 2800, t0 = performance.now();
    const opts = previewOpts({ ppm: Math.min(state.recipe.render.ppm, 13), pad: 5, clipY: y0, maxPixels: previewBudget() * 0.7 });
    state.playing = true;
    const btn = $('#btnBuild');
    if (btn) { btn.classList.add('on'); btn.textContent = '停止演示'; }
    const step = () => {
      const p = Math.min(1, (performance.now() - t0) / dur);
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; // ease-in-out
      opts.clipY = y0 - 0.4 + (y1 - y0 + 0.9) * e;
      state.frame = GF.render(state.mesh, opts);
      draw();
      if (p < 1) {
        buildRaf = requestAnimationFrame(step);
      } else {
        stopBuild();
        state.frame = GF.render(state.mesh, previewOpts());
        draw();
        const bb = state.mesh.bounds('ground');
        $('#stat').textContent = `出图 ${state.frame.w}×${state.frame.h}px · 三角面 ${state.mesh.triCount.toLocaleString()} · 占地 ${(bb.x1 - bb.x0).toFixed(1)}×${(bb.z1 - bb.z0).toFixed(1)}m`;
      }
    };
    buildRaf = requestAnimationFrame(step);
  }

  function draw() {
    const f = state.frame;
    if (!f) return;
    // GPU 开着但这一帧其实是 CPU 出的（FBO 建不起来、超出纹理上限等）：
    // 连续两次就认定这台机器用不了 GPU，自动切回 CPU 并在状态栏说清楚，别让按钮一直骗人。
    if (state.gpu && f.gpu !== true) {
      state.gpuMiss = (state.gpuMiss || 0) + 1;
      if (state.gpuMiss >= 2) {
        state.gpu = false;
        try { localStorage.setItem('gf.renderMode', 'cpu'); } catch (e) {}
        paintMode();
        setStat('GPU 光栅不可用，已自动切回 CPU（详见控制台 [gpu] 提示）');
      }
    } else if (state.gpu) {
      state.gpuMiss = 0;
    }
    if (canvas.width !== f.w || canvas.height !== f.h) {
      canvas.width = f.w; canvas.height = f.h;
    }
    if (state.grid && f.occl) {
      // CPU 出图带遮挡遮罩：格线画在画面上层，但凡是墙、屋顶、树压住的像素一律抠掉。
      // 结果就是格线铺在地面铺装上、被建筑自然遮住——和 3ds Max 里有地面的栅格一致。
      ctx.putImageData(new ImageData(new Uint8ClampedArray(f.rgba), f.w, f.h), 0, 0);
      if (gridCanvas.width !== f.w || gridCanvas.height !== f.h) {
        gridCanvas.width = f.w; gridCanvas.height = f.h;
      }
      gridCtx.clearRect(0, 0, f.w, f.h);
      drawGrid(gridCtx);
      const gd = gridCtx.getImageData(0, 0, f.w, f.h);
      const gpx = gd.data, occ = f.occl;
      for (let i = 0, n = f.w * f.h; i < n; i++) {
        if (occ[i]) gpx[i * 4 + 3] = 0;
      }
      gridCtx.putImageData(gd, 0, 0);
      ctx.drawImage(gridCanvas, 0, 0);
    } else if (state.grid) {
      // GPU 出图不带遮罩：退一步把栅格垫在画面底下，透明处（地面、空气）透出格线，
      // 不透明像素（墙、屋顶、地面铺装）自己把格线盖住，观感一致。
      ctx.clearRect(0, 0, f.w, f.h);
      drawGrid(ctx);
      if (frameCanvas.width !== f.w || frameCanvas.height !== f.h) {
        frameCanvas.width = f.w; frameCanvas.height = f.h;
      }
      frameCtx.clearRect(0, 0, f.w, f.h);
      frameCtx.putImageData(new ImageData(new Uint8ClampedArray(f.rgba), f.w, f.h), 0, 0);
      ctx.drawImage(frameCanvas, 0, 0);
    } else {
      ctx.putImageData(new ImageData(new Uint8ClampedArray(f.rgba), f.w, f.h), 0, 0);
    }
    paintSelection();
    paintPartSelection();
    state.bbox = contentBBox(f);
    if (state.refit) { state.refit = false; viewAt(state.view || 'all'); } else layout();
  }

  /* ------------------------------ 地面网格 ------------------------------ */
  // 仿 3ds Max / Blender 的正交视图栅格：铺在 y=0 地面上，每格 1 m，
  // 每五格加重一道；X 轴偏红、Z 轴偏蓝。离画面中心越远越淡，边界不生硬。
  // 档距随缩放自动升档（1/2/5/10/25/50 m），任何倍率下格子都有 ~10 px，不会糊成一片。
  const GRID_STEPS = [1, 2, 5, 10, 25, 50, 100];
  function drawGrid(g) {
    const f = state.frame;
    if (!f || !f.map) return;
    const m = f.map;
    // 画布四角反算到地面，得到「这一帧看得到的世界范围」
    const cs = [unproj(0, 0), unproj(f.w, 0), unproj(0, f.h), unproj(f.w, f.h)];
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const q of cs) {
      if (!isFinite(q.x) || !isFinite(q.z)) return;
      x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x);
      z0 = Math.min(z0, q.z); z1 = Math.max(z1, q.z);
    }
    const spanX = x1 - x0, spanZ = z1 - z0;
    x0 -= spanX * 0.04; x1 += spanX * 0.04; z0 -= spanZ * 0.04; z1 += spanZ * 0.04;
    // 一米在屏幕上大约多少像素
    const pxPerM = Math.max(Math.abs(m.right[0]), Math.abs(m.up[2])) * m.ppm || 1;
    let step = GRID_STEPS[GRID_STEPS.length - 1];
    for (const s of GRID_STEPS) { if (s * pxPerM >= 10) { step = s; break; } }
    const cx = f.w / 2, cy = f.h / 2;
    const reach = Math.max(f.w, f.h) * 0.68;
    const fade = (ax, ay, bx, by) => {
      const d = Math.hypot((ax + bx) / 2 - cx, (ay + by) / 2 - cy);
      return GF.clamp(1 - d / reach, 0.05, 1);
    };
    const line = (ax, az, bx, bz, color, width) => {
      const A = projWorld(ax, az), B = projWorld(bx, bz);
      const a = fade(A.fx, A.fy, B.fx, B.fy);
      g.globalAlpha = a;
      g.strokeStyle = color;
      g.lineWidth = width;
      g.beginPath();
      g.moveTo(A.fx, A.fy);
      g.lineTo(B.fx, B.fy);
      g.stroke();
    };
    g.save();
    g.beginPath();
    g.rect(0, 0, f.w, f.h);
    g.clip();
    g.lineCap = 'butt';
    // 细格
    for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) {
      if (Math.abs(x) < step * 0.001) continue;
      const major = Math.abs(Math.round(x / step)) % 5 === 0;
      line(x, z0, x, z1, major ? 'rgba(84,74,58,.5)' : 'rgba(96,86,68,.26)', major ? 1.5 : 1);
    }
    for (let z = Math.ceil(z0 / step) * step; z <= z1; z += step) {
      if (Math.abs(z) < step * 0.001) continue;
      const major = Math.abs(Math.round(z / step)) % 5 === 0;
      line(x0, z, x1, z, major ? 'rgba(84,74,58,.5)' : 'rgba(96,86,68,.26)', major ? 1.5 : 1);
    }
    // 两根基准轴：X 轴（左右）偏红，Z 轴（前后）偏蓝
    line(x0, 0, x1, 0, 'rgba(153,64,52,.9)', 2.2);
    line(0, z0, 0, z1, 'rgba(58,92,146,.9)', 2.2);
    g.globalAlpha = 1;
    g.restore();
  }

  // 图内实际内容（非透明像素）的包围盒，用于取景锚点
  function contentBBox(f) {
    const d = f.rgba;
    let x0 = f.w, x1 = 0, y0 = f.h, y1 = 0;
    for (let y = 0; y < f.h; y++) {
      for (let x = 0; x < f.w; x++) {
        if (d[(y * f.w + x) * 4 + 3] > 8) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
    }
    if (x1 <= x0) return { x0: 0, y0: 0, x1: f.w, y1: f.h };
    return { x0, y0, x1, y1 };
  }

  // 多点位取景：倍率以“整帧刚好铺满舞台”为 1.0 基准，避免宽/高模型互相踩踏
  // 全景 1.0 恒不裁切；院落 1.4 / 屋面 1.7 / 门面 1.9 / 台基 2.1 为特写，超出部分可拖动查看
  const VIEWS = {
    all: { nx: 0.5, ny: 0.5, k: 1 },
    roof: { nx: 0.5, ny: 0.2, k: 1.7 },
    facade: { nx: 0.5, ny: 0.58, k: 1.9 },
    base: { nx: 0.5, ny: 0.84, k: 2.1 },
    court: { nx: 0.5, ny: 0.7, k: 1.4 }
  };

  function viewAt(name) {
    const f = state.frame;
    if (!f) return;
    const v = VIEWS[name] || VIEWS.all;
    state.view = VIEWS[name] ? name : 'all';
    document.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === name));
    const bb = state.bbox || { x0: 0, y0: 0, x1: f.w, y1: f.h };
    const fx = bb.x0 + (bb.x1 - bb.x0) * v.nx;
    const fy = bb.y0 + (bb.y1 - bb.y0) * v.ny;
    const availW = wrap.clientWidth * 0.86;
    const availH = wrap.clientHeight * 0.86;
    // 基准倍率永远按整帧算：任何模型在 1.0 都完整落在舞台内
    const fit = Math.min(availW / f.w, availH / f.h);
    const scale = fit * v.k;
    state.zoom = GF.clamp(2 * scale / fit, 0.5, 8);
    state.panX = -(fx - f.w / 2) * scale;
    state.panY = -(fy - f.h / 2) * scale;
    // 全景：画布小于舞台时把平移夹在留白内，保证整幅画面不被舞台边缘切到
    if (state.view === 'all') {
      const bx = Math.max(0, (wrap.clientWidth - f.w * scale) / 2);
      const by = Math.max(0, (wrap.clientHeight - f.h * scale) / 2);
      state.panX = GF.clamp(state.panX, -bx, bx);
      state.panY = GF.clamp(state.panY, -by, by);
    }
    layout();
  }

  function layout() {
    const f = state.frame;
    if (!f) return;
    // 适配：让画面占舞台 ~86%
    const availW = wrap.clientWidth * 0.86;
    const availH = wrap.clientHeight * 0.86;
    const fit = Math.min(availW / f.w, availH / f.h);
    const scale = fit * (state.zoom / 2);
    // 平移限制：可以移动到画面的任意部位，但不许把画面整块拖出视野
    const overX = Math.max(0, (f.w * scale - wrap.clientWidth) / 2 + wrap.clientWidth * 0.18);
    const overY = Math.max(0, (f.h * scale - wrap.clientHeight) / 2 + wrap.clientHeight * 0.18);
    state.panX = GF.clamp(state.panX, -overX, overX);
    state.panY = GF.clamp(state.panY, -overY, overY);
    canvas.style.width = (f.w * scale) + 'px';
    canvas.style.height = (f.h * scale) + 'px';
    // 绝对居中 + 平移：画面再大也围绕舞台中心缩放，不会只往右下角长
    canvas.style.transform = `translate(calc(-50% + ${state.panX}px), calc(-50% + ${state.panY}px))`;
  }

  /* ------------------------------ 拖动陈设 ------------------------------ */
  // 渲染器返回正交投影映射（ox/oy/ppm + 相机基向量），据此做屏幕拾取与地面反算
  function framePt(clientX, clientY) {
    const f = state.frame, r = canvas.getBoundingClientRect();
    return { fx: (clientX - r.left) * f.w / r.width, fy: (clientY - r.top) * f.h / r.height, rect: r };
  }
  function projWorld(x, z) {
    const f = state.frame, m = f.map;
    const sx = x * m.right[0] + z * m.right[2];
    const sy = x * m.up[0] + z * m.up[2];
    return { fx: sx * m.ppm + m.ox, fy: -sy * m.ppm + m.oy };
  }
  function unproj(fx, fy) {
    const m = state.frame.map;
    const sx = (fx - m.ox) / m.ppm, sy = -(fy - m.oy) / m.ppm;
    const det = m.right[0] * m.up[2] - m.right[2] * m.up[0] || 1;
    return {
      x: (sx * m.up[2] - m.right[2] * sy) / det,
      z: (m.right[0] * sy - m.up[0] * sx) / det
    };
  }
  // 拖动建筑时相机映射会因重排而微调，用开始拖动那一刻的映射反算，抓取点才不跑
  function unprojM(m, fx, fy) {
    const sx = (fx - m.ox) / m.ppm, sy = -(fy - m.oy) / m.ppm;
    const det = m.right[0] * m.up[2] - m.right[2] * m.up[0] || 1;
    return {
      x: (sx * m.up[2] - m.right[2] * sy) / det,
      z: (m.right[0] * sy - m.up[0] * sx) / det
    };
  }
  // 单体拾取：按这一栋的投影轮廓（地面四角 + 檐顶四角围成的凸包）判断，
  // 点房子身上任意处都算点中，不必对准一个看不见的锚点
  function hullHit(px, py, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[i], b = pts[j];
      if (((a.y > py) !== (b.y > py)) && (px < (b.x - a.x) * (py - a.y) / (b.y - a.y) + a.x)) inside = !inside;
    }
    return inside;
  }
  function pickUnitAt(clientX, clientY) {
    const us = bldUnits();
    const f = state.frame;
    if (!us || !f) return null;
    const p = framePt(clientX, clientY);
    const px = p.fx, py = p.fy, ppm = f.map.ppm;
    let best = null, bestA = Infinity;
    us.forEach((u) => {
      const swap = Math.abs(u.rot || 0) % 180 === 90;
      const hw = (swap ? u.D : u.W) / 2 + 0.5, hd = (swap ? u.W : u.D) / 2 + 0.5;
      const corners = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
      const bottom = corners.map(([x, z]) => {
        const q = projWorld(u.x + x, u.z + z);
        return { x: q.fx, y: q.fy };
      });
      const top = corners.map(([x, z]) => {
        const q = projWorld(u.x + x, u.z + z);
        return { x: q.fx, y: q.fy - Math.max(0.8, u.topY || 0) * ppm };
      });
      const poly = bottom.concat(top.slice().reverse());
      if (!hullHit(px, py, poly)) return;
      let area = 0;
      for (let i = 0; i < poly.length; i++) {
        const q = poly[i], w = poly[(i + 1) % poly.length];
        area += q.x * w.y - w.x * q.y;
      }
      area = Math.abs(area) / 2;
      if (area < bestA) { bestA = area; best = u; }
    });
    return best;
  }
  // 单栋建筑的整栋拾取：按整栋包围盒的投影（地面四角 + 顶面四角）判断
  function pickWholeAt(clientX, clientY) {
    const b = state.mesh && state.mesh.bldBox;
    const f = state.frame;
    if (!b || !f) return null;
    const p = framePt(clientX, clientY);
    const ppm = f.map.ppm;
    const corners = [[b.x0, b.z0], [b.x1, b.z0], [b.x1, b.z1], [b.x0, b.z1]];
    const bottom = corners.map(([x, z]) => { const q = projWorld(x, z); return { x: q.fx, y: q.fy }; });
    const top = corners.map(([x, z]) => { const q = projWorld(x, z); return { x: q.fx, y: q.fy - Math.max(0.8, b.y1) * ppm }; });
    const poly = bottom.concat(top.slice().reverse());
    return hullHit(p.fx, p.fy, poly) ? { key: 'bld', label: '建筑本体' } : null;
  }
  function pickMove(clientX, clientY) {
    const f = state.frame;
    if (!f || !state.moves) return null;
    const p = framePt(clientX, clientY);
    const k = p.rect.width / f.w;
    const tol = Math.max(18 * k, 24);
    let best = null, bestD = 1e9;
    for (const mv of state.moves) {
      const q = projWorld(mv.x, mv.z);
      const cy = q.fy - Math.min(2.2, mv.r) * f.map.ppm * 0.85; // 锚点抬到物体中部，好点中
      const d = Math.hypot(q.fx - p.fx, cy - p.fy);
      if (d < tol && d < bestD) { bestD = d; best = mv; }
    }
    return best;
  }
  let dragRaf = 0;
  function dragRender() {
    if (dragRaf) return;
    dragRaf = requestAnimationFrame(() => {
      dragRaf = 0;
      try {
        state.mesh = GF.build(state.recipe);
        state.moves = state.mesh.moves || state.moves;
        const opts = previewOpts({ ppm: Math.min(state.recipe.render.ppm, 14), pad: 5 });
        state.frame = GF.render(state.mesh, opts);
        draw();
      } catch (e) { console.error(e); }
    });
  }

  /* ------------------------------ 交互 ------------------------------ */
  let dragging = null;
  let movingItem = null;
  let dragItem = null;
  let bldDrag = null;
  let bldSel = null;
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('mousedown', (e) => {
    // 建筑模式：点画面里某一栋即选中；按住不放就能把这一栋拖到别处
    if (state.barMode === 'bld' && e.button === 0 && !e.shiftKey && !state.moveMode) {
      const uHit = pickUnitAt(e.clientX, e.clientY);
      const whole = uHit ? null : pickWholeAt(e.clientX, e.clientY);
      const hit = uHit ? { key: 'u:' + uHit.id, label: uHit.label } : (whole || pickMove(e.clientX, e.clientY));
      if (hit && (String(hit.key).slice(0, 2) === 'u:' || hit.key === 'bld')) {
        const isU = String(hit.key).slice(0, 2) === 'u:';
        const id = isU ? String(hit.key).slice(2) : null;
        const found = isU ? (state.mesh.units || []).filter((x) => x.id === id)[0] : null;
        const wasSel = isU ? !!(state.selPart && state.selPart.k === hit.key) : bldSel === 'bld';
        if (isU) { state.selPart = { k: hit.key }; bldSel = null; } else { bldSel = 'bld'; state.selPart = null; }
        state.selItem = null;
        paintCompPanel();
        paintBldBar();
        paintBldPanel();
        draw();
        if (found && found.fixed) {
          setStat('选中单体：' + hit.label + '（院门固定在院墙上，不可拖动）');
          return;
        }
        // 先点选、再按住拖：避免随手点一下就误把房子拖走
        if (!wasSel) {
          setStat('已选中：' + hit.label + '（再按住它即可拖到别处）');
          return;
        }
        const f = state.frame, rect = canvas.getBoundingClientRect();
        const kx = f.w / rect.width, ky = f.h / rect.height;
        const fx0 = (e.clientX - rect.left) * kx, fy0 = (e.clientY - rect.top) * ky;
        const w0 = unprojM(f.map, fx0, fy0);
        if (!state.recipe.units) state.recipe.units = {};
        const u = isU ? (state.recipe.units[id] || (state.recipe.units[id] = {})) : null;
        bldDrag = {
          id, whole: !isU, cx0: e.clientX, cy0: e.clientY, kx, ky, m0: f.map, fx0, fy0,
          w0x: w0.x, w0z: w0.z,
          dx0: isU ? (+u.dx || 0) : (+state.recipe.moveX || 0),
          dz0: isU ? (+u.dz || 0) : (+state.recipe.moveZ || 0)
        };
        canvas.style.cursor = 'grabbing';
        setStat('拖动：' + hit.label + '（松手落位' + (isU ? '，只动这一栋' : '，地面与陈设原地不动') + '）');
        return;
      }
    }
    // 组件条落进来的东西：左键按住就能拖，不用先进“拖动陈设”模式
    if (e.button === 0 && !e.shiftKey && !state.moveMode) {
      const hi = pickItem(e.clientX, e.clientY);
      if (hi >= 0) {
        const it = envItems()[hi];
        state.selItem = hi;
        state.selPart = null;
        paintBldBar();
        paintBldPanel();
        paintCompPanel();
        const p = framePt(e.clientX, e.clientY);
        const w = unproj(p.fx, p.fy);
        dragItem = { i: hi, dx: it.x - w.x, dz: it.z - w.z };
        setStat('拖动：' + compLabel(it.k) + '（松手落位）');
        return;
      }
    }
    if (state.barMode === 'env' && state.moveMode && e.button === 0 && !e.shiftKey) {
      const hit = pickMove(e.clientX, e.clientY);
      if (!hit) return; // 拖动模式下视角锁定：点空处不旋转、不平移
      const p = framePt(e.clientX, e.clientY);
      const w = unproj(p.fx, p.fy);
      movingItem = { key: hit.key, label: hit.label, dx: hit.x - w.x, dz: hit.z - w.z };
      setStat('拖动：' + hit.label + '（松手即落位）');
      return;
    }
    dragging = { x: e.clientX, y: e.clientY, pan: e.button !== 0 || e.shiftKey, yaw: state.recipe.render.yaw };
    canvas.classList.add('dragging');
    document.querySelectorAll('[data-view]').forEach((b) => b.classList.remove('on'));
  });
  window.addEventListener('mousemove', (e) => {
    if (bldDrag) {
      const fx = bldDrag.fx0 + (e.clientX - bldDrag.cx0) * bldDrag.kx;
      const fy = bldDrag.fy0 + (e.clientY - bldDrag.cy0) * bldDrag.ky;
      const w = unprojM(bldDrag.m0, fx, fy);
      const dx = +(bldDrag.dx0 + w.x - bldDrag.w0x).toFixed(2);
      const dz = +(bldDrag.dz0 + w.z - bldDrag.w0z).toFixed(2);
      if (bldDrag.whole) {
        state.recipe.moveX = dx;
        state.recipe.moveZ = dz;
      } else {
        const us = state.recipe.units;
        us[bldDrag.id] = Object.assign({}, us[bldDrag.id], { dx, dz });
      }
      setStat('拖动中：X ' + dx.toFixed(1) + ' m / Z ' + dz.toFixed(1) + ' m');
      dragRender();
      return;
    }
    if (dragItem) {
      const p = framePt(e.clientX, e.clientY);
      const w = unproj(p.fx, p.fy);
      const it = envItems()[dragItem.i];
      if (it) {
        it.x = +(w.x + dragItem.dx).toFixed(2);
        it.z = +(w.z + dragItem.dz).toFixed(2);
      }
      dragRender();
      return;
    }
    if (movingItem) {
      const p = framePt(e.clientX, e.clientY);
      const w = unproj(p.fx, p.fy);
      state.recipe.env.move = state.recipe.env.move || {};
      state.recipe.env.move[movingItem.key] = { x: w.x + movingItem.dx, z: w.z + movingItem.dz };
      state.moves.forEach((m) => { if (m.key === movingItem.key) { m.x = w.x + movingItem.dx; m.z = w.z + movingItem.dz; } });
      dragRender();
      return;
    }
    if (!dragging) return;
    const dx = e.clientX - dragging.x, dy = e.clientY - dragging.y;
    if (dragging.pan) {
      state.panX += dx; state.panY += dy;
      dragging.x = e.clientX; dragging.y = e.clientY;
      layout();
    } else {
      state.recipe.render.yaw = (dragging.yaw + dx * 0.4 + 360) % 360;
      scheduleRender();
    }
  });
  window.addEventListener('mouseup', () => {
    if (bldDrag) {
      const whole = bldDrag.whole;
      bldDrag = null;
      canvas.style.cursor = '';
      rebuild();
      setStat(whole ? '建筑已落位（地面与陈设原地不动）' : '这一栋已落位');
      return;
    }
    if (dragItem) {
      dragItem = null;
      state.frame = GF.render(state.mesh, previewOpts());
      draw();
      paintCompPanel();
      return;
    }
    if (movingItem) {
      movingItem = null;
      state.frame = GF.render(state.mesh, previewOpts());
      draw();
      return;
    }
    if (!dragging) return;
    // 松手吸附到最近的 15°
    state.recipe.render.yaw = Math.round(state.recipe.render.yaw / 15) * 15 % 360;
    dragging = null;
    canvas.classList.remove('dragging');
    scheduleRender(true);
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const old = state.zoom;
    state.zoom = GF.clamp(state.zoom * (e.deltaY > 0 ? 0.9 : 1.1), 0.5, 8);
    // 以光标为锚点缩放
    const rect = canvas.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    const k = state.zoom / old;
    state.panX -= dx * (k - 1);
    state.panY -= dy * (k - 1);
    document.querySelectorAll('[data-view]').forEach((b) => b.classList.remove('on'));
    layout();
  }, { passive: false });
  // 双击画面 = 居中复位
  canvas.addEventListener('dblclick', () => {
    if (state.moveMode) { setStat('拖动模式下视角已锁定'); return; }
    state.panX = state.panY = 0; viewAt('all');
  });

  let raf = 0;
  function scheduleRender(force) {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; rebuild(); });
  }

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
    markChip('siheyuan');

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
})();







