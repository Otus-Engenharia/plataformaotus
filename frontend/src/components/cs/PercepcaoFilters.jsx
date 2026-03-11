import React from 'react';

const MESES = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
];

function PercepcaoFilters({ filters, onChange, projetos = [] }) {
  const currentYear = new Date().getFullYear();
  const anos = Array.from({ length: currentYear - 2023 + 1 }, (_, i) => currentYear - i);

  const handleChange = (field, value) => {
    onChange({ ...filters, [field]: value || '' });
  };

  return (
    <div className="percepcao-filters">
      <select
        value={filters.ano || ''}
        onChange={e => handleChange('ano', e.target.value)}
        className="percepcao-filter-select"
      >
        <option value="">Todos os anos</option>
        {anos.map(a => (
          <option key={a} value={a}>{a}</option>
        ))}
      </select>

      <select
        value={filters.mes || ''}
        onChange={e => handleChange('mes', e.target.value)}
        className="percepcao-filter-select"
      >
        <option value="">Todos os meses</option>
        {MESES.map(m => (
          <option key={m.value} value={m.value}>{m.label}</option>
        ))}
      </select>

      {projetos.length > 0 && (
        <select
          value={filters.projeto || ''}
          onChange={e => handleChange('projeto', e.target.value)}
          className="percepcao-filter-select"
        >
          <option value="">Todos os projetos</option>
          {projetos.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      )}
    </div>
  );
}

export default PercepcaoFilters;
