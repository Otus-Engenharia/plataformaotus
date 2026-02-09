# SmartSheet → BigQuery Sync

## Visão Geral

Cloud Function que sincroniza dados de planilhas do SmartSheet para o BigQuery automaticamente.

**Frequência:** A cada 1 hora
**Tabela destino:** `dadosindicadores.smartsheet.smartsheet_data_projetos`

---

## Arquitetura

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│  SmartSheet │────▶│  Cloud Function  │────▶│   BigQuery  │
│    (API)    │     │  (Node.js 20)    │     │   (Tabela)  │
└─────────────┘     └──────────────────┘     └─────────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │   Discord    │
                    │  (Alertas)   │
                    └──────────────┘
```

---

## Configuração

### 1. Variáveis de Ambiente

Arquivo: `cloud-functions/smartsheet-sync/.env.yaml`

| Variável | Descrição | Obrigatório |
|----------|-----------|-------------|
| `SMARTSHEET_ACCESS_TOKEN` | Token da API SmartSheet | ✅ |
| `SMARTSHEET_SHEET_IDS` | IDs das planilhas (vírgula) | ❌ |
| `BIGQUERY_PROJECT_ID` | Projeto GCP | ✅ |
| `BIGQUERY_DATASET` | Dataset BigQuery | ✅ |
| `BIGQUERY_TABLE` | Nome da tabela | ✅ |
| `DISCORD_WEBHOOK_URL` | Webhook para alertas | ❌ |
| `DISCORD_THREAD_ID` | ID do tópico Discord | ❌ |
| `SYNC_MODE` | `full` ou `incremental` | ❌ |

### 2. Token SmartSheet

1. Acesse: https://app.smartsheet.com/b/home
2. Vá em: **Conta** → **Aplicativos e Integrações** → **Acesso à API**
3. Gere um novo token de acesso
4. Copie o token (sem "Bearer ")

### 3. Thread ID do Discord

1. No Discord, ative o **Modo Desenvolvedor** (Configurações → Avançado)
2. Clique com botão direito no tópico
3. Selecione "Copiar ID"

---

## Deploy

### Requisitos
- Google Cloud CLI (`gcloud`) instalado e autenticado
- Permissões no projeto `dadosindicadores`

### Comandos

```bash
cd cloud-functions/smartsheet-sync

# Instalar dependências (apenas local)
npm install

# Deploy da função
./deploy.sh

# Deploy + criar scheduler
./deploy.sh --create-scheduler
```

### Manualmente

```bash
# Deploy da Cloud Function
gcloud functions deploy smartsheet-sync \
  --gen2 \
  --project=dadosindicadores \
  --region=southamerica-east1 \
  --runtime=nodejs20 \
  --entry-point=syncSmartsheetToBigQuery \
  --trigger-http \
  --timeout=540s \
  --memory=512MB \
  --env-vars-file=.env.yaml

# Criar Cloud Scheduler
gcloud scheduler jobs create http smartsheet-sync-hourly \
  --project=dadosindicadores \
  --location=southamerica-east1 \
  --schedule="0 * * * *" \
  --uri="URL_DA_FUNCAO" \
  --http-method=POST
```

---

## Monitoramento

### Ver Logs

```bash
gcloud functions logs read smartsheet-sync \
  --region=southamerica-east1 \
  --project=dadosindicadores \
  --limit=50
```

### Console

- **Cloud Functions:** https://console.cloud.google.com/functions?project=dadosindicadores
- **Cloud Scheduler:** https://console.cloud.google.com/cloudscheduler?project=dadosindicadores
- **BigQuery:** https://console.cloud.google.com/bigquery?project=dadosindicadores

---

## Verificação

Use o script de diagnóstico:

```bash
cd backend
node verificar-smartsheet-bigquery.mjs
```

Output esperado:
```
✅ Total de linhas: 63xxx
Última modificação da tabela: [data/hora recente]
⏰ Há X.X horas atrás
```

---

## Troubleshooting

### Erro: "SMARTSHEET_ACCESS_TOKEN não configurado"

**Causa:** Token não está no `.env.yaml`
**Solução:** Adicione o token no arquivo `.env.yaml`

### Erro: "Rate limit atingido"

**Causa:** SmartSheet limita a 300 requisições/minuto
**Solução:** A função já tem delay de 250ms entre requests. Se persistir, aumente o delay.

### Erro: "Nenhuma planilha encontrada"

**Causa:** Token inválido ou sem permissão nas planilhas
**Solução:**
1. Verifique se o token está correto
2. Confirme que o usuário do token tem acesso às planilhas

### Dados não atualizam

**Verificar:**
1. Cloud Scheduler está ativo? (`gcloud scheduler jobs list`)
2. Última execução teve erro? (ver logs)
3. Tabela existe? (`verificar-smartsheet-bigquery.mjs`)

---

## Manutenção

### Renovar Token

O token do SmartSheet pode expirar. Para renovar:

1. Gere novo token no SmartSheet
2. Atualize `.env.yaml`
3. Redeploy: `./deploy.sh`

### Atualizar Código

```bash
cd cloud-functions/smartsheet-sync
# Faça alterações no index.js
./deploy.sh
```

---

## Histórico de Versões

| Versão | Data | Descrição |
|--------|------|-----------|
| 2.0.0 | 05/02/2026 | Reescrita completa com retry, logging estruturado e Discord |
| 1.0.0 | Nov/2025 | Versão original (smartsheetbigqueryupadter) - descontinuada |
