import React from 'react';

function PercepcaoComplianceView({ compliance, loading }) {
  if (loading) {
    return <p className="percepcao-empty">Carregando compliance...</p>;
  }

  if (!compliance) {
    return <p className="percepcao-empty">Selecione um mês e ano para ver o relatório de compliance.</p>;
  }

  const { total_ativos, total_preenchidos, total_pendentes, percentual, preenchidos, pendentes } = compliance;

  return (
    <div className="percepcao-compliance">
      <div className="percepcao-cards-row">
        <div className="percepcao-card">
          <div className="percepcao-card-label">Ativos</div>
          <div className="percepcao-card-value" style={{ color: 'var(--text-primary, #1a1a1a)' }}>
            {total_ativos}
          </div>
          <div className="percepcao-card-desc">projetos</div>
        </div>
        <div className="percepcao-card">
          <div className="percepcao-card-label">Preenchidos</div>
          <div className="percepcao-card-value" style={{ color: '#15803d' }}>
            {total_preenchidos}
          </div>
          <div className="percepcao-card-desc">projetos</div>
        </div>
        <div className="percepcao-card">
          <div className="percepcao-card-label">Pendentes</div>
          <div className="percepcao-card-value" style={{ color: total_pendentes > 0 ? '#dc2626' : '#15803d' }}>
            {total_pendentes}
          </div>
          <div className="percepcao-card-desc">projetos</div>
        </div>
        <div className="percepcao-card">
          <div className="percepcao-card-label">Compliance</div>
          <div className="percepcao-card-value" style={{ color: percentual >= 80 ? '#15803d' : percentual >= 50 ? '#d97706' : '#dc2626' }}>
            {percentual}%
          </div>
          <div className="percepcao-card-desc">preenchimento</div>
        </div>
      </div>

      <div className="percepcao-compliance-lists">
        {pendentes.length > 0 && (
          <div className="percepcao-section">
            <h3 className="percepcao-section-title" style={{ color: '#dc2626' }}>
              Pendentes ({pendentes.length})
            </h3>
            <div className="percepcao-compliance-grid">
              {pendentes.map(p => (
                <span key={p} className="percepcao-compliance-tag percepcao-compliance-tag-pending">{p}</span>
              ))}
            </div>
          </div>
        )}

        {preenchidos.length > 0 && (
          <div className="percepcao-section">
            <h3 className="percepcao-section-title" style={{ color: '#15803d' }}>
              Preenchidos ({preenchidos.length})
            </h3>
            <div className="percepcao-compliance-grid">
              {preenchidos.map(p => (
                <span key={p} className="percepcao-compliance-tag percepcao-compliance-tag-done">{p}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PercepcaoComplianceView;
