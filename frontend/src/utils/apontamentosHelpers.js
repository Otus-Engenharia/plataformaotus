/**
 * Helpers compartilhados para Apontamentos
 * Extraídos de ApontamentosView.jsx para reuso na Vista do Cliente
 */

// ---- Constantes ----

export const STATUS_TRANSLATION = {
  'active': 'Ativo',
  'resolved': 'Resolvido',
  'reproved': 'Reprovado',
  'pending': 'Pendente',
  'in_progress': 'Em Progresso',
  'blocked': 'Bloqueado',
  'cancelled': 'Cancelado',
};

export const PRIORITY_TRANSLATION = {
  'high': 'Alta',
  'medium': 'Média',
  'low': 'Baixa',
  'alta': 'Alta',
  'média': 'Média',
  'baixa': 'Baixa',
};

export const PHASE_ORDER = [
  'Projeto Legal',
  'Estudo preliminar',
  'Anteprojeto',
  'Pré-executivo',
  'Projeto Executivo',
  'Projeto básico',
];

// ---- Funções auxiliares ----

export function translateStatus(status) {
  if (!status) return 'Não definido';
  const statusLower = String(status).toLowerCase().trim();
  return STATUS_TRANSLATION[statusLower] || status;
}

export function translatePriority(priority) {
  if (!priority) return 'Não definida';
  const priorityLower = String(priority).toLowerCase().trim();
  return PRIORITY_TRANSLATION[priorityLower] || priority;
}

export function isResolved(status) {
  if (!status) return false;
  const statusLower = String(status).toLowerCase().trim();
  return statusLower === 'resolved' ||
         statusLower === 'resolvido' ||
         statusLower.includes('resolvido') ||
         statusLower.includes('concluído') ||
         statusLower.includes('concluido');
}

export function isReproved(status) {
  if (!status) return false;
  const statusLower = String(status).toLowerCase().trim();
  return statusLower === 'reproved' ||
         statusLower === 'reprovado' ||
         statusLower.includes('reprovado');
}

// ---- Processamento de dados ----

export function processIssueData(rawIssues) {
  return rawIssues.map(issue => ({
    ...issue,
    locals: issue.locals
      ? (Array.isArray(issue.locals)
          ? issue.locals.map(l => typeof l === 'string' ? { name: l, abbreviation: l } : l)
          : [])
      : (issue.localNames
          ? (typeof issue.localNames === 'string'
              ? issue.localNames.split(',').map(s => s.trim()).filter(Boolean).map(name => ({ name, abbreviation: name }))
              : Array.isArray(issue.localNames)
                ? issue.localNames.filter(Boolean).map(name => ({ name, abbreviation: name }))
                : [{ name: issue.localNames, abbreviation: issue.localNames }])
          : []),
    localNames: issue.locals
      ? (Array.isArray(issue.locals)
          ? issue.locals.map(l => typeof l === 'string' ? l : (l.name || l))
          : [])
      : (issue.localNames
          ? (typeof issue.localNames === 'string'
              ? issue.localNames.split(',').map(s => s.trim()).filter(Boolean)
              : Array.isArray(issue.localNames)
                ? issue.localNames.filter(Boolean)
                : [issue.localNames])
          : []),
    disciplines: issue.disciplines
      ? (Array.isArray(issue.disciplines)
          ? issue.disciplines.map(d => {
              if (typeof d === 'object' && d !== null && d.name) {
                return { name: d.name, status: d.status || null };
              }
              if (typeof d === 'string') {
                return { name: d, status: null };
              }
              return null;
            }).filter(Boolean)
          : [])
      : (issue.disciplineNames
          ? (typeof issue.disciplineNames === 'string'
              ? issue.disciplineNames.split(',').map(s => s.trim()).filter(Boolean).map(name => ({ name, status: null }))
              : Array.isArray(issue.disciplineNames)
                ? issue.disciplineNames.filter(Boolean).map(name => ({ name, status: null }))
                : [{ name: issue.disciplineNames, status: null }])
          : []),
  }));
}

// ---- Date helpers ----

export function getLatestUpdate(issue) {
  const dates = [];

  if (issue.editedAt) dates.push({ date: new Date(issue.editedAt), type: 'Edição' });
  if (issue.statusUpdatedAt) dates.push({ date: new Date(issue.statusUpdatedAt), type: 'Atualização de Status' });
  if (issue.updatedAt) dates.push({ date: new Date(issue.updatedAt), type: 'Atualização Geral' });
  if (issue.visibilityUpdatedAt) dates.push({ date: new Date(issue.visibilityUpdatedAt), type: 'Mudança de Visibilidade' });
  if (issue.lastCommentDate) dates.push({ date: new Date(issue.lastCommentDate), type: 'Último Comentário' });
  if (issue.createdAt) dates.push({ date: new Date(issue.createdAt), type: 'Criação' });

  if (dates.length === 0) return { date: null, type: 'N/A' };

  return dates.reduce((max, current) => current.date > max.date ? current : max);
}

export function getTimeSinceUpdate(issue) {
  const latest = getLatestUpdate(issue);
  if (!latest.date) return { text: 'N/A', type: latest.type, days: 0 };

  const now = new Date();
  const diffMs = now - latest.date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  let text;
  if (diffDays > 0) {
    text = `${diffDays} ${diffDays === 1 ? 'dia' : 'dias'}`;
  } else if (diffHours > 0) {
    text = `${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
  } else if (diffMinutes > 0) {
    text = `${diffMinutes} ${diffMinutes === 1 ? 'minuto' : 'minutos'}`;
  } else {
    text = 'Agora';
  }

  return { text, type: latest.type, days: diffDays };
}

// ---- Agregações ----

export function computeIndicators(issues) {
  if (!issues || issues.length === 0) {
    return { total: 0, resolvidos: 0, ativos: 0, ativosAltaPrioridade: 0, percentualAltaPrioridade: '0.00', reprovados: 0 };
  }

  const resolvidos = issues.filter(i => isResolved(i.status));
  const ativos = issues.filter(i => !isResolved(i.status) && !isReproved(i.status));
  const ativosAltaPrioridade = ativos.filter(i => {
    const priority = String(i.priority || '').toLowerCase();
    return priority === 'high' || priority === 'alta';
  });
  const reprovados = issues.filter(i => isReproved(i.status));

  return {
    total: issues.length,
    resolvidos: resolvidos.length,
    ativos: ativos.length,
    ativosAltaPrioridade: ativosAltaPrioridade.length,
    percentualAltaPrioridade: ativos.length > 0
      ? ((ativosAltaPrioridade.length / ativos.length) * 100).toFixed(2)
      : '0.00',
    reprovados: reprovados.length,
  };
}

export function aggregateByPriority(issues) {
  const counts = {};
  issues.forEach(issue => {
    const priority = translatePriority(issue.priority);
    if (!counts[priority]) counts[priority] = { total: 0, resolvidos: 0, ativos: 0 };
    counts[priority].total++;
    if (isResolved(issue.status)) {
      counts[priority].resolvidos++;
    } else if (!isReproved(issue.status)) {
      counts[priority].ativos++;
    }
  });
  return counts;
}

export function aggregateByPhase(issues) {
  const counts = {};
  issues.forEach(issue => {
    let phaseName = issue.creationPhaseName || issue.resolutionPhaseName;
    const phaseId = issue.creationPhase || issue.resolutionPhase;

    if (!phaseName || (typeof phaseName === 'string' && phaseName.trim() === '')) {
      phaseName = phaseId ? `Fase ${phaseId}` : 'Não definida';
    }
    if (phaseName === String(phaseId) && phaseId != null) {
      phaseName = `Fase ${phaseId}`;
    }

    if (!counts[phaseName]) counts[phaseName] = { total: 0, resolvidos: 0, ativos: 0 };
    counts[phaseName].total++;
    if (isResolved(issue.status)) {
      counts[phaseName].resolvidos++;
    } else if (!isReproved(issue.status)) {
      counts[phaseName].ativos++;
    }
  });
  return counts;
}

export function aggregateByDiscipline(issues) {
  const counts = {};
  issues.forEach(issue => {
    const disciplines = issue.disciplines || [];
    if (disciplines.length === 0) {
      const key = 'Não definida';
      if (!counts[key]) counts[key] = { total: 0, resolvidos: 0, ativos: 0 };
      counts[key].total++;
      if (isResolved(issue.status)) {
        counts[key].resolvidos++;
      } else if (!isReproved(issue.status)) {
        counts[key].ativos++;
      }
    } else {
      disciplines.forEach(discipline => {
        if (!discipline || !discipline.name) return;
        const name = discipline.name;
        if (!counts[name]) counts[name] = { total: 0, resolvidos: 0, ativos: 0 };
        counts[name].total++;
        const statusStr = discipline.status ? String(discipline.status).trim().toLowerCase() : '';
        if (statusStr === '' || statusStr === 'todo') {
          counts[name].ativos++;
        } else {
          counts[name].resolvidos++;
        }
      });
    }
  });
  return counts;
}

export function aggregateByCategory(issues) {
  const counts = {};
  issues.forEach(issue => {
    let categoryName = issue.categoryName;
    const categoryId = issue.category;

    if (!categoryName || (typeof categoryName === 'string' && categoryName.trim() === '')) {
      categoryName = categoryId ? `Categoria ${categoryId}` : 'Não definida';
    }
    if (categoryName === String(categoryId) && categoryId != null) {
      categoryName = `Categoria ${categoryId}`;
    }

    if (!counts[categoryName]) counts[categoryName] = { total: 0, resolvidos: 0, ativos: 0 };
    counts[categoryName].total++;
    if (isResolved(issue.status)) {
      counts[categoryName].resolvidos++;
    } else if (!isReproved(issue.status)) {
      counts[categoryName].ativos++;
    }
  });
  return counts;
}

export function aggregateByLocal(issues) {
  const grouped = {};
  issues.forEach(issue => {
    const locals = issue.locals || [];
    if (locals.length === 0) {
      if (!grouped['Sem Local']) grouped['Sem Local'] = { abbreviation: 'SL', issues: [] };
      grouped['Sem Local'].issues.push(issue);
    } else {
      locals.forEach(local => {
        const localName = typeof local === 'string' ? local : (local.name || local);
        const localAbbr = typeof local === 'string' ? local : (local.abbreviation || local.name || local);
        if (!grouped[localName]) grouped[localName] = { abbreviation: localAbbr, issues: [] };
        grouped[localName].issues.push(issue);
      });
    }
  });
  return grouped;
}

// ---- Client discipline helpers ----

export function extractClientDisciplines(project) {
  if (!project || !project.disciplina_cliente) return [];
  const disciplinaCliente = String(project.disciplina_cliente).trim();
  if (!disciplinaCliente) return [];
  return disciplinaCliente
    .split(',')
    .map(d => d.trim())
    .filter(d => d.length > 0)
    .map(d => d.toLowerCase());
}

export function filterClientOpenIssues(issues, clientDisciplines) {
  if (clientDisciplines.length === 0) return [];

  return issues.filter(issue => {
    if (!issue.disciplines || !Array.isArray(issue.disciplines) || issue.disciplines.length === 0) {
      return false;
    }
    return issue.disciplines.some(discipline => {
      const disciplineName = String(discipline.name || '').trim().toLowerCase();
      const disciplineStatus = String(discipline.status || '').trim().toLowerCase();

      const matchesClientDiscipline = clientDisciplines.some(clientDisc => {
        const normalizedClient = clientDisc.toLowerCase().trim();
        const normalizedName = disciplineName.toLowerCase().trim();
        return normalizedName === normalizedClient ||
               normalizedName.includes(normalizedClient) ||
               normalizedClient.includes(normalizedName);
      });

      const isOpen = disciplineStatus === 'todo' || disciplineStatus === '' || !discipline.status;
      return matchesClientDiscipline && isOpen;
    });
  });
}

export function extractUniqueLocals(issues) {
  const localsMap = new Map();
  issues.forEach(issue => {
    (issue.locals || []).forEach(local => {
      const name = typeof local === 'string' ? local : (local.name || local);
      const abbreviation = typeof local === 'string' ? local : (local.abbreviation || local.name || local);
      if (name && !localsMap.has(name)) {
        localsMap.set(name, { name, abbreviation });
      }
    });
  });
  return Array.from(localsMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

// ---- Sort helpers ----

export function sortPhaseLabels(labels, phaseData) {
  const normalize = (name) => name.toLowerCase().trim();
  return [...labels].sort((a, b) => {
    if (normalize(a) === 'não definida') return 1;
    if (normalize(b) === 'não definida') return -1;
    const idxA = PHASE_ORDER.findIndex(o => normalize(o) === normalize(a));
    const idxB = PHASE_ORDER.findIndex(o => normalize(o) === normalize(b));
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b, 'pt-BR');
  });
}

export function sortPriorityLabels(labels) {
  const order = { 'Alta': 0, 'Média': 1, 'Baixa': 2, 'Não definida': 3 };
  return [...labels].sort((a, b) => (order[a] ?? 999) - (order[b] ?? 999));
}
