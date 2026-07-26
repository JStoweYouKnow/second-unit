import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  finishOnboarding,
  resolveOnboardingRole,
  shouldAutoShowOnboarding,
} from '../lib/onboardingGuide'

export function useOnboardingGuide({
  userId,
  isAdmin,
  adminViewAs,
  effectiveRole,
  enabled = true,
  authLoading = false,
}) {
  const role = useMemo(
    () => (enabled && userId ? resolveOnboardingRole({ isAdmin, adminViewAs, effectiveRole }) : null),
    [enabled, userId, isAdmin, adminViewAs, effectiveRole]
  )

  const [open, setOpen] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)

  useEffect(() => {
    if (authLoading || !enabled || !userId || !role || manualOpen) return
    setOpen(shouldAutoShowOnboarding(userId, role))
  }, [authLoading, enabled, userId, role, manualOpen])

  const showGuide = useCallback(() => {
    setManualOpen(true)
    setOpen(true)
  }, [])

  const closeGuide = useCallback(() => {
    if (userId && role) finishOnboarding(userId, role)
    setOpen(false)
    setManualOpen(false)
  }, [userId, role])

  const dismissGuide = useCallback(() => {
    if (userId && role) finishOnboarding(userId, role)
    setOpen(false)
    setManualOpen(false)
  }, [userId, role])

  return {
    role,
    open,
    showGuide,
    closeGuide,
    dismissGuide,
  }
}
