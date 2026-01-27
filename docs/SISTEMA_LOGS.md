# Sistema de Logs - Documentação

Este documento descreve o sistema de logs implementado para rastrear acessos e ações dos usuários na plataforma.

## Visão Geral

O sistema de logs registra automaticamente todas as ações importantes dos usuários, permitindo:
- **Acompanhamento de acessos**: Ver quem acessou o quê e quando
- **Auditoria**: Rastrear mudanças e ações importantes
- **Indicadores de uso**: Analisar uso da plataforma e das ferramentas
- **Segurança**: Detectar atividades suspeitas

## Estrutura

### Tabela de Logs

A tabela `logs` no Supabase armazena:
- Email e nome do usuário
- Tipo de ação realizada
- Tipo e nome do recurso acessado/modificado
- Detalhes adicionais (JSON)
- IP e User Agent
- Data e hora da ação

Veja `docs/TABELA_LOGS.md` para detalhes da estrutura SQL.

### Tipos de Ações Registradas

Atualmente, o sistema registra:

- **Login/Logout**: Entrada e saída do sistema
- **Acesso a vistas**: Quando um usuário acessa uma rota/vista
- **Visualização de dados**: Quando dados são consultados (ex: portfólio)
- **Criação de recursos**: Quando algo é criado (ex: feedback)
- **Atualização de recursos**: Quando algo é modificado (ex: permissões)
- **Visualização de logs**: Quando admins visualizam os logs

## Funcionalidades

### 1. Visualização de Logs (Admin/Director)

Acesse a aba **"Logs"** em Configurações (`/acessos`) para:
- Ver todos os logs do sistema
- Filtrar por usuário, tipo de ação, tipo de recurso, data
- Ver estatísticas de uso
- Exportar dados para análise

### 2. Estatísticas de Uso

A aba de Logs inclui estatísticas:
- **Ações por tipo**: Quantas ações de cada tipo foram realizadas
- **Uso de vistas**: Quantos acessos cada vista teve e quantos usuários únicos

### 3. Filtros Disponíveis

- **Email do usuário**: Filtrar ações de um usuário específico
- **Tipo de ação**: access, view, create, update, delete, login, logout
- **Tipo de recurso**: view, portfolio, feedback, user_views, logs
- **Período**: Data inicial e final

## Endpoints da API

### GET /api/admin/logs
Retorna logs com filtros (apenas admin/director).

**Query params:**
- `user_email`: Filtrar por email
- `action_type`: Filtrar por tipo de ação
- `resource_type`: Filtrar por tipo de recurso
- `start_date`: Data inicial (ISO format)
- `end_date`: Data final (ISO format)
- `limit`: Limite de resultados (padrão: 1000)
- `offset`: Offset para paginação

### GET /api/admin/logs/stats
Retorna estatísticas de uso (apenas admin/director).

**Query params:**
- `start_date`: Data inicial (ISO format)
- `end_date`: Data final (ISO format)

**Resposta:**
```json
{
  "success": true,
  "data": {
    "actions": [
      { "action_type": "view", "count": 150 },
      { "action_type": "create", "count": 25 }
    ],
    "views": [
      {
        "vista": "projetos",
        "usuarios_unicos": 10,
        "total_acessos": 45
      }
    ]
  }
}
```

## Ações Registradas Automaticamente

O sistema registra automaticamente:

1. **Login/Logout**: Quando usuários fazem login ou logout
2. **Acesso a Portfólio**: Quando o portfólio é consultado
3. **Criação de Feedback**: Quando um feedback é criado
4. **Atualização de Permissões**: Quando permissões de vistas são alteradas
5. **Visualização de Logs**: Quando admins visualizam os logs

## Extensão Futura

Para adicionar logging em novos endpoints:

```javascript
// No endpoint, após a ação bem-sucedida:
await logAction(req, 'action_type', 'resource_type', resourceId, resourceName, details);
```

Exemplo:
```javascript
app.post('/api/novo-recurso', requireAuth, async (req, res) => {
  // ... criar recurso ...
  const novoRecurso = await criarRecurso(dados);
  
  // Registrar no log
  await logAction(req, 'create', 'novo_recurso', novoRecurso.id, novoRecurso.nome);
  
  res.json({ success: true, data: novoRecurso });
});
```

## Uso como Indicadores

A tabela de logs pode ser usada para gerar indicadores de uso:

### Exemplos de Queries SQL

**Usuários mais ativos:**
```sql
SELECT 
  user_email,
  user_name,
  COUNT(*) as total_acoes
FROM logs
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY user_email, user_name
ORDER BY total_acoes DESC
LIMIT 10;
```

**Vistas mais acessadas:**
```sql
SELECT 
  resource_name,
  COUNT(*) as total_acessos,
  COUNT(DISTINCT user_email) as usuarios_unicos
FROM logs
WHERE resource_type = 'view'
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY resource_name
ORDER BY total_acessos DESC;
```

**Horários de pico:**
```sql
SELECT 
  EXTRACT(HOUR FROM created_at) as hora,
  COUNT(*) as total_acoes
FROM logs
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY hora
ORDER BY hora;
```

## Arquivos Relacionados

- `backend/server.js` - Middleware de logging e endpoints
- `backend/supabase.js` - Funções para gerenciar logs
- `frontend/src/components/LogsView.jsx` - Componente de visualização
- `frontend/src/styles/LogsView.css` - Estilos
- `docs/TABELA_LOGS.md` - Estrutura SQL da tabela

## Próximos Passos

1. **Dashboard de Indicadores**: Criar dashboard visual com gráficos de uso
2. **Alertas**: Configurar alertas para atividades suspeitas
3. **Exportação**: Adicionar exportação de logs em CSV/Excel
4. **Retenção**: Implementar política de retenção de logs antigos
5. **Análise Avançada**: Adicionar análises mais complexas (tendências, padrões)
