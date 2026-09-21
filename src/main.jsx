import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Suppress benign AdSense SPA duplicate push errors in single-page applications
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    if (
      event?.message?.includes("All 'ins' elements in the DOM with class=adsbygoogle already have ads in them") ||
      event?.error?.message?.includes("All 'ins' elements in the DOM with class=adsbygoogle already have ads in them")
    ) {
      event.preventDefault();
      event.stopPropagation();
      return true;
    }
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
