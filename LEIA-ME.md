# Pacote pronto para hospedar o site da Edina Oliveira

## O que tem aqui
Todos os arquivos do site (Início, Imóveis, Detalhe do Imóvel, Blog, Favoritos e o painel CRM) mais as imagens usadas. `index.html` é a página inicial — obrigatória para o site abrir na raiz do domínio.

## Como colocar no ar (Vercel — grátis)
1. Crie uma conta em vercel.com (pode usar o Google).
2. No painel, clique em "Add New… → Project".
3. Escolha a opção de upload/arrastar pasta ("Deploy" sem Git) e arraste esta pasta `deploy` inteira.
4. Aguarde o deploy — a Vercel te dá um link tipo `seusite.vercel.app` já funcionando.
5. Teste o link no celular e no computador antes de apontar o domínio.

## Como ativar o domínio próprio
1. Compre o domínio (ex: registro.br para .com.br, ~R$40/ano).
2. No painel da Vercel, vá em Project → Settings → Domains → adicione o domínio comprado.
3. A Vercel mostra os registros DNS que você precisa colocar no painel do domínio (geralmente um registro tipo A e/ou CNAME).
4. Cole esses registros no painel do registro.br (ou onde comprou o domínio). Pode levar algumas horas para propagar.

## Atualizações futuras
Qualquer alteração no site (novo imóvel, texto, cor, nova função) continua sendo feita no projeto original — não editar estes arquivos direto. Depois de qualquer mudança, basta gerar este pacote de novo e repetir o passo de "Deploy" na Vercel (arrastar a pasta atualizada) — leva menos de um minuto.
