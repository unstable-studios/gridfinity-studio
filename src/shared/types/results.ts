/**
 * Why an operation did not succeed, when it is not a plain failure.
 * - `cancelled`: the person dismissed the file dialog. Not an error.
 * - `invalid`: the file was read but is not a valid project.
 */
export type FailureReason = 'cancelled' | 'invalid'

/** Result of an IPC file operation. `error` carries the underlying detail. */
export interface OperationResult<T = void> {
  success: boolean
  data?: T
  error?: string
  reason?: FailureReason
}
