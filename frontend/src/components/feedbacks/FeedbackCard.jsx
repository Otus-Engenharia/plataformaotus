import React from 'react';
import './FeedbackCard.css';
import './FeedbackMention.css';
import { renderTextWithMentions } from './FeedbackMention';

/**
 * Status colors for visual identification
 */
const STATUS_CONFIG = {
  pendente: { label: 'Pendente', color: '#f59e0b' },
  em_analise: { label: 'Em Análise', color: '#3b82f6' },
  em_progresso: { label: 'Em Progresso', color: '#8b5cf6' },
  backlog_desenvolvimento: { label: 'Backlog Dev', color: '#8b5cf6' },
  backlog_treinamento: { label: 'Backlog Treino', color: '#ec4899' },
  analise_funcionalidade: { label: 'Análise Func.', color: '#06b6d4' },
  finalizado: { label: 'Finalizado', color: '#22c55e' },
  recusado: { label: 'Recusado', color: '#6b7280' }
};

const TYPE_CONFIG = {
  bug: { label: 'Bug', icon: '🐛' },
  feedback_processo: { label: 'Processo', icon: '⚙️' },
  feedback_plataforma: { label: 'Plataforma', icon: '💻' },
  erro: { label: 'Erro', icon: '❌' },
  outro: { label: 'Outro', icon: '📝' }
};

/**
 * Categorias disponíveis para classificação por devs
 */
const CATEGORY_CONFIG = {
  ux: { label: 'UX', color: '#8b5cf6' },
  bug: { label: 'Bug', color: '#ef4444' },
  bug_dados: { label: 'Bug de Dados', color: '#e67e22' },
  bug_tecnologia: { label: 'Bug de Tecnologia', color: '#9b59b6' },
  performance: { label: 'Performance', color: '#f59e0b' },
  feature: { label: 'Feature', color: '#22c55e' },
  integracao: { label: 'Integração', color: '#3b82f6' },
  documentacao: { label: 'Documentação', color: '#64748b' },
  treinamento: { label: 'Treinamento', color: '#ec4899' },
  processo: { label: 'Processo', color: '#06b6d4' }
};

/**
 * Formata data para exibição relativa
 */
function formatRelativeDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 7) return `${diffDays}d`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}sem`;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

/**
 * Extrai nome amigável da página a partir de uma URL
 */
function getPageName(url) {
  if (!url) return null;
  const PAGE_NAMES = {
    'home': 'Home',
    'portfolio': 'Portfolio',
    'curva-s': 'Curva S',
    'cronograma': 'Cronograma',
    'cs': 'Customer Success',
    'custos': 'Custos',
    'horas': 'Horas',
    'equipe': 'Equipe',
    'indicadores': 'Indicadores',
    'feedbacks': 'Feedbacks',
    'okrs': 'OKRs',
    'apontamentos': 'Apontamentos',
    'projetos': 'Projetos',
    'operacao': 'Operação',
    'admin': 'Admin',
    'contatos': 'Contatos',
    'agenda': 'Agenda',
    'demandas-apoio': 'Demandas Apoio',
    'baselines': 'Baselines',
    'indicadores-vendas': 'Indicadores Vendas',
    'alocacao-times': 'Alocação de Times',
    'gantt': 'Gantt Modelagem',
    'workspace': 'Workspace',
    'ind': 'Indicadores Individuais',
    'estudos-custos': 'Estudos de Custos',
    'formulario-passagem': 'Formulário de Passagem',
    'controle-passivo': 'Controle Passivo',
    'lideres-projeto': 'Líderes de Projeto',
    'apoio-projetos': 'Apoio de Projetos',
    'gestao-tarefas': 'Gestão de Tarefas',
    'configuracoes': 'Configurações',
    'admin-financeiro': 'Admin & Financeiro',
    'vendas': 'Vendas',
    'vista-cliente': 'Vista do Cliente',
    'cs-area': 'CS',
  };
  // Chave simples (novo formato do dropdown)
  if (PAGE_NAMES[url]) return PAGE_NAMES[url];
  // URL completa (formato antigo)
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/^\//, '').replace(/\/$/, '');
    if (!path) return 'Home';
    const firstSegment = path.split('/')[0];
    return PAGE_NAMES[firstSegment] || firstSegment.charAt(0).toUpperCase() + firstSegment.slice(1);
  } catch {
    return null;
  }
}

/**
 * Extrai iniciais do nome para avatar
 */
function getInitials(name, email) {
  if (name) {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
  if (email) {
    return email.substring(0, 2).toUpperCase();
  }
  return '??';
}

/**
 * Card de feedback minimalista para Kanban
 */
export default function FeedbackCard({ feedback, isOwn = false, onClick, onMentionClick }) {
  const typeConfig = TYPE_CONFIG[feedback.type] || TYPE_CONFIG.outro;
  const categoryConfig = feedback.category ? CATEGORY_CONFIG[feedback.category] : null;

  const handleClick = () => {
    if (onClick) onClick(feedback);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  // Trunca o texto para preview
  const rawPreviewText = feedback.titulo ||
    (feedback.feedback_text?.length > 80
      ? feedback.feedback_text.substring(0, 80) + '...'
      : feedback.feedback_text);

  // Renderiza com menções clicáveis
  const previewContent = renderTextWithMentions(rawPreviewText, onMentionClick);

  const authorName = feedback.author_name ||
    feedback.author_email?.split('@')[0] ||
    'Anônimo';

  return (
    <article
      className={`fcard ${isOwn ? 'fcard--own' : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`Feedback: ${rawPreviewText}`}
    >
      {/* Top row: código + tipo + categoria + data */}
      <div className="fcard__top">
        <div className="fcard__meta">
          <span className="fcard__code">FB-{feedback.id}</span>
          <span className="fcard__tipo">
            {typeConfig.icon} {typeConfig.label}
          </span>
          {categoryConfig && (
            <span
              className="fcard__category"
              style={{ '--category-color': categoryConfig.color }}
            >
              {categoryConfig.label}
            </span>
          )}
        </div>
        <span className="fcard__date">{formatRelativeDate(feedback.created_at)}</span>
      </div>

      {/* Content */}
      <p className="fcard__text">{previewContent}</p>

      {/* Footer: autor + indicadores */}
      <div className="fcard__footer">
        <div className="fcard__author">
          <span className="fcard__avatar">{getInitials(feedback.author_name, feedback.author_email)}</span>
          <span className="fcard__name">{authorName}</span>
        </div>
        <div className="fcard__indicators">
          {getPageName(feedback.page_url) && (
            <span className="fcard__page" title={feedback.page_url}>
              {getPageName(feedback.page_url)}
            </span>
          )}
          {feedback.admin_analysis && <span title="Tem resposta">💬</span>}
          {isOwn && <span title="Seu feedback">⭐</span>}
        </div>
      </div>
    </article>
  );
}

export { STATUS_CONFIG, TYPE_CONFIG, CATEGORY_CONFIG };
