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

export function notifySaveFailed(
  reason: FailureReason | undefined,
  detail: string | undefined
): void {
  toast.error('Couldn’t save the project', {
    description:
      reason === 'invalid'
        ? 'Something in it isn’t valid. Undo your last change, then save again.'
        : describeFileError(detail),
    ...untilDismissed('save-failed')
  })
}

export function notifyOpenFailed(
  reason: FailureReason | undefined,
  detail: string | undefined
): void {
  toast.error('Couldn’t open that file', {
    description:
      reason === 'invalid'
        ? 'It isn’t a Gridfinity Studio project, or it is damaged.'
        : describeFileError(detail),
    ...untilDismissed('open-failed')
  })
}

export function notifyExportFailed(detail: string | undefined): void {
  toast.error('Couldn’t export', {
    description: describeFileError(detail),
    ...untilDismissed('export-failed')
  })
}

/** `what` is a file name or a count such as "3 files". */
export function notifyExported(what: string): void {
  toast.success(`Exported ${what}`)
}
