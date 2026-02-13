import React, { useState, useRef, useEffect } from 'react';
import './MultiSelectDropdown.css';

/**
 * Componente de dropdown com seleção múltipla e busca.
 *
 * Props:
 * - options: Array<{ value, label }> — opções disponíveis
 * - selectedValues: Array — valores selecionados
 * - onChange: (values: Array) => void — callback ao alterar seleção
 * - placeholder: string
 * - emptyMessage: string — mensagem quando não há opções
 * - disabled: boolean
 */
function MultiSelectDropdown({
  options = [],
  selectedValues = [],
  onChange,
  placeholder = 'Selecione...',
  emptyMessage = 'Nenhuma opção disponível',
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const searchRef = useRef(null);

  // Fecha ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Foca no input de busca ao abrir
  useEffect(() => {
    if (isOpen && searchRef.current) {
      searchRef.current.focus();
    }
  }, [isOpen]);

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  const handleToggle = () => {
    if (disabled) return;
    setIsOpen(prev => !prev);
    if (isOpen) setSearch('');
  };

  const handleSelect = (value) => {
    const isSelected = selectedValues.includes(value);
    const newValues = isSelected
      ? selectedValues.filter(v => v !== value)
      : [...selectedValues, value];
    onChange(newValues);
  };

  const handleRemove = (value) => {
    onChange(selectedValues.filter(v => v !== value));
  };

  const selectedLabels = options.filter(opt => selectedValues.includes(opt.value));

  return (
    <div className="multi-select" ref={containerRef}>
      <button
        type="button"
        className={`multi-select-trigger ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={handleToggle}
      >
        {selectedValues.length === 0 ? (
          <span className="multi-select-placeholder">{placeholder}</span>
        ) : (
          <span className="multi-select-count">
            {selectedValues.length} selecionado{selectedValues.length > 1 ? 's' : ''}
          </span>
        )}
        <span className="multi-select-arrow">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="multi-select-dropdown">
          <div className="multi-select-search">
            <input
              ref={searchRef}
              type="text"
              placeholder="Pesquisar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <ul className="multi-select-options">
            {filteredOptions.length === 0 ? (
              <li className="multi-select-empty">{emptyMessage}</li>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = selectedValues.includes(opt.value);
                return (
                  <li
                    key={opt.value}
                    className={`multi-select-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelect(opt.value)}
                  >
                    {opt.label}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}

      {selectedLabels.length > 0 && (
        <div className="multi-select-chips">
          {selectedLabels.map((opt) => (
            <span key={opt.value} className="multi-select-chip">
              {opt.label}
              <button
                type="button"
                className="multi-select-chip-remove"
                onClick={() => handleRemove(opt.value)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default MultiSelectDropdown;
