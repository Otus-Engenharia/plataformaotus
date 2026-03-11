import React from 'react';

function IndexCard({ label, value, description }) {
  const color = value >= 2.5 ? '#15803d' : value >= 1.5 ? '#d97706' : '#dc2626';
  return (
    <div className="percepcao-card">
      <div className="percepcao-card-label">{label}</div>
      <div className="percepcao-card-value" style={{ color }}>{value?.toFixed(2) ?? '-'}</div>
      <div className="percepcao-card-desc">{description}</div>
    </div>
  );
}

function PercepcaoDashboard({ stats }) {
  if (!stats || !stats.global) {
    return <p className="percepcao-empty">Sem dados para exibir indicadores.</p>;
  }

  const { global, porProjeto, evolucao } = stats;

  return (
    <div className="percepcao-dashboard">
      {/* Cards de índice global */}
      <div className="percepcao-cards-row">
        <IndexCard label="ISP" value={global.avg_isp} description="Índice de Saúde da Parceria" />
        <IndexCard label="IP" value={global.avg_ip} description="Índice de Operação" />
        <IndexCard label="IVE" value={global.avg_ive} description="Índice de Valor Estratégico" />
        <div className="percepcao-card percepcao-card-neutral">
          <div className="percepcao-card-label">Respostas</div>
          <div className="percepcao-card-value" style={{ color: 'var(--text-primary, #1a1a1a)' }}>
            {global.total_respostas}
          </div>
          <div className="percepcao-card-desc">total no período</div>
        </div>
      </div>

      {/* Ranking por projeto */}
      {porProjeto.length > 0 && (
        <div className="percepcao-section">
          <h3 className="percepcao-section-title">Por Projeto</h3>
          <div className="percepcao-ranking-table-wrap">
            <table className="percepcao-table percepcao-ranking-table">
              <thead>
                <tr>
                  <th>Projeto</th>
                  <th>Respostas</th>
                  <th>ISP</th>
                  <th>IP</th>
                  <th>IVE</th>
                </tr>
              </thead>
              <tbody>
                {porProjeto
                  .sort((a, b) => b.avg_isp - a.avg_isp)
                  .map(p => (
                    <tr key={p.project_code}>
                      <td className="percepcao-td-projeto">{p.project_code}</td>
                      <td>{p.respostas}</td>
                      <td><RankValue v={p.avg_isp} /></td>
                      <td><RankValue v={p.avg_ip} /></td>
                      <td><RankValue v={p.avg_ive} /></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Evolução mensal */}
      {evolucao.length > 1 && (
        <div className="percepcao-section">
          <h3 className="percepcao-section-title">Evolução Mensal</h3>
          <div className="percepcao-ranking-table-wrap">
            <table className="percepcao-table percepcao-ranking-table">
              <thead>
                <tr>
                  <th>Período</th>
                  <th>Respostas</th>
                  <th>ISP</th>
                  <th>IP</th>
                  <th>IVE</th>
                </tr>
              </thead>
              <tbody>
                {evolucao.map(e => (
                  <tr key={e.periodo_key}>
                    <td>{e.periodo_label}</td>
                    <td>{e.respostas}</td>
                    <td><RankValue v={e.avg_isp} /></td>
                    <td><RankValue v={e.avg_ip} /></td>
                    <td><RankValue v={e.avg_ive} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function RankValue({ v }) {
  const color = v >= 2.5 ? '#15803d' : v >= 1.5 ? '#d97706' : '#dc2626';
  return <span style={{ color, fontWeight: 600 }}>{v?.toFixed(2) ?? '-'}</span>;
}

export default PercepcaoDashboard;
