// Vinyl Companion Service Worker
// Handles offline functionality and caching for PWA

const CACHE_NAME = 'vinyl-companion-v1'
const STATIC_CACHE_NAME = 'vinyl-companion-static-v1'
const DYNAMIC_CACHE_NAME = 'vinyl-companion-dynamic-v1'

// Files to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/apple-touch-icon.png',
  '/favicon-64x64.png',
  '/icon.svg'
]

// Install event - cache static assets
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...')
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching static assets')
        return cache.addAll(STATIC_ASSETS)
      })
      .catch(error => {
        console.error('Service Worker: Failed to cache static assets:', error)
      })
  )
  
  // Skip waiting to activate immediately
  self.skipWaiting()
})

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...')
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Delete old cache versions
          if (cacheName !== STATIC_CACHE_NAME && cacheName !== DYNAMIC_CACHE_NAME) {
            console.log('Service Worker: Deleting old cache:', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
  
  // Claim all clients immediately
  self.clients.claim()
})

// Fetch event - handle requests with cache strategies
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)
  
  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return
  }
  
  // Handle different types of requests
  if (request.destination === 'image') {
    // Images: Cache first, then network
    event.respondWith(cacheFirstStrategy(request, DYNAMIC_CACHE_NAME))
  } else if (request.destination === 'document' || request.url.includes('/index.html')) {
    // HTML: Network first, fallback to cache
    event.respondWith(networkFirstStrategy(request, STATIC_CACHE_NAME))
  } else if (request.destination === 'script' || request.destination === 'style') {
    // JS/CSS: Cache first, then network
    event.respondWith(cacheFirstStrategy(request, STATIC_CACHE_NAME))
  } else {
    // Other requests: Network first
    event.respondWith(networkFirstStrategy(request, DYNAMIC_CACHE_NAME))
  }
})

// Cache first strategy - try cache, fallback to network
async function cacheFirstStrategy(request, cacheName) {
  try {
    const cache = await caches.open(cacheName)
    const cachedResponse = await cache.match(request)
    
    if (cachedResponse) {
      return cachedResponse
    }
    
    const networkResponse = await fetch(request)
    
    // Cache successful responses
    if (networkResponse.status === 200) {
      cache.put(request, networkResponse.clone())
    }
    
    return networkResponse
  } catch (error) {
    console.error('Service Worker: Cache first strategy failed:', error)
    
    // Fallback for offline scenario
    if (request.destination === 'document') {
      const cache = await caches.open(STATIC_CACHE_NAME)
      return cache.match('/index.html')
    }
    
    throw error
  }
}

// Network first strategy - try network, fallback to cache
async function networkFirstStrategy(request, cacheName) {
  try {
    const networkResponse = await fetch(request)
    
    // Cache successful responses
    if (networkResponse.status === 200) {
      const cache = await caches.open(cacheName)
      cache.put(request, networkResponse.clone())
    }
    
    return networkResponse
  } catch (error) {
    console.log('Service Worker: Network failed, trying cache:', error.message)
    
    const cache = await caches.open(cacheName)
    const cachedResponse = await cache.match(request)
    
    if (cachedResponse) {
      return cachedResponse
    }
    
    // Ultimate fallback for navigation requests
    if (request.destination === 'document') {
      const staticCache = await caches.open(STATIC_CACHE_NAME)
      return staticCache.match('/index.html')
    }
    
    throw error
  }
}

// Handle background sync for offline album saves (future enhancement)
self.addEventListener('sync', event => {
  if (event.tag === 'vinyl-sync') {
    console.log('Service Worker: Background sync triggered')
    // Future: sync offline album data
  }
})

// Handle push notifications (future enhancement)
self.addEventListener('push', event => {
  if (event.data) {
    const data = event.data.json()
    console.log('Service Worker: Push notification received:', data)
    
    // Future: show notifications for new releases, etc.
  }
})

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  event.notification.close()
  
  event.waitUntil(
    clients.openWindow('/')
  )
})

// Handle app updates
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})