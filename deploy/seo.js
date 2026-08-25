// Aplica SEO (título, meta description, palavras-chave, Open Graph, canônica, robots) e o
// Google Tag Manager em toda página pública, a partir do que foi configurado no CRM. Roda
// cedo, assim que os dados publicados/locais estão prontos.
(function () {
  if (window.__edinaSeoInstalled) return;
  window.__edinaSeoInstalled = true;

  function setMeta(name, content, attr) {
    attr = attr || 'name';
    if (!content) return;
    let el = document.head.querySelector(`meta[${attr}="${name}"]`);
    if (!el) { el = document.createElement('meta'); el.setAttribute(attr, name); document.head.appendChild(el); }
    el.setAttribute('content', content);
  }

  function setLink(rel, href) {
    if (!href) return;
    let el = document.head.querySelector(`link[rel="${rel}"]`);
    if (!el) { el = document.createElement('link'); el.setAttribute('rel', rel); document.head.appendChild(el); }
    el.setAttribute('href', href);
  }

  function injectGTM(id) {
    if (!id || document.getElementById('__gtm_script')) return;
    const s = document.createElement('script');
    s.id = '__gtm_script';
    s.textContent = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${id}');`;
    document.head.appendChild(s);
    const noscript = document.createElement('noscript');
    noscript.innerHTML = `<iframe src="https://www.googletagmanager.com/ns.html?id=${id}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`;
    document.body.insertBefore(noscript, document.body.firstChild);
  }

  function apply() {
    const D = window.CRMData;
    if (!D) return;
    const site = D.getSiteContent ? D.getSiteContent() : {};
    const integ = D.getIntegrations ? D.getIntegrations() : {};

    if (site.metaTitle) document.title = site.metaTitle;
    setMeta('description', site.metaDescription || document.querySelector('meta[name="description"]')?.content);
    if (site.metaKeywords) setMeta('keywords', site.metaKeywords);
    if (site.canonicalUrl) setLink('canonical', site.canonicalUrl.replace(/\/$/, '') + location.pathname.replace(/^\/*/, '/'));
    setMeta('robots', site.seoIndexable === false ? 'noindex, nofollow' : 'index, follow');

    setMeta('og:title', site.metaTitle || document.title, 'property');
    setMeta('og:description', site.metaDescription, 'property');
    setMeta('og:type', 'website', 'property');
    setMeta('og:url', location.href, 'property');
    if (site.ogImage) {
      const url = D.photoURL ? D.photoURL(site.ogImage) : site.ogImage;
      if (url) setMeta('og:image', url, 'property');
    }
    setMeta('twitter:card', 'summary_large_image');

    if (integ.gtmId) injectGTM(integ.gtmId);
  }

  if (window.CRMData && window.CRMData.loadPublished) {
    window.CRMData.loadPublished().then(apply).catch(apply);
  } else {
    apply();
  }
})();
