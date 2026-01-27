# 📚 Referências dos Repositórios Lovable

## 🔗 **Repositórios de Referência:**

- **OKRs:** https://github.com/Otus-Engenharia/okrs
- **Indicadores:** https://github.com/Otus-Engenharia/indicadores

---

## ✅ **Correções Já Implementadas:**

### **1. Removido Oráculo das páginas OKRs e Indicadores**
- ✅ Oráculo não aparece mais em `/okrs` e `/indicadores`
- ✅ Arquivo: `frontend/src/App.jsx`

### **2. Corrigido bug no filtro de nível**
- ✅ Corrigido: `query.eq('level', level)` → `query.eq('nivel', level)`
- ✅ Arquivo: `backend/supabase.js` linha 624

---

## 🔍 **O que Verificar nos Repositórios de Referência:**

### **Para OKRs (`github.com/Otus-Engenharia/okrs`):**

1. **Estrutura de Dados:**
   - ✅ Campos da tabela `okrs` estão corretos?
   - ✅ Campos da tabela `key_results` estão corretos?
   - ✅ Relacionamentos entre tabelas estão corretos?

2. **Funcionalidades:**
   - ✅ Criar OKR
   - ✅ Editar OKR
   - ✅ Deletar OKR
   - ✅ Adicionar Key Results
   - ✅ Atualizar progresso
   - ✅ Filtros (Quarter, Nível)
   - ✅ Visualização de progresso

3. **UI/UX:**
   - ✅ Layout dos cards de OKR
   - ✅ Formulários de criação/edição
   - ✅ Indicadores visuais de progresso
   - ✅ Cores e status (verde, amarelo, vermelho)

4. **Cálculos:**
   - ✅ Como o progresso do OKR é calculado?
   - ✅ Como o progresso do Key Result é calculado?
   - ✅ Fórmulas de cálculo

---

### **Para Indicadores (`github.com/Otus-Engenharia/indicadores`):**

1. **Estrutura de Dados:**
   - ✅ Campos da tabela `indicadores` estão corretos?
   - ✅ Campos da tabela `indicadores_historico` estão corretos?
   - ✅ Categorias de indicadores

2. **Funcionalidades:**
   - ✅ Criar Indicador
   - ✅ Editar Indicador
   - ✅ Deletar Indicador
   - ✅ Registrar histórico
   - ✅ Filtros (Período, Categoria)
   - ✅ Gráficos e visualizações

3. **UI/UX:**
   - ✅ Tipos de gráficos (Bar, Line, Pie)
   - ✅ Layout dos cards de indicadores
   - ✅ Formulários de criação/edição
   - ✅ Cores e status (verde, amarelo, vermelho)

4. **Cálculos:**
   - ✅ Como a tendência é calculada?
   - ✅ Como o percentual de meta é calculado?
   - ✅ Fórmulas de cálculo

---

## 🐛 **Problemas Conhecidos:**

### **1. Dados não aparecem:**
- ⚠️ Verificar se as tabelas foram criadas no Supabase
- ⚠️ Verificar se os dados de exemplo foram inseridos
- ⚠️ Verificar se as políticas RLS estão corretas

### **2. Filtros não funcionam:**
- ✅ **CORRIGIDO:** Bug do `level` vs `nivel` no backend
- ⚠️ Verificar se os filtros do frontend estão enviando os parâmetros corretos

### **3. Formulários não salvam:**
- ⚠️ Verificar se os endpoints POST estão funcionando
- ⚠️ Verificar se os dados estão sendo enviados no formato correto
- ⚠️ Verificar se as políticas RLS permitem INSERT

---

## 📋 **Checklist de Verificação:**

### **Backend:**
- [ ] Endpoints GET `/api/okrs` retorna dados
- [ ] Endpoints GET `/api/indicadores` retorna dados
- [ ] Endpoints POST `/api/okrs` cria OKR
- [ ] Endpoints POST `/api/indicadores` cria Indicador
- [ ] Endpoints PUT atualizam corretamente
- [ ] Endpoints DELETE funcionam
- [ ] Filtros funcionam (quarter, level, period, category)

### **Frontend:**
- [ ] Componente `OKRsView.jsx` carrega dados
- [ ] Componente `IndicadoresView.jsx` carrega dados
- [ ] Formulários de criação funcionam
- [ ] Formulários de edição funcionam
- [ ] Filtros atualizam a lista
- [ ] Gráficos são renderizados (Indicadores)
- [ ] Progresso é exibido corretamente (OKRs)

### **Supabase:**
- [ ] Tabelas criadas (`okrs`, `key_results`, `indicadores`, `indicadores_historico`)
- [ ] Índices criados
- [ ] Triggers funcionando
- [ ] Funções criadas
- [ ] Políticas RLS configuradas
- [ ] Dados de exemplo inseridos

---

## 🔧 **Próximos Passos:**

1. **Acessar os repositórios de referência:**
   - Clonar ou acessar `github.com/Otus-Engenharia/okrs`
   - Clonar ou acessar `github.com/Otus-Engenharia/indicadores`

2. **Comparar implementações:**
   - Verificar estrutura de dados
   - Verificar funcionalidades
   - Verificar cálculos
   - Verificar UI/UX

3. **Adaptar para Supabase:**
   - Ajustar queries se necessário
   - Ajustar estrutura de dados se necessário
   - Ajustar cálculos se necessário

4. **Testar:**
   - Criar OKR de teste
   - Criar Indicador de teste
   - Verificar se tudo funciona como no Lovable

---

## 📝 **Notas:**

- Os repositórios podem ser privados - pode ser necessário acesso
- Se os repositórios forem do Lovable, podem ter estrutura diferente (Lovable usa seu próprio backend)
- Adaptar para Supabase pode requerer ajustes nas queries e estrutura

---

**Última atualização:** 2026-01-27
