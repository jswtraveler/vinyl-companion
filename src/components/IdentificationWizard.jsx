import React, { useState } from 'react';

const IdentificationWizard = ({ onComplete, onCancel }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [results, setResults] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const steps = [
    'Capture Image',
    'Process Image', 
    'Search Results',
    'Confirm Details'
  ];

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-4">Capture Album Cover</h3>
            <p className="text-gray-600 mb-6">
              Take a photo of your vinyl record cover for automatic identification
            </p>
            <button
              onClick={handleNext}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Open Camera
            </button>
          </div>
        );
      
      case 2:
        return (
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-4">Processing Image</h3>
            <div className="flex justify-center mb-6">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
            <p className="text-gray-600">
              Enhancing image and searching databases...
            </p>
          </div>
        );
      
      case 3:
        return (
          <div>
            <h3 className="text-lg font-semibold mb-4">Search Results</h3>
            <div className="space-y-3">
              <div className="p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                <h4 className="font-medium">Sample Album Result</h4>
                <p className="text-gray-600">Sample Artist</p>
                <p className="text-sm text-gray-500">Confidence: 85%</p>
              </div>
            </div>
            <div className="mt-6 flex space-x-3">
              <button
                onClick={handleBack}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={handleNext}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Select This Result
              </button>
            </div>
          </div>
        );
      
      case 4:
        return (
          <div>
            <h3 className="text-lg font-semibold mb-4">Confirm Album Details</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  defaultValue="Sample Album"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Artist</label>
                <input
                  type="text"
                  defaultValue="Sample Artist"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="mt-6 flex space-x-3">
              <button
                onClick={handleBack}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={() => onComplete({ title: 'Sample Album', artist: 'Sample Artist' })}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Add to Collection
              </button>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-md w-full mx-4 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Album Identification</h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-6">
          <div className="flex items-center">
            {steps.map((step, index) => (
              <React.Fragment key={step}>
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                  index + 1 <= currentStep 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {index + 1}
                </div>
                {index < steps.length - 1 && (
                  <div className={`flex-1 h-px ${
                    index + 1 < currentStep ? 'bg-blue-600' : 'bg-gray-200'
                  }`} />
                )}
              </React.Fragment>
            ))}
          </div>
          <div className="flex justify-between mt-2">
            {steps.map((step, index) => (
              <span key={step} className={`text-xs ${
                index + 1 <= currentStep ? 'text-blue-600' : 'text-gray-500'
              }`}>
                {step}
              </span>
            ))}
          </div>
        </div>

        {renderStep()}
      </div>
    </div>
  );
};

export default IdentificationWizard;