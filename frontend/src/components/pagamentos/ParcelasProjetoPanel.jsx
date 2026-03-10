import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import ParcelaStatusBadge, { STATUS_FINANCEIRO_CONFIG } from './ParcelaStatusBadge';
import InlineStatusDropdown from './InlineStatusDropdown';
import InlineDilatacaoInput from './InlineDilatacaoInput';
import ParcelaFormDialog from './ParcelaFormDialog';
import VincularParcelaDialog from './VincularParcelaDialog';
import ParcelaChangeLog from './ParcelaChangeLog';
import './ParcelasProjetoPanel.css';

const STATUS_FINANCEIRO_OPTIONS = Object.entries(STATUS_FINANCEIRO_CONFIG).map(([value, cfg]) => ({
  value, label: cfg.label, color: cfg.color,
}));

const PRAZO_LABELS = { atrasado: 'Atrasado', esse_mes: 'Esse Mês', esse_quarter: 'Esse Quarter', futuro: 'Futuro', sem_data: 'Sem Data' };

function getPrazoBucket(dataPagamento, isFaturado) {
  if (isFaturado) return null;
  if (!dataPagamento) return 'sem_data';
  const now = new Date();
  const d = new Date(dataPagamento);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (d < today) return 'atrasado';
  if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) return 'esse_mes';
  const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  const qEnd = new Date(qStart.getFullYear(), qStart.getMonth() + 3, 0);
  if (d <= qEnd) return 'esse_quarter';
  return 'futuro';
}

export default function ParcelasProjetoPanel({ projectCode, companyId, smartsheetId, projectName, mode = 'financeiro', tipoPagamento, ocultarFaturados = false, filterPrazo = { atrasado: false, esse_mes: false, esse_quarter: false, futuro: false, sem_data: false }, highlightSince }) {
  const { user, hasFullAccess } = useAuth();
  const isFinanceiro = mode === 'financeiro';
  const isLider = mode === 'lider';

  const [parcelas, setParcelas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingParcela, setEditingParcela] = useState(null);
  const [vincularOpen, setVincularOpen] = useState(false);
  const [vincularParcela, setVincularParcela] = useState(null);
  const [showLog, setShowLog] = useState(false);
  const [error, setError] = useState(null);
  const [aditivoFormOpen, setAditivoFormOpen] = useState(false);
  const [updatedParcelaIds, setUpdatedParcelaIds] = useState(new Set());

  const fetchParcelas = useCallback(async () => {
    if (!projectCode) return;
    setLoading(true);
    setError(null);
    try {
      const url = smartsheetId || projectName
        ? `/api/pagamentos/enriched?projectCode=${projectCode}&smartsheetId=${smartsheetId || ''}&projectName=${encodeURIComponent(projectName || '')}`
        : `/api/pagamentos/parcelas?projectCode=${projectCode}`;
      const { data } = await axios.get(url);
      if (data.success) setParcelas(data.data);
    } catch (err) {
      setError('Erro ao carregar parcelas');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [projectCode, smartsheetId, projectName]);

  useEffect(() => { fetchParcelas(); }, [fetchParcelas]);

  // Fetch parcela IDs altered since last visit (for highlight)
  useEffect(() => {
    if (!highlightSince || !projectCode || !user?.email) return;
    axios.get(`/api/pagamentos/change-log?projectCode=${projectCode}&since=${encodeURIComponent(highlightSince)}&excludeEmail=${encodeURIComponent(user.email)}`)
      .then(res => {
        if (res.data.success) {
          const ids = new Set(res.data.data.map(e => e.parcela_id).filter(Boolean));
          setUpdatedParcelaIds(ids);
        }
      })
      .catch(() => {});
  }, [highlightSince, projectCode, user?.email]);

  const handleCreateParcela = async (formData) => {
    await axios.post('/api/pagamentos/parcelas', formData);
    fetchParcelas();
  };

  const handleUpdateParcela = async (formData) => {
    await axios.put(`/api/pagamentos/parcelas/${editingParcela.id}`, formData);
    fetchParcelas();
  };

  const handleDeleteParcela = async (id) => {
    if (!confirm('Remover esta parcela?')) return;
    await axios.delete(`/api/pagamentos/parcelas/${id}`);
    fetchParcelas();
  };

  const handleVincular = async (vincData) => {
    await axios.put(`/api/pagamentos/parcelas/${vincularParcela.id}/vincular`, vincData);
    fetchParcelas();
  };

  const handleCreateAditivo = async (formData) => {
    await axios.post('/api/pagamentos/parcelas', formData);
    fetchParcelas();
  };

  const handleLimparAlerta = async (id) => {
    await axios.patch(`/api/pagamentos/parcelas/${id}/limpar-alerta`);
    fetchParcelas();
  };

  const handleDesvincular = async (id) => {
    if (!confirm('Desvincular esta parcela do cronograma?')) return;
    await axios.put(`/api/pagamentos/parcelas/${id}/vincular`, {
      smartsheet_row_id: null,
      smartsheet_task_name: null,
      smartsheet_data_termino: null,
      desvincular: true,
    });
    fetchParcelas();
  };

  const handleInlineStatusChange = (updatedParcela) => {
    setParcelas(prev => prev.map(p => p.id === updatedParcela.id ? updatedParcela : p));
  };

  const handleDilatacaoChange = (updatedParcela) => {
    setParcelas(prev => prev.map(p => p.id === updatedParcela.id ? updatedParcela : p));
  };

  const handleGerarEmail = async (parcela) => {
    try {
      await axios.patch(`/api/pagamentos/parcelas/${parcela.id}/status`, {
        field: 'solicitacao',
        value: 'solicitado',
      });
      // Build mailto as fallback
      const projeto = projectName || parcela.project_code;
      const descricao = parcela.descricao || `Parcela ${parcela.parcela_numero}`;
      const dataTermino = parcela.smartsheet_data_termino
        ? new Date(parcela.smartsheet_data_termino).toLocaleDateString('pt-BR')
        : '\u2014';
      const valor = parcela.valor != null
        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parcela.valor)
        : '\u2014';

      const subject = `${projeto} - Liberacao de Pagamento - ${descricao}`;
      const body = `Prezados,\n\nPor meio deste e-mail, informo que atingimos o marco final vinculado as parcelas de pagamento do projeto ${projeto}, desenvolvido pela Otus Engenharia.\n\nDetalhes da Parcela:\nParcela: ${descricao};\nApresentacao: Realizada em ${dataTermino};\nValor da Parcela: ${valor};\n\nConforme estabelecido em contrato, solicito a confirmacao para prosseguir com a emissao da nota fiscal e boleto correspondentes.\n\nFico a disposicao para quaisquer duvidas e seguimos juntos rumo a conclusao desse projeto!\n\nVamos juntos!`;

      window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');

      // Update local state to show solicitado
      setParcelas(prev => prev.map(p =>
        p.id === parcela.id ? { ...p, status_solicitacao: 'solicitado' } : p
      ));
    } catch (err) {
      console.error('Erro ao gerar email:', err);
    }
  };

  const formatCurrency = (v) => {
    if (v == null) return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  };

  const formatDate = (d) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('pt-BR');
  };

  const getSmartsheetStatusClass = (status) => {
    if (!status) return 'parcela-status-cronograma-badge--outro';
    const s = status.toLowerCase();
    if (/completo|complete|done|conclu[ií]da|entregue|100%|finalizado/.test(s)) return 'parcela-status-cronograma-badge--completo';
    if (/andamento|progress|iniciado/.test(s)) return 'parcela-status-cronograma-badge--andamento';
    return 'parcela-status-cronograma-badge--outro';
  };

  const anyPrazoActive = Object.values(filterPrazo).some(Boolean);

  const visibleParcelas = (() => {
    let result = ocultarFaturados
      ? parcelas.filter(p => p.status_financeiro !== 'faturado')
      : parcelas;
    if (anyPrazoActive) {
      result = result.filter(p => {
        const dp = p.data_pagamento_efetiva || p.data_pagamento_calculada || p.data_pagamento_manual;
        const bucket = getPrazoBucket(dp, p.status_financeiro === 'faturado');
        return bucket && filterPrazo[bucket];
      });
    }
    return result;
  })();

  const totalValor = visibleParcelas.reduce((sum, p) => sum + (Number(p.valor) || 0), 0);

  return (
    <div className="parcelas-panel">
      <div className="parcelas-panel-header">
        <div className="parcelas-panel-title">
          <h3>Parcelas de Pagamento</h3>
          <span className="parcelas-count">{visibleParcelas.length} parcela{visibleParcelas.length !== 1 ? 's' : ''}</span>
          {totalValor > 0 && <span className="parcelas-total">Total: {formatCurrency(totalValor)}</span>}
        </div>
        <div className="parcelas-panel-actions">
          <span className="tooltip-wrapper" data-tooltip="Ver historico de alteracoes das parcelas">
            <button className="parcelas-btn-icon" onClick={() => setShowLog(!showLog)}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" />
              </svg>
            </button>
          </span>
          {isFinanceiro && tipoPagamento === 'mrr' && (
            <span className="tooltip-wrapper" data-tooltip="Cadastrar parcela de aditivo SPOT para este projeto MRR">
              <button className="parcela-btn-aditivo" onClick={() => setAditivoFormOpen(true)}>
                + Aditivo SPOT
              </button>
            </span>
          )}
          {isFinanceiro && (
            <span className="tooltip-wrapper" data-tooltip="Cadastrar nova parcela de pagamento para este projeto">
              <button className="parcela-btn-primary" onClick={() => { setEditingParcela(null); setFormOpen(true); }}>
                + Nova Parcela
              </button>
            </span>
          )}
        </div>
      </div>

      {error && <div className="parcelas-error">{error}</div>}

      {loading ? (
        <div className="parcelas-loading">Carregando parcelas...</div>
      ) : visibleParcelas.length === 0 ? (
        <div className="parcelas-empty-state">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor">
            <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
          </svg>
          <p className="parcelas-empty-state-title">Nenhuma parcela cadastrada</p>
          <p className="parcelas-empty-state-subtitle">Este projeto ainda nao possui parcelas de pagamento registradas.</p>
          {isFinanceiro && (
            <button className="parcela-btn-primary" onClick={() => { setEditingParcela(null); setFormOpen(true); }}>
              Cadastrar Primeira Parcela
            </button>
          )}
        </div>
      ) : (
        <div className="parcelas-table-container">
          <table className="parcelas-table">
            <thead>
              <tr>
                <th><span className="tooltip-wrapper" data-tooltip="Numero sequencial da parcela">#</span></th>
                <th>Descricao</th>
                <th>Valor</th>
                <th><span className="tooltip-wrapper" data-tooltip="Status do pipeline financeiro">Financeiro</span></th>
                <th><span className="tooltip-wrapper" data-tooltip="Tarefa do cronograma, status e vinculacao">Cronograma</span></th>
                <th><span className="tooltip-wrapper" data-tooltip="Data termino, dilatacao e data de pagamento">Datas</span></th>
                <th><span className="tooltip-wrapper" data-tooltip="Classificacao temporal da parcela">Prazo</span></th>
                <th><span className="tooltip-wrapper" data-tooltip="Status da solicitacao de cobranca">Solicitacao</span></th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {visibleParcelas.map(p => {
                const isFaturado = p.status_financeiro === 'faturado';
                const isNaoVinculada = !p.smartsheet_row_id && !p.parcela_sem_cronograma && !isFaturado;
                const dataPagamento = p.data_pagamento_efetiva || p.data_pagamento_calculada || p.data_pagamento_manual;
                const isAtrasada = !isFaturado && dataPagamento && new Date(dataPagamento) < new Date();
                const prazoBucket = getPrazoBucket(dataPagamento, isFaturado);
                const dilatacao = p.dilatacao_dias || 0;

                const canEditStatusFinanceiro = isFinanceiro;

                return (
                <tr key={p.id} className={`${isFaturado ? 'parcela-row-pago' : ''} ${isNaoVinculada ? 'parcela-row-nao-vinculada' : ''} ${p.alerta_cronograma ? 'parcela-row-alerta' : ''} ${updatedParcelaIds.has(p.id) ? 'parcela-row-atualizado' : ''}`}>
                  {/* # — com tooltip da origem */}
                  <td>
                    <span className="tooltip-wrapper" data-tooltip={p.origem || ''}>
                      {p.alerta_cronograma && (
                        <span
                          className={`parcela-alerta-icon ${p.alerta_cronograma === 'tarefa_deletada' ? 'parcela-alerta-danger' : 'parcela-alerta-warning'}`}
                          title={p.alerta_cronograma === 'tarefa_deletada' ? 'Tarefa deletada no cronograma' : 'Data alterada no cronograma'}
                        >
                          {p.alerta_cronograma === 'tarefa_deletada' ? '\u26A0' : '\uD83D\uDCC5'}
                        </span>
                      )}
                      {p.parcela_numero}
                    </span>
                  </td>
                  {/* Descricao — com badge MOD/COORD e origem como sub-info */}
                  <td className={!p.descricao ? 'parcela-sem-descricao' : ''}>
                    {p.descricao || 'Sem descricao'}
                    {updatedParcelaIds.has(p.id) && (
                      <span className="parcela-atualizado-badge">Atualizado</span>
                    )}
                    {p.tipo_servico && p.tipo_servico !== 'coordenacao' && (
                      <span className="parcela-tipo-servico-badge parcela-tipo-servico-modelagem">MOD</span>
                    )}
                    {p.tipo_servico === 'coordenacao' && (
                      <span className="parcela-tipo-servico-badge parcela-tipo-servico-coordenacao">COORD</span>
                    )}
                    {p.origem && (
                      <span className="parcelas-descricao-origem">{p.origem}</span>
                    )}
                  </td>
                  {/* Valor */}
                  <td>{formatCurrency(p.valor)}</td>
                  {/* Financeiro */}
                  <td>
                    {canEditStatusFinanceiro ? (
                      <InlineStatusDropdown
                        parcelaId={p.id}
                        field="financeiro"
                        currentStatus={p.status_financeiro}
                        statusOptions={STATUS_FINANCEIRO_OPTIONS}
                        onStatusChanged={handleInlineStatusChange}
                      />
                    ) : (
                      <ParcelaStatusBadge status={p.status_financeiro} type="financeiro" />
                    )}
                  </td>
                  {/* Cronograma — merge Tarefa Vinculada + St. Projetos + smartsheet_status */}
                  <td className="parcelas-cronograma-cell">
                    {p.smartsheet_task_name ? (
                      <>
                        <span className="parcelas-cronograma-task-name tooltip-wrapper" data-tooltip={p.smartsheet_task_name}>
                          {p.smartsheet_task_name.length > 40
                            ? p.smartsheet_task_name.slice(0, 40) + '...'
                            : p.smartsheet_task_name}
                        </span>
                        {p.smartsheet_status && (
                          <span className={`parcela-status-cronograma-badge ${getSmartsheetStatusClass(p.smartsheet_status)}`}>
                            {p.smartsheet_status}
                          </span>
                        )}
                      </>
                    ) : p.parcela_sem_cronograma ? (
                      <span className="tooltip-wrapper parcela-sem-vinculacao-necessaria" data-tooltip="Esta parcela nao precisa de vinculo com cronograma">Sem vinculacao necessaria</span>
                    ) : (
                      <span className="parcelas-task-vincular-inline">
                        <span className="parcelas-no-task">Nao vinculada</span>
                        {(isLider || isFinanceiro) && (
                          <button className="parcelas-action-btn parcelas-action-vincular"
                            title="Vincular ao cronograma"
                            aria-label="Vincular ao cronograma"
                            onClick={(e) => { e.stopPropagation(); setVincularParcela(p); setVincularOpen(true); }}>
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" /></svg>
                          </button>
                        )}
                      </span>
                    )}
                  </td>
                  {/* Datas — merge Data Termino + Dilatacao + Data Pagamento */}
                  <td className="parcelas-datas-cell">
                    {p.smartsheet_data_termino ? (
                      <>
                        <span className="parcelas-datas-termino">{formatDate(p.smartsheet_data_termino)}</span>
                        <span className={`parcelas-datas-pagamento ${isAtrasada ? 'parcela-data-atrasada' : ''}`}>
                          {(isLider || isFinanceiro) ? (
                            <span className="parcelas-datas-dilatacao-input">
                              +<InlineDilatacaoInput
                                parcelaId={p.id}
                                currentValue={dilatacao}
                                onChanged={handleDilatacaoChange}
                              />d {dataPagamento ? `\u2192 ${formatDate(dataPagamento)}` : ''}
                            </span>
                          ) : (
                            <>
                              {dilatacao > 0 && `+${dilatacao}d \u2192 `}{formatDate(dataPagamento)}
                            </>
                          )}
                        </span>
                      </>
                    ) : (
                      <span style={{ color: '#9ca3af' }}>&mdash;</span>
                    )}
                    {p.data_limite_solicitacao && (
                      <span
                        className={`parcela-data-limite ${new Date(p.data_limite_solicitacao) < new Date() ? 'parcela-data-limite-vencida' : ''}`}
                        title={`Limite para solicitar: ${formatDate(p.data_limite_solicitacao)}`}
                      >
                        Limite: {formatDate(p.data_limite_solicitacao)}
                      </span>
                    )}
                  </td>
                  {/* Prazo */}
                  <td>
                    {prazoBucket && (
                      <span className={`parcela-prazo-badge parcela-prazo-${prazoBucket}`}>
                        {PRAZO_LABELS[prazoBucket]}
                      </span>
                    )}
                  </td>
                  {/* Solicitacao */}
                  <td>
                    {p.status_solicitacao === 'solicitado' ? (
                      <span className="parcela-solicitacao-badge">Solicitado</span>
                    ) : (
                      <span className="parcela-solicitacao-vazio">&mdash;</span>
                    )}
                  </td>
                  {/* Acoes */}
                  <td>
                    <div className="parcelas-actions-cell">
                      {isFinanceiro && (
                        <>
                          <button className="parcelas-action-btn" title="Editar" aria-label="Editar parcela" onClick={() => { setEditingParcela(p); setFormOpen(true); }}>
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" /></svg>
                          </button>
                          <button className="parcelas-action-btn parcelas-action-danger" title="Remover" aria-label="Remover parcela" onClick={() => handleDeleteParcela(p.id)}>
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg>
                          </button>
                        </>
                      )}
                      {(isLider || isFinanceiro) && p.smartsheet_row_id && (
                        <span className="tooltip-wrapper" data-tooltip="Remover vinculo com tarefa do cronograma">
                          <button className="parcelas-action-btn" aria-label="Desvincular do cronograma" onClick={() => handleDesvincular(p.id)}>
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17 7h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5zM8 13h8v-2H8v2zM7 7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1S5.29 8.9 7 8.9h4V7H7z" /></svg>
                          </button>
                        </span>
                      )}
                      {(isLider || isFinanceiro) && p.smartsheet_row_id && p.valor && (
                        <span className="tooltip-wrapper" data-tooltip="Gerar e-mail de cobranca e marcar como solicitado">
                          <button
                            className="parcelas-action-btn parcelas-action-email"
                            aria-label="Gerar email de cobranca"
                            onClick={(e) => { e.stopPropagation(); handleGerarEmail(p); }}
                          >
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
                          </button>
                        </span>
                      )}
                      {p.alerta_cronograma && (
                        <span className="tooltip-wrapper" data-tooltip="Limpar alerta de cronograma">
                          <button className="parcelas-action-btn parcelas-action-limpar-alerta" aria-label="Limpar alerta" onClick={() => handleLimparAlerta(p.id)}>
                            ✓
                          </button>
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showLog && <ParcelaChangeLog projectCode={projectCode} />}

      <ParcelaFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingParcela(null); }}
        onSave={editingParcela ? handleUpdateParcela : handleCreateParcela}
        parcela={editingParcela}
        projectCode={projectCode}
        companyId={companyId}
      />

      <ParcelaFormDialog
        open={aditivoFormOpen}
        onClose={() => setAditivoFormOpen(false)}
        onSave={handleCreateAditivo}
        parcela={null}
        projectCode={projectCode}
        companyId={companyId}
        isAditivo={true}
      />

      <VincularParcelaDialog
        open={vincularOpen}
        onClose={() => { setVincularOpen(false); setVincularParcela(null); }}
        onVincular={handleVincular}
        parcela={vincularParcela}
        smartsheetId={smartsheetId}
        projectName={projectName}
      />
    </div>
  );
}
