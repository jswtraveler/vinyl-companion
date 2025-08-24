import '@testing-library/jest-dom'

// Global test setup
beforeAll(() => {
  // Mock console methods to reduce noise in tests
  global.console = {
    ...console,
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn()
  }
})

// Mock IndexedDB for testing
const mockIDB = {
  open: vi.fn(() => Promise.resolve({
    transaction: vi.fn(() => ({
      objectStore: vi.fn(() => ({
        add: vi.fn(() => Promise.resolve()),
        put: vi.fn(() => Promise.resolve()),
        delete: vi.fn(() => Promise.resolve()),
        get: vi.fn(() => Promise.resolve()),
        getAll: vi.fn(() => Promise.resolve([]))
      }))
    })),
    close: vi.fn()
  }))
}

global.indexedDB = mockIDB

// Mock user media for camera tests
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn(() => Promise.resolve({
      getVideoTracks: () => [{
        stop: vi.fn()
      }]
    }))
  }
})

// Mock service worker
Object.defineProperty(global.navigator, 'serviceWorker', {
  value: {
    register: vi.fn(() => Promise.resolve()),
    ready: Promise.resolve()
  }
})