/** Label for the platform's primary shortcut modifier, for showing shortcuts. */
export const MOD_KEY = navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'

/** Label for the key that is Option on a Mac and Alt elsewhere. */
export const ALT_KEY = navigator.platform.includes('Mac') ? '⌥' : 'Alt'
