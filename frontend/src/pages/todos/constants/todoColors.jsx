import React from 'react';

// Paleta Todoist para prioridade
export const PRIORITY_COLORS = {
  'alta': '#d1453b',
  'média': '#eb8909',
  'media': '#eb8909',
  'baixa': '#246fe0',
};

export const STATUS_COLORS = {
  'backlog': '#64748b',
  'a fazer': '#f59e0b',
  'em progresso': '#3b82f6',
  'validação': '#8b5cf6',
  'finalizado': '#22c55e',
  'cancelado': '#6b7280',
};

export const STATUS_ORDER = ['backlog', 'a fazer', 'em progresso', 'validação', 'finalizado', 'cancelado'];
export const PRIORITY_ORDER = ['alta', 'média', 'baixa'];

export function PriorityFlagIcon({ color = '#246fe0', size = 14, className = '' }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3 1.5V14.5"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M3 2.5H12.5L10 5.5L12.5 8.5H3V2.5Z"
        fill={color}
      />
    </svg>
  );
}

export const STATUS_LABELS = {
  'backlog': 'Backlog',
  'a fazer': 'A Fazer',
  'em progresso': 'Em Progresso',
  'validação': 'Validação',
  'finalizado': 'Finalizado',
  'cancelado': 'Cancelado',
};

const STATUS_CYCLE = {
  'backlog': 'a fazer',
  'a fazer': 'em progresso',
  'em progresso': 'validação',
  'validação': 'finalizado',
  'finalizado': 'backlog',
  'cancelado': 'a fazer',
};

export function getNextStatus(current) {
  return STATUS_CYCLE[(current || 'backlog').toLowerCase()] || 'a fazer';
}

const PRIORITY_CYCLE = { 'baixa': 'média', 'média': 'alta', 'alta': 'baixa' };

export function getNextPriority(current) {
  return PRIORITY_CYCLE[(current || 'baixa').toLowerCase()] || 'média';
}

export function getTodoColor(todo, colorMode) {
  if (colorMode === 'status') {
    const statusKey = (todo.status || 'backlog').toLowerCase();
    return STATUS_COLORS[statusKey] || '#94a3b8';
  }
  const priorityKey = (todo.priority_label || todo.priority || 'baixa').toLowerCase();
  return PRIORITY_COLORS[priorityKey] || PRIORITY_COLORS['baixa'];
}
