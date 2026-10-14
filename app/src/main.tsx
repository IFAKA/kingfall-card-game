import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/lilita-one'
import '@fontsource-variable/baloo-2'
import './index.css'
import App, { STORAGE_KEY } from './App.tsx'
import ErrorBoundary from './ErrorBoundary.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary storageKey={STORAGE_KEY}>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
