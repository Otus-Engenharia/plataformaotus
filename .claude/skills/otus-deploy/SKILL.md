---
name: otus-deploy
description: |
  Fluxo GitFlow de desenvolvimento e deploy para Plataforma Otus (relatorio).
  Projeto desenvolvido por 2 pessoas + IA - usa GitFlow Simplificado.

  GATILHOS - Use este skill quando o usuário disser:
  - "começar a trabalhar" / "iniciar desenvolvimento" / "sync"
  - "criar feature" / "nova feature" / "começar feature"
  - "criar hotfix" / "corrigir bug urgente"
  - "deploy otus" / "fazer deploy" / "subir para produção"
  - "commit e push" / "finalizar alterações" / "commitar"
  - "mergear para develop" / "finalizar feature"
  - "mergear para main" / "preparar deploy"
  - "sincronizar" / "atualizar repo" / "pull"
  - "auditar branches" / "verificar graph" / "checar integridade"
  - Qualquer pedido de commit/push/sync no contexto do projeto relatorio
---

# Otus Deploy Skill (GitFlow)

Skill para desenvolvimento com GitFlow simplificado na Plataforma Otus.
**Equipe**: 2 desenvolvedores + IA trabalhando em paralelo.
## Contexto do Projeto

- **Repositório local**: e:\Git\relatorio
- **Remote**: https://github.com/Otus-Engenharia/plataformaotus.git
- **Branch de produção**: main (VPS puxa deste branch)
- **Branch de integração**: develop
- **Feature branches**: feature/*
- **Hotfix branches**: hotfix/*
- **Stack**: React/Vite (frontend) + Node.js/Express (backend)

---

## REGRA FUNDAMENTAL

**NUNCA fazer commit diretamente em `main` ou `develop`.**
Sempre criar feature branch ou hotfix branch primeiro.

Se o usuário pedir para commitar e estiver em `main` ou `develop`:
1. AVISAR que commits diretos não são permitidos
2. PERGUNTAR qual feature/hotfix criar
3. Criar o branch apropriado antes de commitar

---

## PASSO ZERO OBRIGATÓRIO: Varredura e Limpeza de Branches

**SEMPRE executar antes de qualquer sync, deploy ou merge.**
Este passo garante que nenhum trabalho fica perdido em branches e o graph fica limpo.

### 0A: Incorporar branches pendentes (remotos + locais)

```bash
cd "e:/Git/relatorio"
git fetch origin --prune
```

**Etapa 1 — Branches REMOTOS com commits NÃO mergeados em develop:**
```bash
for branch in $(git branch -r | grep -v HEAD | grep -v '/develop$' | grep -v '/main$'); do
  commits=$(git log origin/develop..$branch --oneline 2>/dev/null)
  if [ -n "$commits" ]; then
    echo "=== $branch ==="
    echo "$commits"
  fi
done
```

**Etapa 2 — Branches LOCAIS (feature/* e hotfix/*) com commits NÃO mergeados em develop:**
```bash
for branch in $(git branch --format='%(refname:short)' | grep -E '^(feature|hotfix)/'); do
  commits=$(git log develop..$branch --oneline 2>/dev/null)
  if [ -n "$commits" ]; then
    echo "=== $branch (local) ==="
    echo "$commits"
  fi
done
```

**Se encontrar branches pendentes (remotos OU locais):**
1. Fazer merge automaticamente de CADA branch em develop (sem perguntar)
2. Informar ao usuário quais branches foram incorporados
3. Se houver conflito, parar e perguntar ao usuário
4. Push develop após todos os merges

```bash
git checkout develop
# Para branches remotos:
git merge --no-ff origin/feature/nome -m "feat: merge feature/nome into develop - descrição"
# Para branches locais:
git merge --no-ff feature/nome -m "feat: merge feature/nome into develop - descrição"
# Repetir para cada branch pendente
git push origin develop
```

**Verificação pós-merge (confirmar que nada ficou para trás):**
```bash
# Re-checar se ainda há branches com commits não integrados
echo "=== Verificação pós-0A ==="
STILL_PENDING=0
for branch in $(git branch -r | grep -v HEAD | grep -v '/develop$' | grep -v '/main$'); do
  if [ -n "$(git log origin/develop..$branch --oneline 2>/dev/null)" ]; then
    echo "AINDA PENDENTE: $branch"
    STILL_PENDING=$((STILL_PENDING + 1))
  fi
done
if [ "$STILL_PENDING" -eq 0 ]; then
  echo "Todos os branches remotos integrados em develop."
fi
```

**Também verificar se develop e main estão sincronizados:**
```bash
MAIN_AHEAD=$(git log develop..main --oneline 2>/dev/null | wc -l | tr -d ' ')
if [ "$MAIN_AHEAD" -gt 0 ]; then
  echo "ATENÇÃO: main tem $MAIN_AHEAD commits que não estão em develop (hotfixes não sincronizados)"
  echo "Sincronizando develop com main..."
  git merge main -m "fix: sincronizar develop com main (hotfixes pendentes)"
  git push origin develop
fi
```

### 0B: Auditoria de Integridade dos Branches

**Após 0A, verificar que TODOS os branches foram devidamente integrados.**
NUNCA deletar branches — eles fazem parte do histórico visual do GitFlow.

**Verificação 1 — Branches REMOTOS não integrados em develop:**
```bash
echo "=== Branches remotos NÃO integrados em develop ==="
for branch in $(git branch -r | grep -v HEAD | grep -v '/develop$' | grep -v '/main$'); do
  commits=$(git log origin/develop..$branch --oneline 2>/dev/null)
  if [ -n "$commits" ]; then
    echo "PENDENTE: $branch"
    echo "$commits"
  fi
done
```

**Verificação 2 — Branches LOCAIS não integrados em develop:**
```bash
echo "=== Branches locais NÃO integrados em develop ==="
for branch in $(git branch --format='%(refname:short)' | grep -E '^(feature|hotfix)/'); do
  commits=$(git log develop..$branch --oneline 2>/dev/null)
  if [ -n "$commits" ]; then
    echo "PENDENTE: $branch (local)"
    echo "$commits"
  fi
done
```

**Verificação 3 — Hotfixes em main que NÃO estão em develop (inconsistência de fluxo):**
```bash
echo "=== Commits em main que NÃO estão em develop (possível hotfix não sincronizado) ==="
git log develop..main --oneline
```

**Se encontrar inconsistências:**
1. Branches com commits pendentes → incorporar via 0A (voltar e repetir)
2. Commits em main que não estão em develop → sincronizar develop com main:
   ```bash
   git checkout develop
   git merge main -m "fix: sincronizar develop com main (hotfixes pendentes)"
   git push origin develop
   ```
3. Informar ao usuário o estado final

**Resumo da auditoria:**
```bash
echo ""
echo "=== Resumo Passo Zero ==="
PENDING_REMOTE=$(git branch -r | grep -v HEAD | grep -v '/develop$' | grep -v '/main$' | while read b; do [ -n "$(git log origin/develop..$b --oneline 2>/dev/null)" ] && echo "$b"; done | wc -l | tr -d ' ')
PENDING_LOCAL=$(git branch --format='%(refname:short)' | grep -E '^(feature|hotfix)/' | while read b; do [ -n "$(git log develop..$b --oneline 2>/dev/null)" ] && echo "$b"; done | wc -l | tr -d ' ')
MAIN_AHEAD=$(git log develop..main --oneline 2>/dev/null | wc -l | tr -d ' ')
STASH_COUNT=$(git stash list 2>/dev/null | wc -l | tr -d ' ')
echo "Branches remotos com trabalho pendente: $PENDING_REMOTE"
echo "Branches locais com trabalho pendente: $PENDING_LOCAL"
echo "Commits em main não sincronizados em develop: $MAIN_AHEAD"
echo "Stashes acumulados: $STASH_COUNT"
```

**Regras:**
1. **NUNCA deletar branches** — são histórico do GitFlow
2. O objetivo é INTEGRAR, não limpar
3. Se tudo estiver integrado, informar "Tudo sincronizado, nenhum trabalho pendente"
4. Se houver branches pendentes, listar e incorporar via 0A

### 0C: Revisão de Stashes Acumulados

**Executar após 0B. Stashes antigos em branches já mergeados são descartáveis.**

```bash
git stash list
```

**Análise automática:**
```bash
# Verificar quais stashes estão em branches já mergeados em develop
git stash list --format="%gd %s" | while read stashref desc; do
  branch=$(echo "$desc" | sed -E 's/(WIP on |On )([^:]+):.*/\2/')
  if git branch --merged develop | grep -qE "^\s*${branch}$" 2>/dev/null; then
    echo "SEGURO DESCARTAR: $stashref ($branch já está em develop)"
  else
    echo "MANTER: $stashref ($branch ainda não mergeado)"
  fi
done
```

**Regras:**
1. NUNCA descartar stashes automaticamente — apenas informar ao usuário
2. Stashes em branches já mergeados em develop: informar que são seguros para descartar
3. Stashes em `main` ou `develop`: avisar que podem conter trabalho importante
4. Se houver mais de 5 stashes, recomendar limpeza manual ao usuário

**Ação do usuário (se quiser limpar):**
```bash
git stash drop stash@{N}   # Descartar stash específico
git stash clear             # Descartar TODOS (destrutivo — confirmar com usuário)
```

---

## Fluxo 1: Começar a Trabalhar (Sync)

**Gatilho**: "sync", "começar a trabalhar", "pull"

**Executar Passo Zero (0A + 0B + 0C) primeiro.**

```bash
cd "e:/Git/relatorio"
git fetch origin --prune
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

### Passo 7: Sugerir PR

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

**Executar Passo Zero (0A + 0B)** após o merge para integrar branches pendentes e auditar consistência.

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

**Executar Passo Zero (0A + 0B)** após o merge para integrar branches pendentes e auditar consistência.

---

## Fluxo 6: Deploy para Produção

**Gatilho**: "deploy otus", "fazer deploy", "subir para produção"

**Executar Passo Zero (0A + 0B + 0C) primeiro — incorporar pendentes, limpar mergeados e revisar stashes.**

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
## Consultar features incluídas:
## git log main..develop --oneline
git merge --no-ff develop -m "$(cat <<'EOF'
deploy: merge develop into main - DESCRIÇÃO_CURTA_DAS_FEATURES

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
## Substituir DESCRIÇÃO_CURTA_DAS_FEATURES por resumo das features incluídas
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

### Passo 6: Sincronizar develop com main

```bash
git checkout develop
git merge main
git push origin develop
```

### Passo 7: Auditoria pós-deploy

Após sincronizar develop com main, verificar que tudo está consistente:

```bash
echo "=== Auditoria pós-deploy ==="
# Verificar se develop e main estão sincronizados
DIFF=$(git log develop..main --oneline 2>/dev/null | wc -l | tr -d ' ')
if [ "$DIFF" -gt 0 ]; then
  echo "ATENÇÃO: main tem $DIFF commits não sincronizados em develop"
else
  echo "OK: develop e main estão sincronizados"
fi

# Verificar branches com trabalho pendente
PENDING=0
for branch in $(git branch -r | grep -v HEAD | grep -v '/develop$' | grep -v '/main$'); do
  if [ -n "$(git log origin/develop..$branch --oneline 2>/dev/null)" ]; then
    echo "PENDENTE: $branch"
    PENDING=$((PENDING + 1))
  fi
done
if [ "$PENDING" -eq 0 ]; then
  echo "OK: Todos os branches remotos integrados em develop"
fi

echo "=== Deploy concluído com sucesso ==="
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
5. Após merge em main, deploy imediato (Fluxo 6, passos 4-5)
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
8. Executar **Passo Zero (0A + 0B)** para integrar branches pendentes e auditar consistência do graph.

---

## Cenários de Uso

### Cenário 1: "começar a trabalhar"
→ Passo Zero (0A+0B) + Fluxo 1 (Sync), sugerir branch ativo ou criar novo

### Cenário 2: "criar feature dashboard-novo"
→ Executar Fluxo 2, criar `feature/dashboard-novo`

### Cenário 3: "commit e push"
→ Verificar branch (bloquear se main/develop), executar Fluxo 4

### Cenário 4: "deploy otus"
→ Passo Zero (0A+0B) + Fluxo 6 (merge develop→main, push)

### Cenário 5: "bug urgente: login quebrado"
→ Passo Zero (0A+0B) + Fluxo 7 (hotfix)

### Cenário 6: "finalizar feature"
→ Executar Fluxo 5 (PR para develop) + **Passo Zero (0A + 0B)** (integrar pendentes e auditar)

### Cenário 7: "auditar branches" / "verificar graph" / "checar integridade"
→ Passo Zero completo (0A + 0B + 0C) apenas — integrar, auditar e revisar stashes

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
