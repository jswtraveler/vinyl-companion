import React from 'react';

const SearchBar = ({ value, onChange, onSearch, placeholder = 'Search albums…' }) => {
  const isControlled = value !== undefined && onChange !== undefined;

  const handleChange = (e) => { if (onChange) onChange(e); };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSearch) onSearch(value || '');
  };

  const handleClear = () => {
    if (onChange) onChange({ target: { value: '' } });
    if (onSearch) onSearch('');
  };

  return (
    <form onSubmit={handleSubmit} style={{ position: 'relative' }}>
      {/* Search icon */}
      <svg
        width="15" height="15" fill="none" stroke="var(--color-text-dim)" strokeWidth="2" viewBox="0 0 24 24"
        style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>

      <input
        type="text"
        value={isControlled ? value : undefined}
        onChange={handleChange}
        placeholder={placeholder}
        className="search-input"
      />

      {value && (
        <button
          type="button"
          onClick={handleClear}
          style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--color-text-dim)', display: 'flex', alignItems: 'center'
          }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </form>
  );
};

export default SearchBar;
