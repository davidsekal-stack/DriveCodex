import React from 'react'
import ReactDOM from 'react-dom/client'
import { I18nProvider } from './i18n/index.jsx'
import App from './App.jsx'
import SharedCaseView from './components/SharedCaseView.jsx'

// Detect share link from:
//   1. /share/abc123  (clean URL — pathname)
//   2. /?share=abc123 (fallback — query param)
const pathMatch = window.location.pathname.match(/^\/share\/([a-z0-9]+)$/i);
const shareId = pathMatch?.[1] ?? new URLSearchParams(window.location.search).get("share");

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <I18nProvider>
      {shareId ? <SharedCaseView shareId={shareId} /> : <App />}
    </I18nProvider>
  </React.StrictMode>
)
