/**
 * Página IFC Change Log - Apoio de Projetos
 *
 * Wrapper para o painel de IFC Changelog com container e estilos da área Apoio.
 */

import React from 'react';
import IfcChangeLogPanel from '../../components/apoio/IfcChangeLogPanel';
import '../../styles/ApoioProjetosView.css';

export default function IfcChangeLogView() {
  return (
    <div className="apoio-container">
      <IfcChangeLogPanel />
    </div>
  );
}
