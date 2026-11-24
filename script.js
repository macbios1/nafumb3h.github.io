(function () {
  var ITEM = 1.2; // height of one strip item in em
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var ease = function (t) { return 1 - Math.pow(1 - t, 3); }; // quick start, long slow settle

  // Numbers: 10 digits roll past before the target.
  // Letters: start on a letter far from the target, roll forward alphabetically (z wraps to a) and land on it.
  function sequenceFor(ch) {
    var out = [], i;
    if (/[0-9]/.test(ch)) {
      var t = +ch;
      for (i = 0; i <= 10; i++) out.push(String((t + i) % 10));
      return out;
    }
    var lower = ch.toLowerCase(), up = ch !== lower;
    var code = lower.charCodeAt(0) - 97;
    var len = 14 + ((code * 7 + 3) % 11);
    for (i = 0; i <= len; i++) out.push(String.fromCharCode(97 + (((code - len + i) % 26) + 26) % 26));
    return out.map(function (c) { return up ? c.toUpperCase() : c; });
  }

  // Build one window (reel) per character of a line
  function build(line) {
    var text = line.dataset.text, list = [];
    line.textContent = "";
    text.split("").forEach(function (ch) {
      if (ch === " ") {
        var g = document.createElement("span"); g.className = "gap"; line.appendChild(g); return;
      }
      var seq = sequenceFor(ch);
      var ghost = document.createElement("span"); ghost.className = "ghost"; ghost.textContent = ch;
      line.appendChild(ghost);
      var w = ghost.getBoundingClientRect().width; ghost.remove();
      var reel = document.createElement("span"); reel.className = "reel"; reel.style.width = w + "px";
      var strip = document.createElement("span"); strip.className = "strip";
      seq.forEach(function (c) {
        var d = document.createElement("span"); d.className = "item"; d.textContent = c; strip.appendChild(d);
      });
      reel.appendChild(strip); line.appendChild(reel);
      var last = seq.length - 1;
      strip.style.transform = reduce ? "translateY(" + (-last * ITEM) + "em)" : "translateY(0)";
      if (reduce) reel.classList.add("on");
      list.push({ reel: reel, strip: strip, last: last });
    });
    return list;
  }

  // Roll one reel; it stays invisible until its own roll begins
  function rollReel(r, delay, dur) {
    return new Promise(function (res) {
      if (reduce) return res();
      var start = null, prev = 0, shown = false, done = false;
      function frame(now) {
        if (start === null) start = now + delay;
        var t = (now - start) / dur;
        if (t < 0) return requestAnimationFrame(frame);
        if (!shown) { shown = true; r.reel.classList.add("on"); }
        if (t > 1) t = 1;
        var p = ease(t) * r.last;
        r.strip.style.transform = "translateY(" + (-p * ITEM) + "em)";
        var v = (p - prev) * 60; prev = p;
        r.strip.style.filter = t < 1 ? "blur(" + Math.min(2, v * 0.07).toFixed(2) + "px)" : "none";
        if (!done && t >= 0.9) { done = true; res(); } // visually settled, so the next step can start
        if (t < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
  }

  // Each reel starts later and runs longer, so they settle one after another, left to right
  function rollLine(list, stagger, base, step) {
    return Promise.all(list.map(function (r, i) { return rollReel(r, i * stagger, base + i * step); }));
  }

  function sparkle() {
    var box = document.getElementById("sparks"); box.textContent = "";
    if (reduce) return Promise.resolve();
    var cols = ["#89cff0", "#ff5c86", "#ffe9b0", "#ffffff", "#b9d4ff"];
    for (var i = 0; i < 26; i++) {
      var s = document.createElement("i"), size = 4 + Math.random() * 9, c = cols[i % cols.length];
      s.style.cssText = "left:" + (Math.random() * 100) + "%;width:" + size + "px;height:" + size + "px;background:" + c +
        ";box-shadow:0 0 " + (size * 2) + "px " + c +
        ";--d:" + (5 + Math.random() * 5) + "s;--t:" + (Math.random() * 2.5) + "s;--x:" + ((Math.random() - 0.5) * 120) + "px";
      box.appendChild(s);
    }
    // Resolves when the first spark has reached the top of the screen
    return new Promise(function (res) {
      var fin = false;
      function go() { if (!fin) { fin = true; res(); } }
      box.addEventListener("animationend", go, { once: true });
      setTimeout(go, 12000);
    });
  }

  // Each line rolls only after the one before it has settled: 24, then Nov, then the name, then the greeting
  var steps = [
    { sel: "#s1 .day", stagger: 400, base: 4000, step: 400 },
    { sel: "#s1 .mon", stagger: 400, base: 3700, step: 400 },
    { sel: "#s2 .line", stagger: 300, base: 3400, step: 350 },
    { sel: "#s3 .line", stagger: 150, base: 2500, step: 120 }
  ].map(function (s) { s.el = document.querySelector(s.sel); return s; });
  var btn = document.getElementById("again");
  var logoBtn = document.getElementById("logo");
  var brandName = document.getElementById("brandName");
  var run = 0;
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, reduce ? 0 : ms); }); };

  function play() {
    var token = ++run;
    btn.classList.remove("show");
    logoBtn.classList.remove("blink");
    brandName.classList.remove("show");
    document.getElementById("sparks").textContent = "";
    steps.forEach(function (s) { s.reels = build(s.el); });
    var chain = wait(300);
    steps.forEach(function (s) {
      chain = chain.then(function () {
        if (token !== run) return;
        return rollLine(s.reels, s.stagger, s.base, s.step).then(function () { return wait(120); });
      });
    });
    chain.then(function () {
      if (token !== run) return;
      btn.classList.add("show");
      // The butterfly blinks three times once the sparks reach the top, then the name fades in
      sparkle().then(function () {
        if (token !== run) return;
        void logoBtn.offsetWidth;
        logoBtn.classList.add("blink");
        setTimeout(function () { if (token === run) brandName.classList.add("show"); }, reduce ? 0 : 5200);
      });
    });
  }

  btn.addEventListener("click", play);

  // Load both fonts before measuring letter widths, otherwise letters shift when the real font arrives
  var fontsReady = document.fonts && document.fonts.load ? Promise.all([
    document.fonts.load('800 1em "Bricolage Grotesque"', "Nafumb3h24Nov"),
    document.fonts.load('italic 400 1em "Fraunces"', "happy birthday")
  ]).catch(function () {}) : Promise.resolve();
  Promise.race([fontsReady, new Promise(function (r) { setTimeout(r, 2500); })])
    .then(function () { return document.fonts && document.fonts.ready; })
    .then(play);

  // ---- Menu, profile modal and photo viewer ----
  var logo = document.getElementById("logo");
  var burger = document.getElementById("burger");
  var menu = document.getElementById("menu");
  var overlay = document.getElementById("overlay");
  var closeBtn = document.getElementById("close");
  var avatar = document.getElementById("avatar");
  var img = document.getElementById("avatarImg");
  var viewer = document.getElementById("viewer");
  var viewerImg = document.getElementById("viewerImg");
  var viewerBg = document.getElementById("viewerBg");
  var viewerClose = document.getElementById("viewerClose");
  var main = document.querySelector("main");

  // Menu (burger)
  function openMenu() {
    menu.classList.add("open"); menu.setAttribute("aria-hidden", "false"); burger.setAttribute("aria-expanded", "true");
  }
  function closeMenu() {
    menu.classList.remove("open"); menu.setAttribute("aria-hidden", "true"); burger.setAttribute("aria-expanded", "false");
  }
  burger.addEventListener("click", function () { menu.classList.contains("open") ? closeMenu() : openMenu(); });
  document.addEventListener("click", function (e) {
    if (menu.classList.contains("open") && !menu.contains(e.target) && !burger.contains(e.target)) closeMenu();
  });
  document.getElementById("mProfile").addEventListener("click", function () { closeMenu(); openModal(); });
  document.getElementById("mReplay").addEventListener("click", function () { closeMenu(); play(); });
  document.getElementById("mCelebrate").addEventListener("click", function () { closeMenu(); sparkle(); });
  document.getElementById("mCalm").addEventListener("click", function () {
    var on = document.body.classList.toggle("calm");
    document.getElementById("calmState").textContent = on ? "On" : "Off";
  });
  document.getElementById("mStars").addEventListener("click", function () {
    var off = document.body.classList.toggle("no-stars");
    document.getElementById("starsState").textContent = off ? "Off" : "On";
  });

  // Profile modal (butterfly)
  function openModal() {
    overlay.classList.add("open"); overlay.setAttribute("aria-hidden", "false");
    main.inert = true;
    setTimeout(function () { closeBtn.focus(); }, 60);
  }
  function closeModal() {
    overlay.classList.remove("open"); overlay.setAttribute("aria-hidden", "true");
    main.inert = false;
    logo.focus();
  }
  logo.addEventListener("click", function () { closeMenu(); openModal(); });
  closeBtn.addEventListener("click", closeModal);
  overlay.addEventListener("click", function (e) { if (e.target === overlay) closeModal(); });

  // Drifting petals inside the profile modal
  var garden = document.getElementById("garden");
  var petalColors = ["#ff3d6e", "#89cff0", "#ffe2a8", "#ff7a9c"];
  for (var k = 0; k < 12; k++) {
    var p = document.createElement("span"); p.className = "petal";
    p.style.cssText = "--l:" + (Math.random() * 92) + "%;--s:" + (12 + Math.random() * 12) + "px;--c:" + petalColors[k % 4] +
      ";--d:" + (7 + Math.random() * 6) + "s;--t:" + (-Math.random() * 10) + "s;--x:" + ((Math.random() - 0.5) * 80) + "px";
    p.innerHTML = '<svg viewBox="-20 -20 40 40" aria-hidden="true"><use href="#flower"/></svg>';
    garden.appendChild(p);
  }

  // Profile picture: save your photo as profile.jpg next to index.html. Without it, the initial "N" shows.
  img.addEventListener("load", function () { avatar.classList.add("has-photo"); });
  img.addEventListener("error", function () { avatar.classList.remove("has-photo"); });
  img.src = "profile.jpg";

  // Photo viewer: the photo is shown large over a dark, blurred copy of itself
  function openViewer() {
    if (!avatar.classList.contains("has-photo")) return;
    var src = img.currentSrc || img.src;
    viewerImg.src = src;
    viewerBg.style.backgroundImage = "url(" + JSON.stringify(src) + ")";
    viewer.classList.add("open"); viewer.setAttribute("aria-hidden", "false");
    setTimeout(function () { viewerClose.focus(); }, 60);
  }
  function closeViewer() {
    viewer.classList.remove("open"); viewer.setAttribute("aria-hidden", "true");
    avatar.focus();
  }
  avatar.addEventListener("click", openViewer);
  viewerClose.addEventListener("click", function (e) { e.stopPropagation(); closeViewer(); });
  viewer.addEventListener("click", closeViewer);

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (viewer.classList.contains("open")) closeViewer();
    else if (overlay.classList.contains("open")) closeModal();
    else if (menu.classList.contains("open")) { closeMenu(); burger.focus(); }
  });
})();
