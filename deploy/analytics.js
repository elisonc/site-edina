// Registra uma visualização de página real (home ou imóvel) para os números do Dashboard —
// quantidade de acessos, imóveis mais vistos, horários de pico, de onde vem o tráfego.
// Nenhum dado do visitante é guardado, só o quê/quando/de-onde.
(function () {
  if (window.__edinaAnalyticsInstalled) return;
  window.__edinaAnalyticsInstalled = true;

  function source() {
    const p = new URLSearchParams(location.search);
    if (p.get('utm_source')) return p.get('utm_source');
    const ref = document.referrer;
    if (!ref) return 'direto';
    if (/facebook|instagram|fb\.com/i.test(ref)) return 'Facebook/Instagram';
    if (/google/i.test(ref)) return 'Google';
    if (/whatsapp/i.test(ref)) return 'WhatsApp';
    try { return new URL(ref).hostname.replace('www.', ''); } catch (e) { return 'direto'; }
  }

  function log() {
    if (!window.CRMData || !window.CRMData.logPageview) { setTimeout(log, 200); return; }
    const params = new URLSearchParams(location.search);
    const propertyId = params.get('id') ? parseInt(params.get('id'), 10) : null;
    window.CRMData.logPageview({ propertyId, path: location.pathname.split('/').pop() || 'index', source: source() });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', log); else log();
})();
