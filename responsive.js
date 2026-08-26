(function () {
  if (window.__edinaResponsiveInstalled) return;
  window.__edinaResponsiveInstalled = true;

  var css = [
    'img,video{max-width:100%}',

    /* ---------- Cabeçalho empilhado ----------
       A marca ocupa 340px e o menu 609px: abaixo de 1080px os dois não cabem lado a lado
       sem apertar. Nessa faixa a marca passa a ocupar a linha inteira, centralizada, com o
       menu centralizado logo abaixo — antes ela ficava encostada à esquerda enquanto o menu
       já aparecia centralizado, e o conjunto parecia torto. */
    '@media (max-width:1080px){',
    '  header{flex-wrap:wrap !important;height:auto !important;row-gap:10px !important;justify-content:center !important}',
    '  header > a:first-child{flex:0 0 100% !important;display:flex !important;justify-content:center !important;text-align:center !important}',
    '  header > a:first-child > *{margin-left:auto !important;margin-right:auto !important}',
    '  header nav{flex:0 0 100% !important;justify-content:center !important}',
    '}',

    /* ---------- Tablet e celular ---------- */
    '@media (max-width:980px){',
    '  [style*="grid-template-columns"]{grid-template-columns:1fr !important}',
    '  section,header,footer{padding-left:22px !important;padding-right:22px !important}',

    /* Cabeçalho: logo em cima, menu numa linha própria, botão inteiro embaixo */
    '  header{flex-wrap:wrap !important;height:auto !important;row-gap:12px !important;padding-top:14px !important;padding-bottom:14px !important}',
    '  header nav{flex-wrap:wrap !important;justify-content:center !important;align-items:center !important;width:100% !important;row-gap:10px !important;column-gap:18px !important}',
    /* Links do menu com 15px de altura eram alvo pequeno demais para o dedo: o recheio
       vertical leva cada um perto dos 44px recomendados, sem mudar o desenho. */
    '  header nav a{white-space:nowrap !important;font-size:12px !important;letter-spacing:.08em !important;display:inline-flex !important;align-items:center !important;min-height:40px !important;padding:0 2px !important}',
    /* O "Agendar Visita" é o último item do menu. Sem margens automáticas: elas consomem o
       espaço livre e anulam o justify-content:center do menu. */
    '  header nav > a:last-child{box-sizing:border-box !important;flex:0 0 auto !important;margin:2px 0 0 !important;padding:11px 22px !important;display:inline-flex !important;align-items:center !important;justify-content:center !important;min-height:44px !important}',
    '  [data-font-controls]{display:none !important}',
    '  [title="Diminuir texto"],[title="Tamanho padrão"],[title="Aumentar texto"]{display:none !important}',
    /* O acesso ao painel fica no menu também no celular — é por ele que a equipe entra. */
    '  [title="Acesso restrito da equipe"]{display:inline-flex !important;align-items:center !important;min-height:36px !important}',

    /* Capa: altura própria, conteúdo com respiro e sem sobreposição */
    '  [data-no-watermark][style*="100vh"]{height:auto !important;min-height:0 !important;max-height:none !important;display:block !important;padding:0 !important}',
    '  [data-no-watermark][style*="100vh"] > div:last-child{position:relative !important;padding:190px 22px 46px !important;max-width:none !important}',

    /* Tipografia: escala fluida, sem quebrar palavra no meio */
    '  h1,h2,h3{text-wrap:balance;overflow-wrap:break-word;hyphens:none !important}',
    '  h1{font-size:clamp(26px,7.4vw,40px) !important;line-height:1.1 !important;margin-bottom:14px !important}',
    '  h2{font-size:clamp(23px,6vw,34px) !important;line-height:1.15 !important}',
    '  h3{font-size:clamp(18px,4.6vw,24px) !important}',
    '  p{font-size:15px !important;line-height:1.6 !important}',
    '  [style*="font-size:48px"],[style*="font-size:52px"],[style*="font-size:64px"],[style*="font-size:76px"]{font-size:clamp(26px,7.4vw,40px) !important;line-height:1.1 !important}',
    '  [style*="font-size:40px"],[style*="font-size:38px"],[style*="font-size:34px"]{font-size:clamp(22px,5.8vw,30px) !important}',
    '  [style*="font-size:17px"],[style*="font-size:16px"]{font-size:15px !important}',

    /* Blocos altos e larguras fixas viram fluidos */
    '  [style*="height:420px"],[style*="height: 420px"]{height:250px !important}',
    '  [style*="height:504px"],[style*="height: 504px"]{height:280px !important}',
    '  [style*="width:686px"],[style*="width: 686px"],[style*="width:497px"],[style*="width: 497px"]{width:100% !important}',
    '  [style*="max-width:520px"]{max-width:100% !important}',

    /* No celular a barra de filtros deixa de ser fixa: empilhada, ela era sobreposta pelos
       cards de imóveis durante a rolagem. Restrito ao painel de filtros — um seletor "aside"
       solto também atingia a barra lateral do CRM. */
    '  [data-filters]{position:static !important;top:auto !important;border-right:none !important;border-bottom:1px solid #ddd3bd !important;padding:26px 22px !important}',
    '  [data-filters] + div{padding-top:26px !important}',

    /* Botões e campos: alvo de toque confortável. O 16px nos campos também evita que o
       iPhone dê zoom sozinho ao focar um input, o que desalinha a tela inteira. */
    '  a[style*="padding"],button{box-sizing:border-box !important;min-height:44px}',
    '  input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]),select,textarea{box-sizing:border-box !important;min-height:46px !important;font-size:16px !important;padding:12px 14px !important}',
    '  textarea{min-height:96px !important}',
    '  label,[style*="font-size:11px"],[style*="font-size:11.5px"]{font-size:12.5px !important}',
    '  [style*="padding:60px"],[style*="padding: 60px"]{padding:36px 22px !important}',
    '  [style*="padding:100px"],[style*="padding: 100px"]{padding:52px 22px !important}',
    '  [style*="padding:70px"],[style*="padding: 70px"]{padding:44px 22px !important}',
    '  [style*="gap:60px"],[style*="gap: 60px"]{gap:30px !important}',
    '}',

    /* ---------- Celular estreito ---------- */
    '@media (max-width:520px){',
    '  section,header,footer{padding-left:18px !important;padding-right:18px !important}',
    '  header nav{column-gap:14px !important}',
    '  header nav a{font-size:11px !important}',
    /* No celular o botão ganha linha própria; a centralização vem do próprio menu */
    '  header nav > a:last-child{box-sizing:border-box !important;flex:0 0 100% !important;margin-top:6px !important}',
    '  [data-no-watermark][style*="100vh"] > div:last-child{padding:150px 18px 38px !important}',
    '  h1{font-size:clamp(24px,8vw,32px) !important}',
    '}'
  ].join('\n');

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
})();
