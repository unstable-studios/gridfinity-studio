import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { importedPackages } from './imported-packages'

/**
 * The open-source packages the app is built with, for the About dialog: every package the
 * source imports, Electron, and everything those depend on, each with its license text.
 * Collected when the app is built, so the list cannot fall behind the lockfile.
 *
 * It follows what packages declare, not what the bundler keeps, so it can name a package
 * whose code was dropped from the app. It errs that way on purpose: a notice too many costs
 * nothing, and a missing one breaks a license.
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
  author?: string | { name?: string }
  dependencies?: Record<string, string>
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

const MIT_TERMS = `Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`

/** The notice the Apache License asks to be applied to a work, for a package without a file. */
const APACHE_NOTICE = `Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.`

/**
 * The package's license file. A package that names MIT or Apache-2.0 but ships no file gets
 * that license's standard wording, which is the same for everyone, under its author's name.
 */
function licenseText(dir: string, pkg: PackageJson): string {
  const file = readdirSync(dir)
    .sort()
    .find((name) => /^(licen[sc]e|copying)(\.|-|$)/i.test(name))
  if (file) return readFileSync(join(dir, file), 'utf8').trim()
  const author = typeof pkg.author === 'string' ? pkg.author : pkg.author?.name
  const holder = author?.replace(/\s*[<(].*$/, '') || `the ${pkg.name} authors`
  switch (licenseName(pkg)) {
    case 'MIT':
      return `MIT License\n\nCopyright (c) ${holder}\n\n${MIT_TERMS}`
    case 'Apache-2.0':
      return `Copyright (c) ${holder}\n\n${APACHE_NOTICE}`
    default:
      return ''
  }
}

/** `names` and everything they depend on, installed under `root`. Sorted by name. */
export function collectLicenses(root: string, names: string[]): ThirdPartyLicense[] {
  const found = new Map<string, ThirdPartyLicense | null>()
  const visit = (name: string, fromDir: string): void => {
    // Type declarations are erased by the build.
    if (name.startsWith('@types/')) return
    const dir = packageDir(name, fromDir)
    if (!dir) throw new Error(`${name} is not installed, so its license cannot be listed`)
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
            text: licenseText(dir, pkg)
          }
    )
    // Electron's dependencies only download it at install time. Optional dependencies are
    // left out: they differ by platform, and none is code the app runs.
    if (pkg.name === 'electron') return
    for (const dependency of Object.keys(pkg.dependencies ?? {})) visit(dependency, dir)
  }
  for (const name of names) visit(name, root)
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
