// Banco de dados real (Firebase): imóveis, fotos e conteúdo do site ficam guardados aqui —
// não no navegador de quem edita. Assim, qualquer visitante, em qualquer navegador, vê o
// mesmo conteúdo, sem precisar publicar arquivo nenhum.
//
// Ativa sozinho quando firebase-config.js tem uma configuração válida; sem isso, o site
// continua funcionando com os dados salvos localmente (comportamento anterior).
(function () {
  if (window.FirebaseDB) return;

  const cfg = window.EDINA_FIREBASE_CONFIG;
  if (!cfg || !cfg.projectId) {
    window.FirebaseDB = { enabled: false, ready: Promise.resolve(false) };
    return;
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  const ready = Promise.all([
    loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js'),
    loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js'),
    loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-storage-compat.js')
  ]).then(() => {
    firebase.initializeApp(cfg);
    return true;
  }).catch(() => false);

  const DOC = (name) => firebase.firestore().collection('edina').doc(name);
  const DOCS = ['properties', 'site', 'posts', 'testimonials'];

  function dataUrlToBlob(dataUrl) {
    const comma = dataUrl.indexOf(',');
    const mime = (dataUrl.match(/^data:([^;]+)/) || [])[1] || 'application/octet-stream';
    const binary = atob(dataUrl.slice(comma + 1));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  // Sobe cada foto/áudio nova (data: ou idb:) para o Storage e troca pela URL pública —
  // documentos do Firestore são pequenos (limite de 1MB); as mídias vivem no Storage.
  async function externalizeMedia(value, folder, cache) {
    if (!value || typeof value !== 'string') return value;
    const isIdb = /^idb(photo|audio|video):/.test(value);
    const isData = value.indexOf('data:') === 0;
    if (!isIdb && !isData) return value; // já é uma URL (http, ou caminho relativo antigo)
    if (cache[value]) return cache[value];
    let dataUrl = value;
    if (isIdb) {
      await window.CRMData.warm([value]);
      dataUrl = window.CRMData.photoURL(value) || await window.CRMData.getMediaRaw(value);
    }
    if (!dataUrl || dataUrl.indexOf('data:') !== 0) return '';
    const blob = dataUrlToBlob(dataUrl);
    const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
    const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    try {
      const ref = firebase.storage().ref(path);
      await ref.put(blob);
      const url = await ref.getDownloadURL();
      cache[value] = url;
      return url;
    } catch (e) {
      // Storage indisponível não pode levar o cadastro junto: sem este resgate, uma foto
      // recusada derrubava a gravação inteira e o imóvel não chegava a existir no banco.
      // Melhor o imóvel no ar sem imagem do que imóvel nenhum — a foto continua guardada
      // neste navegador e sobe assim que o Storage voltar.
      mediaErrors.push({ path: path, code: e && (e.code || e.message) });
      return '';
    }
  }

  // Falhas de upload da última gravação. O CRM lê isto para avisar em vez de deixar a
  // pessoa achar que as fotos subiram.
  const mediaErrors = [];

  async function externalizeProperties(props) {
    mediaErrors.length = 0;
    const cache = {};
    const out = [];
    for (const p of props) {
      const q = { ...p };
      if (q.image) q.image = await externalizeMedia(q.image, 'fotos', cache);
      if (Array.isArray(q.images)) {
        const arr = [];
        for (const im of q.images) { const u = await externalizeMedia(im, 'fotos', cache); if (u) arr.push(u); }
        q.images = arr;
      }
      if (q.videoFile) q.videoFile = await externalizeMedia(q.videoFile, 'videos', cache);
      out.push(q);
    }
    return out;
  }

  async function externalizeSite(site) {
    const cache = {};
    const out = { ...site };
    for (const k of ['logoUrl', 'signatureUrl', 'watermarkLogoUrl', 'faviconUrl']) {
      if (out[k]) out[k] = await externalizeMedia(out[k], 'site', cache);
    }
    if (Array.isArray(out.heroSlides)) {
      const arr = [];
      for (const s of out.heroSlides) arr.push(s ? await externalizeMedia(s, 'site', cache) : s);
      out.heroSlides = arr;
    }
    return out;
  }

  async function externalizeList(list, key) {
    const cache = {};
    const out = [];
    for (const item of list) {
      const q = { ...item };
      if (q[key]) q[key] = await externalizeMedia(q[key], 'midia', cache);
      out.push(q);
    }
    return out;
  }

  async function save(name, payload) {
    await ready;
    if (!firebase.apps.length) return false;
    await DOC(name).set({ data: payload, updatedAt: Date.now() });
    return true;
  }

  // Visualizações de página: cada visitante grava seu próprio registro (não passa pelo
  // CRM), então usa uma coleção separada em vez do doc único usado para o resto do conteúdo.
  async function logPageview(entry) {
    const ok = await ready;
    if (!ok || !firebase.apps.length) return false;
    return firebase.firestore().collection('edina_analytics').add(entry).then(() => true).catch(() => false);
  }
  async function fetchAnalytics() {
    const ok = await ready;
    if (!ok || !firebase.apps.length) return [];
    return firebase.firestore().collection('edina_analytics').limit(20000).get()
      .then(snap => snap.docs.map(d => d.data()))
      .catch(() => []);
  }

  async function fetchAll() {
    const ok = await ready;
    if (!ok || !firebase.apps.length) return null;
    const out = {};
    await Promise.all(DOCS.map(name => DOC(name).get().then(snap => {
      out[name] = snap.exists ? snap.data().data : undefined;
    }).catch(() => {})));
    return out;
  }

  // Fica de olho em mudanças ao vivo — se a Edina publicar de outro aparelho enquanto um
  // visitante está com o site aberto, ele atualiza sozinho.
  function watch(onChange) {
    ready.then(ok => {
      if (!ok || !firebase.apps.length) return;
      DOCS.forEach(name => DOC(name).onSnapshot(snap => {
        if (snap.exists) onChange(name, snap.data().data);
      }, () => {}));
    });
  }

  // Contatos recebidos pelo site. Ficam fora de DOCS de propósito: o pacote que todo
  // visitante baixa não precisa carregar a carteira de clientes junto.
  async function saveLeads(arr) { return save('leads', arr); }
  async function fetchLeads() {
    const ok = await ready;
    if (!ok || !firebase.apps.length) return null;
    return DOC('leads').get().then(s => (s.exists ? (s.data().data || []) : [])).catch(() => null);
  }
  // Acrescenta um contato lendo a lista no instante da gravação — dois envios ao mesmo tempo
  // não se sobrescrevem, como aconteceria se a lista viesse do navegador.
  async function appendLead(lead) {
    const ok = await ready;
    if (!ok || !firebase.apps.length) return false;
    const ref = DOC('leads');
    return firebase.firestore().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const cur = snap.exists ? (snap.data().data || []) : [];
      const id = cur.reduce((m, l) => Math.max(m, Number(l.id) || 0), 0) + 1;
      tx.set(ref, { data: [{ ...lead, id }, ...cur], updatedAt: Date.now() });
      return true;
    }).catch(() => false);
  }

  window.FirebaseDB = {
    enabled: true,
    ready: ready,
    saveProperties: (arr) => externalizeProperties(arr).then(out => save('properties', out)),
    saveLeads: saveLeads,
    fetchLeads: fetchLeads,
    appendLead: appendLead,
    saveSite: (obj) => externalizeSite(obj).then(out => save('site', out)),
    savePosts: (arr) => externalizeList(arr, 'image').then(out => save('posts', out)),
    saveTestimonials: (arr) => externalizeList(arr, 'audioUrl').then(out => save('testimonials', out)),
    mediaErrors: () => mediaErrors.slice(),
    fetchAll: fetchAll,
    watch: watch,
    logPageview: logPageview,
    fetchAnalytics: fetchAnalytics
  };
})();
