import { createContext, useContext, useState, useEffect, useCallback } from 'react'

// ── Types ──────────────────────────────────────────────────────
export type Theme = 'dark' | 'light'

interface ThemeCtx {
  theme: Theme
  toggle: () => void
  isDark: boolean
}

// ── Context ────────────────────────────────────────────────────
const ThemeContext = createContext<ThemeCtx>({
  theme: 'dark',
  toggle: () => {},
  isDark: true,
})

// ── Provider ───────────────────────────────────────────────────
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return (localStorage.getItem('ar-theme') as Theme) ?? 'dark'
    } catch {
      return 'dark'
    }
  })

  // Persist to localStorage and apply class to <html>
  useEffect(() => {
    try { localStorage.setItem('ar-theme', theme) } catch {}
    const root = document.documentElement
    root.classList.remove('dark', 'light')
    root.classList.add(theme)
  }, [theme])

  const toggle = useCallback(() => {
    setTheme(t => t === 'dark' ? 'light' : 'dark')
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, toggle, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  )
}

// ── Hook ───────────────────────────────────────────────────────
export function useTheme() {
  return useContext(ThemeContext)
}

// ── Theme-aware color tokens ───────────────────────────────────
// Returns the right palette based on theme.
// Only covers the tokens that actually change between dark/light.
export function getThemeColors(theme: Theme) {
  if (theme === 'light') {
    return {
      bg:           'rgb(246,248,250)',
      bgCard:       'rgba(255,255,255,0.95)',
      bgCardAlt:    'rgba(240,244,248,0.95)',
      bgHover:      'rgba(0,0,0,0.04)',
      bgActive:     'rgba(0,0,0,0.07)',
      border:       'rgba(0,0,0,0.09)',
      borderSoft:   'rgba(0,0,0,0.05)',
      headerBg:     'rgba(255,255,255,0.97)',
      text:         '#1f2328',
      textSub:      '#3d444d',
      textMuted:    '#636c76',
      textFaint:    '#818b98',
      textDisabled: '#adb5bd',
    }
  }
  // dark (default)
  return {
    bg:           'rgb(13,17,23)',
    bgCard:       'rgba(22,27,34,0.85)',
    bgCardAlt:    'rgba(16,20,26,0.9)',
    bgHover:      'rgba(255,255,255,0.04)',
    bgActive:     'rgba(255,255,255,0.07)',
    border:       'rgba(255,255,255,0.07)',
    borderSoft:   'rgba(255,255,255,0.04)',
    headerBg:     'rgba(13,17,23,0.98)',
    text:         '#e6edf3',
    textSub:      '#c9d1d9',
    textMuted:    '#8b949e',
    textFaint:    '#6e7681',
    textDisabled: '#484f58',
  }
}
