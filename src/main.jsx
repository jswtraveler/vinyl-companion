import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Register Service Worker for PWA functionality
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      })
      
      console.log('Service Worker registered successfully:', registration)
      
      // Handle service worker updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('New service worker available')
            
            // Notify user about update (future enhancement)
            if (window.confirm('New version available! Refresh to update?')) {
              newWorker.postMessage({ type: 'SKIP_WAITING' })
              window.location.reload()
            }
          }
        })
      })
      
      // Handle controller change (new service worker activated)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('Service Worker controller changed')
        window.location.reload()
      })
      
    } catch (error) {
      console.error('Service Worker registration failed:', error)
    }
  })
}

// PWA install prompt handling
let deferredPrompt
window.addEventListener('beforeinstallprompt', (e) => {
  console.log('PWA install prompt triggered')
  
  // Prevent the mini-infobar from appearing
  e.preventDefault()
  
  // Store the event for later use
  deferredPrompt = e
  
  // Optionally show custom install UI
  // showInstallButton()
})

// Handle successful PWA installation
window.addEventListener('appinstalled', (e) => {
  console.log('PWA installed successfully')
  deferredPrompt = null
  
  // Optional: track installation analytics
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
