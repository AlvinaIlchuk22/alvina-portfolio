/* Hero: a levitating sphere of particles that gathers into a ringed "AI." monogram on hover */
(function () {
  'use strict';

  var frame = document.querySelector('.hero-portrait .frame.circle');
  if (!frame) return;

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia && window.matchMedia('(pointer: fine)').matches;

  var canvas = document.createElement('canvas');
  canvas.className = 'hero-particles';
  canvas.setAttribute('aria-hidden', 'true');
  frame.appendChild(canvas);
  var ctx = canvas.getContext('2d');

  // Bodoni Moda outlines (font units, y up)
  var GLYPHS = {
    A: { d: 'M416 446V518H1074V446ZM906 1528 1410 72H1578V0H880V72H1052L697 1166L315 72H499V0H57V72H232L748 1528Z', x0: 57, x1: 1578 },
    I: { d: 'M57 0V72H278V1428H57V1500H828V1428H588V72H828V0Z', x0: 57, x1: 828 }
  };

  var COLORS = ['#2a1c22', '#c97b92', '#e293ab', '#ffffff', '#d9a86c', '#ff5f98'];
  var WEIGHTS = [0.30, 0.32, 0.16, 0.10, 0.12];

  var RING = { r: 0.385, count: 2600 };
  var LETTER_H = 0.27, LETTER_GAP = 0.045, BASE_Y = 0.635;
  var LETTER_COUNT = 7000, DOT_COUNT = 110;
  var SPHERE_R = 0.335;

  var n = 0, X, Y, VX, VY, TX, TY, PH, SZ, KK, DLY, SX, SY, SZZ, DEP, bounds = [];
  var built = false, running = false, visible = true, raf = 0;
  var dpr = 1;
  var hover = false, m = reduce ? 1 : 0, touchTimer = 0;

  function pickBucket() {
    var r = Math.random(), acc = 0;
    for (var i = 0; i < WEIGHTS.length; i++) { acc += WEIGHTS[i]; if (r < acc) return i; }
    return 0;
  }

  function letterTargets() {
    var N = 800, off = document.createElement('canvas');
    off.width = off.height = N;
    var c = off.getContext('2d');
    var sc = (LETTER_H * N) / 1500;
    var wA = (GLYPHS.A.x1 - GLYPHS.A.x0) * sc, wI = (GLYPHS.I.x1 - GLYPHS.I.x0) * sc;
    var gap = LETTER_GAP * N;
    var left = (N - (wA + gap + wI)) / 2;
    var base = BASE_Y * N;
    function put(g, ox) {
      c.setTransform(sc, 0, 0, -sc, ox - g.x0 * sc, base);
      var p = new Path2D(g.d);
      c.fillStyle = c.strokeStyle = '#000';
      c.fill(p);
      c.lineWidth = 3 / sc;
      c.lineJoin = 'round';
      c.stroke(p);
    }
    put(GLYPHS.A, left);
    put(GLYPHS.I, left + wA + gap);
    c.setTransform(1, 0, 0, 1, 0, 0);
    var data = c.getImageData(0, 0, N, N).data, cand = [];
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) if (data[(y * N + x) * 4 + 3] > 128) cand.push(x, y);
    var total = cand.length / 2;
    for (var i = total - 1; i > 0; i--) {
      var j = (Math.random() * (i + 1)) | 0, tx = cand[i * 2], ty = cand[i * 2 + 1];
      cand[i * 2] = cand[j * 2]; cand[i * 2 + 1] = cand[j * 2 + 1]; cand[j * 2] = tx; cand[j * 2 + 1] = ty;
    }
    var out = [], cnt = Math.min(LETTER_COUNT, total);
    for (var k = 0; k < cnt; k++) out.push([(cand[k * 2] + Math.random()) / N, (cand[k * 2 + 1] + Math.random()) / N]);
    return { pts: out, dot: [(left + wA + gap + wI) / N + 0.035, BASE_Y - 0.006] };
  }

  function build() {
    var lt = letterTargets();
    var list = [], i;
    for (i = 0; i < lt.pts.length; i++) list.push({ x: lt.pts[i][0], y: lt.pts[i][1], b: pickBucket() });
    for (i = 0; i < RING.count; i++) {
      var a = (i / RING.count) * Math.PI * 2 + Math.random() * 0.004;
      var rad = RING.r + (Math.random() - 0.5) * 0.009;
      list.push({ x: 0.5 + Math.cos(a) * rad, y: 0.5 + Math.sin(a) * rad, b: pickBucket() });
    }
    for (i = 0; i < DOT_COUNT; i++) {
      var ad = Math.random() * 6.283, rd = Math.sqrt(Math.random()) * 0.013;
      list.push({ x: lt.dot[0] + Math.cos(ad) * rd, y: lt.dot[1] + Math.sin(ad) * rd, b: 5 });
    }
    list.sort(function (p, q) { return p.b - q.b; });
    n = list.length;
    X = new Float32Array(n); Y = new Float32Array(n); VX = new Float32Array(n); VY = new Float32Array(n);
    TX = new Float32Array(n); TY = new Float32Array(n); PH = new Float32Array(n); SZ = new Float32Array(n);
    KK = new Float32Array(n); DLY = new Float32Array(n); DEP = new Float32Array(n);
    SX = new Float32Array(n); SY = new Float32Array(n); SZZ = new Float32Array(n);

    var order = [];
    for (i = 0; i < n; i++) order.push(i);
    for (i = n - 1; i > 0; i--) { var jj = (Math.random() * (i + 1)) | 0, t = order[i]; order[i] = order[jj]; order[jj] = t; }
    var golden = Math.PI * (3 - Math.sqrt(5)), cur = -1;
    bounds = [];
    for (var p = 0; p < n; p++) {
      var it = list[p];
      TX[p] = it.x; TY[p] = it.y;
      if (it.b !== cur) { if (cur >= 0) bounds[cur][1] = p; bounds[it.b] = [p, n]; cur = it.b; }
      PH[p] = Math.random() * 6.283;
      SZ[p] = it.b === 3 ? 0.9 + Math.random() * 1.0 : 0.7 + Math.random() * 1.0;
      KK[p] = 0.05 + Math.random() * 0.07;
      DLY[p] = Math.random() * 0.55;
      var idx = order[p], yy = 1 - (idx / (n - 1)) * 2, rr = Math.sqrt(Math.max(0, 1 - yy * yy)), th = golden * idx;
      var rad2 = Math.random() < 0.82 ? 1 - Math.random() * 0.06 : Math.cbrt(Math.random());
      SX[p] = Math.cos(th) * rr * rad2; SY[p] = yy * rad2; SZZ[p] = Math.sin(th) * rr * rad2;
      X[p] = 0.5 + SX[p] * SPHERE_R; Y[p] = 0.5 + SY[p] * SPHERE_R;
    }
    built = true;
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var s = frame.clientWidth;
    canvas.width = canvas.height = Math.round(s * dpr);
  }

  function smooth(v) { v = v < 0 ? 0 : v > 1 ? 1 : v; return v * v * (3 - 2 * v); }

  function step(t) {
    var target = hover ? 1 : 0, prev = m;
    m += (target - m) * 0.045;
    if (Math.abs(target - m) < 0.0005) m = target;
    var swirl = Math.abs(m - prev) * 5;
    var ang = t * 0.00038, cA = Math.cos(ang), sA = Math.sin(ang);
    var tilt = 0.38 + Math.sin(t * 0.0004) * 0.07, cT = Math.cos(tilt), sT = Math.sin(tilt);
    var bob = Math.sin(t * 0.0012) * 0.014;
    for (var i = 0; i < n; i++) {
      var x0 = SX[i], y0 = SY[i], z0 = SZZ[i];
      var x1 = x0 * cA + z0 * sA, z1 = -x0 * sA + z0 * cA;
      var y2 = y0 * cT - z1 * sT, z2 = y0 * sT + z1 * cT;
      var f = 1 / (1 - 0.3 * z2);
      var sx = 0.5 + x1 * SPHERE_R * f, sy = 0.5 + y2 * SPHERE_R * f + bob;
      DEP[i] = z2;
      var pm = smooth(m * 1.7 - DLY[i] * 1.2);
      var tx = sx + (TX[i] - sx) * pm + Math.sin(t * 0.002 + PH[i]) * 0.0012;
      var ty = sy + (TY[i] - sy) * pm + Math.cos(t * 0.0017 + PH[i]) * 0.0012;
      var vx = VX[i] + (tx - X[i]) * KK[i];
      var vy = VY[i] + (ty - Y[i]) * KK[i];
      if (swirl > 0.0001) {
        vx += -(Y[i] - 0.5) * swirl * 0.02;
        vy += (X[i] - 0.5) * swirl * 0.02;
      }
      vx *= 0.83; vy *= 0.83;
      VX[i] = vx; VY[i] = vy;
      X[i] += vx; Y[i] += vy;
    }
  }

  function draw(t) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    var W = canvas.width, k = 1 - m;
    for (var b = 0; b < bounds.length; b++) {
      if (!bounds[b]) continue;
      ctx.fillStyle = COLORS[b];
      if (b === 5) { ctx.shadowColor = '#ff5f98'; ctx.shadowBlur = 8 * dpr; } else ctx.shadowBlur = 0;
      for (var i = bounds[b][0]; i < bounds[b][1]; i++) {
        var dep = 0.45 + 0.55 * (DEP[i] + 1) / 2;
        var a = (0.35 + 0.65 * (k * dep + m)) * (0.78 + 0.22 * Math.sin(t * 0.0021 + PH[i]));
        ctx.globalAlpha = b === 5 ? 1 : a;
        var s = SZ[i] * dpr * (k * (0.7 + 0.5 * dep) + m);
        ctx.fillRect(X[i] * W - s / 2, Y[i] * W - s / 2, s, s);
      }
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  function loop(t) {
    if (!running) return;
    step(t);
    draw(t);
    raf = requestAnimationFrame(loop);
  }
  function startLoop() {
    if (!built || running || !visible || reduce) return;
    running = true;
    raf = requestAnimationFrame(loop);
  }
  function stopLoop() { running = false; cancelAnimationFrame(raf); }

  frame.addEventListener('pointerenter', function (e) {
    if (e.pointerType === 'mouse' || e.pointerType === 'pen') hover = true;
  });
  frame.addEventListener('pointerleave', function (e) {
    if (e.pointerType === 'mouse' || e.pointerType === 'pen') hover = false;
  });
  frame.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'touch') {
      hover = true;
      clearTimeout(touchTimer);
      touchTimer = setTimeout(function () { hover = false; }, 3200);
    }
  });

  if ('ResizeObserver' in window) {
    new ResizeObserver(function () {
      resize();
      if (built && !running) { step(0); draw(0); }
    }).observe(frame);
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stopLoop(); else startLoop();
  });

  function init() {
    resize();
    build();
    if (reduce) {
      for (var i = 0; i < n; i++) { X[i] = TX[i]; Y[i] = TY[i]; }
      step(0); draw(0);
    }
    canvas.classList.add('on');
    startLoop();

    // touch screens have no hover: periodically gather the monogram by itself
    if (!finePointer && !reduce) {
      setInterval(function () {
        if (!visible) return;
        hover = true;
        setTimeout(function () { hover = false; }, 3200);
      }, 8500);
    }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { if (!visible) { visible = true; startLoop(); } }
          else if (visible) { visible = false; stopLoop(); }
        });
      }, { threshold: 0.05 }).observe(frame);
    }
  }

  init();
})();
