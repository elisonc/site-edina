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

  const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';

  // A biblioteca do banco pesa cerca de 100 KB e leva tempo para ser interpretada. Ela não
  // é necessária para a primeira tela: a página já nasce com o que está guardado no
  // navegador. Buscá-la antes da primeira pintura atrasava a maior imagem da tela e
  // prendia a linha principal do navegador. Agora espera a página terminar de desenhar, e
  // vai no primeiro momento de folga — com teto, para nunca deixar de carregar.
  function quandoDerFolga() {
    return new Promise((resolve) => {
      let feito = false;
      const ir = () => { if (feito) return; feito = true; resolve(); };
      const agendar = () => (window.requestIdleCallback
        ? requestIdleCallback(ir, { timeout: 1000 })
        : setTimeout(ir, 120));
      if (document.readyState === 'complete') agendar();
      else window.addEventListener('load', agendar, { once: true });
      setTimeout(ir, 2500);
    });
  }

  const ready = quandoDerFolga()
    .then(() => Promise.all([
      loadScript(SDK + 'firebase-app-compat.js'),
      loadScript(SDK + 'firebase-firestore-compat.js')
    ]))
    .then(() => { firebase.initializeApp(cfg); return true; })
    .catch(() => false);

  // O Storage só é buscado quando alguém realmente vai enviar um arquivo por ele. São mais
  // 30 KB que o visitante nunca precisa — e que, com o Storage recusando a origem como
  // hoje, ninguém usava.
  let storagePronto = null;
  function garantirStorage() {
    if (storagePronto) return storagePronto;
    storagePronto = ready
      .then(ok => (ok ? loadScript(SDK + 'firebase-storage-compat.js') : null))
      .then(() => !!(window.firebase && firebase.storage))
      .catch(() => false);
    return storagePronto;
  }

  // Prazo máximo de um envio ao Storage. Passou disso, seguimos sem a imagem: é preferível
  // publicar o imóvel sem foto a deixar o cadastro inteiro esperando por ela.
  // Seis segundos bastam para um envio que vai dar certo. Vinte só faziam a pessoa esperar
  // quando o Storage estava fora — e era a maior parte do tempo que uma gravação levava.
  const UPLOAD_TIMEOUT_MS = 2500;

  // Storage fora não é notícia de um instante só. Guardar essa constatação por horas evita
  // cobrar a espera de novo a cada gravação — eram segundos de tela parada em toda edição,
  // e a impressão de que nada tinha sido salvo.
  const LEMBRAR_FORA_MS = 6 * 60 * 60 * 1000;
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

  // O que o site público realmente mostra. Os demais — contatos, agenda, histórico de ações,
  // usuários e comissão — são do painel, e estavam sendo baixados por TODO visitante junto
  // com o resto. Além do peso, é dado que não deveria sair do painel: a lista de contatos
  // tem telefone e e-mail de quem procurou a corretora.
  const DOCS_PUBLICOS = ['properties', 'site', 'posts', 'testimonials'];
  // O painel abre com login e precisa de tudo; o site público, só do que exibe.
  const noPainel = () => /crm/i.test(location.pathname);
  const docsDaPagina = () => (noPainel() ? DOCS : DOCS_PUBLICOS);

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
      if (!(await garantirStorage())) {
        storageIndisponivel = true;
        return (await guardarNoDocumento(value, dataUrl, cache)) || value;
      }
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
  // Uma referência que já está no banco precisa voltar a ser imagem aqui. Sem isto ela
  // virava vazio na hora de salvar, era descartada, e o bloco era reescrito só com as fotos
  // novas — apagando todas as anteriores. Era o motivo de a logo e as fotos do imóvel
  // sumirem logo depois de uma edição.
  async function refParaDataUrl(v) {
    const doCache = (window.CRMData && window.CRMData.photoURL) ? window.CRMData.photoURL(v) : '';
    if (doCache) return doCache;
    const partes = String(v).slice('fotodoc:'.length).split(':');
    const idx = parseInt(partes.pop(), 10);
    const rotulo = partes.join(':');
    if (!rotulo || isNaN(idx)) return '';
    try {
      const imgs = await lerImagens(rotulo);
      if (imgs && imgs.length && window.CRMData.registrarImagensDoBanco)
        window.CRMData.registrarImagensDoBanco(rotulo, imgs);
      return (imgs && imgs[idx]) || '';
    } catch (e) { return ''; }
  }

  async function paraDataUrl(valor) {
    const v = String(valor || '');
    if (v.indexOf('data:') === 0) return v;
    if (v.indexOf('fotodoc:') === 0) return await refParaDataUrl(v);
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
  // 20 blocos de 600 KB cobrem 50 fotos por imóvel mesmo na qualidade alta (que pede ~16).
  // Com 12, as últimas fotos de uma ficha cheia ficavam de fora.
  const MAX_BLOCOS = 20;
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

    // A escolha de "Qualidade das fotos" no painel manda no tamanho com que elas são
    // guardadas. Antes o valor era fixo e a opção não mudava nada de fato.
    let qualidade = 'equilibrada';
    try { qualidade = (window.CRMData.getSiteContentRaw() || {}).photoQuality || 'equilibrada'; } catch (e) {}
    const perfis = {
      leve:         { cota: 70 * 1024,  etapas: [[900, 0.78], [760, 0.72], [640, 0.66], [520, 0.58]] },
      equilibrada:  { cota: 120 * 1024, etapas: [[1400, 0.82], [1100, 0.76], [900, 0.68], [720, 0.6]] },
      alta:         { cota: 190 * 1024, etapas: [[1920, 0.86], [1600, 0.8], [1300, 0.74], [1000, 0.66]] }
    };
    const perfil = perfis[qualidade] || perfis.equilibrada;
    // Galeria grande aperta um pouco a cota, para a ficha inteira caber.
    const cota = validas.length > 20 ? Math.round(perfil.cota * 0.7) : perfil.cota;
    const etapas = perfil.etapas;

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
    let bytes = 0;
    for (let n = 0; n < blocos.length; n++) {
      try {
        await DOC(nomeBloco(chave, n)).set({ data: blocos[n], updatedAt: Date.now() });
        gravadas += blocos[n].length;
        bytes += blocos[n].reduce((t, f) => t + f.length, 0);
      } catch (e) {
        mediaErrors.push({ path: nomeBloco(chave, n), code: e && (e.code || e.message) });
        break;
      }
    }
    // Blocos de uma gravação anterior que sobraram não podem continuar aparecendo.
    for (let n = blocos.length; n < MAX_BLOCOS; n++) {
      try { await DOC(nomeBloco(chave, n)).delete(); } catch (e) { break; }
    }
    // Anota quanto este conjunto ocupa, para o painel mostrar o espaço real do site e não
    // o do navegador de quem está olhando.
    if (gravadas) {
      try {
        await DOC('uso_fotos').set({ ['c_' + chave]: { fotos: gravadas, bytes: bytes, em: Date.now() } },
                                    { merge: true });
      } catch (e) {}
    }
    return gravadas || null;
  }

  // Um ebook ou um vídeo não cabem num documento: o Firestore para em 1 MB e um PDF passa
  // disso com folga. A gravação inteira era recusada, sem erro visível, e o arquivo
  // continuava só no aparelho de quem enviou — era por isso que o botão do ebook não fazia
  // nada nos outros. Agora o conteúdo é cortado em pedaços, um por documento, e remontado
  // na leitura. Vale para qualquer arquivo, de qualquer tamanho.
  const TETO_PEDACO = 700 * 1024;
  const MAX_PEDACOS = 60;                    // cobre um arquivo de cerca de 40 MB

  async function guardarArquivo(rotulo, dataUrl) {
    await ready;
    if (!firebase.apps.length) return 0;
    const txt = String(dataUrl || '');
    if (txt.indexOf('data:') !== 0) return 0;
    const pedacos = [];
    for (let i = 0; i < txt.length; i += TETO_PEDACO) pedacos.push(txt.slice(i, i + TETO_PEDACO));
    if (!pedacos.length || pedacos.length > MAX_PEDACOS) return 0;

    for (let n = 0; n < pedacos.length; n++) {
      try { await DOC('arq_' + rotulo + '_' + n).set({ data: pedacos[n], updatedAt: Date.now() }); }
      catch (e) { mediaErrors.push({ path: 'arq_' + rotulo + '_' + n, code: e && (e.code || e.message) }); return 0; }
    }
    // A capa do arquivo é gravada por último: até ela existir, uma leitura no meio do
    // caminho não encontra um arquivo pela metade.
    try { await DOC('arq_' + rotulo).set({ partes: pedacos.length, bytes: txt.length, updatedAt: Date.now() }); }
    catch (e) { return 0; }
    for (let n = pedacos.length; n < MAX_PEDACOS; n++) {
      try { await DOC('arq_' + rotulo + '_' + n).delete(); } catch (e) { break; }
    }
    try {
      await DOC('uso_fotos').set({ ['c_' + rotulo]: { fotos: 1, bytes: txt.length, em: Date.now() } },
                                  { merge: true });
    } catch (e) {}
    return pedacos.length;
  }

  async function lerArquivo(rotulo) {
    await ready;
    if (!firebase.apps.length) return '';
    try {
      const capa = await DOC('arq_' + rotulo).get();
      if (!capa.exists) return '';
      const partes = (capa.data() || {}).partes || 0;
      let txt = '';
      for (let i = 0; i < partes; i++) {
        const d = await DOC('arq_' + rotulo + '_' + i).get();
        if (!d.exists) return '';                 // pedaço faltando: melhor nada do que corrompido
        txt += (d.data() || {}).data || '';
      }
      return txt;
    } catch (e) { return ''; }
  }

  // Soma o que está guardado no site inteiro.
  async function usoDeFotos() {
    await ready;
    if (!firebase.apps.length) return null;
    try {
      const snap = await DOC('uso_fotos').get();
      if (!snap.exists) return { fotos: 0, bytes: 0, conjuntos: 0, porChave: {} };
      const d = snap.data() || {};
      let fotos = 0, bytes = 0, conjuntos = 0;
      // porChave permite saber quantas fotos cada conjunto tem — é assim que a verificação
      // do sistema descobre um endereço apontando para um bloco que não existe mais.
      const porChave = {};
      Object.keys(d).forEach(k => {
        if (k.indexOf('c_') !== 0 || !d[k]) return;
        fotos += d[k].fotos || 0; bytes += d[k].bytes || 0; conjuntos++;
        porChave[k.slice(2)] = d[k].fotos || 0;
      });
      return { fotos: fotos, bytes: bytes, conjuntos: conjuntos, porChave: porChave };
    } catch (e) { return null; }
  }

  async function lerImagens(chave) {
    await ready;
    if (!firebase.apps.length) return [];
    // Os blocos eram lidos em fila, cada um esperando o anterior — cinco blocos custavam
    // cinco idas ao banco. Lidos em grupo, custam duas. O grupo para no primeiro bloco que
    // não existe, então uma ficha pequena continua barata.
    const POR_GRUPO = 4;
    const fotos = [];
    for (let base = 0; base < MAX_BLOCOS; base += POR_GRUPO) {
      const lote = [];
      for (let n = base; n < Math.min(base + POR_GRUPO, MAX_BLOCOS); n++) lote.push(DOC(nomeBloco(chave, n)).get());
      let acabou = false;
      try {
        const snaps = await Promise.all(lote);
        for (const snap of snaps) {
          if (!snap.exists) { acabou = true; break; }
          fotos.push(...(snap.data().data || []));
        }
      } catch (e) { acabou = true; }
      if (acabou) break;
    }
    if (fotos.length) return fotos;
    // Fichas gravadas antes da divisão em blocos.
    try {
      const antigo = await DOC('fotos_' + chave).get();
      return antigo.exists ? (antigo.data().data || []) : [];
    } catch (e) { return []; }
  }

  // Troca as referências 'fotodoc:' pelas imagens de verdade, para quem for exibir.
  // As imagens do banco entram no cache de memória; os dados continuam guardando apenas a
  // referência 'fotodoc:'. Antes a referência era trocada pela imagem dentro do próprio
  // dado — e essa versão inchada acabava gravada no navegador (enchendo o armazenamento) e
  // reenviada ao banco por quem não conseguia lê-la (apagando a foto). Guardando só a
  // referência, nenhum dos dois acontece.
  async function carregarParaCache(rotulo) {
    if (!window.CRMData || !window.CRMData.registrarImagensDoBanco) return [];
    const imgs = await lerImagens(rotulo);
    if (imgs.length) window.CRMData.registrarImagensDoBanco(rotulo, imgs);
    return imgs;
  }

  function usaReferencia(v, rotulo) {
    return typeof v === 'string' && v.indexOf('fotodoc:' + rotulo + ':') === 0;
  }


  // Os cards do site usam a miniatura que viaja junto com a ficha, então baixar a galeria
  // inteira de todo imóvel em toda página era trabalho jogado fora: dezenas de idas ao banco
  // para imagens que ninguém ia ver. Aqui entra só quem não tem miniatura e por isso não
  // conseguiria aparecer de outro jeito. A galeria completa e as plantas são buscadas pela
  // página do imóvel, que é onde fazem falta.
  async function hidratarFotos(props) {
    const comRef = (props || []).filter(p => !p.thumb && usaReferencia(p.image, p.id));
    await Promise.all(comRef.map(p => carregarParaCache(p.id)));
    return props;
  }

  // Tudo o que a página de um imóvel precisa: galeria e plantas, só desse imóvel.
  async function hidratarImovel(p) {
    if (!p) return p;
    const tarefas = [];
    if (usaReferencia(p.image, p.id) || (p.images || []).some(i => usaReferencia(i, p.id)))
      tarefas.push(carregarParaCache(p.id));
    if ((p.plantas || []).some(v => typeof v === 'string' && v.indexOf('fotodoc:plantas_' + p.id + ':') === 0))
      tarefas.push(carregarParaCache('plantas_' + p.id));
    await Promise.all(tarefas);
    return p;
  }

  async function hidratarConjunto(alvo, campos, rotulo) {
    const precisa = campos.some(c => usaReferencia(alvo[c], rotulo)) ||
      (Array.isArray(alvo.heroSlides) && alvo.heroSlides.some(v => usaReferencia(v, rotulo)));
    if (precisa) await carregarParaCache(rotulo);
    return alvo;
  }

  async function hidratarLista(lista, campo, rotulo) {
    if ((lista || []).some(x => usaReferencia(x[campo], rotulo))) await carregarParaCache(rotulo);
    return lista;
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
        // Qualquer foto da ficha que não abriu aqui veio de outro aparelho. Regravar
        // renumeraria os blocos e apagaria justamente essa. Deixa a ficha como está.
        if (algumaNaoAbriu) { out.push(q); continue; }
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
    await guardarPlantasEEbooks(out);
    return out;
  }

  // Plantas e ebook iam para o banco como idbphoto:/idbdoc:, que é endereço do banco de
  // mídia do próprio navegador que enviou o arquivo — não existe em nenhum outro aparelho.
  // Era por isso que o botão "Plantas" sumia no celular e o ebook não abria: a ficha
  // apontava para um arquivo que só existia no computador de quem cadastrou.
  async function guardarPlantasEEbooks(lista) {
    const local = (v) => typeof v === 'string' && (/^idb/.test(v) || v.indexOf('data:') === 0);
    for (const q of lista) {
      if (Array.isArray(q.plantas) && q.plantas.some(local)) {
        const rotulo = 'plantas_' + q.id;
        const jaNoBanco = (v) => typeof v === 'string' && v.indexOf('fotodoc:' + rotulo + ':') === 0;
        const dados = [];
        let faltou = false;
        for (const v of q.plantas) {
          const d = await paraDataUrl(v);
          if (!d && jaNoBanco(v)) faltou = true;
          dados.push(d || '');
        }
        // Planta já guardada que não abre aqui: regravar renumeraria os blocos e a apagaria.
        if (!faltou) {
          let gravadas = 0;
          try { gravadas = await guardarImagens(rotulo, dados.filter(Boolean)) || 0; }
          catch (e) { mediaErrors.push({ path: 'fotos_' + rotulo, code: e && (e.code || e.message) }); }
          if (gravadas) q.plantas = Array.from({ length: gravadas }, (_, i) => 'fotodoc:' + rotulo + ':' + i);
        }
      }

      if (q.ebookUrl && local(q.ebookUrl)) {
        const rotulo = 'ebook_' + q.id;
        let arq = '';
        try { arq = window.CRMData.getDocDataURL ? await window.CRMData.getDocDataURL(q.ebookUrl) : ''; }
        catch (e) {}
        if (arq && await guardarArquivo(rotulo, arq)) q.ebookUrl = 'arqdoc:' + rotulo;
      }

      // O vídeo do imóvel tinha o mesmo destino do ebook: sem o Storage, ficava preso ao
      // aparelho. Vai pelos mesmos pedaços.
      if (q.videoFile && local(q.videoFile)) {
        const rotulo = 'video_' + q.id;
        let arq = '';
        try { arq = window.CRMData.getMediaRaw ? await window.CRMData.getMediaRaw(q.videoFile) : ''; }
        catch (e) {}
        if (arq && await guardarArquivo(rotulo, arq)) q.videoFile = 'arqdoc:' + rotulo;
      }
    }
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
    const jaNoBanco = (v) => typeof v === 'string' && v.indexOf('fotodoc:site:') === 0;
    // O conjunto do site é reescrito por inteiro. Levar só a imagem nova fazia o bloco 0 ser
    // regravado com ela sozinha: a logo, o favicon e a do rodapé perdiam o endereço de uma
    // vez. Era o motivo de trocar uma logo derrubar as outras.
    const pendentes = [];
    let temNovidade = false;
    const anotar = (alvo, v) => {
      if (local(v)) { temNovidade = true; pendentes.push(alvo); }
      else if (jaNoBanco(v)) pendentes.push(alvo);
    };
    CAMPOS_DE_IMAGEM.forEach(k => anotar({ campo: k }, out[k]));
    (Array.isArray(out.heroSlides) ? out.heroSlides : []).forEach((v, i) => anotar({ slide: i }, v));

    if (temNovidade) {
      // Sonda o Storage com uma imagem nova; recusado, todas vão para os blocos do site.
      const nova = pendentes.find(a => local(a.campo ? out[a.campo] : out.heroSlides[a.slide]));
      const primeira = nova.campo ? out[nova.campo] : out.heroSlides[nova.slide];
      if (!storageIndisponivel && !storageMarcadoFora()) await externalizeMedia(primeira, 'site', cache);

      if (storageIndisponivel || storageMarcadoFora()) {
        const dados = [];
        let faltou = false;
        for (const alvo of pendentes) {
          const valor = alvo.campo ? out[alvo.campo] : out.heroSlides[alvo.slide];
          const d = await paraDataUrl(valor);
          if (!d && jaNoBanco(valor)) faltou = true;   // imagem antiga ilegível aqui
          dados.push(d || '');
        }
        // Não deu para ler alguma que já estava guardada? Regravar renumeraria os blocos e a
        // apagaria. Melhor não mexer: a nova continua neste navegador para a próxima vez.
        if (!faltou) {
          let gravadas = 0;
          try { gravadas = await guardarImagens('site', dados.filter(Boolean)) || 0; }
          catch (e) { mediaErrors.push({ path: 'fotos_site', code: e && (e.code || e.message) }); }
          if (gravadas) {
            let idx = 0;
            pendentes.forEach((alvo, i) => {
              if (!dados[i] || idx >= gravadas) return;
              const ref = 'fotodoc:site:' + idx;
              if (alvo.campo) out[alvo.campo] = ref; else out.heroSlides[alvo.slide] = ref;
              idx++;
            });
            // Uma prévia minúscula da primeira capa viaja junto com o conteúdo do site, e não
            // como referência. Ela pinta no mesmo instante em que a página abre, antes de a
            // foto cheia chegar do banco. Sem ela a capa fica vazia por um momento a cada
            // recarga — e era esse vão que o site preenchia com a foto de um imóvel.
            const primeiraCapa = pendentes.findIndex(a => a.slide === 0);
            const base = primeiraCapa >= 0 ? dados[primeiraCapa] : null;
            if (base && window.CRMData && window.CRMData.resizeDataUrl) {
              // A prévia era de 96px: pintava na hora, mas pequena demais para valer como a
              // maior pintura da tela. A medição então esperava a foto cheia chegar do banco
              // — cinco segundos e meio — e contava aquilo. Numa largura de verdade ela cobre
              // a capa inteira já na primeira pintura, e é ela que a medição conta.
              // Vai descendo a qualidade até caber no armazenamento do navegador, que
              // descarta o que passa de 44 KB — e sem caber lá ela não estaria em mãos na
              // abertura, que é exatamente quando serve.
              for (const [larg, q] of [[820, 0.5], [820, 0.4], [640, 0.42], [520, 0.4], [96, 0.5]]) {
                try {
                  const previa = await window.CRMData.resizeDataUrl(base, larg, q);
                  if (previa && previa.length < 38 * 1024) { out.heroPreview = previa; break; }
                } catch (e) {}
              }
            }
          }
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
    const jaNoBanco = (v) => typeof v === 'string' && v.indexOf('fotodoc:' + rotulo + ':') === 0;
    // Reescreve o conjunto inteiro: mandar só a imagem nova regravava o bloco 0 com ela
    // sozinha e as outras do blog perdiam o endereço.
    const pendentes = out.filter(q => local(q[key]) || jaNoBanco(q[key]));
    const temNovidade = out.some(q => local(q[key]));

    if (temNovidade && rotulo) {
      const nova = pendentes.find(q => local(q[key]));
      if (!storageIndisponivel && !storageMarcadoFora()) await externalizeMedia(nova[key], 'midia', cache);
      if (storageIndisponivel || storageMarcadoFora()) {
        const dados = [];
        let faltou = false;
        for (const q of pendentes) {
          const d = await paraDataUrl(q[key]) || '';
          if (!d && jaNoBanco(q[key])) faltou = true;
          dados.push(d);
        }
        if (!faltou) {
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
    }

    for (const q of out) {
      if (local(q[key])) q[key] = await externalizeMedia(q[key], 'midia', cache);
    }
    return out;
  }

  // Anexos de contato seguiam crus para o banco: um PDF ou uma foto de 200 KB ia inteiro
  // dentro do documento de contatos, que tem 1 MB no total. Alguns anexos e os contatos
  // parariam de salvar. Pior: o navegador guarda esse anexo vazio, e a gravação seguinte
  // mandava o vazio de volta, apagando o arquivo. Agora vão para blocos, como as fotos.
  async function externalizeLeads(list) {
    const out = (list || []).map(l => ({ ...l, attachments: (l.attachments || []).map(a => ({ ...a })) }));
    const pesado = (v) => typeof v === 'string' && (v.indexOf('data:') === 0 || /^idb/.test(v));
    const jaNoBanco = (v) => typeof v === 'string' && v.indexOf('fotodoc:leads:') === 0;
    const pendentes = [];
    let temNovidade = false;
    out.forEach(l => (l.attachments || []).forEach(a => {
      if (pesado(a.url)) { temNovidade = true; pendentes.push(a); }
      else if (jaNoBanco(a.url)) pendentes.push(a);
    }));
    if (!temNovidade) return out;

    const dados = [];
    let faltou = false;
    for (const a of pendentes) {
      const d = await paraDataUrl(a.url) || '';
      if (!d && jaNoBanco(a.url)) faltou = true;
      dados.push(d);
    }
    if (faltou) return out;      // anexo antigo ilegível aqui: não regrava, para não perdê-lo

    let gravadas = 0;
    try { gravadas = await guardarImagens('leads', dados.filter(Boolean)) || 0; }
    catch (e) { mediaErrors.push({ path: 'fotos_leads', code: e && (e.code || e.message) }); }

    let idx = 0;
    for (let i = 0; i < pendentes.length && idx < gravadas; i++) {
      if (!dados[i]) continue;
      pendentes[i].url = 'fotodoc:leads:' + idx;
      idx++;
    }
    return out;
  }

  // Traz os anexos do banco para o cache de memória, para photoURL resolvê-los.
  async function hidratarAnexos(lista) {
    const usa = (lista || []).some(l => (l.attachments || [])
      .some(a => typeof a.url === 'string' && a.url.indexOf('fotodoc:leads:') === 0));
    if (usa) await carregarParaCache('leads');
    return lista;
  }

  // Cliques nos botões. Um documento por mês, e dentro dele um mapa por dia — é o dia que
  // permite ao painel usar o mesmo filtro de período dos acessos (hoje, 7 dias, 30 dias).
  // A soma é feita com increment: dois visitantes clicando ao mesmo tempo não sobrescrevem
  // a conta um do outro, porque quem soma é o banco e não o navegador.
  function diaHoje() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
           '-' + String(d.getDate()).padStart(2, '0');
  }

  async function somarCliques(lote) {
    await ready;
    if (!firebase.apps.length || !lote) return false;
    const campos = {};
    Object.keys(lote).forEach(k => {
      // Chave de mapa no Firestore não aceita estes caracteres nem começar com dois traços
      // baixos; um nome assim faria a gravação inteira ser recusada.
      const nome = String(k).replace(/[.\/\[\]*`~]/g, '-').replace(/^__+/, '');
      if (!nome || !lote[k]) return;
      campos[nome] = firebase.firestore.FieldValue.increment(lote[k]);
    });
    if (!Object.keys(campos).length) return false;
    const dia = diaHoje();
    await DOC('cliques_' + dia.slice(0, 7)).set({ dias: { [dia]: campos } }, { merge: true });
    return true;
  }

  // Devolve os cliques abertos por dia, para o painel filtrar pelo período escolhido do
  // mesmo jeito que já filtra os acessos.
  async function lerCliques(meses) {
    await ready;
    if (!firebase.apps.length) return [];
    // Sem repetir: o mesmo mês pedido duas vezes contaria os cliques duas vezes.
    const alvos = Array.from(new Set(meses && meses.length ? meses : [diaHoje().slice(0, 7)]));
    const linhas = [];
    for (const m of alvos) {
      try {
        const snap = await DOC('cliques_' + m).get();
        if (!snap.exists) continue;
        const dias = (snap.data() || {}).dias || {};
        Object.keys(dias).forEach(dia => {
          const porBotao = dias[dia] || {};
          Object.keys(porBotao).forEach(nome => {
            const n = porBotao[nome];
            if (typeof n === 'number' && n > 0) linhas.push({ dia: dia, nome: nome, cliques: n });
          });
        });
      } catch (e) {}
    }
    return linhas;
  }

  // O áudio de um depoimento tem alguns minutos e passa fácil do que cabe num documento
  // (1 MB). Ia pelo caminho das fotos, que grava num documento só: acima de ~700 KB a
  // gravação era recusada em silêncio e o áudio ficava apenas no navegador de quem enviou
  // — o depoimento parecia perder o áudio sozinho. Vai pelos mesmos pedaços do ebook, que
  // não têm esse teto.
  async function externalizeTestimonials(lista) {
    const out = (lista || []).map(t => ({ ...t }));
    const local = (v) => typeof v === 'string' && (/^idb/.test(v) || v.indexOf('data:') === 0);
    for (const t of out) {
      if (!local(t.audioUrl)) continue;
      let arq = '';
      try {
        arq = t.audioUrl.indexOf('data:') === 0
          ? t.audioUrl
          : (window.CRMData.getMediaRaw ? await window.CRMData.getMediaRaw(t.audioUrl) : '');
      } catch (e) {}
      if (!arq) continue;                       // não está neste aparelho: deixa como está
      const rotulo = 'audio_' + t.id;
      if (await guardarArquivo(rotulo, arq)) t.audioUrl = 'arqdoc:' + rotulo;
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
    // Só o que esta página mostra. Ver DOCS_PUBLICOS.
    await Promise.all(docsDaPagina().map(name => DOC(name).get().then(snap => {
      out[name] = snap.exists ? snap.data().data : undefined;
    }).catch(() => {})));
    // Fichas que apontam para o documento de fotos recebem as imagens de volta aqui, para
    // quem lê não precisar saber onde elas ficaram guardadas.
    if (Array.isArray(out.properties)) {
      try { await hidratarFotos(out.properties); } catch (e) {}
    }
    if (out.site) {
      try { await hidratarConjunto(out.site, CAMPOS_DE_IMAGEM, 'site'); } catch (e) {}
      try { await hidratarAnexos(out.leads); } catch (e) {}
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
      docsDaPagina().forEach(name => DOC(name).onSnapshot(snap => {
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
        if (name === 'leads' && Array.isArray(dados)) {
          hidratarAnexos(dados).then(() => onChange(name, dados)).catch(() => onChange(name, dados));
          return;
        }
        onChange(name, dados);
      }, () => {}));
    });
  }

  // Contatos recebidos pelo site. Ficam fora de DOCS de propósito: o pacote que todo
  // visitante baixa não precisa carregar a carteira de clientes junto.
  async function saveLeads(arr) {
    const out = await externalizeLeads(arr);
    return save('leads', out);
  }
  async function fetchLeads() {
    const ok = await ready;
    if (!ok || !firebase.apps.length) return null;
    return DOC('leads').get()
      .then(s => (s.exists ? (s.data().data || []) : []))
      .then(l => hidratarAnexos(l).then(() => l))
      .catch(() => null);
  }
  // Acrescenta um contato lendo a lista no instante da gravação — dois envios ao mesmo tempo
  // não se sobrescrevem, como aconteceria se a lista viesse do navegador.
  async function appendLead(lead) {
    const ok = await ready;
    if (!ok || !firebase.apps.length) return false;
    const ref = DOC('leads');
    const juntar = (cur) => {
      const lista = Array.isArray(cur) ? cur : [];
      const id = lista.reduce((m, l) => Math.max(m, Number(l.id) || 0), 0) + 1;
      return [{ ...lead, id }, ...lista];
    };

    // A transação é o caminho certo: lê e grava numa operação só, então dois envios ao
    // mesmo tempo não se atropelam. Mas ela exige ida ao servidor e pode ser recusada —
    // observado aqui com o documento sendo escutado por vários aparelhos ao mesmo tempo.
    try {
      const feito = await firebase.firestore().runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        tx.set(ref, { data: juntar(snap.exists ? snap.data().data : []), updatedAt: Date.now() });
        return true;
      });
      if (feito) return true;
    } catch (e) { /* segue para o caminho abaixo */ }

    // Recusada: lê e grava em dois passos. Dois envios no mesmo instante poderiam se
    // sobrepor — risco pequeno num formulário de contato, e muito menor do que perder o
    // contato de quem procurou a corretora.
    try {
      const snap = await ref.get({ source: 'server' });
      await ref.set({ data: juntar(snap.exists ? snap.data().data : []), updatedAt: Date.now() });
      return true;
    } catch (e) { return false; }
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
    // Áudio vai pelos pedaços (sem teto de tamanho); o caminho antigo continua valendo
    // para o que já está guardado como fotodoc:depoimentos.
    saveTestimonials: (arr) => externalizeTestimonials(arr).then(out => save('testimonials', out)),
    // Gravação genérica, para as chaves que não precisam de tratamento de mídia.
    saveDoc: (nome, dados) => save(nome, dados),
    mediaErrors: () => mediaErrors.slice(),
    guardarImagens: guardarImagens,
    usoDeFotos: usoDeFotos,
    lerImagens: lerImagens,
    // O painel precisa saber se o Storage responde para decidir o que aceitar de vídeo.
    storageAtivo: () => !storageIndisponivel && !storageMarcadoFora(),
    guardarArquivo: guardarArquivo,
    lerArquivo: lerArquivo,
    hidratarFotos: hidratarFotos,
    hidratarImovel: hidratarImovel,
    fetchAll: fetchAll,
    DOCS_PUBLICOS: DOCS_PUBLICOS,
    watch: watch,
    logPageview: logPageview,
    somarCliques: somarCliques,
    lerCliques: lerCliques,
    fetchAnalytics: fetchAnalytics,
    watchAnalytics: watchAnalytics
  };
})();
