import React, { useState, useRef, useEffect } from 'react';
import './SearchableDropdown.css';

/**
 * SearchableDropdown - Custom dropdown with search functionality
 * @param {string} value - Currently selected value
 * @param {function} onChange - Callback when value changes
 * @param {Array} options - Array of options: string[] or {value, label}[]
 * @param {string} placeholder - Placeholder text when nothing selected
 * @param {boolean} disabled - Whether dropdown is disabled
 * @param {string} className - Additional CSS classes
 * @param {number} count - Optional count to show in placeholder
 */
export default function SearchableDropdown({
  value,
  onChange,
  options = [],
  placeholder = 'Selecione...',
  disabled = false,
  className = '',
  count = null
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Normalize options to {value, label} format
  const normalizedOptions = options.map(opt =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  );

  // Filter options based on search
  const filteredOptions = normalizedOptions.filter(opt =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  // Get selected label
  const selectedOption = normalizedOptions.find(opt => opt.value === value);
  const displayLabel = selectedOption?.label || '';

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearch('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearch('');
    } else if (e.key === 'Enter' && filteredOptions.length === 1) {
      onChange(filteredOptions[0].value);
      setIsOpen(false);
      setSearch('');
    }
  };

  const handleSelect = (optValue) => {
    onChange(optValue);
    setIsOpen(false);
    setSearch('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setIsOpen(false);
    setSearch('');
  };

  const toggleOpen = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
      if (isOpen) {
        setSearch('');
      }
    }
  };

  // Build placeholder with count
  const displayPlaceholder = count !== null && count > 0
    ? `${placeholder} (${count})`
    : placeholder;

  return (
    <div
      ref={containerRef}
      className={`searchable-dropdown ${className} ${isOpen ? 'sd-open' : ''} ${value ? 'sd-has-value' : ''} ${disabled ? 'sd-disabled' : ''}`}
    >
      {/* Trigger Button */}
      <button
        type="button"
        className="sd-trigger"
        onClick={toggleOpen}
        disabled={disabled}
      >
        <span className={`sd-value ${!value ? 'sd-placeholder' : ''}`}>
          {value ? displayLabel : displayPlaceholder}
        </span>
        <div className="sd-icons">
          {value && !disabled && (
            <span className="sd-clear" onClick={handleClear} title="Limpar">
              <svg viewBox="0 0 24 24" width="14" height="14">
                <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </span>
          )}
          <span className="sd-chevron">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M7 10l5 5 5-5z"/>
            </svg>
          </span>
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="sd-menu">
          {/* Search Input */}
          <div className="sd-search-wrapper">
            <svg className="sd-search-icon" viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              className="sd-search-input"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            {search && (
              <button
                type="button"
                className="sd-search-clear"
                onClick={() => setSearch('')}
              >
                <svg viewBox="0 0 24 24" width="14" height="14">
                  <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="sd-options">
            {filteredOptions.length === 0 ? (
              <div className="sd-empty">
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path fill="currentColor" d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                </svg>
                <span>Nenhum resultado</span>
              </div>
            ) : (
              filteredOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`sd-option ${opt.value === value ? 'sd-option-selected' : ''}`}
                  onClick={() => handleSelect(opt.value)}
                >
                  <span className="sd-option-label">{opt.label}</span>
                  {opt.value === value && (
                    <svg className="sd-option-check" viewBox="0 0 24 24" width="16" height="16">
                      <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
