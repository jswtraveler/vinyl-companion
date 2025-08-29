/**
 * Camera Service - Manages camera operations and device handling
 * Provides abstracted camera functionality for album cover capture
 */

export class CameraService {
  constructor() {
    this.stream = null;
    this.devices = [];
    this.currentDeviceId = null;
    this.isInitialized = false;
  }

  /**
   * Check if camera is supported in this environment
   */
  static isSupported() {
    return !!(
      navigator.mediaDevices &&
      navigator.mediaDevices.getUserMedia &&
      typeof navigator.mediaDevices.enumerateDevices === 'function'
    );
  }

  /**
   * Check camera permissions
   */
  async checkPermissions() {
    if (!navigator.permissions) {
      return 'unsupported';
    }

    try {
      const permission = await navigator.permissions.query({ name: 'camera' });
      return permission.state; // 'granted', 'denied', 'prompt'
    } catch (error) {
      console.warn('Permission query failed:', error);
      return 'unsupported';
    }
  }

  /**
   * Get all available camera devices
   */
  async getAvailableDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.devices = devices.filter(device => device.kind === 'videoinput');
      return this.devices;
    } catch (error) {
      console.error('Failed to enumerate devices:', error);
      throw new Error('Failed to get camera devices');
    }
  }

  /**
   * Find the best rear camera
   */
  findRearCamera() {
    if (!this.devices.length) return null;

    // Look for rear/back/environment camera
    const rearCamera = this.devices.find(device => {
      const label = device.label.toLowerCase();
      return (
        label.includes('back') ||
        label.includes('rear') ||
        label.includes('environment') ||
        label.includes('world')
      );
    });

    return rearCamera || this.devices[0]; // Fallback to first available
  }

  /**
   * Get optimal camera constraints for album cover capture
   */
  getCameraConstraints(deviceId = null) {
    const constraints = {
      video: {
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        aspectRatio: { ideal: 16/9 },
        frameRate: { ideal: 30 }
      }
    };

    if (deviceId) {
      constraints.video.deviceId = { exact: deviceId };
    } else {
      constraints.video.facingMode = { ideal: 'environment' };
    }

    return constraints;
  }

  /**
   * Start camera with specified device
   */
  async startCamera(deviceId = null) {
    try {
      // Stop existing stream first
      this.stopCamera();

      const constraints = this.getCameraConstraints(deviceId);
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.currentDeviceId = deviceId;
      this.isInitialized = true;

      return this.stream;
    } catch (error) {
      console.error('Camera start failed:', error);
      
      // Provide specific error messages
      switch (error.name) {
        case 'NotAllowedError':
          throw new Error('Camera access denied. Please allow camera permissions.');
        case 'NotFoundError':
          throw new Error('No camera found. Please check your device.');
        case 'NotReadableError':
          throw new Error('Camera is busy. Please close other apps using the camera.');
        case 'OverconstrainedError':
          throw new Error('Camera constraints not supported. Trying fallback...');
        case 'SecurityError':
          throw new Error('Camera access blocked due to security policy.');
        default:
          throw new Error(`Camera error: ${error.message || 'Unknown error'}`);
      }
    }
  }

  /**
   * Stop camera and release resources
   */
  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.stop();
      });
      this.stream = null;
      this.isInitialized = false;
    }
  }

  /**
   * Capture image from video stream
   */
  async captureImage(videoElement, options = {}) {
    if (!this.stream || !videoElement) {
      throw new Error('Camera not active or video element not provided');
    }

    const {
      quality = 0.85,
      format = 'image/jpeg',
      maxWidth = 1280,
      maxHeight = 1280
    } = options;

    return new Promise((resolve, reject) => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Get video dimensions
        const { videoWidth, videoHeight } = videoElement;
        
        // Calculate output dimensions maintaining aspect ratio
        let outputWidth = videoWidth;
        let outputHeight = videoHeight;

        if (outputWidth > maxWidth || outputHeight > maxHeight) {
          const ratio = Math.min(maxWidth / outputWidth, maxHeight / outputHeight);
          outputWidth = Math.floor(outputWidth * ratio);
          outputHeight = Math.floor(outputHeight * ratio);
        }

        canvas.width = outputWidth;
        canvas.height = outputHeight;

        // Draw video frame to canvas
        ctx.drawImage(videoElement, 0, 0, outputWidth, outputHeight);

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              // Convert blob to data URL
              const reader = new FileReader();
              reader.onload = () => resolve({
                dataUrl: reader.result,
                blob: blob,
                width: outputWidth,
                height: outputHeight,
                size: blob.size
              });
              reader.onerror = () => reject(new Error('Failed to convert image'));
              reader.readAsDataURL(blob);
            } else {
              reject(new Error('Failed to capture image'));
            }
          },
          format,
          quality
        );
      } catch (error) {
        reject(new Error(`Capture failed: ${error.message}`));
      }
    });
  }

  /**
   * Switch to next available camera
   */
  async switchCamera() {
    if (this.devices.length < 2) {
      throw new Error('Only one camera available');
    }

    const currentIndex = this.devices.findIndex(
      device => device.deviceId === this.currentDeviceId
    );
    
    const nextIndex = (currentIndex + 1) % this.devices.length;
    const nextDevice = this.devices[nextIndex];

    await this.startCamera(nextDevice.deviceId);
    return nextDevice;
  }

  /**
   * Get current camera info
   */
  getCurrentCamera() {
    if (!this.currentDeviceId) return null;
    
    return this.devices.find(device => device.deviceId === this.currentDeviceId);
  }

  /**
   * Initialize camera service
   */
  async initialize() {
    if (!CameraService.isSupported()) {
      throw new Error('Camera not supported in this browser');
    }

    try {
      await this.getAvailableDevices();
      return true;
    } catch (error) {
      console.error('Camera service initialization failed:', error);
      throw error;
    }
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.stopCamera();
    this.devices = [];
    this.currentDeviceId = null;
    this.isInitialized = false;
  }
}

// Export singleton instance
export const cameraService = new CameraService();
export default cameraService;