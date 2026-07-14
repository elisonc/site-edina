(function () {
  if (window.__edinaTransitionInstalled) return;
  window.__edinaTransitionInstalled = true;

  var DOOR_MS = 420;
  var HOLD_MS = 260;
  var WRITE_MS = 320;

  var style = document.createElement('style');
  style.textContent =
    '#edina-transition{position:fixed;inset:0;z-index:99999;pointer-events:none;}' +
    '#edina-transition .et-door{position:absolute;top:0;bottom:0;width:50%;background:#c4a886;transition:transform ' + DOOR_MS + 'ms cubic-bezier(.77,0,.18,1);}' +
    '#edina-transition .et-door-l{left:0;transform:translateX(0);}' +
    '#edina-transition .et-door-r{right:0;transform:translateX(0);}' +
    '#edina-transition.et-open .et-door-l{transform:translateX(-100%);}' +
    '#edina-transition.et-open .et-door-r{transform:translateX(100%);}' +
    '#edina-transition .et-sig{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) scale(.96);width:min(46vw,340px);opacity:0;clip-path:inset(0 100% 0 0);transition:opacity 250ms ease;filter:drop-shadow(0 0 18px rgba(0,0,0,.3));}' +
    '#edina-transition.et-sig-visible .et-sig{opacity:1;transition:opacity 250ms ease,clip-path ' + WRITE_MS + 'ms cubic-bezier(.65,0,.35,1);clip-path:inset(0 0 0 0);}';
  document.head.appendChild(style);

  var overlay = document.createElement('div');
  overlay.id = 'edina-transition';
  var sigSrc = './assinatura-ink.png';
  var doorColor = '#c4a886';
  try {
    if (window.CRMData && window.CRMData.getSiteContent) {
      var sc = window.CRMData.getSiteContent();
      if (sc && sc.signatureUrl) sigSrc = sc.signatureUrl;
      if (sc && sc.transitionDoorColor) doorColor = sc.transitionDoorColor;
    }
  } catch (e) {}
  overlay.innerHTML =
    '<div class="et-door et-door-l"></div>' +
    '<div class="et-door et-door-r"></div>' +
    '<img class="et-sig" src="' + sigSrc + '" alt="" />';
  document.documentElement.appendChild(overlay);
  overlay.querySelectorAll('.et-door').forEach(function (d) { d.style.background = doorColor; });

  function playIntro() {
    overlay.style.pointerEvents = 'auto';
    overlay.classList.remove('et-sig-visible');
    void overlay.offsetWidth;
    overlay.classList.add('et-sig-visible');
    setTimeout(function () {
      overlay.classList.add('et-open');
      setTimeout(function () {
        overlay.classList.remove('et-sig-visible');
      }, 150);
      setTimeout(function () {
        overlay.style.pointerEvents = 'none';
      }, DOOR_MS);
    }, HOLD_MS);
  }

  function isInternalNav(a) {
    if (!a || !a.getAttribute) return false;
    var href = a.getAttribute('href');
    if (!href) return false;
    if (a.target && a.target !== '' && a.target !== '_self') return false;
    if (/^(#|mailto:|tel:|https?:\/\/|javascript:)/i.test(href)) return false;
    return /\.dc\.html(\?|#|$)/i.test(href) || /\.html(\?|#|$)/i.test(href);
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a') : null;
    if (!isInternalNav(a)) return;
    var href = a.getAttribute('href');
    e.preventDefault();
    overlay.style.pointerEvents = 'auto';
    overlay.classList.remove('et-open');
    overlay.classList.remove('et-sig-visible');
    void overlay.offsetWidth;
    overlay.classList.add('et-sig-visible');
    setTimeout(function () {
      window.location.href = href;
    }, 260);
  }, true);

  playIntro();
})();
