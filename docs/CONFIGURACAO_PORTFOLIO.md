# 📋 Configuração do Portfólio - Passo a Passo

## ✅ O que já fizemos:

### 1. **Corrigimos o arquivo `.env`**
   - **Antes:** `BIGQUERY_DATASET=portifolio.portifolio_plataforma_enriched` ❌
   - **Agora:** 
     - `BIGQUERY_DATASET=portifolio` ✅
     - `BIGQUERY_TABLE_PORTFOLIO=portifolio_plataforma_enriched` ✅

   **Por quê?** 
   - O dataset e a tabela são coisas diferentes no BigQuery
   - Dataset = pasta que contém tabelas
   - Tabela = arquivo com os dados

### 2. **Criamos uma função para descobrir as colunas**
   - Função `getTableSchema()` no `bigquery.js`
   - Rota `/api/schema` no servidor
   - Isso vai nos ajudar a descobrir quais colunas existem na tabela

### 3. **Ajustamos a query inicial**
   - Por enquanto, a query busca todas as colunas (`SELECT *`)
   - Depois que descobrirmos as colunas, vamos ajustar para selecionar apenas as que precisamos

---

## 🚀 Próximos Passos - Vamos fazer juntos!

### **Passo 1: Iniciar o servidor**

Abra um terminal na pasta `backend` e execute:

```bash
npm start
```

Você deve ver:
```
🚀 Servidor rodando na porta 3001
📍 Health check: http://localhost:3001/api/health
🔍 Schema da tabela: http://localhost:3001/api/schema
📊 Portfolio API: http://localhost:3001/api/portfolio
```

---

### **Passo 2: Descobrir as colunas da tabela**

Com o servidor rodando, abra o navegador e acesse:

**http://localhost:3001/api/schema**

**O que esperar:**
- Se funcionar: Você verá um JSON com todas as colunas da tabela
- Se der erro: Vamos ver a mensagem de erro e corrigir juntos

**Exemplo do que você pode ver:**
```json
{
  "success": true,
  "message": "Estrutura da tabela portifolio_plataforma_enriched",
  "columns": [
    {
      "column_name": "id_projeto",
      "data_type": "STRING",
      "is_nullable": "YES"
    },
    {
      "column_name": "nome",
      "data_type": "STRING",
      "is_nullable": "YES"
    }
    // ... mais colunas
  ]
}
```

---

### **Passo 3: Ver uma amostra dos dados**

Acesse no navegador:

**http://localhost:3001/api/portfolio**

**O que esperar:**
- Você verá 10 linhas de dados da tabela
- Isso nos ajuda a entender:
  - Quais colunas existem
  - Como os dados estão formatados
  - Quais nomes de colunas usar na query final

---

### **Passo 4: Ajustar a query SQL**

Depois que você me mostrar:
1. ✅ As colunas que existem (do `/api/schema`)
2. ✅ Uma amostra dos dados (do `/api/portfolio`)

Vou te ajudar a:
- Identificar quais colunas usar para:
  - ID do projeto
  - Nome do projeto
  - Status
  - Datas (início/fim)
  - Orçamento/Custos
  - Progresso

E então vamos ajustar a query SQL para buscar exatamente o que precisamos!

---

## 🎯 Objetivo Final

Criar uma query que retorne dados no formato:

```json
{
  "projeto_id": "123",
  "nome_projeto": "Projeto X",
  "status": "Em Andamento",
  "data_inicio": "2024-01-01",
  "data_fim": "2024-12-31",
  "orcamento": 100000,
  "custo_atual": 75000,
  "progresso_percentual": 75
}
```

---

## ❓ Dúvidas Comuns

### **Erro: "Table not found"**
- Verifique se o nome da tabela está correto no `.env`
- Verifique se você tem permissão para acessar a tabela

### **Erro: "Permission denied"**
- Verifique se o arquivo `service-account-key.json` está na pasta `backend/`
- Verifique se a Service Account tem permissão no BigQuery

### **Erro: "Dataset not found"**
- Verifique se o dataset `portifolio` existe no projeto `dadosindicadores`
- No BigQuery Console, veja se consegue ver o dataset

---

## 📝 Checklist

- [ ] Servidor iniciado sem erros
- [ ] Rota `/api/schema` retorna as colunas
- [ ] Rota `/api/portfolio` retorna dados de exemplo
- [ ] Compartilhou comigo os resultados para ajustarmos a query

---

**Pronto para começar? Execute o servidor e me mostre os resultados! 🚀**
