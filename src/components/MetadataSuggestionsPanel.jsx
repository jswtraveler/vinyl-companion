const MetadataSuggestionsPanel = ({ isLoadingSuggestions, suggestions, onSelect, onSkip }) => (
  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-lg font-semibold text-gray-900 flex items-center">
        <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Album Suggestions
      </h3>
      {!isLoadingSuggestions && (
        <button type="button" onClick={onSkip} className="text-sm text-gray-500 hover:text-gray-700">
          Skip suggestions
        </button>
      )}
    </div>

    {isLoadingSuggestions ? (
      <div className="flex items-center justify-center py-8">
        <div className="flex items-center space-x-3">
          <svg className="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle>
            <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path>
          </svg>
          <span className="text-gray-600">Searching for album metadata...</span>
        </div>
      </div>
    ) : suggestions.length > 0 ? (
      <div className="space-y-3">
        <p className="text-sm text-gray-600 mb-3">
          We found some matches for your album. Click on one to auto-fill the form:
        </p>
        <div className="grid gap-3">
          {suggestions.map((suggestion, index) => (
            <div
              key={`${suggestion.source}-${suggestion.id}-${index}`}
              onClick={() => onSelect(suggestion)}
              className="flex items-start p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-colors"
            >
              {suggestion.coverUrl && (
                <img
                  src={suggestion.coverUrl}
                  alt={`${suggestion.title} cover`}
                  className="w-16 h-16 rounded-lg object-cover mr-4 flex-shrink-0"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              )}
              <div className="flex-grow min-w-0">
                <h4 className="font-medium text-gray-900 truncate">{suggestion.title}</h4>
                <p className="text-sm text-gray-600 truncate">by {suggestion.artist}</p>
                <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                  {suggestion.year && <span>{suggestion.year}</span>}
                  {suggestion.label && <span>{suggestion.label}</span>}
                  {suggestion.format && <span>{suggestion.format}</span>}
                  <span className="capitalize bg-gray-100 px-2 py-1 rounded">{suggestion.source}</span>
                </div>
              </div>
              <div className="flex-shrink-0 ml-2">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-3">
          You can still modify any field after selecting a suggestion.
        </p>
      </div>
    ) : (
      <div className="text-center py-6">
        <p className="text-gray-600">No matches found for this album.</p>
        <p className="text-sm text-gray-500 mt-1">Continue filling out the form manually.</p>
      </div>
    )}
  </div>
);

export default MetadataSuggestionsPanel;
