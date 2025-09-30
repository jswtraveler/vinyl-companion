import { useState, useEffect, useRef } from 'react';

/**
 * QuickAddModal Component
 *
 * Quick "Find by Name" modal that appears from floating action button
 * on Collection page. Provides fast access to album search with option
 * to navigate to advanced add methods.
 */
const QuickAddModal = ({ isOpen, onClose, onSearch, onAdvanced }) => {
  const [searchInput, setSearchInput] = useState('');
  const inputRef = useRef(null);

  // Auto-focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  const handleSearch = () => {
    if (searchInput.trim()) {
      onSearch(searchInput.trim());
      setSearchInput('');
      onClose();
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-75 z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-md pointer-events-auto shadow-2xl transform transition-all"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Quick Add Album</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search Input */}
          <div className="mb-4">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Search by artist or album name..."
                className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <svg className="w-5 h-5 text-gray-500 absolute right-3 top-3.5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Recent Searches - Placeholder for future enhancement */}
          <div className="mb-6">
            <p className="text-xs text-gray-500 mb-2">Examples:</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSearchInput('The Beatles')}
                className="text-xs px-3 py-1 bg-gray-900 text-gray-400 rounded-full hover:bg-gray-700 hover:text-white transition-colors"
              >
                The Beatles
              </button>
              <button
                onClick={() => setSearchInput('Pink Floyd')}
                className="text-xs px-3 py-1 bg-gray-900 text-gray-400 rounded-full hover:bg-gray-700 hover:text-white transition-colors"
              >
                Pink Floyd
              </button>
              <button
                onClick={() => setSearchInput('Miles Davis')}
                className="text-xs px-3 py-1 bg-gray-900 text-gray-400 rounded-full hover:bg-gray-700 hover:text-white transition-colors"
              >
                Miles Davis
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={onAdvanced}
              className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1"
            >
              Advanced Options
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSearch}
                disabled={!searchInput.trim()}
                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors font-medium"
              >
                Search
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default QuickAddModal;
