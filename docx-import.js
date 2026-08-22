// Leitor de .docx no próprio navegador: abre o zip, extrai o texto e as fotos.
// Usado pela área "Importar Arquivos" do CRM para cadastrar empreendimentos em lote.
(function () {
  function u16(b, o) { return b[o] | b[o + 1] << 8; }
  function u32(b, o) { return (b[o] | b[o + 1] << 8 | b[o + 2] << 16 | b[o + 3] << 24) >>> 0; }

  function readZip(bytes) {
    let eocd = -1;
    for (let i = bytes.length - 22; i >= 0; i--) { if (u32(bytes, i) === 0x06054b50) { eocd = i; break; } }
    if (eocd < 0) throw new Error('Arquivo não é um .docx válido.');
    const cdOff = u32(bytes, eocd + 16), count = u16(bytes, eocd + 10);
    const map = {};
    let p = cdOff;
    for (let i = 0; i < count; i++) {
      const nameLen = u16(bytes, p + 28), extraLen = u16(bytes, p + 30), cmtLen = u16(bytes, p + 32);
      const name = new TextDecoder().decode(bytes.slice(p + 46, p + 46 + nameLen));
      map[name] = { off: u32(bytes, p + 42), method: u16(bytes, p + 10), csize: u32(bytes, p + 20) };
      p += 46 + nameLen + extraLen + cmtLen;
    }
    return map;
  }

  async function entry(bytes, map, name) {
    const e = map[name];
    if (!e) return null;
    const nameLen = u16(bytes, e.off + 26), extraLen = u16(bytes, e.off + 28);
    const start = e.off + 30 + nameLen + extraLen;
    const data = bytes.slice(start, start + e.csize);
    if (e.method === 0) return data;
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  function decodeEntities(s) {
    return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  }

  function blobToDataUrl(blob) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = rej;
      fr.readAsDataURL(blob);
    });
  }

  async function parse(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const map = readZip(bytes);
    const docBytes = await entry(bytes, map, 'word/document.xml');
    if (!docBytes) throw new Error('Documento sem conteúdo legível.');
    const xml = new TextDecoder().decode(docBytes);

    // Texto: um parágrafo por linha, preservando a ordem do documento.
    const paras = xml.split(/<w:p[ >]/).slice(1);
    const lines = [];
    paras.forEach(p => {
      const txt = (p.match(/<w:t[^>]*>[\s\S]*?<\/w:t>/g) || [])
        .map(t => decodeEntities(t.replace(/<[^>]+>/g, ''))).join('');
      if (txt.trim()) lines.push(txt.trim());
    });

    // Fotos: tudo em word/media, na ordem numérica do nome.
    const mediaNames = Object.keys(map)
      .filter(n => /^word\/media\/.+\.(jpe?g|png|webp)$/i.test(n))
      .sort((a, b) => {
        const na = parseInt((a.match(/(\d+)\./) || [])[1] || '0', 10);
        const nb = parseInt((b.match(/(\d+)\./) || [])[1] || '0', 10);
        return na - nb;
      });
    const images = [];
    for (const n of mediaNames) {
      const raw = await entry(bytes, map, n);
      if (!raw) continue;
      const type = /\.png$/i.test(n) ? 'image/png' : /\.webp$/i.test(n) ? 'image/webp' : 'image/jpeg';
      images.push(await blobToDataUrl(new Blob([raw], { type })));
    }

    const name = (file.name || '').replace(/\.docx?$/i, '').trim();
    return { name: name, lines: lines, text: lines.join('\n'), images: images };
  }

  window.DocxImport = { parse: parse };
})();
