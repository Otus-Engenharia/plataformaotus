---
name: otus-deploy
description: |
  Fluxo de desenvolvimento e deploy para Plataforma Otus (relatorio).
  Projeto desenvolvido por 2 pessoas + IA - foco em evitar conflitos.
  Notifica automaticamente no Discord após push.

  GATILHOS - Use este skill quando o usuário disser:
  - "começar a trabalhar" / "iniciar desenvolvimento" / "sync"
  - "deploy otus" / "fazer deploy" / "subir para produção"
  - "commit e push" / "finalizar alterações" / "commitar"
  - "sincronizar" / "atualizar repo" / "pull"
  - Qualquer pedido de commit/push/sync no contexto do projeto relatorio
---

# Otus Deploy Skill

Skill para sincronização, commit e push do projeto Plataforma Otus.
**Equipe**: 2 desenvolvedores + IA trabalhando em paralelo.
**Notificação**: Discord automático após cada push.

## Contexto do Projeto

- **Repositório local**: e:\Git\relatorio
- **Remote**: https://github.com/Otus-Engenharia/plataformaotus.git
- **Branch principal**: main
- **Stack**: React/Vite (frontend) + Node.js/Express (backend)

## Discord Webhook

```
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/1468331312308949034/7xQe4sb-cwZbX5xtq43FE3HrgXy2SWmeiq0ttK2Lz8HAagsUaOmnwJx_g1IT5i3jyA1F
```

---

## Fluxo Completo (Anti-Conflito)

### Passo 0: Sincronização Inicial

**SEMPRE executar antes de começar a trabalhar:**

```bash
git fetch origin
git status
```

Verificar:
- Se há alterações locais não commitadas → commitar ou stash primeiro
- Se o branch está atrás do remote → fazer pull

```bash
git pull origin main
```

Se houver conflitos:
1. Listar arquivos em conflito
2. Perguntar ao usuário como resolver
3. Após resolver: `git add .` e `git commit`

### Passo 1: Análise (Antes de Commit)

Execute em paralelo:
```bash
git status
git diff --stat
```

Verificar:
- Arquivos modificados (M)
- Arquivos não rastreados (U) - especialmente em `/frontend/src/` e `/backend/`
- Arquivos que NÃO devem ser commitados

### Passo 2: Build de Verificação

```bash
cd frontend && npm run build
```

Se houver erros:
1. Listar erros claramente
2. Perguntar ao usuário se quer corrigir ou continuar

### Passo 3: Commit

**Arquivos NUNCA commitar:**
- backend/env.txt
- backend/.env
- *.key
- service-account-key.json
- cookies.txt
- nul
- Pastas video/, planilhas temporárias

**Convenção de commits:**
- `feat:` nova funcionalidade
- `fix:` correção de bug
- `refactor:` refatoração sem mudança de comportamento
- `docs:` documentação
- `style:` formatação, CSS
- `chore:` manutenção, configs

**Formato:**
```bash
git add [arquivos específicos]
git commit -m "$(cat <<'EOF'
tipo: descrição curta

Detalhes opcionais.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

### Passo 4: Verificar Conflitos (Pré-Push)

**CRÍTICO - Antes de fazer push:**

```bash
git fetch origin
git log HEAD..origin/main --oneline
```

Se houver commits novos no remote (outro dev fez push enquanto você trabalhava):

```bash
git pull --rebase origin main
```

Se houver conflitos no rebase:
1. Resolver cada conflito
2. `git add .`
3. `git rebase --continue`

### Passo 5: Push

```bash
git push origin main
```

Verificar sucesso com:
```bash
git status
git log --oneline -1
```

### Passo 6: Instruções para VPS (Informativo)

Após push bem-sucedido, informar ao usuário:

> **Para atualizar a VPS, execute via SSH:**
> ```bash
> cd /docker/plataformaotus
> git pull origin main
> docker compose build --no-cache
> docker compose up -d
> ```

### Passo 7: Notificação no Discord

**SEMPRE executar após push bem-sucedido:**

Coletar informações do commit:
```bash
git log -1 --pretty=format:"%h|%s|%an|%ar"
```

Enviar notificação para o Discord usando curl:
```bash
curl -X POST "https://discord.com/api/webhooks/1468331312308949034/7xQe4sb-cwZbX5xtq43FE3HrgXy2SWmeiq0ttK2Lz8HAagsUaOmnwJx_g1IT5i3jyA1F" \
  -H "Content-Type: application/json" \
  -d '{
    "embeds": [{
      "title": "🚀 Deploy Plataforma Otus",
      "color": 5763719,
      "fields": [
        {"name": "Commit", "value": "`HASH`", "inline": true},
        {"name": "Autor", "value": "AUTOR", "inline": true},
        {"name": "Mensagem", "value": "MENSAGEM"},
        {"name": "Arquivos", "value": "LISTA_ARQUIVOS"}
      ],
      "footer": {"text": "Plataforma Otus • main"},
      "timestamp": "TIMESTAMP"
    }]
  }'
```

**Formato da mensagem Discord:**
- Cor verde (5763719) = sucesso
- Cor amarela (16776960) = warning/conflito resolvido
- Cor vermelha (15548997) = erro

**Exemplo de script completo para notificação:**
```bash
# Coletar dados do commit
COMMIT_HASH=$(git log -1 --pretty=format:"%h")
COMMIT_MSG=$(git log -1 --pretty=format:"%s")
COMMIT_AUTHOR=$(git log -1 --pretty=format:"%an")
COMMIT_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
FILES_CHANGED=$(git diff-tree --no-commit-id --name-only -r HEAD | head -10 | tr '\n' ', ' | sed 's/,$//')

# Enviar para Discord
curl -X POST "https://discord.com/api/webhooks/1468331312308949034/7xQe4sb-cwZbX5xtq43FE3HrgXy2SWmeiq0ttK2Lz8HAagsUaOmnwJx_g1IT5i3jyA1F" \
  -H "Content-Type: application/json" \
  -d "{
    \"embeds\": [{
      \"title\": \"🚀 Deploy Plataforma Otus\",
      \"color\": 5763719,
      \"fields\": [
        {\"name\": \"Commit\", \"value\": \"\`$COMMIT_HASH\`\", \"inline\": true},
        {\"name\": \"Autor\", \"value\": \"$COMMIT_AUTHOR\", \"inline\": true},
        {\"name\": \"Mensagem\", \"value\": \"$COMMIT_MSG\"},
        {\"name\": \"Arquivos\", \"value\": \"\`$FILES_CHANGED\`\"}
      ],
      \"footer\": {\"text\": \"Plataforma Otus • main\"},
      \"timestamp\": \"$COMMIT_TIME\"
    }]
  }"
```

---

## Cenários de Uso

### Cenário 1: Começar a trabalhar
Usuário diz: "sync" ou "começar a trabalhar"
→ Executar Passo 0 (sincronização)

### Cenário 2: Finalizar trabalho
Usuário diz: "commit e push" ou "deploy otus"
→ Executar Passos 1-7 (incluindo notificação Discord)

### Cenário 3: Só sincronizar
Usuário diz: "pull" ou "atualizar repo"
→ Executar apenas Passo 0

### Cenário 4: Push com conflito resolvido
Quando há conflito que foi resolvido durante o processo:
→ Usar cor amarela (16776960) na notificação Discord
→ Incluir campo extra "⚠️ Conflitos resolvidos" na mensagem

---

## Checklist de Qualidade

**Antes de começar a trabalhar:**
- [ ] `git pull` executado
- [ ] Sem conflitos pendentes

**Antes de fazer commit:**
- [ ] `git status` mostra apenas arquivos desejados
- [ ] Nenhum arquivo sensível incluído
- [ ] Build do frontend passou (se houve mudanças)
- [ ] Mensagem de commit descritiva

**Antes de push:**
- [ ] `git fetch` + verificar commits remotos
- [ ] Rebase feito se necessário

**Após push:**
- [ ] `git log` mostra commit no topo
- [ ] `git status` mostra "up to date with origin/main"

---

## Erros Comuns

| Erro | Causa | Solução |
|------|-------|---------|
| "nothing to commit" | Arquivos não foram adicionados | `git add [arquivos]` |
| "failed to push" | Remote tem commits novos | `git pull --rebase` primeiro |
| "CONFLICT" no pull | Outro dev editou mesmo arquivo | Resolver manualmente, commit |
| Build falha | Erro de código | Corrigir antes de commitar |
| "diverged" | Branches divergiram | `git pull --rebase origin main` |
