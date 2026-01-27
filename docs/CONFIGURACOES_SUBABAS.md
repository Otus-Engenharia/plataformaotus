# Configurações - Sistema de Subabas e Controle de Acessos

Este documento descreve o novo sistema de configurações com subabas e controle granular de acesso por vista.

## Estrutura de Subabas

A vista de Configurações (`/acessos`) agora possui 3 subabas:

### 1. Operação
Gerencia acessos e permissões de vistas dos colaboradores. Esta é a funcionalidade principal que substitui a antiga `AdminAccessView`.

**Funcionalidades:**
- Visualização de todos os colaboradores ativos
- Filtros por Time, Líder e Cargo
- Busca por nome, email, time, etc.
- Gerenciamento de nível de acesso (Diretoria, Admin, Líder, Sem acesso)
- **NOVO:** Controle granular de acesso por vista
  - Cada colaborador pode ter permissões específicas para cada vista
  - Interface inline para editar permissões diretamente na tabela
  - Checkboxes para selecionar quais vistas cada pessoa pode acessar

### 2. Comercial
Configurações comerciais (placeholder - a implementar no futuro).

### 3. Clientes
Configurações de clientes (placeholder - a implementar no futuro).

## Controle de Acesso por Vista

### Vistas Disponíveis

O sistema permite controlar o acesso às seguintes vistas:

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

### Como Funciona

1. **Nível de Acesso vs. Permissões de Vistas:**
   - O nível de acesso (director, admin, leader) define permissões gerais
   - As permissões de vistas permitem controle granular sobre quais vistas específicas cada usuário pode acessar
   - **Diretores e Admins** têm acesso automático a todas as vistas (não precisam de permissões específicas)

2. **Comportamento:**
   - Se um usuário **não tem permissões de vistas definidas**: o sistema usa apenas o nível de acesso
   - Se um usuário **tem permissões de vistas definidas**: o sistema verifica se a vista está na lista permitida
   - Se a vista não estiver na lista, o acesso é negado mesmo que o nível de acesso permita

3. **Interface de Gerenciamento:**
   - Na tabela de Operação, cada linha tem uma coluna "Vistas"
   - Clique em "Editar" para abrir o editor de permissões
   - Selecione/deselecione as vistas desejadas
   - Clique em "Salvar" para aplicar as mudanças

## Estrutura de Dados

### Tabela `user_views` (Supabase)

Armazena as permissões de vistas por usuário:

```sql
CREATE TABLE user_views (
  id UUID PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  view_id VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(email, view_id)
);
```

## Endpoints da API

### GET /api/admin/user-views
Retorna todas as permissões de vistas dos usuários (apenas admin/director).

**Resposta:**
```json
{
  "success": true,
  "data": [
    { "email": "usuario@otusengenharia.com", "view_id": "projetos" },
    { "email": "usuario@otusengenharia.com", "view_id": "horas" }
  ]
}
```

### PUT /api/admin/user-views
Atualiza as permissões de vistas de um usuário (apenas admin/director).

**Body:**
```json
{
  "email": "usuario@otusengenharia.com",
  "views": ["projetos", "horas", "cs"]
}
```

### GET /api/user/my-views
Retorna as vistas permitidas para o usuário logado.

**Resposta:**
```json
{
  "success": true,
  "data": ["projetos", "horas", "cs"]
}
```

## Arquivos Criados/Modificados

### Frontend
- `frontend/src/components/ConfiguracoesView.jsx` - Componente principal com abas
- `frontend/src/components/OperacaoView.jsx` - Vista de operação (substitui AdminAccessView)
- `frontend/src/components/ComercialView.jsx` - Vista comercial (placeholder)
- `frontend/src/components/ClientesView.jsx` - Vista de clientes (placeholder)
- `frontend/src/components/ViewProtectedRoute.jsx` - Rota protegida por vista
- `frontend/src/hooks/useViewAccess.js` - Hook para verificar acesso a vista
- `frontend/src/styles/ConfiguracoesView.css` - Estilos das configurações
- `frontend/src/styles/OperacaoView.css` - Estilos da operação
- `frontend/src/styles/ComercialView.css` - Estilos comerciais
- `frontend/src/styles/ClientesView.css` - Estilos de clientes
- `frontend/src/App.jsx` - Atualizado para usar ConfiguracoesView

### Backend
- `backend/server.js` - Adicionados endpoints de permissões de vistas
- `backend/supabase.js` - Adicionadas funções para gerenciar permissões

### Documentação
- `docs/TABELA_USER_VIEWS.md` - SQL para criar a tabela
- `docs/CONFIGURACOES_SUBABAS.md` - Este documento

## Configuração

### 1. Criar Tabela no Supabase
Execute o SQL fornecido em `docs/TABELA_USER_VIEWS.md` no Supabase SQL Editor.

### 2. Usar o Sistema
1. Acesse `/acessos` (apenas admin/director)
2. Vá para a aba "Operação"
3. Encontre o colaborador na tabela
4. Clique em "Editar" na coluna "Vistas"
5. Selecione as vistas que o colaborador pode acessar
6. Clique em "Salvar"

## Próximos Passos

### Comercial e Clientes
- Implementar funcionalidades específicas para cada aba
- Definir estrutura de dados necessária
- Criar interfaces de gerenciamento

### Melhorias Futuras
- Adicionar filtros na tabela de Operação (por nível de acesso, por vista)
- Adicionar exportação de permissões
- Adicionar histórico de mudanças de permissões
- Adicionar notificações quando permissões são alteradas
- Implementar grupos de permissões (templates)
