/* Hero: video intro hands off to an interactive particle "A." that reacts to the cursor */
(function () {
  'use strict';

  var video = document.querySelector('.hero-video');
  var frame = document.querySelector('.hero-portrait .frame.circle');
  if (!video || !frame) return;

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  video.playbackRate = 1.4;

  var canvas = document.createElement('canvas');
  canvas.className = 'hero-particles';
  canvas.setAttribute('aria-hidden', 'true');
  frame.appendChild(canvas);
  var ctx = canvas.getContext('2d');

  // Home layout, normalised to the square frame (matches the last frame of the video)
  var GLYPH = { left: 0.235, baseline: 0.75, capHeight: 0.52 };
  var DOT = { x: 0.83, y: 0.74, r: 0.012 };
  var COLORS = ['#f0a0b2', '#e07f9a', '#e9bf86', '#fff6e2', '#b95f78', '#ff6fa3'];
  var WEIGHTS = [0.30, 0.25, 0.25, 0.10, 0.10];
  var GLYPH_COUNT = 5200, DOT_COUNT = 140;

  var n = 0, X, Y, VX, VY, HX, HY, PH, SZ, bounds = [];
  var built = false, running = false, visible = false, handedOff = false, raf = 0;
  var S = 0, dpr = 1;
  var ptr = { x: -9, y: -9, on: false };
  var introGuard = 0;

  function pickBucket() {
    var r = Math.random(), acc = 0;
    for (var i = 0; i < WEIGHTS.length; i++) { acc += WEIGHTS[i]; if (r < acc) return i; }
    return 0;
  }

  function build() {
    var N = 700;
    var off = document.createElement('canvas');
    off.width = off.height = N;
    var c = off.getContext('2d');
    var fs = 500;
    c.font = '600 ' + fs + 'px "Bodoni Moda", Georgia, serif';
    var m = c.measureText('A');
    fs = fs * (GLYPH.capHeight * N) / m.actualBoundingBoxAscent;
    c.font = '600 ' + fs + 'px "Bodoni Moda", Georgia, serif';
    m = c.measureText('A');
    c.fillStyle = '#000';
    c.fillText('A', GLYPH.left * N + m.actualBoundingBoxLeft, GLYPH.baseline * N);

    var data = c.getImageData(0, 0, N, N).data, cand = [];
    for (var y = 0; y < N; y += 2) {
      for (var x = 0; x < N; x += 2) {
        if (data[(y * N + x) * 4 + 3] > 128) cand.push(x, y);
      }
    }
    var total = cand.length / 2;
    for (var i = total - 1; i > 0; i--) {
      var j = (Math.random() * (i + 1)) | 0;
      var tx = cand[i * 2], ty = cand[i * 2 + 1];
      cand[i * 2] = cand[j * 2]; cand[i * 2 + 1] = cand[j * 2 + 1];
      cand[j * 2] = tx; cand[j * 2 + 1] = ty;
    }
    var gcount = Math.min(GLYPH_COUNT, total);

    var buckets = [];
    for (var b = 0; b < COLORS.length; b++) buckets.push([]);
    for (var k = 0; k < gcount; k++) {
      buckets[pickBucket()].push([(cand[k * 2] + Math.random() * 2) / N, (cand[k * 2 + 1] + Math.random() * 2) / N]);
    }
    for (var d = 0; d < DOT_COUNT; d++) {
      var a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * DOT.r;
      buckets[5].push([DOT.x + Math.cos(a) * rr, DOT.y + Math.sin(a) * rr]);
    }

    n = 0;
    for (b = 0; b < buckets.length; b++) n += buckets[b].length;
    X = new Float32Array(n); Y = new Float32Array(n);
    VX = new Float32Array(n); VY = new Float32Array(n);
    HX = new Float32Array(n); HY = new Float32Array(n);
    PH = new Float32Array(n); SZ = new Float32Array(n);
    bounds = [];
    var idx = 0;
    for (b = 0; b < buckets.length; b++) {
      var start = idx;
      for (var q = 0; q < buckets[b].length; q++, idx++) {
        HX[idx] = X[idx] = buckets[b][q][0];
        HY[idx] = Y[idx] = buckets[b][q][1];
        PH[idx] = Math.random() * 6.283;
        SZ[idx] = b === 3 ? 1.1 + Math.random() * 1.3 : 0.9 + Math.random() * 1.2;
      }
      bounds.push([start, idx]);
    }
    built = true;
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    S = frame.clientWidth;
    canvas.width = canvas.height = Math.round(S * dpr);
  }

  var K = 0.032, DAMP = 0.885, R = 0.30, F = 0.045;

  function step(t) {
    var px = ptr.x, py = ptr.y, on = ptr.on, R2 = R * R;
    for (var i = 0; i < n; i++) {
      var hx = HX[i] + Math.sin(t * 0.0016 + PH[i]) * 0.0016;
      var hy = HY[i] + Math.cos(t * 0.0013 + PH[i]) * 0.0016;
      var vx = VX[i] + (hx - X[i]) * K;
      var vy = VY[i] + (hy - Y[i]) * K;
      if (on) {
        var ex = X[i] - px, ey = Y[i] - py, d2 = ex * ex + ey * ey;
        if (d2 < R2) {
          var d = Math.sqrt(d2) || 0.0001, f = (1 - d / R);
          f = f * f * F;
          vx += ex / d * f + (Math.random() - 0.5) * 0.0030;
          vy += ey / d * f + (Math.random() - 0.5) * 0.0030;
        }
      }
      vx *= DAMP; vy *= DAMP;
      VX[i] = vx; VY[i] = vy;
      X[i] += vx; Y[i] += vy;
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    var W = canvas.width;
    for (var b = 0; b < bounds.length; b++) {
      ctx.fillStyle = COLORS[b];
      if (b === 5) { ctx.shadowColor = '#ff6fa3'; ctx.shadowBlur = 14 * dpr; }
      else if (b === 3) { ctx.shadowColor = '#fff3d6'; ctx.shadowBlur = 5 * dpr; }
      else ctx.shadowBlur = 0;
      for (var i = bounds[b][0]; i < bounds[b][1]; i++) {
        var s = SZ[i] * dpr;
        ctx.fillRect(X[i] * W - s / 2, Y[i] * W - s / 2, s, s);
      }
    }
    ctx.shadowBlur = 0;
  }

  function loop(t) {
    if (!running) return;
    step(t);
    draw();
    raf = requestAnimationFrame(loop);
  }
  function startLoop() {
    if (!built || running || !visible) return;
    running = true;
    raf = requestAnimationFrame(loop);
  }
  function stopLoop() { running = false; cancelAnimationFrame(raf); }

  function handoff() {
    if (handedOff) return;
    handedOff = true;
    clearTimeout(introGuard);
    for (var i = 0; i < n; i++) { X[i] = HX[i]; Y[i] = HY[i]; VX[i] = VY[i] = 0; }
    draw();
    canvas.classList.add('on');
    video.classList.add('off');
    startLoop();
  }

  function restartIntro() {
    handedOff = false;
    canvas.classList.remove('on');
    video.classList.remove('off');
    ptr.on = false;
    clearTimeout(introGuard);
    if (reduce) { handoff(); return; }
    video.currentTime = 0;
    var p = video.play();
    if (p && p.catch) p.catch(function () {});
    introGuard = setTimeout(function () {
      if (video.paused && !video.ended) handoff();
    }, 1500);
  }

  function setPointer(e) {
    var r = canvas.getBoundingClientRect();
    ptr.x = (e.clientX - r.left) / r.width;
    ptr.y = (e.clientY - r.top) / r.height;
    ptr.on = true;
  }
  frame.addEventListener('pointermove', setPointer);
  frame.addEventListener('pointerdown', setPointer);
  frame.addEventListener('pointerleave', function () { ptr.on = false; });
  frame.addEventListener('pointercancel', function () { ptr.on = false; });

  video.addEventListener('ended', handoff);
  video.addEventListener('error', handoff);

  if ('ResizeObserver' in window) new ResizeObserver(function () { resize(); if (built && !running) draw(); }).observe(frame);
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stopLoop(); else if (handedOff) startLoop();
  });

  function init() {
    resize();
    build();
    visible = true;
    restartIntro();
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            if (!visible) { visible = true; restartIntro(); }
          } else if (visible) {
            visible = false;
            video.pause();
            stopLoop();
          }
        });
      }, { threshold: 0.4 }).observe(frame);
    }
  }

  var fontReady = (document.fonts && document.fonts.load)
    ? document.fonts.load('600 300px "Bodoni Moda"', 'A')
    : Promise.resolve();
  fontReady.then(init, init);
})();
