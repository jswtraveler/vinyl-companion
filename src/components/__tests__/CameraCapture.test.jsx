import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CameraCapture from '../CameraCapture.jsx'

// Mock getUserMedia and related APIs
const mockGetUserMedia = vi.fn()
const mockEnumerateDevices = vi.fn()
const mockPermissionsQuery = vi.fn()

Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: mockGetUserMedia,
    enumerateDevices: mockEnumerateDevices
  }
})

Object.defineProperty(global.navigator, 'permissions', {
  value: {
    query: mockPermissionsQuery
  }
})

// Mock video element
const mockVideoElement = {
  videoWidth: 1280,
  videoHeight: 720,
  srcObject: null
}

// Mock canvas and context
const mockCanvasContext = {
  drawImage: vi.fn()
}

const mockCanvas = {
  width: 0,
  height: 0,
  getContext: vi.fn(() => mockCanvasContext),
  toBlob: vi.fn()
}

Object.defineProperty(global.document, 'createElement', {
  value: vi.fn(() => mockCanvas)
})

// Mock FileReader
global.FileReader = class MockFileReader {
  constructor() {
    this.onload = null
    this.result = null
  }
  
  readAsDataURL() {
    setTimeout(() => {
      this.result = 'data:image/jpeg;base64,mockImageData'
      if (this.onload) this.onload()
    }, 0)
  }
}

describe('CameraCapture', () => {
  const mockOnCapture = vi.fn()
  const mockOnClose = vi.fn()
  const mockOnSaveToAlbum = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Reset mock video element
    mockVideoElement.srcObject = null
    
    // Setup default mock responses
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
      callback(new Blob(['mock'], { type: 'image/jpeg' }))
    })
  })

  it('renders loading state initially', () => {
    render(
      <CameraCapture
        onCapture={mockOnCapture}
        onClose={mockOnClose}
        onSaveToAlbum={mockOnSaveToAlbum}
      />
    )
    
    expect(screen.getByText('Initializing Camera')).toBeInTheDocument()
    expect(screen.getByText('Please allow camera access when prompted...')).toBeInTheDocument()
  })

  it('renders camera interface when streaming', async () => {
    render(
      <CameraCapture
        onCapture={mockOnCapture}
        onClose={mockOnClose}
        onSaveToAlbum={mockOnSaveToAlbum}
      />
    )
    
    await waitFor(() => {
      expect(screen.getByText('Album Cover Capture')).toBeInTheDocument()
    })
    
    expect(screen.getByText('Position the album cover within the guide and tap capture')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('handles camera permission denied', async () => {
    mockGetUserMedia.mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'))
    
    render(
      <CameraCapture
        onCapture={mockOnCapture}
        onClose={mockOnClose}
        onSaveToAlbum={mockOnSaveToAlbum}
      />
    )
    
    await waitFor(() => {
      expect(screen.getByText('Camera Access Issue')).toBeInTheDocument()
    })
    
    expect(screen.getByText(/Camera access was denied/)).toBeInTheDocument()
    expect(screen.getByText(/To enable camera:/)).toBeInTheDocument()
  })

  it('handles camera not found error', async () => {
    mockGetUserMedia.mockRejectedValue(new DOMException('No camera', 'NotFoundError'))
    
    render(
      <CameraCapture
        onCapture={mockOnCapture}
        onClose={mockOnClose}
        onSaveToAlbum={mockOnSaveToAlbum}
      />
    )
    
    await waitFor(() => {
      expect(screen.getByText(/No camera found/)).toBeInTheDocument()
    })
  })

  it('handles camera busy error', async () => {
    mockGetUserMedia.mockRejectedValue(new DOMException('Camera busy', 'NotReadableError'))
    
    render(
      <CameraCapture
        onCapture={mockOnCapture}
        onClose={mockOnClose}
        onSaveToAlbum={mockOnSaveToAlbum}
      />
    )
    
    await waitFor(() => {
      expect(screen.getByText(/Camera is already in use/)).toBeInTheDocument()
    })
  })

  it('calls onClose when close button clicked', async () => {
    render(
      <CameraCapture
        onCapture={mockOnCapture}
        onClose={mockOnClose}
        onSaveToAlbum={mockOnSaveToAlbum}
      />
    )
    
    await waitFor(() => {
      expect(screen.getByText('Album Cover Capture')).toBeInTheDocument()
    })
    
    const closeButton = screen.getAllByRole('button').find(btn => 
      btn.querySelector('svg')?.getAttribute('viewBox') === '0 0 24 24'
    )
    
    fireEvent.click(closeButton)
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('shows camera switch button when multiple cameras available', async () => {
    render(
      <CameraCapture
        onCapture={mockOnCapture}
        onClose={mockOnClose}
        onSaveToAlbum={mockOnSaveToAlbum}
      />
    )
    
    await waitFor(() => {
      expect(screen.getByText('Album Cover Capture')).toBeInTheDocument()
    })
    
    const switchButton = screen.getByTitle('Switch camera')
    expect(switchButton).toBeInTheDocument()
  })

  it('hides camera switch button with single camera', async () => {
    mockEnumerateDevices.mockResolvedValue([
      { kind: 'videoinput', deviceId: 'camera1', label: 'Only Camera' }
    ])
    
    render(
      <CameraCapture
        onCapture={mockOnCapture}
        onClose={mockOnClose}
        onSaveToAlbum={mockOnSaveToAlbum}
      />
    )
    
    await waitFor(() => {
      expect(screen.getByText('Album Cover Capture')).toBeInTheDocument()
    })
    
    expect(screen.queryByTitle('Switch camera')).not.toBeInTheDocument()
  })

  it('displays album cover guide overlay', async () => {
    render(
      <CameraCapture
        onCapture={mockOnCapture}
        onClose={mockOnClose}
        onSaveToAlbum={mockOnSaveToAlbum}
      />
    )
    
    await waitFor(() => {
      expect(screen.getByText('Align album cover here')).toBeInTheDocument()
    })
  })

  it('shows retry functionality in error state', async () => {
    mockGetUserMedia
      .mockRejectedValueOnce(new Error('Initial error'))
      .mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }]
      })
    
    render(
      <CameraCapture
        onCapture={mockOnCapture}
        onClose={mockOnClose}
        onSaveToAlbum={mockOnSaveToAlbum}
      />
    )
    
    await waitFor(() => {
      expect(screen.getByText('Camera Access Issue')).toBeInTheDocument()
    })
    
    const retryButton = screen.getByText('Try Again')
    fireEvent.click(retryButton)
    
    await waitFor(() => {
      expect(screen.getByText('Album Cover Capture')).toBeInTheDocument()
    })
  })

  it('displays camera information', async () => {
    render(
      <CameraCapture
        onCapture={mockOnCapture}
        onClose={mockOnClose}
        onSaveToAlbum={mockOnSaveToAlbum}
      />
    )
    
    await waitFor(() => {
      expect(screen.getByText(/Using:/)).toBeInTheDocument()
    })
  })

  it('provides accessibility for capture button', async () => {
    render(
      <CameraCapture
        onCapture={mockOnCapture}
        onClose={mockOnClose}
        onSaveToAlbum={mockOnSaveToAlbum}
      />
    )
    
    await waitFor(() => {
      const captureButton = screen.getByRole('button', { name: '' }) // The large circular button
      expect(captureButton).toBeInTheDocument()
      expect(captureButton).not.toBeDisabled()
    })
  })

  describe('Photo Capture Integration', () => {
    it('captures image when capture button clicked', async () => {
      render(
        <CameraCapture
          onCapture={mockOnCapture}
          onClose={mockOnClose}
          onSaveToAlbum={mockOnSaveToAlbum}
        />
      )
      
      await waitFor(() => {
        expect(screen.getByText('Album Cover Capture')).toBeInTheDocument()
      })
      
      // Find the large circular capture button
      const buttons = screen.getAllByRole('button')
      const captureButton = buttons.find(btn => 
        btn.classList.contains('w-20') && btn.classList.contains('h-20')
      )
      
      expect(captureButton).toBeInTheDocument()
      fireEvent.click(captureButton)
      
      await waitFor(() => {
        expect(mockOnCapture).toHaveBeenCalledWith('data:image/jpeg;base64,mockImageData')
      })
    })

    it('handles capture failure gracefully', async () => {
      mockCanvas.toBlob.mockImplementation((callback) => {
        callback(null) // Simulate failure
      })
      
      render(
        <CameraCapture
          onCapture={mockOnCapture}
          onClose={mockOnClose}
          onSaveToAlbum={mockOnSaveToAlbum}
        />
      )
      
      await waitFor(() => {
        expect(screen.getByText('Album Cover Capture')).toBeInTheDocument()
      })
      
      const buttons = screen.getAllByRole('button')
      const captureButton = buttons.find(btn => 
        btn.classList.contains('w-20')
      )
      
      if (captureButton) {
        fireEvent.click(captureButton)
        
        // Should not crash and maintain interface
        await waitFor(() => {
          expect(screen.getByText('Album Cover Capture')).toBeInTheDocument()
        })
      }
    })

    it('disables capture button during loading', async () => {
      // Mock slow blob creation
      mockCanvas.toBlob.mockImplementation((callback) => {
        setTimeout(() => {
          callback(new Blob(['mock'], { type: 'image/jpeg' }))
        }, 100)
      })
      
      render(
        <CameraCapture
          onCapture={mockOnCapture}
          onClose={mockOnClose}
          onSaveToAlbum={mockOnSaveToAlbum}
        />
      )
      
      await waitFor(() => {
        expect(screen.getByText('Album Cover Capture')).toBeInTheDocument()
      })
      
      const buttons = screen.getAllByRole('button')
      const captureButton = buttons.find(btn => 
        btn.classList.contains('w-20')
      )
      
      if (captureButton) {
        fireEvent.click(captureButton)
        expect(captureButton).toBeDisabled()
      }
    })
  })

  describe('Camera Device Management', () => {
    it('prefers rear camera when available', async () => {
      mockEnumerateDevices.mockResolvedValue([
        {
          kind: 'videoinput',
          deviceId: 'front-cam',
          label: 'Front Camera'
        },
        {
          kind: 'videoinput', 
          deviceId: 'back-cam',
          label: 'Back Camera (rear)'
        }
      ])
      
      render(
        <CameraCapture
          onCapture={mockOnCapture}
          onClose={mockOnClose}
          onSaveToAlbum={mockOnSaveToAlbum}
        />
      )
      
      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalledWith(
          expect.objectContaining({
            video: expect.objectContaining({
              deviceId: { exact: 'back-cam' }
            })
          })
        )
      })
    })

    it('switches cameras when switch button clicked', async () => {
      render(
        <CameraCapture
          onCapture={mockOnCapture}
          onClose={mockOnClose}
          onSaveToAlbum={mockOnSaveToAlbum}
        />
      )
      
      await waitFor(() => {
        expect(screen.getByTitle('Switch camera')).toBeInTheDocument()
      })
      
      const switchButton = screen.getByTitle('Switch camera')
      fireEvent.click(switchButton)
      
      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('Permission Handling Integration', () => {
    it('handles permission state changes', async () => {
      const mockPermission = {
        state: 'prompt',
        addEventListener: vi.fn()
      }
      
      mockPermissionsQuery.mockResolvedValue(mockPermission)
      
      render(
        <CameraCapture
          onCapture={mockOnCapture}
          onClose={mockOnClose}
          onSaveToAlbum={mockOnSaveToAlbum}
        />
      )
      
      await waitFor(() => {
        expect(mockPermission.addEventListener).toHaveBeenCalledWith(
          'change',
          expect.any(Function)
        )
      })
    })

    it('handles unsupported permissions API', async () => {
      mockPermissionsQuery.mockRejectedValue(new Error('Not supported'))
      
      render(
        <CameraCapture
          onCapture={mockOnCapture}
          onClose={mockOnClose}
          onSaveToAlbum={mockOnSaveToAlbum}
        />
      )
      
      // Should still attempt to start camera
      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalled()
      })
    })
  })

  describe('Resource Cleanup', () => {
    it('stops camera stream on unmount', async () => {
      const mockStop = vi.fn()
      mockGetUserMedia.mockResolvedValue({
        getTracks: () => [{ stop: mockStop }]
      })
      
      const { unmount } = render(
        <CameraCapture
          onCapture={mockOnCapture}
          onClose={mockOnClose}
          onSaveToAlbum={mockOnSaveToAlbum}
        />
      )
      
      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalled()
      })
      
      unmount()
      expect(mockStop).toHaveBeenCalled()
    })

    it('handles cleanup when no stream exists', () => {
      const { unmount } = render(
        <CameraCapture
          onCapture={mockOnCapture}
          onClose={mockOnClose}
          onSaveToAlbum={mockOnSaveToAlbum}
        />
      )
      
      expect(() => unmount()).not.toThrow()
    })
  })

  describe('Camera Service Integration', () => {
    it('uses environment facing mode as fallback', async () => {
      mockEnumerateDevices.mockResolvedValue([
        {
          kind: 'videoinput',
          deviceId: 'generic-cam',
          label: 'Generic Camera'
        }
      ])
      
      render(
        <CameraCapture
          onCapture={mockOnCapture}
          onClose={mockOnClose}
          onSaveToAlbum={mockOnSaveToAlbum}
        />
      )
      
      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalledWith(
          expect.objectContaining({
            video: expect.objectContaining({
              facingMode: { ideal: 'environment' }
            })
          })
        )
      })
    })

    it('requests optimal camera constraints', async () => {
      render(
        <CameraCapture
          onCapture={mockOnCapture}
          onClose={mockOnClose}
          onSaveToAlbum={mockOnSaveToAlbum}
        />
      )
      
      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalledWith(
          expect.objectContaining({
            video: expect.objectContaining({
              width: { ideal: 1280 },
              height: { ideal: 720 },
              aspectRatio: { ideal: 1.33 }
            })
          })
        )
      })
    })
  })

  describe('Error Recovery Integration', () => {
    it('allows retry after permission error', async () => {
      mockGetUserMedia
        .mockRejectedValueOnce(new DOMException('Denied', 'NotAllowedError'))
        .mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] })
      
      render(
        <CameraCapture
          onCapture={mockOnCapture}
          onClose={mockOnClose}  
          onSaveToAlbum={mockOnSaveToAlbum}
        />
      )
      
      await waitFor(() => {
        expect(screen.getByText('Try Again')).toBeInTheDocument()
      })
      
      fireEvent.click(screen.getByText('Try Again'))
      
      await waitFor(() => {
        expect(screen.getByText('Album Cover Capture')).toBeInTheDocument()
      })
    })

    it('shows specific error messages for different failures', async () => {
      const testCases = [
        {
          error: new DOMException('Denied', 'NotAllowedError'),
          expectedText: /camera access was denied/i
        },
        {
          error: new DOMException('No device', 'NotFoundError'), 
          expectedText: /no camera found/i
        },
        {
          error: new DOMException('In use', 'NotReadableError'),
          expectedText: /camera is already in use/i
        }
      ]
      
      for (const testCase of testCases) {
        mockGetUserMedia.mockRejectedValue(testCase.error)
        
        const { unmount } = render(
          <CameraCapture
            onCapture={mockOnCapture}
            onClose={mockOnClose}
            onSaveToAlbum={mockOnSaveToAlbum}
          />
        )
        
        await waitFor(() => {
          expect(screen.getByText(testCase.expectedText)).toBeInTheDocument()
        })
        
        unmount()
        vi.clearAllMocks()
      }
    })
  })
})