import React, { useState } from 'react';

const IdentificationResults = ({ 
  results, 
  onSelectResult, 
  onRetry, 
  onCancel,
  originalImage 
}) => {
  const [selectedCandidate, setSelectedCandidate] = useState(0);

  if (!results) return null;

  // Handle error state
  if (!results.success) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-md mx-4 text-center">
          <div className="text-6xl mb-4">❌</div>
          <h3 className="text-xl font-semibold text-gray-800 mb-4">
            Identification Failed
          </h3>
          <p className="text-gray-600 mb-6">
            {results.error?.message || 'Could not identify this album cover. Please try again or add the album manually.'}
          </p>
          
          <div className="flex gap-3 justify-center">
            <button
              onClick={onRetry}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Try Again
            </button>
            <button
              onClick={onCancel}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium"
            >
              Add Manually
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Handle no results found
  if (!results.candidates || results.candidates.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-md mx-4 text-center">
          <div className="text-6xl mb-4">🤷‍♂️</div>
          <h3 className="text-xl font-semibold text-gray-800 mb-4">
            No Matches Found
          </h3>
          <p className="text-gray-600 mb-6">
            We couldn't identify this album cover. You can try again with a different photo or add the album manually.
          </p>
          
          <div className="flex gap-3 justify-center">
            <button
              onClick={onRetry}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Try Different Photo
            </button>
            <button
              onClick={onCancel}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium"
            >
              Add Manually
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentCandidate = results.candidates[selectedCandidate];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-800">
                Album Identified! 🎉
              </h3>
              <p className="text-gray-600 mt-1">
                Found {results.candidates.length} possible match{results.candidates.length !== 1 ? 'es' : ''}
              </p>
            </div>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Current Selection Display */}
          <div className="mb-6">
            <div className="flex gap-4">
              {/* Original Image */}
              <div className="flex-shrink-0">
                <div className="text-sm font-medium text-gray-700 mb-2">Your Photo</div>
                <img
                  src={originalImage}
                  alt="Your album cover"
                  className="w-32 h-32 object-cover rounded-lg border-2 border-gray-200"
                />
              </div>

              {/* Arrow */}
              <div className="flex items-center justify-center flex-shrink-0 px-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </div>

              {/* Identified Album */}
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-700 mb-2">
                  Identified Album
                  <span className="ml-2 inline-block px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                    {Math.round((currentCandidate.confidence || currentCandidate.qualityScore) * 100)}% match
                  </span>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  {currentCandidate.coverImage && (
                    <img
                      src={currentCandidate.coverImage}
                      alt={currentCandidate.title}
                      className="w-24 h-24 object-cover rounded-lg float-left mr-4 mb-2"
                    />
                  )}
                  
                  <div>
                    <h4 className="font-semibold text-lg text-gray-800">
                      {currentCandidate.title || 'Unknown Album'}
                    </h4>
                    <p className="text-gray-600 mb-2">
                      by {currentCandidate.artist || 'Unknown Artist'}
                    </p>
                    
                    <div className="space-y-1 text-sm text-gray-600">
                      {currentCandidate.year && (
                        <div>Year: {currentCandidate.year}</div>
                      )}
                      {currentCandidate.label && (
                        <div>Label: {currentCandidate.label}</div>
                      )}
                      {currentCandidate.format && (
                        <div>Format: {currentCandidate.format}</div>
                      )}
                      <div className="text-xs text-gray-500 mt-2">
                        Source: {currentCandidate.source}
                      </div>
                    </div>
                  </div>
                  <div className="clear-both"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Multiple Candidates Selection */}
          {results.candidates.length > 1 && (
            <div className="mb-6">
              <div className="text-sm font-medium text-gray-700 mb-3">
                Other possible matches:
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto overflow-x-hidden" style={{WebkitOverflowScrolling: 'touch'}}>
                {results.candidates.map((candidate, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedCandidate(index)}
                    className={`w-full p-3 rounded-lg border-2 text-left transition-colors ${
                      index === selectedCandidate
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {candidate.coverImage && (
                        <img
                          src={candidate.coverImage}
                          alt={candidate.title}
                          className="w-12 h-12 object-cover rounded"
                        />
                      )}
                      <div className="flex-1">
                        <div className="font-medium text-sm">
                          {candidate.title || 'Unknown Album'}
                        </div>
                        <div className="text-gray-600 text-sm">
                          {candidate.artist || 'Unknown Artist'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {Math.round((candidate.confidence || candidate.qualityScore) * 100)}% match • {candidate.source}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end pt-4 border-t">
            <button
              onClick={onRetry}
              className="px-6 py-2 text-gray-600 hover:text-gray-800 font-medium"
            >
              Try Different Photo
            </button>
            <button
              onClick={() => onSelectResult(currentCandidate, results)}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
            >
              Use This Album
            </button>
          </div>

          {/* Metadata Footer */}
          <div className="mt-4 pt-4 border-t text-xs text-gray-500">
            <div className="flex justify-between">
              <span>Identified via {results.method}</span>
              <span>{new Date(results.timestamp).toLocaleTimeString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IdentificationResults;