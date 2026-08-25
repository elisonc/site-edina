// Publicação direta no GitHub: envia os dados do CRM (imóveis, fotos, conteúdo do site) como
// um commit no repositório. A Vercel detecta o commit e republica sozinha — então um clique
// aqui deixa os imóveis permanentes e visíveis para todos os visitantes.
//
// O token de acesso fica APENAS no navegador de quem administra (localStorage). Ele nunca é
// gravado nos arquivos do site, então não vaza para os visitantes.
(function () {
  if (window.GitHubPublish) return;

  const CFG = 'edina_gh_config';

  function getConfig() {
    try { return JSON.parse(localStorage.getItem(CFG) || '{}'); } catch (e) { return {}; }
  }
  function saveConfig(cfg) {
    try { localStorage.setItem(CFG, JSON.stringify(cfg)); return true; } catch (e) { return false; }
  }

  function bytesToBase64(bytes) {
    let out = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      out += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(out);
  }

  async function api(cfg, path, options) {
    const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}${path}`;
    const res = await fetch(url, Object.assign({
      headers: {
        'Authorization': 'Bearer ' + cfg.token,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      }
    }, options || {}));
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json()).message || ''; } catch (e) {}
      if (res.status === 401) throw new Error('Token inválido ou expirado. Gere um novo no GitHub.');
      if (res.status === 403) throw new Error('Token sem permissão de escrita neste repositório.');
      if (res.status === 404) throw new Error('Repositório ou branch não encontrado. Confira o nome e a permissão do token.');
      throw new Error(`GitHub respondeu ${res.status}. ${detail}`);
    }
    return res.status === 204 ? null : res.json();
  }

  async function test(cfg) {
    const repo = await api(cfg, '');
    if (repo.permissions && !repo.permissions.push) {
      throw new Error('O token não tem permissão para gravar neste repositório.');
    }
    return { name: repo.full_name, branch: cfg.branch || repo.default_branch };
  }

  async function hashBytes(bytes) {
    const buf = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  function manifestKey(cfg, base) { return `edina_gh_manifest__${cfg.owner}/${cfg.repo}__${base}`; }
  function loadManifest(cfg, base) {
    try { return JSON.parse(localStorage.getItem(manifestKey(cfg, base)) || '{}'); } catch (e) { return {}; }
  }
  function saveManifest(cfg, base, manifest) {
    try { localStorage.setItem(manifestKey(cfg, base), JSON.stringify(manifest)); } catch (e) {}
  }

  // Envia só o que mudou desde a última sincronização, como UM commit: compara o hash de cada
  // arquivo com o que já foi enviado antes (guardado neste navegador), cria blob só para o que
  // é novo ou diferente, remove do site o que saiu da lista, e deixa tudo que não mudou intacto
  // (o Git já mantém o resto da árvore sozinho quando não é mencionado no commit).
  async function publish(files, onProgress, fullSet) {
    if (fullSet === undefined) fullSet = true;
    const cfg = getConfig();
    if (!cfg.token) throw new Error('Configure o token de acesso do GitHub antes de publicar.');
    if (!cfg.owner || !cfg.repo) throw new Error('Configure o repositório antes de publicar.');
    const branch = cfg.branch || 'main';
    const base = (cfg.path || '').replace(/^\/+|\/+$/g, '');
    const report = (m) => { if (onProgress) onProgress(m); };

    report('Verificando o que mudou…');
    const manifest = loadManifest(cfg, base);
    const newManifest = {};
    const fullPaths = new Set();
    const toUpload = [];
    for (const f of files) {
      const fullPath = base ? `${base}/${f.name}` : f.name;
      fullPaths.add(fullPath);
      const hash = await hashBytes(f.bytes);
      newManifest[fullPath] = hash;
      if (manifest[fullPath] !== hash) toUpload.push({ f, fullPath });
    }
    const toDelete = fullSet ? Object.keys(manifest).filter(p => !fullPaths.has(p)) : [];

    if (toUpload.length === 0 && toDelete.length === 0) {
      report('Nada mudou desde a última sincronização — site já está atualizado.');
      return { commit: null, commitFull: null, files: 0, skipped: files.length };
    }

    report('Conectando ao GitHub…');
    const ref = await api(cfg, `/git/ref/heads/${encodeURIComponent(branch)}`);
    const headSha = ref.object.sha;
    const headCommit = await api(cfg, `/git/commits/${headSha}`);

    const tree = [];
    for (let i = 0; i < toUpload.length; i++) {
      const { f, fullPath } = toUpload[i];
      report(`Enviando ${i + 1} de ${toUpload.length} arquivos alterados: ${f.name.split('/').pop()}`);
      const blob = await api(cfg, '/git/blobs', {
        method: 'POST',
        body: JSON.stringify({ content: bytesToBase64(f.bytes), encoding: 'base64' })
      });
      tree.push({ path: fullPath, mode: '100644', type: 'blob', sha: blob.sha });
    }
    for (const p of toDelete) tree.push({ path: p, mode: '100644', type: 'blob', sha: null });

    report('Criando o commit…');
    const newTree = await api(cfg, '/git/trees', {
      method: 'POST',
      body: JSON.stringify({ base_tree: headCommit.tree.sha, tree: tree })
    });
    const commit = await api(cfg, '/git/commits', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Publicar conteúdo do site (' + new Date().toLocaleString('pt-BR') + ')',
        tree: newTree.sha,
        parents: [headSha]
      })
    });
    await api(cfg, `/git/refs/heads/${encodeURIComponent(branch)}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: commit.sha })
    });

    saveManifest(cfg, base, fullSet ? newManifest : Object.assign({}, manifest, newManifest));
    report(`Publicado! ${toUpload.length} arquivo(s) alterado(s), ${toDelete.length} removido(s). A hospedagem republica o site em cerca de 1 minuto.`);
    return { commit: commit.sha.slice(0, 7), commitFull: commit.sha, files: toUpload.length };
  }

  // Move a branch de volta para um commit anterior — usado para desfazer uma sincronização ruim.
  async function revertToCommit(sha) {
    const cfg = getConfig();
    if (!cfg.token) throw new Error('Configure o token de acesso do GitHub antes de reverter.');
    const branch = cfg.branch || 'main';
    await api(cfg, `/git/refs/heads/${encodeURIComponent(branch)}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: sha, force: true })
    });
    // O conteúdo remoto voltou para uma versão antiga — o cache de "o que já foi enviado"
    // não vale mais, senão a próxima sincronização pensaria que nada mudou.
    const base = (cfg.path || '').replace(/^\/+|\/+$/g, '');
    localStorage.removeItem(manifestKey(cfg, base));
    return { ok: true };
  }

  window.GitHubPublish = {
    getConfig: getConfig,
    saveConfig: saveConfig,
    test: test,
    publish: publish,
    revertToCommit: revertToCommit
  };
})();
