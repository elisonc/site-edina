# 🚀 Guia: Publicar seu Site Edina Oliveira

## Opção 1: Vercel (Recomendado - Mais Fácil)

### Passo 1: Criar conta no Vercel
1. Acesse https://vercel.com
2. Clique em "Sign Up" 
3. Use sua conta GitHub, GitLab ou email

### Passo 2: Preparar arquivos para upload
- A pasta `deploy/` contém TODOS os arquivos que você precisa publicar
- Nenhuma configuração adicional é necessária

### Passo 3: Deploy via Vercel
**Opção A - Arrastar e soltar (mais fácil):**
1. No Vercel dashboard, clique em "Add New..." → "Project"
2. Selecione "Deploy for free without connecting Git"
3. Arraste a pasta `deploy/` para a área de upload
4. Pronto! Seu site estará online em segundos

**Opção B - Via Git (mais profissional):**
1. Faça um commit dos arquivos no Git
2. Crie um repo no GitHub
3. No Vercel, conecte seu repo
4. Vercel fará deploy automático

### Resultado
- URL do site: `seu-site.vercel.app`
- SSL/HTTPS automático
- Domínio personalizado: adicione em Vercel → Settings → Domains

---

## Opção 2: Netlify (Alternativa)

1. Acesse https://netlify.com
2. Clique em "Sign up"
3. Arraste a pasta `deploy/` para a área de upload
4. Pronto!

---

## Opção 3: Seu próprio servidor

Se tiver um servidor (cPanel, Plesk, etc):
1. Faça upload de TODOS os arquivos da pasta `deploy/` via FTP
2. Configure seu domínio para apontar ao servidor
3. Pronto!

---

## ✅ Checklist Antes de Publicar

- [ ] Firebase está configurado (verifique `firebase-config.js`)
- [ ] Formulário de contato está funcionando (teste localmente)
- [ ] Imagens e vídeos têm URLs corretas
- [ ] Links internos funcionam (.dc.html files estão corretos)
- [ ] Informações de contato estão atualizadas em `SITE_INFO`

---

## 📊 Monitorar após publicar

### Dashboard Firebase (ver leads/contatos):
1. Acesse https://console.firebase.google.com
2. Projeto: "site-edina-final"
3. Firestore → Coleção "edina" → Documento "leads"
4. Cada contato do formulário aparecerá lá automaticamente!

### Acesso ao CRM
- URL: `seu-site.vercel.app/crm.dc.html`
- Gerenciar imóveis, posts e leads de lá

---

## 🔗 Links Úteis

- Vercel Docs: https://vercel.com/docs
- Firebase Console: https://console.firebase.google.com
- Seu site Demo: `seu-site.vercel.app`

---

## Suporte

Se tiver problemas:
1. Verifique se Firebase está ativo
2. Verifique console do navegador (F12 → Console)
3. Verifique se formAccessKey está configurado para emails
