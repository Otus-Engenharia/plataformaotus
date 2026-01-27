# Tabela de Feedbacks - Supabase

Este documento descreve a estrutura da tabela `feedbacks` que deve ser criada no Supabase.

## Estrutura da Tabela

Execute o seguinte SQL no Supabase SQL Editor:

```sql
-- Cria a tabela de feedbacks
CREATE TABLE IF NOT EXISTS feedbacks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('processo', 'plataforma')),
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_analise', 'resolvido', 'arquivado')),
  parecer_admin TEXT,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by VARCHAR(255)
);

-- Cria índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_feedbacks_created_by ON feedbacks(created_by);
CREATE INDEX IF NOT EXISTS idx_feedbacks_status ON feedbacks(status);
CREATE INDEX IF NOT EXISTS idx_feedbacks_created_at ON feedbacks(created_at DESC);

-- Cria função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Cria trigger para atualizar updated_at
CREATE TRIGGER update_feedbacks_updated_at
  BEFORE UPDATE ON feedbacks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Permite que usuários autenticados leiam seus próprios feedbacks
-- e que admins leiam todos os feedbacks
-- (Ajuste as políticas RLS conforme necessário)
ALTER TABLE feedbacks ENABLE ROW LEVEL SECURITY;

-- Política: Usuários podem ver seus próprios feedbacks
CREATE POLICY "Users can view own feedbacks"
  ON feedbacks FOR SELECT
  USING (auth.jwt() ->> 'email' = created_by);

-- Política: Usuários podem criar feedbacks
CREATE POLICY "Users can create feedbacks"
  ON feedbacks FOR INSERT
  WITH CHECK (true);

-- Política: Admins podem ver todos os feedbacks
-- (Ajuste conforme sua lógica de roles)
CREATE POLICY "Admins can view all feedbacks"
  ON feedbacks FOR SELECT
  USING (true); -- Ajuste para verificar role de admin

-- Política: Admins podem atualizar feedbacks
CREATE POLICY "Admins can update feedbacks"
  ON feedbacks FOR UPDATE
  USING (true); -- Ajuste para verificar role de admin
```

## Campos da Tabela

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | Identificador único do feedback (gerado automaticamente) |
| `tipo` | VARCHAR(20) | Tipo do feedback: 'processo' ou 'plataforma' |
| `titulo` | VARCHAR(255) | Título/resumo do feedback |
| `descricao` | TEXT | Descrição detalhada do feedback |
| `status` | VARCHAR(20) | Status do feedback: 'pendente', 'em_analise', 'resolvido', 'arquivado' |
| `parecer_admin` | TEXT | Parecer do admin sobre o feedback (opcional) |
| `created_by` | VARCHAR(255) | Email de quem criou o feedback |
| `created_at` | TIMESTAMPTZ | Data de criação |
| `updated_at` | TIMESTAMPTZ | Data da última atualização |
| `updated_by` | VARCHAR(255) | Email de quem fez a última atualização |

## Notas Importantes

1. **Row Level Security (RLS)**: As políticas RLS devem ser ajustadas conforme sua lógica de autenticação e autorização. O exemplo acima é básico e pode precisar de ajustes.

2. **Roles**: Se você usar roles do Supabase Auth, ajuste as políticas para verificar os roles corretos.

3. **Backend**: O backend usa a chave de serviço do Supabase, então as políticas RLS podem não se aplicar. Ajuste conforme necessário.

4. **Índices**: Os índices criados melhoram a performance das consultas por usuário, status e data.
