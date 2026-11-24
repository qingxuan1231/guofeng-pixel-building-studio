'use strict';
  /* ------------------------------ 地面网格 ------------------------------ */
  // 世界坐标栅格：铺在 y=0 地面上，世界原点 (0,0,0) 是轴交点，
  // X 轴偏红、Z 轴偏蓝。格距按真实世界跨度分档（1/2/5/10…），不看 ppm 或屏幕像素密度；
  // 透视时和建筑共用同一相机中心与 k 系数。左上角线段比例尺按原点处地面投影标 0–N m。 */
  const GRID_STEPS = [1, 2, 5, 10, 25, 50, 100];
  function drawGrid(g) {
    const f = state.frame;
    if (!f || !f.map) return;
    const m = f.map;
    // 画布四角反算到地面，得到「这一帧看得到的世界范围」
    const cs = [unproj(0, 0), unproj(f.w, 0), unproj(0, f.h), unproj(f.w, f.h)];
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    let cornersOk = true;
    for (const q of cs) {
      if (!isFinite(q.x) || !isFinite(q.z)) { cornersOk = false; continue; }
      x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x);
      z0 = Math.min(z0, q.z); z1 = Math.max(z1, q.z);
    }
    // 透视下屏幕顶角可能落在视平线以上，反算会外扩得很大；这时用场景包围盒兜底
    const bb = state.mesh && state.mesh.bounds ? state.mesh.bounds('ground') : null;
    const sceneSpan = bb && isFinite(bb.x0) ? Math.max(bb.x1 - bb.x0, bb.z1 - bb.z0, 12) : 24;
    const cover = Math.max(sceneSpan * 2.2, 32);
    if (!cornersOk || !isFinite(x1) || (x1 - x0) > sceneSpan * 6 || (z1 - z0) > sceneSpan * 6) {
      x0 = (bb ? Math.min(bb.x0, 0) : -sceneSpan / 2) - cover;
      x1 = (bb ? Math.max(bb.x1, 0) : sceneSpan / 2) + cover;
      z0 = (bb ? Math.min(bb.z0, 0) : -sceneSpan / 2) - cover;
      z1 = (bb ? Math.max(bb.z1, 0) : sceneSpan / 2) + cover;
    } else {
      const ext = 0.04 + 0.25 * (m.persp || 0);
      const spanX = x1 - x0, spanZ = z1 - z0;
      x0 = Math.min(x0 - spanX * ext, (bb ? Math.min(bb.x0, 0) : 0) - cover);
      x1 = Math.max(x1 + spanX * ext, (bb ? Math.max(bb.x1, 0) : 0) + cover);
      z0 = Math.min(z0 - spanZ * ext, (bb ? Math.min(bb.z0, 0) : 0) - cover);
      z1 = Math.max(z1 + spanZ * ext, (bb ? Math.max(bb.z1, 0) : 0) + cover);
    }
    // 网格按真实世界尺寸分档，不看 ppm / 像素密度；镜头拉远才按跨度换成 2m、5m…
    const span = Math.max(x1 - x0, z1 - z0);
    let step = 1;
    for (const s of GRID_STEPS) { if (span / s <= 100) { step = s; break; } }
    const cx = f.w / 2, cy = f.h / 2;
    const reach = Math.max(f.w, f.h) * (0.68 + 0.55 * (m.persp || 0));
    const fade = (ax, ay, bx, by) => {
      const d = Math.hypot((ax + bx) / 2 - cx, (ay + by) / 2 - cy);
      return GF.clamp(1 - d / reach, 0.07, 1);
    };
    const line = (ax, az, bx, bz, color, width, solid) => {
      const A = projWorld(ax, az), B = projWorld(bx, bz);
      const a = solid ? 1 : fade(A.fx, A.fy, B.fx, B.fy);
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
    // 两根基准轴：X 轴（左右）偏红，Z 轴（前后）偏蓝；透视下保持实色，方便认世界原点
    line(x0, 0, x1, 0, 'rgba(153,64,52,.9)', 2.2, true);
    line(0, z0, 0, z1, 'rgba(58,92,146,.9)', 2.2, true);
    const O = projWorld(0, 0);
    if (isFinite(O.fx) && isFinite(O.fy)) {
      g.globalAlpha = 1;
      g.fillStyle = 'rgba(43,39,34,.78)';
      g.beginPath();
      g.arc(O.fx, O.fy, 2.4, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    g.restore();
  }

  // 线段比例尺：用世界原点处 1m 的地面投影换算屏幕长度，不靠 ppm 猜格距
  let scaleBarKey = '';
  function updateScaleBar() {
    const bar = $('#scaleBar');
    if (!bar) return;
    const f = state.frame, rect = canvas.getBoundingClientRect();
    if (!f || !f.map || !rect.width || !f.w) { bar.style.display = 'none'; return; }
    const O = projWorld(0, 0), X = projWorld(1, 0);
    let framePerM = Math.hypot(X.fx - O.fx, X.fy - O.fy);
    if (!isFinite(framePerM) || framePerM < 0.2) framePerM = f.map.ppm || 1;
    const cssPerM = framePerM * (rect.width / f.w);
    const choices = [0.5, 1, 2, 5, 10, 20, 50, 100, 200];
    let len = choices[0], diff = Infinity;
    for (const c of choices) {
      const w = c * cssPerM;
      if (w < 46 || w > 170) continue;
      const d = Math.abs(w - 100);
      if (d < diff) { diff = d; len = c; }
    }
    if (!isFinite(diff)) {
      let near = Infinity;
      for (const c of choices) {
        const d = Math.abs(c * cssPerM - 100);
        if (d < near) { near = d; len = c; }
      }
    }
    const width = Math.max(24, Math.round(len * cssPerM));
    const key = len + ':' + width;
    if (key !== scaleBarKey) {
      scaleBarKey = key;
      const track = $('#sbTrack');
      if (track) track.innerHTML = '<i class="sb-seg dark"></i><i class="sb-seg light"></i><i class="sb-seg dark"></i><i class="sb-seg light"></i>';
      const end = $('#sbLen');
      if (end) end.textContent = (len < 1 ? len.toFixed(1) : len) + ' m';
    }
    const track = $('#sbTrack');
    if (track) track.style.width = width + 'px';
    bar.style.display = '';
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
    // 视口填充后，f 就是舞台本身；v.k=1 对应画布刚好铺满舞台
    const scale = v.k;
    state.zoom = GF.clamp(2 * v.k, 0.5, 8);
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
    // 视口填充：渲染帧按舞台尺寸出图，CSS 直接铺满舞台，只留 zoom 做整体放大
    const scale = state.zoom / 2;
    // 平移限制：即使整幅画面刚好铺满舞台，也留出可以左右/上下挪动的余量
    const overX = Math.max(wrap.clientWidth * 0.3, (f.w * scale - wrap.clientWidth) / 2 + wrap.clientWidth * 0.18);
    const overY = Math.max(wrap.clientHeight * 0.3, (f.h * scale - wrap.clientHeight) / 2 + wrap.clientHeight * 0.18);
    state.panX = GF.clamp(state.panX, -overX, overX);
    state.panY = GF.clamp(state.panY, -overY, overY);
    canvas.style.width = (wrap.clientWidth * scale) + 'px';
    canvas.style.height = (wrap.clientHeight * scale) + 'px';
    // 绝对居中 + 平移：画面再大也围绕舞台中心缩放，不会只往右下角长
    canvas.style.transform = `translate(calc(-50% + ${state.panX}px), calc(-50% + ${state.panY}px))`;
  }
