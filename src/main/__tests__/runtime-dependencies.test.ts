import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { importedPackages } from '../../../tools/imported-packages'

/**
 * electron-builder packs every package under `dependencies` into the installers, and
 * electron-vite leaves exactly those packages out of the main and preload bundles. So
 * `dependencies` has to be the packages the main and preload processes import, and nothing
 * else. An extra one is dead weight: the renderer's libraries are already bundled into
 * `out/renderer`. A missing one is bundled into the main script instead, which breaks a
 * package that has to load from `node_modules` (a native addon, or one that reads its own
 * files).
 */

const root = resolve(__dirname, '../../..')

describe('runtime dependencies', () => {
  it('are exactly the packages the main and preload processes import', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>
    }

    expect(Object.keys(pkg.dependencies).sort()).toEqual(
      importedPackages(root, ['src/main', 'src/preload', 'src/shared'])
    )
  })
})
