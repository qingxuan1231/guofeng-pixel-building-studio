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
        rememberViewFrame();
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
    updateScaleBar();
  }
