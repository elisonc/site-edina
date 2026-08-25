// Aplica o favicon escolhido em Conteúdo do Site. Fica no localStorage (não no banco de
// mídia) para aplicar sem depender de carregamento — mas espera o conteúdo publicado
// carregar primeiro, senão o favicon de quem edita não aparece para o visitante.
(function () {
  if (window.__edinaFaviconInstalled) return;
  window.__edinaFaviconInstalled = true;

  function run() {
    let url = '';
    try { url = (window.CRMData && window.CRMData.getFavicon) ? window.CRMData.getFavicon() : ''; } catch (e) {}
    if (!url) return;
    document.querySelectorAll('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')
      .forEach(l => l.remove());
    const type = /^data:(image\/[a-z.+-]+)/i.exec(url);
    [['icon', type ? type[1] : 'image/png'], ['apple-touch-icon', '']].forEach(([rel, t]) => {
      const link = document.createElement('link');
      link.rel = rel;
      if (t) link.type = t;
      link.href = url;
      document.head.appendChild(link);
    });
  }

  function apply() {
    if (window.CRMData && window.CRMData.loadPublished) {
      window.CRMData.loadPublished().then(run);
    } else run();
  }

  apply();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
})();
