import { BrowserRouter, Routes, Route } from 'react-router-dom'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<div className="text-white p-8">Hola mundo</div>} />
      </Routes>
    </BrowserRouter>
  )
}