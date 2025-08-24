import React, { useRef, useState, useCallback } from 'react';

const CameraCapture = ({ onCapture, onClose }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);

  const startCamera = useCallback(async () => {
    try {
      const constraints = {
        video: {
          facingMode: { ideal: "environment" }, // Prefer rear camera
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsStreaming(true);
        setError(null);
      }
    } catch (err) {
      setError('Camera access denied or not available');
      console.error('Camera error:', err);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsStreaming(false);
    }
  }, []);

  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      context.drawImage(video, 0, 0);
      
      canvas.toBlob((blob) => {
        if (blob) {
          const reader = new FileReader();
          reader.onload = () => onCapture(reader.result);
          reader.readAsDataURL(blob);
        }
      }, 'image/jpeg', 0.8);
    }
  }, [onCapture]);

  React.useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
          <h3 className="text-lg font-semibold mb-2">Camera Not Available</h3>
          <p className="text-gray-600 mb-4">
            {error}
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Try using the "Add Manually" button instead, or check your browser permissions.
          </p>
          <div className="space-y-2">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-50">
      <div className="relative h-full">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />
        
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black to-transparent">
          <div className="flex justify-center items-center space-x-4">
            <button
              onClick={onClose}
              className="px-6 py-3 bg-gray-600 text-white rounded-full hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={capturePhoto}
              disabled={!isStreaming}
              className="w-16 h-16 bg-white rounded-full border-4 border-gray-300 hover:border-gray-400 disabled:opacity-50"
            >
              <div className="w-full h-full bg-gray-200 rounded-full"></div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CameraCapture;