import { execSync } from 'node:child_process'
import { readFileSync, copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import svgr from 'vite-plugin-svgr'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version?: string
}

function getAppVersion(): string {
  const baseVersion = pkg.version ? `v${pkg.version}` : 'v0.0.0'
  let sha = ''
  let dirty = false

  try {
    sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
    try {
      execSync('git diff --quiet', { stdio: 'ignore' })
    } catch {
      dirty = true
    }
  } catch {
    // fall back to package version only when git metadata is unavailable
  }

  if (!sha) return baseVersion
  return `${baseVersion}+${sha}${dirty ? '-dev' : ''}`
}

const appVersion = getAppVersion()

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    define: {
      __APP_VERSION__: JSON.stringify(appVersion)
    },
    publicDir: resolve('src/renderer/public'),
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@': resolve(__dirname, 'src/renderer/src')
      }
    },
    worker: {
      format: 'es'
    },
    plugins: [
      react(),
      svgr(),
      tailwindcss(),
      {
        name: 'copy-manifold-wasm',
        buildStart() {
          const src = resolve(__dirname, 'node_modules/manifold-3d/manifold.wasm')
          const dest = resolve(__dirname, 'src/renderer/public/manifold.wasm')
          if (existsSync(src)) {
            copyFileSync(src, dest)
          }
        }
      }
    ]
  }
})
