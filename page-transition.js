(function () {
  if (window.__edinaTransitionInstalled) return;
  window.__edinaTransitionInstalled = true;

  var DOOR_MS = 420;
  var HOLD_MS = 260;
  var WRITE_MS = 320;

  var style = document.createElement('style');
  style.textContent =
    '#edina-transition{position:fixed;inset:0;z-index:99999;pointer-events:none;--et-door-ms:420ms;--et-write-ms:320ms;}' +
    '#edina-transition .et-door{position:absolute;top:0;bottom:0;width:50%;background:#c4a886;transition:transform var(--et-door-ms) cubic-bezier(.77,0,.18,1);}' +
    '#edina-transition .et-door-l{left:0;transform:translateX(0);}' +
    '#edina-transition .et-door-r{right:0;transform:translateX(0);}' +
    '#edina-transition.et-open .et-door-l{transform:translateX(-100%);}' +
    '#edina-transition.et-open .et-door-r{transform:translateX(100%);}' +
    '#edina-transition .et-sig{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) scale(.96);width:min(46vw,340px);opacity:0;clip-path:inset(0 100% 0 0);transition:opacity 250ms ease;filter:drop-shadow(0 0 18px rgba(0,0,0,.3));}' +
    '#edina-transition.et-sig-visible .et-sig{opacity:1;transition:opacity 250ms ease,clip-path var(--et-write-ms) cubic-bezier(.65,0,.35,1);clip-path:inset(0 0 0 0);}';
  document.head.appendChild(style);

  // A velocidade (ms de abertura/fechamento das "portas") é configurável no CRM; os demais
  // tempos (espera, escrita da assinatura) escalam na mesma proporção do padrão de 420ms.
  function applySpeed(ms) {
    if (!ms || isNaN(ms)) return;
    DOOR_MS = ms;
    HOLD_MS = Math.round(ms * 0.619);
    WRITE_MS = Math.round(ms * 0.762);
    overlay.style.setProperty('--et-door-ms', DOOR_MS + 'ms');
    overlay.style.setProperty('--et-write-ms', WRITE_MS + 'ms');
  }

  function build() {
    // Sem assinatura configurada no CRM, nenhum arquivo de exemplo aparece no lugar dela.
    var sigSrc = '';
    var doorColor = '#c4a886';
    var speedMs = 420;
    try {
      if (window.CRMData && window.CRMData.getSiteContent) {
        var sc = window.CRMData.getSiteContent();
        if (sc && sc.signatureUrl) sigSrc = sc.signatureUrl;
        if (sc && sc.transitionDoorColor) doorColor = sc.transitionDoorColor;
        if (sc && sc.transitionSpeedMs) speedMs = parseInt(sc.transitionSpeedMs, 10) || 420;
      }
    } catch (e) {}
    return { sigSrc: sigSrc, doorColor: doorColor, speedMs: speedMs };
  }

  var overlay = document.createElement('div');
  overlay.id = 'edina-transition';
  var conf = build();
  overlay.innerHTML =
    '<div class="et-door et-door-l"></div>' +
    '<div class="et-door et-door-r"></div>' +
    (conf.sigSrc ? '<img class="et-sig" src="' + conf.sigSrc + '" alt="" />' : '');
  document.documentElement.appendChild(overlay);
  overlay.querySelectorAll('.et-door').forEach(function (d) { d.style.background = conf.doorColor; });
  applySpeed(conf.speedMs);

  // As imagens ficam no banco local de mídia; até o preload terminar, photoURL() devolve
  // vazio — então refazemos a leitura quando o cache estiver pronto.
  if (window.CRMData && window.CRMData.warm) {
    // Só a chave da assinatura — nada de carregar o banco de mídia inteiro.
    var sc0 = {};
    try { sc0 = window.CRMData.getSiteContentRaw ? window.CRMData.getSiteContentRaw() : {}; } catch (e) {}
    var ready = (window.CRMData.loadPublished ? window.CRMData.loadPublished() : Promise.resolve());
    ready.then(function () {
      try { sc0 = window.CRMData.getSiteContentRaw ? window.CRMData.getSiteContentRaw() : sc0; } catch (e) {}
      return window.CRMData.warm([sc0.signatureUrl]);
    }).then(function () {
      var c = build();
      var img = overlay.querySelector('.et-sig');
      if (img && c.sigSrc && img.getAttribute('src') !== c.sigSrc) img.setAttribute('src', c.sigSrc);
      overlay.querySelectorAll('.et-door').forEach(function (d) { d.style.background = c.doorColor; });
      applySpeed(c.speedMs);
    });
  }

  function playIntro() {
    overlay.style.visibility = 'visible';
    overlay.style.pointerEvents = 'auto';
    overlay.classList.remove('et-sig-visible');
    // Ler offsetWidth aqui reiniciava a transição, mas obriga o navegador a recalcular o
    // layout na hora — parada de milissegundos bem no momento em que a página abre. Esperar
    // dois quadros tem o mesmo efeito e não interrompe nada.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { overlay.classList.add('et-sig-visible'); });
    });
    setTimeout(function () {
      overlay.classList.add('et-open');
      setTimeout(function () {
        overlay.classList.remove('et-sig-visible');
      }, 150);
      setTimeout(function () {
        overlay.style.pointerEvents = 'none';
        overlay.style.visibility = 'hidden';
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

  var navigating = false;
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a') : null;
    if (!isInternalNav(a)) return;
    var href = a.getAttribute('href');
    e.preventDefault();
    // Um clique só = uma transição. Sem esta trava, um segundo clique (ou um clique que
    // chega por dois caminhos) reiniciava a animação e ela aparecia abrindo e fechando 2x.
    if (navigating) return;
    // Link para a própria página: recarregar faria a animação tocar de novo sem motivo.
    // A checagem vem antes de exibir a cortina — ao contrário, ela ficava presa na frente
    // do conteúdo, e a tela parecia sumir atrás de outra.
    var alvo = new URL(href, location.href);
    var aqui = new URL(location.href);
    // O servidor pode entregar a mesma página com e sem ".html" no endereço; comparar o
    // texto cru faria o link do menu para a página atual parecer um destino diferente.
    var semExt = function (u) { return u.pathname.replace(/(index)?\.(dc\.)?html$/i, '').replace(/\/$/, ''); };
    if (alvo.origin === aqui.origin && semExt(alvo) === semExt(aqui) && alvo.search === aqui.search) {
      if (alvo.hash) location.hash = alvo.hash;
      return;
    }
    overlay.style.visibility = 'visible';
    navigating = true;
    overlay.style.pointerEvents = 'auto';
    overlay.classList.remove('et-open');
    overlay.classList.remove('et-sig-visible');
    void overlay.offsetWidth;
    overlay.classList.add('et-sig-visible');
    // Navega só depois de as portas terminarem de fechar (o tempo é configurável no CRM):
    // com um valor fixo elas eram interrompidas no meio e a página nova redesenhava o
    // fechamento, dando a impressão de abrir e fechar 2x.
    setTimeout(function () {
      window.location.href = href;
    }, DOOR_MS + 40);
    // Se a navegação não acontecer (link bloqueado, download, aba que volta), a cortina
    // não pode ficar na frente do site para sempre.
    setTimeout(function () {
      if (!document.hidden) {
        navigating = false;
        overlay.classList.add('et-open');
        overlay.style.pointerEvents = 'none';
        overlay.style.visibility = 'hidden';
      }
    }, DOOR_MS + 3000);
  }, true);

  // Voltar/avançar pode restaurar a página do cache com as portas fechadas: reabre sem repetir
  // a animação inteira.
  window.addEventListener('pageshow', function (ev) {
    if (!ev.persisted) return;
    navigating = false;
    overlay.classList.remove('et-sig-visible');
    overlay.classList.add('et-open');
    overlay.style.pointerEvents = 'none';
    overlay.style.visibility = 'hidden';
  });

  playIntro();
})();
