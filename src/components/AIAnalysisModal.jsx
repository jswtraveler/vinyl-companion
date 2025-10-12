import React, { useState, useEffect } from 'react';
import { geminiClient } from '../services/api/ai/GeminiClient';

const AIAnalysisModal = ({ albums, availableMoods, onClose, onApplyResults }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [error, setError] = useState(null);
  const [selectedResults, setSelectedResults] = useState({});
  
  // Analysis options
  const [analysisOptions, setAnalysisOptions] = useState({
    onlyUntagged: true,
    includePartial: false,
    minTagCount: 1
  });
  
  // Preview statistics
  const [previewStats, setPreviewStats] = useState(null);

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

  // Calculate preview statistics whenever options change
  useEffect(() => {
    const { toAnalyze, alreadyTagged } = geminiClient.filterAlbumsForAnalysis(albums, analysisOptions);
    setPreviewStats({
      toAnalyze: toAnalyze.length,
      alreadyTagged: alreadyTagged.length,
      total: albums.length
    });
  }, [albums, analysisOptions]);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setError(null);
    
    try {
      // Pass analysis options to the client
      const results = await geminiClient.analyzeCollection(albums, availableMoods, analysisOptions);
      
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
          {/* Analysis Options & Start Analysis */}
          {!analysisResults && !isAnalyzing && (
            <div>
              {/* Analysis Options */}
              <div className="bg-gray-50 rounded-lg p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Analysis Options</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="onlyUntagged"
                      checked={analysisOptions.onlyUntagged}
                      onChange={(e) => setAnalysisOptions(prev => ({
                        ...prev,
                        onlyUntagged: e.target.checked
                      }))}
                      className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
                    />
                    <label htmlFor="onlyUntagged" className="ml-2 text-sm font-medium text-gray-900">
                      Only analyze albums without mood tags (recommended)
                    </label>
                  </div>
                  
                  {analysisOptions.onlyUntagged && (
                    <div className="ml-6 flex items-center">
                      <input
                        type="checkbox"
                        id="includePartial"
                        checked={analysisOptions.includePartial}
                        onChange={(e) => setAnalysisOptions(prev => ({
                          ...prev,
                          includePartial: e.target.checked
                        }))}
                        className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
                      />
                      <label htmlFor="includePartial" className="ml-2 text-sm text-gray-700">
                        Also analyze albums with fewer than 2 mood tags
                      </label>
                    </div>
                  )}
                </div>
                
                {/* Preview Stats */}
                {previewStats && (
                  <div className="mt-4 p-3 bg-white rounded border">
                    <div className="text-sm font-medium text-gray-900 mb-2">Analysis Preview</div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="text-center">
                        <div className="text-lg font-semibold text-purple-600">{previewStats.toAnalyze}</div>
                        <div className="text-gray-600">To Analyze</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-gray-600">{previewStats.alreadyTagged}</div>
                        <div className="text-gray-600">Already Tagged</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-gray-900">{previewStats.total}</div>
                        <div className="text-gray-600">Total Albums</div>
                      </div>
                    </div>
                    
                    {previewStats.toAnalyze === 0 && (
                      <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                        ⚠️ No albums need analysis with current settings
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Start Analysis Button */}
              <div className="text-center py-8">
                <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Ready to Analyze</h3>
                <p className="text-gray-600 mb-6">
                  {previewStats && previewStats.toAnalyze > 0 
                    ? `Analyze ${previewStats.toAnalyze} albums in your collection`
                    : `Configure analysis options above`
                  }
                </p>
                <button
                  onClick={handleAnalyze}
                  disabled={previewStats && previewStats.toAnalyze === 0}
                  className={`px-6 py-3 rounded-lg font-medium text-lg transition-colors ${
                    previewStats && previewStats.toAnalyze === 0
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-purple-600 text-white hover:bg-purple-700'
                  }`}
                >
                  ✨ Analyze Collection
                </button>
              </div>
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
              {/* Analysis Summary */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <div className="flex items-center mb-2">
                  <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center mr-2">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Analysis Complete</h3>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="text-center">
                    <div className="text-lg font-semibold text-green-600">{analysisResults.totalAnalyzed || 0}</div>
                    <div className="text-gray-600">Analyzed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-600">{analysisResults.totalSkipped || 0}</div>
                    <div className="text-gray-600">Skipped</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-900">{analysisResults.totalAlbums || 0}</div>
                    <div className="text-gray-600">Total</div>
                  </div>
                </div>
                {analysisResults.totalSkipped > 0 && (
                  <div className="mt-3 text-sm text-gray-700">
                    💡 {analysisResults.totalSkipped} albums were skipped because they already have mood tags
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Suggested Mood Tags</h3>
                  <p className="text-gray-600 text-sm">
                    Review and edit the AI suggestions for each analyzed album
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

              {/* Skipped Albums Section */}
              {analysisResults.skippedAlbums && analysisResults.skippedAlbums.length > 0 && (
                <div className="mt-8">
                  <h4 className="text-md font-semibold text-gray-900 mb-4">
                    Skipped Albums ({analysisResults.skippedAlbums.length})
                  </h4>
                  <div className="space-y-3">
                    {analysisResults.skippedAlbums.slice(0, 10).map((item) => (
                      <div key={item.albumId} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                        <div className="flex items-start gap-3">
                          <div className="flex-1">
                            <h5 className="font-medium text-gray-800 text-sm">{item.title}</h5>
                            <p className="text-gray-600 text-xs">{item.artist}</p>
                          </div>
                          
                          <div className="flex-shrink-0">
                            <div className="flex flex-wrap gap-1">
                              {item.existingMoods && item.existingMoods.length > 0 ? (
                                item.existingMoods.map((mood) => (
                                  <span
                                    key={mood}
                                    className="px-2 py-0.5 text-xs rounded-full bg-gray-300 text-gray-700"
                                  >
                                    {mood}
                                  </span>
                                ))
                              ) : (
                                <span className="px-2 py-0.5 text-xs rounded-full bg-gray-200 text-gray-500">
                                  No tags yet
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {analysisResults.skippedAlbums.length > 10 && (
                      <div className="text-center py-2">
                        <span className="text-sm text-gray-500">
                          ... and {analysisResults.skippedAlbums.length - 10} more skipped albums
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {analysisResults.usage && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500">
                    Analysis completed • {analysisResults.totalAnalyzed} analyzed • {analysisResults.totalSkipped} skipped • 
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