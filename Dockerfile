# =============================================================================
# Dockerfile – Plataforma Otus (Relatórios)
# =============================================================================
# Este Dockerfile cria uma imagem que:
# 1. Faz o build do frontend React (Vite)
# 2. Instala e executa o backend Node.js
# 3. Serve frontend + API no mesmo container (porta 3001)
# Isolado: não altera nem depende do projeto "automacoes" ou outros.
# =============================================================================

# ---- Stage 1: Build do frontend ----
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copia package.json e instala dependências
COPY frontend/package*.json ./
RUN npm install

# Copia o código do frontend
COPY frontend/ .

# Build do frontend.
# VITE_API_URL vazio = mesmo domínio (frontend e API no mesmo container).
# Em produção o frontend chama /api relativamente.
ARG VITE_API_URL=
ENV VITE_API_URL=${VITE_API_URL}
# Corrige permissões dos binários npm (evita "Permission denied" no vite)
RUN chmod +x node_modules/.bin/* 2>/dev/null || true
RUN npm run build

# ---- Stage 2: Backend + servir frontend ----
FROM node:20-alpine

WORKDIR /app

# Instala dependências do backend (apenas produção)
COPY backend/package*.json ./
RUN npm install --omit=dev

# Copia o código do backend
COPY backend/ .

# Copia o build do frontend para backend/public (servido em produção)
COPY --from=frontend-builder /app/frontend/dist ./public
RUN test -f /app/public/index.html || (echo "ERRO: frontend build nao gerou index.html" && exit 1)

# Usuário não-root (segurança)
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup && \
    chown -R appuser:appgroup /app
USER appuser

ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0
EXPOSE 3001

# Healthcheck: verifica se /api/health responde
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q -O - http://localhost:3001/api/health | grep -q '"status":"OK"' || exit 1

CMD ["node", "server.js"]
