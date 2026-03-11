import React, { useState, useRef } from 'react';

function PercepcaoImportDialog({ open, onClose, onImport, importing = false }) {
  const [records, setRecords] = useState([]);
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState('');
  const fileRef = useRef(null);

  if (!open) return null;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setParseError('');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target.result;
        const parsed = parseCSV(text);
        setRecords(parsed);
      } catch (err) {
        setParseError(err.message);
        setRecords([]);
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleImport = () => {
    if (records.length > 0) {
      onImport(records);
    }
  };

  return (
    <div className="percepcao-dialog-overlay" onClick={onClose}>
      <div className="percepcao-dialog" onClick={e => e.stopPropagation()}>
        <div className="percepcao-dialog-header">
          <h3>Importar CSV</h3>
          <button className="percepcao-dialog-close" onClick={onClose}>&times;</button>
        </div>

        <div className="percepcao-form" style={{ padding: '1.5rem' }}>
          <p style={{ marginBottom: '1rem', color: 'var(--text-secondary, #444)', fontSize: '10px' }}>
            O CSV deve conter as colunas: project_code, mes_referencia, ano_referencia, respondente_email,
            respondente_nome, cronograma, qualidade, comunicacao, custos, parceria, confianca,
            oportunidade_revenda, comentarios
          </p>

          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />

          <button
            type="button"
            className="percepcao-btn-secondary"
            onClick={() => fileRef.current?.click()}
            style={{ marginBottom: '1rem' }}
          >
            {fileName || 'Selecionar arquivo CSV'}
          </button>

          {parseError && <div className="percepcao-form-error">{parseError}</div>}

          {records.length > 0 && (
            <p style={{ color: 'var(--text-secondary, #444)', marginBottom: '1rem', fontSize: '10px' }}>
              {records.length} registros encontrados no arquivo.
            </p>
          )}

          <div className="percepcao-form-actions">
            <button type="button" className="percepcao-btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="button"
              className="percepcao-btn-primary"
              disabled={records.length === 0 || importing}
              onClick={handleImport}
            >
              {importing ? 'Importando...' : `Importar ${records.length} registros`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) throw new Error('CSV vazio ou sem dados');

  const sep = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());

  const required = ['project_code', 'mes_referencia', 'ano_referencia', 'respondente_email', 'qualidade', 'comunicacao', 'custos', 'parceria', 'confianca'];
  const missing = required.filter(r => !headers.includes(r));
  if (missing.length > 0) {
    throw new Error(`Colunas obrigatórias faltando: ${missing.join(', ')}`);
  }

  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(sep).map(v => v.trim().replace(/^"|"$/g, ''));
    const row = {};
    headers.forEach((h, idx) => {
      const val = values[idx] ?? '';
      if (['cronograma', 'qualidade', 'comunicacao', 'custos', 'parceria', 'confianca', 'mes_referencia', 'ano_referencia'].includes(h)) {
        row[h] = val === '' ? null : Number(val);
      } else if (h === 'oportunidade_revenda') {
        row[h] = val === '' ? null : val.toLowerCase() === 'true' || val === '1';
      } else {
        row[h] = val || null;
      }
    });
    records.push(row);
  }

  return records;
}

export default PercepcaoImportDialog;
