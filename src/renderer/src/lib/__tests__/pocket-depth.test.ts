import { describe, it, expect } from 'vitest'
import { withPocketDepth } from '../pocket-depth'

describe('withPocketDepth', () => {
  it('sets a depth and keeps everything else', () => {
    expect(withPocketDepth({ name: 'Slot', pocket: { clearance: 0.4, depth: 3 } }, 7.5)).toEqual({
      name: 'Slot',
      pocket: { clearance: 0.4, depth: 7.5 }
    })
  })

  it('drops the depth for a pocket as deep as its bin allows', () => {
    expect(withPocketDepth({ pocket: { clearance: 0.4, depth: 3 } }, null)).toEqual({
      pocket: { clearance: 0.4 }
    })
  })

  it('gives a shape with no pocket settings the usual clearance', () => {
    expect(withPocketDepth(undefined, 5)).toEqual({ pocket: { clearance: 0.25, depth: 5 } })
    expect(withPocketDepth({ name: 'Slot' }, null)).toEqual({
      name: 'Slot',
      pocket: { clearance: 0.25 }
    })
  })
})
