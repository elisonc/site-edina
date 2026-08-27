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

// ---- Contador de cliques nos botões ----
//
// Um só ouvinte na página inteira, e não um por botão: o navegador já entrega o clique de
// qualquer elemento aqui, então o custo é o mesmo com 5 ou 500 botões. Os cliques são
// somados na memória e enviados de tempos em tempos como UMA gravação com todos os totais
// — não uma por clique. Um dia inteiro de visitas custa poucas gravações.
(function () {
  if (window.__edinaCliquesInstalado) return;
  window.__edinaCliquesInstalado = true;

  var pendentes = {};
  var temPendente = false;
  var INTERVALO = 20000;

  // O nome vem do próprio botão, na ordem: rótulo explícito, texto visível, endereço.
  // Assim um botão novo passa a ser contado sem precisar de cadastro em lugar nenhum.
  function nomeDoAlvo(el) {
    var marcado = el.closest('[data-clique]');
    if (marcado) return marcado.getAttribute('data-clique');

    var alvo = el.closest('a,button');
    if (!alvo) return '';

    var href = alvo.getAttribute('href') || '';
    if (/wa\.me|whatsapp/i.test(href)) return 'WhatsApp';
    if (/^tel:/i.test(href)) return 'Telefone';
    if (/^mailto:/i.test(href)) return 'E-mail';
    if (/google\.com\/maps/i.test(href)) return 'Mapa / Localização';
    if (/^imovel-detalhe/i.test(href)) return 'Card de imóvel';
    if (/instagram\.com|facebook\.com|youtube\.com/i.test(href)) return 'Rede social';

    var txt = (alvo.innerText || alvo.textContent || '').trim().replace(/\s+/g, ' ');
    if (!txt) txt = alvo.getAttribute('aria-label') || alvo.getAttribute('title') || '';
    txt = txt.slice(0, 40).trim();
    // Botão sem nenhum nome não vira uma linha "sem título" no relatório.
    if (!txt || txt.length < 2) return '';
    return txt;
  }

  document.addEventListener('click', function (ev) {
    try {
      var nome = nomeDoAlvo(ev.target);
      if (!nome) return;
      // O ponto separa campos no Firestore: vira outro caractere para o total não se perder
      // dentro de um campo aninhado que ninguém lê.
      nome = nome.replace(/[.\/\[\]*`~]/g, '-');
      pendentes[nome] = (pendentes[nome] || 0) + 1;
      temPendente = true;
    } catch (e) {}
  }, true);

  function enviar() {
    if (!temPendente) return;
    if (!window.FirebaseDB || !window.FirebaseDB.somarCliques) return;
    var lote = pendentes;
    pendentes = {};
    temPendente = false;
    // Falhou o envio? Os cliques voltam para a fila e vão junto da próxima vez.
    window.FirebaseDB.somarCliques(lote).catch(function () {
      Object.keys(lote).forEach(function (k) { pendentes[k] = (pendentes[k] || 0) + lote[k]; });
      temPendente = true;
    });
  }

  setInterval(enviar, INTERVALO);
  // Fechar a aba não pode custar os cliques que ainda não foram enviados.
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') enviar();
  });
  window.addEventListener('pagehide', enviar);
})();
