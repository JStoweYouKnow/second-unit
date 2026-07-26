import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  resolveOnboardingRole,
  getOnboardingGuide,
  dismissOnboarding,
  isOnboardingDismissed,
  clearOnboardingDismissed,
  ONBOARDING_GUIDE_VERSION,
} from '../src/lib/onboardingGuide.js'

describe('onboardingGuide', () => {
  it('resolveOnboardingRole picks admin, artist, or hirer', () => {
    assert.equal(resolveOnboardingRole({ isAdmin: true, adminViewAs: null, effectiveRole: 'admin' }), 'admin')
    assert.equal(resolveOnboardingRole({ isAdmin: true, adminViewAs: 'artist', effectiveRole: 'artist' }), 'artist')
    assert.equal(resolveOnboardingRole({ isAdmin: false, adminViewAs: null, effectiveRole: 'artist' }), 'artist')
    assert.equal(resolveOnboardingRole({ isAdmin: false, adminViewAs: null, effectiveRole: 'employer' }), 'hirer')
  })

  it('returns role-specific guides with payment steps', () => {
    const artist = getOnboardingGuide('artist')
    const hirer = getOnboardingGuide('hirer')
    assert.match(artist.steps[2].title, /paid/i)
    assert.match(hirer.steps[2].title, /pay/i)
    assert.ok(artist.steps.length >= 4)
    assert.ok(hirer.steps.length >= 4)
  })

  it('persists dismiss per user and role', () => {
    if (typeof localStorage === 'undefined') return
    const userId = 'test-user-onboarding'
    const role = 'artist'
    clearOnboardingDismissed(userId, role)
    assert.equal(isOnboardingDismissed(userId, role), false)
    dismissOnboarding(userId, role)
    assert.equal(isOnboardingDismissed(userId, role), true)
    assert.equal(
      localStorage.getItem(`callsheet_onboarding_v1_${userId}_${role}`),
      String(ONBOARDING_GUIDE_VERSION)
    )
    clearOnboardingDismissed(userId, role)
  })
})
