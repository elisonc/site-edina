// Login real do Facebook (Meta for Business): carrega o SDK oficial, abre o popup de login
// do Facebook de verdade, e deixa escolher a Business Manager e a conta de anúncios de onde
// os leads (formulários/WhatsApp) serão importados.
//
// Pré-requisito inevitável: um App ID do Facebook. O Facebook exige que todo site que faz
// login com a conta do usuário esteja registrado como um "app" no painel deles — não existe
// como pular essa etapa (é assim para qualquer site, não só este). Crie de graça em
// developers.facebook.com → Meus Apps → Criar App → tipo "Negócios", copie o ID e cole no
// campo do CRM.
(function () {
  if (window.FacebookIntegration) return;

  function loadSDK(appId) {
    return new Promise((resolve, reject) => {
      if (window.FB) { window.FB.init({ appId, cookie: true, xfbml: false, version: 'v20.0' }); return resolve(); }
      window.fbAsyncInit = function () {
        window.FB.init({ appId, cookie: true, xfbml: false, version: 'v20.0' });
        resolve();
      };
      const s = document.createElement('script');
      s.src = 'https://connect.facebook.net/pt_BR/sdk.js';
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function login(appId) {
    return loadSDK(appId).then(() => new Promise((resolve, reject) => {
      window.FB.login((res) => {
        if (res.authResponse) resolve(res.authResponse);
        else reject(new Error('Login cancelado ou não autorizado.'));
      }, { scope: 'public_profile,email,pages_show_list,leads_retrieval,ads_management,business_management' });
    }));
  }

  function graph(path, token) {
    return fetch(`https://graph.facebook.com/v20.0${path}${path.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error.message); return d; });
  }

  // Depois do login, lista as Business Managers e, dentro delas, as contas de anúncio —
  // para a cliente simplesmente escolher de qual conta puxar os leads.
  function listBusinesses(token) {
    return graph('/me/businesses?fields=id,name', token).then(d => d.data || []);
  }
  function listAdAccounts(businessId, token) {
    return graph(`/${businessId}/owned_ad_accounts?fields=id,name,account_id`, token).then(d => d.data || []);
  }
  function getProfile(token) {
    return graph('/me?fields=id,name,email', token);
  }

  window.FacebookIntegration = { login, listBusinesses, listAdAccounts, getProfile };
})();
