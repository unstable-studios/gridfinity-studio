/**
 * Why an operation did not succeed, when it is not a plain failure.
 * - `cancelled`: the person dismissed the file dialog. Not an error.
 * - `invalid`: the project data failed validation, on open (the file is not a
 *   valid project) or on save (the project in memory is inconsistent).
 * - `too-new`: the project file was written by a later version of the app.
 * - `too-old`: the project file is from before the oldest format the app reads.
 */
export type FailureReason = 'cancelled' | 'invalid' | 'too-new' | 'too-old'

/** Result of an IPC file operation. `error` carries the underlying detail. */
export interface OperationResult<T = void> {
  success: boolean
  data?: T
  error?: string
  reason?: FailureReason
}
