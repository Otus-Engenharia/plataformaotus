import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from '../../api';
import { useAuth } from '../../contexts/AuthContext';

const CLASSIFICACOES = ['A', 'B', 'C', 'D'];

const CLASSIFICACAO_COLORS = {
  A: '#15803d',
  B: '#0369a1',
  C: '#d97706',
  D: '#dc2626',
};

const STATUS_COLORS = {
  ATIVO: '#15803d',
  CHURN: '#dc2626',
};

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function ClassificacaoSelect({ companyId, clienteNome, valor, onSave }) {
  const [current, setCurrent] = useState(valor || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCurrent(valor || '');
  }, [valor]);

  async function handleChange(e) {
    const novoValor = e.target.value;
    setCurrent(novoValor);
    setSaving(true);
    try {
      await onSave(companyId, clienteNome, novoValor);
    } finally {
      setSaving(false);
    }
  }

  return (
    <select
      value={current}
      onChange={handleChange}
      disabled={saving}
      style={{
        padding: '0.25rem 0.5rem',
        border: '1px solid #d4d4d4',
        borderRadius: '6px',
        fontSize: '10px',
        fontWeight: 600,
        color: current ? CLASSIFICACAO_COLORS[current] : '#737373',
        background: '#fff',
        cursor: saving ? 'not-allowed' : 'pointer',
        minWidth: '70px',
      }}
    >
      <option value="">—</option>
      {CLASSIFICACOES.map(c => (
        <option key={c} value={c} style={{ color: CLASSIFICACAO_COLORS[c] }}>
          {c}
        </option>
      ))}
    </select>
  );
}

/* ─── Filter Chips ─── */
function FilterChips({ label, options, selected, onToggle, colorMap }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
      <span style={{ fontSize: '10px', color: '#737373', fontWeight: 500 }}>{label}:</span>
      {options.map(opt => {
        const isActive = selected.includes(opt);
        const color = colorMap?.[opt] || '#444444';
        return (
          <button
            key={opt}
            onClick={() => onToggle(opt)}
            style={{
              padding: '0.15rem 0.5rem',
              fontSize: '10px',
              fontWeight: 600,
              border: `1px solid ${isActive ? color : '#d4d4d4'}`,
              borderRadius: '12px',
              background: isActive ? `${color}12` : 'transparent',
              color: isActive ? color : '#737373',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Status Badge ─── */
function StatusBadge({ status }) {
  if (!status) return <span style={{ color: '#737373' }}>—</span>;
  const color = STATUS_COLORS[status] || '#737373';
  return (
    <span style={{
      padding: '0.1rem 0.45rem',
      borderRadius: '4px',
      fontSize: '10px',
      fontWeight: 600,
      color,
      background: `${color}10`,
      border: `1px solid ${color}25`,
    }}>
      {status}
    </span>
  );
}

/* ─── Tab: Classificação ─── */
function ClassificacaoTab({ companies, clientes, isAdmin, search, statusMap, liderMap, filterStatus, filterClassificacao, filterLider, onSaveClassificacao }) {
  const merged = useMemo(() => {
    const classMap = new Map(clientes.map(c => [c.company_id, c]));
    return companies.map(comp => ({
      company_id: comp.id,
      cliente: comp.name,
      classificacao: classMap.get(comp.id)?.classificacao || null,
      updated_by_name: classMap.get(comp.id)?.updated_by_name || null,
      updated_at: classMap.get(comp.id)?.updated_at || null,
      status_cliente: statusMap.get(comp.id) || null,
      lideres: liderMap.get(comp.id) || [],
    }));
  }, [companies, clientes, statusMap, liderMap]);

  const filtered = useMemo(() => {
    return merged.filter(c => {
      if (search && !c.cliente?.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterStatus.length > 0 && !filterStatus.includes(c.status_cliente || 'Sem')) return false;
      if (filterClassificacao.length > 0 && !filterClassificacao.includes(c.classificacao || 'Sem')) return false;
      if (filterLider && !c.lideres.includes(filterLider)) return false;
      return true;
    });
  }, [merged, search, filterStatus, filterClassificacao, filterLider]);

  const classificados = merged.filter(c => c.classificacao).length;

  return (
    <>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
          <thead>
            <tr>
              {['Cliente', 'Status', 'Classificação', 'Líder(es)', 'Atualizado por', 'Atualizado em'].map(col => (
                <th
                  key={col}
                  style={{
                    textAlign: 'left',
                    padding: '0.5rem 0.6rem',
                    fontWeight: 600,
                    color: '#737373',
                    borderBottom: '2px solid #e5e5e5',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  style={{ padding: '1.5rem 0.6rem', color: '#737373', textAlign: 'center' }}
                >
                  {search ? 'Nenhum cliente encontrado para esta busca.' : 'Nenhum cliente cadastrado.'}
                </td>
              </tr>
            )}
            {filtered.map(c => (
              <tr
                key={c.company_id}
                style={{ borderBottom: '1px solid #f0f0f0' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.02)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}
              >
                <td style={{ padding: '0.45rem 0.6rem', color: '#1a1a1a', fontWeight: 500 }}>
                  {c.cliente}
                </td>
                <td style={{ padding: '0.45rem 0.6rem' }}>
                  <StatusBadge status={c.status_cliente} />
                </td>
                <td style={{ padding: '0.45rem 0.6rem' }}>
                  {isAdmin ? (
                    <ClassificacaoSelect
                      companyId={c.company_id}
                      clienteNome={c.cliente}
                      valor={c.classificacao}
                      onSave={onSaveClassificacao}
                    />
                  ) : (
                    <span style={{
                      fontWeight: 700,
                      color: c.classificacao ? CLASSIFICACAO_COLORS[c.classificacao] : '#737373',
                    }}>
                      {c.classificacao || '—'}
                    </span>
                  )}
                </td>
                <td style={{ padding: '0.45rem 0.6rem', color: '#444444' }}>
                  {c.lideres.length > 0 ? c.lideres.join(', ') : '-'}
                </td>
                <td style={{ padding: '0.45rem 0.6rem', color: '#444444' }}>
                  {c.updated_by_name || '-'}
                </td>
                <td style={{ padding: '0.45rem 0.6rem', color: '#737373' }}>
                  {formatDate(c.updated_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length > 0 && (
        <p style={{ marginTop: '0.75rem', fontSize: '10px', color: '#737373' }}>
          {filtered.length} cliente(s) exibido(s)
          {(search || filterStatus.length > 0 || filterClassificacao.length > 0 || filterLider) && ` de ${merged.length} no total`}.
          {' '}{classificados} classificado(s).
        </p>
      )}
    </>
  );
}

/* ─── Tab: Snapshots ─── */
function SnapshotsTab({ isAdmin }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [snapshots, setSnapshots] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [filterLider, setFilterLider] = useState('');

  useEffect(() => {
    fetchSnapshots();
  }, [month, year]);

  async function fetchSnapshots() {
    setLoading(true);
    setError(null);
    try {
      const [snapResult, statsResult] = await Promise.allSettled([
        axios.get(`${API_URL}/api/cs/classificacoes/snapshots`, {
          params: { month, year },
          withCredentials: true,
        }),
        axios.get(`${API_URL}/api/cs/classificacoes/snapshots/stats`, {
          params: { month, year },
          withCredentials: true,
        }),
      ]);

      if (snapResult.status === 'fulfilled') {
        setSnapshots(snapResult.value.data?.data || []);
      } else {
        console.error('Erro ao buscar snapshots:', snapResult.reason);
        setError('Não foi possível carregar os snapshots.');
      }

      if (statsResult.status === 'fulfilled') {
        setStats(statsResult.value.data?.data || null);
      } else {
        console.error('Erro ao buscar stats:', statsResult.reason);
      }
    } catch (err) {
      console.error('Erro inesperado ao buscar snapshots:', err);
      setError('Erro inesperado ao carregar dados.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await axios.post(
        `${API_URL}/api/cs/classificacoes/snapshots/generate`,
        {},
        { withCredentials: true }
      );
      const count = res.data?.data?.count || 0;
      setSuccessMsg(`Snapshot gerado com ${count} registro(s).`);
      await fetchSnapshots();
    } catch (err) {
      console.error('Erro ao gerar snapshot:', err);
      setError('Falha ao gerar snapshot. Tente novamente.');
    } finally {
      setGenerating(false);
    }
  }

  const months = [
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

  const years = [];
  for (let y = now.getFullYear(); y >= 2024; y--) years.push(y);

  const selectStyle = {
    padding: '0.35rem 0.5rem',
    border: '1px solid #d4d4d4',
    borderRadius: '6px',
    fontSize: '10px',
    color: '#1a1a1a',
    background: '#fff',
  };

  return (
    <>
      {/* Filtros + Gerar */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        alignItems: 'center',
        marginBottom: '1rem',
        flexWrap: 'wrap',
      }}>
        <select value={month} onChange={e => setMonth(Number(e.target.value))} style={selectStyle}>
          {months.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        <select value={year} onChange={e => setYear(Number(e.target.value))} style={selectStyle}>
          {years.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        <select value={filterLider} onChange={e => setFilterLider(e.target.value)} style={selectStyle}>
          <option value="">Todos os líderes</option>
          {[...new Set(snapshots.map(s => s.lider || s.leader_name).filter(Boolean))].sort().map(l => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>

        {isAdmin && (
          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{
              padding: '0.35rem 0.75rem',
              background: generating ? '#e5e5e5' : '#ffdd00',
              color: '#1a1a1a',
              border: 'none',
              borderRadius: '6px',
              fontSize: '10px',
              fontWeight: 600,
              cursor: generating ? 'not-allowed' : 'pointer',
              opacity: generating ? 0.6 : 1,
              marginLeft: '0.25rem',
            }}
          >
            {generating ? 'Gerando...' : 'Gerar Snapshot'}
          </button>
        )}
      </div>

      {/* Feedback */}
      {error && (
        <div style={{
          padding: '0.6rem 1rem',
          marginBottom: '1rem',
          background: '#fef2f2',
          border: '1px solid #fca5a5',
          borderRadius: '6px',
          fontSize: '10px',
          color: '#dc2626',
        }}>
          {error}
        </div>
      )}
      {successMsg && (
        <div style={{
          padding: '0.6rem 1rem',
          marginBottom: '1rem',
          background: '#f0fdf4',
          border: '1px solid #86efac',
          borderRadius: '6px',
          fontSize: '10px',
          color: '#15803d',
        }}>
          {successMsg}
        </div>
      )}

      {/* Stats resumo — métricas reais de churn */}
      {stats && (
        <div style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '1rem',
          flexWrap: 'wrap',
        }}>
          {[
            { label: 'Clientes Ativos', value: stats.clientesAtivos, color: '#15803d' },
            { label: 'Churns', value: stats.churns, color: '#dc2626' },
            { label: 'Projetos Ativos', value: stats.projetosAtivos, color: '#0369a1' },
            { label: 'Retenção', value: `${stats.taxaRetencao}%`, color: '#d97706' },
          ].map(item => (
            <div key={item.label} style={{
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              border: `1px solid ${item.color}20`,
              background: `${item.color}08`,
              fontSize: '10px',
            }}>
              <span style={{ color: '#737373' }}>{item.label} </span>
              <span style={{ fontWeight: 700, color: item.color }}>{item.value ?? 0}</span>
            </div>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <p style={{ fontSize: '10px', color: '#737373' }}>Carregando snapshots...</p>
      )}

      {/* Tabela */}
      {!loading && (() => {
        const filteredSnaps = filterLider
          ? snapshots.filter(s => (s.lider || s.leader_name) === filterLider)
          : snapshots;
        return (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
            <thead>
              <tr>
                {['Cliente', 'Projeto', 'Status Projeto', 'Status Cliente', 'Classificação', 'Líder'].map(col => (
                  <th
                    key={col}
                    style={{
                      textAlign: 'left',
                      padding: '0.5rem 0.6rem',
                      fontWeight: 600,
                      color: '#737373',
                      borderBottom: '2px solid #e5e5e5',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredSnaps.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    style={{ padding: '1.5rem 0.6rem', color: '#737373', textAlign: 'center' }}
                  >
                    Nenhum snapshot encontrado para {months.find(m => m.value === month)?.label}/{year}.
                  </td>
                </tr>
              )}
              {filteredSnaps.map((s, i) => (
                <tr
                  key={i}
                  style={{ borderBottom: '1px solid #f0f0f0' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.02)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
                >
                  <td style={{ padding: '0.45rem 0.6rem', color: '#1a1a1a', fontWeight: 500 }}>
                    {s.cliente || s.client_name || '-'}
                  </td>
                  <td style={{ padding: '0.45rem 0.6rem', color: '#444444' }}>
                    {s.projeto || s.project_name || '-'}
                  </td>
                  <td style={{ padding: '0.45rem 0.6rem', color: '#444444' }}>
                    {s.status_projeto || s.project_status || '-'}
                  </td>
                  <td style={{ padding: '0.45rem 0.6rem', color: '#444444' }}>
                    {s.status_cliente || s.client_status || '-'}
                  </td>
                  <td style={{ padding: '0.45rem 0.6rem' }}>
                    <span style={{
                      fontWeight: 700,
                      color: s.classificacao ? CLASSIFICACAO_COLORS[s.classificacao] : '#737373',
                    }}>
                      {s.classificacao || '—'}
                    </span>
                  </td>
                  <td style={{ padding: '0.45rem 0.6rem', color: '#444444' }}>
                    {s.lider || s.leader_name || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        );
      })()}

      {!loading && snapshots.length > 0 && (
        <p style={{ marginTop: '0.75rem', fontSize: '10px', color: '#737373' }}>
          {filterLider
            ? `${snapshots.filter(s => (s.lider || s.leader_name) === filterLider).length} de ${snapshots.length} registro(s) (filtrado por ${filterLider}).`
            : `${snapshots.length} registro(s) no snapshot.`
          }
        </p>
      )}
    </>
  );
}

/* ─── Main View ─── */
function ClassificacaoClientesView() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'director';

  const [clientes, setClientes] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [statusMap, setStatusMap] = useState(new Map());
  const [liderMap, setLiderMap] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('classificacao');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(null);
  const [importSuccess, setImportSuccess] = useState(null);
  const [filterStatus, setFilterStatus] = useState([]);
  const [filterClassificacao, setFilterClassificacao] = useState([]);
  const [filterLider, setFilterLider] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const [classRes, compRes, statusRes] = await Promise.all([
        axios.get(`${API_URL}/api/cs/classificacoes`, { withCredentials: true }),
        axios.get(`${API_URL}/api/cs/classificacoes/companies`, { withCredentials: true }),
        axios.get(`${API_URL}/api/cs/classificacoes/status-clientes`, { withCredentials: true }),
      ]);
      setClientes(classRes.data?.data || []);
      setCompanies(compRes.data?.data || []);

      const sMap = new Map();
      const lMap = new Map();
      for (const item of (statusRes.data?.data || [])) {
        sMap.set(item.company_id, item.status_cliente);
        if (item.lideres?.length > 0) {
          lMap.set(item.company_id, item.lideres);
        }
      }
      setStatusMap(sMap);
      setLiderMap(lMap);
    } catch (err) {
      console.error('Erro ao buscar dados:', err);
      setError('Não foi possível carregar os dados. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveClassificacao(companyId, clienteNome, classificacao) {
    try {
      const res = await axios.put(
        `${API_URL}/api/cs/classificacoes/${companyId}`,
        { classificacao, clienteNome },
        { withCredentials: true }
      );
      const updated = res.data?.data;
      if (updated) {
        setClientes(prev => {
          const exists = prev.some(c => c.company_id === companyId);
          if (exists) {
            return prev.map(c => (c.company_id === companyId ? { ...c, ...updated } : c));
          }
          return [...prev, updated];
        });
      }
    } catch (err) {
      console.error('Erro ao salvar classificação:', err);
    }
  }

  function handleImportClick() {
    setImportError(null);
    setImportSuccess(null);
    fileInputRef.current?.click();
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const text = await file.text();
    const lines = text.split('\n').map(r => r.trim()).filter(Boolean);

    if (lines.length < 2) {
      setImportError('CSV vazio ou sem dados após o cabeçalho.');
      return;
    }

    const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));
    const companyIdIdx = header.indexOf('company_id');
    const clienteIdx = header.indexOf('cliente');
    const classIdx = header.indexOf('classificacao') !== -1
      ? header.indexOf('classificacao')
      : header.indexOf('classificação');

    // Mode: name-matching (sem company_id)
    if (companyIdIdx === -1 && clienteIdx !== -1 && classIdx !== -1) {
      return handleNameMatchImport(lines, clienteIdx, classIdx);
    }

    if (companyIdIdx === -1 || clienteIdx === -1 || classIdx === -1) {
      setImportError('CSV deve ter colunas "company_id", "cliente" e "classificacao" — ou "cliente" e "classificacao" para match por nome.');
      return;
    }

    const items = lines.slice(1).map(row => {
      const cols = row.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      return {
        company_id: cols[companyIdIdx] || '',
        cliente: cols[clienteIdx] || '',
        classificacao: (cols[classIdx] || '').toUpperCase(),
      };
    }).filter(item => item.company_id && item.cliente && CLASSIFICACOES.includes(item.classificacao));

    if (items.length === 0) {
      setImportError('Nenhum registro válido encontrado no CSV.');
      return;
    }

    await doImport(items);
  }

  async function handleNameMatchImport(lines, clienteIdx, classIdx) {
    // Build name → company lookup (case-insensitive)
    const nameToCompany = new Map();
    for (const comp of companies) {
      nameToCompany.set(comp.name.toLowerCase().trim(), comp);
    }

    const matched = [];
    const unmatched = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      const rawNome = cols[clienteIdx] || '';
      let rawClass = (cols[classIdx] || '').toUpperCase().trim();

      // Strip "CLIENTE " prefix: "Cliente A" → "A"
      if (rawClass.startsWith('CLIENTE ')) {
        rawClass = rawClass.replace(/^CLIENTE\s+/, '');
      }

      if (!rawNome || !CLASSIFICACOES.includes(rawClass)) continue;

      const comp = nameToCompany.get(rawNome.toLowerCase().trim());
      if (comp) {
        matched.push({
          company_id: comp.id,
          cliente: comp.name,
          classificacao: rawClass,
        });
      } else {
        unmatched.push(rawNome);
      }
    }

    // Deduplicate by company_id (keep last)
    const deduped = new Map();
    for (const item of matched) {
      deduped.set(item.company_id, item);
    }
    const items = Array.from(deduped.values());

    if (items.length === 0) {
      setImportError(`Nenhum cliente encontrado pelo nome. ${unmatched.length} não reconhecido(s): ${unmatched.slice(0, 5).join(', ')}${unmatched.length > 5 ? '...' : ''}`);
      return;
    }

    await doImport(items);

    if (unmatched.length > 0) {
      setImportSuccess(prev =>
        `${prev || ''} Atenção: ${unmatched.length} nome(s) não encontrado(s): ${unmatched.slice(0, 5).join(', ')}${unmatched.length > 5 ? '...' : ''}`
      );
    }
  }

  async function doImport(items) {
    setImporting(true);
    setImportError(null);
    setImportSuccess(null);

    try {
      await axios.post(
        `${API_URL}/api/cs/classificacoes/import`,
        { rows: items },
        { withCredentials: true }
      );
      setImportSuccess(`${items.length} registro(s) importado(s) com sucesso.`);
      await fetchData();
    } catch (err) {
      console.error('Erro ao importar CSV:', err);
      setImportError('Falha ao importar. Verifique o arquivo e tente novamente.');
    } finally {
      setImporting(false);
    }
  }

  function toggleFilter(arr, setArr, value) {
    setArr(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
  }

  const tabStyle = (tab) => ({
    padding: '0.5rem 1rem',
    fontSize: '10px',
    fontWeight: 600,
    color: activeTab === tab ? '#1a1a1a' : '#737373',
    background: 'transparent',
    border: 'none',
    borderBottom: activeTab === tab ? '2px solid #ffdd00' : '2px solid transparent',
    cursor: 'pointer',
    transition: 'all 0.15s',
  });

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1rem',
        flexWrap: 'wrap',
        gap: '0.75rem',
      }}>
        <h2 style={{
          fontSize: '22px',
          fontWeight: 700,
          color: 'var(--text-primary, #1a1a1a)',
          margin: 0,
        }}>
          Classificação de Clientes
        </h2>

        {isAdmin && activeTab === 'classificacao' && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <button
              onClick={handleImportClick}
              disabled={importing}
              style={{
                padding: '0.4rem 1rem',
                background: 'transparent',
                color: 'var(--text-primary, #1a1a1a)',
                border: '1px solid #d4d4d4',
                borderRadius: '6px',
                fontSize: '10px',
                fontWeight: 500,
                cursor: importing ? 'not-allowed' : 'pointer',
                opacity: importing ? 0.6 : 1,
              }}
            >
              {importing ? 'Importando...' : 'Importar CSV'}
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '0',
        borderBottom: '1px solid #e5e5e5',
        marginBottom: '1rem',
      }}>
        <button style={tabStyle('classificacao')} onClick={() => setActiveTab('classificacao')}>
          Classificação
        </button>
        <button style={tabStyle('snapshots')} onClick={() => setActiveTab('snapshots')}>
          Snapshots
        </button>
      </div>

      {/* Feedback de import */}
      {importError && (
        <div style={{
          padding: '0.6rem 1rem',
          marginBottom: '1rem',
          background: '#fef2f2',
          border: '1px solid #fca5a5',
          borderRadius: '6px',
          fontSize: '10px',
          color: '#dc2626',
        }}>
          {importError}
        </div>
      )}
      {importSuccess && (
        <div style={{
          padding: '0.6rem 1rem',
          marginBottom: '1rem',
          background: '#f0fdf4',
          border: '1px solid #86efac',
          borderRadius: '6px',
          fontSize: '10px',
          color: '#15803d',
        }}>
          {importSuccess}
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'classificacao' && (
        <>
          {/* Search + Filters */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                padding: '0.35rem 0.75rem',
                border: '1px solid #d4d4d4',
                borderRadius: '6px',
                fontSize: '10px',
                width: '260px',
                color: '#1a1a1a',
                background: '#fff',
              }}
            />
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <FilterChips
                label="Status"
                options={['ATIVO', 'CHURN', 'Sem']}
                selected={filterStatus}
                onToggle={v => toggleFilter(filterStatus, setFilterStatus, v)}
                colorMap={{ ATIVO: '#15803d', CHURN: '#dc2626', 'Sem': '#737373' }}
              />
              <FilterChips
                label="Classificação"
                options={['A', 'B', 'C', 'D', 'Sem']}
                selected={filterClassificacao}
                onToggle={v => toggleFilter(filterClassificacao, setFilterClassificacao, v)}
                colorMap={{ ...CLASSIFICACAO_COLORS, 'Sem': '#737373' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ fontSize: '10px', color: '#737373', fontWeight: 500 }}>Líder:</span>
                <select
                  value={filterLider}
                  onChange={e => setFilterLider(e.target.value)}
                  style={{
                    padding: '0.15rem 0.5rem',
                    fontSize: '10px',
                    border: '1px solid #d4d4d4',
                    borderRadius: '6px',
                    color: '#1a1a1a',
                    background: '#fff',
                  }}
                >
                  <option value="">Todos</option>
                  {[...new Set([...liderMap.values()].flat())].sort().map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {loading && (
            <p style={{ fontSize: '10px', color: '#737373' }}>Carregando classificações...</p>
          )}

          {!loading && error && (
            <div style={{
              padding: '0.75rem 1rem',
              background: '#fef2f2',
              border: '1px solid #fca5a5',
              borderRadius: '8px',
              fontSize: '10px',
              color: '#dc2626',
            }}>
              {error}
            </div>
          )}

          {!loading && !error && (
            <ClassificacaoTab
              companies={companies}
              clientes={clientes}
              isAdmin={isAdmin}
              search={search}
              statusMap={statusMap}
              liderMap={liderMap}
              filterStatus={filterStatus}
              filterClassificacao={filterClassificacao}
              filterLider={filterLider}
              onSaveClassificacao={handleSaveClassificacao}
            />
          )}
        </>
      )}

      {activeTab === 'snapshots' && (
        <SnapshotsTab isAdmin={isAdmin} />
      )}
    </div>
  );
}

export default ClassificacaoClientesView;
