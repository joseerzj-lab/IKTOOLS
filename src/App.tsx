import { Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import Menu from './pages/Menu'
import AuditoriaRutas from './pages/AuditoriaRutas'
import Ruteo24h from './pages/Ruteo24h'
import ConsultorISOs from './pages/ConsultorISOs'
import VerificadorVehiculos from './pages/VerificadorVehiculos'
import ISOsFaltantesGeo from './pages/ISOsFaltantesGeo'
import RuteoPR from './pages/RuteoPR'
import ReporteRutas from './pages/ReporteRutas'
import RuteadorV9 from './pages/RuteadorV9'
import ActualizarOtif from './pages/ActualizarOtif'
import GenerarResumen from './pages/GenerarResumen'

import { ThemeBackground } from './components/ui/ThemeBackground'

export default function App() {
  useEffect(() => {
    document.title = 'IKTOOLSWH'
  }, [])

  return (
    <>
      <ThemeBackground />
      <Routes>
      <Route path="/" element={<Menu />} />
      <Route path="/auditoria" element={<AuditoriaRutas />} />
      <Route path="/ruteo-24hrs" element={<Ruteo24h />} />
      <Route path="/consultor" element={<ConsultorISOs />} />
      <Route path="/vehiculos" element={<VerificadorVehiculos />} />
      <Route path="/isos-geo" element={<ISOsFaltantesGeo />} />
      <Route path="/ruteo-pr" element={<RuteoPR />} />
      <Route path="/reporte" element={<ReporteRutas />} />
      <Route path="/ruteador" element={<RuteadorV9 />} />
      <Route path="/otif" element={<ActualizarOtif />} />
      <Route path="/generar-resumen" element={<GenerarResumen />} />
    </Routes>
    </>
  )
}