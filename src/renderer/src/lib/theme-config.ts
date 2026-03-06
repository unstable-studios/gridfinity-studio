/**
 * Centralized theme color configuration for canvas and viewport elements.
 *
 * All hex values are stored in localStorage and editable via Preferences.
 * A refresh is required for changes to take effect in Three.js canvases.
 */

const STORAGE_KEY = 'gfstudio:themeColors'

export interface CanvasThemeColors {
  /** Layout canvas background */
  layoutBg: string
  /** Layout grid line color */
  layoutGrid: string
  /** Review canvas background */
  reviewBg: string
  /** Review floor plane color */
  reviewFloor: string
  /** Review fog color (should match reviewBg for seamless fade) */
  reviewFog: string
  /** Bin mesh color in review mode */
  meshColor: string
  /** Empty state wireframe color */
  emptyState: string
}

export interface ThemeConfig {
  dark: CanvasThemeColors
  light: CanvasThemeColors
}

export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  dark: {
    layoutBg: '#111318',
    layoutGrid: '#3a3f55',
    reviewBg: '#0a0c12',
    reviewFloor: '#0c0f17',
    reviewFog: '#0a0c12',
    meshColor: '#4f9ef8',
    emptyState: '#2a2d3a'
  },
  light: {
    layoutBg: '#e0e2e6',
    layoutGrid: '#b0b4c0',
    reviewBg: '#e8eaed',
    reviewFloor: '#d4d7dd',
    reviewFog: '#e8eaed',
    meshColor: '#3b82f6',
    emptyState: '#c8cad0'
  }
}

export function loadThemeConfig(): ThemeConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_THEME_CONFIG
    const saved = JSON.parse(raw) as Partial<ThemeConfig>
    return {
      dark: { ...DEFAULT_THEME_CONFIG.dark, ...saved.dark },
      light: { ...DEFAULT_THEME_CONFIG.light, ...saved.light }
    }
  } catch {
    return DEFAULT_THEME_CONFIG
  }
}

export function saveThemeConfig(config: ThemeConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

/**
 * Resolve the active color set based on the current theme.
 * Call once at component mount — changes require refresh.
 */
export function resolveColors(resolvedTheme: string | undefined): CanvasThemeColors {
  const config = loadThemeConfig()
  return resolvedTheme === 'light' ? config.light : config.dark
}
