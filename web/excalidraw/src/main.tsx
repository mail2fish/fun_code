import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/www/excalidraw/new" element={<App />} />
        <Route path="/www/excalidraw/:boardId" element={<App />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
