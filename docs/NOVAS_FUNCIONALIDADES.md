# Novas Funcionalidades - Formulário de Passagem e Feedbacks

Este documento descreve as duas novas funcionalidades implementadas no sistema.

## 1. Formulário de Passagem

### Descrição
Formulário para registrar passagens de projetos. Visível apenas para:
- Diretores
- Administradores
- Setor de Vendas

### Acesso
- **Rota**: `/formulario-passagem`
- **Controle de Acesso**: Implementado em `backend/auth-config.js` através da função `canAccessFormularioPassagem()`
- **Configuração de Vendas**: Adicione os emails do setor de vendas no array `VENDAS_EMAILS` em `backend/auth-config.js`

### Funcionalidades
- Formulário com campos:
  - Cliente (obrigatório)
  - Projeto (obrigatório)
  - Data de Passagem (obrigatório)
  - Responsável (obrigatório)
  - Observações (opcional)

### Implementação Futura
- Endpoint no backend para salvar os dados do formulário
- Tabela no Supabase para armazenar os dados
- Vista para visualizar histórico de passagens

## 2. Feedbacks

### Descrição
Sistema de feedbacks que permite ao time dar feedbacks sobre processos ou a plataforma, com acompanhamento de status e pareceres de admin.

### Acesso
- **Rota**: `/feedbacks`
- **Acesso**: Todos os usuários autenticados podem criar e ver seus próprios feedbacks
- **Admin**: Administradores e diretores podem ver todos os feedbacks e adicionar pareceres

### Funcionalidades

#### 1. Novo Feedback (Aba "Novo Feedback")
- Formulário para criar feedbacks
- Campos:
  - Tipo: "Processo" ou "Plataforma"
  - Título (obrigatório)
  - Descrição (obrigatória)

#### 2. Meus Feedbacks (Aba "Meus Feedbacks")
- Vista para o time acompanhar o status dos seus próprios feedbacks
- Exibe:
  - Tipo do feedback
  - Status (Pendente, Em Análise, Resolvido, Arquivado)
  - Título e descrição
  - Parecer do admin (se houver)
  - Data de criação

#### 3. Gerenciar Feedbacks (Aba "Gerenciar Feedbacks" - apenas Admin)
- Vista para administradores e diretores
- Funcionalidades:
  - Ver todos os feedbacks do sistema
  - Alterar status dos feedbacks
  - Adicionar/editar parecer sobre cada feedback
  - Visualizar autor de cada feedback

### Status dos Feedbacks
- **Pendente**: Feedback recém-criado, aguardando análise
- **Em Análise**: Feedback sendo analisado pela equipe
- **Resolvido**: Feedback foi resolvido/implementado
- **Arquivado**: Feedback arquivado (não será mais trabalhado)

### Estrutura de Dados
A tabela `feedbacks` no Supabase contém:
- `id`: UUID único
- `tipo`: 'processo' ou 'plataforma'
- `titulo`: Título do feedback
- `descricao`: Descrição detalhada
- `status`: Status atual
- `parecer_admin`: Parecer do administrador (opcional)
- `created_by`: Email de quem criou
- `created_at`: Data de criação
- `updated_at`: Data da última atualização
- `updated_by`: Email de quem atualizou

### Endpoints da API

#### GET /api/feedbacks
Retorna todos os feedbacks. Usuários normais veem apenas os seus próprios.

#### POST /api/feedbacks
Cria um novo feedback.
```json
{
  "tipo": "processo" | "plataforma",
  "titulo": "Título do feedback",
  "descricao": "Descrição detalhada"
}
```

#### PUT /api/feedbacks/:id/status
Atualiza o status de um feedback.
```json
{
  "status": "pendente" | "em_analise" | "resolvido" | "arquivado"
}
```

#### PUT /api/feedbacks/:id/parecer
Adiciona ou atualiza o parecer do admin (apenas admin/director).
```json
{
  "parecer": "Texto do parecer"
}
```

## Configuração

### 1. Criar Tabela no Supabase
Execute o SQL fornecido em `docs/TABELA_FEEDBACKS.md` no Supabase SQL Editor.

### 2. Configurar Setor de Vendas
Edite `backend/auth-config.js` e adicione os emails do setor de vendas no array `VENDAS_EMAILS`:

```javascript
export const VENDAS_EMAILS = [
  'vendas1@otusengenharia.com',
  'vendas2@otusengenharia.com',
  // Adicione mais emails conforme necessário
];
```

## Arquivos Criados/Modificados

### Frontend
- `frontend/src/components/FormularioPassagemView.jsx` - Componente do formulário de passagem
- `frontend/src/components/FeedbacksView.jsx` - Componente de feedbacks
- `frontend/src/styles/FormularioPassagemView.css` - Estilos do formulário de passagem
- `frontend/src/styles/FeedbacksView.css` - Estilos de feedbacks
- `frontend/src/App.jsx` - Adicionadas rotas e links de navegação
- `frontend/src/contexts/AuthContext.jsx` - Adicionada função `canAccessFormularioPassagem`

### Backend
- `backend/auth-config.js` - Adicionadas funções `isVendas()` e `canAccessFormularioPassagem()`
- `backend/server.js` - Adicionados endpoints de feedbacks
- `backend/supabase.js` - Adicionadas funções para gerenciar feedbacks

### Documentação
- `docs/TABELA_FEEDBACKS.md` - SQL para criar a tabela de feedbacks
- `docs/NOVAS_FUNCIONALIDADES.md` - Este documento

## Próximos Passos

### Formulário de Passagem
1. Criar tabela no Supabase para armazenar os dados
2. Implementar endpoint POST para salvar formulários
3. Criar vista para visualizar histórico de passagens
4. Implementar controle de cadastros para vendas

### Feedbacks
1. Adicionar notificações quando um feedback muda de status
2. Adicionar filtros na vista de admin (por tipo, status, data)
3. Adicionar busca de feedbacks
4. Adicionar exportação de feedbacks
