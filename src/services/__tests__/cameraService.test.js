import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CameraService, cameraService } from '../cameraService.js'

// Mock navigator and media devices
const mockGetUserMedia = vi.fn()
const mockEnumerateDevices = vi.fn()
const mockPermissionsQuery = vi.fn()

global.navigator = {
  mediaDevices: {
    getUserMedia: mockGetUserMedia,
    enumerateDevices: mockEnumerateDevices
  },
  permissions: {
    query: mockPermissionsQuery
  }
}

// Mock video element
const createMockVideoElement = () => ({
  videoWidth: 1280,
  videoHeight: 720,
  srcObject: null
})

// Mock canvas
const mockCanvas = {
  width: 0,
  height: 0,
  getContext: vi.fn(() => ({
    drawImage: vi.fn()
  })),
  toBlob: vi.fn()
}

global.document = {
  createElement: vi.fn(() => mockCanvas)
}

// Mock FileReader
global.FileReader = class MockFileReader {
  constructor() {
    this.onload = null
    this.onerror = null
    this.result = null
  }
  
  readAsDataURL(blob) {
    setTimeout(() => {
      this.result = 'data:image/jpeg;base64,mockImageData'
      this.onload && this.onload()
    }, 0)
  }
}

describe('CameraService', () => {
  let service

  beforeEach(() => {
    service = new CameraService()
    vi.clearAllMocks()
    
    // Reset mock implementations
    mockGetUserMedia.mockResolvedValue({
      getTracks: () => [{
        stop: vi.fn()
      }]
    })
    
    mockEnumerateDevices.mockResolvedValue([
      {
        kind: 'videoinput',
        deviceId: 'camera1',
        label: 'Front Camera'
      },
      {
        kind: 'videoinput', 
        deviceId: 'camera2',
        label: 'Back Camera'
      }
    ])
    
    mockPermissionsQuery.mockResolvedValue({
      state: 'granted',
      addEventListener: vi.fn()
    })
    
    mockCanvas.toBlob.mockImplementation((callback) => {
      callback(new Blob(['mock image data'], { type: 'image/jpeg' }))
    })
  })

  afterEach(() => {
    service.cleanup()
  })

  describe('Static Methods', () => {
    it('detects camera support correctly', () => {
      expect(CameraService.isSupported()).toBe(true)
      
      // Test without mediaDevices
      const originalNav = global.navigator
      global.navigator = {}
      expect(CameraService.isSupported()).toBe(false)
      global.navigator = originalNav
    })
  })

  describe('Permission Handling', () => {
    it('checks permissions successfully', async () => {
      const state = await service.checkPermissions()
      expect(state).toBe('granted')
      expect(mockPermissionsQuery).toHaveBeenCalledWith({ name: 'camera' })
    })

    it('handles unsupported permissions API', async () => {
      global.navigator.permissions = undefined
      const state = await service.checkPermissions()
      expect(state).toBe('unsupported')
    })

    it('handles permission query errors', async () => {
      mockPermissionsQuery.mockRejectedValue(new Error('Permission error'))
      const state = await service.checkPermissions()
      expect(state).toBe('unsupported')
    })
  })

  describe('Device Management', () => {
    it('gets available camera devices', async () => {
      const devices = await service.getAvailableDevices()
      
      expect(devices).toHaveLength(2)
      expect(devices[0]).toMatchObject({
        kind: 'videoinput',
        deviceId: 'camera1'
      })
      expect(service.devices).toEqual(devices)
    })

    it('handles device enumeration errors', async () => {
      mockEnumerateDevices.mockRejectedValue(new Error('Device error'))
      
      await expect(service.getAvailableDevices()).rejects.toThrow('Failed to get camera devices')
    })

    it('finds rear camera correctly', async () => {
      await service.getAvailableDevices()
      const rearCamera = service.findRearCamera()
      
      expect(rearCamera.label).toBe('Back Camera')
    })

    it('falls back to first camera when no rear camera found', async () => {
      mockEnumerateDevices.mockResolvedValue([
        { kind: 'videoinput', deviceId: 'front1', label: 'Front Camera 1' },
        { kind: 'videoinput', deviceId: 'front2', label: 'Front Camera 2' }
      ])
      
      await service.getAvailableDevices()
      const camera = service.findRearCamera()
      
      expect(camera.label).toBe('Front Camera 1')
    })
  })

  describe('Camera Constraints', () => {
    it('generates optimal constraints', () => {
      const constraints = service.getCameraConstraints()
      
      expect(constraints.video).toMatchObject({
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        aspectRatio: { ideal: 16/9 },
        frameRate: { ideal: 30 },
        facingMode: { ideal: 'environment' }
      })
    })

    it('uses specific device ID when provided', () => {
      const constraints = service.getCameraConstraints('camera123')
      
      expect(constraints.video.deviceId).toEqual({ exact: 'camera123' })
      expect(constraints.video.facingMode).toBeUndefined()
    })
  })

  describe('Camera Control', () => {
    it('starts camera successfully', async () => {
      const stream = await service.startCamera()
      
      expect(mockGetUserMedia).toHaveBeenCalledWith({
        video: expect.objectContaining({
          facingMode: { ideal: 'environment' }
        })
      })
      expect(service.isInitialized).toBe(true)
      expect(stream).toBeDefined()
    })

    it('starts camera with specific device', async () => {
      await service.getAvailableDevices()
      await service.startCamera('camera2')
      
      expect(mockGetUserMedia).toHaveBeenCalledWith({
        video: expect.objectContaining({
          deviceId: { exact: 'camera2' }
        })
      })
      expect(service.currentDeviceId).toBe('camera2')
    })

    it('handles camera permission denied', async () => {
      mockGetUserMedia.mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'))
      
      await expect(service.startCamera()).rejects.toThrow('Camera access denied')
    })

    it('handles camera not found', async () => {
      mockGetUserMedia.mockRejectedValue(new DOMException('No camera', 'NotFoundError'))
      
      await expect(service.startCamera()).rejects.toThrow('No camera found')
    })

    it('handles camera busy error', async () => {
      mockGetUserMedia.mockRejectedValue(new DOMException('Camera busy', 'NotReadableError'))
      
      await expect(service.startCamera()).rejects.toThrow('Camera is busy')
    })

    it('stops camera properly', async () => {
      const mockTrack = { stop: vi.fn() }
      const mockStream = { getTracks: () => [mockTrack] }
      mockGetUserMedia.mockResolvedValue(mockStream)
      
      await service.startCamera()
      service.stopCamera()
      
      expect(mockTrack.stop).toHaveBeenCalled()
      expect(service.stream).toBeNull()
      expect(service.isInitialized).toBe(false)
    })
  })

  describe('Image Capture', () => {
    it('captures image successfully', async () => {
      const mockVideo = createMockVideoElement()
      await service.startCamera()
      
      const result = await service.captureImage(mockVideo)
      
      expect(result).toMatchObject({
        dataUrl: 'data:image/jpeg;base64,mockImageData',
        blob: expect.any(Blob),
        width: 1280,
        height: 720,
        size: expect.any(Number)
      })
    })

    it('resizes large images', async () => {
      const mockVideo = {
        videoWidth: 2000,
        videoHeight: 1500
      }
      await service.startCamera()
      
      await service.captureImage(mockVideo, { maxWidth: 800, maxHeight: 600 })
      
      expect(mockCanvas.width).toBe(800)
      expect(mockCanvas.height).toBe(600)
    })

    it('handles capture errors', async () => {
      await expect(service.captureImage(null)).rejects.toThrow('Camera not active')
    })

    it('handles blob creation failure', async () => {
      mockCanvas.toBlob.mockImplementation((callback) => callback(null))
      const mockVideo = createMockVideoElement()
      await service.startCamera()
      
      await expect(service.captureImage(mockVideo)).rejects.toThrow('Failed to capture image')
    })
  })

  describe('Camera Switching', () => {
    it('switches to next camera', async () => {
      await service.getAvailableDevices()
      await service.startCamera('camera1')
      
      const nextCamera = await service.switchCamera()
      
      expect(nextCamera.deviceId).toBe('camera2')
      expect(service.currentDeviceId).toBe('camera2')
    })

    it('handles single camera scenario', async () => {
      service.devices = [{ deviceId: 'camera1', label: 'Only Camera' }]
      
      await expect(service.switchCamera()).rejects.toThrow('Only one camera available')
    })
  })

  describe('Service Management', () => {
    it('initializes successfully', async () => {
      const result = await service.initialize()
      
      expect(result).toBe(true)
      expect(service.devices).toHaveLength(2)
    })

    it('handles unsupported environment', async () => {
      global.navigator.mediaDevices = undefined
      
      await expect(service.initialize()).rejects.toThrow('Camera not supported')
    })

    it('gets current camera info', async () => {
      await service.getAvailableDevices()
      service.currentDeviceId = 'camera1'
      
      const camera = service.getCurrentCamera()
      expect(camera.deviceId).toBe('camera1')
    })

    it('cleans up resources properly', async () => {
      await service.getAvailableDevices()
      await service.startCamera()
      
      service.cleanup()
      
      expect(service.devices).toEqual([])
      expect(service.currentDeviceId).toBeNull()
      expect(service.isInitialized).toBe(false)
    })
  })
})

describe('Singleton Instance', () => {
  it('exports singleton instance', () => {
    expect(cameraService).toBeInstanceOf(CameraService)
  })
})