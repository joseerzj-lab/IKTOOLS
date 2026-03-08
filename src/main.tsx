import React from 'react'
import ReactDOM from 'react-dom/client'
import './lib/leafletFix'
import './index.css'
import AuditoriaRutas from './pages/AuditoriaRutas'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuditoriaRutas />
  </React.StrictMode>
)
