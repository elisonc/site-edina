// Shared fictitious "database" for the Edina Oliveira demo site, backed by localStorage.
// Every page (public site + CRM) reads/writes through this so edits made in the CRM
// (properties, blog posts, testimonials, site content, auth) and leads captured on the
// public site stay in sync. NOTE: this is a front-end only prototype — "persistence" is
// per-browser (localStorage), not a real shared server database.
(function () {
  // Guarda de reentrada: este arquivo pode ser injetado mais de uma vez no ciclo de vida da
  // página. Sem isso, a segunda execução substituía window.CRMData por um objeto novo — e o
  // cache de fotos já carregado do banco de mídia era perdido, deixando as imagens vazias.
  if (window.CRMData) return;
  const LS = {
    // v7: os 20 imóveis de exemplo saíram do ar e deram lugar ao portfólio real. A versão da
    // chave sobe junto para que navegadores que já tinham o catálogo antigo salvo o descartem
    // sozinhos — sem isso o localStorage vence o arquivo novo e a lista velha nunca sai.
    properties: 'edina_db_properties_v7',
    leads: 'edina_db_leads_v2',
    posts: 'edina_db_posts',
    testimonials: 'edina_db_testimonials_v3',
    integrations: 'edina_db_integrations',
    site: 'edina_db_site_content_v2',
    auth: 'edina_db_auth_v2',
    session: 'edina_db_session_v2',
    visits: 'edina_db_visits',
    analytics: 'edina_db_analytics_v1',
    history: 'edina_db_history_v1',
    syncHistory: 'edina_db_sync_history_v1'
  };

  const MAX_PROPERTIES = 50;
  const MAX_PROPERTIES_PRO = 100;
  const MAX_POSTS = 50;
  const MAX_POSTS_PRO = 100;
  const STORAGE_BUDGET_DEFAULT = 2 * 1024 * 1024 * 1024;
  const STORAGE_BUDGET_PRO = 5 * 1024 * 1024 * 1024;
  const PRO_UNLOCK_CODE = 'EDINA-PRO-100';

  // O catálogo real mora no banco (Firestore) e é editado pelo CRM: apagar um imóvel lá
  // tira ele do site, cadastrar põe de volta. Esta lista fica vazia de propósito — se
  // trouxesse os empreendimentos de volta, todo imóvel excluído reapareceria sozinho no
  // primeiro acesso de quem ainda não tem nada guardado.
  const seedProperties = [];

  const seedLeads = [
    { id: 1, name: "Ricardo Bastos", phone: "(11) 98888-1010", email: "ricardo.b@email.com", interest: "Cobertura Duplex Vista Mar", stage: "proposta", value: 6800000, channel: "Instagram", date: "18 Jun 2026", status: "aberto", assignedTo: "Elisoncf", timeline: [], attachments: [], offeredProperties: [] },
    { id: 2, name: "Camila Fontoura", phone: "(47) 99123-2020", email: "camila.f@email.com", interest: "Apartamento Beira-Mar", stage: "visita", value: 4200000, channel: "Indicação", date: "20 Jun 2026", status: "aberto", assignedTo: "gerente", timeline: [], attachments: [], offeredProperties: [] },
    { id: 3, name: "João Pedro Alves", phone: "(21) 97654-3030", email: "jp.alves@email.com", interest: "Casa em Condomínio", stage: "novo", value: 3100000, channel: "Site", date: "27 Jun 2026", status: "aberto", assignedTo: "corretor", timeline: [], attachments: [], offeredProperties: [] },
    { id: 4, name: "Fernanda Lacerda", phone: "(41) 96543-4040", email: "fe.lacerda@email.com", interest: "Studio Frente Mar", stage: "contato", value: 1450000, channel: "WhatsApp", date: "25 Jun 2026", status: "aberto", assignedTo: "Elisoncf", timeline: [], attachments: [], offeredProperties: [] },
    { id: 5, name: "Marcelo Tavares", phone: "(11) 95432-5050", email: "m.tavares@email.com", interest: "Cobertura Panorâmica", stage: "fechado", value: 5500000, channel: "Indicação", date: "02 Jun 2026", status: "ganho", assignedTo: "gerente", timeline: [], attachments: [], offeredProperties: [] },
    { id: 6, name: "Ana Beatriz Souza", phone: "(48) 94321-6060", email: "ana.souza@email.com", interest: "Apartamento Garden", stage: "contato", value: 2700000, channel: "Instagram", date: "24 Jun 2026", status: "aberto", assignedTo: "corretor", timeline: [], attachments: [], offeredProperties: [] },
    { id: 7, name: "Diego Herrera", phone: "(51) 93210-7070", email: "diego.h@email.com", interest: "Casa de Praia Assinada", stage: "proposta", value: 7900000, channel: "Facebook Ads", date: "19 Jun 2026", status: "aberto", assignedTo: "Elisoncf", timeline: [], attachments: [], offeredProperties: [] },
    { id: 8, name: "Larissa Prado", phone: "(47) 92109-8080", email: "larissa.p@email.com", interest: "Flat Mobiliado", stage: "novo", value: 980000, channel: "Facebook Ads", date: "28 Jun 2026", status: "aberto", assignedTo: "gerente", timeline: [], attachments: [], offeredProperties: [] },
    { id: 9, name: "Bruno Castilho", phone: "(19) 91098-9090", email: "bruno.c@email.com", interest: "Cobertura Duplex Vista Mar", stage: "visita", value: 6800000, channel: "Google Ads", date: "21 Jun 2026", status: "aberto", assignedTo: "corretor", timeline: [], attachments: [], offeredProperties: [] },
    { id: 10, name: "Patrícia Nunes", phone: "(31) 90987-1212", email: "patricia.n@email.com", interest: "Casa em Condomínio", stage: "fechado", value: 3100000, channel: "Site", date: "30 Mai 2026", status: "ganho", assignedTo: "Elisoncf", timeline: [], attachments: [], offeredProperties: [] },
    { id: 11, name: "Alexandre Dias", phone: "(47) 99988-1313", email: "alex.dias@email.com", interest: "Apartamento Beira-Mar", stage: "novo", value: 4200000, channel: "Google Ads", date: "29 Jun 2026", status: "aberto", assignedTo: "gerente", timeline: [], attachments: [], offeredProperties: [] },
    { id: 12, name: "Vitória Ramos", phone: "(11) 98877-1414", email: "vitoria.r@email.com", interest: "Studio Frente Mar", stage: "contato", value: 1450000, channel: "Instagram", date: "26 Jun 2026", status: "aberto", assignedTo: "corretor", timeline: [], attachments: [], offeredProperties: [] }
  ];

  const seedPosts = [
    { id: 1, title: "Mercado de alto padrão em Balneário Camboriú bate recorde em 2026", cat: "Mercado", date: "22 Jun 2026", read: "6 min", tone: 0, status: "publicado", excerpt: "Valorização média de imóveis frente-mar acelera puxada pela demanda de compradores de outros estados.", body: "O primeiro semestre de 2026 consolidou Balneário Camboriú como um dos mercados de alto padrão que mais cresce no país.\n\nCorretores da região relatam aumento expressivo na procura por unidades frente-mar, especialmente entre compradores vindos de São Paulo e do Rio Grande do Sul.\n\nEntre os fatores que explicam o movimento estão a infraestrutura urbana recente, a chegada de novos empreendimentos assinados e a percepção de segurança da região.\n\nPara quem pensa em investir, o momento pede atenção: imóveis com metragem generosa e vista desobstruída têm apresentado a valorização mais consistente." },
    { id: 2, title: "5 bairros que mais valorizaram no litoral catarinense", cat: "Mercado", date: "14 Jun 2026", read: "5 min", tone: 1, status: "publicado", excerpt: "Um raio-x das regiões com maior potencial de valorização nos próximos anos.", body: "Analisamos a evolução de preços em cinco regiões do litoral catarinense nos últimos 24 meses.\n\nPraia Brava, em Itajaí, segue na liderança, impulsionada pela chegada de empreendimentos de altíssimo padrão e por sua proximidade com áreas de preservação.\n\nNavegantes surge como alternativa para quem busca metragens maiores por um custo relativamente menor, mantendo acesso rápido à praia e à marina.\n\nA recomendação para compradores é olhar não apenas o preço atual, mas o ritmo de novos lançamentos na região." },
    { id: 3, title: "Como avaliar corretamente um imóvel de luxo", cat: "Guia", date: "02 Jun 2026", read: "7 min", tone: 2, status: "publicado", excerpt: "Os critérios que realmente pesam na precificação de imóveis de alto padrão.", body: "Avaliar um imóvel de alto padrão vai muito além do valor por metro quadrado.\n\nFatores como vista, orientação solar, qualidade de acabamento, área de lazer do condomínio e histórico de manutenção do prédio pesam diretamente no valor final.\n\nTambém é fundamental considerar a liquidez da região — imóveis muito acima da média do bairro podem levar mais tempo para serem vendidos.\n\nContar com uma avaliação profissional evita tanto a subvalorização quanto expectativas de preço fora da realidade do mercado." },
    { id: 4, title: "Tendências de arquitetura em coberturas frente-mar", cat: "Estilo", date: "25 Mai 2026", read: "4 min", tone: 0, status: "publicado", excerpt: "O que os projetos mais recentes revelam sobre o futuro do morar de luxo.", body: "As coberturas mais recentes do litoral catarinense têm priorizado integração total entre ambientes internos e externos.\n\nPiscinas de borda infinita, pé-direito duplo e fachadas de vidro são hoje praticamente um padrão nos projetos de alto padrão.\n\nTambém cresce a demanda por espaços de bem-estar dentro da própria unidade — saunas, academias privativas e spas compactos.\n\nA tendência reforça que, no segmento de luxo, a experiência dentro de casa importa tanto quanto a vista." },
    { id: 5, title: "Investir em imóveis de praia: o que considerar antes de comprar", cat: "Investimento", date: "11 Mai 2026", read: "8 min", tone: 1, status: "publicado", excerpt: "Liquidez, sazonalidade e gestão — o que avaliar antes de fechar negócio.", body: "Imóveis de praia têm uma dinâmica própria de rentabilidade, marcada pela sazonalidade.\n\nAntes de comprar para investimento, é importante entender a diferença entre valorização patrimonial e retorno com locação por temporada.\n\nRegiões com forte calendário de eventos e boa infraestrutura de serviços tendem a sustentar taxas de ocupação mais altas fora da alta temporada.\n\nBuscar uma gestão profissional da locação também faz diferença relevante no resultado final do investimento." },
    { id: 6, title: "Bastidores: tour pela cobertura duplex da Praia Brava", cat: "Tour", date: "29 Abr 2026", read: "3 min", tone: 2, status: "publicado", excerpt: "Um passeio por um dos imóveis mais exclusivos do portfólio.", body: "Neste artigo, mostramos os bastidores de uma das coberturas mais exclusivas do nosso portfólio atual.\n\nO imóvel conta com 320 m², terraço com piscina privativa e vista frontal para o mar da Praia Brava.\n\nCada ambiente foi pensado para equilibrar amplitude e conforto, com destaque para a suíte master com closet duplo.\n\nInteressados podem agendar uma visita guiada diretamente pelo WhatsApp." },
    { id: 7, title: "Guia de financiamento para imóveis acima de R$ 5 milhões", cat: "Guia", date: "—", read: "5 min", tone: 1, status: "rascunho", excerpt: "O que muda no financiamento de imóveis de altíssimo padrão.", body: "Rascunho em elaboração." }
  ];

  const seedTestimonials = [
    { id: 1, name: "Beatriz e Rodrigo Lemos", role: "Compraram a Cobertura Duplex Vista Mar", tone: 0, text: "A Edina entendeu exatamente o que buscávamos e nos apresentou o imóvel certo já na segunda visita. Todo o processo foi transparente, do primeiro contato à assinatura.", audioUrl: "" },
    { id: 2, name: "Otávio Meireles", role: "Vendeu um apartamento em Camboriú", tone: 1, text: "Profissionalismo raro no mercado. A negociação foi conduzida com muita clareza e o imóvel foi vendido pelo valor que esperávamos, dentro do prazo combinado.", audioUrl: "" },
    { id: 3, name: "Renata Colombo", role: "Comprou a Casa em Condomínio Fechado", tone: 2, text: "Buscávamos uma casa para a família há mais de um ano. A Edina trouxe opções que realmente faziam sentido para nós, sem pressa e sem pressão.", audioUrl: "" }
  ];

  const seedSiteContent = {
    logoUrl: "",
    faviconUrl: "",
    // Arquivo versionado junto com o site: a assinatura aparece para qualquer visitante desde
    // a primeira visita, sem depender do que estiver salvo no navegador de quem administra.
    signatureUrl: "assinatura-ink.png",
    heroLabel: "Navegantes · Itajaí · Camboriú · Praia Brava",
    heroTitle: "Bem-vindos ao litoral de alto padrão",
    heroSubtitle: "Os melhores imóveis de alto padrão em Navegantes, Itajaí, Camboriú e Praia Brava, selecionados para quem busca vista, exclusividade e conforto.",
    heroImage: "",
    metaTitle: "Edina Oliveira — Imóveis de Alto Padrão",
    metaDescription: "Edina Oliveira — Imóveis de Alto Padrão em Navegantes, Itajaí, Balneário Camboriú e Praia Brava",
    metaKeywords: "imóveis de alto padrão, litoral catarinense, casas de praia, coberturas balneário camboriú, corretora de imóveis itajaí",
    brandName: "Edina Oliveira",
    phone: "(47) 9788-6202",
    whatsapp: "554797886202",
    contactMode: "whatsapp",
    contactLink: "",
    email: "contato@edinaoliveira.com.br",
    address: "Av. Atlântica, 1200 — Praia Brava, Itajaí/SC",
    creci: "CRECI 00.000-F",
    logoWidth: 210,
    footerLogoUrl: "", footerLogoWidth: 170,
    statYears: "+12 anos", statSold: "+180", statRating: "4.9/5", statFamilies: "+950",
    servicesEyebrow: "Como Podemos Ajudar", servicesTitle: "Serviços Especializados",
    watermarkOpacity: 0.32,
    footerTagline: "Os melhores imóveis de alto padrão no litoral de Santa Catarina, em um só lugar.",
    // Texto livre do canto direito do rodapé, editável em Conteúdo do Site. Vazio = nada aparece.
    footerNote: "",
    theme: {
      accent: "#c1664a",
      tan: "#c4a886",
      cream: "#f6f3ec",
      bgAlt: "#ece5d6",
      olive: "#8a9463",
      blue: "#6e93ac",
      stone: "#cfc7b8",
      ink: "#241f18",
      headerBg: "#f6f3ec",
      footerBg: "#ece5d6"
    }
  };

  // O conteúdo do site guardado no navegador foi gravado por uma versão anterior e não conhece
  // os campos criados depois. Sem completar o que falta pelo padrão, todo campo novo nasce
  // vazio para quem já usou o site — foi o que fazia a assinatura sumir. Só preenche buraco:
  // o que a Edina escreveu continua valendo.
  function withSiteDefaults(saved) {
    const sc = { ...seedSiteContent, ...(saved || {}) };
    sc.theme = { ...seedSiteContent.theme, ...((saved || {}).theme || {}) };
    // Imagem de marca em branco significa "usa a que vem com o site", não "não mostra nada".
    ['signatureUrl'].forEach(k => { if (!sc[k]) sc[k] = seedSiteContent[k]; });
    return sc;
  }

  const seedVisits = [
    { id: 1, lead: "Camila Fontoura", property: "Apartamento Beira-Mar", date: "2026-07-02", time: "10:00", done: false },
    { id: 2, lead: "Bruno Castilho", property: "Cobertura Duplex Vista Mar", date: "2026-07-02", time: "15:30", done: false },
    { id: 3, lead: "Diego Herrera", property: "Casa de Praia Assinada", date: "2026-07-03", time: "11:00", done: false },
    { id: 4, lead: "Fernanda Lacerda", property: "Studio Frente Mar", date: "2026-07-01", time: "09:00", done: true },
    { id: 5, lead: "Ana Beatriz Souza", property: "Apartamento Garden", date: "2026-07-04", time: "14:00", done: false }
  ];

  const seedAuth = {
    users: [
      { id: 1, name: "Elison Crestani", username: "Elisoncf", email: "elisoncrestani@gmail.com", password: "123456", role: "master", active: true },
      { id: 2, name: "Edina Oliveira", username: "EdinaOliveira", email: "", password: "EdinaOliveira", role: "master", active: true },
      { id: 3, name: "Gerente Geral", username: "gerente", email: "gerente@edinaoliveira.com.br", password: "123456", role: "gerente", active: true },
      { id: 4, name: "Corretor Parceiro", username: "corretor", email: "corretor@edinaoliveira.com.br", password: "123456", role: "corretor", active: true }
    ]
  };

  // Role permission map — checked by the CRM UI to show/hide tabs and edit controls.
  // master: acesso total. gerente: opera o dia a dia (leads, imóveis, blog, depoimentos,
  // agenda) mas não vê integrações/API nem gerencia usuários. corretor: acesso restrito —
  // só visualiza imóveis e atende leads pelo kanban/lista/agenda, sem editar cadastro.
  const ROLE_PERMISSIONS = {
    master: { dashboard: true, kanban: true, leads: true, leadsExport: true, properties: true, propertiesEdit: true, blog: true, blogEdit: true, testimonials: true, testimonialsEdit: true, integrations: true, agenda: true, site: true, users: true, settings: true, values: true },
    gerente: { dashboard: true, kanban: true, leads: true, leadsExport: true, properties: true, propertiesEdit: true, blog: true, blogEdit: true, testimonials: true, testimonialsEdit: true, integrations: false, agenda: true, site: false, users: true, settings: true, values: false },
    corretor: { dashboard: true, kanban: true, leads: true, leadsExport: false, properties: true, propertiesEdit: false, blog: true, blogEdit: false, testimonials: false, testimonialsEdit: false, integrations: false, agenda: true, site: false, users: false, settings: true, values: false }
  };

  function dataUrlToBlob(url) {
    const m = /^data:([^;,]*)(;base64)?,(.*)$/.exec(url || '');
    if (!m) return new Blob([]);
    const type = m[1] || 'application/octet-stream';
    if (!m[2]) return new Blob([decodeURIComponent(m[3])], { type });
    const bin = atob(m[3]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type });
  }

  // ---- Dados publicados ----
  // O CRM salva no navegador de quem edita (localStorage), que é privado por definição. Para
  // o conteúdo aparecer para TODOS os visitantes, o CRM gera data/site-data.json e as pastas
  // de mídia; subidos com o site, eles passam a ser o padrão de qualquer navegador.
  let published = null;

  // Cache local do conteúdo publicado. Na primeira visita o site precisa esperar a rede; nas
  // seguintes ele pinta na hora com a última versão conhecida e só depois confere no servidor
  // se saiu coisa nova (e aí atualiza a tela). É o que faz o carregamento parecer instantâneo.
  const PUB_CACHE = 'edina_pub_cache_v2';
  let revalidating = false;

  function primeFromCache() {
    if (published) return;
    // No navegador de quem administra o conteúdo, o que vale é o que está sendo editado aqui
    // e agora (inclusive fotos recém-enviadas). O retrato guardado do site publicado só serve
    // para visitantes — usá-lo aqui faria imóveis novos aparecerem com foto de exemplo.
    try {
      if (localStorage.getItem('edina_local_edits') === '1') return;
      const raw = localStorage.getItem(PUB_CACHE);
      if (raw) published = JSON.parse(raw);
    } catch (e) {}
  }
  function storeCache(d) {
    try { localStorage.setItem(PUB_CACHE, JSON.stringify(d)); } catch (e) {}
  }

  function fetchPublished() {
    if (window.FirebaseDB && window.FirebaseDB.enabled) {
      return window.FirebaseDB.fetchAll().then(d => d || {});
    }
    return fetch('./data/site-data.json')
      .then(r => r.ok ? r.json() : null)
      .then(d => d || {})
      .catch(() => null);
  }

  function revalidate() {
    if (revalidating) return;
    revalidating = true;
    fetchPublished().then(d => {
      revalidating = false;
      if (!d) return;
      const next = JSON.stringify(d);
      if (next === JSON.stringify(published || {})) return;
      published = d;
      storeCache(d);
      // Conteúdo novo chegou depois da primeira pintura — avisa a página para redesenhar.
      try { window.dispatchEvent(new CustomEvent('edina:published-updated')); } catch (e) {}
    }).catch(() => { revalidating = false; });
  }

  function loadPublished() {
    primeFromCache();

  // Escuta o banco em tempo real: publicou de um aparelho, as abas abertas em qualquer outro
  // se atualizam sozinhas. Sem isso a tela só mudava quando a pessoa recarregava a página, e
  // dois painéis abertos mostravam versões diferentes do mesmo conteúdo.
  if (window.FirebaseDB && window.FirebaseDB.enabled && window.FirebaseDB.watch) {
    window.FirebaseDB.watch(function (nome, dados) {
      if (dados === undefined) return;
      published = published || {};
      if (JSON.stringify(published[nome]) === JSON.stringify(dados)) return;
      published[nome] = dados;
      storeCache(published);
      // Espelha no armazenamento local sem reenviar ao servidor.
      const chaveLocal = Object.keys(CHAVES_COMPARTILHADAS).find(k => CHAVES_COMPARTILHADAS[k] === nome);
      if (chaveLocal) {
        aplicandoDoServidor = true;
        try { localStorage.setItem(chaveLocal, JSON.stringify(dados)); } catch (e) {}
        aplicandoDoServidor = false;
      }
      // Chegou versão nova do servidor: o que este navegador tinha guardado deixa de ser
      // "mais novo" e a tela volta a seguir o banco.
      try { localStorage.removeItem('edina_local_edits'); } catch (e) {}
      try { window.dispatchEvent(new CustomEvent('edina:published-updated')); } catch (e) {}
    });
  }
    if (published) { revalidate(); return Promise.resolve(published); }
    return fetchPublished().then(d => {
      published = d || {};
      if (d) storeCache(d);
      return published;
    });
  }
  primeFromCache();

  function publishedFor(key) {
    if (!published) return undefined;
    if (key === LS.properties) return published.properties;
    if (key === LS.site) return published.site;
    if (key === LS.posts) return published.posts;
    if (key === LS.testimonials) return published.testimonials;
    if (key === LS.leads) return published.leads;
    if (key === LS.visits) return published.visits;
    if (key === LS.integrations) return published.integrations;
    return undefined;
  }

  // Marca que ESTE navegador tem edições próprias (é o de quem administra). Sem essa marca,
  // o conteúdo publicado sempre vence — inclusive para quem já visitou o site antes e tinha
  // o conteúdo de exemplo guardado no navegador.
  function markEdited() {
    try { localStorage.setItem('edina_local_edits', '1'); } catch (e) {}
  }
  // A marca acima diz "o que está neste navegador é mais novo que o publicado" e existe para
  // que uma foto recém-enviada não seja trocada pela versão antiga enquanto sobe. Assim que a
  // gravação chega ao banco isso deixa de valer: mantê-la fazia o navegador de quem administra
  // ficar preso à própria cópia para sempre — mostrando algo diferente do resto do mundo, sem
  // nunca mais atualizar.
  function clearEditedIfSynced(promessa) {
    Promise.resolve(promessa).then(ok => {
      if (ok === false) return;
      try { localStorage.removeItem('edina_local_edits'); } catch (e) {}
    }).catch(() => {});
  }
  function hasLocalEdits() {
    try { return localStorage.getItem('edina_local_edits') === '1'; } catch (e) { return false; }
  }

  function get(key, seed) {
    const pub = publishedFor(key);
    if (pub && !hasLocalEdits()) return JSON.parse(JSON.stringify(pub));
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    if (pub) return JSON.parse(JSON.stringify(pub));
    try { localStorage.setItem(key, JSON.stringify(seed)); } catch (e) {}
    return JSON.parse(JSON.stringify(seed));
  }
  // Chaves que valem para a operação inteira, não para um navegador só. Mandar a cópia ao
  // banco aqui dentro cobre toda escrita de uma vez: os contatos, por exemplo, eram alterados
  // em nove pontos diferentes do código e só dois avisavam o servidor — por isso o quadro de
  // leads ficava diferente em cada aparelho.
  const CHAVES_COMPARTILHADAS = {};
  CHAVES_COMPARTILHADAS[LS.properties] = 'properties';
  CHAVES_COMPARTILHADAS[LS.site] = 'site';
  CHAVES_COMPARTILHADAS[LS.posts] = 'posts';
  CHAVES_COMPARTILHADAS[LS.testimonials] = 'testimonials';
  CHAVES_COMPARTILHADAS[LS.leads] = 'leads';
  CHAVES_COMPARTILHADAS[LS.visits] = 'visits';
  CHAVES_COMPARTILHADAS[LS.integrations] = 'integrations';
  // LS.auth fica fora: as senhas estão em texto e este banco é de leitura pública.

  // Quando o dado chega pelo watch não há o que devolver — sem esta trava a atualização
  // recebida seria reenviada ao servidor, e dois aparelhos abertos ficariam se respondendo.
  let aplicandoDoServidor = false;

  function sincronizar(key, val) {
    if (aplicandoDoServidor) return;
    const doc = CHAVES_COMPARTILHADAS[key];
    if (!doc) return;
    if (!(window.FirebaseDB && window.FirebaseDB.enabled)) return;
    const envio = doc === 'properties' ? window.FirebaseDB.saveProperties(val)
                : doc === 'site' ? window.FirebaseDB.saveSite(val)
                : doc === 'posts' ? window.FirebaseDB.savePosts(val)
                : doc === 'testimonials' ? window.FirebaseDB.saveTestimonials(val)
                : window.FirebaseDB.saveDoc(doc, val);
    clearEditedIfSynced(envio);
  }

  function set(key, val) {
    sincronizar(key, val);
    try {
      localStorage.setItem(key, JSON.stringify(val));
      return true;
    } catch (e) {
      console.warn('CRMData: falha ao salvar "' + key + '" (provável limite de armazenamento do navegador excedido).', e);
      return false;
    }
  }

  // Resizes/compresses an uploaded image file client-side before it's stored as a data
  // URL, so photos don't blow past the browser's localStorage quota (a few MB total).
  // format: 'jpeg' (default, smaller, no transparency) or 'png' (keeps transparency — use
  // for logos).
  // Converts an uploaded file to a normal image Blob first if it's an iPhone HEIC/HEIF
  // photo (browsers can't decode those natively into a canvas) using the heic2any
  // WASM library, then continues to the regular resize/compress pipeline below.
  function waitForHeic2any(timeoutMs) {
    return new Promise(resolve => {
      if (window.heic2any) { resolve(true); return; }
      const start = Date.now();
      const iv = setInterval(() => {
        if (window.heic2any) { clearInterval(iv); resolve(true); }
        else if (Date.now() - start > timeoutMs) { clearInterval(iv); resolve(false); }
      }, 150);
    });
  }
  function toDecodableBlob(file) {
    const isHeic = /\.hei[cf]$/i.test(file.name || '') || /hei[cf]/i.test(file.type || '');
    if (!isHeic) return Promise.resolve(file);
    return waitForHeic2any(9000).then(ready => {
      if (!ready || !window.heic2any) return file;
      return window.heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 })
        .then(result => Array.isArray(result) ? result[0] : result)
        .catch(() => file);
    });
  }

  function resizeImage(file, maxDim, quality, format) {
    maxDim = maxDim || 1280;
    quality = quality || 0.75;
    format = format || 'jpeg';
    return toDecodableBlob(file).then(decodableFile => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('read-failed'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('unsupported-format')); // still failed even after HEIC conversion attempt
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) { height = Math.round(height * (maxDim / width)); width = maxDim; }
            else { width = Math.round(width * (maxDim / height)); height = maxDim; }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          try {
            resolve(format === 'png' ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', quality));
          } catch (e) {
            reject(new Error('encode-failed'));
          }
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(decodableFile);
    }));
  }

  // Reprocessa uma foto JÁ salva (data: URL) para um novo tamanho/qualidade — usado quando
  // o usuário muda a "Qualidade das fotos" e quer aplicar aos envios anteriores também.
  function resizeDataUrl(dataUrl, maxDim, quality, format) {
    maxDim = maxDim || 1280;
    quality = quality || 0.75;
    format = format || 'jpeg';
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onerror = () => reject(new Error('unsupported-format'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round(height * (maxDim / width)); width = maxDim; }
          else { width = Math.round(width * (maxDim / height)); height = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        try {
          resolve(format === 'png' ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', quality));
        } catch (e) {
          reject(new Error('encode-failed'));
        }
      };
      img.src = dataUrl;
    });
  }

  window.CRMData = {
    MAX_PROPERTIES,
    MAX_PHOTOS_PER_PROPERTY: 50,
    isProUnlocked: function () { try { return localStorage.getItem('edina_pro_unlocked') === '1'; } catch (e) { return false; } },
    getMaxProperties: function () { return this.isProUnlocked() ? MAX_PROPERTIES_PRO : MAX_PROPERTIES; },
    getMaxPosts: function () { return this.isProUnlocked() ? MAX_POSTS_PRO : MAX_POSTS; },
    unlockPro: function (code) {
      if (String(code || '').trim().toUpperCase() !== PRO_UNLOCK_CODE) return false;
      try { localStorage.setItem('edina_pro_unlocked', '1'); } catch (e) {}
      return true;
    },
    lockPro: function () { try { localStorage.removeItem('edina_pro_unlocked'); } catch (e) {} },
    addSyncRecord: function (kind, commitFull, filesCount, summary) {
      try {
        const arr = get(LS.syncHistory, []);
        arr.unshift({ ts: Date.now(), kind, commit: commitFull, files: filesCount, summary: summary || '' });
        while (arr.length > 30) arr.pop();
        set(LS.syncHistory, arr);
      } catch (e) {}
    },
    getSyncHistory: () => get(LS.syncHistory, []),
    deleteSyncRecord: function (ts) {
      try { set(LS.syncHistory, get(LS.syncHistory, []).filter(h => h.ts !== ts)); } catch (e) {}
    },
    clearSyncHistory: function () { try { set(LS.syncHistory, []); } catch (e) {} },

    // ---- Backup completo ----
    // Guarda TODAS as tabelas do CRM (imóveis, leads, blog, site, configurações) mais TODA a
    // mídia do navegador (fotos, plantas, vídeos, ebooks) num único arquivo. O formato é uma
    // linha JSON por registro (não um JSON gigante), porque um catálogo real passa de 100 MB:
    // montar o arquivo inteiro na memória de uma vez travava e derrubava a aba do navegador.
    // Assim cada foto entra no arquivo e é liberada em seguida, e a restauração lê em pedaços.
    exportBackup: function (onProgress) {
      const report = (m) => { if (onProgress) onProgress(m); };
      report('Reunindo textos e cadastros…');
      const tables = {};
      Object.keys(LS).forEach(k => {
        try { const v = localStorage.getItem(LS[k]); if (v !== null) tables[LS[k]] = v; } catch (e) {}
      });
      ['edina_local_edits', 'edina_pro_unlocked', 'edina_gh_config', 'edina_font_scale', 'edina_favorites'].forEach(k => {
        try { const v = localStorage.getItem(k); if (v !== null) tables[k] = v; } catch (e) {}
      });
      report('Reunindo fotos e arquivos…');
      const blobToDataUrl = (b) => new Promise((res) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result);
        fr.onerror = () => res('');
        fr.readAsDataURL(b);
      });
      return this._openMediaDB().then(db => new Promise((resolve, reject) => {
        // Cabeçalho curto de propósito: as tabelas viram linhas próprias, senão a primeira
        // linha ficaria com centenas de KB (leads, blog) e a leitura em blocos não a acharia.
        const parts = [JSON.stringify({ format: 'edina-backup', version: 3, createdAt: new Date().toISOString() }) + '\n'];
        Object.keys(tables).forEach(k => parts.push(JSON.stringify(['table:' + k, tables[k]]) + '\n'));
        let count = 0;
        const tx = db.transaction('media', 'readonly');
        const req = tx.objectStore('media').openCursor();
        const pending = [];
        req.onsuccess = () => {
          const c = req.result;
          if (!c) return;
          const key = c.key;
          if (typeof c.value === 'string') {
            parts.push(JSON.stringify([key, c.value]) + '\n');
            count++;
            if (count % 100 === 0) report('Reunindo fotos e arquivos… ' + count);
          } else if (c.value instanceof Blob) {
            pending.push(blobToDataUrl(c.value).then(url => { parts.push(JSON.stringify([key, url]) + '\n'); count++; }));
          }
          c.continue();
        };
        tx.oncomplete = () => {
          Promise.all(pending).then(() => {
            report('Gerando o arquivo…');
            resolve({ blob: new Blob(parts, { type: 'application/json' }), media: count });
          });
        };
        tx.onerror = () => reject(tx.error);
      }));
    },

    // Lê o arquivo em pedaços e grava linha por linha, para nunca ter o backup inteiro na
    // memória. Aceita também o formato antigo (um único objeto JSON) de backups já baixados.
    importBackup: function (file, onProgress) {
      const report = (m) => { if (onProgress) onProgress(m); };
      const self = this;
      if (!file || typeof file.slice !== 'function') return Promise.reject(new Error('Selecione o arquivo de backup.'));

      const readSlice = (start, end) => new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result);
        fr.onerror = () => rej(new Error('Não foi possível ler o arquivo.'));
        fr.readAsText(file.slice(start, end));
      });

      let tablesRestored = 0;
      const putRecord = (store, key, val) => {
        if (key.startsWith('table:')) {
          try { localStorage.setItem(key.slice(6), val); tablesRestored++; } catch (e) {}
          return;
        }
        if (key.startsWith('idbvideo:') || key.startsWith('idbdoc:')) {
          try { store.put(dataUrlToBlob(val), key); } catch (e) {}
        } else {
          store.put(val, key);
          self._photoCache[key] = val;
        }
      };

      // Procura o fim da primeira linha lendo em blocos — nunca supõe um tamanho máximo.
      const findHeader = (limit) => readSlice(0, Math.min(limit, file.size)).then(head => {
        const nl = head.indexOf('\n');
        if (nl >= 0 || limit >= file.size) return { head, nl };
        return findHeader(limit * 4);
      });

      return findHeader(1024 * 256).then(({ head, nl }) => {
        // Formato antigo: arquivo é um único objeto JSON — cai no caminho simples.
        if (nl < 0) {
          return readSlice(0, file.size).then(all => {
            const backup = JSON.parse(all);
            if (!backup || backup.format !== 'edina-backup') throw new Error('Este arquivo não é um backup do site.');
            Object.keys(backup.tables || {}).forEach(k => { try { localStorage.setItem(k, backup.tables[k]); } catch (e) {} });
            const media = backup.media || {};
            const keys = Object.keys(media);
            return self._openMediaDB().then(db => new Promise((resolve, reject) => {
              const tx = db.transaction('media', 'readwrite');
              const store = tx.objectStore('media');
              keys.forEach(k => putRecord(store, k, media[k]));
              tx.oncomplete = () => resolve({ media: keys.length, tables: Object.keys(backup.tables || {}).length });
              tx.onerror = () => reject(tx.error);
            }));
          });
        }
        const header = JSON.parse(head.slice(0, nl));
        if (!header || header.format !== 'edina-backup') throw new Error('Este arquivo não é um backup do site.');
        report('Restaurando textos e cadastros…');
        // Backups da versão 2 traziam as tabelas dentro do cabeçalho.
        Object.keys(header.tables || {}).forEach(k => { try { localStorage.setItem(k, header.tables[k]); tablesRestored++; } catch (e) {} });

        // Percorre o resto do arquivo em blocos, gravando cada registro completo que aparece.
        const CHUNK = 1024 * 1024 * 4;
        let pos = nl + 1;
        let carry = '';
        let done = 0;
        const step = () => {
          if (pos >= file.size) return Promise.resolve();
          return readSlice(pos, Math.min(pos + CHUNK, file.size)).then(text => {
            pos += CHUNK;
            const lines = (carry + text).split('\n');
            carry = lines.pop() || '';
            if (!lines.length) return step();
            return self._openMediaDB().then(db => new Promise((resolve, reject) => {
              const tx = db.transaction('media', 'readwrite');
              const store = tx.objectStore('media');
              for (const line of lines) {
                if (!line) continue;
                try { const rec = JSON.parse(line); putRecord(store, rec[0], rec[1]); if (!String(rec[0]).startsWith('table:')) done++; } catch (e) {}
              }
              tx.oncomplete = () => { report('Restaurando arquivos… ' + done); resolve(); };
              tx.onerror = () => reject(tx.error);
            })).then(step);
          });
        };
        return step().then(() => {
          if (carry.trim()) {
            return self._openMediaDB().then(db => new Promise((resolve) => {
              const tx = db.transaction('media', 'readwrite');
              try { const rec = JSON.parse(carry); putRecord(tx.objectStore('media'), rec[0], rec[1]); if (!String(rec[0]).startsWith('table:')) done++; } catch (e) {}
              tx.oncomplete = () => resolve();
              tx.onerror = () => resolve();
            })).then(() => ({ media: done, tables: tablesRestored }));
          }
          return { media: done, tables: tablesRestored };
        });
      }).then(r => {
        try { localStorage.setItem('edina_local_edits', '1'); } catch (e) {}
        return r;
      });
    },
    resizeImage,
    resizeDataUrl,
    // ---- Photo storage (IndexedDB) ----
    // 50 empreendimentos x 50 fotos como base64 em localStorage estoura a cota (5-10MB).
    // As fotos vão para o IndexedDB (centenas de MB) e no registro do imóvel fica só a
    // chave "idbphoto:xxxx". photoURL() resolve a chave de forma síncrona a partir do
    // cache preenchido por preloadPhotos().
    _photoCache: {},
    savePhoto: function (dataUrl) {
      if (!dataUrl || dataUrl.startsWith('idbphoto:')) return Promise.resolve(dataUrl || '');
      const self = this;
      return this._openMediaDB().then(db => new Promise((resolve, reject) => {
        const key = 'idbphoto:' + Date.now() + '_' + Math.random().toString(36).slice(2);
        const tx = db.transaction('media', 'readwrite');
        tx.objectStore('media').put(dataUrl, key);
        tx.oncomplete = () => { self._photoCache[key] = dataUrl; resolve(key); };
        tx.onerror = () => reject(tx.error);
      })).catch(() => dataUrl);
    },
    // Áudio/vídeo em data: URL não permite busca (seek) e a reprodução costuma parar no
    // meio, porque o navegador não conhece a duração. Convertendo para blob: URL o arquivo
    // passa a ter tamanho conhecido e toca inteiro, com barra de progresso funcional.
    _blobURLs: {},
    mediaURL: function (v) {
      if (!v) return '';
      const resolved = this.photoURL(v);
      if (!resolved || resolved.indexOf('data:') !== 0) return resolved;
      const cacheKey = typeof v === 'string' ? v : resolved;
      if (this._blobURLs[cacheKey]) return this._blobURLs[cacheKey];
      try {
        const comma = resolved.indexOf(',');
        const header = resolved.slice(0, comma);
        const mime = (header.match(/^data:([^;]+)/) || [])[1] || 'application/octet-stream';
        const binary = atob(resolved.slice(comma + 1));
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
        this._blobURLs[cacheKey] = url;
        return url;
      } catch (e) {
        return resolved;
      }
    },
    getMediaRaw: function (key) {
      if (!key || typeof key !== 'string') return Promise.resolve('');
      if (this._photoCache[key]) return Promise.resolve(this._photoCache[key]);
      return this._openMediaDB().then(db => new Promise((resolve) => {
        const req = db.transaction('media', 'readonly').objectStore('media').get(key);
        req.onsuccess = () => resolve(typeof req.result === 'string' ? req.result : '');
        req.onerror = () => resolve('');
      })).catch(() => '');
    },
    hasLocalEdits: hasLocalEdits,
    loadPublished: loadPublished,
    publishedAt: function () { return published && published.publishedAt ? published.publishedAt : ''; },
    photoURL: function (v) {
      if (!v) return '';
      if (typeof v !== 'string' || !/^idb(photo|audio|doc):/.test(v)) return v;
      return this._photoCache[v] || '';
    },
    // Carrega no cache APENAS as chaves pedidas. Nada de varrer o banco inteiro: com 50
    // empreendimentos x 50 fotos isso seriam centenas de MB residentes em memória.
    warm: function (keys, _attempt) {
      const self = this;
      const attempt = _attempt || 0;
      const want = (keys || []).filter(k => typeof k === 'string' && /^idb(photo|audio|doc):/.test(k) && !self._photoCache[k]);
      if (!want.length) return Promise.resolve();
      return this._openMediaDB().then(db => new Promise((resolve) => {
        const tx = db.transaction('media', 'readonly');
        const store = tx.objectStore('media');
        let left = want.length;
        const done = () => { if (--left <= 0) resolve(); };
        want.forEach(k => {
          const req = store.get(k);
          req.onsuccess = () => { if (typeof req.result === 'string') self._photoCache[k] = req.result; done(); };
          req.onerror = () => done();
        });
      })).then(() => {
        // Durante o carregamento da página várias partes abrem o banco de mídia ao mesmo
        // tempo e a leitura pode voltar vazia. Se sobrou chave sem resolver, tenta de novo
        // com uma conexão nova.
        const missing = want.filter(k => !self._photoCache[k]);
        if (!missing.length || attempt >= 3) return;
        return new Promise(r => setTimeout(r, 120 + attempt * 180))
          .then(() => self.warm(missing, attempt + 1));
      }).catch(() => {});
    },
    // Chaves necessárias para as telas de listagem: capa de cada imóvel + imagens do site.
    listingKeys: function () {
      const props = get(LS.properties, seedProperties);
      const site = get(LS.site, seedSiteContent);
      const posts = get(LS.posts, seedPosts);
      const keys = [];
      props.forEach(p => { if (p.image) keys.push(p.image); });
      ['logoUrl', 'signatureUrl', 'heroImage', 'spotlightImage', 'aboutImage', 'watermarkLogoUrl', 'footerLogoUrl'].forEach(k => { if (site[k]) keys.push(site[k]); });
      if (Array.isArray(site.heroSlides)) site.heroSlides.forEach(i => { if (i) keys.push(i); });
      posts.forEach(p => { if (p.image) keys.push(p.image); });
      return keys;
    },
    // Galeria completa (+ áudio) de um imóvel — usada só na página de detalhe.
    propertyKeys: function (id) {
      const p = get(LS.properties, seedProperties).find(x => String(x.id) === String(id));
      if (!p) return [];
      const keys = [];
      if (p.image) keys.push(p.image);
      if (Array.isArray(p.images)) p.images.forEach(i => { if (i) keys.push(i); });
      if (Array.isArray(p.plantas)) p.plantas.forEach(i => { if (i) keys.push(i); });
      if (p.ebookUrl) keys.push(p.ebookUrl);
      return keys;
    },
    testimonialKeys: function () {
      const arr = get(LS.testimonials, seedTestimonials);
      const keys = [];
      (Array.isArray(arr) ? arr : []).forEach(t => { if (t.audioUrl) keys.push(t.audioUrl); if (t.image) keys.push(t.image); });
      return keys;
    },
    preloadPhotos: function (keys) {
      const self = this;
      return loadPublished().then(function () {
        let wanted = keys;
        // Cuidado: [] é truthy — sem checar o length, um array vazio faria o warm virar
        // no-op e nenhuma foto seria carregada.
        try { if (!wanted || !wanted.length) wanted = self.listingKeys(); } catch (e) { wanted = []; }
        // A migração de fotos inline varre todo o banco (imóveis, site, posts, depoimentos)
        // — só precisa rodar uma vez por sessão, não a cada troca de página.
        const migrate = self._inlineMigrationDone ? Promise.resolve(false) : self.migrateInlinePhotos().catch(() => false).then(r => { self._inlineMigrationDone = true; return r; });
        return migrate
          .then(() => self.warm(wanted || []))
          .catch(() => {});
      }).catch(() => {});
    },
    propertyCode: (id) => 'EO-' + String(id).padStart(4, '0'),
    // ---- Video storage (IndexedDB) ----
    // Video files are too large for localStorage (5-10MB quota) — storing 20 photos +
    // videos as base64 in the same JSON blob reliably blows the quota and silently
    // drops the whole save. Videos go into IndexedDB instead; only a small reference
    // key ("idbvideo:xxxx") is kept in the property record stored in localStorage.
    _openMediaDB: function () {
      // Uma única conexão compartilhada: no carregamento da página várias partes pedem o
      // banco ao mesmo tempo, e abrir várias conexões em paralelo fazia a leitura voltar
      // vazia de forma intermitente.
      if (this._mediaDBPromise) return this._mediaDBPromise;
      const self = this;
      this._mediaDBPromise = new Promise((resolve, reject) => {
        if (!window.indexedDB) { reject(new Error('no indexeddb')); return; }
        const req = indexedDB.open('edina_media_db', 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('media')) db.createObjectStore('media');
        };
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('media')) { reject(new Error('sem store de mídia')); return; }
          db.onclose = () => { self._mediaDBPromise = null; };
          resolve(db);
        };
        req.onerror = () => { self._mediaDBPromise = null; reject(req.error); };
      });
      this._mediaDBPromise.catch(() => { self._mediaDBPromise = null; });
      return this._mediaDBPromise;
    },
    saveVideoFile: function (file) {
      return this._openMediaDB().then(db => new Promise((resolve, reject) => {
        const key = 'idbvideo:' + Date.now() + '_' + Math.random().toString(36).slice(2);
        const tx = db.transaction('media', 'readwrite');
        tx.objectStore('media').put(file, key);
        tx.oncomplete = () => resolve(key);
        tx.onerror = () => reject(tx.error);
      })).catch(() => '');
    },
    // Ebook (PDF): guarda o Blob direto (não base64) — evita inchar 33% o arquivo e
    // decodificar um data: URL gigante toda vez que a página abre.
    saveDocFile: function (file) {
      return this._openMediaDB().then(db => new Promise((resolve, reject) => {
        const key = 'idbdoc:' + Date.now() + '_' + Math.random().toString(36).slice(2);
        const tx = db.transaction('media', 'readwrite');
        tx.objectStore('media').put(file, key);
        tx.oncomplete = () => resolve(key);
        tx.onerror = () => reject(tx.error);
      })).catch(() => '');
    },
    getDocURL: function (key) {
      if (!key) return Promise.resolve('');
      if (!key.startsWith('idbdoc:')) return Promise.resolve(key); // legacy data: URL
      return this._openMediaDB().then(db => new Promise((resolve, reject) => {
        const tx = db.transaction('media', 'readonly');
        const req = tx.objectStore('media').get(key);
        req.onsuccess = () => {
          if (!req.result) return resolve('');
          if (req.result instanceof Blob) return resolve(URL.createObjectURL(req.result));
          // Ebooks salvos antes da mudança para Blob ficaram como data: URL (string).
          resolve(typeof req.result === 'string' ? req.result : '');
        };
        req.onerror = () => reject(req.error);
      })).catch(() => '');
    },
    getVideoURL: function (key) {
      if (!key) return Promise.resolve('');
      if (!key.startsWith('idbvideo:')) return Promise.resolve(key); // legacy data: URL
      return this._openMediaDB().then(db => new Promise((resolve, reject) => {
        const tx = db.transaction('media', 'readonly');
        const req = tx.objectStore('media').get(key);
        req.onsuccess = () => resolve(req.result ? URL.createObjectURL(req.result) : '');
        req.onerror = () => reject(req.error);
      })).catch(() => '');
    },
    // Move fotos base64 que já estão no localStorage (dados antigos) para o IndexedDB,
    // liberando a cota. Roda uma vez por carregamento, depois do preloadPhotos.
    saveMedia: function (dataUrl, kind) {
      if (!dataUrl || /^idb(photo|audio|video|doc):/.test(dataUrl)) return Promise.resolve(dataUrl || '');
      const self = this;
      return this._openMediaDB().then(db => new Promise((resolve, reject) => {
        const key = 'idb' + (kind || 'photo') + ':' + Date.now() + '_' + Math.random().toString(36).slice(2);
        const tx = db.transaction('media', 'readwrite');
        tx.objectStore('media').put(dataUrl, key);
        tx.oncomplete = () => { self._photoCache[key] = dataUrl; resolve(key); };
        tx.onerror = () => reject(tx.error);
      })).catch(() => dataUrl);
    },
    // Remove SOMENTE chaves de versões antigas do schema de dados (edina_db_*) que ninguém
    // mais lê — elas sozinhas ocupavam ~11MB da cota. A regra é restritiva de propósito:
    // qualquer outra chave (favoritos do visitante, preferências) nunca é tocada.
    purgeLegacyKeys: function () {
      try {
        const keep = Object.keys(LS).map(k => LS[k]);
        Object.keys(localStorage).forEach(k => {
          if (!/^edina_db_/.test(k)) return;
          if (keep.indexOf(k) !== -1) return;
          localStorage.removeItem(k);
        });
      } catch (e) {}
    },
    migrateInlinePhotos: function () {
      const self = this;
      try {
      const isInline = (v) => typeof v === 'string' && v.startsWith('data:');
      const props = get(LS.properties, seedProperties);
      const site = get(LS.site, seedSiteContent);
      const posts = get(LS.posts, seedPosts);
      const tstm = get(LS.testimonials, seedTestimonials);
      const jobs = [];
      let touched = false;
      props.forEach(p => {
        if (isInline(p.image)) { touched = true; jobs.push(self.saveMedia(p.image, 'photo').then(k => { p.image = k; })); }
        if (Array.isArray(p.images)) p.images.forEach((img, i) => {
          if (isInline(img)) { touched = true; jobs.push(self.saveMedia(img, 'photo').then(k => { p.images[i] = k; })); }
        });
        if (isInline(p.videoFile)) { touched = true; jobs.push(self.saveMedia(p.videoFile, 'video').then(k => { p.videoFile = k; })); }
      });
      ['logoUrl', 'signatureUrl', 'heroImage', 'spotlightImage', 'aboutImage', 'watermarkLogoUrl', 'footerLogoUrl'].forEach(k => {
        if (isInline(site[k])) { touched = true; jobs.push(self.saveMedia(site[k], 'photo').then(key => { site[k] = key; })); }
      });
      if (Array.isArray(site.heroSlides)) site.heroSlides.forEach((img, i) => {
        if (isInline(img)) { touched = true; jobs.push(self.saveMedia(img, 'photo').then(k => { site.heroSlides[i] = k; })); }
      });
      posts.forEach(p => {
        if (isInline(p.image)) { touched = true; jobs.push(self.saveMedia(p.image, 'photo').then(k => { p.image = k; })); }
      });
      (Array.isArray(tstm) ? tstm : []).forEach(t => {
        if (isInline(t.audioUrl)) { touched = true; jobs.push(self.saveMedia(t.audioUrl, 'audio').then(k => { t.audioUrl = k; })); }
        if (isInline(t.image)) { touched = true; jobs.push(self.saveMedia(t.image, 'photo').then(k => { t.image = k; })); }
      });
      this.purgeLegacyKeys();
      if (!touched) return Promise.resolve(false);
      return Promise.all(jobs).then(() => {
        set(LS.properties, props);
        set(LS.site, site);
        set(LS.posts, posts);
        set(LS.testimonials, tstm);
        return true;
      }).catch(() => false);
      } catch (e) {
        console.warn('CRMData: migração de mídia falhou (seguindo sem migrar).', e);
        return Promise.resolve(false);
      }
    },
    // O favicon é pequeno e precisa ser aplicado antes de qualquer coisa carregar, então
    // fica direto no localStorage (não no banco de mídia) para ser lido de forma síncrona.
    getFavicon: () => {
      try { return (get(LS.site, seedSiteContent) || {}).faviconUrl || ''; } catch (e) { return ''; }
    },
    // Quanto espaço as fotos estão ocupando de verdade: soma o tamanho real de cada arquivo
    // guardado no banco de mídia, contra um orçamento fixo (não a cota do navegador, que é
    // enorme e mal se move — por isso a barra antiga parecia travada).
    STORAGE_BUDGET_BYTES: STORAGE_BUDGET_DEFAULT,
    getStorageBudget: function () { return this.isProUnlocked() ? STORAGE_BUDGET_PRO : STORAGE_BUDGET_DEFAULT; },
    mediaUsageBytes: function () {
      return this._openMediaDB().then(db => new Promise((resolve) => {
        const tx = db.transaction('media', 'readonly');
        const store = tx.objectStore('media');
        const req = store.openCursor();
        let total = 0;
        req.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            const v = cursor.value;
            if (typeof v === 'string') total += v.length * 0.75; // base64 → bytes reais
            cursor.continue();
          } else resolve(total);
        };
        req.onerror = () => resolve(total);
      })).catch(() => 0);
    },
    storageEstimate: function () {
      return this.mediaUsageBytes().then(used => ({ used, quota: this.getStorageBudget() }));
    },
    storageEstimateLegacy: function () {
      if (!navigator.storage || !navigator.storage.estimate) return Promise.resolve(null);
      return navigator.storage.estimate()
        .then(e => ({ used: e.usage || 0, quota: e.quota || 0 }))
        .catch(() => null);
    },
    // Pede ao navegador para não descartar as fotos ao liberar espaço.
    requestPersistence: function () {
      if (!navigator.storage || !navigator.storage.persist) return Promise.resolve(false);
      return navigator.storage.persisted()
        .then(ok => ok ? true : navigator.storage.persist())
        .catch(() => false);
    },
    getFontScale: () => { try { return parseInt(localStorage.getItem('edina_font_scale') || '100', 10); } catch (e) { return 100; } },
    firebaseEnabled: () => !!(window.FirebaseDB && window.FirebaseDB.enabled),
    setFontScale: (val) => { try { localStorage.setItem('edina_font_scale', String(val)); } catch (e) {} },
    applyFontScale: () => {
      let val = 100;
      try { val = parseInt(localStorage.getItem('edina_font_scale') || '100', 10); } catch (e) {}
      document.body.style.zoom = (val / 100);
      return val;
    },
    getProperties: function () {
      const arr = get(LS.properties, seedProperties);
      const self = this;
      return arr.map(p => {
        const out = { ...p };
        if (p.image) {
          out.image = self.photoURL(p.image);
          // Chave ainda não carregada: sinaliza para a UI usar o placeholder em vez de
          // pintar um retângulo vazio.
          if (!out.image) out.imagePending = true;
        }
        if (Array.isArray(p.images)) out.images = p.images.map(i => self.photoURL(i)).filter(Boolean);
        if (Array.isArray(p.plantas)) out.plantas = p.plantas.map(i => self.photoURL(i)).filter(Boolean);
        if (p.ebookUrl) out.ebookUrl = p.ebookUrl;
        return out;
      });
    },
    getPropertiesRaw: () => get(LS.properties, seedProperties),
    saveProperties: (arr) => { markEdited(); return set(LS.properties, arr); },
    getLeads: () => get(LS.leads, seedLeads),
    saveLeads: (arr) => set(LS.leads, arr),
    addLead: (lead) => {
      const leads = get(LS.leads, seedLeads);
      const nextId = leads.reduce((m, l) => Math.max(m, l.id), 0) + 1;
      const today = new Date();
      const months = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
      const dateLabel = `${String(today.getDate()).padStart(2,'0')} ${months[today.getMonth()]} ${today.getFullYear()}`;
      const timeLabel = `${String(today.getHours()).padStart(2,'0')}:${String(today.getMinutes()).padStart(2,'0')}`;
      const full = { id: nextId, stage: "novo", value: 0, date: dateLabel, time: timeLabel, createdAt: today.toISOString(), status: "aberto", assignedTo: "", timeline: [], attachments: [], offeredProperties: [], ...lead };
      leads.unshift(full);
      set(LS.leads, leads);
      return full;
    },
    updateLead: (leadId, patch) => {
      const leads = get(LS.leads, seedLeads);
      const idx = leads.findIndex(l => l.id === leadId);
      if (idx === -1) return false;
      leads[idx] = { ...leads[idx], ...patch };
      return set(LS.leads, leads);
    },
    // Alinha este navegador com o catálogo que está no ar antes de qualquer edição. Sem
    // isso o painel edita sobre a cópia que tinha guardada e, ao salvar, devolve ao banco
    // uma versão antiga — foi assim que as fotos dos imóveis se perderam de uma vez.
    syncProperties: function () {
      if (!(window.FirebaseDB && window.FirebaseDB.enabled)) return Promise.resolve(null);
      return window.FirebaseDB.fetchAll().then(d => {
        if (!d || !Array.isArray(d.properties)) return null;
        set(LS.properties, d.properties);
        return d.properties;
      }).catch(() => null);
    },

    // Traz do banco os contatos recebidos de outros aparelhos e junta com os daqui.
    syncLeads: function () {
      if (!(window.FirebaseDB && window.FirebaseDB.enabled)) return Promise.resolve(null);
      return window.FirebaseDB.fetchLeads().then(remote => {
        if (!remote) return null;
        const locais = get(LS.leads, seedLeads);
        const vistos = new Set(remote.map(l => String(l.id)));
        const merged = remote.concat(locais.filter(l => !vistos.has(String(l.id))));
        set(LS.leads, merged);
        return merged;
      }).catch(() => null);
    },
    addLeadTimelineEntry: (leadId, entry) => {
      const leads = get(LS.leads, seedLeads);
      const lead = leads.find(l => l.id === leadId);
      if (!lead) return false;
      if (!lead.timeline) lead.timeline = [];
      const now = new Date();
      const months = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
      const dateLabel = `${String(now.getDate()).padStart(2,'0')} ${months[now.getMonth()]} ${now.getFullYear()}, ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
      const nextId = lead.timeline.reduce((m, t) => Math.max(m, t.id || 0), 0) + 1;
      lead.timeline.unshift({ id: nextId, date: dateLabel, ...entry });
      return set(LS.leads, leads);
    },
    addLeadAttachment: (leadId, attachment) => {
      const leads = get(LS.leads, seedLeads);
      const lead = leads.find(l => l.id === leadId);
      if (!lead) return false;
      if (!lead.attachments) lead.attachments = [];
      lead.attachments.push(attachment);
      return set(LS.leads, leads);
    },
    removeLeadAttachment: (leadId, index) => {
      const leads = get(LS.leads, seedLeads);
      const lead = leads.find(l => l.id === leadId);
      if (!lead || !lead.attachments) return false;
      lead.attachments.splice(index, 1);
      return set(LS.leads, leads);
    },
    setLeadOfferedProperties: (leadId, propertyIds) => {
      const leads = get(LS.leads, seedLeads);
      const lead = leads.find(l => l.id === leadId);
      if (!lead) return false;
      lead.offeredProperties = propertyIds;
      return set(LS.leads, leads);
    },
    deleteLead: (leadId) => {
      const leads = get(LS.leads, seedLeads).filter(l => l.id !== leadId);
      return set(LS.leads, leads);
    },
    getPosts: function () {
      const arr = get(LS.posts, seedPosts);
      const self = this;
      return arr.map(p => p.image ? { ...p, image: self.photoURL(p.image) } : p);
    },
    getPostsRaw: () => get(LS.posts, seedPosts),
    savePosts: (arr) => { markEdited(); return set(LS.posts, arr); },
    getVisits: () => get(LS.visits, seedVisits),
    saveVisits: (arr) => set(LS.visits, arr),

    // ---- Analytics de acesso (visualizações reais no site público) ----
    // Cada visualização de imóvel ou da home vira um registro leve. Fica só com o essencial
    // (data, hora, imóvel, origem) para não pesar o localStorage nem virar rastreamento
    // pessoal — nenhum dado do visitante é guardado.
    logPageview: function (entry) {
      try {
        const arr = get(LS.analytics, []);
        const now = new Date();
        const rec = {
          ts: now.getTime(),
          day: now.toISOString().slice(0, 10),
          hour: now.getHours(),
          propertyId: entry.propertyId || null,
          path: entry.path || '',
          source: entry.source || 'direto'
        };
        arr.push(rec);
        while (arr.length > 20000) arr.shift();
        set(LS.analytics, arr);
        // Também grava no banco de dados compartilhado, se configurado — assim o Dashboard
        // enxerga visitas de QUALQUER navegador, não só o de quem administra.
        if (window.FirebaseDB && window.FirebaseDB.enabled) window.FirebaseDB.logPageview(rec).catch(() => {});
      } catch (e) {}
    },
    getAnalytics: () => get(LS.analytics, []),
    // Busca os dados no banco compartilhado quando disponível (todos os visitantes);
    // sem ele, cai para o que este navegador já registrou.
    getAnalyticsMerged: function () {
      if (window.FirebaseDB && window.FirebaseDB.enabled) {
        return window.FirebaseDB.fetchAnalytics().then(remote => remote.length ? remote : get(LS.analytics, []));
      }
      return Promise.resolve(get(LS.analytics, []));
    },

    // ---- Histórico de ações (configurações, sincronizações, quem fez) ----
    // Expira sozinho após 180 dias; também pode ser apagado na hora (total ou parcial),
    // sempre exigindo a senha de quem está apagando.
    HISTORY_MAX_AGE_DAYS: 180,
    addHistoryEntry: function (actor, action, detail) {
      try {
        const arr = get(LS.history, []);
        const cutoff = Date.now() - this.HISTORY_MAX_AGE_DAYS * 86400000;
        let kept = arr.filter(h => h.ts >= cutoff);
        kept.unshift({ ts: Date.now(), actor: actor || 'Desconhecido', action: action || '', detail: detail || '' });
        // Não deixa acumular mais de 200 registros por dia — quando um dia passa disso, descarta
        // os mais antigos DAQUELE dia primeiro (mantém os mais recentes).
        const dayOf = (ts) => new Date(ts).toISOString().slice(0, 10);
        const counts = {};
        kept = kept.sort((a, b) => b.ts - a.ts).filter(h => {
          const d = dayOf(h.ts);
          counts[d] = (counts[d] || 0) + 1;
          return counts[d] <= 200;
        });
        while (kept.length > 3000) kept.pop();
        set(LS.history, kept);
      } catch (e) {}
    },
    getHistory: function () {
      const cutoff = Date.now() - this.HISTORY_MAX_AGE_DAYS * 86400000;
      return get(LS.history, []).filter(h => h.ts >= cutoff).slice().sort((a, b) => b.ts - a.ts);
    },
    // Registro de auditoria à parte do histórico normal: nada neste projeto tem permissão de
    // apagar dele, nem o "Zerar site" nem "apagar histórico" — é o rastro permanente de quando
    // o site inteiro foi zerado e por quem.
    AUDIT_KEY: 'edina_audit_log_v1',
    addAuditEntry: function (actor, action, detail) {
      try {
        const arr = JSON.parse(localStorage.getItem(this.AUDIT_KEY) || '[]');
        arr.unshift({ ts: Date.now(), date: new Date().toLocaleString('pt-BR'), actor, action, detail: detail || '' });
        localStorage.setItem(this.AUDIT_KEY, JSON.stringify(arr.slice(0, 500)));
      } catch (e) {}
    },
    getAuditLog: function () {
      try { return JSON.parse(localStorage.getItem(this.AUDIT_KEY) || '[]'); } catch (e) { return []; }
    },
    // scope: 'all' apaga tudo; {before: tsInMillis} apaga só entradas anteriores a essa data;
    // {id: entryTs} apaga só aquele registro (usa o timestamp como id, é único).
    clearHistory: function (username, password, scope) {
      const user = this.verifyLogin(username, password);
      if (!user) return { ok: false, error: 'Senha incorreta.' };
      const arr = get(LS.history, []);
      let kept;
      if (scope && scope.id != null) kept = arr.filter(h => h.ts !== scope.id);
      else if (scope && scope.before) kept = arr.filter(h => h.ts >= scope.before);
      else kept = [];
      set(LS.history, kept);
      return { ok: true };
    },
    // range: {from:'YYYY-MM-DD', to:'YYYY-MM-DD'} — ambos inclusivos; omitido = tudo.
    analyticsInRange: function (range) {
      const arr = get(LS.analytics, []);
      if (!range || (!range.from && !range.to)) return arr;
      return arr.filter(a => (!range.from || a.day >= range.from) && (!range.to || a.day <= range.to));
    },

    getTestimonials: function () {
      const arr = get(LS.testimonials, seedTestimonials);
      const self = this;
      return (Array.isArray(arr) ? arr : []).map(t => {
        const out = { ...t };
        if (t.audioUrl) out.audioUrl = self.mediaURL(t.audioUrl);
        if (t.image) out.image = self.photoURL(t.image);
        return out;
      });
    },
    getTestimonialsRaw: () => get(LS.testimonials, seedTestimonials),
    saveTestimonials: (arr) => { markEdited(); return set(LS.testimonials, arr); },
    getIntegrations: () => get(LS.integrations, { facebook: false, googleAds: false, apiKey: "eo_live_9f3a1c7d2b4e6f80", webhook: "", commission: 6 }),
    saveIntegrations: (obj) => set(LS.integrations, obj),
    getSiteContent: function () {
      const sc = withSiteDefaults(get(LS.site, seedSiteContent));
      const self = this;
      ['logoUrl', 'signatureUrl', 'heroImage', 'spotlightImage', 'aboutImage', 'watermarkLogoUrl', 'footerLogoUrl'].forEach(k => {
        if (sc[k]) sc[k] = self.photoURL(sc[k]);
      });
      if (Array.isArray(sc.heroSlides)) sc.heroSlides = sc.heroSlides.map(i => i ? self.photoURL(i) : i);
      return sc;
    },
    getSiteContentRaw: () => withSiteDefaults(get(LS.site, seedSiteContent)),
    saveSiteContent: (obj) => { markEdited(); return set(LS.site, obj); },
    applyTheme: (theme) => {
      if (!theme) return;
      const r = document.documentElement.style;
      const map = { accent: '--accent', tan: '--tan', cream: '--cream', bgAlt: '--bg-alt', olive: '--olive', blue: '--blue', stone: '--stone', ink: '--ink', headerBg: '--header-bg', footerBg: '--footer-bg' };
      Object.keys(map).forEach(k => { if (theme[k]) r.setProperty(map[k], theme[k]); });
    },

    // --- Auth ---
    getAuth: () => get(LS.auth, seedAuth),
    saveAuth: (obj) => set(LS.auth, obj),
    ROLE_PERMISSIONS,
    getPermissions: (role) => ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.corretor,
    verifyLogin: (identifier, password) => {
      const auth = get(LS.auth, seedAuth);
      const id = String(identifier).toLowerCase().trim();
      const user = auth.users.find(u =>
        (u.username.toLowerCase() === id || (u.email && u.email.toLowerCase() === id)) &&
        u.password === password && u.active !== false
      );
      return user || null;
    },
    changePassword: (username, oldPassword, newPassword) => {
      const auth = get(LS.auth, seedAuth);
      const user = auth.users.find(u => u.username.toLowerCase() === String(username).toLowerCase());
      if (!user || user.password !== oldPassword) return false;
      user.password = newPassword;
      set(LS.auth, auth);
      return true;
    },
    getUsers: () => get(LS.auth, seedAuth).users,
    saveUsers: (users) => {
      const auth = get(LS.auth, seedAuth);
      auth.users = users;
      set(LS.auth, auth);
    },
    addUser: (user) => {
      const auth = get(LS.auth, seedAuth);
      const nextId = auth.users.reduce((m, u) => Math.max(m, u.id), 0) + 1;
      auth.users.push({ id: nextId, active: true, password: '123456', ...user });
      set(LS.auth, auth);
      return auth.users;
    },
    resetUserPassword: (userId) => {
      const auth = get(LS.auth, seedAuth);
      const user = auth.users.find(u => u.id === userId);
      if (!user) return false;
      user.password = '123456';
      set(LS.auth, auth);
      return true;
    },
    setUserRole: (userId, role) => {
      const auth = get(LS.auth, seedAuth);
      const user = auth.users.find(u => u.id === userId);
      if (!user) return false;
      user.role = role;
      set(LS.auth, auth);
      return true;
    },
    setUserActive: (userId, active) => {
      const auth = get(LS.auth, seedAuth);
      const user = auth.users.find(u => u.id === userId);
      if (!user) return false;
      user.active = active;
      set(LS.auth, auth);
      return true;
    },
    getSession: () => {
      try { return JSON.parse(localStorage.getItem(LS.session) || 'null'); } catch (e) { return null; }
    },
    setSession: (user) => {
      try { localStorage.setItem(LS.session, JSON.stringify({ username: user.username, role: user.role, name: user.name, userId: user.id })); } catch (e) {}
    },
    clearSession: () => {
      try { localStorage.removeItem(LS.session); } catch (e) {}
    },

    money: (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR')
  };
})();
