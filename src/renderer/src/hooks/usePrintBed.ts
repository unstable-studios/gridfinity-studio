/**
 * The person's print bed, shared by Preferences, which sets it, and the bin lists, which mark
 * bins that do not fit.
 */
import { create } from 'zustand'
import { loadBedChoice, saveBedChoice } from '@/lib/print-bed'
import type { BedChoice, PrintBed } from '@/lib/print-bed'

const useBedChoiceStore = create<{ choice: BedChoice | null }>(() => ({
  choice: loadBedChoice()
}))

/** The print bed, or none when the person has not chosen one. */
export function usePrintBed(): PrintBed | null {
  return useBedChoiceStore((state) => state.choice?.bed ?? null)
}

/** The bed and the printer it was chosen as, or none. */
export function useBedChoice(): BedChoice | null {
  return useBedChoiceStore((state) => state.choice)
}

/** Choose the print bed, or none, and keep the choice on this computer. */
export function setBedChoice(choice: BedChoice | null): void {
  saveBedChoice(choice)
  useBedChoiceStore.setState({ choice })
}
