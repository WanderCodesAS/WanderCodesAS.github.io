// Baseline: modern evergreen browsers. This file already requires IntersectionObserver,
// Intl.NumberFormat, el.dataset and performance.now, and the stylesheet requires
// color-mix() for its full palette, so ES5 NodeList defences would be theatre. There is
// no package.json left to record a browserslist, so the floor is recorded here.
(function () {
  var sections = Array.from(document.querySelectorAll('[data-scene]'));
  // Index scenes by the name each section asks for, not by DOM position. The attribute is
  // the contract; honouring it means reordering or inserting a chapter can no longer
  // silently desynchronise the two lists. Names rather than indices because there are ten
  // scenes now and four of them sit mid-document — a number nobody can verify by eye.
  var byName = {};
  Array.from(document.querySelectorAll('.scene')).forEach(function (sc) {
    byName[sc.dataset.name] = sc;
  });
  var scenes = sections.map(function (s) { return byName[s.dataset.scene]; });
  var layers = scenes.map(function (sc) {
    return sc ? Array.from(sc.querySelectorAll('.layer')) : [];
  });
  var yearEl = document.getElementById('year');
  var progressEl = document.getElementById('progress');
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var current = -1, ticking = false;

  // Bail rather than throw: update() runs eagerly below, so a renamed id would otherwise
  // take the year marker, progress bar, cross-fade and parallax down together at load.
  if (!sections.length || !yearEl || !progressEl) return;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function update() {
    ticking = false;
    var vh = window.innerHeight, mid = vh / 2, active = 0;
    var rects = sections.map(function (s) { return s.getBoundingClientRect(); });
    rects.forEach(function (r, i) { if (r.top <= mid) active = i; });

    rects.forEach(function (r, i) {
      if (Math.abs(i - active) > 1) return;
      var p = clamp(((r.top + r.height / 2) - mid) / (r.height / 2 + mid), -1, 1);
      if (!calm) layers[i].forEach(function (l) {
        l.style.transform = 'translate3d(0,' + (p * Number(l.dataset.depth)).toFixed(1) + 'px,0)';
      });
    });

    var activeRect = rects[active], activeSection = sections[active], activeScene = scenes[active];
    if (!activeScene) return;
    var prog = clamp((mid - activeRect.top) / activeRect.height, 0, 1);
    activeScene.style.setProperty('--draw', clamp((prog - 0.08) / 0.5, 0, 1).toFixed(3));
    if (activeSection.dataset.y0) {
      var y0 = Number(activeSection.dataset.y0);
      // "now" keeps an open-ended range honest: hardcoding the current year turns into a
      // visible contradiction next to copy that reads "2018-now" on 1 January.
      var y1 = activeSection.dataset.y1 === 'now'
        ? new Date().getFullYear()
        : Number(activeSection.dataset.y1);
      yearEl.textContent = Math.round(y0 + (y1 - y0) * clamp(prog / 0.7, 0, 1));
    } else {
      yearEl.textContent = activeSection.dataset.label;
    }

    if (active !== current) {
      current = active;
      scenes.forEach(function (sc, i) { if (sc) sc.classList.toggle('is-active', i === active); });
      // Read from the section, not the scene: the chapter decides whether the page is at
      // night, and .scene[data-night] only ever reached the artwork.
      document.body.dataset.night = activeSection.hasAttribute('data-night') ? 'true' : 'false';
    }
    var max = document.documentElement.scrollHeight - vh;
    progressEl.style.transform = 'scaleX(' + (max > 0 ? clamp(window.scrollY / max, 0, 1) : 0) + ')';
  }

  function request() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request);
  update();
  // The first pass measures against fallback font metrics; font-display: swap changes
  // section heights afterwards, leaving active/progress stale until the first scroll.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(request);
  window.addEventListener('load', request);

  // Count-up figures, once each
  if (!calm && 'IntersectionObserver' in window) {
    var figs = Array.from(document.querySelectorAll('.fig[data-to]'));
    // The markup carries each final value as static text, so measuring it now reserves
    // exactly the right width. Without this the box shrinks to "$0" on the first write
    // and the sibling label reflows every frame.
    figs.forEach(function (el) { el.style.minWidth = el.getBoundingClientRect().width + 'px'; });
    var pending = figs.length;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        var el = e.target, to = Number(el.dataset.to), dec = Number(el.dataset.decimals || 0);
        var fmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
        var pre = el.dataset.prefix || '', suf = el.dataset.suffix || '', t0 = performance.now();
        (function step(now) {
          var t = clamp((now - t0) / 1100, 0, 1), eased = 1 - Math.pow(1 - t, 3);
          el.textContent = pre + fmt.format(to * eased) + suf;
          if (t < 1) requestAnimationFrame(step);
        })(t0);
        // One-shot by design: drop the observer once every figure has fired rather than
        // leaving it alive holding this closure for the life of the page.
        if (--pending === 0) io.disconnect();
      });
    }, { threshold: 0.8 });
    figs.forEach(function (el) { io.observe(el); });
  }
})();
