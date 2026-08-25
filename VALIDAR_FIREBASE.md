# ✅ Validar se Firebase está Funcionando

## 1. Verificar Credenciais Firebase

Arquivo: `deploy/firebase-config.js`

Deve conter:
```javascript
window.EDINA_FIREBASE_CONFIG = {
  apiKey: "AIzaSy...",
  authDomain: "site-edina-final.firebaseapp.com",
  projectId: "site-edina-final",
  ...
};
```

✅ **Seu projeto está configurado com:**
- `projectId: "site-edina-final"`
- `authDomain: "site-edina-final.firebaseapp.com"`

---

## 2. Testar Localmente

### No navegador (abrir `deploy/index.html`):

1. Abra `index.html` no navegador
2. Abra Console (F12 → Console)
3. Digite:
   ```javascript
   console.log(window.EDINA_FIREBASE_CONFIG);
   ```
   
   Deve mostrar a configuração

4. Teste o formulário de contato:
   - Preencha: Nome, Email, Mensagem
   - Clique "Enviar Mensagem"
   - Se sucesso: mensagem "Mensagem enviada!"
   - Se erro: verifique console

---

## 3. Verificar Leads no Firebase

### No Firebase Console:

1. Acesse https://console.firebase.google.com
2. Projeto: **site-edina-final**
3. Menu esquerdo: **Firestore Database**
4. Coleção: **edina**
5. Documento: **leads**

Você verá um array com todos os contatos enviados:
```json
{
  "data": [
    {
      "id": 1,
      "name": "João Silva",
      "email": "joao@email.com",
      "phone": "(47) 9999-1234",
      "interest": "Comprar",
      "message": "Gostaria de visitar...",
      "createdAt": "2026-08-24T10:30:00Z",
      "status": "novo"
    }
  ]
}
```

---

## 4. O Que Cada Arquivo Faz

| Arquivo | Função |
|---------|--------|
| `firebase-config.js` | Credenciais do Firebase |
| `firebase-db.js` | Conecta ao Firestore, salva imóveis/posts |
| `contact-firebase.js` | **[NOVO]** Salva contatos do formulário |
| `crm-data.js` | Gerencia dados locais (fallback) |
| `index.html` | Site principal com formulário |
| `crm.dc.html` | Painel de administração |

---

## 5. Fluxo de Dados

```
Visitante preenche formulário
        ↓
submitForm() (em index.html)
        ↓
ContactFirebase.saveLead() (novo arquivo)
        ↓
Firebase Firestore (colection: edina, doc: leads)
        ↓
Você vê no Firebase Console / CRM Panel
```

---

## 6. Troubleshooting

### "Firebase não está disponível"
- Verifique internet
- Verifique `firebase-config.js` tem valores reais
- Firewall pode estar bloqueando firebase.com

### "Lead não aparece no Firebase"
- Abra Console (F12)
- Procure por erros em vermelho
- Verifique se `projectId` está correto
- Permissões: No Firebase Console, vá para Firestore → Regras
  - Deve permitir leitura/escrita

### Regras de Segurança (se erros de permissão)

No Firebase Console → Firestore → Rules:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /edina/{document=**} {
      allow read, write: if request.auth != null || true;
    }
    match /edina_analytics/{document=**} {
      allow read, write;
    }
    match /edina_notifications/{document=**} {
      allow read, write;
    }
  }
}
```

Clique "Publish"

---

## 7. Monitorar Contatos

### Option A: Firebase Console (em tempo real)
- Vá para Firestore → edina → leads
- Refreshe para ver novos contatos

### Option B: CRM do seu site
- `seu-site.vercel.app/crm.dc.html`
- Veja todos os leads em "Painel CRM"

---

## ✅ Checklist Final

- [ ] `firebase-config.js` tem valores reais
- [ ] Nenhum erro no console ao carregar
- [ ] Formulário consegue enviar mensagem
- [ ] Firebase Console mostra novo documento em "leads"
- [ ] Site ativa em `seu-site.vercel.app`

Tudo verificado? 🎉 Seu site está pronto para produção!
