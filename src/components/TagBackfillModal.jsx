import { useState } from 'react';
import { backfillAlbumTags, estimateBackfillTime } from '../services/albumTagBackfill';

/**
 * TagBackfillModal Component
 *
 * Modal for backfilling Last.fm tags for existing albums
 */
const TagBackfillModal = ({ isOpen, onClose, albums, onUpdateAlbum }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, album: null });
  const [results, setResults] = useState(null);

  const handleStartBackfill = async () => {
    setIsRunning(true);
    setResults(null);
    setProgress({ current: 0, total: albums.length, album: null });

    try {
      const finalResults = await backfillAlbumTags(
        albums,
        (current, total, album) => {
          setProgress({ current, total, album });
        },
        async (albumId, updates) => {
          // Update album in database
          await onUpdateAlbum(albumId, updates);
        }
      );

      setResults(finalResults);
      console.log('✅ Backfill complete:', finalResults);
    } catch (error) {
      console.error('❌ Backfill error:', error);
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
        setProgress({ current: 0, total: 0, album: null });
        setResults(null);
      }, 300);
    }
  };

  if (!isOpen) return null;

  const estimatedTime = estimateBackfillTime(albums.length);
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
            <h3 className="text-xl font-semibold text-white">Backfill Genre Tags</h3>
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
                This will fetch genre tags from Last.fm for all albums in your collection that have fewer than 3 tags.
              </p>

              <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Albums to process:</span>
                    <span className="ml-2 text-white font-semibold">{albums.length}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Estimated time:</span>
                    <span className="ml-2 text-white font-semibold">{estimatedTime}</span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-900 bg-opacity-30 border border-blue-700 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-blue-200">
                    <p className="font-medium mb-1">Note:</p>
                    <ul className="list-disc list-inside space-y-1 text-blue-300">
                      <li>This process respects Last.fm's rate limit (1 request/second)</li>
                      <li>Albums with 3+ tags will be skipped</li>
                      <li>You can close this tab and the process will continue</li>
                      <li>New tags will be merged with existing genres</li>
                    </ul>
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
                  onClick={handleStartBackfill}
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium"
                >
                  Start Backfill
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
                  Processing album {progress.current} of {progress.total}...
                </p>
                {progress.album && (
                  <p className="text-gray-400 text-sm">
                    {progress.album.artist} - {progress.album.title}
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
                      <p className="font-medium mb-1">Error during backfill:</p>
                      <p>{results.error}</p>
                      <p className="mt-2 text-red-300">Processed {results.processed} albums before error.</p>
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
                      <p className="font-medium mb-3">Backfill complete!</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-900 bg-opacity-50 rounded p-3">
                          <div className="text-xs text-gray-400 mb-1">Total Processed</div>
                          <div className="text-xl font-bold text-white">{results.processed}</div>
                        </div>
                        <div className="bg-gray-900 bg-opacity-50 rounded p-3">
                          <div className="text-xs text-gray-400 mb-1">Updated</div>
                          <div className="text-xl font-bold text-green-400">{results.updated}</div>
                        </div>
                        <div className="bg-gray-900 bg-opacity-50 rounded p-3">
                          <div className="text-xs text-gray-400 mb-1">Skipped</div>
                          <div className="text-xl font-bold text-yellow-400">{results.skipped}</div>
                        </div>
                        <div className="bg-gray-900 bg-opacity-50 rounded p-3">
                          <div className="text-xs text-gray-400 mb-1">Errors</div>
                          <div className="text-xl font-bold text-red-400">{results.errors}</div>
                        </div>
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
                        <div className="text-white font-medium">{detail.album}</div>
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

export default TagBackfillModal;
