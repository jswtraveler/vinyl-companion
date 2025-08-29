import React, { useRef, useState, useCallback, useEffect } from 'react';

const CameraCapture = ({ onCapture, onClose, onSaveToAlbum, onIdentifyAlbum }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [permissionState, setPermissionState] = useState('prompt'); // 'granted', 'denied', 'prompt'

  // Check camera permissions
  const checkCameraPermission = useCallback(async () => {
    try {
      const permission = await navigator.permissions.query({ name: 'camera' });
      setPermissionState(permission.state);
      
      permission.addEventListener('change', () => {
        setPermissionState(permission.state);
      });
    } catch (err) {
      console.log('Permissions API not supported');
    }
  }, []);

  // Get available cameras
  const getAvailableCameras = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setCameras(videoDevices);
      
      // Prefer rear camera if available
      const rearCameraIndex = videoDevices.findIndex(device => 
        device.label.toLowerCase().includes('back') || 
        device.label.toLowerCase().includes('rear') ||
        device.label.toLowerCase().includes('environment')
      );
      if (rearCameraIndex !== -1) {
        setCurrentCameraIndex(rearCameraIndex);
      }
    } catch (err) {
      console.error('Error getting cameras:', err);
    }
  }, []);

  const startCamera = useCallback(async (cameraIndex = currentCameraIndex) => {
    console.log('🎥 startCamera called with index:', cameraIndex);
    console.log('🎥 Current state:', { isLoading, isStreaming, cameras: cameras.length });
    
    try {
      setIsLoading(true);
      setError(null);
      console.log('🎥 Set loading=true, error=null');

      const constraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: { ideal: "environment" }
        }
      };

      // Use specific camera if available
      if (cameras.length > 0 && cameras[cameraIndex]) {
        constraints.video.deviceId = { exact: cameras[cameraIndex].deviceId };
        console.log('🎥 Using specific camera:', cameras[cameraIndex].label);
      } else {
        console.log('🎥 Using facingMode: environment');
      }

      console.log('🎥 Requesting getUserMedia with constraints:', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('🎥 getUserMedia success, got stream:', stream);
      console.log('🎥 Stream active:', stream.active, 'tracks:', stream.getTracks().length);

      if (videoRef.current) {
        console.log('🎥 Video ref exists, setting srcObject');
        console.log('🎥 Video element tagName:', videoRef.current.tagName);
        console.log('🎥 Video element readyState:', videoRef.current.readyState);
        videoRef.current.srcObject = stream;
        
        // Wait for video to actually start playing before setting streaming
        videoRef.current.onloadedmetadata = () => {
          console.log('🎥 Video metadata loaded, dimensions:', videoRef.current.videoWidth, 'x', videoRef.current.videoHeight);
          videoRef.current.play().then(() => {
            console.log('🎥 Video playing successfully, setting streaming=true');
            setIsStreaming(true);
            setPermissionState('granted');
            console.log('🎥 State updated: streaming=true, permission=granted');
          }).catch(err => {
            console.error('🎥 Video play failed:', err);
            setError('Failed to start video playback: ' + err.message);
          });
        };

        videoRef.current.onerror = (err) => {
          console.error('🎥 Video element error:', err);
          setError('Video element error occurred');
        };
        
        // Fallback: set streaming after delay if video events don't fire
        setTimeout(() => {
          console.log('🎥 Fallback timeout check - isStreaming:', isStreaming);
          if (!isStreaming) {
            console.log('🎥 Fallback: forcing streaming=true');
            setIsStreaming(true);
            setPermissionState('granted');
          }
        }, 3000);
      } else {
        console.error('🎥 Video ref is null!');
        setError('Video element not found');
      }
    } catch (err) {
      console.error('🎥 startCamera error:', err);
      console.error('🎥 Error name:', err.name, 'message:', err.message);
      
      if (err.name === 'NotAllowedError') {
        setPermissionState('denied');
        setError('Camera access was denied. Please allow camera access in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        setError('No camera found. Please make sure your device has a camera.');
      } else if (err.name === 'NotReadableError') {
        setError('Camera is already in use by another application.');
      } else {
        setError('Failed to access camera: ' + err.message);
      }
    } finally {
      console.log('🎥 startCamera finally block, setting loading=false');
      setIsLoading(false);
    }
  }, [cameras, currentCameraIndex]);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsStreaming(false);
    }
  }, []);

  const switchCamera = useCallback(() => {
    if (cameras.length > 1) {
      const nextIndex = (currentCameraIndex + 1) % cameras.length;
      setCurrentCameraIndex(nextIndex);
      stopCamera();
      startCamera(nextIndex);
    }
  }, [cameras.length, currentCameraIndex, startCamera, stopCamera]);

  const capturePhoto = useCallback(async () => {
    if (videoRef.current && canvasRef.current) {
      setIsLoading(true);
      try {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        context.drawImage(video, 0, 0);
        
        // Convert to blob for better quality control
        const blob = await new Promise(resolve => 
          canvas.toBlob(resolve, 'image/jpeg', 0.85)
        );
        
        if (blob) {
          const reader = new FileReader();
          reader.onload = () => {
            const imageData = reader.result;
            setCapturedImage(imageData);
            if (onCapture) {
              onCapture(imageData);
            }
          };
          reader.readAsDataURL(blob);
        }
      } catch (err) {
        console.error('Capture error:', err);
        setError('Failed to capture photo. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
  }, [onCapture]);

  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
    startCamera();
  }, [startCamera]);

  const savePhotoToAlbum = useCallback(() => {
    if (capturedImage && onSaveToAlbum) {
      onSaveToAlbum(capturedImage);
    }
    onClose();
  }, [capturedImage, onSaveToAlbum, onClose]);

  useEffect(() => {
    const initializeCamera = async () => {
      console.log('🎥 CameraCapture useEffect - starting initialization');
      console.log('🎥 Initial states:', { isLoading, isStreaming, error, permissionState });
      console.log('🎥 Video ref current:', videoRef.current);
      
      // Wait for video element to be available
      let attempts = 0;
      const maxAttempts = 10;
      while (!videoRef.current && attempts < maxAttempts) {
        console.log('🎥 Waiting for video element... attempt', attempts + 1);
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      if (!videoRef.current) {
        console.error('🎥 Video element not found after waiting');
        setError('Video element not available');
        return;
      }
      
      console.log('🎥 Video element found:', videoRef.current);
      
      try {
        console.log('🎥 Checking camera permission...');
        await checkCameraPermission();
        console.log('🎥 Permission check complete, state:', permissionState);
        
        console.log('🎥 Getting available cameras...');
        await getAvailableCameras();
        console.log('🎥 Camera enumeration complete, found:', cameras.length, 'cameras');
        
        if (permissionState !== 'denied') {
          console.log('🎥 Starting camera...');
          await startCamera();
          console.log('🎥 Start camera call complete');
        } else {
          console.log('🎥 Permission denied, not starting camera');
        }
      } catch (error) {
        console.error('🎥 Initialization error:', error);
        setError('Failed to initialize camera: ' + error.message);
      }
    };

    console.log('🎥 CameraCapture component mounted');
    // Add a small delay to ensure DOM is ready
    setTimeout(() => {
      initializeCamera();
    }, 100);
    
    return () => {
      console.log('🎥 CameraCapture component unmounting');
      stopCamera();
    };
  }, []);


  // Image preview state
  if (capturedImage) {
    return (
      <div className="fixed inset-0 bg-black z-50">
        <div className="relative h-full flex flex-col">
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black to-transparent p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-white text-lg font-semibold">Preview</h2>
              <button
                onClick={onClose}
                className="text-white hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Image Preview */}
          <div className="flex-1 flex items-center justify-center p-4">
            <img
              src={capturedImage}
              alt="Captured album cover"
              className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
            />
          </div>

          {/* Action Buttons */}
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black to-transparent">
            <div className="flex justify-center gap-3">
              <button
                onClick={retakePhoto}
                className="px-4 py-3 bg-gray-600 text-white rounded-full hover:bg-gray-700 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Retake
              </button>
              
              {onIdentifyAlbum && (
                <button
                  onClick={() => onIdentifyAlbum(capturedImage)}
                  className="px-4 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Identify Album
                </button>
              )}
              
              <button
                onClick={savePhotoToAlbum}
                className="px-4 py-3 bg-green-600 text-white rounded-full hover:bg-green-700 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Use Photo
              </button>
            </div>
            
            {/* Help Text */}
            <div className="text-center text-white/75 text-sm mt-4">
              <p>Identify: Automatically detect album info • Use Photo: Add manually</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Camera interface
  console.log('🎥 Rendering camera interface with states:', {
    isLoading,
    isStreaming, 
    error,
    permissionState,
    capturedImage: !!capturedImage,
    camerasFound: cameras.length
  });
  
  return (
    <div className="fixed inset-0 bg-black z-50">
      <div className="relative h-full">
        {/* Debug info overlay */}
        <div className="absolute top-16 left-4 z-20 bg-black bg-opacity-75 text-white text-xs p-2 rounded">
          <div>Loading: {isLoading.toString()}</div>
          <div>Streaming: {isStreaming.toString()}</div>
          <div>Error: {error || 'none'}</div>
          <div>Permission: {permissionState}</div>
          <div>Cameras: {cameras.length}</div>
        </div>
        
        {/* Header with controls */}
        <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black to-transparent p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-white text-lg font-semibold">Album Cover Capture</h2>
            <div className="flex items-center gap-2">
              {/* Camera switch button */}
              {cameras.length > 1 && (
                <button
                  onClick={switchCamera}
                  className="p-2 rounded-full bg-white/20 text-white hover:bg-white/30"
                  title="Switch camera"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              )}
              
              {/* Close button */}
              <button
                onClick={onClose}
                className="p-2 rounded-full bg-white/20 text-white hover:bg-white/30"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Video stream - Always render so ref is available */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Loading overlay */}
        {isLoading && !isStreaming && !capturedImage && (
          <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center z-30">
            <div className="bg-white rounded-lg p-6 max-w-sm mx-4 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h3 className="text-lg font-semibold mb-2">Initializing Camera</h3>
              <p className="text-gray-600">Please allow camera access when prompted...</p>
            </div>
          </div>
        )}

        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center z-30">
            <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
              <div className="text-center mb-4">
                <svg className="w-12 h-12 text-red-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <h3 className="text-lg font-semibold mb-2">Camera Access Issue</h3>
              </div>
              <p className="text-gray-600 mb-4 text-center">{error}</p>
              
              <div className="space-y-3">
                {permissionState === 'denied' && (
                  <div className="bg-yellow-50 p-3 rounded-md">
                    <p className="text-sm text-yellow-800">
                      <strong>To enable camera:</strong>
                      <br />1. Click the camera icon in your browser's address bar
                      <br />2. Select "Always allow" for camera access
                      <br />3. Refresh the page
                    </p>
                  </div>
                )}
                
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      setError(null);
                      setIsLoading(true);
                      try {
                        await checkCameraPermission();
                        await getAvailableCameras();
                        await startCamera();
                      } catch (err) {
                        console.error('Retry failed:', err);
                      }
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
          </div>
        )}

        {/* Album cover guide overlay */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="border-2 border-white/50 rounded-lg aspect-square w-72 max-w-[80vw]">
            <div className="w-full h-full border border-white/25 rounded-lg m-2">
              <div className="text-white/75 text-center mt-4 text-sm">
                Align album cover here
              </div>
            </div>
          </div>
        </div>
        
        {/* Bottom controls */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black to-transparent">
          <div className="flex justify-center items-center gap-8">
            {/* Cancel button */}
            <button
              onClick={onClose}
              className="px-6 py-3 bg-gray-600/80 text-white rounded-full hover:bg-gray-700/80 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancel
            </button>
            
            {/* Capture button */}
            <button
              onClick={capturePhoto}
              disabled={!isStreaming || isLoading}
              className="relative w-20 h-20 bg-white rounded-full border-4 border-white/30 hover:border-white/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-400 mx-auto"></div>
              ) : (
                <div className="w-full h-full bg-white rounded-full shadow-lg flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  </svg>
                </div>
              )}
            </button>
          </div>
          
          {/* Camera info */}
          <div className="text-center text-white/75 text-sm mt-4">
            {cameras.length > 0 && (
              <p>Using: {cameras[currentCameraIndex]?.label || 'Unknown Camera'}</p>
            )}
            <p>Position the album cover within the guide and tap capture</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CameraCapture;