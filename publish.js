// Gera o "pacote de publicação": transforma o que está cadastrado neste navegador em
// arquivos (data/site-data.json + data/fotos/*.jpg) que, subidos junto com o site, passam a
// ser o conteúdo visto por TODOS os visitantes, em qualquer navegador.
//
// Traz um escritor de ZIP mínimo (método "store", sem compressão) para não depender de
// biblioteca externa — as fotos já são JPEG, comprimir de novo não ganharia nada.
(function () {
  if (window.SitePublish) return;

  const crcTable = (function () {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function zip(files) {
    const enc = new TextEncoder();
    const chunks = [];
    const central = [];
    let offset = 0;

    files.forEach(f => {
      const nameBytes = enc.encode(f.name);
      const data = f.bytes;
      const crc = crc32(data);

      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);
      local.setUint16(6, 0, true);
      local.setUint16(8, 0, true);       // store
      local.setUint16(10, 0, true);
      local.setUint16(12, 0, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, data.length, true);
      local.setUint32(22, data.length, true);
      local.setUint16(26, nameBytes.length, true);
      local.setUint16(28, 0, true);
      chunks.push(new Uint8Array(local.buffer), nameBytes, data);

      const cd = new DataView(new ArrayBuffer(46));
      cd.setUint32(0, 0x02014b50, true);
      cd.setUint16(4, 20, true);
      cd.setUint16(6, 20, true);
      cd.setUint16(8, 0, true);
      cd.setUint16(10, 0, true);
      cd.setUint16(12, 0, true);
      cd.setUint16(14, 0, true);
      cd.setUint32(16, crc, true);
      cd.setUint32(20, data.length, true);
      cd.setUint32(24, data.length, true);
      cd.setUint16(28, nameBytes.length, true);
      cd.setUint16(30, 0, true);
      cd.setUint16(32, 0, true);
      cd.setUint16(34, 0, true);
      cd.setUint16(36, 0, true);
      cd.setUint32(38, 0, true);
      cd.setUint32(42, offset, true);
      central.push(new Uint8Array(cd.buffer), nameBytes);

      offset += 30 + nameBytes.length + data.length;
    });

    let centralSize = 0;
    central.forEach(c => { centralSize += c.length; });

    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, centralSize, true);
    end.setUint32(16, offset, true);

    return new Blob([...chunks, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
  }

  function dataUrlToBytes(dataUrl) {
    const comma = dataUrl.indexOf(',');
    const binary = atob(dataUrl.slice(comma + 1));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function extFor(dataUrl) {
    const mime = (dataUrl.match(/^data:([^;]+)/) || [])[1] || '';
    if (/png/.test(mime)) return 'png';
    if (/webp/.test(mime)) return 'webp';
    if (/mpeg|mp3/.test(mime)) return 'mp3';
    if (/wav/.test(mime)) return 'wav';
    if (/ogg/.test(mime)) return 'ogg';
    if (/m4a|mp4|aac/.test(mime)) return 'm4a';
    return 'jpg';
  }

  // Percorre os dados trocando cada chave de mídia por um caminho de arquivo, coletando os
  // arquivos correspondentes.
  async function buildRaw(onProgress, scope) {
    scope = scope || 'all';
    const D = window.CRMData;
    const files = [];
    const seen = {};
    let n = 0;

    const report = (msg) => { if (onProgress) onProgress(msg); };

    async function fileFor(key) {
      if (!key || typeof key !== 'string') return key || '';
      if (key.indexOf('data:') !== 0 && !/^idb(photo|audio|video):/.test(key)) return key; // já é caminho
      if (seen[key]) return seen[key];
      let dataUrl = key;
      if (/^idb/.test(key)) {
        await D.warm([key]);
        dataUrl = D.photoURL(key);
        if (!dataUrl) {
          // Vídeos não entram no cache de fotos; busca direto no banco de mídia.
          try { dataUrl = await D.getMediaRaw(key); } catch (e) { dataUrl = ''; }
        }
      }
      if (!dataUrl || dataUrl.indexOf('data:') !== 0) return '';
      const ext = extFor(dataUrl);
      const folder = ext === 'mp3' || ext === 'wav' || ext === 'ogg' || ext === 'm4a' ? 'audio' : 'fotos';
      const name = `data/${folder}/${String(++n).padStart(4, '0')}.${ext}`;
      files.push({ name, bytes: dataUrlToBytes(dataUrl) });
      seen[key] = name;
      return name;
    }

    report('Lendo os imóveis…');
    let props;
    if (scope === 'content') {
      let published = null;
      try {
        const res = await fetch('./data/site-data.json', { cache: 'no-cache' });
        if (res.ok) published = await res.json();
      } catch (e) {}
      props = published ? published.properties : null;
    }
    if (!props) {
      props = JSON.parse(JSON.stringify(D.getPropertiesRaw()));
      for (let i = 0; i < props.length; i++) {
        const p = props[i];
        report(`Preparando fotos do imóvel ${i + 1} de ${props.length}…`);
        if (p.image) p.image = await fileFor(p.image);
        if (Array.isArray(p.images)) {
          const out = [];
          for (const img of p.images) { const f = await fileFor(img); if (f) out.push(f); }
          p.images = out;
        }
        if (p.videoFile) p.videoFile = await fileFor(p.videoFile);
      }
    }

    report('Preparando imagens do site…');
    let site, posts, testimonials;
    if (scope === 'properties') {
      // Sincronização estreita: usa o que já está publicado para site/blog/depoimentos, sem
      // tocar nas fotos deles — só imóveis (dados + fotos) entram nesta publicação.
      let published = null;
      try {
        const res = await fetch('./data/site-data.json', { cache: 'no-cache' });
        if (res.ok) published = await res.json();
      } catch (e) {}
      if (published) {
        site = published.site || {};
        posts = published.posts || [];
        testimonials = published.testimonials || [];
      }
    }
    if (!site) {
      site = JSON.parse(JSON.stringify(D.getSiteContentRaw()));
      for (const k of ['logoUrl', 'signatureUrl', 'heroImage', 'spotlightImage', 'aboutImage', 'watermarkLogoUrl', 'faviconUrl']) {
        if (site[k]) site[k] = await fileFor(site[k]);
      }
      if (Array.isArray(site.heroSlides)) {
        const slides = [];
        for (const s of site.heroSlides) slides.push(s ? await fileFor(s) : '');
        site.heroSlides = slides;
      }
    }

    report('Preparando blog e depoimentos…');
    if (!posts) {
      posts = JSON.parse(JSON.stringify(D.getPostsRaw()));
      for (const p of posts) { if (p.image) p.image = await fileFor(p.image); }
    }
    if (!testimonials) {
      testimonials = JSON.parse(JSON.stringify(D.getTestimonialsRaw()));
      for (const t of testimonials) {
        if (t.audioUrl) t.audioUrl = await fileFor(t.audioUrl);
        if (t.image) t.image = await fileFor(t.image);
      }
    }

    const payload = {
      version: 1,
      publishedAt: new Date().toISOString(),
      properties: props,
      site: site,
      posts: posts,
      testimonials: testimonials
    };
    files.unshift({ name: 'data/site-data.json', bytes: new TextEncoder().encode(JSON.stringify(payload)) });

    // sitemap.xml e robots.txt: o Google precisa deles para encontrar e indexar cada imóvel
    // e cada artigo. São regerados a cada publicação, sempre com as páginas que existem hoje.
    const base = (site.canonicalUrl || '').replace(/\/+$/, '');
    if (base && (!scope || scope === 'content' || scope === 'properties')) {
      const today = new Date().toISOString().slice(0, 10);
      const url = (path, priority, freq) =>
        `  <url><loc>${base}${path}</loc><lastmod>${today}</lastmod><changefreq>${freq}</changefreq><priority>${priority}</priority></url>`;
      const entries = [
        url('/', '1.0', 'daily'),
        url('/imoveis.dc.html', '0.9', 'daily'),
        url('/blog.dc.html', '0.7', 'weekly'),
        ...props.filter(p => p.published !== false).map(p => url(`/imovel-detalhe.dc.html?id=${p.id}`, '0.8', 'weekly')),
        ...posts.filter(p => p.status === 'publicado').map(p => url(`/blog-post.dc.html?id=${p.id}`, '0.6', 'monthly'))
      ];
      const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;
      const indexable = site.seoIndexable !== false;
      const robots = indexable
        ? `User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`
        : `User-agent: *\nDisallow: /\n`;
      files.push({ name: 'sitemap.xml', bytes: new TextEncoder().encode(sitemap) });
      files.push({ name: 'robots.txt', bytes: new TextEncoder().encode(robots) });
    }

    return files;
  }

  // Só monta a lista de arquivos (sem compactar) — usada pela publicação direta no GitHub.
  async function buildFiles(onProgress, scope) {
    const files = await buildRaw(onProgress, scope);
    return files;
  }

  async function build(onProgress) {
    const files = await buildRaw(onProgress);
    if (onProgress) onProgress('Compactando…');
    return { blob: zip(files), files: files, count: files.length - 1, bytes: files.reduce((s, f) => s + f.bytes.length, 0) };
  }

  window.SitePublish = { build: build, buildFiles: buildFiles };
})();
