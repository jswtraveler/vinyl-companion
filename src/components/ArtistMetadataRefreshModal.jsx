import { useState } from 'react';
import { backfillArtistMetadata, clearArtistMetadataCache, estimateBackfillTime } from '../services/artistMetadataBackfill';

/**
 * ArtistMetadataRefreshModal Component
 *
 * Modal for refreshing Last.fm metadata for artist recommendations
 */
const ArtistMetadataRefreshModal = ({ isOpen, onClose, artists, cacheService, onRefreshComplete }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, artist: null });
  const [results, setResults] = useState(null);
  const [clearCache, setClearCache] = useState(true);

  const handleStartRefresh = async () => {
    setIsRunning(true);
    setResults(null);
    setProgress({ current: 0, total: artists.length, artist: null });

    try {
      // Step 1: Clear cache if requested
      let cacheCleared = 0;
      if (clearCache && cacheService) {
        console.log('🧹 Clearing artist metadata cache...');
        cacheCleared = await clearArtistMetadataCache(cacheService);
        console.log(`✅ Cleared ${cacheCleared} cache entries`);
      }

      // Step 2: Backfill metadata for all artists
      const finalResults = await backfillArtistMetadata(
        artists,
        (current, total, artist) => {
          setProgress({ current, total, artist });
        },
        cacheService,
        true // Force mode - always re-fetch
      );

      setResults({
        ...finalResults,
        cacheCleared
      });
      console.log('✅ Artist metadata refresh complete:', finalResults);

      // Notify parent component that refresh is complete
      if (onRefreshComplete) {
        onRefreshComplete();
      }
    } catch (error) {
      console.error('❌ Artist metadata refresh error:', error);
      setResults({
        error: error.message,
        processed: progress.current
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleClose = () => {
    if (!isRunning) {
      onClose();
      // Reset state after close animation
      setTimeout(() => {
        setProgress({ current: 0, total: 0, artist: null });
        setResults(null);
      }, 300);
    }
  };

  if (!isOpen) return null;

  const estimatedTime = estimateBackfillTime(artists.length);
  const progressPercent = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-75 z-50 transition-opacity"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-2xl pointer-events-auto shadow-2xl transform transition-all"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-white">Refresh Artist Metadata</h3>
            {!isRunning && (
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Content */}
          {!isRunning && !results && (
            <div className="space-y-4">
              <p className="text-gray-300">
                This will re-fetch genre tags and metadata from Last.fm for all artist recommendations,
                replacing any empty or stale cached data with fresh information.
              </p>

              <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Artists to process:</span>
                    <span className="ml-2 text-white font-semibold">{artists.length}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Estimated time:</span>
                    <span className="ml-2 text-white font-semibold">{estimatedTime}</span>
                  </div>
                </div>
              </div>

              {/* Clear Cache Option */}
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clearCache}
                    onChange={(e) => setClearCache(e.target.checked)}
                    className="mt-1 w-4 h-4 text-purple-600 bg-gray-800 border-gray-600 rounded focus:ring-purple-500 focus:ring-2"
                  />
                  <div className="flex-1">
                    <div className="text-white font-medium">Clear cached metadata first</div>
                    <div className="text-sm text-gray-400 mt-1">
                      Recommended: Clear all cached artist metadata before re-fetching to ensure fresh data from Last.fm.
                    </div>
                  </div>
                </label>
              </div>

              <div className="bg-blue-900 bg-opacity-30 border border-blue-700 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-blue-200">
                    <p className="font-medium mb-1">What this does:</p>
                    <ul className="list-disc list-inside space-y-1 text-blue-300">
                      <li>Clears stale cached metadata from the database</li>
                      <li>Fetches fresh artist info and genre tags from Last.fm</li>
                      <li>Validates genres against MusicBrainz whitelist</li>
                      <li>Updates cache with new metadata</li>
                      <li>Automatically regenerates recommendations with genre data</li>
                      <li>Respects Last.fm's rate limit (1 request/second)</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-900 bg-opacity-30 border border-yellow-700 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div className="text-sm text-yellow-200">
                    <p className="font-medium mb-1">Important:</p>
                    <p>
                      After completion, recommendations will be regenerated with the new metadata.
                      This may take a moment, but will enable proper genre-based diversity filtering.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={handleClose}
                  className="px-6 py-2 text-gray-300 border border-gray-600 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStartRefresh}
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium"
                >
                  Start Refresh
                </button>
              </div>
            </div>
          )}

          {/* Progress */}
          {isRunning && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mb-4"></div>
                <p className="text-gray-300 text-lg mb-2">
                  Processing artist {progress.current} of {progress.total}...
                </p>
                {progress.artist && (
                  <p className="text-gray-400 text-sm">
                    {progress.artist.artist}
                  </p>
                )}
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-purple-600 to-blue-600 h-3 transition-all duration-300 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <p className="text-center text-sm text-gray-400">
                {Math.round(progressPercent)}% complete
              </p>
            </div>
          )}

          {/* Results */}
          {results && (
            <div className="space-y-4">
              {results.error ? (
                <div className="bg-red-900 bg-opacity-30 border border-red-700 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-sm text-red-200">
                      <p className="font-medium mb-1">Error during refresh:</p>
                      <p>{results.error}</p>
                      <p className="mt-2 text-red-300">Processed {results.processed} artists before error.</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-green-900 bg-opacity-30 border border-green-700 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-sm text-green-200 flex-1">
                      <p className="font-medium mb-3">Artist metadata refresh complete!</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-900 bg-opacity-50 rounded p-3">
                          <div className="text-xs text-gray-400 mb-1">Cache Cleared</div>
                          <div className="text-xl font-bold text-white">{results.cacheCleared || 0}</div>
                        </div>
                        <div className="bg-gray-900 bg-opacity-50 rounded p-3">
                          <div className="text-xs text-gray-400 mb-1">Total Processed</div>
                          <div className="text-xl font-bold text-white">{results.processed}</div>
                        </div>
                        <div className="bg-gray-900 bg-opacity-50 rounded p-3">
                          <div className="text-xs text-gray-400 mb-1">Updated</div>
                          <div className="text-xl font-bold text-green-400">{results.updated}</div>
                        </div>
                        <div className="bg-gray-900 bg-opacity-50 rounded p-3">
                          <div className="text-xs text-gray-400 mb-1">Errors</div>
                          <div className="text-xl font-bold text-red-400">{results.errors}</div>
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-green-300">
                        Recommendations will now regenerate with the updated metadata...
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {results.errorDetails && results.errorDetails.length > 0 && (
                <details className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                  <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-300">
                    View error details ({results.errorDetails.length})
                  </summary>
                  <div className="mt-3 space-y-2 text-xs text-gray-400 max-h-48 overflow-y-auto">
                    {results.errorDetails.map((detail, i) => (
                      <div key={i} className="border-l-2 border-red-700 pl-3 py-1">
                        <div className="text-white font-medium">{detail.artist}</div>
                        <div className="text-red-400">{detail.error}</div>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              <div className="flex justify-end pt-4">
                <button
                  onClick={handleClose}
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ArtistMetadataRefreshModal;
