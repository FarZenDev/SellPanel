import { useSyncExternalStore } from 'react'

type Theme = 'light' | 'dark'
const listeners = new Set<() => void>()

function current(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

export function setTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  try {
    localStorage.setItem('sp-theme', theme)
  } catch {
    /* stockage indisponible */
  }
  listeners.forEach((l) => l())
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const theme = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    current,
    () => 'light' as Theme,
  )
  return [theme, setTheme]
}

/** Couleurs de séries des graphiques (palette validée daltonisme, variante claire / sombre). */
export function useChartColors() {
  const [theme] = useTheme()
  return theme === 'dark'
    ? { s1: '#3987e5', s2: '#d95926', grid: '#1f1f25', axis: '#8a8a96', surface: '#111114', negative: '#ff6b81' }
    : { s1: '#2a78d6', s2: '#eb6834', grid: '#ececf0', axis: '#6e6e7a', surface: '#ffffff', negative: '#d42a45' }
}
