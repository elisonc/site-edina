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

  // Prazo máximo de um envio ao Storage. Passou disso, seguimos sem a imagem: é preferível
  // publicar o imóvel sem foto a deixar o cadastro inteiro esperando por ela.
  // Seis segundos bastam para um envio que vai dar certo. Vinte só faziam a pessoa esperar
  // quando o Storage estava fora — e era a maior parte do tempo que uma gravação levava.
  const UPLOAD_TIMEOUT_MS = 6000;

  // Storage fora não é notícia de um instante só. Guardar essa constatação por alguns
  // minutos evita cobrar o tempo de espera de novo a cada gravação: a partir da segunda,
  // a imagem vai direto para dentro do documento, sem parada.
  const LEMBRAR_FORA_MS = 10 * 60 * 1000;
  const CHAVE_FORA = 'edina_storage_fora_ate';
  function storageMarcadoFora() {
    try { return Number(localStorage.getItem(CHAVE_FORA) || 0) > Date.now(); } catch (e) { return false; }
  }
  function marcarStorageFora() {
    try { localStorage.setItem(CHAVE_FORA, String(Date.now() + LEMBRAR_FORA_MS)); } catch (e) {}
  }
  function limparMarcaStorage() {
    try { localStorage.removeItem(CHAVE_FORA); } catch (e) {}
  }

  // Depois da primeira recusa não vale insistir nas outras imagens: com 19 fotos numa
  // ficha, esperar o prazo de cada uma deixaria a pessoa olhando para um botão travado
  // por minutos. Uma falha basta para concluir que o Storage está fora e seguir em frente.
  let storageIndisponivel = false;

  // Plano B para quando o Storage está fora: a imagem viaja dentro do próprio documento,
  // em vez de virar um endereço. Só serve para as poucas e pequenas — logo, assinatura,
  // fotos de capa, foto de depoimento —, porque um documento do Firestore não passa de 1 MB.
  // Sem isso, uma foto enviada pelo painel simplesmente não existia para os outros aparelhos.
  const TETO_INLINE = 700 * 1024;
  const TETO_POR_IMAGEM = 350 * 1024;
  let inlineUsado = 0;

  function comPrazo(promessa, ms, rotulo) {
    let t;
    return Promise.race([
      Promise.resolve(promessa).then(v => { clearTimeout(t); return v; },
                                     e => { clearTimeout(t); throw e; }),
      new Promise((_, rej) => { t = setTimeout(() => rej(new Error('tempo esgotado: ' + rotulo)), ms); })
    ]);
  }

  const DOC = (name) => firebase.firestore().collection('edina').doc(name);
  // Tudo que precisa ser igual em qualquer aparelho. Contatos, agenda e integrações
  // ficavam de fora e por isso divergiam de um navegador para o outro.
  // 'auth' entra: a senha é guardada só como impressão digital, então o cadastro pode ser
  // compartilhado sem expor a senha de ninguém.
  const DOCS = ['properties', 'site', 'posts', 'testimonials', 'leads', 'visits', 'integrations', 'history', 'auth'];

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
  // Com o Storage fora, a imagem viaja dentro do próprio documento em vez de virar um
  // endereço — é o que faz uma foto enviada pelo painel existir para os outros aparelhos.
  // Vale só para as pequenas: um documento do Firestore não passa de 1 MB.
  async function guardarNoDocumento(chave, dataUrl, cache) {
    // Não deu para ler a imagem? Devolve o valor como está. Apagá-la seria destruir uma foto
    // que existe — é o que acontecia quando um navegador salvava por cima de uma imagem
    // enviada de outro aparelho, cuja referência local ele não tem como abrir.
    if (!dataUrl || dataUrl.indexOf('data:') !== 0) return value;
    let atual = dataUrl;
    // Uma foto de capa é salva em 1920px e passa folgada do teto. Em vez de descartá-la,
    // reduz por etapas até caber — melhor a imagem um pouco menor em todos os aparelhos do
    // que a original só no de quem enviou.
    const etapas = [[1600, 0.72], [1200, 0.66], [900, 0.6], [700, 0.52]];
    for (let i = 0; i < etapas.length && atual.length > TETO_POR_IMAGEM; i++) {
      if (!(window.CRMData && window.CRMData.resizeDataUrl)) break;
      try {
        const menor = await window.CRMData.resizeDataUrl(atual, etapas[i][0], etapas[i][1]);
        if (menor && menor.indexOf('data:') === 0 && menor.length < atual.length) atual = menor;
        else break;
      } catch (e) { break; }
    }
    if (atual.length > TETO_POR_IMAGEM) return '';
    if (inlineUsado + atual.length > TETO_INLINE) return '';
    inlineUsado += atual.length;
    cache[chave] = atual;
    return atual;
  }

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
    if (storageIndisponivel || storageMarcadoFora()) {
      mediaErrors.push({ path: path, code: 'storage-indisponivel' });
      return (await guardarNoDocumento(value, dataUrl, cache)) || value;
    }
    try {
      const ref = firebase.storage().ref(path);
      // O envio precisa de prazo. Quando o Storage recusa a origem, o SDK não devolve erro:
      // fica retentando em silêncio e a promessa nunca se resolve — a gravação do imóvel
      // ficava pendurada nela e nunca chegava ao banco.
      await comPrazo(ref.put(blob), UPLOAD_TIMEOUT_MS, 'upload');
      const url = await comPrazo(ref.getDownloadURL(), UPLOAD_TIMEOUT_MS, 'url');
      cache[value] = url;
      limparMarcaStorage();
      return url;
    } catch (e) {
      // Storage indisponível não pode levar o cadastro junto: sem este resgate, uma foto
      // recusada derrubava a gravação inteira e o imóvel não chegava a existir no banco.
      // Melhor o imóvel no ar sem imagem do que imóvel nenhum — a foto continua guardada
      // neste navegador e sobe assim que o Storage voltar.
      storageIndisponivel = true;
      marcarStorageFora();
      mediaErrors.push({ path: path, code: e && (e.code || e.message) });
      return (await guardarNoDocumento(value, dataUrl, cache)) || value;
    }
  }

  // Falhas de upload da última gravação. O CRM lê isto para avisar em vez de deixar a
  // pessoa achar que as fotos subiram.
  const mediaErrors = [];

  // ---- Fotos de imóvel em documento próprio ----
  // Um documento do Firestore vai até 1 MB, e o catálogo inteiro mora num só. As fotos de
  // uma ficha (uma dúzia, às vezes) não cabem ali junto com todos os outros imóveis — era
  // por isso que uma importação com sete fotos chegava ao banco sem nenhuma. Cada imóvel
  // passa a ter o seu próprio documento de fotos, e a ficha guarda apenas a referência.
  // Documentos dentro de 'edina', e não numa coleção nova: as regras já publicadas liberam
  // 'edina/{doc}', então isto funciona sem pedir nenhuma alteração no console do Firebase.
  const nomeDocFotos = (id) => 'fotos_' + id;
  const TETO_DOC_FOTOS = 900 * 1024;

  // Resolve uma referência local (idb:) para a imagem em si; data: já vem pronta.
  async function paraDataUrl(valor) {
    const v = String(valor || '');
    if (v.indexOf('data:') === 0) return v;
    if (!/^idb/.test(v)) return '';
    try {
      await window.CRMData.warm([v]);
      return window.CRMData.photoURL(v) || await window.CRMData.getMediaRaw(v) || '';
    } catch (e) { return ''; }
  }

  // As fotos de uma ficha vão em blocos: um documento do Firestore para no limite de 1 MB, e
  // uma galeria de duas dúzias de imagens passa disso com folga. Antes tudo ia num documento
  // só, a gravação era recusada inteira e a ficha acabava com as poucas fotos que coubessem
  // embutidas — que era o motivo de as imagens sumirem logo depois de salvar.
  const TETO_BLOCO = 600 * 1024;
  const MAX_BLOCOS = 12;
  const nomeBloco = (chave, n) => 'fotos_' + chave + '_' + n;

  async function guardarImagens(chave, fotos) {
    await ready;
    if (!firebase.apps.length) return null;

    const reduzir = async (f, larg, q) => {
      if (!(window.CRMData && window.CRMData.resizeDataUrl)) return f;
      try {
        const menor = await window.CRMData.resizeDataUrl(f, larg, q);
        return (menor && menor.indexOf('data:') === 0 && menor.length < f.length) ? menor : f;
      } catch (e) { return f; }
    };

    const validas = (fotos || []).filter(f => f && f.indexOf('data:') === 0);
    if (!validas.length) return null;

    // Galeria grande pede foto mais leve; o piso mantém a imagem apresentável na página.
    const cota = validas.length > 12 ? 90 * 1024 : 130 * 1024;
    const etapas = [[1400, 0.72], [1100, 0.66], [900, 0.6], [700, 0.52], [560, 0.46]];

    const blocos = [[]];
    let usadoNoBloco = 0;
    let total = 0;
    for (const original of validas) {
      let f = original;
      for (let i = 0; i < etapas.length && f.length > cota; i++) {
        f = await reduzir(f, etapas[i][0], etapas[i][1]);
      }
      if (usadoNoBloco + f.length > TETO_BLOCO) {
        if (blocos.length >= MAX_BLOCOS) break;
        blocos.push([]);
        usadoNoBloco = 0;
      }
      blocos[blocos.length - 1].push(f);
      usadoNoBloco += f.length;
      total++;
    }
    if (!total) return null;

    // Cada bloco é gravado por conta própria: se um falhar, os anteriores continuam valendo
    // e a ficha fica com as fotos que deram certo, em vez de perder todas.
    let gravadas = 0;
    for (let n = 0; n < blocos.length; n++) {
      try {
        await DOC(nomeBloco(chave, n)).set({ data: blocos[n], updatedAt: Date.now() });
        gravadas += blocos[n].length;
      } catch (e) {
        mediaErrors.push({ path: nomeBloco(chave, n), code: e && (e.code || e.message) });
        break;
      }
    }
    // Blocos de uma gravação anterior que sobraram não podem continuar aparecendo.
    for (let n = blocos.length; n < MAX_BLOCOS; n++) {
      try { await DOC(nomeBloco(chave, n)).delete(); } catch (e) { break; }
    }
    return gravadas || null;
  }

  async function lerImagens(chave) {
    await ready;
    if (!firebase.apps.length) return [];
    const fotos = [];
    for (let n = 0; n < MAX_BLOCOS; n++) {
      try {
        const snap = await DOC(nomeBloco(chave, n)).get();
        if (!snap.exists) break;
        fotos.push(...(snap.data().data || []));
      } catch (e) { break; }
    }
    if (fotos.length) return fotos;
    // Fichas gravadas antes da divisão em blocos.
    try {
      const antigo = await DOC('fotos_' + chave).get();
      return antigo.exists ? (antigo.data().data || []) : [];
    } catch (e) { return []; }
  }

  // Troca as referências 'fotodoc:' pelas imagens de verdade, para quem for exibir.
  // Resolve as referências de um conjunto (site, posts) para as imagens de verdade.
  async function hidratarConjunto(alvo, campos, rotulo) {
    const refDe = (v) => (typeof v === 'string' && v.indexOf('fotodoc:' + rotulo + ':') === 0)
      ? parseInt(v.split(':')[2], 10) : -1;
    const precisa = campos.some(c => refDe(alvo[c]) >= 0) ||
      (Array.isArray(alvo.heroSlides) && alvo.heroSlides.some(v => refDe(v) >= 0));
    if (!precisa) return alvo;
    const imgs = await lerImagens(rotulo);
    if (!imgs.length) return alvo;
    campos.forEach(c => { const i = refDe(alvo[c]); if (i >= 0 && imgs[i]) alvo[c] = imgs[i]; });
    if (Array.isArray(alvo.heroSlides)) {
      alvo.heroSlides = alvo.heroSlides.map(v => { const i = refDe(v); return (i >= 0 && imgs[i]) ? imgs[i] : v; });
    }
    return alvo;
  }

  async function hidratarLista(lista, campo, rotulo) {
    const precisa = (lista || []).some(x => typeof x[campo] === 'string' && x[campo].indexOf('fotodoc:' + rotulo + ':') === 0);
    if (!precisa) return lista;
    const imgs = await lerImagens(rotulo);
    if (!imgs.length) return lista;
    lista.forEach(x => {
      if (typeof x[campo] === 'string' && x[campo].indexOf('fotodoc:' + rotulo + ':') === 0) {
        const i = parseInt(x[campo].split(':')[2], 10);
        if (imgs[i]) x[campo] = imgs[i];
      }
    });
    return lista;
  }

  async function hidratarFotos(props) {
    const precisam = (props || []).filter(p =>
      String(p.image || '').indexOf('fotodoc:') === 0 ||
      (p.images || []).some(i => String(i).indexOf('fotodoc:') === 0));
    if (!precisam.length) return props;
    await Promise.all(precisam.map(async p => {
      const fotos = await lerImagens(p.id);
      if (!fotos.length) return;
      p.images = fotos.slice();
      p.image = fotos[0];
    }));
    return props;
  }

  async function externalizeProperties(props) {
    mediaErrors.length = 0;
    storageIndisponivel = false;
    inlineUsado = 0;
    const cache = {};
    const out = [];
    for (const p of props) {
      const q = { ...p };
      const originais = [q.image].concat(Array.isArray(q.images) ? q.images : []).filter(Boolean);
      const precisamSubir = originais.some(v => /^idb/.test(String(v)) || String(v).indexOf('data:') === 0);

      // Antes de decidir o caminho, uma sondagem: a primeira foto vai ao Storage. Deu certo,
      // segue o fluxo normal de endereços. Falhou, todas vão para os blocos de uma vez.
      // Depender de uma marca com validade fazia a decisão variar entre uma gravação e outra
      // — e no meio do caminho o espaço para embutir imagem já tinha se esgotado.
      if (precisamSubir && !storageIndisponivel && !storageMarcadoFora()) {
        const sonda = originais.find(v => /^idb/.test(String(v)) || String(v).indexOf('data:') === 0);
        if (sonda) await externalizeMedia(sonda, 'fotos', cache);
      }

      // Sem Storage, as fotos da ficha vão para documentos do próprio imóvel, onde cabem.
      // A ficha guarda só a referência: o catálogo continua leve e nenhuma foto se perde
      // por falta de espaço.
      if (precisamSubir && (storageIndisponivel || storageMarcadoFora())) {
        const dados = [];
        let algumaNaoAbriu = false;
        for (const v of originais) {
          const d = await paraDataUrl(v);
          if (d) dados.push(d); else algumaNaoAbriu = true;
        }
        // Se alguma foto da ficha não abriu neste navegador, ela veio de outro aparelho:
        // reescrever a lista aqui apagaria justamente essa. Deixa como está.
        if (algumaNaoAbriu && !dados.length) { out.push(q); continue; }
        // Problema ao guardar as fotos não pode levar a ficha junto: o cadastro vai para o
        // banco de qualquer forma, e as imagens seguem neste navegador para a próxima
        // tentativa. Perder o imóvel inteiro por causa de uma foto seria pior.
        let gravadas = null;
        try { gravadas = await guardarImagens(q.id, dados); }
        catch (e) { mediaErrors.push({ path: 'fotos_' + q.id, code: e && (e.code || e.message) }); }
        if (gravadas) {
          q.images = Array.from({ length: gravadas }, (_, i) => 'fotodoc:' + q.id + ':' + i);
          q.image = q.images[0];
          // Uma versão pequena da capa viaja junto com a ficha: é ela que aparece nos cards
          // da listagem. Sem isso, cada card baixaria a foto inteira do documento de fotos e
          // o portfólio ficaria pesado conforme os imóveis fossem cadastrados.
          if (dados[0] && window.CRMData && window.CRMData.resizeDataUrl) {
            try {
              const mini = await window.CRMData.resizeDataUrl(dados[0], 420, 0.55);
              if (mini && mini.length < 40 * 1024) q.thumb = mini;
            } catch (e) {}
          }
          if (q.videoFile) q.videoFile = await externalizeMedia(q.videoFile, 'videos', cache);
          out.push(q);
          continue;
        }
      }

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

  // Todas as imagens do site, e não só o logotipo e a assinatura: a foto da Edina, a de
  // compartilhamento, o destaque e as capas ficavam de fora e iam para o banco como
  // referência local — que só existe no navegador de quem enviou. Nos outros aparelhos
  // simplesmente não apareciam.
  const CAMPOS_DE_IMAGEM = ['logoUrl', 'signatureUrl', 'watermarkLogoUrl', 'faviconUrl',
                            'heroImage', 'aboutImage', 'spotlightImage', 'footerLogoUrl', 'ogImage'];

  async function externalizeSite(site) {
    mediaErrors.length = 0;
    inlineUsado = 0;
    const cache = {};
    const out = { ...site };

    const local = (v) => typeof v === 'string' && (/^idb/.test(v) || v.indexOf('data:') === 0);
    const pendentes = [];
    CAMPOS_DE_IMAGEM.forEach(k => { if (local(out[k])) pendentes.push({ campo: k }); });
    (Array.isArray(out.heroSlides) ? out.heroSlides : []).forEach((v, i) => {
      if (local(v)) pendentes.push({ slide: i });
    });

    if (pendentes.length) {
      // Sonda o Storage com a primeira; recusado, todas vão para os blocos do site.
      const primeira = pendentes[0].campo ? out[pendentes[0].campo] : out.heroSlides[pendentes[0].slide];
      if (!storageIndisponivel && !storageMarcadoFora()) await externalizeMedia(primeira, 'site', cache);

      if (storageIndisponivel || storageMarcadoFora()) {
        const dados = [];
        for (const alvo of pendentes) {
          const valor = alvo.campo ? out[alvo.campo] : out.heroSlides[alvo.slide];
          const d = await paraDataUrl(valor);
          dados.push(d || '');
          alvo.original = valor;   // se a imagem não abrir aqui, o valor original fica de pé
        }
        let gravadas = 0;
        try { gravadas = await guardarImagens('site', dados.filter(Boolean)) || 0; }
        catch (e) { mediaErrors.push({ path: 'fotos_site', code: e && (e.code || e.message) }); }
        if (gravadas) {
          let idx = 0;
          pendentes.forEach((alvo, i) => {
            // Sem imagem legível ou sem espaço no bloco, o campo continua como estava.
            if (!dados[i] || idx >= gravadas) return;
            const ref = 'fotodoc:site:' + idx;
            if (alvo.campo) out[alvo.campo] = ref; else out.heroSlides[alvo.slide] = ref;
            idx++;
          });
        }
      }
    }

    // O que sobrou (endereço já pronto, ou Storage funcionando) segue o caminho normal.
    for (const k of CAMPOS_DE_IMAGEM) {
      if (local(out[k])) out[k] = await externalizeMedia(out[k], 'site', cache);
    }
    if (Array.isArray(out.heroSlides)) {
      const arr = [];
      for (const v of out.heroSlides) arr.push(local(v) ? await externalizeMedia(v, 'site', cache) : v);
      out.heroSlides = arr;
    }
    return out;
  }

  async function externalizeList(list, key, rotulo) {
    mediaErrors.length = 0;
    inlineUsado = 0;
    const cache = {};
    const out = (list || []).map(item => ({ ...item }));
    const local = (v) => typeof v === 'string' && (/^idb/.test(v) || v.indexOf('data:') === 0);
    const pendentes = out.filter(q => local(q[key]));

    if (pendentes.length && rotulo) {
      if (!storageIndisponivel && !storageMarcadoFora()) await externalizeMedia(pendentes[0][key], 'midia', cache);
      if (storageIndisponivel || storageMarcadoFora()) {
        const dados = [];
        for (const q of pendentes) dados.push(await paraDataUrl(q[key]) || '');
        const validos = dados.filter(Boolean);
        let gravadas = 0;
        try { gravadas = await guardarImagens(rotulo, validos) || 0; }
        catch (e) { mediaErrors.push({ path: 'fotos_' + rotulo, code: e && (e.code || e.message) }); }
        let idx = 0;
        for (let i = 0; i < pendentes.length && idx < gravadas; i++) {
          if (!dados[i]) continue;
          pendentes[i][key] = 'fotodoc:' + rotulo + ':' + idx;
          idx++;
        }
      }
    }

    for (const q of out) {
      if (local(q[key])) q[key] = await externalizeMedia(q[key], 'midia', cache);
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
  // O Firestore recusa limit(20000) com invalid-argument: o erro era engolido, a leitura
  // devolvia lista vazia e o painel caía na copia local — que tem as visitas de um
  // navegador só. Era por isso que o total de acessos aparecia como 1 com centenas
  // registradas no banco.
  const TETO_VISITAS = 3000;

  async function fetchAnalytics() {
    const ok = await ready;
    if (!ok || !firebase.apps.length) return [];
    const col = firebase.firestore().collection('edina_analytics');
    // Mais recentes primeiro, para que o teto corte o que já é histórico antigo.
    return col.orderBy('ts', 'desc').limit(TETO_VISITAS).get()
      .then(snap => snap.docs.map(d => d.data()))
      .catch(() => col.limit(TETO_VISITAS).get()
        .then(snap => snap.docs.map(d => d.data()))
        .catch(() => []));
  }

  // Visualizações chegam de visitantes, não do painel: sem ficar de olho, o número só mudava
  // quando alguém recarregava a página do CRM.
  function watchAnalytics(onChange) {
    ready.then(ok => {
      if (!ok || !firebase.apps.length) return;
      firebase.firestore().collection('edina_analytics').limit(TETO_VISITAS)
        .onSnapshot(snap => { onChange(snap.docs.map(d => d.data())); }, () => {});
    });
  }

  async function fetchAll() {
    const ok = await ready;
    if (!ok || !firebase.apps.length) return null;
    const out = {};
    await Promise.all(DOCS.map(name => DOC(name).get().then(snap => {
      out[name] = snap.exists ? snap.data().data : undefined;
    }).catch(() => {})));
    // Fichas que apontam para o documento de fotos recebem as imagens de volta aqui, para
    // quem lê não precisar saber onde elas ficaram guardadas.
    if (Array.isArray(out.properties)) {
      try { await hidratarFotos(out.properties); } catch (e) {}
    }
    if (out.site) {
      try { await hidratarConjunto(out.site, CAMPOS_DE_IMAGEM, 'site'); } catch (e) {}
    }
    if (Array.isArray(out.posts)) {
      try { await hidratarLista(out.posts, 'image', 'posts'); } catch (e) {}
    }
    if (Array.isArray(out.testimonials)) {
      try { await hidratarLista(out.testimonials, 'audioUrl', 'depoimentos'); } catch (e) {}
    }
    return out;
  }

  // Fica de olho em mudanças ao vivo — se a Edina publicar de outro aparelho enquanto um
  // visitante está com o site aberto, ele atualiza sozinho.
  function watch(onChange) {
    ready.then(ok => {
      if (!ok || !firebase.apps.length) return;
      DOCS.forEach(name => DOC(name).onSnapshot(snap => {
        if (!snap.exists) return;
        const dados = snap.data().data;
        if (name === 'properties' && Array.isArray(dados)) {
          hidratarFotos(dados).then(() => onChange(name, dados)).catch(() => onChange(name, dados));
          return;
        }
        if (name === 'site' && dados) {
          hidratarConjunto(dados, CAMPOS_DE_IMAGEM, 'site').then(() => onChange(name, dados)).catch(() => onChange(name, dados));
          return;
        }
        if (name === 'posts' && Array.isArray(dados)) {
          hidratarLista(dados, 'image', 'posts').then(() => onChange(name, dados)).catch(() => onChange(name, dados));
          return;
        }
        onChange(name, dados);
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
    savePosts: (arr) => externalizeList(arr, 'image', 'posts').then(out => save('posts', out)),
    saveTestimonials: (arr) => externalizeList(arr, 'audioUrl', 'depoimentos').then(out => save('testimonials', out)),
    // Gravação genérica, para as chaves que não precisam de tratamento de mídia.
    saveDoc: (nome, dados) => save(nome, dados),
    mediaErrors: () => mediaErrors.slice(),
    guardarImagens: guardarImagens,
    lerImagens: lerImagens,
    hidratarFotos: hidratarFotos,
    fetchAll: fetchAll,
    watch: watch,
    logPageview: logPageview,
    fetchAnalytics: fetchAnalytics,
    watchAnalytics: watchAnalytics
  };
})();
