/**
 * Vista de Pesquisas de Fechamento de Fase — Área CS
 * Exibe todas as pesquisas NPS/CSAT/CES com filtros e KPIs.
 * Inclui formulário modal para registrar novas pesquisas.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from '../../api';
import './PesquisasCSView.css';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function scoreColor(score, type = 'nps') {
  if (score == null) return '';
  if (type === 'nps') {
    if (score >= 9) return 'score-green';
    if (score >= 7) return 'score-yellow';
    return 'score-red';
  }
  // CSAT / CES
  if (score >= 7) return 'score-green';
  if (score >= 4) return 'score-yellow';
  return 'score-red';
}

function scoreButtonColor(i) {
  if (i <= 6) return 'score-btn-red';
  if (i <= 8) return 'score-btn-yellow';
  return 'score-btn-green';
}

function sourceLabel(source) {
  const labels = { plataforma: 'Plataforma', google_forms: 'Google Forms', externo: 'Externo' };
  return labels[source] || source;
}

function ScoreLegend({ score }) {
  if (score === null || score === undefined) return null;
  if (score <= 6) return <span className="pesquisas-score-legend detractor">Detrator</span>;
  if (score <= 8) return <span className="pesquisas-score-legend neutral">Neutro</span>;
  return <span className="pesquisas-score-legend promoter">Promotor</span>;
}

const INITIAL_FORM = {
  project_code: '', client_company: '', project_name: '',
  interviewed_person: '', decision_level: '', contact_id: null,
  nps_score: null, csat_score: null, ces_score: null,
  feedback_text: '',
};

function PesquisasCSView() {
  const [responses, setResponses] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  // Filters
  const [filterSource, setFilterSource] = useState('');
  const [filterProject, setFilterProject] = useState('');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(false);
  const [portfolioProjects, setPortfolioProjects] = useState([]);

  // Contact selector state
  const [clientContacts, setClientContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [showContactDropdown, setShowContactDropdown] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 200 };
      if (filterSource) params.source = filterSource;
      if (filterProject) params.project_code = filterProject;

      const [respRes, statsRes] = await Promise.all([
        axios.get(`${API_URL}/api/nps`, { params, withCredentials: true }),
        axios.get(`${API_URL}/api/nps/stats`, {
          params: { source: filterSource || undefined, project_code: filterProject || undefined },
          withCredentials: true,
        }),
      ]);

      setResponses(respRes.data.data || []);
      setStats(statsRes.data.data || null);
    } catch (err) {
      console.error('Erro ao carregar pesquisas:', err);
    } finally {
      setLoading(false);
    }
  }, [filterSource, filterProject]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Load portfolio projects for the form selects
  useEffect(() => {
    axios.get(`${API_URL}/api/portfolio`, { withCredentials: true })
      .then(res => {
        if (res.data?.success) {
          setPortfolioProjects(res.data.data || []);
        }
      })
      .catch(() => {});
  }, []);

  // Derive unique projects for filter
  const projectOptions = [...new Set(responses.map(r => r.project_code).filter(Boolean))].sort();

  // Derive unique clients from portfolio
  const clientOptions = useMemo(() => {
    return [...new Set(portfolioProjects.map(p => p.client).filter(Boolean))].sort();
  }, [portfolioProjects]);

  const handleProjectSelect = async (projectCode) => {
    const proj = portfolioProjects.find(p => p.project_code_norm === projectCode);
    setFormData(prev => ({
      ...prev,
      project_code: projectCode,
      project_name: proj?.project_name || '',
      client_company: proj?.client || '',
      interviewed_person: '',
      contact_id: null,
    }));
    setContactSearch('');
    setClientContacts([]);

    // Fetch client contacts for this project
    setContactsLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/projetos/equipe-cliente`, {
        params: { projectCode },
        withCredentials: true,
      });
      const { allContacts = [], assignedIds = [] } = res.data?.data || {};
      // Sort: assigned contacts first
      const assignedSet = new Set(assignedIds);
      const sorted = [
        ...allContacts.filter(c => assignedSet.has(c.id)),
        ...allContacts.filter(c => !assignedSet.has(c.id)),
      ];
      setClientContacts(sorted.map(c => ({ ...c, assigned: assignedSet.has(c.id) })));
    } catch {
      setClientContacts([]);
    } finally {
      setContactsLoading(false);
    }
  };

  const handleContactSelect = (contact) => {
    setFormData(prev => ({
      ...prev,
      interviewed_person: contact.name,
      contact_id: contact.id,
    }));
    setContactSearch('');
    setShowContactDropdown(false);
  };

  const filteredContacts = useMemo(() => {
    if (!contactSearch) return clientContacts;
    const q = contactSearch.toLowerCase();
    return clientContacts.filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.position?.toLowerCase().includes(q)
    );
  }, [clientContacts, contactSearch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    // Validation
    if (!formData.project_code) { setFormError('Selecione um projeto.'); return; }
    if (!formData.interviewed_person.trim()) { setFormError('Informe a pessoa entrevistada.'); return; }
    if (!formData.decision_level) { setFormError('Selecione o nível do entrevistado.'); return; }
    if (formData.nps_score === null) { setFormError('Selecione a nota NPS.'); return; }
    if (formData.csat_score === null) { setFormError('Selecione a nota CSAT.'); return; }
    if (formData.ces_score === null) { setFormError('Selecione a nota CES.'); return; }

    setSubmitting(true);
    try {
      await axios.post(`${API_URL}/api/nps`, formData, { withCredentials: true });
      setFormSuccess(true);
      setTimeout(() => {
        setShowForm(false);
        setFormData(INITIAL_FORM);
        setFormSuccess(false);
        fetchData();
      }, 1200);
    } catch (err) {
      setFormError(err.response?.data?.error || 'Erro ao registrar pesquisa.');
    } finally {
      setSubmitting(false);
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setFormData(INITIAL_FORM);
    setFormError(null);
    setFormSuccess(false);
    setClientContacts([]);
    setContactSearch('');
    setShowContactDropdown(false);
  };

  return (
    <div className="pesquisas-cs-view">
      <div className="pesquisas-header">
        <div>
          <h1>Pesquisas de Fechamento de Fase</h1>
          <p className="pesquisas-subtitle">
            Respostas NPS, CSAT e CES coletadas em fechamentos de fase dos projetos.
          </p>
        </div>
        <button className="pesquisas-add-btn" onClick={() => setShowForm(true)}>
          + Registrar Pesquisa
        </button>
      </div>

      {/* Filters */}
      <div className="pesquisas-filters">
        <div className="pesquisas-filter-group">
          <label>Projeto</label>
          <select value={filterProject} onChange={e => setFilterProject(e.target.value)}>
            <option value="">Todos</option>
            {projectOptions.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="pesquisas-filter-group">
          <label>Origem</label>
          <select value={filterSource} onChange={e => setFilterSource(e.target.value)}>
            <option value="">Todas</option>
            <option value="plataforma">Plataforma</option>
            <option value="google_forms">Google Forms</option>
            <option value="externo">Externo</option>
          </select>
        </div>
      </div>

      {/* KPI Strip */}
      {stats && (
        <div className="pesquisas-kpi-strip">
          <div className="pesquisas-kpi">
            <span className="pesquisas-kpi-value">{stats.average_nps ?? '—'}</span>
            <span className="pesquisas-kpi-label">NPS Médio</span>
          </div>
          <div className="pesquisas-kpi">
            <span className="pesquisas-kpi-value">{stats.average_csat ?? '—'}</span>
            <span className="pesquisas-kpi-label">CSAT Médio</span>
          </div>
          <div className="pesquisas-kpi">
            <span className="pesquisas-kpi-value">{stats.average_ces ?? '—'}</span>
            <span className="pesquisas-kpi-label">CES Médio</span>
          </div>
          <div className="pesquisas-kpi">
            <span className="pesquisas-kpi-value">{stats.total}</span>
            <span className="pesquisas-kpi-label">Total Respostas</span>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <p className="pesquisas-loading">Carregando...</p>
      ) : responses.length === 0 ? (
        <p className="pesquisas-empty">Nenhuma pesquisa encontrada.</p>
      ) : (
        <div className="pesquisas-table-container">
          <table className="pesquisas-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Projeto</th>
                <th>Cliente</th>
                <th>Entrevistado</th>
                <th>NPS</th>
                <th>CSAT</th>
                <th>CES</th>
                <th>Nível</th>
                <th>Origem</th>
              </tr>
            </thead>
            <tbody>
              {responses.map(r => (
                <React.Fragment key={r.id}>
                  <tr
                    className={`pesquisas-row${expandedId === r.id ? ' expanded' : ''}${r.feedback_text ? ' clickable' : ''}`}
                    onClick={() => r.feedback_text && setExpandedId(expandedId === r.id ? null : r.id)}
                  >
                    <td>{formatDate(r.created_at)}</td>
                    <td className="pesquisas-project">{r.project_name || r.project_code}</td>
                    <td>{r.client_company || '—'}</td>
                    <td>{r.interviewed_person || r.respondent_name || '—'}</td>
                    <td><span className={`pesquisas-score ${scoreColor(r.nps_score, 'nps')}`}>{r.nps_score ?? '—'}</span></td>
                    <td><span className={`pesquisas-score ${scoreColor(r.csat_score, 'csat')}`}>{r.csat_score ?? '—'}</span></td>
                    <td><span className={`pesquisas-score ${scoreColor(r.ces_score, 'ces')}`}>{r.ces_score ?? '—'}</span></td>
                    <td>{r.decision_level_label || '—'}</td>
                    <td><span className="pesquisas-source">{sourceLabel(r.source)}</span></td>
                  </tr>
                  {expandedId === r.id && r.feedback_text && (
                    <tr className="pesquisas-expand-row">
                      <td colSpan={9}>
                        <div className="pesquisas-feedback-text">
                          <strong>Feedback qualitativo:</strong>
                          <p>{r.feedback_text}</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal - Registrar Pesquisa */}
      {showForm && (
        <div className="pesquisas-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeForm(); }}>
          <div className="pesquisas-modal">
            <div className="pesquisas-modal-header">
              <h2>Registrar Pesquisa de Fechamento</h2>
              <button className="pesquisas-modal-close" onClick={closeForm}>&times;</button>
            </div>

            {formSuccess ? (
              <div className="pesquisas-form-success">
                Pesquisa registrada com sucesso!
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="pesquisas-form">
                {formError && <div className="pesquisas-form-error">{formError}</div>}

                {/* Section: Projeto */}
                <fieldset className="pesquisas-form-section">
                  <legend>Projeto</legend>
                  <div className="pesquisas-form-group">
                    <label>Projeto *</label>
                    <select
                      className="pesquisas-project-select"
                      value={formData.project_code}
                      onChange={e => {
                        if (e.target.value) {
                          handleProjectSelect(e.target.value);
                        } else {
                          setFormData(prev => ({ ...prev, project_code: '', project_name: '', client_company: '', interviewed_person: '', contact_id: null }));
                          setClientContacts([]);
                          setContactSearch('');
                        }
                      }}
                    >
                      <option value="">Selecione um projeto...</option>
                      {portfolioProjects.map(p => (
                        <option key={p.project_code_norm} value={p.project_code_norm}>
                          {p.project_code_norm} — {p.project_name} ({p.client})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="pesquisas-form-group">
                    <label>Cliente (empresa) *</label>
                    <input
                      type="text"
                      value={formData.client_company}
                      onChange={e => setFormData(prev => ({ ...prev, client_company: e.target.value }))}
                      placeholder="Auto-preenchido ao selecionar projeto"
                      list="pesquisas-clients-list"
                    />
                    <datalist id="pesquisas-clients-list">
                      {clientOptions.map(c => <option key={c} value={c} />)}
                    </datalist>
                  </div>
                </fieldset>

                {/* Section: Entrevistado */}
                <fieldset className="pesquisas-form-section">
                  <legend>Entrevistado</legend>

                  {/* Pessoa entrevistada — combobox with contacts */}
                  <div className="pesquisas-form-group">
                    <label>Pessoa entrevistada *</label>
                    {formData.interviewed_person && !showContactDropdown ? (
                      <div className="pesquisas-selected-contact">
                        <span>{formData.interviewed_person}</span>
                        {formData.contact_id && <span className="pesquisas-contact-badge">Equipe</span>}
                        <button type="button" onClick={() => { setFormData(prev => ({ ...prev, interviewed_person: '', contact_id: null })); setContactSearch(''); setShowContactDropdown(true); }}>
                          &times;
                        </button>
                      </div>
                    ) : (
                      <div className="pesquisas-contact-search">
                        <input
                          type="text"
                          placeholder={contactsLoading ? 'Carregando contatos...' : clientContacts.length > 0 ? 'Buscar contato ou digitar nome...' : 'Nome da pessoa entrevistada'}
                          value={contactSearch || formData.interviewed_person}
                          onChange={e => {
                            setContactSearch(e.target.value);
                            setFormData(prev => ({ ...prev, interviewed_person: e.target.value, contact_id: null }));
                            setShowContactDropdown(true);
                          }}
                          onFocus={() => clientContacts.length > 0 && setShowContactDropdown(true)}
                          disabled={contactsLoading}
                        />
                        {contactsLoading && <span className="pesquisas-contact-loading">⏳</span>}
                        {showContactDropdown && !contactsLoading && clientContacts.length > 0 && (
                          <div className="pesquisas-contact-dropdown">
                            {filteredContacts.length > 0 ? (
                              filteredContacts.map(c => (
                                <div
                                  key={c.id}
                                  className="pesquisas-contact-option"
                                  onClick={() => handleContactSelect(c)}
                                >
                                  <div className="pesquisas-contact-info">
                                    <strong>{c.name}</strong>
                                    {c.position && <span className="pesquisas-contact-position">{c.position}</span>}
                                  </div>
                                  {c.assigned && <span className="pesquisas-contact-badge">Equipe</span>}
                                </div>
                              ))
                            ) : (
                              <div className="pesquisas-contact-empty">Nenhum contato encontrado</div>
                            )}
                            <div
                              className="pesquisas-contact-option pesquisas-contact-manual"
                              onClick={() => setShowContactDropdown(false)}
                            >
                              Digitar manualmente
                            </div>
                          </div>
                        )}
                        {showContactDropdown && !contactsLoading && clientContacts.length === 0 && formData.project_code && (
                          <div className="pesquisas-contact-hint">
                            Nenhum contato cadastrado para este projeto
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="pesquisas-form-group">
                    <label>Nível do entrevistado *</label>
                    <div className="pesquisas-radio-group">
                      <label className={`pesquisas-radio ${formData.decision_level === 'decisor' ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          name="decision_level"
                          value="decisor"
                          checked={formData.decision_level === 'decisor'}
                          onChange={e => setFormData(prev => ({ ...prev, decision_level: e.target.value }))}
                        />
                        Decisor
                      </label>
                      <label className={`pesquisas-radio ${formData.decision_level === 'nao_decisor' ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          name="decision_level"
                          value="nao_decisor"
                          checked={formData.decision_level === 'nao_decisor'}
                          onChange={e => setFormData(prev => ({ ...prev, decision_level: e.target.value }))}
                        />
                        Não decisor
                      </label>
                    </div>
                  </div>
                </fieldset>

                {/* Section: Scores */}
                <fieldset className="pesquisas-form-section">
                  <legend>Scores</legend>
                  <div className="pesquisas-score-selector">
                    <div className="pesquisas-score-header">
                      <label>NPS (0-10) *</label>
                      <ScoreLegend score={formData.nps_score} />
                    </div>
                    <div className="pesquisas-score-buttons">
                      {Array.from({ length: 11 }, (_, i) => (
                        <button
                          key={i}
                          type="button"
                          className={`pesquisas-score-btn ${formData.nps_score === i ? 'selected' : ''} ${scoreButtonColor(i)}`}
                          onClick={() => setFormData(prev => ({ ...prev, nps_score: i }))}
                        >{i}</button>
                      ))}
                    </div>
                    <div className="pesquisas-score-scale">
                      <span className="pesquisas-scale-label detractor">Detrator (0-6)</span>
                      <span className="pesquisas-scale-label neutral">Neutro (7-8)</span>
                      <span className="pesquisas-scale-label promoter">Promotor (9-10)</span>
                    </div>
                  </div>

                  <div className="pesquisas-score-selector">
                    <div className="pesquisas-score-header">
                      <label>CSAT (0-10) *</label>
                      <ScoreLegend score={formData.csat_score} />
                    </div>
                    <div className="pesquisas-score-buttons">
                      {Array.from({ length: 11 }, (_, i) => (
                        <button
                          key={i}
                          type="button"
                          className={`pesquisas-score-btn ${formData.csat_score === i ? 'selected' : ''} ${scoreButtonColor(i)}`}
                          onClick={() => setFormData(prev => ({ ...prev, csat_score: i }))}
                        >{i}</button>
                      ))}
                    </div>
                  </div>

                  <div className="pesquisas-score-selector">
                    <div className="pesquisas-score-header">
                      <label>CES (0-10) *</label>
                      <ScoreLegend score={formData.ces_score} />
                    </div>
                    <div className="pesquisas-score-buttons">
                      {Array.from({ length: 11 }, (_, i) => (
                        <button
                          key={i}
                          type="button"
                          className={`pesquisas-score-btn ${formData.ces_score === i ? 'selected' : ''} ${scoreButtonColor(i)}`}
                          onClick={() => setFormData(prev => ({ ...prev, ces_score: i }))}
                        >{i}</button>
                      ))}
                    </div>
                  </div>
                </fieldset>

                {/* Section: Feedback */}
                <fieldset className="pesquisas-form-section">
                  <legend>Feedback</legend>
                  <div className="pesquisas-form-group">
                    <label>Feedback qualitativo</label>
                    <textarea
                      value={formData.feedback_text}
                      onChange={e => setFormData(prev => ({ ...prev, feedback_text: e.target.value }))}
                      placeholder="Comentários adicionais do entrevistado (opcional)"
                      rows={4}
                    />
                  </div>
                </fieldset>

                {/* Actions */}
                <div className="pesquisas-form-actions">
                  <button type="button" className="pesquisas-btn-cancel" onClick={closeForm}>
                    Cancelar
                  </button>
                  <button type="submit" className="pesquisas-btn-submit" disabled={submitting}>
                    {submitting ? 'Enviando...' : 'Registrar Pesquisa'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default PesquisasCSView;
