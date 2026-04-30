/**
 * Browser fallback for file save: creates a Blob, attaches a temporary
 * `<a download>` element to the body, clicks it programmatically, then
 * cleans up. The user gets a file in their default Downloads folder
 * (or wherever the browser is configured to put them).
 *
 * Used when running in a plain browser (e.g. Vite dev tab without
 * Electron) — the Electron path uses the native save dialog instead.
 */
export function downloadBlob(data: ArrayBuffer | Blob, filename: string, mimeType?: string): void {
  const blob =
    data instanceof Blob ? data : new Blob([data], { type: mimeType ?? 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Revoke on next tick so the browser has time to start the download
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
