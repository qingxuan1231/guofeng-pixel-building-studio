'use strict';
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
    // 多建筑院落：先列每一栋；选中某栋后，再把这一栋拆成台基 / 屋身 / 屋面。
    // 单栋建筑仍走原来的 台基 / 每层 / 屋面。
    const us = bldUnits();
    if (us) {
      const out = us.map((u) => ({ k: 'u:' + u.id, t: u.label || u.id }));
      const m = state.selPart && /^u:([^:]+)(?::(base|body|roof|doors|windows|columns|railing))?$/.exec(state.selPart.k);
      if (m) {
        const u = us.filter((x) => x.id === m[1])[0];
        if (u && u.parts) {
          const names = { base: '台基', body: '屋身', roof: '屋面', doors: '门', windows: '窗', columns: '廊柱', railing: '栏杆' };
          Object.keys(names).forEach((k) => {
            if (u.parts[k]) out.push({ k: 'u:' + u.id + ':' + k, t: names[k] });
          });
        }
      }
      return out;
    }
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
    // 选中某一栋后要临时多出「台基 / 屋身 / 屋面」三张卡；只切换 on 不会把它们加进 DOM
    if (bar.querySelectorAll('.comp-chip[data-k]').length !== bldParts().length) { buildBldBar(); return; }
    const cur = bldCur();
    bar.querySelectorAll('.comp-chip[data-k]').forEach((b) => {
      b.classList.toggle('on', b.dataset.k === cur.k);
    });
  }
  // 选中段的包围盒（世界坐标），用于画线框
  function bldBox(k) {
    const r = state.recipe;
    // 整栋拖动写的是 moveX / moveZ；单栋建筑的段线框必须先把这层位移补上，
    // 否则房子挪走了、台基 / 屋身 / 屋面的框还留在原点。
    const ox = +r.moveX || 0, oz = +r.moveZ || 0;
    const mv = (b) => ({ x0: b.x0 + ox, x1: b.x1 + ox, z0: b.z0 + oz, z1: b.z1 + oz, y0: b.y0, y1: b.y1 });
    if (k === 'bld') {
      const bb = state.mesh && state.mesh.bldBox;
      return bb ? { x0: bb.x0, x1: bb.x1, z0: bb.z0, z1: bb.z1, y0: 0, y1: bb.y1 } : null;
    }
    if (k && k.slice(0, 2) === 'u:') {
      const m = /^u:([^:]+):(base|body|roof|doors|windows|columns|railing)$/.exec(k);
      if (m) {
        const u = (bldUnits() || []).filter((x) => x.id === m[1])[0];
        const pb = u && u.parts && u.parts[m[2]];
        return pb ? { x0: pb.x0, x1: pb.x1, z0: pb.z0, z1: pb.z1, y0: pb.y0, y1: pb.y1 } : null;
      }
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
    if (k === 'base') return mv({ x0: -W / 2, x1: W / 2, z0: -D / 2, z1: D / 2, y0: y0b, y1: y1b });
    let y = y1b;
    for (let i = 0; i < hs.length; i++) {
      const top = y + hs[i];
      if (k === 'f' + i) return mv({ x0: -W / 2, x1: W / 2, z0: -D / 2, z1: D / 2, y0: y, y1: top });
      y = top;
    }
    const slope = r.slope == null ? 0.5 : r.slope;
    const eave = (Array.isArray(r.eaveList) && r.eaveList[hs.length - 1]) || (r.eave == null ? 1.0 : r.eave);
    // 屋面框贴着屋脊收：按举折算出脊高，别再框到半空里
    return mv({ x0: -W / 2 - eave, x1: W / 2 + eave, z0: -D / 2 - eave, z1: D / 2 + eave, y0: y, y1: y + (D / 2 + eave) * slope * 0.92 + 0.5 });
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

    if (/^u:[^:]+:(base|body|roof|doors|windows|columns|railing)$/.test(cur.k)) {
      // —— 某一栋的构件级编辑：台基 / 屋身 / 屋面 / 门 / 窗 / 廊柱 / 栏杆
      const pm = /^u:([^:]+):(base|body|roof|doors|windows|columns|railing)$/.exec(cur.k);
      const id = pm[1], part = pm[2];
      const us = bldUnits() || [];
      const u = us.filter((x) => x.id === id)[0] || { W: 4, D: 3, topY: 4, baseH: 0.3 };
      if (!r.units) r.units = {};
      const ov = r.units[id] || (r.units[id] = {});
      if (!ov.parts) ov.parts = {};
      if (!ov.parts.hide) ov.parts.hide = {};
      const p = 'units.' + id + '.';
      const g = (key, dflt) => (ov[key] != null ? ov[key] : (r[key] != null ? r[key] : dflt));
      const names = { base: '台基', body: '屋身', roof: '屋面', doors: '门', windows: '窗', columns: '廊柱', railing: '栏杆' };
      body += head((u.label || id) + ' · ' + names[part]);
      body += '<div class="cp-row cp-tip2">只改这一栋的' + names[part] + '；同院别的栋不受影响。</div>';
      if (part === 'base') {
        body += rng('台基高', p + 'baseH', 0.1, 1.4, 0.05, g('baseH', u.baseH || 0.3), 'm');
        body += rng('踏跺级数', p + 'steps', 0, 6, 1, g('steps', 2));
        body += sel('台基形制', p + 'pedestal', PED_NAMES, g('pedestal', 'xumizuo'));
        body += tog('台基栏杆', p + 'railing', !!g('railing', false));
        body += sel('栏杆样式', p + 'railStyle', RAILS, g('railStyle', 'wood'), !!g('railing', false));
      } else if (part === 'body') {
        body += rng('开间数', p + 'bays', 1, 7, 1, g('bays', 3));
        body += rng('层数', p + 'floors', 1, 3, 1, g('floors', 1));
        body += rng('层高', p + 'floorH', 2.0, 5.4, 0.05, g('floorH', 3.2), 'm');
        body += sel('墙面材质', p + 'wallMat', WALL_MATS, g('wallMat', 'plaster'));
        body += sel('立柱材质', p + 'colMat', COL_MATS, g('colMat', 'timber'));
        body += tog('前廊', p + 'veranda', !!g('veranda', false));
        body += sel('格心样式', p + 'winPattern', WINS, g('winPattern', 'step'));
        body += rng('窗宽', p + 'winW', 0.6, 2.4, 0.05, g('winW', 1.2), 'm');
        body += rng('窗高', p + 'winH', 0.7, 2.6, 0.05, g('winH', 1.4), 'm');
        body += sel('门式', p + 'doorStyle', [{ v: 'leaf', t: '隔扇门' }, { v: 'panel', t: '板门' }], g('doorStyle', 'leaf'));
        body += rng('门宽', p + 'doorW', 1.0, 3.0, 0.05, g('doorW', 1.8), 'm');
        body += rng('门高', p + 'doorH', 1.8, 3.6, 0.05, g('doorH', 2.6), 'm');
      } else if (part === 'doors') {
        body += sel('门式', p + 'doorStyle', [{ v: 'leaf', t: '隔扇门' }, { v: 'panel', t: '板门' }], g('doorStyle', 'leaf'));
        body += rng('门宽', p + 'doorW', 1.0, 3.0, 0.05, g('doorW', 1.8), 'm');
        body += rng('门高', p + 'doorH', 1.8, 3.6, 0.05, g('doorH', 2.6), 'm');
      } else if (part === 'windows') {
        body += sel('格心样式', p + 'winPattern', WINS, g('winPattern', 'step'));
        body += rng('窗宽', p + 'winW', 0.6, 2.4, 0.05, g('winW', 1.2), 'm');
        body += rng('窗高', p + 'winH', 0.7, 2.6, 0.05, g('winH', 1.4), 'm');
      } else if (part === 'columns') {
        body += sel('立柱材质', p + 'colMat', COL_MATS, g('colMat', 'timber'));
        body += tog('前廊', p + 'veranda', !!g('veranda', false));
      } else if (part === 'railing') {
        body += tog('栏杆', p + 'railing', !!g('railing', true));
        body += sel('栏杆样式', p + 'railStyle', RAILS, g('railStyle', 'wood'), !!g('railing', true));
      } else {
        body += sel('屋顶形制', p + 'roofType', ROOF_TYPES, g('roofType', 'gable'));
        body += sel('瓦色', p + 'tileColor', TILE_COLORS, g('tileColor', 'grey'));
        body += rng('出檐', p + 'eave', 0.3, 2.0, 0.05, g('eave', 1.0), 'm');
        body += rng('举折', p + 'slope', 0.32, 0.8, 0.01, g('slope', 0.5));
        body += rng('起翘', p + 'upturn', 0, 0.7, 0.02, g('upturn', 0.4));
        body += sel('正脊', p + 'ridgeStyle', [{ v: 'none', t: '无' }, { v: 'plain', t: '素脊' }, { v: 'ornate', t: '雕饰脊' }], g('ridgeStyle', 'plain'));
        body += rng('脊兽数', p + 'beasts', 0, 5, 1, g('beasts', 0));
      }
      body += tog('隐藏此构件', p + 'parts.hide.' + part, !!ov.parts.hide[part]);
    } else if (cur.k.slice(0, 2) === 'u:') {
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
