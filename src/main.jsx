/**
 * NexttGen ERP — Manufacturing & Trading Management System
 * ---------------------------------------------------------
 * FRONTEND-ONLY DEMO. There is no backend, database or API.
 * Every record lives in React state and is persisted to localStorage
 * so that a client presentation feels like a real, working product.
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-sans/700.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'

import './styles/base.css'
import './styles/layout.css'
import './styles/components.css'
import './styles/documents.css'

import App from './App.jsx'
import { ErpProvider } from './store/ErpStore.jsx'
import { AuthProvider } from './store/AuthContext.jsx'
import { ToastProvider } from './components/ui/Toast.jsx'
import { ConfirmProvider } from './components/ui/ConfirmDialog.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
      <ErpProvider>
        <AuthProvider>
          <ToastProvider>
            <ConfirmProvider>
              <App />
            </ConfirmProvider>
          </ToastProvider>
        </AuthProvider>
      </ErpProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
