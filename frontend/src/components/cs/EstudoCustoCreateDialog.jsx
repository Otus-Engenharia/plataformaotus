import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import SearchableDropdown from '../SearchableDropdown';
import './EstudoCustoCreateDialog.css';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function EstudoCustoCreateDialog({ onClose, onSubmit }) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    projeto: '',
    nome_time: '',
    status_fase: '',
    construflow_id: '',
    link_construflow: '',
    data_prevista_apresentacao: '',
    descricao: '',
    observacoes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [portfolio, setPortfolio] = useState([]);
  const [loadingPortfolio, setLoadingPortfolio] = useState(true);
  const [meusProjetosOnly, setMeusProjetosOnly] = useState(false);

  useEffect(() => {
    async function fetchPortfolio() {
      try {
        const response = await fetch(`${API_URL}/api/portfolio`, { credentials: 'include' });
        const data = await response.json();
        if (data.success && Array.isArray(data.data)) {
          setPortfolio(data.data);
        }
      } catch (err) {
        console.error('Erro ao carregar portfolio:', err);
      } finally {
        setLoadingPortfolio(false);
      }
    }
    fetchPortfolio();
  }, []);

  // Filter portfolio by leader if "Meus Projetos" is active
  const filteredPortfolio = useMemo(() => {
    if (!meusProjetosOnly || !user?.name) return portfolio;
    return portfolio.filter(p => p.lider === user.name);
  }, [portfolio, meusProjetosOnly, user?.name]);

  // Build dropdown options from filtered portfolio
  const projectOptions = useMemo(() => {
    const seen = new Set();
    return filteredPortfolio
      .filter(p => p.project_name)
      .reduce((acc, p) => {
        const key = p.project_name;
        if (!seen.has(key)) {
          seen.add(key);
          acc.push({ value: key, label: key });
        }
        return acc;
      }, [])
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  }, [filteredPortfolio]);

  // Lookup map for project data
  const projectDataMap = useMemo(() => {
    const map = {};
    portfolio.forEach(p => {
      if (p.project_name && !map[p.project_name]) {
        map[p.project_name] = {
          nome_time: p.nome_time || '',
          status: p.status || '',
          construflow_id: p.construflow_id || '',
        };
      }
    });
    return map;
  }, [portfolio]);

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleProjectSelect = (value) => {
    const projectData = projectDataMap[value] || {};
    const construflowId = projectData.construflow_id || '';
    const linkConstruflow = construflowId
      ? `https://app.construflow.com.br/workspace/project/${construflowId}/issues`
      : '';

    setFormData(prev => ({
      ...prev,
      projeto: value,
      nome_time: projectData.nome_time || '',
      status_fase: projectData.status || '',
      construflow_id: construflowId,
      link_construflow: linkConstruflow,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = formData.projeto.trim();

  return (
    <div className="ec-dialog-overlay">
      <div className="ec-dialog">
        <div className="ec-dialog__header">
          <div className="ec-dialog__title-row">
            <svg className="ec-dialog__header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
            <h2>Nova Solicitacao de Estudo de Custos</h2>
          </div>
          <button className="ec-dialog__close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form className="ec-dialog__form" onSubmit={handleSubmit}>
          {/* Instrucoes */}
          <div className="ec-dialog__info-box">
            <svg className="ec-dialog__info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <ul className="ec-dialog__info-list">
              <li>Este formulario tem como objetivo centralizar as solicitacoes para elaboracao de Estudos de Custos;</li>
              <li>As solicitacoes devem ser realizadas com antecedencia minima de 1 mes em relacao a data prevista para apresentacao;</li>
              <li>E necessario garantir que os apontamentos selecionados no Construflow estejam resolvidos/finalizados, devidamente identificados com a tag de Estudo de Custos.</li>
            </ul>
          </div>

          {/* Toggle Meus Projetos */}
          <div className="ec-dialog__field">
            <div className="ec-dialog__toggle-row">
              <label className="ec-dialog__toggle">
                <input
                  type="checkbox"
                  checked={meusProjetosOnly}
                  onChange={(e) => {
                    setMeusProjetosOnly(e.target.checked);
                    // Reset project selection when toggling
                    setFormData(prev => ({
                      ...prev,
                      projeto: '',
                      nome_time: '',
                      status_fase: '',
                      construflow_id: '',
                      link_construflow: '',
                    }));
                  }}
                />
                <span className="ec-dialog__toggle-slider"></span>
                <span className="ec-dialog__toggle-text">
                  {meusProjetosOnly ? 'Meus Projetos' : 'Todos Projetos'}
                </span>
              </label>
            </div>
          </div>

          {/* Projeto (dropdown do portfolio) */}
          <div className="ec-dialog__field">
            <label className="ec-dialog__label">
              Projeto <span className="ec-dialog__required">*</span>
            </label>
            <SearchableDropdown
              value={formData.projeto}
              onChange={handleProjectSelect}
              options={projectOptions}
              placeholder={loadingPortfolio ? 'Carregando projetos...' : 'Selecione o projeto'}
              disabled={loadingPortfolio}
            />
          </div>

          {/* Nome do Time (auto-preenchido) */}
          <div className="ec-dialog__field">
            <label className="ec-dialog__label">Nome do Time</label>
            <input
              type="text"
              className="ec-dialog__input ec-dialog__input--readonly"
              value={formData.nome_time}
              readOnly
              placeholder="Selecione um projeto acima"
            />
          </div>

          {/* Status/Fase (auto-preenchido) */}
          <div className="ec-dialog__field">
            <label className="ec-dialog__label">Status / Fase do Projeto</label>
            <input
              type="text"
              className="ec-dialog__input ec-dialog__input--readonly"
              value={formData.status_fase}
              readOnly
              placeholder="Selecione um projeto acima"
            />
          </div>

          {/* Link ConstruFlow (auto-gerado) */}
          {formData.link_construflow && (
            <div className="ec-dialog__field">
              <label className="ec-dialog__label">Link ConstruFlow</label>
              <div className="ec-dialog__link-preview">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                <a href={formData.link_construflow} target="_blank" rel="noopener noreferrer">
                  {formData.link_construflow}
                </a>
              </div>
            </div>
          )}

          {/* Data Prevista para Apresentacao */}
          <div className="ec-dialog__field">
            <label className="ec-dialog__label">Data Prevista para Apresentacao</label>
            <input
              type="date"
              className="ec-dialog__input"
              value={formData.data_prevista_apresentacao}
              onChange={(e) => updateField('data_prevista_apresentacao', e.target.value)}
            />
          </div>

          {/* Descricao */}
          <div className="ec-dialog__field">
            <label className="ec-dialog__label">Descricao</label>
            <textarea
              className="ec-dialog__textarea"
              value={formData.descricao}
              onChange={(e) => updateField('descricao', e.target.value)}
              placeholder="Descricao adicional (opcional)..."
              rows={3}
            />
          </div>

          {/* Observacoes */}
          <div className="ec-dialog__field">
            <label className="ec-dialog__label">Observacoes</label>
            <textarea
              className="ec-dialog__textarea"
              value={formData.observacoes}
              onChange={(e) => updateField('observacoes', e.target.value)}
              placeholder="Observacoes adicionais (opcional)..."
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="ec-dialog__actions">
            <button
              type="button"
              className="ec-dialog__btn ec-dialog__btn--secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="ec-dialog__btn ec-dialog__btn--primary"
              disabled={submitting || !isValid}
            >
              {submitting ? 'Enviando...' : 'Criar Solicitacao'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
