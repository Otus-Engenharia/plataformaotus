# Tabela de Permissões de Vistas - Supabase

Este documento descreve a estrutura da tabela `user_views` que armazena quais vistas cada usuário pode acessar.

## Estrutura da Tabela

Execute o seguinte SQL no Supabase SQL Editor:

```sql
-- Cria a tabela de permissões de vistas
CREATE TABLE IF NOT EXISTS user_views (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  view_id VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(email, view_id)
);

-- Cria índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_user_views_email ON user_views(email);
CREATE INDEX IF NOT EXISTS idx_user_views_view_id ON user_views(view_id);

-- Comentários nas colunas
COMMENT ON TABLE user_views IS 'Armazena permissões de acesso a vistas específicas por usuário';
COMMENT ON COLUMN user_views.email IS 'Email do usuário (deve corresponder ao email do Google Account)';
COMMENT ON COLUMN user_views.view_id IS 'ID da vista (ex: indicadores-lideranca, horas, projetos, etc)';
```

## Campos da Tabela

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | Identificador único (gerado automaticamente) |
| `email` | VARCHAR(255) | Email do usuário (chave para identificar o usuário) |
| `view_id` | VARCHAR(100) | ID da vista permitida |
| `created_at` | TIMESTAMPTZ | Data de criação da permissão |

## IDs de Vistas Disponíveis

As seguintes vistas estão disponíveis no sistema:

- `indicadores-lideranca` - Indicadores Liderança
- `horas` - Horas
- `indicadores` - Indicadores
- `okrs` - OKRs (Objetivos e Resultados Chave)
- `projetos` - Projetos
- `cs` - CS
- `estudo-de-custos` - Estudo de Custos
- `contatos` - Contatos
- `formulario-passagem` - Formulário de Passagem
- `feedbacks` - Feedbacks

## Exemplos de Uso

### Adicionar permissão para um usuário acessar uma vista
```sql
INSERT INTO user_views (email, view_id)
VALUES ('usuario@otusengenharia.com', 'projetos');
```

### Ver todas as permissões de um usuário
```sql
SELECT view_id 
FROM user_views 
WHERE email = 'usuario@otusengenharia.com';
```

### Remover todas as permissões de um usuário
```sql
DELETE FROM user_views 
WHERE email = 'usuario@otusengenharia.com';
```

### Ver todos os usuários que têm acesso a uma vista específica
```sql
SELECT email 
FROM user_views 
WHERE view_id = 'projetos';
```

## Notas Importantes

1. **Constraint UNIQUE**: A combinação `(email, view_id)` é única, evitando duplicatas.

2. **Nível de Acesso vs. Permissões de Vistas**:
   - O nível de acesso (director, admin, leader) define permissões gerais
   - As permissões de vistas permitem controle granular sobre quais vistas específicas cada usuário pode acessar
   - Se um usuário não tiver permissões de vistas definidas, o sistema usa apenas o nível de acesso

3. **Backend**: O backend usa a chave de serviço do Supabase, então as políticas RLS podem não se aplicar. Ajuste conforme necessário se usar RLS.

4. **Performance**: Os índices criados melhoram a performance das consultas por email e view_id.
