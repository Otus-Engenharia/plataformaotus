/**
 * Componente: Marcos do Projeto - Timeline Vertical
 *
 * Exibe marcos como stepper vertical com dots coloridos por status.
 * Mais legível e visual que a tabela anterior.
 */

import React from 'react';

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function getStatusInfo(status, variacaoDias) {
  if (!status) return { label: '-', className: 'pendente' };
  const s = String(status).toLowerCase().trim();

  if (s === 'complete' || s === 'completo' || s === 'concluído' || s === 'concluido') {
    return { label: 'feito', className: 'feito' };
  }
  if (s === 'in progress' || s === 'em andamento' || s === 'em progresso') {
    // Se está em andamento mas atrasado, mostra como atrasado
    if (variacaoDias != null && variacaoDias > 0) {
      return { label: 'atrasado', className: 'atrasado' };
    }
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
        </div>
      </div>

      {!marcos || marcos.length === 0 ? (
        <div className="vc-marcos-empty">Nenhum marco encontrado para este projeto.</div>
      ) : (
        <div className="vc-marcos-timeline">
          {marcos.map((marco, idx) => {
            const statusInfo = getStatusInfo(marco.status, marco.variacaoDias);
            const variacao = marco.variacaoDias;
            const isChanged = marco.alteradoRecente;
            const isLast = idx === marcos.length - 1;

            return (
              <div
                key={idx}
                className={`vc-marco-item ${isChanged ? 'vc-marco-changed' : ''}`}
              >
                {/* Rail: dot + connector line */}
                <div className="vc-marco-rail">
                  <div className={`vc-marco-dot ${statusInfo.className}`} />
                  {!isLast && <div className="vc-marco-line" />}
                </div>

                {/* Content */}
                <div className="vc-marco-content">
                  <div className="vc-marco-name">{marco.nome}</div>
                  <div className="vc-marco-meta">
                    <span className={`vc-marco-status-badge ${statusInfo.className}`}>
                      {statusInfo.label}
                    </span>
                    <span className="vc-marco-date">
                      {formatDate(marco.prazoAtual)}
                    </span>
                    {variacao != null && variacao !== 0 && (
                      <span className={`vc-marco-var ${variacao > 0 ? 'atrasado' : 'adiantado'}`}>
                        {variacao > 0 ? '+' : ''}{variacao}d
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MarcosProjetoSection;
