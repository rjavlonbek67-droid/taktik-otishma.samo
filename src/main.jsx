import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'
import { BUILD } from './build.js'
import './index.css'

function reloadOnce() {
  if (sessionStorage.getItem('oyin-reloaded') === '1') return
  sessionStorage.setItem('oyin-reloaded', '1')
  window.location.reload()
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateSW(true)
    },
    onNeedReload() {
      reloadOnce()
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return
      const check = () => {
        registration.update().catch(() => {})
      }
      window.setTimeout(check, 1200)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
    },
  })

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    reloadOnce()
  })

  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'SW_UPDATED' && event.data.build && event.data.build !== BUILD) {
      reloadOnce()
    }
  })

  window.addEventListener('load', () => {
    window.setTimeout(() => sessionStorage.removeItem('oyin-reloaded'), 4000)
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
