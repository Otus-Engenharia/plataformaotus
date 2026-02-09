#!/bin/bash
# Script de deploy da Cloud Function SmartSheet Sync
# Uso: ./deploy.sh [--create-scheduler]

set -e

# Configurações
PROJECT_ID="dadosindicadores"
REGION="southamerica-east1"
FUNCTION_NAME="smartsheet-sync"
RUNTIME="nodejs20"
TIMEOUT="540s"
MEMORY="512MB"
MIN_INSTANCES="0"
MAX_INSTANCES="3"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Deploy da Cloud Function: $FUNCTION_NAME${NC}"
echo "=================================================="
echo "Projeto: $PROJECT_ID"
echo "Região: $REGION"
echo ""

# Verificar se está logado no gcloud
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" > /dev/null 2>&1; then
    echo -e "${RED}❌ Você não está logado no gcloud. Execute: gcloud auth login${NC}"
    exit 1
fi

# Verificar se o arquivo .env.yaml existe
if [ ! -f ".env.yaml" ]; then
    echo -e "${RED}❌ Arquivo .env.yaml não encontrado!${NC}"
    echo "Crie o arquivo .env.yaml com as variáveis de ambiente necessárias."
    exit 1
fi

# Verificar se SMARTSHEET_ACCESS_TOKEN está configurado
if ! grep -q "SMARTSHEET_ACCESS_TOKEN:" .env.yaml || grep -q 'SMARTSHEET_ACCESS_TOKEN: ""' .env.yaml; then
    echo -e "${YELLOW}⚠️ SMARTSHEET_ACCESS_TOKEN não está configurado no .env.yaml${NC}"
    read -p "Deseja continuar mesmo assim? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Deploy da função
echo -e "${GREEN}📦 Fazendo deploy da Cloud Function...${NC}"

gcloud functions deploy $FUNCTION_NAME \
    --gen2 \
    --project=$PROJECT_ID \
    --region=$REGION \
    --runtime=$RUNTIME \
    --source=. \
    --entry-point=syncSmartsheetToBigQuery \
    --trigger-http \
    --allow-unauthenticated \
    --timeout=$TIMEOUT \
    --memory=$MEMORY \
    --min-instances=$MIN_INSTANCES \
    --max-instances=$MAX_INSTANCES \
    --env-vars-file=.env.yaml

echo ""
echo -e "${GREEN}✅ Cloud Function deployada com sucesso!${NC}"

# Obter URL da função
FUNCTION_URL=$(gcloud functions describe $FUNCTION_NAME \
    --project=$PROJECT_ID \
    --region=$REGION \
    --gen2 \
    --format='value(serviceConfig.uri)')

echo ""
echo "URL da função: $FUNCTION_URL"
echo ""

# Criar Cloud Scheduler se solicitado
if [[ "$1" == "--create-scheduler" ]]; then
    echo -e "${GREEN}⏰ Criando Cloud Scheduler job...${NC}"

    # Verificar se o job já existe
    if gcloud scheduler jobs describe smartsheet-sync-hourly --location=$REGION --project=$PROJECT_ID > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠️ Job 'smartsheet-sync-hourly' já existe. Atualizando...${NC}"
        gcloud scheduler jobs update http smartsheet-sync-hourly \
            --project=$PROJECT_ID \
            --location=$REGION \
            --schedule="0 * * * *" \
            --uri="$FUNCTION_URL" \
            --http-method=POST \
            --oidc-service-account-email="${PROJECT_ID}@appspot.gserviceaccount.com"
    else
        echo "Criando novo job..."
        gcloud scheduler jobs create http smartsheet-sync-hourly \
            --project=$PROJECT_ID \
            --location=$REGION \
            --schedule="0 * * * *" \
            --uri="$FUNCTION_URL" \
            --http-method=POST \
            --oidc-service-account-email="${PROJECT_ID}@appspot.gserviceaccount.com" \
            --description="Sincroniza SmartSheet com BigQuery a cada hora"
    fi

    echo -e "${GREEN}✅ Cloud Scheduler configurado!${NC}"
    echo "Schedule: A cada hora (minuto 0)"
fi

echo ""
echo "=================================================="
echo -e "${GREEN}🎉 Deploy completo!${NC}"
echo ""
echo "Para testar manualmente:"
echo "  curl -X POST $FUNCTION_URL"
echo ""
echo "Para criar/atualizar o scheduler:"
echo "  ./deploy.sh --create-scheduler"
echo ""
echo "Para ver logs:"
echo "  gcloud functions logs read $FUNCTION_NAME --region=$REGION --project=$PROJECT_ID"
