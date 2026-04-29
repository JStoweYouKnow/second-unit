import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

// Fix for Vite dynamic import preload error infinite loop
// When a new deployment happens, cached index.html might request old chunks.
// Vite auto-reloads on preloadError, which causes infinite loops if cached.
window.addEventListener('vite:preloadError', (event) => {
  const isReloaded = sessionStorage.getItem('vite-reload')
  if (!isReloaded) {
    sessionStorage.setItem('vite-reload', 'true')
    window.location.reload()
  } else {
    // Stop the infinite loop, let the ErrorBoundary show the error
    sessionStorage.removeItem('vite-reload')
    event.preventDefault()
  }
})
// Clear the flag on successful boot
sessionStorage.removeItem('vite-reload')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
