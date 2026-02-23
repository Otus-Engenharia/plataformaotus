/**
 * Domain Service: SnapshotDiffService
 *
 * Serviço puro (sem I/O) que compara snapshots mensais consecutivos
 * para detectar 4 tipos de alteração nas tarefas do projeto:
 * - DESVIO_PRAZO: duração da tarefa mudou (campo Duracao do SmartSheet)
 * - TAREFA_CRIADA: tarefa apareceu no snapshot seguinte
 * - TAREFA_DELETADA: tarefa desapareceu no snapshot seguinte
 * - TAREFA_NAO_FEITA: status mudou para indicar que não será feita
 */

import { parseBqDate } from './WeightCalculationService.js';

// Statuses que indicam tarefa não será feita
const NAO_FEITA_STATUSES = [
  'cancelada', 'cancelado', 'cancelled',
  'não será feita', 'nao sera feita',
  'descartada', 'descartado',
  'suspensa', 'suspenso',
  'n/a', 'não aplicável', 'nao aplicavel',
];

function isNaoFeitaStatus(status) {
  if (!status) return false;
  return NAO_FEITA_STATUSES.some(s =>
    status.toLowerCase().trim() === s
  );
}

/**
 * Gera chave de matching para uma tarefa.
 * Usa NomeDaTarefa + Disciplina para disambiguar duplicatas.
 */
function taskMatchKey(task) {
  const name = (task.NomeDaTarefa || task.nome_tarefa || '').toLowerCase().trim();
  const disc = (task.Disciplina || task.disciplina || '').toLowerCase().trim();
  return `${name}||${disc}`;
}

/**
 * Gera label de mês a partir de uma data string.
 * Ex: "2025-03-15" → "Mar/25"
 */
function monthLabel(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  const label = d.toLocaleString('pt-BR', { month: 'short' }) + '/' + String(d.getFullYear()).slice(2);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

class SnapshotDiffService {
  /**
   * Compara duas listas de tarefas de snapshots consecutivos.
   * @param {Array} prevTasks - Tarefas do snapshot anterior
   * @param {Array} currTasks - Tarefas do snapshot atual
   * @returns {Array} Lista de mudanças detectadas
   */
  static diffPair(prevTasks, currTasks) {
    const prevMap = new Map();
    const currMap = new Map();

    for (const t of prevTasks) prevMap.set(taskMatchKey(t), t);
    for (const t of currTasks) currMap.set(taskMatchKey(t), t);

    const changes = [];

    // TAREFA_CRIADA: existe no atual mas não no anterior
    for (const [key, task] of currMap) {
      if (!prevMap.has(key)) {
        changes.push({
          type: 'TAREFA_CRIADA',
          task_name: task.NomeDaTarefa || task.nome_tarefa,
          disciplina: task.Disciplina || task.disciplina || null,
          fase_nome: task.fase_nome || null,
          curr_data_termino: parseBqDate(task.DataDeTermino || task.data_termino),
          curr_status: task.Status || task.status || null,
        });
      }
    }

    // TAREFA_DELETADA: existe no anterior mas não no atual
    for (const [key, task] of prevMap) {
      if (!currMap.has(key)) {
        changes.push({
          type: 'TAREFA_DELETADA',
          task_name: task.NomeDaTarefa || task.nome_tarefa,
          disciplina: task.Disciplina || task.disciplina || null,
          fase_nome: task.fase_nome || null,
          prev_data_termino: parseBqDate(task.DataDeTermino || task.data_termino),
          prev_status: task.Status || task.status || null,
        });
      }
    }

    // Tarefas em ambos: verificar DESVIO_PRAZO e TAREFA_NAO_FEITA
    for (const [key, prevTask] of prevMap) {
      const currTask = currMap.get(key);
      if (!currTask) continue;

      const prevEnd = parseBqDate(prevTask.DataDeTermino || prevTask.data_termino);
      const currEnd = parseBqDate(currTask.DataDeTermino || currTask.data_termino);
      const prevStatus = prevTask.Status || prevTask.status || '';
      const currStatus = currTask.Status || currTask.status || '';
      const taskName = currTask.NomeDaTarefa || currTask.nome_tarefa;
      const disciplina = currTask.Disciplina || currTask.disciplina || null;
      const faseNome = currTask.fase_nome || null;

      // Duração do SmartSheet (dias úteis)
      const prevDuration = Number(prevTask.Duracao ?? prevTask.duracao);
      const currDuration = Number(currTask.Duracao ?? currTask.duracao);

      // DESVIO_PRAZO: duração da tarefa mudou (não apenas deslocamento no calendário)
      if (!isNaN(prevDuration) && !isNaN(currDuration) && prevDuration !== currDuration) {
        const deltaDays = currDuration - prevDuration;
        changes.push({
          type: 'DESVIO_PRAZO',
          task_name: taskName,
          disciplina,
          fase_nome: faseNome,
          prev_data_termino: prevEnd,
          curr_data_termino: currEnd,
          prev_duration: prevDuration,
          curr_duration: currDuration,
          delta_days: deltaDays,
          prev_status: prevStatus,
          curr_status: currStatus,
        });
      }

      // TAREFA_NAO_FEITA: status mudou para "não será feita"
      if (!isNaoFeitaStatus(prevStatus) && isNaoFeitaStatus(currStatus)) {
        changes.push({
          type: 'TAREFA_NAO_FEITA',
          task_name: taskName,
          disciplina,
          fase_nome: faseNome,
          prev_status: prevStatus,
          curr_status: currStatus,
          prev_data_termino: prevEnd,
          curr_data_termino: currEnd,
        });
      }
    }

    return changes;
  }

  /**
   * Compara todos os snapshots consecutivos de um projeto.
   * @param {Map<string, Array>} snapshotsMap - Map de snapshot_date → tasks[]
   * @returns {{ month_pairs: Array, overall_summary: Object }}
   */
  static diffAllSnapshots(snapshotsMap) {
    const sortedDates = [...snapshotsMap.keys()].sort();
    const monthPairs = [];

    for (let i = 0; i < sortedDates.length - 1; i++) {
      const fromDate = sortedDates[i];
      const toDate = sortedDates[i + 1];
      const prevTasks = snapshotsMap.get(fromDate) || [];
      const currTasks = snapshotsMap.get(toDate) || [];

      if (prevTasks.length === 0 && currTasks.length === 0) continue;

      const changes = this.diffPair(prevTasks, currTasks);

      const summary = {
        total: changes.length,
        desvios: changes.filter(c => c.type === 'DESVIO_PRAZO').length,
        criadas: changes.filter(c => c.type === 'TAREFA_CRIADA').length,
        deletadas: changes.filter(c => c.type === 'TAREFA_DELETADA').length,
        nao_feitas: changes.filter(c => c.type === 'TAREFA_NAO_FEITA').length,
      };

      monthPairs.push({
        from_snapshot: fromDate,
        to_snapshot: toDate,
        from_label: monthLabel(fromDate),
        to_label: monthLabel(toDate),
        changes,
        summary,
      });
    }

    // Ordenar: mais recente primeiro
    monthPairs.reverse();

    const overallSummary = {
      total_changes: monthPairs.reduce((sum, p) => sum + p.summary.total, 0),
      months_analyzed: monthPairs.length,
      total_desvios: monthPairs.reduce((sum, p) => sum + p.summary.desvios, 0),
      total_criadas: monthPairs.reduce((sum, p) => sum + p.summary.criadas, 0),
      total_deletadas: monthPairs.reduce((sum, p) => sum + p.summary.deletadas, 0),
      total_nao_feitas: monthPairs.reduce((sum, p) => sum + p.summary.nao_feitas, 0),
    };

    return { month_pairs: monthPairs, overall_summary: overallSummary };
  }

  /**
   * Agrega mudanças por disciplina para scoring futuro.
   * @param {{ month_pairs: Array }} diffResult - Resultado de diffAllSnapshots
   * @returns {Array} Ranking de disciplinas por impacto
   */
  static scoreDisciplines(diffResult) {
    const disciplineStats = new Map();

    for (const pair of diffResult.month_pairs) {
      for (const change of pair.changes) {
        const disc = change.disciplina || 'Sem disciplina';
        if (!disciplineStats.has(disc)) {
          disciplineStats.set(disc, {
            disciplina: disc,
            total: 0,
            desvios: 0,
            criadas: 0,
            deletadas: 0,
            nao_feitas: 0,
            total_desvio_dias: 0,
          });
        }
        const stats = disciplineStats.get(disc);
        stats.total++;
        if (change.type === 'DESVIO_PRAZO') {
          stats.desvios++;
          stats.total_desvio_dias += Math.abs(change.delta_days || 0);
        }
        if (change.type === 'TAREFA_CRIADA') stats.criadas++;
        if (change.type === 'TAREFA_DELETADA') stats.deletadas++;
        if (change.type === 'TAREFA_NAO_FEITA') stats.nao_feitas++;
      }
    }

    return [...disciplineStats.values()]
      .sort((a, b) => b.total - a.total);
  }
}

export { SnapshotDiffService, isNaoFeitaStatus, NAO_FEITA_STATUSES };
