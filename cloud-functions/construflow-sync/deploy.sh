#!/bin/bash

# Deploy da Cloud Function: Construflow → BigQuery Sync
# Executa este script a partir da pasta cloud-functions/construflow-sync/

set -e

echo "🚀 Iniciando deploy da Cloud Function: construflow-sync"

# Configurações
FUNCTION_NAME="construflow-sync"
REGION="southamerica-east1"
RUNTIME="nodejs20"
ENTRY_POINT="syncConstruflowToBigQuery"
TIMEOUT="3600s"  # 1 hora para acomodar volume de dados
MEMORY="1GB"

# Verificar se está na pasta correta
if [ ! -f "package.json" ]; then
  echo "❌ Erro: Execute este script a partir da pasta cloud-functions/construflow-sync/"
  exit 1
fi

# Verificar se .env.yaml existe
if [ ! -f ".env.yaml" ]; then
  echo "❌ Erro: Arquivo .env.yaml não encontrado"
  exit 1
fi

# Deploy
echo "📦 Fazendo deploy..."
gcloud functions deploy $FUNCTION_NAME \
  --gen2 \
  --runtime=$RUNTIME \
  --region=$REGION \
  --source=. \
  --entry-point=$ENTRY_POINT \
  --trigger-http \
  --allow-unauthenticated \
  --timeout=$TIMEOUT \
  --memory=$MEMORY \
  --env-vars-file=.env.yaml

echo ""
echo "✅ Deploy concluído!"
echo ""

# Obter URL da função
FUNCTION_URL=$(gcloud functions describe $FUNCTION_NAME --region=$REGION --gen2 --format="value(serviceConfig.uri)")
echo "🔗 URL da função: $FUNCTION_URL"
echo ""

# Criar/atualizar Cloud Scheduler job
echo "⏰ Configurando Cloud Scheduler (execução a cada hora)..."
JOB_NAME="construflow-sync-hourly"

# Verificar se o job já existe
if gcloud scheduler jobs describe $JOB_NAME --location=$REGION &>/dev/null; then
  echo "   Job existente encontrado, atualizando..."
  gcloud scheduler jobs update http $JOB_NAME \
    --location=$REGION \
    --schedule="0 * * * *" \
    --uri="$FUNCTION_URL" \
    --http-method=POST \
    --attempt-deadline=540s
else
  echo "   Criando novo job..."
  gcloud scheduler jobs create http $JOB_NAME \
    --location=$REGION \
    --schedule="0 * * * *" \
    --uri="$FUNCTION_URL" \
    --http-method=POST \
    --attempt-deadline=540s
fi

echo ""
echo "✅ Cloud Scheduler configurado: $JOB_NAME"
echo "   Schedule: 0 * * * * (a cada hora, minuto 0)"
echo ""

# Testar a função
echo "🧪 Deseja testar a função agora? (y/n)"
read -r response
if [[ "$response" =~ ^[Yy]$ ]]; then
  echo "   Executando teste..."
  curl -X POST "$FUNCTION_URL" -H "Content-Type: application/json" -d '{}'
fi

echo ""
echo "🎉 Setup completo!"
echo "   - Cloud Function: $FUNCTION_NAME"
echo "   - Cloud Scheduler: $JOB_NAME"
echo "   - Region: $REGION"
