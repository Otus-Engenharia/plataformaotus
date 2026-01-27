# Tabela de Logs - Supabase

Este documento descreve a estrutura da tabela `logs` que armazena todas as ações e acessos dos usuários na plataforma.

## Estrutura da Tabela

Execute o seguinte SQL no Supabase SQL Editor:

```sql
-- Cria a tabela de logs
CREATE TABLE IF NOT EXISTS logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email VARCHAR(255) NOT NULL,
  user_name VARCHAR(255),
  action_type VARCHAR(50) NOT NULL,
  resource_type VARCHAR(100),
  resource_id VARCHAR(255),
  resource_name VARCHAR(255),
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cria índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_logs_user_email ON logs(user_email);
CREATE INDEX IF NOT EXISTS idx_logs_action_type ON logs(action_type);
CREATE INDEX IF NOT EXISTS idx_logs_resource_type ON logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_user_action ON logs(user_email, action_type);

-- Comentários nas colunas
COMMENT ON TABLE logs IS 'Armazena logs de ações e acessos dos usuários na plataforma';
COMMENT ON COLUMN logs.user_email IS 'Email do usuário que realizou a ação';
COMMENT ON COLUMN logs.user_name IS 'Nome do usuário (para facilitar consultas)';
COMMENT ON COLUMN logs.action_type IS 'Tipo de ação: access, view, create, update, delete, etc';
COMMENT ON COLUMN logs.resource_type IS 'Tipo de recurso: view, feedback, formulario_passagem, etc';
COMMENT ON COLUMN logs.resource_id IS 'ID do recurso específico (opcional)';
COMMENT ON COLUMN logs.resource_name IS 'Nome do recurso (opcional, para facilitar leitura)';
COMMENT ON COLUMN logs.details IS 'Detalhes adicionais em formato JSON';
COMMENT ON COLUMN logs.ip_address IS 'Endereço IP do usuário';
COMMENT ON COLUMN logs.user_agent IS 'User agent do navegador';
```

## Campos da Tabela

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | Identificador único (gerado automaticamente) |
| `user_email` | VARCHAR(255) | Email do usuário que realizou a ação |
| `user_name` | VARCHAR(255) | Nome do usuário (para facilitar consultas) |
| `action_type` | VARCHAR(50) | Tipo de ação (ver lista abaixo) |
| `resource_type` | VARCHAR(100) | Tipo de recurso acessado/modificado |
| `resource_id` | VARCHAR(255) | ID do recurso específico (opcional) |
| `resource_name` | VARCHAR(255) | Nome do recurso (opcional) |
| `details` | JSONB | Detalhes adicionais em formato JSON |
| `ip_address` | VARCHAR(45) | Endereço IP do usuário |
| `user_agent` | TEXT | User agent do navegador |
| `created_at` | TIMESTAMPTZ | Data e hora da ação |

## Tipos de Ações (action_type)

- `access` - Acesso a uma rota/vista
- `view` - Visualização de dados específicos
- `create` - Criação de um recurso
- `update` - Atualização de um recurso
- `delete` - Exclusão de um recurso
- `login` - Login no sistema
- `logout` - Logout do sistema
- `export` - Exportação de dados
- `filter` - Aplicação de filtros
- `search` - Busca realizada

## Tipos de Recursos (resource_type)

- `view` - Vista da aplicação (ex: projetos, horas, cs)
- `feedback` - Feedback criado/atualizado
- `formulario_passagem` - Formulário de passagem
- `user_views` - Permissões de vistas
- `user_access` - Acesso de usuário
- `portfolio` - Dados do portfólio
- `cronograma` - Cronograma de projeto
- `apontamento` - Apontamento de projeto

## Exemplos de Uso

### Ver logs de um usuário específico
```sql
SELECT * 
FROM logs 
WHERE user_email = 'usuario@otusengenharia.com'
ORDER BY created_at DESC
LIMIT 100;
```

### Ver acessos a uma vista específica
```sql
SELECT user_email, user_name, created_at
FROM logs 
WHERE resource_type = 'view' 
  AND resource_name = 'projetos'
ORDER BY created_at DESC;
```

### Contar ações por tipo
```sql
SELECT action_type, COUNT(*) as total
FROM logs
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY action_type
ORDER BY total DESC;
```

### Ver uso de vistas (indicador de uso)
```sql
SELECT 
  resource_name as vista,
  COUNT(DISTINCT user_email) as usuarios_unicos,
  COUNT(*) as total_acessos
FROM logs
WHERE resource_type = 'view'
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY resource_name
ORDER BY total_acessos DESC;
```

### Ver atividade por usuário
```sql
SELECT 
  user_email,
  user_name,
  COUNT(*) as total_acoes,
  COUNT(DISTINCT DATE(created_at)) as dias_ativos
FROM logs
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY user_email, user_name
ORDER BY total_acoes DESC;
```

## Notas Importantes

1. **Performance**: Os índices criados melhoram significativamente a performance das consultas.

2. **Retenção de Dados**: Considere implementar uma política de retenção (ex: manter logs por 1 ano) para evitar crescimento excessivo da tabela.

3. **Privacidade**: Os logs contêm informações sensíveis. Garanta que apenas admins tenham acesso.

4. **Análise Futura**: A estrutura permite análises complexas usando o campo `details` (JSONB) para métricas personalizadas.

5. **Indicadores de Uso**: Esta tabela pode ser usada para gerar dashboards de uso da plataforma e das ferramentas.
