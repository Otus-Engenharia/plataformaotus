import React, { useState, useEffect, useCallback } from 'react';
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

function PercepcaoEquipeView() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'director';

  const now = new Date();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [filters, setFilters] = useState({ ano: String(now.getFullYear()), mes: '', projeto: '' });
  const [data, setData] = useState([]);
  const [stats, setStats] = useState(null);
  const [compliance, setCompliance] = useState(null);
  const [projetos, setProjetos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [complianceLoading, setComplianceLoading] = useState(false);
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
      const uniqueProjs = [...new Set(items.map(r => r.projeto_codigo))].sort();
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

  const fetchCompliance = useCallback(async () => {
    if (!filters.mes || !filters.ano) {
      setCompliance(null);
      return;
    }
    setComplianceLoading(true);
    try {
      const res = await axios.get(
        `${API_URL}/api/cs/percepcao-equipe/compliance?mes=${filters.mes}&ano=${filters.ano}`,
        { withCredentials: true }
      );
      setCompliance(res.data?.data || null);
    } catch (err) {
      console.error('Erro ao buscar compliance:', err);
    } finally {
      setComplianceLoading(false);
    }
  }, [filters.mes, filters.ano]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (activeTab === 'compliance') fetchCompliance(); }, [activeTab, fetchCompliance]);

  const handleSubmit = async (payload) => {
    setSubmitting(true);
    try {
      await axios.post(`${API_URL}/api/cs/percepcao-equipe`, payload, { withCredentials: true });
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
        <PercepcaoComplianceView compliance={compliance} loading={complianceLoading} />
      )}

      <PercepcaoFormDialog
        open={showForm}
        onClose={() => setShowForm(false)}
        onSubmit={handleSubmit}
        projetos={projetos}
        submitting={submitting}
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
