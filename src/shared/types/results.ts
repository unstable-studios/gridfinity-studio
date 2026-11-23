/**
 * Why an operation did not succeed, when it is not a plain failure.
 * - `cancelled`: the person dismissed the file dialog. Not an error.
 * - `invalid`: the project data failed validation, on open (the file is not a
 *   valid project) or on save (the project in memory is inconsistent).
 */
export type FailureReason = 'cancelled' | 'invalid'

/** Result of an IPC file operation. `error` carries the underlying detail. */
export interface OperationResult<T = void> {
  success: boolean
  data?: T
  error?: string
  reason?: FailureReason
}
