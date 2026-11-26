/**
 * The person's print bed, shared by Preferences, which sets it, and the bin lists, which mark
 * bins that do not fit.
 */
import { create } from 'zustand'
import { loadPrintBed, savePrintBed } from '@/lib/print-bed'
import type { PrintBed } from '@/lib/print-bed'

const usePrintBedStore = create<{ bed: PrintBed | null }>(() => ({ bed: loadPrintBed() }))

/** The print bed, or none when the person has not chosen one. */
export function usePrintBed(): PrintBed | null {
  return usePrintBedStore((state) => state.bed)
}

/** Choose the print bed, or none, and keep the choice on this computer. */
export function setPrintBed(bed: PrintBed | null): void {
  savePrintBed(bed)
  usePrintBedStore.setState({ bed })
}
