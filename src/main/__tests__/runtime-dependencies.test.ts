import { readFileSync, readdirSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * electron-builder packs every package under `dependencies` into the installers, and
 * electron-vite leaves exactly those packages out of the main and preload bundles. So
 * `dependencies` has to be the packages the main and preload processes import, and nothing
 * else: a missing one breaks the installed app at startup, and an extra one is dead weight
 * (the renderer's libraries are already bundled into `out/renderer`).
 */

const root = resolve(__dirname, '../../..')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(path)
    return /\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts') ? [path] : []
  })
}

/** `electron-log/main` -> `electron-log`, `@scope/name/sub` -> `@scope/name`. */
function packageName(specifier: string): string {
  const parts = specifier.split('/')
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
}

function importedPackages(dirs: string[]): string[] {
  const found = new Set<string>()
  const importPattern = /(?:from\s+|import\s*\(\s*|require\s*\(\s*|^\s*import\s+)['"]([^'"]+)['"]/gm
  for (const file of dirs.flatMap((dir) => sourceFiles(join(root, dir)))) {
    for (const match of readFileSync(file, 'utf8').matchAll(importPattern)) {
      const specifier = match[1]
      if (specifier.startsWith('.') || specifier.startsWith('node:')) continue
      const name = packageName(specifier)
      if (name === 'electron' || builtinModules.includes(name)) continue
      found.add(name)
    }
  }
  return [...found].sort()
}

describe('runtime dependencies', () => {
  it('are exactly the packages the main and preload processes import', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>
    }

    expect(Object.keys(pkg.dependencies).sort()).toEqual(
      importedPackages(['src/main', 'src/preload', 'src/shared'])
    )
  })
})
