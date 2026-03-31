import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import { useTheme, getThemeColors } from '../../context/ThemeContext'

interface ImageModalProps {
  isOpen: boolean
  onClose: () => void
  images: string[]
}

export default function ImageModal({ isOpen, onClose, images }: ImageModalProps) {
  const { theme } = useTheme()
  const TC = getThemeColors(theme)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const [isDragging, setIsDragging] = useState(false)
  const [imgErrors, setImgErrors] = useState<Record<number, boolean>>({})
  const imgRef = React.useRef<HTMLImageElement>(null)

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (transform.scale > 1 && e.button === 0) {
      setIsDragging(true)
      e.currentTarget.setPointerCapture(e.pointerId)
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setTransform(prev => ({
        ...prev,
        x: prev.x + e.movementX,
        y: prev.y + e.movementY
      }))
    }
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setIsDragging(false)
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  const doZoom = (zoomIn: boolean, mouseX = 0, mouseY = 0) => {
    setTransform(prev => {
      const step = 0.15
      const newScale = zoomIn ? Math.min(prev.scale + step, 8) : Math.max(prev.scale - step, 1)
      if (newScale === 1) return { x: 0, y: 0, scale: 1 }

      const ratio = newScale / prev.scale
      const newX = mouseX - (mouseX - prev.x) * ratio
      const newY = mouseY - (mouseY - prev.y) * ratio

      return { x: newX, y: newY, scale: newScale }
    })
  }

  const handleZoomIn = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    doZoom(true)
  }

  const handleZoomOut = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
      e.preventDefault()
    }
    doZoom(false)
  }

  const handleCloseFull = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setSelectedIndex(null)
    setTransform({ x: 0, y: 0, scale: 1 })
  }

  const getDirectUrl = (url: string) => {
    if (url.includes('storage.cloud.google.com')) {
      return url.replace('storage.cloud.google.com', 'storage.googleapis.com')
    }
    return url
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 md:p-8"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-5xl max-h-full overflow-hidden flex flex-col rounded-2xl shadow-2xl"
          style={{ background: TC.bgCard, border: `1px solid ${TC.borderSoft}` }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 flex items-center justify-between border-b shrink-0" style={{ borderColor: TC.borderSoft, background: TC.headerBg }}>
            <div>
              <h3 className="font-bold text-lg tracking-tight" style={{ color: TC.text }}>Fotos Evidencia</h3>
              <p className="text-xs opacity-70" style={{ color: TC.textFaint }}>{images.length} foto(s) disponible(s)</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors text-gray-500 hover:text-red-500">
              <X size={20} />
            </button>
          </div>

          {/* Grid Layout */}
          <div className="flex-1 overflow-y-auto p-6" style={{ background: TC.bg }}>
            {images.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 opacity-50" style={{ color: TC.textFaint }}>
                <span className="text-4xl mb-2">📸</span>
                <p>No hay fotos disponibles</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {images.map((url, idx) => (
                  <motion.div
                    key={idx}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="relative aspect-square rounded-xl overflow-hidden cursor-pointer shadow-sm hover:shadow-lg transition-all border group"
                    style={{ borderColor: TC.borderSoft }}
                    onClick={() => setSelectedIndex(idx)}
                  >
                    {!imgErrors[idx] ? (
                      <img 
                        src={getDirectUrl(url)} 
                        alt={`Evidencia ${idx + 1}`} 
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={() => setImgErrors(prev => ({ ...prev, [idx]: true }))}
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gray-100 dark:bg-gray-800 flex flex-col items-center justify-center p-2 text-center text-[10px] text-gray-500">
                        <span className="text-xl mb-1">⚠️</span>
                        <span>Imagen no disponible</span>
                        <a 
                          href={url} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="text-blue-500 mt-2 font-bold pointer-events-auto hover:underline bg-blue-500/10 px-2 py-1 rounded" 
                          onClick={e => e.stopPropagation()}
                        >
                          Abrir Link Original
                        </a>
                      </div>
                    )}
                    
                    {!imgErrors[idx] && (
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <div className="bg-white/80 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity transform scale-50 group-hover:scale-100 backdrop-blur-sm">
                          <Maximize2 size={20} className="text-black" />
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* Full Screen View overlay */}
        <AnimatePresence>
          {selectedIndex !== null && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[210] flex items-center justify-center bg-black/95 backdrop-blur-xl"
              onClick={() => handleCloseFull()}
            >
              {/* Controls */}
              <div className="absolute top-4 right-4 flex items-center gap-3 z-[220]">
                <div className="flex items-center gap-1 bg-white/10 backdrop-blur-md rounded-full p-1 border border-white/20">
                  <button onClick={handleZoomOut} className="p-2 rounded-full text-white hover:bg-white/20 transition-colors">
                    <ZoomOut size={18} />
                  </button>
                  <span className="text-white text-xs font-mono w-12 text-center">{Math.round(transform.scale * 100)}%</span>
                  <button onClick={handleZoomIn} className="p-2 rounded-full text-white hover:bg-white/20 transition-colors">
                    <ZoomIn size={18} />
                  </button>
                </div>
                <button onClick={() => handleCloseFull()} className="p-2 bg-white/10 hover:bg-red-500/80 backdrop-blur-md text-white rounded-full transition-colors border border-white/20">
                  <X size={24} />
                </button>
              </div>

              {/* Numbering */}
              <div className="absolute top-6 left-6 z-[220] bg-black/50 text-white px-3 py-1 rounded-full text-xs font-bold border border-white/20 backdrop-blur-sm tracking-widest">
                {selectedIndex + 1} / {images.length}
              </div>

              <div 
                className={`w-full h-full flex items-center justify-center overflow-hidden p-4 select-none ${transform.scale > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
                onClick={(e) => e.stopPropagation()}
                onWheel={(e) => {
                  e.stopPropagation()
                  const rect = e.currentTarget.getBoundingClientRect()
                  const mouseX = e.clientX - rect.left - rect.width / 2
                  const mouseY = e.clientY - rect.top - rect.height / 2
                  doZoom(e.deltaY < 0, mouseX, mouseY)
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onContextMenu={(e) => {
                  e.preventDefault()
                }}
              >
                {!imgErrors[selectedIndex] ? (
                  <motion.img
                    ref={imgRef as any}
                    key={images[selectedIndex]}
                    src={getDirectUrl(images[selectedIndex])}
                    alt={`FullScreen Evidencia ${selectedIndex + 1}`}
                    initial={{ opacity: 0, scale: 0.8, x: 0, y: 0 }}
                    animate={{ opacity: 1, scale: transform.scale, x: transform.x, y: transform.y }}
                    transition={isDragging ? { duration: 0 } : { type: "spring", damping: 30, stiffness: 350 }}
                    className="max-w-none relative z-[215] shadow-2xl rounded-sm pointer-events-none"
                    style={{ 
                       maxHeight: transform.scale > 1 ? 'none' : '90vh',
                       maxWidth: transform.scale > 1 ? 'none' : '90vw'
                    }}
                    onError={() => setImgErrors(prev => ({ ...prev, [selectedIndex]: true }))}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center bg-gray-900/80 p-8 rounded-2xl border border-white/10 z-[215]">
                    <span className="text-4xl mb-4">⚠️</span>
                    <h3 className="text-white font-bold text-lg mb-2">No se pudo cargar la imagen</h3>
                    <p className="text-gray-400 text-sm mb-6 max-w-sm text-center">El enlace puede estar roto, requerir autenticación o ser un documento en vez de una imagen.</p>
                    <a 
                      href={images[selectedIndex]} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded-lg transition-colors pointer-events-auto"
                      onClick={e => e.stopPropagation()}
                    >
                      Abrir enlace en nueva pestaña
                    </a>
                  </div>
                )}
              </div>

              {/* Navigation arrows (if more than 1 image) */}
              {images.length > 1 && (
                <>
                  <button 
                    className="absolute left-6 top-1/2 -translate-y-1/2 p-4 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md z-[220] transition-colors border border-white/20"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedIndex(s => (s! - 1 + images.length) % images.length)
                      setTransform({ x: 0, y: 0, scale: 1 })
                    }}
                  >
                    ◀
                  </button>
                  <button 
                    className="absolute right-6 top-1/2 -translate-y-1/2 p-4 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md z-[220] transition-colors border border-white/20"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedIndex(s => (s! + 1) % images.length)
                      setTransform({ x: 0, y: 0, scale: 1 })
                    }}
                  >
                    ▶
                  </button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  )
}
