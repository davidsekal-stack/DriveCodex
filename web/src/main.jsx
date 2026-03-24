import React from 'react'
import ReactDOM from 'react-dom/client'
import { I18nProvider } from './i18n/index.jsx'
import App from './App.jsx'
import SharedCaseView from './components/SharedCaseView.jsx'

// Detect share link: gearbrain.app/?share=abc123
const shareId = new URLSearchParams(window.location.search).get("share");

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <I18nProvider>
      {shareId ? <SharedCaseView shareId={shareId} /> : <App />}
    </I18nProvider>
  </React.StrictMode>
)
