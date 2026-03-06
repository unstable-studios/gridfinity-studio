// Stub for Node's "module" builtin — manifold-3d imports it conditionally
// (guarded by ENVIRONMENT_IS_NODE) so this is never actually called in the renderer.
export function createRequire(): never {
  throw new Error('createRequire is not available in the renderer process')
}
