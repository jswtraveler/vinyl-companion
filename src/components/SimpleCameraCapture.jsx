import React, { useRef, useState, useCallback } from 'react';

const SimpleCameraCapture = ({ onCapture, onClose }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const streamRef = useRef(null);

  const startCamera = useCallback(async () => {
    console.log('🎥 SimpleCameraCapture: startCamera called');
    
    try {
      setError(null);

      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia is not supported in this browser');
      }

      console.log('🎥 Requesting camera with simple constraints...');
      const constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('🎥 Got media stream:', stream);

      // Direct DOM access like the working test page
      const video = videoRef.current;
      if (!video) {
        throw new Error('Video element not found');
      }

      console.log('🎥 Setting video srcObject directly');
      video.srcObject = stream;
      streamRef.current = stream;

      // Set up event listeners like the test page
      video.addEventListener('loadedmetadata', () => {
        console.log('🎥 Video metadata loaded, dimensions:', video.videoWidth, 'x', video.videoHeight);
        setIsStreaming(true);
      });

      video.addEventListener('playing', () => {
        console.log('🎥 Video is playing');
      });

    } catch (err) {
      console.error('🎥 SimpleCameraCapture error:', err);
      setError(err.message);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      const tracks = streamRef.current.getTracks();
      tracks.forEach(track => track.stop());
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      streamRef.current = null;
      setIsStreaming(false);
      console.log('🎥 Camera stopped');
    }
  }, []);

  const capturePhoto = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas) {
      setError('Video or canvas element not found');
      return;
    }

    try {
      const context = canvas.getContext('2d');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      context.drawImage(video, 0, 0);
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setCapturedImage(dataUrl);
      
      if (onCapture) {
        onCapture(dataUrl);
      }
    } catch (err) {
      console.error('🎥 Capture error:', err);
      setError('Failed to capture photo');
    }
  }, [onCapture]);

  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
    startCamera();
  }, [startCamera]);

  // Auto-start camera when component mounts (like test page)
  React.useEffect(() => {
    console.log('🎥 SimpleCameraCapture mounted - auto-starting camera');
    startCamera();
    
    return () => {
      console.log('🎥 SimpleCameraCapture unmounting');
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  // Error state
  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-sm mx-4 text-center">
          <h3 className="text-lg font-semibold mb-2 text-red-600">Camera Error</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setError(null);
                startCamera();
              }}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Try Again
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Image preview state
  if (capturedImage) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4">
          <img
            src={capturedImage}
            alt="Captured photo"
            className="max-w-full max-h-full object-contain"
          />
        </div>
        <div className="p-6 flex justify-center gap-4">
          <button
            onClick={retakePhoto}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Retake
          </button>
          <button
            onClick={() => {
              if (onCapture) {
                onCapture(capturedImage);
              }
              onClose();
            }}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Use Photo
          </button>
        </div>
      </div>
    );
  }

  // Camera interface (simplified like test page)
  return (
    <div className="fixed inset-0 bg-black z-50">
      <div className="relative h-full">
        {/* Debug info */}
        <div className="absolute top-4 left-4 z-20 bg-black bg-opacity-75 text-white text-xs p-2 rounded">
          <div>Simple Camera Test</div>
          <div>Streaming: {isStreaming.toString()}</div>
          <div>Error: {error || 'none'}</div>
          <div>Video ref: {videoRef.current ? 'exists' : 'null'}</div>
        </div>

        {/* Close button */}
        <div className="absolute top-4 right-4 z-10">
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/20 text-white hover:bg-white/30"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Video element - simple like test page */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ border: '2px solid #00ff00' }}
        />
        
        <canvas ref={canvasRef} className="hidden" />

        {/* Capture controls at bottom */}
        <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-4">
          <button
            onClick={startCamera}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Start Camera
          </button>
          <button
            onClick={capturePhoto}
            disabled={!isStreaming}
            className="px-6 py-3 bg-white rounded-full border-4 border-white/30 hover:border-white/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            📷
          </button>
          <button
            onClick={stopCamera}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Stop Camera
          </button>
        </div>

        {/* Status at bottom */}
        <div className="absolute bottom-20 left-0 right-0 text-center text-white text-sm">
          Status: {isStreaming ? 'Camera active' : 'Camera not active'}
        </div>
      </div>
    </div>
  );
};

export default SimpleCameraCapture;