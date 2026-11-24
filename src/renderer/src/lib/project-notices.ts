/**
 * Notices for project file operations. Called from the project store, so the
 * outcome of a save, open or export is always shown, whichever control
 * started it. Rendered by the <Toaster /> in App.
 */
import { toast } from '@unstable-studios/ui'
import type { FailureReason } from '../../../shared/types/results'
import { describeFileError } from './file-errors'

/**
 * Failures stay until dismissed; they may need reading twice. Each kind has
 * one id, so retrying a failing action updates its notice instead of
 * stacking copies.
 */
function untilDismissed(id: string): { id: string; duration: number } {
  return { id, duration: Infinity }
}

/**
 * The first problem in a validation report, to end a notice with. The whole report goes to
 * the console for whoever looks into it.
 */
function firstProblem(detail: string | undefined): string {
  if (!detail) return ''
  console.warn(detail)
  const first = detail.split('\n').find((line) => line.trimStart().startsWith('\u2022'))
  return first ? ` Details: ${first.replace(/^\s*\u2022\s*/, '')}` : ''
}

export function notifySaveFailed(
  reason: FailureReason | undefined,
  detail: string | undefined
): void {
  toast.error('Couldn’t save the project', {
    description:
      reason === 'invalid'
        ? `Something in it isn’t valid. Undo your last change, then save again.${firstProblem(detail)}`
        : describeFileError(detail),
    ...untilDismissed('save-failed')
  })
}

export function notifyOpenFailed(
  reason: FailureReason | undefined,
  detail: string | undefined
): void {
  const description =
    reason === 'too-new'
      ? 'It was made with a newer version of Gridfinity Studio. Update the app, then open it again.'
      : reason === 'too-old'
        ? 'It was made with an early version of Gridfinity Studio and can’t be opened.'
        : reason === 'invalid'
          ? `It isn’t a Gridfinity Studio project, or it is damaged.${firstProblem(detail)}`
          : describeFileError(detail)
  toast.error('Couldn’t open that file', { description, ...untilDismissed('open-failed') })
}

/** `written` is how far an export of several files got, such as "2 of 5". */
export function notifyExportFailed(detail: string | undefined, written?: string): void {
  toast.error('Couldn’t export', {
    description: (written ? `Wrote ${written} files. ` : '') + describeFileError(detail),
    ...untilDismissed('export-failed')
  })
}

/** `what` is a file name, or a count and folder such as "3 files to Parts". */
export function notifyExported(what: string): void {
  toast.success(`Exported ${what}`)
}

/** A bin could not be resized because another bin is where it would grow. */
export function notifyResizeBlocked(): void {
  toast.error('Not enough room to resize', {
    description: 'Another bin is in the way. Move one of them, then try again.',
    id: 'resize-blocked'
  })
}
