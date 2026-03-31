import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

// ── Types ──────────────────────────────────────────────────────
export type Theme = 'light' | 'dark' | 'landscape'

interface ThemeCtx {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggle: () => void
  isDark: boolean
  isExporting: boolean
  setIsExporting: (v: boolean) => void
}

// ── Context ────────────────────────────────────────────────────
const ThemeContext = createContext<ThemeCtx>({
  theme: 'dark',
  setTheme: () => {},
  toggle: () => {},
  isDark: true,
  isExporting: false,
  setIsExporting: () => {}
})

// ── Provider ───────────────────────────────────────────────────
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      return (localStorage.getItem('ar-theme') as Theme) ?? 'dark'
    } catch {
      return 'dark'
    }
  })

  const [isExporting, setIsExporting] = useState(false)

  const setTheme = (t: Theme) => {
    setThemeState(t)
    localStorage.setItem('ar-theme', t)
  }

  // Persist class to <html>
  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('dark', 'light', 'landscape', 'crimson')
    root.classList.add(theme)
  }, [theme])

  const toggle = useCallback(() => {
    setThemeState(t => {
      const next = t === 'light' ? 'dark' : 'light'
      localStorage.setItem('ar-theme', next)
      return next
    })
  }, [])

  return (
    <ThemeContext.Provider value={{ 
      theme: isExporting ? 'light' : theme, 
      setTheme, 
      toggle, 
      isDark: isExporting ? false : (theme === 'dark' || theme === 'landscape'),
      isExporting,
      setIsExporting
    }}>
      {children}
    </ThemeContext.Provider>
  )
}

// ── Hook ───────────────────────────────────────────────────────
export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}

// ── Theme-aware color tokens ───────────────────────────────────
export function getThemeColors(theme: Theme) {
  switch (theme) {
    case 'light':
      return {
        bg: '#f6f8fa',
        bgCard: '#ffffff',
        bgCardAlt: '#f6f8fa',
        bgHover: 'rgba(0,0,0,0.04)',
        bgActive: 'rgba(0,0,0,0.06)',
        text: '#1f2328',
        textSub: '#3d444d',
        textMuted: '#636c76',
        textFaint: '#818b98',
        textDisabled: '#adb5bd',
        border: 'rgba(0,0,0,0.09)',
        borderSoft: 'rgba(0,0,0,0.05)',
        headerBg: 'rgba(255,255,255,0.97)',
      }
    case 'landscape':
      return {
        bg: 'transparent',
        bgCard: 'rgba(255, 255, 255, 0.12)',
        bgCardAlt: 'rgba(255, 255, 255, 0.08)',
        bgHover: 'rgba(255, 255, 255, 0.15)',
        bgActive: 'rgba(255, 255, 255, 0.2)',
        text: '#ffffff',
        textSub: 'rgba(255, 255, 255, 0.9)',
        textMuted: 'rgba(255, 255, 255, 0.7)',
        textFaint: 'rgba(255, 255, 255, 0.5)',
        textDisabled: 'rgba(255, 255, 255, 0.3)',
        border: 'rgba(255, 255, 255, 0.25)',
        borderSoft: 'rgba(255, 255, 255, 0.15)',
        headerBg: 'rgba(0, 0, 0, 0.25)',
      }
    default: // dark
      return {
        bg: '#0d1117',
        bgCard: '#161b22',
        bgCardAlt: '#0d1117',
        bgHover: 'rgba(255,255,255,0.04)',
        bgActive: 'rgba(255,255,255,0.07)',
        text: '#e6edf3',
        textSub: '#c9d1d9',
        textMuted: '#8b949e',
        textFaint: '#6e7681',
        textDisabled: '#484f58',
        border: 'rgba(255,255,255,0.07)',
        borderSoft: 'rgba(255,255,255,0.04)',
        headerBg: 'rgba(13, 17, 23, 0.98)',
      }
  }
}
