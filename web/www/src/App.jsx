import { Routes, Route, Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import FileManager from './pages/FileManager'
import ScratchProjects from './pages/ScratchProjects'
import { prefix } from './config'

function App() {
  const { user } = useSelector((state) => state.auth)
  
  return (
    <Routes>
      <Route path={`${prefix}/login`} element={!user ? <Login /> : <Navigate to={`${prefix}/dashboard`} />} />
      <Route path={`${prefix}/register`} element={!user ? <Register /> : <Navigate to={`${prefix}/dashboard`} />} />
      <Route path={`${prefix}/`} element={<Layout />}>
        <Route index element={user ? <Dashboard /> : <Navigate to={`${prefix}/login`} />} />
        <Route path="dashboard" element={user ? <Dashboard /> : <Navigate to={`${prefix}/login`} />} />
        <Route path="files" element={user ? <FileManager /> : <Navigate to={`${prefix}/login`} />} />        
        <Route path="scratch-projects" element={user ? <ScratchProjects /> : <Navigate to={`${prefix}/login`} />} />
      </Route>
    </Routes>
  )
}

export default App