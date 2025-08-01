import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/excalidraw/new" element={<App />} />
        <Route path="/excalidraw/:boardId" element={<App />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
