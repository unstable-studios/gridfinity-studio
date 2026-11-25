import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { importedPackages } from './imported-packages'

/**
 * The open-source packages the app is built with, for the About dialog: every package the
 * source imports, Electron, and everything those depend on, each with its license text.
 * Collected when the app is built, so the list cannot fall behind the lockfile.
 */

export interface ThirdPartyLicense {
  name: string
  version: string
  /** The license as the package names it, such as "MIT". */
  license: string
  /** The package's license file, or an empty string if it ships none. */
  text: string
}

const OWN_SCOPE = '@unstable-studios/'

/**
 * In the app without being imported by name: Electron runs it, and Tailwind's base styles
 * arrive through the UI package's stylesheet.
 */
const NOT_IMPORTED = ['electron', 'tailwindcss']

interface PackageJson {
  name?: string
  version?: string
  license?: string | { type?: string }
  licenses?: Array<{ type?: string }>
  dependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
}

/** Where `name` is installed, as seen from a package in `fromDir`. */
function packageDir(name: string, fromDir: string): string | null {
  for (let dir = fromDir; ; dir = dirname(dir)) {
    const candidate = join(dir, 'node_modules', name)
    if (existsSync(join(candidate, 'package.json'))) return candidate
    if (dirname(dir) === dir) return null
  }
}

function licenseName(pkg: PackageJson): string {
  if (typeof pkg.license === 'string') return pkg.license
  if (pkg.license?.type) return pkg.license.type
  const listed = (pkg.licenses ?? []).flatMap((entry) => (entry.type ? [entry.type] : []))
  // Some packages name no license and only ship the file.
  return listed.join(' or ')
}

function licenseText(dir: string): string {
  const file = readdirSync(dir)
    .sort()
    .find((name) => /^(licen[sc]e|copying)(\.|-|$)/i.test(name))
  return file ? readFileSync(join(dir, file), 'utf8').trim() : ''
}

/** `names` and everything they depend on, installed under `root`. Sorted by name. */
export function collectLicenses(root: string, names: string[]): ThirdPartyLicense[] {
  const found = new Map<string, ThirdPartyLicense | null>()
  const visit = (name: string, fromDir: string, required: boolean): void => {
    const dir = packageDir(name, fromDir)
    if (!dir) {
      if (required) throw new Error(`${name} is not installed, so its license cannot be listed`)
      return
    }
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as PackageJson
    const key = `${pkg.name ?? name}@${pkg.version ?? ''}`
    if (found.has(key)) return
    // Unstable Studios' own packages are not third-party, but what they depend on is.
    found.set(
      key,
      (pkg.name ?? name).startsWith(OWN_SCOPE)
        ? null
        : {
            name: pkg.name ?? name,
            version: pkg.version ?? '',
            license: licenseName(pkg),
            text: licenseText(dir)
          }
    )
    for (const dependency of Object.keys(pkg.dependencies ?? {})) visit(dependency, dir, true)
    // An optional dependency for another platform is not installed.
    for (const dependency of Object.keys(pkg.optionalDependencies ?? {})) {
      visit(dependency, dir, false)
    }
  }
  for (const name of names) visit(name, root, true)
  return [...found.values()]
    .filter((entry) => entry !== null)
    .sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version))
}

/** The fonts in `src/renderer/public/fonts`, which are files in the repo, not packages. */
function fontLicenses(root: string): ThirdPartyLicense[] {
  const dir = join(root, 'src/renderer/public/fonts')
  return [
    { name: 'Inter', file: 'Inter-LICENSE.txt' },
    { name: 'JetBrains Mono', file: 'JetBrainsMono-LICENSE.txt' }
  ].map(({ name, file }) => ({
    name,
    version: '',
    license: 'OFL-1.1',
    text: readFileSync(join(dir, file), 'utf8').trim()
  }))
}

/** Everything the app at `root` is built with. */
export function appLicenses(root: string): ThirdPartyLicense[] {
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  const declared = new Set(Object.keys({ ...manifest.dependencies, ...manifest.devDependencies }))
  // Imports are found by pattern, which also matches a quoted word after "from" in a comment.
  // Only a package the project declares can be a real import.
  const imported = importedPackages(root, ['src']).filter((name) => declared.has(name))
  const packages = collectLicenses(root, [...NOT_IMPORTED, ...imported])
  return [...packages, ...fontLicenses(root)].sort((a, b) => a.name.localeCompare(b.name))
}
