// Login real do Google (OAuth), para identificar a conta e escolher qual Conta de Anúncios
// do Google Ads usar na importação de leads (formulários/WhatsApp).
//
// Pré-requisito inevitável: um Client ID OAuth do Google, criado em
// console.cloud.google.com → APIs e serviços → Credenciais → Criar ID do cliente OAuth
// (tipo "Aplicativo da Web"). Assim como o Facebook, o Google exige isso de qualquer site.
//
// Limite técnico honesto: listar as Contas de Anúncio de dentro do Google Ads exige também
// um "developer token" da API do Google Ads, que só pode ficar guardado num servidor (nunca
// no navegador, por segurança) — por isso, depois do login, a conta de anúncios é informada
// manualmente (o ID aparece no próprio Google Ads, formato 123-456-7890). O login em si já
// confirma qual e-mail está conectado.
(function () {
  if (window.GoogleIntegration) return;

  function loadGIS() {
    return new Promise((resolve, reject) => {
      if (window.google && window.google.accounts) return resolve();
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function login(clientId) {
    return loadGIS().then(() => new Promise((resolve, reject) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/adwords',
        callback: (resp) => resp.access_token ? resolve(resp.access_token) : reject(new Error('Login cancelado ou não autorizado.')),
        error_callback: () => reject(new Error('Login cancelado ou não autorizado.'))
      });
      client.requestAccessToken();
    }));
  }

  function getProfile(token) {
    return fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json());
  }

  window.GoogleIntegration = { login, getProfile };
})();
