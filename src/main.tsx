import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import { CRApp } from './components/app'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div style={{ minHeight: '100dvh', background: '#E8E6E0', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 430, height: '100dvh', overflow: 'hidden', position: 'relative', background: 'var(--bg)' }}>
        <CRApp />
      </div>
    </div>
  </React.StrictMode>
)
