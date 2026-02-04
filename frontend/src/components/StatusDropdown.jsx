import { useState, useRef, useEffect } from 'react';
import './StatusDropdown.css';

// Configuração de status com cores e grupos
const STATUS_GROUPS = [
  {
    label: '📋 Fluxo Principal',
    statuses: [
      { value: 'a iniciar', color: '#9ca3af' },
      { value: 'planejamento', color: '#a78bfa' },
      { value: 'fase 01', color: '#3b82f6' },
      { value: 'fase 02', color: '#0ea5e9' },
      { value: 'fase 03', color: '#22c55e' },
      { value: 'fase 04', color: '#16a34a' },
      { value: 'termo de encerramento', color: '#6b7280' },
    ]
  },
  {
    label: '⏸️ Pausados',
    statuses: [
      { value: 'pausado - f01', color: '#f59e0b' },
      { value: 'pausado - f02', color: '#f59e0b' },
      { value: 'pausado - f03', color: '#f59e0b' },
      { value: 'pausado - f04', color: '#f59e0b' },
    ]
  },
  {
    label: '🏗️ Obra',
    statuses: [
      { value: 'execução', color: '#64748b' },
      { value: 'obra finalizada', color: '#78716c' },
      { value: 'close', color: '#475569' },
    ]
  },
  {
    label: '❌ Cancelados',
    statuses: [
      { value: 'churn pelo cliente', color: '#ef4444' },
    ]
  }
];

// Mapa de cores para acesso rápido
const STATUS_COLORS = {};
STATUS_GROUPS.forEach(group => {
  group.statuses.forEach(s => {
    STATUS_COLORS[s.value] = s.color;
  });
});

// Função para obter cor de um status (exportada para uso externo)
export function getStatusColor(status) {
  if (!status) return '#9ca3af';
  const normalized = status.toLowerCase().trim();

  // Match exato
  if (STATUS_COLORS[normalized]) return STATUS_COLORS[normalized];

  // Match parcial para pausados
  if (normalized.includes('pausado')) return '#f59e0b';
  if (normalized.includes('fase 01') || normalized.includes('f01')) return '#3b82f6';
  if (normalized.includes('fase 02') || normalized.includes('f02')) return '#0ea5e9';
  if (normalized.includes('fase 03') || normalized.includes('f03')) return '#22c55e';
  if (normalized.includes('fase 04') || normalized.includes('f04')) return '#16a34a';
  if (normalized.includes('churn') || normalized.includes('cancel')) return '#ef4444';

  return '#9ca3af';
}

export default function StatusDropdown({
  value,
  onChange,
  inline = false,
  disabled = false,
  className = '',
  defaultOpen = false
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);
  const searchRef = useRef(null);

  // Fecha ao clicar fora
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Foca no search quando abre
  useEffect(() => {
    if (isOpen && searchRef.current) {
      searchRef.current.focus();
    }
  }, [isOpen]);

  // Calcula posição do menu quando abre (position fixed para escapar overflow:hidden)
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 4,
        left: rect.left
      });
    }
  }, [isOpen]);

  // Filtra status pela busca
  const filteredGroups = STATUS_GROUPS.map(group => ({
    ...group,
    statuses: group.statuses.filter(s =>
      s.value.toLowerCase().includes(search.toLowerCase())
    )
  })).filter(group => group.statuses.length > 0);

  // Lista plana para navegação por teclado
  const flatOptions = filteredGroups.flatMap(g => g.statuses);

  // Navegação por teclado
  function handleKeyDown(e) {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < flatOptions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev > 0 ? prev - 1 : flatOptions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && flatOptions[highlightedIndex]) {
          handleSelect(flatOptions[highlightedIndex].value);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearch('');
        break;
    }
  }

  function handleSelect(newValue) {
    onChange(newValue);
    setIsOpen(false);
    setSearch('');
    setHighlightedIndex(-1);
  }

  const currentColor = getStatusColor(value);
  const displayValue = value || 'Selecionar...';

  return (
    <div
      ref={dropdownRef}
      className={`status-dropdown ${isOpen ? 'open' : ''} ${inline ? 'inline' : ''} ${className}`}
      onKeyDown={handleKeyDown}
    >
      <button
        ref={triggerRef}
        type="button"
        className="status-dropdown-trigger"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="status-badge" style={{ backgroundColor: `${currentColor}15` }}>
          <span className="status-badge-dot" style={{ backgroundColor: currentColor }} />
          <span style={{ color: currentColor }}>{displayValue}</span>
        </span>
        <span className="status-dropdown-chevron">▼</span>
      </button>

      {isOpen && (
        <div
          className="status-dropdown-menu"
          role="listbox"
          style={{
            position: 'fixed',
            top: menuPosition.top,
            left: menuPosition.left
          }}
        >
          <div className="status-dropdown-search">
            <div className="status-dropdown-search-wrapper">
              <span className="status-dropdown-search-icon">🔍</span>
              <input
                ref={searchRef}
                type="text"
                placeholder="Buscar status..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setHighlightedIndex(0);
                }}
              />
            </div>
          </div>

          {filteredGroups.length === 0 ? (
            <div className="status-dropdown-empty">
              Nenhum status encontrado
            </div>
          ) : (
            filteredGroups.map((group, groupIndex) => (
              <div key={group.label} className="status-dropdown-group">
                <div className="status-dropdown-group-label">{group.label}</div>
                {group.statuses.map((status) => {
                  const flatIndex = flatOptions.findIndex(o => o.value === status.value);
                  const isSelected = value?.toLowerCase() === status.value.toLowerCase();
                  const isHighlighted = flatIndex === highlightedIndex;

                  return (
                    <div
                      key={status.value}
                      className={`status-dropdown-option ${isSelected ? 'selected' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                      onClick={() => handleSelect(status.value)}
                      role="option"
                      aria-selected={isSelected}
                    >
                      <span
                        className="status-dropdown-option-dot"
                        style={{ backgroundColor: status.color }}
                      />
                      <span className="status-dropdown-option-label">{status.value}</span>
                      <span className="status-dropdown-option-check">✓</span>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
