import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { importedPackages } from '../../../tools/imported-packages'
import { appLicenses, collectLicenses } from '../../../tools/third-party-licenses'

const root = resolve(__dirname, '../../..')

describe('third-party licenses', () => {
  const licenses = appLicenses(root)
  const names = licenses.map((entry) => entry.name)

  it('lists the packages the source imports, and Electron', () => {
    for (const name of ['electron', 'react', 'three', 'konva', 'manifold-3d', 'electron-updater']) {
      expect(names, name).toContain(name)
    }
  })

  it('lists no build or test tools', () => {
    for (const name of ['vitest', 'eslint', 'typescript', 'electron-builder']) {
      expect(names, name).not.toContain(name)
    }
  })

  it('lists packages that come in through another package', () => {
    // react-dom depends on scheduler; nothing in src imports it.
    expect(importedPackages(root, ['src'])).not.toContain('scheduler')
    expect(names).toContain('scheduler')
  })

  it('finds packages imported by stylesheets', () => {
    expect(importedPackages(root, ['src'])).toContain('tw-animate-css')
    expect(names).toContain('tw-animate-css')
  })

  it('lists the bundled fonts', () => {
    expect(names).toContain('Inter')
    expect(names).toContain('JetBrains Mono')
  })

  it('has a license name or a license text for every entry', () => {
    const bare = licenses.filter((entry) => !entry.license && !entry.text)
    expect(bare.map((entry) => entry.name)).toEqual([])
  })

  it('has the terms of every license that asks for them to be passed on', () => {
    const missing = licenses.filter(
      (entry) => /MIT|ISC|BSD|Apache|OFL|BlueOak/.test(entry.license) && !entry.text
    )
    expect(missing.map((entry) => entry.name)).toEqual([])
  })

  it('gives an MIT package with no license file the MIT terms under its author', () => {
    const fiber = licenses.find((entry) => entry.name === '@react-three/fiber')
    expect(fiber?.text).toMatch(/^MIT License\n\nCopyright \(c\) \S/)
    expect(fiber?.text).toContain('Permission is hereby granted')
  })

  it('leaves out type declarations, optional packages and what only installs Electron', () => {
    expect(names.filter((name) => name.startsWith('@types/'))).toEqual([])
    expect(names.filter((name) => name.startsWith('@img/sharp-'))).toEqual([])
    expect(names).not.toContain('@electron/get')
  })

  it('leaves out Unstable Studios packages but lists what they depend on', () => {
    expect(names.filter((name) => name.startsWith('@unstable-studios/'))).toEqual([])
    expect(names).toContain('tailwindcss')
  })

  it('has the license text of the packages that ship one', () => {
    const react = licenses.find((entry) => entry.name === 'react')
    expect(react?.license).toBe('MIT')
    expect(react?.text).toContain('Permission is hereby granted')
  })

  it('is sorted by name with no entry twice', () => {
    const keys = licenses.map((entry) => `${entry.name}@${entry.version}`)
    expect(new Set(keys).size).toBe(keys.length)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
  })

  it('refuses to leave out a package that is not installed', () => {
    expect(() => collectLicenses(root, ['not-a-real-package-name'])).toThrow(/not installed/)
  })
})
