(function () {
  if (window.__edinaResponsiveInstalled) return;
  window.__edinaResponsiveInstalled = true;

  var css = [
    'img,video{max-width:100%}',
    '@media (max-width:980px){',
    '  [style*="grid-template-columns"]{grid-template-columns:1fr !important}',
    '  header{flex-wrap:wrap !important;height:auto !important;row-gap:10px !important;padding-left:20px !important;padding-right:20px !important}',
    '  header nav{flex-wrap:wrap !important;justify-content:center !important;width:100%;row-gap:10px !important;column-gap:14px !important}',
    '  header nav a,header nav [style*="white-space:nowrap"]{white-space:normal !important}',
    '  [title="Diminuir texto"],[title="Tamanho padrão"],[title="Aumentar texto"]{display:none !important}',
    '  [title="Acesso restrito da equipe"]{display:none !important}',
    '  section,header,footer{padding-left:20px !important;padding-right:20px !important}',
    '  h1[style*="font-size:64px"]{font-size:36px !important;line-height:1.08 !important}',
    '  h1[style*="font-size:52px"],h2[style*="font-size:52px"]{font-size:32px !important}',
    '  [style*="font-size:48px"]{font-size:30px !important}',
    '  [style*="font-size:40px"]{font-size:28px !important}',
    '  [style*="height:calc(100vh - 180px)"]{height:auto !important;min-height:auto !important;max-height:none !important;padding-top:60vw !important}',
    '  [style*="height: 420px"],[style*="height:420px"]{height:260px !important}',
    '  header nav{gap:8px 12px !important}',
    '  header nav a{font-size:11px !important}',
    '}',
    '@media (max-width:520px){',
    '  header nav{gap:8px 10px !important}',
    '  header nav a{font-size:10.5px !important}',
    '  h1[style*="font-size:64px"]{font-size:30px !important}',
    '}'
  ].join('\n');

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
})();
