/* ALVINA ILCHUK — portfolio interactions */
(function () {
  'use strict';

  // Hero load animation
  window.addEventListener('load', function () {
    document.body.classList.add('loaded');
  });
  // fallback if load already fired
  if (document.readyState === 'complete') document.body.classList.add('loaded');

  // Nav background on scroll
  var nav = document.getElementById('nav');
  function onScroll() {
    if (window.scrollY > 40) nav.classList.add('solid');
    else nav.classList.remove('solid');
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Reveal on scroll
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); }
        else { e.target.classList.remove('in'); }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(function (r) { io.observe(r); });
  } else {
    reveals.forEach(function (r) { r.classList.add('in'); });
  }

  // Active nav link via section observer
  var sections = ['work', 'about', 'services', 'contact'];
  var links = {};
  document.querySelectorAll('.menu a').forEach(function (a) {
    var id = a.getAttribute('href').replace('#', '');
    links[id] = a;
  });
  if ('IntersectionObserver' in window) {
    var navIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var id = e.target.id;
        if (e.isIntersecting && links[id]) {
          Object.keys(links).forEach(function (k) { links[k].classList.remove('active'); });
          links[id].classList.add('active');
        }
      });
    }, { threshold: 0.5 });
    sections.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) navIo.observe(el);
    });
  }

  // ---- About: count-up stats + mouse parallax ----
  var statsEl = document.querySelector('.stats');
  var counters = document.querySelectorAll('.cnt');
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (statsEl && counters.length && 'IntersectionObserver' in window && !reduceMotion) {
    var raf = null;
    function runCount() {
      var t0 = null, dur = 1500;
      cancelAnimationFrame(raf);
      function step(ts) {
        if (!t0) t0 = ts;
        var p = Math.min((ts - t0) / dur, 1), e = 1 - Math.pow(1 - p, 3);
        counters.forEach(function (c) { c.textContent = Math.round(c.dataset.to * e); });
        if (p < 1) raf = requestAnimationFrame(step);
      }
      raf = requestAnimationFrame(step);
    }
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) runCount();
        else { cancelAnimationFrame(raf); counters.forEach(function (c) { c.textContent = '0'; }); }
      });
    }, { threshold: 0.6 }).observe(statsEl);
  }

  var aboutEl = document.getElementById('about');
  var photoEl = document.querySelector('.about-photo');
  if (aboutEl && photoEl && !reduceMotion && window.matchMedia('(pointer: fine)').matches) {
    var pending = false, mx = 0, my = 0;
    aboutEl.addEventListener('mousemove', function (e) {
      var r = aboutEl.getBoundingClientRect();
      mx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      my = ((e.clientY - r.top) / r.height - 0.5) * 2;
      if (!pending) {
        pending = true;
        requestAnimationFrame(function () {
          photoEl.style.setProperty('--mx', mx.toFixed(3));
          photoEl.style.setProperty('--my', my.toFixed(3));
          pending = false;
        });
      }
    });
    aboutEl.addEventListener('mouseleave', function () {
      photoEl.style.setProperty('--mx', 0);
      photoEl.style.setProperty('--my', 0);
    });
  }

  // ---- Contact popup ----
  var modal = document.getElementById('contactModal');
  var openBtn = document.getElementById('openContact');
  if (modal && openBtn) {
    var form = document.getElementById('contactForm');
    var note = document.getElementById('cfNote');
    var submitBtn = document.getElementById('cfSubmit');
    var bodyEl = document.getElementById('cmBody');
    var doneEl = document.getElementById('cmDone');
    var lastFocus = null;
    var ENDPOINT = 'https://formsubmit.co/ajax/alyssa9012@gmail.com';

    function openModal() {
      lastFocus = document.activeElement;
      modal.hidden = false;
      document.body.classList.add('modal-open');
      setTimeout(function () { document.getElementById('cfName').focus(); }, 60);
    }
    function closeModal() {
      modal.hidden = true;
      document.body.classList.remove('modal-open');
      if (lastFocus) lastFocus.focus();
    }
    function resetModal() {
      form.reset();
      form.querySelectorAll('.field').forEach(function (f) { f.classList.remove('err'); });
      note.textContent = '';
      bodyEl.hidden = false;
      doneEl.hidden = true;
      submitBtn.disabled = false;
    }

    openBtn.addEventListener('click', function () { resetModal(); openModal(); });
    modal.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modal.hidden) closeModal();
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = new FormData(form);
      if (data.get('_honey')) return;
      var name = (data.get('name') || '').trim();
      var email = (data.get('email') || '').trim();
      var message = (data.get('message') || '').trim();
      var type = data.get('project_type');
      var budget = data.get('budget');

      var bad = false;
      form.querySelectorAll('.field').forEach(function (f) { f.classList.remove('err'); });
      function flag(id) { document.getElementById(id).parentNode.classList.add('err'); bad = true; }
      if (!name) flag('cfName');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) flag('cfEmail');
      if (!message) flag('cfMsg');
      if (bad) { note.textContent = 'Please fill in all fields with a valid email.'; return; }

      note.textContent = '';
      submitBtn.disabled = true;
      submitBtn.firstChild.textContent = 'Sending… ';

      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          name: name, email: email, project_type: type, budget: budget, message: message,
          _subject: 'Website request from ' + name + ' — ' + type,
          _replyto: email, _template: 'table', _captcha: 'false'
        })
      })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (res && (res.success === true || res.success === 'true')) {
            bodyEl.hidden = true;
            doneEl.hidden = false;
          } else { throw new Error('send failed'); }
        })
        .catch(function () {
          note.innerHTML = 'Something went wrong. Please email me directly at <a href="mailto:alyssa9012@gmail.com">alyssa9012@gmail.com</a>.';
        })
        .then(function () {
          submitBtn.disabled = false;
          submitBtn.firstChild.textContent = 'Request a website ';
        });
    });
  }

  // ---- Works slider ----
  var slidesEl = document.getElementById('slides');
  if (slidesEl) {
    var total = slidesEl.children.length;
    var i = 0;
    var prev = document.getElementById('prev');
    var next = document.getElementById('next');
    var cur = document.getElementById('cur');
    var fill = document.getElementById('fill');

    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function render() {
      slidesEl.style.transform = 'translateX(' + (-i * 100) + '%)';
      cur.textContent = pad(i + 1);
      fill.style.width = ((i + 1) / total * 100) + '%';
      prev.disabled = (i === 0);
      next.disabled = (i === total - 1);
    }
    prev.addEventListener('click', function () { if (i > 0) { i--; render(); } });
    next.addEventListener('click', function () { if (i < total - 1) { i++; render(); } });

    // keyboard
    document.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft' && i > 0) { i--; render(); }
      if (e.key === 'ArrowRight' && i < total - 1) { i++; render(); }
    });

    // touch swipe
    var x0 = null;
    slidesEl.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    slidesEl.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (dx < -50 && i < total - 1) { i++; render(); }
      if (dx > 50 && i > 0) { i--; render(); }
      x0 = null;
    }, { passive: true });

    render();
  }
})();
