import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import ParcelaStatusBadge, { STATUS_PROJETOS_CONFIG, STATUS_FINANCEIRO_CONFIG } from './ParcelaStatusBadge';
import InlineStatusDropdown from './InlineStatusDropdown';
import ParcelaFormDialog from './ParcelaFormDialog';
import VincularParcelaDialog from './VincularParcelaDialog';
import ParcelaChangeLog from './ParcelaChangeLog';
import './ParcelasProjetoPanel.css';

const STATUS_PROJETOS_OPTIONS = Object.entries(STATUS_PROJETOS_CONFIG).map(([value, cfg]) => ({
  value, label: cfg.label, color: cfg.color,
}));

const STATUS_FINANCEIRO_OPTIONS = Object.entries(STATUS_FINANCEIRO_CONFIG).map(([value, cfg]) => ({
  value, label: cfg.label, color: cfg.color,
}));

function buildMailtoCobranca({ parcela, projectName }) {
  const projeto = projectName || parcela.project_code;
  const descricao = parcela.descricao || `Parcela ${parcela.parcela_numero}`;
  const dataTermino = parcela.smartsheet_data_termino
    ? new Date(parcela.smartsheet_data_termino).toLocaleDateString('pt-BR')
    : '\u2014';
  const valor = parcela.valor != null
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parcela.valor)
    : '\u2014';

  const subject = `${projeto} - Liberação de Pagamento - ${descricao}`;
  const body = `Prezados,\n\nPor meio deste e-mail, informo que atingimos o marco final vinculado às parcelas de pagamento do projeto ${projeto}, desenvolvido pela Otus Engenharia.\n\nDetalhes da Parcela:\nParcela: ${descricao};\nApresentação: Realizada em ${dataTermino};\nValor da Parcela: ${valor};\n\nConforme estabelecido em contrato, solicito a confirmação para prosseguir com a emissão da nota fiscal e boleto correspondentes.\n\nFico à disposição para quaisquer dúvidas e seguimos juntos rumo à conclusão desse projeto!\n\nVamos juntos!`;

  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default function ParcelasProjetoPanel({ projectCode, companyId, smartsheetId, projectName, mode = 'financeiro', tipoPagamento }) {
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

  const formatCurrency = (v) => {
    if (v == null) return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  };

  const formatDate = (d) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('pt-BR');
  };

  const totalValor = parcelas.reduce((sum, p) => sum + (Number(p.valor) || 0), 0);

  return (
    <div className="parcelas-panel">
      <div className="parcelas-panel-header">
        <div className="parcelas-panel-title">
          <h3>Parcelas de Pagamento</h3>
          <span className="parcelas-count">{parcelas.length} parcela{parcelas.length !== 1 ? 's' : ''}</span>
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
      ) : parcelas.length === 0 ? (
        <div className="parcelas-empty">
          <p>Nenhuma parcela cadastrada para este projeto</p>
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
                <th>Origem</th>
                <th><span className="tooltip-wrapper" data-tooltip="Status de vinculacao ao cronograma (Projetos)">St. Projetos</span></th>
                <th><span className="tooltip-wrapper" data-tooltip="Status do pipeline financeiro">St. Financeiro</span></th>
                <th><span className="tooltip-wrapper" data-tooltip="Tarefa do cronograma que libera este pagamento">Tarefa Vinculada</span></th>
                <th><span className="tooltip-wrapper" data-tooltip="Data prevista de conclusao da tarefa vinculada">Data Termino</span></th>
                <th><span className="tooltip-wrapper" data-tooltip="Data prevista ou efetiva do pagamento">Data Pagamento</span></th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {parcelas.map(p => {
                const isPago = p.status_financeiro === 'recebido';
                const isNaoVinculada = !p.smartsheet_row_id && !p.parcela_sem_cronograma && !isPago;
                const dataPagamento = p.data_pagamento_efetiva || p.data_pagamento_calculada || p.data_pagamento_manual;
                const isAtrasada = !isPago && dataPagamento && new Date(dataPagamento) < new Date();

                const canEditStatusProjetos = isLider || isFinanceiro;
                const canEditStatusFinanceiro = isFinanceiro;

                return (
                <tr key={p.id} className={`${isPago ? 'parcela-row-pago' : ''} ${isNaoVinculada ? 'parcela-row-nao-vinculada' : ''} ${p.alerta_cronograma ? 'parcela-row-alerta' : ''}`}>
                  <td>
                    {p.alerta_cronograma && (
                      <span
                        className={`parcela-alerta-icon ${p.alerta_cronograma === 'tarefa_deletada' ? 'parcela-alerta-danger' : 'parcela-alerta-warning'}`}
                        title={p.alerta_cronograma === 'tarefa_deletada' ? 'Tarefa deletada no cronograma' : 'Data alterada no cronograma'}
                      >
                        {p.alerta_cronograma === 'tarefa_deletada' ? '⚠' : '📅'}
                      </span>
                    )}
                    {p.parcela_numero}
                  </td>
                  <td className={!p.descricao ? 'parcela-sem-descricao' : ''}>
                    {p.descricao || 'Sem descricao'}
                  </td>
                  <td>{formatCurrency(p.valor)}</td>
                  <td>
                    {p.origem || '-'}
                    {p.tipo_servico && p.tipo_servico !== 'coordenacao' && (
                      <span className="parcela-tipo-servico-badge parcela-tipo-servico-modelagem">MOD</span>
                    )}
                    {p.tipo_servico === 'coordenacao' && (
                      <span className="parcela-tipo-servico-badge parcela-tipo-servico-coordenacao">COORD</span>
                    )}
                  </td>
                  <td>
                    {canEditStatusProjetos ? (
                      <InlineStatusDropdown
                        parcelaId={p.id}
                        field="projetos"
                        currentStatus={p.status_projetos}
                        statusOptions={STATUS_PROJETOS_OPTIONS}
                        onStatusChanged={handleInlineStatusChange}
                      />
                    ) : (
                      <ParcelaStatusBadge status={p.status_projetos} type="projetos" parcelaSemCronograma={p.parcela_sem_cronograma} />
                    )}
                  </td>
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
                  <td className="parcelas-task-cell">
                    {p.smartsheet_task_name ? (
                      <span className="tooltip-wrapper" data-tooltip={p.smartsheet_task_name}>
                        {p.smartsheet_task_name.length > 40
                          ? p.smartsheet_task_name.slice(0, 40) + '...'
                          : p.smartsheet_task_name}
                      </span>
                    ) : p.parcela_sem_cronograma ? (
                      <span className="tooltip-wrapper" data-tooltip="Esta parcela nao precisa de vinculo com cronograma" style={{ fontSize: '11px', color: '#9ca3af', fontStyle: 'italic' }}>Sem vinculacao necessaria</span>
                    ) : (
                      <span className="parcelas-task-vincular-inline">
                        <span className="parcelas-no-task">Nao vinculada</span>
                        {(isLider || isFinanceiro) && (
                          <button className="parcelas-action-btn parcelas-action-vincular"
                            title="Vincular ao cronograma"
                            onClick={(e) => { e.stopPropagation(); setVincularParcela(p); setVincularOpen(true); }}>
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" /></svg>
                          </button>
                        )}
                      </span>
                    )}
                  </td>
                  <td>{formatDate(p.smartsheet_data_termino)}</td>
                  <td className={isAtrasada ? 'parcela-data-atrasada' : ''}>
                    {formatDate(dataPagamento)}
                  </td>
                  <td>
                    <div className="parcelas-actions-cell">
                      {isFinanceiro && (
                        <>
                          <button className="parcelas-action-btn" title="Editar" onClick={() => { setEditingParcela(p); setFormOpen(true); }}>
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" /></svg>
                          </button>
                          <button className="parcelas-action-btn parcelas-action-danger" title="Remover" onClick={() => handleDeleteParcela(p.id)}>
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg>
                          </button>
                        </>
                      )}
                      {(isLider || isFinanceiro) && p.smartsheet_row_id && (
                        <span className="tooltip-wrapper" data-tooltip="Remover vinculo com tarefa do cronograma">
                          <button className="parcelas-action-btn" onClick={() => handleDesvincular(p.id)}>
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17 7h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5zM8 13h8v-2H8v2zM7 7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1S5.29 8.9 7 8.9h4V7H7z" /></svg>
                          </button>
                        </span>
                      )}
                      {(isLider || isFinanceiro) && p.smartsheet_row_id && p.valor && (
                        <span className="tooltip-wrapper" data-tooltip="Gerar e-mail de cobrança de NF">
                          <a
                            className="parcelas-action-btn parcelas-action-email"
                            href={buildMailtoCobranca({ parcela: p, projectName })}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
                          </a>
                        </span>
                      )}
                      {p.alerta_cronograma && (
                        <span className="tooltip-wrapper" data-tooltip="Limpar alerta de cronograma">
                          <button className="parcelas-action-btn parcelas-action-limpar-alerta" onClick={() => handleLimparAlerta(p.id)}>
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
