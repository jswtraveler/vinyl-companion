import React, { useState, useEffect } from 'react';
import { geminiClient } from '../services/geminiClient';

const AIAnalysisModal = ({ albums, availableMoods, onClose, onApplyResults }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [error, setError] = useState(null);
  const [selectedResults, setSelectedResults] = useState({});

  // Prevent body scrolling when modal is open
  useEffect(() => {
    const originalBodyStyle = document.body.style.overflow;
    const originalDocumentStyle = document.documentElement.style.overflow;
    
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    
    return () => {
      document.body.style.overflow = originalBodyStyle;
      document.documentElement.style.overflow = originalDocumentStyle;
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, []);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setError(null);
    
    try {
      const results = await geminiClient.analyzeCollectionWithFallback(albums, availableMoods);
      
      if (results.success) {
        setAnalysisResults(results);
        // Initialize all results as selected
        const initialSelections = {};
        results.analysis.forEach(item => {
          initialSelections[item.albumId] = item.suggestedMoods;
        });
        setSelectedResults(initialSelections);
      } else {
        setError(results.error?.message || 'Analysis failed');
      }
    } catch (err) {
      console.error('Analysis error:', err);
      setError('Failed to analyze collection. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleMoodToggle = (albumId, mood) => {
    setSelectedResults(prev => {
      const current = prev[albumId] || [];
      const newMoods = current.includes(mood)
        ? current.filter(m => m !== mood)
        : [...current, mood];
      
      return {
        ...prev,
        [albumId]: newMoods
      };
    });
  };

  const handleApplyResults = () => {
    const finalResults = analysisResults.analysis.map(item => ({
      ...item,
      suggestedMoods: selectedResults[item.albumId] || []
    }));
    
    onApplyResults(finalResults);
    onClose();
  };

  const handleSelectAll = () => {
    const allSelected = {};
    analysisResults.analysis.forEach(item => {
      allSelected[item.albumId] = [...item.suggestedMoods];
    });
    setSelectedResults(allSelected);
  };

  const handleClearAll = () => {
    const cleared = {};
    analysisResults.analysis.forEach(item => {
      cleared[item.albumId] = [];
    });
    setSelectedResults(cleared);
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex"
      style={{touchAction: 'none'}}
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full m-4 flex flex-col max-h-[calc(100vh-2rem)]"
        onClick={(e) => e.stopPropagation()}
        style={{touchAction: 'auto'}}
      >
        {/* Header */}
        <div className="flex-shrink-0 p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                ✨ AI Mood Analysis
              </h2>
              <p className="text-gray-600 mt-1">
                Let AI analyze your collection and suggest mood tags
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {!analysisResults && !isAnalyzing && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h3 className="text-blue-800 font-medium">How it works</h3>
                  <p className="text-blue-700 text-sm mt-1">
                    AI will analyze up to {Math.min(albums.length, 50)} albums from your collection and suggest 2-3 mood tags for each based on genre, artist, and musical characteristics.
                  </p>
                  <p className="text-blue-600 text-xs mt-2">
                    {geminiClient.isConfigured() ? '🟢 Using Google Gemini AI' : '🟡 Using mock data (no API key configured)'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div 
          className="flex-1 overflow-y-auto p-6 min-h-0" 
          style={{
            WebkitOverflowScrolling: 'touch', 
            touchAction: 'pan-y',
            overscrollBehavior: 'contain'
          }}
        >
          {/* Start Analysis */}
          {!analysisResults && !isAnalyzing && (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Ready to Analyze</h3>
              <p className="text-gray-600 mb-6">
                Analyze {albums.length} albums in your collection
              </p>
              <button
                onClick={handleAnalyze}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium text-lg"
              >
                ✨ Analyze Collection
              </button>
            </div>
          )}

          {/* Analyzing */}
          {isAnalyzing && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Analyzing Your Collection</h3>
              <p className="text-gray-600">
                AI is analyzing your albums and suggesting mood tags...
              </p>
              <div className="mt-4 text-sm text-gray-500">
                This may take 30-60 seconds
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Analysis Failed</h3>
              <p className="text-gray-600 mb-6">{error}</p>
              <button
                onClick={handleAnalyze}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Results */}
          {analysisResults && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Analysis Results</h3>
                  <p className="text-gray-600 text-sm">
                    Review and edit the suggested mood tags for each album
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSelectAll}
                    className="px-3 py-1.5 text-sm bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                  >
                    Select All
                  </button>
                  <button
                    onClick={handleClearAll}
                    className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {analysisResults.analysis.map((item) => (
                  <div key={item.albumId} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{item.title}</h4>
                        <p className="text-gray-600 text-sm">{item.artist}</p>
                        {item.reasoning && (
                          <p className="text-xs text-gray-500 mt-1 italic">"{item.reasoning}"</p>
                        )}
                      </div>
                      
                      <div className="flex-shrink-0">
                        <div className="flex flex-wrap gap-1 max-w-sm">
                          {item.suggestedMoods.map((mood) => (
                            <button
                              key={mood}
                              onClick={() => handleMoodToggle(item.albumId, mood)}
                              className={`px-2 py-1 text-xs rounded-full transition-colors ${
                                (selectedResults[item.albumId] || []).includes(mood)
                                  ? 'bg-purple-600 text-white'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                            >
                              {mood}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {analysisResults.usage && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500">
                    Analysis completed • {analysisResults.totalAlbums} albums • 
                    {analysisResults.usage.inputTokens || 'N/A'} input tokens • 
                    {analysisResults.usage.outputTokens || 'N/A'} output tokens
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {analysisResults && (
          <div className="flex-shrink-0 p-6 border-t border-gray-200 bg-gray-50">
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-600">
                {Object.values(selectedResults).reduce((acc, moods) => acc + moods.length, 0)} mood tags selected
              </div>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyResults}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
                >
                  Apply Results
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIAnalysisModal;