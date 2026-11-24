import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'

export interface SavedShape {
  id: string
  type: string
  x: number
  y: number
  width?: number
  height?: number
  radiusX?: number
  radiusY?: number
  groupId: string | null
  metadata?: { name?: string; pocket?: { depth?: number | null; clearance?: number } }
}

export interface SavedGroup {
  id: string
  x: number
  y: number
  width: number
  height: number
  childIds: string[]
}

export interface SavedProject {
  layoutSnapshot: { shapes: SavedShape[]; groups: SavedGroup[] }
}

export interface Point {
  x: number
  y: number
}

/** Maps world coordinates (mm) to window coordinates (px). */
export type WorldToScreen = (world: Point) => Point

export class StudioApp {
  readonly errors: string[] = []

  private constructor(
    readonly electronApp: ElectronApplication,
    readonly page: Page,
    /** Scratch directory for this run: user data, saved projects, exports. */
    readonly dir: string
  ) {}

  /** Launch the built app with an isolated user-data directory. */
  static async launch(): Promise<StudioApp> {
    const dir = await mkdtemp(join(tmpdir(), 'gfstudio-e2e-'))
    const electronApp = await electron.launch({
      args: ['.', `--user-data-dir=${join(dir, 'user-data')}`]
    })
    const page = await electronApp.firstWindow()
    const app = new StudioApp(electronApp, page, dir)
    page.on('pageerror', (err) => app.errors.push(`pageerror: ${err.message}`))
    page.on('console', (msg) => {
      if (msg.type() === 'error') app.errors.push(`console: ${msg.text()}`)
    })
    await page.waitForLoadState('domcontentloaded')
    return app
  }

  /** Close the app, dropping any unsaved work. Safe to call when it has already quit. */
  async close(): Promise<void> {
    try {
      await this.answerUnsavedPrompt('discard')
    } catch {
      // The app is already gone.
      return
    }
    await this.electronApp.close()
  }

  /**
   * Make the "Save your changes?" question answer itself, and count how often it is asked.
   * Without this a test that closes a window with unsaved work would wait on a native dialog.
   */
  async answerUnsavedPrompt(answer: 'save' | 'discard' | 'cancel'): Promise<void> {
    const response = { save: 0, discard: 1, cancel: 2 }[answer]
    await this.electronApp.evaluate(({ dialog }, choice) => {
      const counter = globalThis as { unsavedPrompts?: number }
      dialog.showMessageBox = () => {
        counter.unsavedPrompts = (counter.unsavedPrompts ?? 0) + 1
        return Promise.resolve({ response: choice, checkboxChecked: false })
      }
    }, response)
  }

  /** How many times the "Save your changes?" question has been asked. */
  async unsavedPromptCount(): Promise<number> {
    return this.electronApp.evaluate(
      () => (globalThis as { unsavedPrompts?: number }).unsavedPrompts ?? 0
    )
  }

  /** Ask the window to close, as the close button does. */
  async requestWindowClose(): Promise<void> {
    await this.electronApp.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.close()
    })
  }

  /** Whether the app still has a window. */
  async hasWindow(): Promise<boolean> {
    try {
      return await this.electronApp.evaluate(
        ({ BrowserWindow }) => BrowserWindow.getAllWindows().length > 0
      )
    } catch {
      return false
    }
  }

  /** Make the next native save dialog return `filePath`. */
  async stubSaveDialog(filePath: string): Promise<void> {
    await this.electronApp.evaluate(({ dialog }, target) => {
      // Forget the last dialog, so a test can't read the name offered by an earlier one.
      ;(globalThis as { lastSaveDefaultPath?: string }).lastSaveDefaultPath = undefined
      dialog.showSaveDialog = (...args: unknown[]) => {
        const options = args[args.length - 1] as { defaultPath?: string } | undefined
        ;(globalThis as { lastSaveDefaultPath?: string }).lastSaveDefaultPath = options?.defaultPath
        return Promise.resolve({ canceled: false, filePath: target })
      }
    }, filePath)
  }

  /** The file name the app offered in the last stubbed save dialog. */
  async lastSaveDialogDefault(): Promise<string | undefined> {
    return this.electronApp.evaluate(
      () => (globalThis as { lastSaveDefaultPath?: string }).lastSaveDefaultPath
    )
  }

  /** Make the next native open dialog return `filePath`. */
  async stubOpenDialog(filePath: string): Promise<void> {
    await this.electronApp.evaluate(({ dialog }, target) => {
      dialog.showOpenDialog = () => Promise.resolve({ canceled: false, filePaths: [target] })
    }, filePath)
  }

  /** Make the next native save and open dialogs behave as if dismissed. */
  async stubDialogsCancelled(): Promise<void> {
    await this.electronApp.evaluate(({ dialog }) => {
      dialog.showSaveDialog = () => Promise.resolve({ canceled: true, filePath: '' })
      dialog.showOpenDialog = () => Promise.resolve({ canceled: true, filePaths: [] })
    })
  }

  async menu(menuName: string, item: string | RegExp): Promise<void> {
    await this.page.getByRole('menuitem', { name: menuName, exact: true }).click()
    await this.page.getByRole('menuitem', { name: item }).click()
  }

  async selectTool(name: 'Select' | 'Rectangle' | 'Ellipse' | 'Polygon'): Promise<void> {
    await this.page.getByRole('radio', { name, exact: true }).click()
  }

  /** Press-drag-release with intermediate moves, as a person would. */
  async drag(from: Point, to: Point): Promise<void> {
    const { mouse } = this.page
    await mouse.move(from.x, from.y)
    await mouse.down()
    await mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 })
    await mouse.move(to.x, to.y, { steps: 4 })
    await mouse.up()
  }

  /**
   * Drag with modifier keys held. The keys go down after the drag has started and come up
   * after it ends, as when a person decides halfway through.
   */
  async dragHolding(keys: Array<'Shift' | 'Alt'>, from: Point, to: Point): Promise<void> {
    const { mouse, keyboard } = this.page
    await mouse.move(from.x, from.y)
    await mouse.down()
    await mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 })
    for (const key of keys) await keyboard.down(key)
    await mouse.move(to.x, to.y, { steps: 4 })
    await mouse.up()
    for (const key of keys) await keyboard.up(key)
  }

  async expectBinCount(count: number): Promise<void> {
    await expect(this.page.getByText(`Bins (${count})`, { exact: true })).toBeVisible()
  }

  async expectShapeCount(count: number): Promise<void> {
    if (count === 0) {
      await expect(this.page.getByText(/^Shapes \(\d+\)$/)).toHaveCount(0)
    } else {
      await expect(this.page.getByText(`Shapes (${count})`, { exact: true })).toBeVisible()
    }
  }

  /** Save the project to `filePath` and return what was written. */
  async save(filePath: string): Promise<SavedProject> {
    await this.stubSaveDialog(filePath)
    await this.menu('File', /^Save(?! as)/)
    await expect(this.page.getByText('Unsaved', { exact: true })).toHaveCount(0)
    return JSON.parse(await readFile(filePath, 'utf8')) as SavedProject
  }
}

/**
 * Derive the world→screen mapping from a rectangle that was drawn by dragging
 * between two known screen points and then saved. Rect shapes store their
 * center, so the drag's top-left corner maps to (x − width/2, y − height/2).
 */
export function mappingFromDrawnRect(
  shape: SavedShape,
  dragFrom: Point,
  dragTo: Point
): WorldToScreen {
  if (shape.type !== 'rect' || !shape.width || !shape.height) {
    throw new Error(`expected a saved rect with a size, got ${JSON.stringify(shape)}`)
  }
  const scaleX = (dragTo.x - dragFrom.x) / shape.width
  const scaleY = (dragTo.y - dragFrom.y) / shape.height
  const left = shape.x - shape.width / 2
  const top = shape.y - shape.height / 2
  return (world) => ({
    x: dragFrom.x + (world.x - left) * scaleX,
    y: dragFrom.y + (world.y - top) * scaleY
  })
}
