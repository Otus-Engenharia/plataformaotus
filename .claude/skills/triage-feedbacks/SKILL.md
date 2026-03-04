---
name: triage-feedbacks
description: |
  Analisa a caixa de entrada de feedbacks da Plataforma Otus e faz triagem automática.
  Classifica feedbacks pendentes por complexidade e executa ou pede aprovação.

  GATILHOS - Use este skill quando o usuário disser:
  - "triage feedbacks" / "triagem de feedbacks" / "analisar feedbacks"
  - "caixa de entrada" / "feedbacks novos" / "inbox feedbacks"
  - "o que tem de novo nos feedbacks" / "revisar feedbacks"
  - Qualquer pedido de análise ou implementação de feedbacks pendentes
---

# Triage de Feedbacks - Plataforma Otus

Skill para análise automática de feedbacks pendentes com classificação por complexidade e execução assistida.

## Etapa 1: Buscar Feedbacks Pendentes

```bash
cd "e:/Git/relatorio/backend" && node scripts/fetch-pending-feedbacks.mjs
```

Se retornar `count: 0`, informar: "Nenhum feedback pendente na caixa de entrada."

## Etapa 2: Classificar Cada Feedback

Para cada feedback retornado, analisar `titulo`, `feedback_text`, `type`, `area`, `page_url` e `screenshot_url`.

### Critérios de Classificação

**AUTO-IMPLEMENTÁVEL** (simples, bounded, claro):
- Bug com descrição clara e componente identificável
- Ajuste de CSS, label, texto, ícone
- Fix de UI pontual (alinhamento, cor, tamanho)
- Melhoria pequena em componente já conhecido
- Erro de dado/texto visível na tela

**PRECISA APROVAÇÃO** (complexo, ambíguo, amplo):
- Feature nova ou funcionalidade inexistente
- Mudança que afeta múltiplos componentes/arquivos
- Alteração de lógica de negócio ou fluxo
- Requisito ambíguo que precisa de mais contexto
- Mudança em API, schema de banco, ou arquitetura
- Integração com serviço externo

**NÃO É CÓDIGO** (processo, treinamento, operacional):
- Feedback sobre processo da empresa (não da plataforma)
- Pedido de treinamento ou documentação
- Dúvida de uso da plataforma
- Sugestão organizacional/operacional

## Etapa 3: Apresentar Resumo

Mostrar tabela com TODOS os feedbacks classificados:

```
## Triagem de Feedbacks - {data}

### Resumo
- Total pendentes: X
- Auto-implementáveis: Y
- Precisam aprovação: Z
- Não são código: W

| Código | Título | Tipo | Área | Classificação |
|--------|--------|------|------|---------------|
| FB-210 | Indicadores venda | Plataforma | Vendas | Precisa aprovação |
| FB-209 | Formulário passagem | Plataforma | Vendas | Auto-implementável |
| ... | | | | |
```

## Etapa 4: Executar Auto-implementáveis (Lote com Confirmação)

Se houver feedbacks auto-implementáveis:

1. Mostrar lista detalhada com o que será feito em cada um:
```
### Feedbacks para implementação automática (Y itens)

1. **FB-209** - Formulário passagem vendas
   → Ação: Ajustar campo X no VendasView.jsx

2. **FB-205** - Cor do badge incorreta
   → Ação: Fix CSS no FeedbackCard.jsx
```

2. Perguntar ao usuário usando AskUserQuestion:
   - "Posso implementar estes Y feedbacks?" [Sim, todos / Quero revisar a lista]

3. Para cada feedback aprovado, SEQUENCIALMENTE:
   a. Atualizar status para `em_progresso`:
      ```bash
      cd "e:/Git/relatorio/backend" && node scripts/update-feedback-status.mjs --id {ID} --status em_progresso
      ```
   b. Criar feature branch:
      ```bash
      cd "e:/Git/relatorio"
      git checkout develop && git pull origin develop
      git checkout -b feature/fb-{id}-{descricao-kebab}
      ```
   c. Implementar a mudança (editar os arquivos necessários)
   d. Build de verificação (se mudou frontend):
      ```bash
      cd "e:/Git/relatorio/frontend" && npm run build
      ```
   e. Commit seguindo padrões do projeto:
      ```bash
      cd "e:/Git/relatorio"
      git add [arquivos]
      git commit -m "$(cat <<'EOF'
      fix(fb-{id}): descrição da correção

      Resolve FB-{id}: {titulo do feedback}

      Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
      EOF
      )"
      ```
   f. Push:
      ```bash
      git push -u origin feature/fb-{id}-{descricao-kebab}
      ```
   g. Atualizar feedback como finalizado:
      ```bash
      cd "e:/Git/relatorio/backend" && node scripts/update-feedback-status.mjs --id {ID} --status finalizado --analysis "Implementado na branch feature/fb-{id}-{descricao}" --action "Correção aplicada em {arquivo}"
      ```
   h. Voltar para develop:
      ```bash
      cd "e:/Git/relatorio" && git checkout develop
      ```

## Etapa 5: Apresentar Complexos (Um a Um)

Para cada feedback classificado como "Precisa aprovação":

1. Mostrar detalhes completos:
```
### FB-{id}: {titulo}

**Autor**: {nome} | **Tipo**: {type} | **Área**: {area}
**Data**: {created_at}

> {feedback_text completo}

**Análise Claude:**
- Arquivos envolvidos: [lista de arquivos]
- Escopo: [pequeno/médio/grande]
- Proposta: [o que fazer]
- Riscos: [se houver]
```

2. Perguntar ao usuário usando AskUserQuestion:
   - [Implementar agora] - Segue fluxo da Etapa 4
   - [Mover para backlog] - Marca como em_analise com parecer
   - [Recusar] - Marca como recusado com justificativa
   - [Pular] - Não faz nada, segue pro próximo

3. Se "Mover para backlog":
   ```bash
   cd "e:/Git/relatorio/backend" && node scripts/update-feedback-status.mjs --id {ID} --status em_analise --analysis "Feedback analisado, movido para backlog de desenvolvimento"
   ```

4. Se "Recusar" - perguntar justificativa e:
   ```bash
   cd "e:/Git/relatorio/backend" && node scripts/update-feedback-status.mjs --id {ID} --status recusado --analysis "{justificativa}"
   ```

## Etapa 6: Responder Não-Código

Para cada feedback "não é código":

1. Sugerir texto para `admin_analysis` e `admin_action`
2. Pedir confirmação ou edição do usuário
3. Atualizar:
   ```bash
   cd "e:/Git/relatorio/backend" && node scripts/update-feedback-status.mjs --id {ID} --status finalizado --analysis "{texto}" --action "{acao}"
   ```

## Etapa 7: Resumo Final

Ao terminar todos os feedbacks:

```
## Triagem Concluída

| Ação | Qtd | Feedbacks |
|------|-----|-----------|
| Implementados | X | FB-209, FB-205, ... |
| Em backlog | Y | FB-210, ... |
| Recusados | Z | FB-198, ... |
| Respondidos (não-código) | W | FB-195, ... |
| Pulados | V | FB-192, ... |

Branches criadas: feature/fb-209-..., feature/fb-205-...
```

Sugerir: "Quer que eu crie os PRs para develop das branches implementadas?"

---

## Mapeamento Área → Código

Usar esta referência para localizar os arquivos corretos de cada feedback:

| Área | Arquivos/Diretórios Principais |
|------|-------------------------------|
| projetos | `frontend/src/components/ProjetosView.jsx`, `PortfolioView.jsx` |
| lideres | `frontend/src/components/PortfolioView.jsx`, `CurvaSView.jsx`, `CronogramaView.jsx` |
| cs | `frontend/src/pages/cs/`, `frontend/src/components/CSView.jsx` |
| apoio | `frontend/src/pages/apoio/` |
| admin_financeiro | `frontend/src/components/AdminFinanceiroView.jsx` |
| vendas | `frontend/src/components/VendasView.jsx` |
| workspace | `frontend/src/pages/workspace/` |
| vista_cliente | `frontend/src/pages/vista-cliente/` |
| indicadores | `frontend/src/pages/indicadores/` |
| okrs | `frontend/src/pages/okrs/` |
| configuracoes | `frontend/src/components/AcessosView.jsx`, `ConfiguracoesView.jsx` |
| feedbacks | `frontend/src/pages/feedbacks/` |

Sempre ler o arquivo relacionado ANTES de propor mudanças.

---

## Regras Importantes

1. **NUNCA commitar em main ou develop** - sempre criar feature branch
2. **Um branch por feedback** - feature/fb-{id}-descricao
3. **Build deve passar** antes de commit (se mudou frontend)
4. **Ler o código antes de mudar** - entender o componente antes de editar
5. **Se screenshot_url existir** - analisar a imagem para entender o problema visual
6. **Atualizar status no Supabase** - em_progresso ao iniciar, finalizado ao concluir
