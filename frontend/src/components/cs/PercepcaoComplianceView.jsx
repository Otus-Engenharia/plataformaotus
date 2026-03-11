import React from 'react';

function TeamGroupList({ grouped, tagClass }) {
  const teams = Object.keys(grouped).sort((a, b) => {
    if (a === 'Sem time') return 1;
    if (b === 'Sem time') return -1;
    return a.localeCompare(b, 'pt-BR');
  });

  return teams.map(team => (
    <div key={team} className="percepcao-compliance-team-group">
      <div className="percepcao-compliance-team-label">{team} ({grouped[team].length})</div>
      <div className="percepcao-compliance-grid">
        {grouped[team].map(p => (
          <span key={p} className={`percepcao-compliance-tag ${tagClass}`}>{p}</span>
        ))}
      </div>
    </div>
  ));
}

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
        {total_pendentes > 0 && (
          <div className="percepcao-section">
            <h3 className="percepcao-section-title" style={{ color: '#dc2626' }}>
              Pendentes ({total_pendentes})
            </h3>
            <TeamGroupList grouped={pendentes} tagClass="percepcao-compliance-tag-pending" />
          </div>
        )}

        {total_preenchidos > 0 && (
          <div className="percepcao-section">
            <h3 className="percepcao-section-title" style={{ color: '#15803d' }}>
              Preenchidos ({total_preenchidos})
            </h3>
            <TeamGroupList grouped={preenchidos} tagClass="percepcao-compliance-tag-done" />
          </div>
        )}
      </div>
    </div>
  );
}

export default PercepcaoComplianceView;
