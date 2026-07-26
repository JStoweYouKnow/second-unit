import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  dismissOnboarding,
  isOnboardingDismissed,
  resolveOnboardingRole,
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
    setOpen(!isOnboardingDismissed(userId, role))
  }, [authLoading, enabled, userId, role, manualOpen])

  const showGuide = useCallback(() => {
    setManualOpen(true)
    setOpen(true)
  }, [])

  const closeGuide = useCallback(() => {
    setOpen(false)
    setManualOpen(false)
  }, [])

  const dismissGuide = useCallback(() => {
    if (userId && role) dismissOnboarding(userId, role)
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
