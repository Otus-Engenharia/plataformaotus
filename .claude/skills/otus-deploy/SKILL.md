---
name: otus-deploy
description: |
  Fluxo GitFlow de desenvolvimento e deploy para Plataforma Otus (relatorio).
  Projeto desenvolvido por 2 pessoas + IA - usa GitFlow Simplificado.
  Notifica automaticamente no Discord após push.

  GATILHOS - Use este skill quando o usuário disser:
  - "começar a trabalhar" / "iniciar desenvolvimento" / "sync"
  - "criar feature" / "nova feature" / "começar feature"
  - "criar hotfix" / "corrigir bug urgente"
  - "deploy otus" / "fazer deploy" / "subir para produção"
  - "commit e push" / "finalizar alterações" / "commitar"
  - "mergear para develop" / "finalizar feature"
  - "mergear para main" / "preparar deploy"
  - "sincronizar" / "atualizar repo" / "pull"
  - Qualquer pedido de commit/push/sync no contexto do projeto relatorio
---

# Otus Deploy Skill (GitFlow)

Skill para desenvolvimento com GitFlow simplificado na Plataforma Otus.
**Equipe**: 2 desenvolvedores + IA trabalhando em paralelo.
**Notificação**: Discord automático após cada push.

## Contexto do Projeto

- **Repositório local**: e:\Git\relatorio
- **Remote**: https://github.com/Otus-Engenharia/plataformaotus.git
- **Branch de produção**: main (VPS puxa deste branch)
- **Branch de integração**: develop
- **Feature branches**: feature/*
- **Hotfix branches**: hotfix/*
- **Stack**: React/Vite (frontend) + Node.js/Express (backend)

## Discord Webhook

```
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/1468331312308949034/7xQe4sb-cwZbX5xtq43FE3HrgXy2SWmeiq0ttK2Lz8HAagsUaOmnwJx_g1IT5i3jyA1F
```

---

## REGRA FUNDAMENTAL

**NUNCA fazer commit diretamente em `main` ou `develop`.**
Sempre criar feature branch ou hotfix branch primeiro.

Se o usuário pedir para commitar e estiver em `main` ou `develop`:
1. AVISAR que commits diretos não são permitidos
2. PERGUNTAR qual feature/hotfix criar
3. Criar o branch apropriado antes de commitar

---

## Fluxo 1: Começar a Trabalhar (Sync)

**Gatilho**: "sync", "começar a trabalhar", "pull"

```bash
cd "e:/Git/relatorio"
git fetch origin
git status
```

Verificar branch atual:
- Se estiver em `main` → trocar para `develop` ou perguntar qual feature branch
- Se estiver em `develop` → sincronizar: `git pull origin develop`
- Se estiver em `feature/*` → sincronizar com base: `git pull origin develop`
- Se estiver em `hotfix/*` → sincronizar com base: `git pull origin main`

Se houver alterações locais não commitadas → avisar e perguntar se quer stash ou commitar.

---

## Fluxo 2: Criar Feature Branch

**Gatilho**: "criar feature", "nova feature", "começar feature [nome]"

```bash
cd "e:/Git/relatorio"
git checkout develop
git pull origin develop
git checkout -b feature/NOME_DA_FEATURE
```

Perguntar ao usuário o nome da feature se não fornecido.
Formato: `feature/descricao-curta-em-kebab-case`

---

## Fluxo 3: Criar Hotfix Branch

**Gatilho**: "criar hotfix", "corrigir bug urgente"

```bash
cd "e:/Git/relatorio"
git checkout main
git pull origin main
git checkout -b hotfix/NOME_DO_HOTFIX
```

Perguntar ao usuário o nome do hotfix se não fornecido.
Formato: `hotfix/descricao-curta-em-kebab-case`

---

## Fluxo 4: Commit e Push (Feature/Hotfix)

**Gatilho**: "commit e push", "finalizar alterações", "commitar"

### Passo 1: Verificar branch atual

```bash
cd "e:/Git/relatorio"
CURRENT_BRANCH=$(git branch --show-current)
echo $CURRENT_BRANCH
```

**BLOQUEAR** se estiver em `main` ou `develop`. Avisar e pedir para criar branch.

### Passo 2: Análise

```bash
git status
git diff --stat
```

Verificar:
- Arquivos modificados
- Arquivos não rastreados
- Arquivos que NÃO devem ser commitados

### Passo 3: Build de Verificação (se houve mudanças no frontend)

```bash
cd "e:/Git/relatorio/frontend" && npm run build
```

Se houver erros: listar e perguntar ao usuário se quer corrigir.

### Passo 4: Commit

**Arquivos NUNCA commitar:**
- backend/env.txt, backend/.env, *.key, service-account-key.json
- cookies.txt, nul, video/, planilhas temporárias

**Convenção de commits:**
- `feat:` nova funcionalidade
- `fix:` correção de bug
- `refactor:` refatoração sem mudança de comportamento
- `docs:` documentação
- `style:` formatação, CSS
- `chore:` manutenção, configs

```bash
cd "e:/Git/relatorio"
git add [arquivos específicos]
git commit -m "$(cat <<'EOF'
tipo(escopo): descrição curta

Detalhes opcionais.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

### Passo 5: Verificar Conflitos (Pré-Push)

```bash
git fetch origin
```

Para feature branches:
```bash
git log HEAD..origin/develop --oneline
```

Para hotfix branches:
```bash
git log HEAD..origin/main --oneline
```

Se houver commits novos no base branch, fazer rebase:
```bash
git pull --rebase origin develop  # ou main para hotfix
```

### Passo 6: Push

```bash
git push -u origin $(git branch --show-current)
```

### Passo 7: Notificação Discord

Coletar dados e enviar:

```bash
cd "e:/Git/relatorio"
CURRENT_BRANCH=$(git branch --show-current)
COMMIT_HASH=$(git log -1 --pretty=format:"%h")
COMMIT_MSG=$(git log -1 --pretty=format:"%s")
COMMIT_AUTHOR=$(git log -1 --pretty=format:"%an")
COMMIT_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
FILES_CHANGED=$(git diff-tree --no-commit-id --name-only -r HEAD | head -10 | tr '\n' ', ' | sed 's/,$//')

# Determinar cor e emoji pelo tipo de branch
if [[ "$CURRENT_BRANCH" == feature/* ]]; then
  COLOR=3447003
  TITLE="🔧 Feature Push"
elif [[ "$CURRENT_BRANCH" == hotfix/* ]]; then
  COLOR=15105570
  TITLE="🚑 Hotfix Push"
else
  COLOR=5763719
  TITLE="📦 Push"
fi

curl -X POST "https://discord.com/api/webhooks/1468331312308949034/7xQe4sb-cwZbX5xtq43FE3HrgXy2SWmeiq0ttK2Lz8HAagsUaOmnwJx_g1IT5i3jyA1F" \
  -H "Content-Type: application/json" \
  -d "{
    \"embeds\": [{
      \"title\": \"$TITLE\",
      \"color\": $COLOR,
      \"fields\": [
        {\"name\": \"Branch\", \"value\": \"\`$CURRENT_BRANCH\`\", \"inline\": true},
        {\"name\": \"Commit\", \"value\": \"\`$COMMIT_HASH\`\", \"inline\": true},
        {\"name\": \"Autor\", \"value\": \"$COMMIT_AUTHOR\", \"inline\": true},
        {\"name\": \"Mensagem\", \"value\": \"$COMMIT_MSG\"},
        {\"name\": \"Arquivos\", \"value\": \"\`$FILES_CHANGED\`\"}
      ],
      \"footer\": {\"text\": \"Plataforma Otus • $CURRENT_BRANCH\"},
      \"timestamp\": \"$COMMIT_TIME\"
    }]
  }"
```

### Passo 8: Sugerir PR

Após push, informar ao usuário:

Para feature branches:
> Branch `feature/xxx` enviado. Para criar PR para develop:
> ```bash
> gh pr create --base develop --title "feat: descrição" --body "Detalhes..."
> ```

Para hotfix branches:
> Branch `hotfix/xxx` enviado. Para criar PR para main:
> ```bash
> gh pr create --base main --title "fix: descrição" --body "Detalhes..."
> ```

---

## Fluxo 5: Finalizar Feature (Merge para Develop)

**Gatilho**: "mergear para develop", "finalizar feature"

### Opção A: Via GitHub PR (recomendado)

```bash
cd "e:/Git/relatorio"
gh pr create --base develop --head $(git branch --show-current) \
  --title "feat: descrição da feature" \
  --body "Descrição detalhada"
```

Após merge do PR:
```bash
git checkout develop
git pull origin develop
git branch -d feature/NOME
git push origin --delete feature/NOME
```

### Opção B: Merge local (se urgente)

```bash
cd "e:/Git/relatorio"
git checkout develop
git pull origin develop
git merge --no-ff feature/NOME
git push origin develop
git branch -d feature/NOME
git push origin --delete feature/NOME
```

---

## Fluxo 6: Deploy para Produção

**Gatilho**: "deploy otus", "fazer deploy", "subir para produção"

### Passo 1: Preparar main

```bash
cd "e:/Git/relatorio"
git checkout develop
git pull origin develop
git checkout main
git pull origin main
```

### Passo 2: Merge develop → main

```bash
git merge --no-ff develop -m "$(cat <<'EOF'
chore: merge develop para deploy em produção

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

### Passo 3: Tag (opcional, recomendado)

```bash
git tag -a v$(date +"%Y.%m.%d") -m "Deploy $(date +"%d/%m/%Y")"
```

### Passo 4: Push main + tag

```bash
git push origin main
git push origin --tags
```

### Passo 5: Deploy no VPS

Informar ao usuário:

> **Para atualizar a VPS, execute:**
> ```
> PowerShell -ExecutionPolicy Bypass -File "scripts\deploy-para-vps.ps1"
> ```
> Ou via SSH manual:
> ```bash
> ssh root@72.60.60.117
> cd /docker/plataformaotus
> git pull origin main
> docker compose down
> docker compose build --no-cache
> docker compose up -d
> ```

### Passo 6: Notificação Discord (Deploy)

```bash
cd "e:/Git/relatorio"
COMMIT_HASH=$(git log -1 --pretty=format:"%h")
COMMIT_MSG=$(git log -1 --pretty=format:"%s")
COMMIT_AUTHOR=$(git log -1 --pretty=format:"%an")
COMMIT_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "sem tag")

curl -X POST "https://discord.com/api/webhooks/1468331312308949034/7xQe4sb-cwZbX5xtq43FE3HrgXy2SWmeiq0ttK2Lz8HAagsUaOmnwJx_g1IT5i3jyA1F" \
  -H "Content-Type: application/json" \
  -d "{
    \"embeds\": [{
      \"title\": \"🚀 Deploy Plataforma Otus\",
      \"color\": 5763719,
      \"fields\": [
        {\"name\": \"Versão\", \"value\": \"\`$TAG\`\", \"inline\": true},
        {\"name\": \"Commit\", \"value\": \"\`$COMMIT_HASH\`\", \"inline\": true},
        {\"name\": \"Autor\", \"value\": \"$COMMIT_AUTHOR\", \"inline\": true},
        {\"name\": \"Mensagem\", \"value\": \"$COMMIT_MSG\"},
        {\"name\": \"Status\", \"value\": \"Merge develop → main concluído. Deploy VPS pendente.\"}
      ],
      \"footer\": {\"text\": \"Plataforma Otus • main • PRODUÇÃO\"},
      \"timestamp\": \"$COMMIT_TIME\"
    }]
  }"
```

### Passo 7: Sincronizar develop com main

```bash
git checkout develop
git merge main
git push origin develop
```

---

## Fluxo 7: Hotfix (Correção Urgente em Produção)

**Gatilho**: "criar hotfix", "bug urgente em produção"

1. Criar branch de hotfix (Fluxo 3)
2. Fazer as correções
3. Commit e push (Fluxo 4)
4. Criar PR para `main`:
   ```bash
   gh pr create --base main --head hotfix/NOME --title "fix: descrição"
   ```
5. Após merge em main, deploy imediato (Fluxo 6, passos 4-6)
6. Merge hotfix para develop:
   ```bash
   git checkout develop
   git pull origin develop
   git merge hotfix/NOME
   git push origin develop
   ```
7. Limpar branch:
   ```bash
   git branch -d hotfix/NOME
   git push origin --delete hotfix/NOME
   ```

---

## Cenários de Uso

### Cenário 1: "começar a trabalhar"
→ Executar Fluxo 1 (Sync), sugerir branch ativo ou criar novo

### Cenário 2: "criar feature dashboard-novo"
→ Executar Fluxo 2, criar `feature/dashboard-novo`

### Cenário 3: "commit e push"
→ Verificar branch (bloquear se main/develop), executar Fluxo 4

### Cenário 4: "deploy otus"
→ Executar Fluxo 6 (merge develop→main, push, notificar)

### Cenário 5: "bug urgente: login quebrado"
→ Executar Fluxo 7 (hotfix)

### Cenário 6: "finalizar feature"
→ Executar Fluxo 5 (PR para develop)

---

## Cores Discord por Tipo de Ação

| Ação | Cor | Código | Emoji |
|------|-----|--------|-------|
| Deploy (main) | Verde | 5763719 | 🚀 |
| Feature push | Azul | 3447003 | 🔧 |
| Hotfix push | Laranja | 15105570 | 🚑 |
| Conflito resolvido | Amarelo | 16776960 | ⚠️ |
| Erro | Vermelho | 15548997 | ❌ |

---

## Checklist de Qualidade

**Antes de começar a trabalhar:**
- [ ] `git fetch origin` executado
- [ ] Verificar branch atual (NÃO deve estar em main ou develop)
- [ ] Se em feature/*: `git pull origin develop`
- [ ] Se em hotfix/*: `git pull origin main`

**Antes de fazer commit:**
- [ ] Branch correto (feature/* ou hotfix/*)
- [ ] `git status` mostra apenas arquivos desejados
- [ ] Nenhum arquivo sensível incluído
- [ ] Build do frontend passou (se houve mudanças)
- [ ] Mensagem de commit descritiva

**Antes de push:**
- [ ] `git fetch` + verificar commits remotos no branch base
- [ ] Rebase feito se necessário

**Antes de deploy:**
- [ ] Todos os PRs de features mergeados em develop
- [ ] develop testado localmente
- [ ] Merge develop → main com --no-ff
- [ ] Tag criada (recomendado)

**Após deploy:**
- [ ] VPS atualizada
- [ ] Discord notificado
- [ ] develop sincronizado com main

---

## Erros Comuns

| Erro | Causa | Solução |
|------|-------|---------|
| "nothing to commit" | Arquivos não foram adicionados | `git add [arquivos]` |
| "failed to push" | Remote tem commits novos | `git pull --rebase` primeiro |
| "CONFLICT" no pull | Outro dev editou mesmo arquivo | Resolver manualmente, commit |
| Build falha | Erro de código | Corrigir antes de commitar |
| "diverged" | Branches divergiram | `git pull --rebase origin develop` |
| Push em main/develop | Commit direto proibido | Criar feature/hotfix branch |
