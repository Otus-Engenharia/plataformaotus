import React from 'react';

const DIMENSAO_LABELS = { 1: 'Insatisfeito', 2: 'Neutro', 3: 'Satisfeito' };
const DIMENSAO_COLORS = { 1: '#dc2626', 2: '#d97706', 3: '#15803d' };

function DimensaoCell({ value }) {
  if (value === null || value === undefined) return <span className="percepcao-na">N/A</span>;
  return (
    <span
      className="percepcao-dim-badge"
      style={{ background: DIMENSAO_COLORS[value] }}
      title={DIMENSAO_LABELS[value]}
    >
      {value}
    </span>
  );
}

function IndexCell({ value }) {
  const color = value >= 2.5 ? '#15803d' : value >= 1.5 ? '#d97706' : '#dc2626';
  return (
    <span className="percepcao-index" style={{ color, fontWeight: 600 }}>
      {value?.toFixed(2) ?? '-'}
    </span>
  );
}

function PercepcaoTable({ data = [], onDelete, isAdmin = false }) {
  if (data.length === 0) {
    return <p className="percepcao-empty">Nenhuma resposta encontrada.</p>;
  }

  return (
    <div className="percepcao-table-wrap">
      <table className="percepcao-table">
        <thead>
          <tr>
            <th>Período</th>
            <th>Projeto</th>
            <th>Respondente</th>
            <th title="Cronograma">Cron</th>
            <th title="Qualidade">Qual</th>
            <th title="Comunicação">Com</th>
            <th title="Custos">Cust</th>
            <th title="Parceria">Parc</th>
            <th title="Confiança">Conf</th>
            <th>IP</th>
            <th>IVE</th>
            <th>ISP</th>
            {isAdmin && <th></th>}
          </tr>
        </thead>
        <tbody>
          {data.map(row => (
            <tr key={row.id}>
              <td>{row.periodo_label}</td>
              <td className="percepcao-td-projeto">{row.projeto_codigo}</td>
              <td title={row.respondente_email}>{row.respondente_nome || row.respondente_email}</td>
              <td><DimensaoCell value={row.cronograma} /></td>
              <td><DimensaoCell value={row.qualidade} /></td>
              <td><DimensaoCell value={row.comunicacao} /></td>
              <td><DimensaoCell value={row.custos} /></td>
              <td><DimensaoCell value={row.parceria} /></td>
              <td><DimensaoCell value={row.confianca} /></td>
              <td><IndexCell value={row.ip} /></td>
              <td><IndexCell value={row.ive} /></td>
              <td><IndexCell value={row.isp} /></td>
              {isAdmin && (
                <td>
                  <button
                    className="percepcao-btn-delete"
                    onClick={() => onDelete?.(row.id)}
                    title="Remover"
                  >
                    &times;
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default PercepcaoTable;
