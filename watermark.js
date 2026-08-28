(function () {
  if (window.__edinaWatermarkInstalled) return;
  window.__edinaWatermarkInstalled = true;

  function getSite() {
    try { return (window.CRMData && window.CRMData.getSiteContent) ? window.CRMData.getSiteContent() : {}; }
    catch (e) { return {}; }
  }

  function shouldSkip(el, site) {
    if (el.closest('header, footer, nav, #edina-transition')) return true;
    if (el.closest('[data-no-watermark]')) return true;
    if (el.matches('[data-no-watermark]')) return true;
    var labelled = el.closest('[data-screen-label]');
    var label = labelled ? (labelled.getAttribute('data-screen-label') || '') : '';
    if (/blog|post/i.test(label)) {
      if (!site.watermarkBlog) return true;
    }
    var r = el.getBoundingClientRect();
    if (r.height < 110 || r.width < 110) return true;
    return false;
  }

  function makeMark(logo, brand, opacity, tam) {
    var mark;
    var op = (opacity != null && !isNaN(opacity)) ? opacity : 0.32;
    if (logo) {
      mark = document.createElement('img');
      mark.src = logo;
      mark.alt = '';
      mark.setAttribute('aria-hidden', 'true');
      mark.decoding = 'async';
      // Sao sete marcas por pagina e quase todas nascem abaixo da dobra. Sem isto o
      // navegador decodifica as sete no carregamento, cada uma de 680x680, para desenhar
      // quadradinhos de 40px.
      mark.loading = 'lazy';
      // Dimensões declaradas: sem elas o navegador não sabe quanto espaço a marca vai ocupar
      // e reposiciona o conteúdo quando ela carrega — e são sete por página.
      mark.width = 300; mark.height = 300;
      // O tamanho era fixo em 30% da largura da foto. Agora vem do painel, para a marca
      // caber bem tanto numa foto deitada quanto numa em pé. A altura acompanha na mesma
      // proporção, então a marca nunca fica esticada.
      var larg = Math.max(8, Math.min(80, parseInt(tam, 10) || 30));
      mark.style.cssText = 'width:auto;height:auto;max-width:' + larg + '%;max-height:' +
        Math.round(larg * 1.8) + '%;object-fit:contain;opacity:' + op +
        ';filter:drop-shadow(0 1px 5px rgba(0,0,0,.45))';
    } else {
      mark = document.createElement('div');
      mark.textContent = brand;
      mark.style.cssText = "font-family:'Cormorant Garamond',serif;font-size:clamp(15px,3.2vw,30px);letter-spacing:.14em;text-transform:uppercase;color:#fff;opacity:" + Math.min(1, op + 0.1) + ";text-shadow:0 1px 6px rgba(0,0,0,.55);white-space:nowrap";
    }
    var wrap = document.createElement('div');
    wrap.className = 'edina-wm-mark';
    wrap.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;user-select:none;overflow:hidden;z-index:2';
    wrap.appendChild(mark);
    return wrap;
  }

  function apply() {
    var site = getSite();
    if (site.watermarkEnabled === false) {
      document.querySelectorAll('.edina-wm-mark').forEach(function (m) { m.remove(); });
      return;
    }
    var logo = site.watermarkLogoUrl || site.logoUrl || '';
    var brand = site.brandName || 'Edina Oliveira';
    document.querySelectorAll('div, a, section').forEach(function (el) {
      if (el.querySelector(':scope > .edina-wm-mark')) return;
      var bg = el.style && el.style.backgroundImage;
      if (!bg || bg === 'none' || bg.indexOf('url(') === -1) return;
      if (el.querySelector('[style*="background-image"], [style*="background-size:cover"]')) return;
      if (shouldSkip(el, site)) return;
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
      el.appendChild(makeMark(logo, brand, site.watermarkOpacity, site.watermarkSize));
    });
  }

  var scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(function () { scheduled = false; apply(); }, 220);
  }

  new MutationObserver(schedule).observe(document.documentElement, { attributes: true, attributeFilter: ['style'], subtree: true, childList: true });
  document.addEventListener('DOMContentLoaded', schedule);
  if (window.CRMData && window.CRMData.warm) {
    // Só a chave da logo da marca d'água.
    var sc0 = {};
    try { sc0 = window.CRMData.getSiteContentRaw ? window.CRMData.getSiteContentRaw() : {}; } catch (e) {}
    window.CRMData.warm([sc0.watermarkLogoUrl, sc0.logoUrl]).then(function () {
      document.querySelectorAll('.edina-wm-mark').forEach(function (m) { m.remove(); });
      schedule();
    });
  }
  schedule();
})();
