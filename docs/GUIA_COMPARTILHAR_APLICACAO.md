# Guia: Como Compartilhar a Aplicação

Existem várias formas de compartilhar a aplicação com outras pessoas. Escolha a melhor opção para seu caso:

## 🚀 Opção 1: Deploy em Produção (Recomendado para uso permanente)

### Vantagens:
- ✅ Acesso 24/7 de qualquer lugar
- ✅ URL permanente (ex: `https://indicadores.otusengenharia.com`)
- ✅ Mais seguro e profissional
- ✅ Melhor performance

### Opções de Hospedagem:

#### **A) Vercel (Mais fácil - Recomendado)**
- **Frontend**: Deploy automático via GitHub
- **Backend**: Usa Vercel Serverless Functions
- **Custo**: Gratuito para começar
- **Passos**:
  1. Criar conta no [Vercel](https://vercel.com)
  2. Conectar repositório GitHub
  3. Configurar variáveis de ambiente
  4. Deploy automático

#### **B) Railway / Render**
- **Backend + Frontend**: Deploy completo
- **Custo**: ~$5-10/mês
- **Passos**: Similar ao Vercel

#### **C) Google Cloud Run** (Se já usa GCP)
- Integração nativa com BigQuery
- Escala automaticamente
- Custo baseado em uso

---

## 🔗 Opção 2: Túnel Temporário (Para testes rápidos)

### Vantagens:
- ✅ Rápido de configurar (5 minutos)
- ✅ Não precisa deploy
- ✅ Ideal para testes

### Desvantagens:
- ❌ URL temporária (muda a cada reinício)
- ❌ Pode ser lento
- ❌ Não recomendado para produção

### Ferramentas:

#### **A) ngrok** (Mais popular)
```bash
# 1. Instalar ngrok: https://ngrok.com/download
# 2. Criar conta gratuita
# 3. Autenticar:
ngrok config add-authtoken SEU_TOKEN

# 4. Expor o backend (porta 3001):
ngrok http 3001

# 5. Expor o frontend (porta 5173):
ngrok http 5173
```

**Resultado**: Você receberá URLs como:
- Backend: `https://abc123.ngrok.io`
- Frontend: `https://xyz789.ngrok.io`

**⚠️ Importante**: Atualizar `FRONTEND_URL` no `.env` com a URL do ngrok.

#### **B) Cloudflare Tunnel** (Gratuito, mais estável)
```bash
# 1. Instalar cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
# 2. Criar túnel:
cloudflared tunnel --url http://localhost:3001
```

---

## 🌐 Opção 3: Acesso na Rede Local

### Quando usar:
- ✅ Todos estão na mesma rede (mesmo escritório/WiFi)
- ✅ Acesso rápido e direto
- ✅ Sem custos

### Configuração:

#### **1. Descobrir seu IP local:**
```powershell
# Windows PowerShell
ipconfig
# Procure por "IPv4 Address" (ex: 192.168.1.100)
```

#### **2. Modificar o servidor para aceitar conexões externas:**

**Backend (`server.js`):**
```javascript
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0'; // Aceita conexões de qualquer IP

app.listen(PORT, HOST, () => {
  console.log(`🚀 Servidor rodando em http://${HOST}:${PORT}`);
});
```

**Frontend (`vite.config.js`):**
```javascript
server: {
  host: '0.0.0.0', // Aceita conexões externas
  port: 5173,
  // ...
}
```

#### **3. Compartilhar o link:**
- Frontend: `http://SEU_IP:5173`
- Exemplo: `http://192.168.1.100:5173`

**⚠️ Avisos:**
- Firewall do Windows pode bloquear (precisa permitir)
- Funciona apenas na mesma rede
- IP pode mudar se desconectar/reconectar

---

## 📋 Checklist para Compartilhar

### Antes de compartilhar, verifique:

- [ ] **Variáveis de ambiente configuradas**:
  - `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` (OAuth)
  - `FRONTEND_URL` (URL do frontend em produção)
  - `SESSION_SECRET` (chave secreta forte)
  - Credenciais do BigQuery

- [ ] **CORS configurado corretamente**:
  - Backend permite a URL do frontend

- [ ] **HTTPS em produção** (obrigatório para OAuth):
  - Cookies de sessão precisam de HTTPS
  - Vercel/Railway já fornecem HTTPS

- [ ] **Domínio personalizado** (opcional):
  - Ex: `indicadores.otusengenharia.com`
  - Configurar DNS apontando para o servidor

---

## 🎯 Recomendação

Para uso com a **diretora e líderes de projeto**, recomendo:

1. **Curto prazo (testes)**: Usar **ngrok** ou **Cloudflare Tunnel**
2. **Longo prazo (produção)**: Deploy no **Vercel** ou **Railway**

Quer que eu te ajude a configurar alguma dessas opções?
