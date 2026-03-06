/**
 * Vista do Cliente - Relatos
 *
 * Página dedicada ao kanban de relatos do projeto na perspectiva do cliente.
 * Usa o contexto compartilhado para seleção de projeto.
 */

import React from 'react';
import { useVistaCliente } from '../../contexts/VistaClienteContext';
import RelatosSection from './RelatosSection';
import '../../styles/VistaClienteView.css';

function VistaClienteRelatosView() {
  const {
    selectedProjectId, setSelectedProjectId,
    showOnlyActive, setShowOnlyActive,
    selectedProject, projectCode,
    sortedProjects,
  } = useVistaCliente();

  return (
    <div className="vista-cliente-container">
      {/* Header */}
      <div className="vc-header">
        <div className="vc-header-title-row">
          {selectedProject ? (
            <h1 className="vc-project-title">
              {selectedProject.project_name || selectedProject.project_code_norm} — Relatos
            </h1>
          ) : (
            <h1 className="vc-project-title">Relatos</h1>
          )}
        </div>
        <div className="vc-header-controls">
          <select
            value={selectedProjectId || ''}
            onChange={e => setSelectedProjectId(e.target.value)}
            className="vc-project-select"
          >
            <option value="">Selecione um projeto</option>
            {sortedProjects.map(p => (
              <option key={p.project_code_norm} value={p.project_code_norm}>
                {p.project_name || p.project_code_norm}
              </option>
            ))}
          </select>
          <label className="vc-active-toggle">
            <input
              type="checkbox"
              checked={showOnlyActive}
              onChange={e => setShowOnlyActive(e.target.checked)}
            />
            Somente Ativos
          </label>
        </div>
      </div>

      {!selectedProjectId ? (
        <div className="vc-empty-state">
          <div className="vc-empty-state-icon">&#128203;</div>
          <div className="vc-empty-state-text">Selecione um projeto para visualizar os relatos.</div>
        </div>
      ) : (
        <RelatosSection projectCode={projectCode} />
      )}
    </div>
  );
}

export default VistaClienteRelatosView;
