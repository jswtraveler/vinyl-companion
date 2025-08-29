import React from 'react';

const IdentificationLoader = ({ 
  isVisible = true, 
  stage = 'searching', 
  progress = 0, 
  message = null,
  onCancel = null 
}) => {
  const stages = {
    'preparing': {
      title: 'Preparing Image',
      description: 'Processing your album cover...',
      icon: '🖼️'
    },
    'searching': {
      title: 'Identifying Album',
      description: 'Searching with Google reverse image search...',
      icon: '🔍'
    },
    'enriching': {
      title: 'Getting Details',
      description: 'Gathering album information from music databases...',
      icon: '📀'
    },
    'completing': {
      title: 'Almost Done',
      description: 'Finalizing results...',
      icon: '✨'
    }
  };

  const currentStage = stages[stage] || stages['searching'];

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md mx-4 text-center shadow-xl">
        {/* Icon and Stage Indicator */}
        <div className="mb-6">
          <div className="text-6xl mb-4 animate-bounce">
            {currentStage.icon}
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">
            {currentStage.title}
          </h3>
          <p className="text-gray-600">
            {message || currentStage.description}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <div className="text-sm text-gray-500">
            {progress > 0 ? `${Math.round(progress)}% complete` : 'Processing...'}
          </div>
        </div>

        {/* Stage Progress Dots */}
        <div className="flex justify-center space-x-2 mb-6">
          {Object.keys(stages).map((stageKey, index) => {
            const isActive = stageKey === stage;
            const isCompleted = Object.keys(stages).indexOf(stage) > index;
            
            return (
              <div
                key={stageKey}
                className={`w-3 h-3 rounded-full transition-colors duration-300 ${
                  isCompleted 
                    ? 'bg-green-500' 
                    : isActive 
                    ? 'bg-blue-600 animate-pulse' 
                    : 'bg-gray-300'
                }`}
              />
            );
          })}
        </div>

        {/* Loading Animation */}
        <div className="mb-6">
          <div className="flex justify-center space-x-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"
                style={{
                  animationDelay: `${i * 0.2}s`,
                  animationDuration: '1s'
                }}
              />
            ))}
          </div>
        </div>

        {/* Cancel Button */}
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-6 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors"
          >
            Cancel
          </button>
        )}

        {/* Tips */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            <span className="font-medium">💡 Tip:</span> Make sure your album cover is clearly visible and well-lit for better results!
          </p>
        </div>
      </div>
    </div>
  );
};

export default IdentificationLoader;