import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import PercepcaoFilters from './PercepcaoFilters';
import PercepcaoTable from './PercepcaoTable';
import PercepcaoDashboard from './PercepcaoDashboard';
import PercepcaoComplianceView from './PercepcaoComplianceView';
import PercepcaoFormDialog from './PercepcaoFormDialog';
import PercepcaoImportDialog from './PercepcaoImportDialog';
import '../../styles/PercepcaoEquipe.css';

const ACTIVE_STATUSES = ['planejamento', 'fase 01', 'fase 02', 'fase 03', 'fase 04'];
const isActive = (status) => ACTIVE_STATUSES.includes((status || '').toLowerCase());

function PercepcaoEquipeView() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'director';

  const now = new Date();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [filters, setFilters] = useState({ ano: String(now.getFullYear()), mes: '', projeto: '' });
  const [data, setData] = useState([]);
  const [stats, setStats] = useState(null);
  const [portfolio, setPortfolio] = useState([]);
  const [projetos, setProjetos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.ano) params.set('ano', filters.ano);
      if (filters.mes) params.set('mes', filters.mes);
      if (filters.projeto) params.set('projeto', filters.projeto);
      const qs = params.toString();

      const [listRes, statsRes] = await Promise.all([
        axios.get(`${API_URL}/api/cs/percepcao-equipe?${qs}`, { withCredentials: true }),
        axios.get(`${API_URL}/api/cs/percepcao-equipe/stats?${qs}`, { withCredentials: true }),
      ]);

      const items = listRes.data?.data || [];
      setData(items);
      setStats(statsRes.data?.data || null);

      // Extrair projetos únicos para filtro
      const uniqueProjs = [...new Set(items.map(r => r.project_code))].sort();
      setProjetos(prev => {
        const merged = [...new Set([...prev, ...uniqueProjs])].sort();
        return merged;
      });
    } catch (err) {
      console.error('Erro ao buscar percepções:', err);
    } finally {
      setLoading(false);
    }
  }, [filters.ano, filters.mes, filters.projeto]);

  // Fetch portfolio once on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API_URL}/api/portfolio`, { withCredentials: true });
        setPortfolio(res.data || []);
      } catch (err) {
        console.error('Erro ao buscar portfolio:', err);
      }
    })();
  }, []);

  // Calculate compliance client-side (same pattern as PercepcaoProjetoTab)
  const compliance = useMemo(() => {
    if (!filters.mes || !filters.ano || portfolio.length === 0) return null;

    // Deduplicate active projects by project_code_norm
    const seen = new Set();
    const uniqueActive = [];
    for (const p of portfolio) {
      if (isActive(p.status) && p.project_code_norm && !seen.has(p.project_code_norm)) {
        seen.add(p.project_code_norm);
        uniqueActive.push(p);
      }
    }

    // Filter percepcoes for selected month/year
    const monthPercepcoes = data.filter(r => {
      const rMes = String(r.mes);
      const rAno = String(r.ano);
      return rMes === String(filters.mes) && rAno === String(filters.ano);
    });
    const respondedNames = new Set(monthPercepcoes.map(r => r.project_code));

    // Compare using project_name (full name matches project_code)
    const preenchidosMap = {};
    const pendentesMap = {};

    for (const p of uniqueActive) {
      const team = p.nome_time || 'Sem time';
      const label = p.project_name || p.project_code_norm;
      if (respondedNames.has(p.project_name)) {
        if (!preenchidosMap[team]) preenchidosMap[team] = [];
        preenchidosMap[team].push(label);
      } else {
        if (!pendentesMap[team]) pendentesMap[team] = [];
        pendentesMap[team].push(label);
      }
    }

    const totalPreenchidos = Object.values(preenchidosMap).reduce((s, arr) => s + arr.length, 0);
    const totalPendentes = Object.values(pendentesMap).reduce((s, arr) => s + arr.length, 0);
    const totalAtivos = totalPreenchidos + totalPendentes;
    const percentual = totalAtivos > 0 ? Math.round((totalPreenchidos / totalAtivos) * 100) : 0;

    return {
      total_ativos: totalAtivos,
      total_preenchidos: totalPreenchidos,
      total_pendentes: totalPendentes,
      percentual,
      preenchidos: preenchidosMap,
      pendentes: pendentesMap,
    };
  }, [portfolio, data, filters.mes, filters.ano]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async (payload) => {
    setSubmitting(true);
    try {
      const codes = payload.project_codes || [payload.project_code];
      for (const code of codes) {
        await axios.post(
          `${API_URL}/api/cs/percepcao-equipe`,
          { ...payload, project_code: code, project_codes: undefined },
          { withCredentials: true }
        );
      }
      setShowForm(false);
      fetchData();
    } catch (err) {
      const msg = err.response?.data?.error || 'Erro ao salvar';
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleImport = async (records) => {
    setImporting(true);
    try {
      const res = await axios.post(
        `${API_URL}/api/cs/percepcao-equipe/import`,
        { records },
        { withCredentials: true }
      );
      const result = res.data?.data;
      alert(`Importados: ${result.imported}. Erros: ${result.errors?.length || 0}`);
      setShowImport(false);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao importar');
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remover esta resposta?')) return;
    try {
      await axios.delete(`${API_URL}/api/cs/percepcao-equipe/${id}`, { withCredentials: true });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao remover');
    }
  };

  // Per-user responded set (projects already filled by current user this month)
  const userRespondedCodes = useMemo(() => {
    if (!user?.email) return new Set();
    const email = user.email.toLowerCase();
    return new Set(
      data.filter(p => p.respondente_email?.toLowerCase() === email).map(p => p.project_code)
    );
  }, [data, user?.email]);

  // Build portfolioMap and active project names for form dialog
  const portfolioMap = useMemo(() => {
    const map = new Map();
    portfolio.forEach(p => map.set(p.project_name, { client: p.client }));
    return map;
  }, [portfolio]);

  const activeProjectNames = useMemo(() => {
    const seen = new Set();
    return portfolio
      .filter(p => isActive(p.status) && p.project_code_norm)
      .filter(p => { if (seen.has(p.project_code_norm)) return false; seen.add(p.project_code_norm); return true; })
      .map(p => p.project_name)
      .sort();
  }, [portfolio]);

  const TABS = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'respostas', label: 'Respostas' },
    { key: 'compliance', label: 'Compliance' },
  ];

  return (
    <div className="percepcao-view">
      <div className="percepcao-header">
        <h2 className="percepcao-title">Percepção da Equipe</h2>
        <div className="percepcao-header-actions">
          <button className="percepcao-btn-primary" onClick={() => setShowForm(true)}>
            + Nova Percepção
          </button>
          {isAdmin && (
            <button className="percepcao-btn-secondary" onClick={() => setShowImport(true)}>
              Importar CSV
            </button>
          )}
        </div>
      </div>

      <div className="percepcao-tabs">
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`percepcao-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <PercepcaoFilters filters={filters} onChange={setFilters} projetos={projetos} />

      {loading && <p className="percepcao-loading">Carregando...</p>}

      {!loading && activeTab === 'dashboard' && (
        <PercepcaoDashboard stats={stats} />
      )}

      {!loading && activeTab === 'respostas' && (
        <PercepcaoTable data={data} onDelete={handleDelete} isAdmin={isAdmin} />
      )}

      {activeTab === 'compliance' && (
        <PercepcaoComplianceView compliance={compliance} loading={loading} />
      )}

      <PercepcaoFormDialog
        open={showForm}
        onClose={() => setShowForm(false)}
        onSubmit={handleSubmit}
        projetos={activeProjectNames.length > 0 ? activeProjectNames : projetos}
        submitting={submitting}
        percepcoes={data}
        portfolioMap={portfolioMap}
        userRespondedCodes={userRespondedCodes}
      />

      <PercepcaoImportDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        onImport={handleImport}
        importing={importing}
      />
    </div>
  );
}

export default PercepcaoEquipeView;
