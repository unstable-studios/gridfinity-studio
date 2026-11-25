/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

declare const __APP_VERSION__: string

/** Built by `tools/third-party-licenses.ts` when the app is built. */
declare module 'virtual:third-party-licenses' {
  const licenses: Array<{ name: string; version: string; license: string; text: string }>
  export default licenses
}
