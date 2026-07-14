// Shared fictitious "database" for the Edina Oliveira demo site, backed by localStorage.
// Every page (public site + CRM) reads/writes through this so edits made in the CRM
// (properties, blog posts, testimonials, site content, auth) and leads captured on the
// public site stay in sync. NOTE: this is a front-end only prototype — "persistence" is
// per-browser (localStorage), not a real shared server database.
(function () {
  const LS = {
    properties: 'edina_db_properties_v6',
    leads: 'edina_db_leads_v2',
    posts: 'edina_db_posts',
    testimonials: 'edina_db_testimonials_v3',
    integrations: 'edina_db_integrations',
    site: 'edina_db_site_content_v2',
    auth: 'edina_db_auth_v2',
    session: 'edina_db_session_v2',
    visits: 'edina_db_visits'
  };

  const MAX_PROPERTIES = 50;

  const handPicked = [
    { id: 1, title: "Apartamento Amores do Mar", location: "Praia Brava — Itajaí", region: "praia-brava", type: "Apartamento", purpose: "venda", price: 1900000, area: 101, suites: 3, baths: 3, garage: 3, condo: "Edifício Amores do Mar", featured: true, tone: 0, tour: false, status: "ativo", image: "media/amores-do-mar-1.jpg", images: ["media/amores-do-mar-1.jpg","media/amores-do-mar-2.jpg","media/amores-do-mar-3.jpg","media/amores-do-mar-4.jpg","media/amores-do-mar-5.jpg","media/amores-do-mar-6.jpg"], videoUrl: "", videoFile: "", descProvisional: true, desc: "[Texto provisório — aguardando descritivo definitivo] Apartamento no Edifício Amores do Mar, próximo à praia, com acabamento de alto padrão e vista privilegiada. Substitua este texto pelo descritivo oficial do imóvel assim que disponível.", amenities: ["Frente para o mar", "Acabamento de alto padrão", "3 suítes"] },
    { id: 2, title: "Casa Ressacada", location: "Ressacada — Itajaí", region: "itajai", type: "Casa", purpose: "venda", price: 1900000, area: 350, suites: 3, baths: 4, garage: 4, condo: "Residencial Ressacada", featured: true, tone: 1, tour: false, status: "ativo", image: "media/ressacada-1.jpg", images: ["media/ressacada-1.jpg","media/ressacada-2.jpg","media/ressacada-3.jpg","media/ressacada-4.jpg","media/ressacada-5.jpg","media/ressacada-6.jpg","media/ressacada-7.jpg","media/ressacada-8.jpg"], videoUrl: "", videoFile: "", descProvisional: true, desc: "[Texto provisório — aguardando descritivo definitivo] Casa térrea no bairro Ressacada, com piscina, área gourmet e amplo quintal gramado. Substitua este texto pelo descritivo oficial do imóvel assim que disponível.", amenities: ["Piscina", "Área gourmet", "Quintal amplo"] },
    { id: 3, title: "Apartamento Life Residence", location: "Balneário Camboriú", region: "camboriu", type: "Apartamento", purpose: "venda", price: 1650000, area: 101, suites: 3, baths: 3, garage: 3, condo: "Life Residence", featured: true, tone: 2, tour: false, status: "ativo", image: "", images: [], videoUrl: "", videoFile: "media/life-residence-video.mp4", descProvisional: false, desc: "Apartamento de 101m² no Life Residence, com 3 quartos (originalmente 3 suítes — hoje uma suíte master e 2 demi-suítes), localizado no 23º andar, apto final 01. 3 vagas de garagem no andar térreo. 100% mobiliado de verdade: todos os quartos e a sala possuem ar condicionado inverter.", amenities: ["100% mobiliado", "Ar condicionado inverter em todos os ambientes", "23º andar", "3 vagas de garagem"] },
    { id: 4, title: "Casa Condomínio Aririba", location: "Praia Brava — Itajaí", region: "praia-brava", type: "Casa", purpose: "venda", price: 0, area: 0, suites: 0, baths: 0, garage: 0, condo: "Condomínio Aririba", featured: false, tone: 0, tour: false, status: "ativo", image: "", images: [], videoUrl: "", videoFile: "", descProvisional: true, desc: "[Texto provisório — aguardando fotos e descritivo definitivo] Casa em condomínio fechado no Aririba. Cadastro criado apenas para referência visual; substitua por dados e fotos reais.", amenities: [] },
    { id: 5, title: "Amores da Brava", location: "Praia Brava — Itajaí", region: "praia-brava", type: "Apartamento", purpose: "venda", price: 0, area: 0, suites: 0, baths: 0, garage: 0, condo: "Edifício Amores da Brava", featured: false, tone: 1, tour: false, status: "ativo", image: "", images: [], videoUrl: "", videoFile: "", descProvisional: true, desc: "[Texto provisório — aguardando fotos e descritivo definitivo] Apartamento no Edifício Amores da Brava. Cadastro criado apenas para referência visual; substitua por dados e fotos reais.", amenities: [] },
    { id: 6, title: "Porto Madeiro", location: "Itajaí", region: "itajai", type: "Apartamento", purpose: "venda", price: 0, area: 0, suites: 0, baths: 0, garage: 0, condo: "Porto Madeiro", featured: false, tone: 2, tour: false, status: "ativo", image: "", images: [], videoUrl: "", videoFile: "", descProvisional: true, desc: "[Texto provisório — aguardando fotos e descritivo definitivo] Unidade no empreendimento Porto Madeiro. Cadastro criado apenas para referência visual; substitua por dados e fotos reais.", amenities: [] },
    { id: 7, title: "Casa de Praia Assinada", location: "Praia Brava — Itajaí", region: "praia-brava", type: "Casa", purpose: "venda", price: 7900000, area: 500, suites: 5, baths: 6, garage: 6, condo: "Condomínio Costa Brava", featured: true, tone: 1, tour: true, status: "ativo", image: "", images: [], videoUrl: "", videoFile: "", desc: "Residência de arquitetura autoral a beira-mar, com spa, adega e cinema privativo.", amenities: ["Spa privativo", "Cinema", "Adega climatizada", "Arquitetura assinada", "6 vagas"] },
    { id: 8, title: "Flat Mobiliado", location: "Balneário Camboriú", region: "camboriu", type: "Flat", purpose: "aluguel", price: 980000, area: 48, suites: 1, baths: 1, garage: 1, condo: "Edifício Central Flat", featured: false, tone: 0, tour: false, status: "ativo", image: "", images: [], videoUrl: "", videoFile: "", desc: "Flat totalmente mobiliado, ideal para temporada ou investimento.", amenities: ["Mobiliado", "Serviço de limpeza", "Recepção 24h"] }
  ];

  // Generate additional fictitious properties up to MAX_PROPERTIES so the portfolio has
  // a realistic volume of listings to browse and filter.
  function generateMore(count) {
    const locs = [
      { location: "Praia Brava — Itajaí", region: "praia-brava" },
      { location: "Balneário Camboriú", region: "camboriu" },
      { location: "Navegantes", region: "navegantes" },
      { location: "Itajaí", region: "itajai" }
    ];
    const types = ["Cobertura", "Apartamento", "Casa", "Studio", "Flat"];
    const condos = ["Residencial Vista Azul", "Condomínio Solar das Águas", "Edifício Horizonte", "Residencial Vento Sul", "Torre Aurora", "Condomínio Baía Verde", "Edifício Costa Norte", "Residencial Mirante do Mar", "Condomínio Areia Branca", "Edifício Brisa do Mar"];
    const adjectives = ["Vista Mar", "Frente Mar", "Alto Padrão", "Panorâmico", "Exclusivo", "Design Autoral", "Vista Livre", "Beira-Mar", "Vista Rio", "Premium"];
    const amenitiesPool = ["Piscina", "Academia", "Espaço gourmet", "Portaria 24h", "Salão de festas", "Playground", "Sauna", "Quadra poliesportiva", "Elevador privativo", "Vista panorâmica", "Segurança 24h", "Varanda gourmet"];
    const list = [];
    for (let i = 0; i < count; i++) {
      const id = handPicked.length + i + 1;
      const loc = locs[i % locs.length];
      const type = types[(i + 1) % types.length];
      const condo = condos[i % condos.length];
      const adj = adjectives[i % adjectives.length];
      const area = 60 + ((i * 17) % 440);
      const suites = 1 + (i % 5);
      const baths = suites + (i % 2);
      const garage = 1 + (i % 6);
      const basePrice = 850000 + area * (9000 + (i % 5) * 2500);
      const status = i % 11 === 0 ? "vendido" : (i % 7 === 0 ? "reservado" : "ativo");
      const purpose = i % 6 === 0 ? "aluguel" : "venda";
      const tone = i % 3;
      const amenities = [amenitiesPool[i % amenitiesPool.length], amenitiesPool[(i + 3) % amenitiesPool.length], amenitiesPool[(i + 6) % amenitiesPool.length]];
      list.push({
        id, title: `${type} ${adj} ${id}`, location: loc.location, region: loc.region, type, purpose,
        price: Math.round(basePrice / 1000) * 1000, area, suites, baths, garage, condo,
        featured: false, tone, tour: false, status, image: "", images: [], videoUrl: "", videoFile: "",
        desc: `${type} com ${suites} suítes em ${loc.location}, no ${condo}. Acabamento de alto padrão e infraestrutura de lazer completa.`,
        amenities
      });
    }
    return list;
  }

  const seedProperties = handPicked.concat(generateMore(20 - handPicked.length));

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
    footerTagline: "Os melhores imóveis de alto padrão no litoral de Santa Catarina, em um só lugar.",
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
      { id: 2, name: "Gerente Geral", username: "gerente", email: "gerente@edinaoliveira.com.br", password: "123456", role: "gerente", active: true },
      { id: 3, name: "Corretor Parceiro", username: "corretor", email: "corretor@edinaoliveira.com.br", password: "123456", role: "corretor", active: true }
    ]
  };

  // Role permission map — checked by the CRM UI to show/hide tabs and edit controls.
  // master: acesso total. gerente: opera o dia a dia (leads, imóveis, blog, depoimentos,
  // agenda) mas não vê integrações/API nem gerencia usuários. corretor: acesso restrito —
  // só visualiza imóveis e atende leads pelo kanban/lista/agenda, sem editar cadastro.
  const ROLE_PERMISSIONS = {
    master: { dashboard: true, kanban: true, leads: true, leadsExport: true, properties: true, propertiesEdit: true, blog: true, blogEdit: true, testimonials: true, testimonialsEdit: true, integrations: true, agenda: true, site: true, users: true, settings: true },
    gerente: { dashboard: true, kanban: true, leads: true, leadsExport: true, properties: true, propertiesEdit: true, blog: true, blogEdit: true, testimonials: true, testimonialsEdit: true, integrations: false, agenda: true, site: false, users: false, settings: true },
    corretor: { dashboard: true, kanban: true, leads: true, leadsExport: false, properties: true, propertiesEdit: false, blog: true, blogEdit: false, testimonials: true, testimonialsEdit: false, integrations: false, agenda: true, site: false, users: false, settings: true }
  };

  function get(key, seed) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    try { localStorage.setItem(key, JSON.stringify(seed)); } catch (e) {}
    return JSON.parse(JSON.stringify(seed));
  }
  function set(key, val) {
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

  window.CRMData = {
    MAX_PROPERTIES,
    resizeImage,
    propertyCode: (id) => 'EO-' + String(id).padStart(4, '0'),
    // ---- Video storage (IndexedDB) ----
    // Video files are too large for localStorage (5-10MB quota) — storing 20 photos +
    // videos as base64 in the same JSON blob reliably blows the quota and silently
    // drops the whole save. Videos go into IndexedDB instead; only a small reference
    // key ("idbvideo:xxxx") is kept in the property record stored in localStorage.
    _openMediaDB: function () {
      return new Promise((resolve, reject) => {
        if (!window.indexedDB) { reject(new Error('no indexeddb')); return; }
        const req = indexedDB.open('edina_media_db', 1);
        req.onupgradeneeded = () => { req.result.createObjectStore('media'); };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
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
    getFontScale: () => { try { return parseInt(localStorage.getItem('edina_font_scale') || '100', 10); } catch (e) { return 100; } },
    setFontScale: (val) => { try { localStorage.setItem('edina_font_scale', String(val)); } catch (e) {} },
    applyFontScale: () => {
      let val = 100;
      try { val = parseInt(localStorage.getItem('edina_font_scale') || '100', 10); } catch (e) {}
      document.body.style.zoom = (val / 100);
      return val;
    },
    getProperties: () => get(LS.properties, seedProperties),
    saveProperties: (arr) => set(LS.properties, arr),
    getLeads: () => get(LS.leads, seedLeads),
    saveLeads: (arr) => set(LS.leads, arr),
    addLead: (lead) => {
      const leads = get(LS.leads, seedLeads);
      const nextId = leads.reduce((m, l) => Math.max(m, l.id), 0) + 1;
      const today = new Date();
      const months = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
      const dateLabel = `${String(today.getDate()).padStart(2,'0')} ${months[today.getMonth()]} ${today.getFullYear()}`;
      const full = { id: nextId, stage: "novo", value: 0, date: dateLabel, status: "aberto", assignedTo: "", timeline: [], attachments: [], offeredProperties: [], ...lead };
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
    getPosts: () => get(LS.posts, seedPosts),
    savePosts: (arr) => set(LS.posts, arr),
    getVisits: () => get(LS.visits, seedVisits),
    saveVisits: (arr) => set(LS.visits, arr),
    getTestimonials: () => get(LS.testimonials, seedTestimonials),
    saveTestimonials: (arr) => set(LS.testimonials, arr),
    getIntegrations: () => get(LS.integrations, { facebook: false, googleAds: false, apiKey: "eo_live_9f3a1c7d2b4e6f80", webhook: "" }),
    saveIntegrations: (obj) => set(LS.integrations, obj),
    getSiteContent: () => {
      const sc = get(LS.site, seedSiteContent);
      if (!sc.theme) sc.theme = { ...seedSiteContent.theme };
      else sc.theme = { ...seedSiteContent.theme, ...sc.theme };
      return sc;
    },
    saveSiteContent: (obj) => set(LS.site, obj),
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
