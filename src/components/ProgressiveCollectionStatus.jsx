import { useState, useEffect } from 'react';

/**
 * Progressive Collection Status Component
 *
 * Displays real-time status of background metadata collection
 * Shows progress bar, current activity, and manual controls
 */
const ProgressiveCollectionStatus = ({ service }) => {
  const [progress, setProgress] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!service) return;

    // Update progress every second
    const interval = setInterval(() => {
      const currentProgress = service.getProgress();
      setProgress(currentProgress);
    }, 1000);

    // Initial update
    setProgress(service.getProgress());

    return () => clearInterval(interval);
  }, [service]);

  if (!progress || progress.total === 0) {
    return null; // Don't show if no collection is planned
  }

  const handleTogglePause = () => {
    if (service.isPaused) {
      service.resumeCollection();
    } else {
      service.pauseCollection();
    }
  };

  const handleClear = () => {
    if (confirm('Clear all progress and restart? This will not delete cached data, just reset the queue.')) {
      service.clearProgress();
      setProgress(service.getProgress());
    }
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4">
      {/* Header */}
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="text-2xl">
            {service.isRunning && !service.isPaused ? '🔄' :
             service.isPaused ? '⏸️' :
             progress.percentage === 100 ? '✅' : '💤'}
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-300">
              Background Cache Collection
            </div>
            <div className="text-xs text-gray-500">
              {service.isRunning && !service.isPaused && 'Collecting metadata while you\'re idle'}
              {service.isPaused && 'Paused - waiting for idle time'}
              {!service.isRunning && progress.percentage === 100 && 'Collection complete'}
              {!service.isRunning && progress.percentage < 100 && 'Idle detection active'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-lg font-bold text-white">
              {progress.fetched} / {progress.total}
            </div>
            <div className="text-xs text-gray-500">
              {progress.percentage}% complete
            </div>
          </div>
          <div className="text-gray-500 text-xs">
            {isExpanded ? '▼' : '▶'}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-3 h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            service.isRunning && !service.isPaused
              ? 'bg-gradient-to-r from-green-500 to-blue-500 animate-pulse'
              : progress.percentage === 100
              ? 'bg-green-500'
              : 'bg-gray-600'
          }`}
          style={{ width: `${progress.percentage}%` }}
        />
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-gray-700 space-y-3">
          {/* Status Details */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Remaining:</span>
              <span className="ml-2 text-white">{progress.remaining} artists</span>
            </div>
            <div>
              <span className="text-gray-500">Failed:</span>
              <span className="ml-2 text-white">{progress.failedCount}</span>
            </div>
            <div>
              <span className="text-gray-500">User Status:</span>
              <span className="ml-2 text-white">
                {progress.isIdle ? '💤 Idle' : '👁️ Active'}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Collection:</span>
              <span className="ml-2 text-white">
                {service.isRunning && !service.isPaused ? '🟢 Running' :
                 service.isPaused ? '🟡 Paused' :
                 '⚪ Stopped'}
              </span>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-gray-900 rounded p-3 text-xs text-gray-400">
            <div className="font-semibold text-gray-300 mb-1">ℹ️ How it works:</div>
            <ul className="list-disc list-inside space-y-1">
              <li>Automatically collects metadata after 30s of inactivity</li>
              <li>Pauses immediately when you move or click</li>
              <li>Improves recommendation quality over time</li>
              <li>Progress is saved and continues across sessions</li>
            </ul>
          </div>

          {/* Manual Controls */}
          <div className="flex gap-2">
            {service.isRunning && (
              <button
                onClick={handleTogglePause}
                className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm font-medium transition-colors"
              >
                {service.isPaused ? '▶️ Resume' : '⏸️ Pause'}
              </button>
            )}

            {!service.isRunning && progress.remaining > 0 && (
              <button
                onClick={() => service.startCollection()}
                className="flex-1 px-3 py-2 bg-green-700 hover:bg-green-600 rounded text-sm font-medium transition-colors"
              >
                ▶️ Start Now
              </button>
            )}

            <button
              onClick={handleClear}
              className="px-3 py-2 bg-red-700 hover:bg-red-600 rounded text-sm font-medium transition-colors"
            >
              🗑️ Clear
            </button>
          </div>

          {/* Performance Impact Note */}
          {service.isRunning && !service.isPaused && (
            <div className="text-xs text-yellow-400 bg-yellow-900/20 rounded p-2">
              ⚡ Fetching 1 artist per second. Zero impact on your browsing.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProgressiveCollectionStatus;