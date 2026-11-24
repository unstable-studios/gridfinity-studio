import { describe, expect, it } from 'vitest'
import {
  BASE_HEIGHT,
  BASE_PROFILE,
  BASE_PROFILE_HEIGHT,
  LIP_HEIGHT,
  LIP_PROFILE
} from '../gridfinity-dimensions'

describe('gridfinity dimensions', () => {
  it('give each profile the height its last step reaches', () => {
    expect(BASE_PROFILE[BASE_PROFILE.length - 1][1]).toBe(BASE_PROFILE_HEIGHT)
    expect(LIP_PROFILE[LIP_PROFILE.length - 1][1]).toBe(LIP_HEIGHT)
  })

  it('never step back down or outward along a profile', () => {
    for (const profile of [BASE_PROFILE, LIP_PROFILE]) {
      for (let step = 1; step < profile.length; step++) {
        expect(profile[step][0]).toBeGreaterThanOrEqual(profile[step - 1][0])
        expect(profile[step][1]).toBeGreaterThan(profile[step - 1][1])
      }
    }
  })

  it('fit the foot profile inside the base', () => {
    expect(BASE_PROFILE_HEIGHT).toBeLessThan(BASE_HEIGHT)
  })
})
