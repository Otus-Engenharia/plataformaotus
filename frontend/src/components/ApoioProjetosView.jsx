/**
 * Componente: Vista de Apoio de Projetos
 *
 * Ferramentas e recursos para apoio aos projetos
 */

import React from 'react';

function ApoioProjetosView() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      padding: '2rem',
      textAlign: 'center'
    }}>
      <div style={{
        background: 'var(--card-bg, #1a1a1a)',
        borderRadius: '12px',
        padding: '3rem',
        maxWidth: '500px'
      }}>
        <h2 style={{ marginBottom: '1rem', color: 'var(--text-primary, #fff)' }}>
          Apoio de Projetos
        </h2>
        <p style={{ color: 'var(--text-secondary, #888)' }}>
          Esta área está em desenvolvimento.
        </p>
      </div>
    </div>
  );
}

export default ApoioProjetosView;
