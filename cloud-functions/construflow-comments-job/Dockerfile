# Cloud Run Job para sincronizar comentários do Construflow
# Pode rodar por horas (sem limite de timeout)

FROM node:20-slim

WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências
RUN npm ci --only=production

# Copiar código fonte
COPY . .

# Executar o job
CMD ["node", "index.js"]
