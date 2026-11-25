import { readFileSync, readdirSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { join } from 'node:path'

/**
 * The packages the source under `dirs` imports, found by pattern. Type-only imports
 * (`import type`) are erased by the build and do not count. Stylesheets count too: an
 * `@import` of a package puts its CSS in the app.
 */

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(path)
    return /\.(tsx?|css)$/.test(entry.name) && !entry.name.endsWith('.d.ts') ? [path] : []
  })
}

/** `electron-log/main` -> `electron-log`, `@scope/name/sub` -> `@scope/name`. */
function packageName(specifier: string): string {
  const parts = specifier.split('/')
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
}

const SCRIPT_IMPORT = /(?:from\s+|import\s*\(\s*|require\s*\(\s*|^\s*import\s+)['"]([^'"]+)['"]/gm
const STYLE_IMPORT = /@(?:import|plugin)\s+['"]([^'"]+)['"]/g
const PACKAGE_NAME = /^(@[a-z0-9~-][a-z0-9._~-]*\/)?[a-z0-9~-][a-z0-9._~-]*$/
const TYPE_IMPORT = /^\s*import\s+type\s[^;]*?from\s+['"][^'"]+['"]/gm

export function importedPackages(root: string, dirs: string[]): string[] {
  const found = new Set<string>()
  for (const file of dirs.flatMap((dir) => sourceFiles(join(root, dir)))) {
    const text = readFileSync(file, 'utf8')
    const matches = file.endsWith('.css')
      ? text.matchAll(STYLE_IMPORT)
      : text.replace(TYPE_IMPORT, '').matchAll(SCRIPT_IMPORT)
    for (const match of matches) {
      const specifier = match[1]
      // Relative paths, aliases into the app's own source, and virtual modules.
      if (/^[./]|^@\/|^@renderer\/|^node:|^virtual:/.test(specifier)) continue
      const name = packageName(specifier)
      // A quoted word after "from" in a comment is not an import: package names are lowercase.
      if (!PACKAGE_NAME.test(name)) continue
      if (name === 'electron' || builtinModules.includes(name)) continue
      found.add(name)
    }
  }
  return [...found].sort()
}
