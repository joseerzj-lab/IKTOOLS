import { useState, useEffect, useRef } from 'react'
import { normK, borderToBorderDistKm } from '../lib/geoUtils'

declare global {
  interface Window {
    RM_COMUNAS_DATA?: Record<string, { c: [number, number]; p: [number, number][]; n?: string }>
  }
}

const BORDER_ADJ_KM = 1.5

function buildAdjacencyMap(): Record<string, Set<string>> {
  const data = window.RM_COMUNAS_DATA || {}
  const adj: Record<string, Set<string>> = {}
  const keys = Object.keys(data)
  for (const k of keys) adj[k] = new Set()
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      if (borderToBorderDistKm(keys[i], keys[j]) <= BORDER_ADJ_KM) {
        adj[keys[i]].add(keys[j])
        adj[keys[j]].add(keys[i])
      }
    }
  }
  return adj
}

export function useComunas() {
  const [ready, setReady] = useState(
    () => !!(window.RM_COMUNAS_DATA && Object.keys(window.RM_COMUNAS_DATA).length)
  )
  const adjRef = useRef<Record<string, Set<string>> | null>(null)

  useEffect(() => {
    if (ready) return
    // Intenta hasta 20 veces con intervalo de 250ms
    let attempts = 0
    const id = setInterval(() => {
      attempts++
      if (window.RM_COMUNAS_DATA && Object.keys(window.RM_COMUNAS_DATA).length) {
        clearInterval(id)
        setReady(true)
      } else if (attempts >= 20) {
        clearInterval(id)
      }
    }, 250)
    return () => clearInterval(id)
  }, [ready])

  function getAdjMap(): Record<string, Set<string>> {
    if (!adjRef.current) adjRef.current = buildAdjacencyMap()
    return adjRef.current
  }

  // Expose normK so callers don't need to import separately
  return { ready, getAdjMap, normK }
}
