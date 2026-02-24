/**
 * Componente: Marcos do Projeto
 *
 * Tabela de marcos (milestones) do projeto.
 * Recebe dados como props - desacoplado da fonte de dados.
 * Agora: derivado do cronograma (CaminhoCriticoMarco).
 * Futuro: tabela Supabase marcos_projeto com vínculo ao cronograma.
 */

import React from 'react';

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function getStatusInfo(status) {
  if (!status) return { label: '-', className: 'pendente' };
  const s = String(status).toLowerCase().trim();
  if (s === 'complete' || s === 'completo' || s === 'concluído' || s === 'concluido') {
    return { label: 'feito', className: 'feito' };
  }
  if (s === 'in progress' || s === 'em andamento' || s === 'em progresso') {
    return { label: 'andamento', className: 'andamento' };
  }
  if (s === 'not started' || s === 'não iniciado' || s === 'nao iniciado') {
    return { label: 'pendente', className: 'pendente' };
  }
  return { label: s, className: 'pendente' };
}

function MarcosProjetoSection({ marcos, loading }) {
  if (loading) {
    return (
      <div className="vc-marcos-section">
        <div className="vc-marcos-header">
          <h4>Marcos do Projeto</h4>
        </div>
        <div className="vc-marcos-empty">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="vc-marcos-section">
      <div className="vc-marcos-header">
        <div>
          <h4>Marcos do Projeto</h4>
          <span className="vc-marcos-subtitle">
            (destacados em amarelo = alterados no último mês)
          </span>
        </div>
      </div>

      {!marcos || marcos.length === 0 ? (
        <div className="vc-marcos-empty">Nenhum marco encontrado para este projeto.</div>
      ) : (
        <table className="vc-marcos-table">
          <thead>
            <tr>
              <th>Marco</th>
              <th>Status</th>
              <th>Prazo atual</th>
              <th>Prazo base</th>
              <th>Variação (dias)</th>
            </tr>
          </thead>
          <tbody>
            {marcos.map((marco, idx) => {
              const statusInfo = getStatusInfo(marco.status);
              const variacao = marco.variacaoDias;
              const isChanged = marco.alteradoRecente;

              return (
                <tr key={idx} className={isChanged ? 'vc-marco-changed' : ''}>
                  <td>
                    <span className="vc-marco-nome" title={marco.nome}>
                      {marco.nome}
                    </span>
                  </td>
                  <td>
                    <span className={`vc-marco-status ${statusInfo.className}`}>
                      {statusInfo.label}
                    </span>
                  </td>
                  <td>{formatDate(marco.prazoAtual)}</td>
                  <td>{formatDate(marco.prazoBase)}</td>
                  <td>
                    {variacao != null && variacao !== 0 ? (
                      <span className={`vc-marco-variacao ${variacao > 0 ? 'positiva' : 'negativa'}`}>
                        {variacao > 0 ? '+' : ''}{variacao}
                      </span>
                    ) : (
                      <span style={{ color: '#9ca3af' }}>-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default MarcosProjetoSection;
