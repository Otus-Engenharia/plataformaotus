#!/bin/bash

# Deploy do Cloud Run Job: Construflow Comments Sync
# Este job pode rodar por horas (sem limite de timeout)

set -e

echo "🚀 Iniciando deploy do Cloud Run Job: construflow-comments-job"

# Configurações
JOB_NAME="construflow-comments-job"
REGION="southamerica-east1"
PROJECT_ID="dadosindicadores"
IMAGE="gcr.io/${PROJECT_ID}/${JOB_NAME}:latest"

# Verificar se está na pasta correta
if [ ! -f "package.json" ]; then
  echo "❌ Erro: Execute este script a partir da pasta cloud-functions/construflow-comments-job/"
  exit 1
fi

# Build da imagem
echo "📦 Fazendo build da imagem Docker..."
gcloud builds submit --tag $IMAGE .

# Deploy do Cloud Run Job
echo "🚀 Fazendo deploy do Cloud Run Job..."
gcloud run jobs deploy $JOB_NAME \
  --image=$IMAGE \
  --region=$REGION \
  --task-timeout=14400s \
  --memory=2Gi \
  --cpu=1 \
  --max-retries=1 \
  --set-env-vars="BIGQUERY_PROJECT_ID=dadosindicadores" \
  --set-env-vars="BIGQUERY_DATASET=construflow_data" \
  --set-env-vars="BIGQUERY_LOCATION=southamerica-east1" \
  --set-env-vars="CONSTRUFLOW_USERNAME=gerentes@otusengenharia.com" \
  --set-env-vars="CONSTRUFLOW_PASSWORD=Otus.2019" \
  --set-env-vars="CONSTRUFLOW_GRAPHQL_API_KEY=d02126c4c1d7ec0e903449eb38bf2a4b" \
  --set-env-vars="DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/1468557847112712265/xnKrdPssBB9YpoLgsOsnwyAbzsNah7aJ_ogzyH1VxP5b4-p6kFihY2kaWGyrQ38sJgg7" \
  --set-env-vars="DISCORD_THREAD_ID=1440419610611552519" \
  --set-env-vars="COMMENTS_BATCH_SIZE=25"

echo ""
echo "✅ Deploy concluído!"
echo ""

# Atualizar Cloud Scheduler para usar o novo job
echo "⏰ Atualizando Cloud Scheduler (construflow-comments-daily)..."

SCHEDULER_NAME="construflow-comments-daily"
SERVICE_ACCOUNT="scheduler-sa@${PROJECT_ID}.iam.gserviceaccount.com"

# Verificar se o job já existe
if gcloud scheduler jobs describe $SCHEDULER_NAME --location=$REGION &>/dev/null; then
  echo "   Job existente encontrado, atualizando..."
  gcloud scheduler jobs update http $SCHEDULER_NAME \
    --location=$REGION \
    --schedule="0 3 * * *" \
    --time-zone="America/Sao_Paulo" \
    --uri="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/${JOB_NAME}:run" \
    --http-method=POST \
    --oauth-service-account-email=$SERVICE_ACCOUNT \
    --oauth-token-scope="https://www.googleapis.com/auth/cloud-platform" \
    --attempt-deadline=600s \
    --description="Sincroniza comentarios do Construflow (diario 3h)"
else
  echo "   Criando novo job..."
  gcloud scheduler jobs create http $SCHEDULER_NAME \
    --location=$REGION \
    --schedule="0 3 * * *" \
    --time-zone="America/Sao_Paulo" \
    --uri="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/${JOB_NAME}:run" \
    --http-method=POST \
    --oauth-service-account-email=$SERVICE_ACCOUNT \
    --oauth-token-scope="https://www.googleapis.com/auth/cloud-platform" \
    --attempt-deadline=600s \
    --description="Sincroniza comentarios do Construflow (diario 3h)"
fi

echo ""
echo "✅ Cloud Scheduler atualizado: $SCHEDULER_NAME"
echo "   Schedule: 0 3 * * * (diariamente às 3h São Paulo)"
echo ""

# Testar o job
echo "🧪 Deseja executar o job agora? (y/n)"
read -r response
if [[ "$response" =~ ^[Yy]$ ]]; then
  echo "   Executando job..."
  gcloud run jobs execute $JOB_NAME --region=$REGION
  echo "   Job iniciado! Acompanhe no console: https://console.cloud.google.com/run/jobs/details/${REGION}/${JOB_NAME}/executions?project=${PROJECT_ID}"
fi

echo ""
echo "🎉 Setup completo!"
echo "   - Cloud Run Job: $JOB_NAME"
echo "   - Cloud Scheduler: $SCHEDULER_NAME"
echo "   - Region: $REGION"
echo "   - Timeout: 4 horas"
