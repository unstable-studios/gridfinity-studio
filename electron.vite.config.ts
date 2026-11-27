import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import svgr from 'vite-plugin-svgr'
import type { Plugin } from 'vite'
import { appLicenses } from './tools/third-party-licenses'

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

/** `virtual:third-party-licenses`: what the app is built with, for the About dialog. */
function thirdPartyLicenses(): Plugin {
  const id = 'virtual:third-party-licenses'
  return {
    name: 'third-party-licenses',
    resolveId: (source) => (source === id ? `\0${id}` : null),
    load: (resolved) =>
      resolved === `\0${id}` ? `export default ${JSON.stringify(appLicenses(__dirname))}` : null
  }
}

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
        '@': resolve(__dirname, 'src/renderer/src'),
        // manifold-3d conditionally imports Node's "module" builtin (guarded by
        // ENVIRONMENT_IS_NODE) — stub it out so Vite/rolldown doesn't
        // externalize + warn. Both bare `module` and the `node:` prefixed
        // form are aliased because rolldown treats them as distinct specifiers.
        module: resolve(__dirname, 'src/renderer/src/lib/empty-module.ts'),
        'node:module': resolve(__dirname, 'src/renderer/src/lib/empty-module.ts')
      }
    },
    optimizeDeps: {
      include: ['manifold-3d']
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id): string | undefined {
            if (id.includes('node_modules/three/')) return 'three'
            if (id.includes('node_modules/react-dom/')) return 'react-dom'
            if (id.includes('node_modules/@react-three/')) return 'r3f'
            if (id.includes('node_modules/@radix-ui/')) return 'radix'
            return undefined
          }
        }
      }
    },
    worker: {
      format: 'es'
    },
    plugins: [react(), svgr(), tailwindcss(), thirdPartyLicenses()]
  }
})
