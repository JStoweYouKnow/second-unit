import { PLATFORM_FEE_PERCENT, ARTIST_PAYOUT_RATE } from './fees.js'

export const ONBOARDING_GUIDE_VERSION = 1

const STORAGE_PREFIX = 'callsheet_onboarding_v1'
const PENDING_PREFIX = 'callsheet_onboarding_pending_v1'

/** Which guide to show: admin console, artist workspace, or hirer workspace. */
export function resolveOnboardingRole({ isAdmin, adminViewAs, effectiveRole }) {
  if (isAdmin && !adminViewAs) return 'admin'
  if (effectiveRole === 'artist') return 'artist'
  return 'hirer'
}

function storageKey(userId, role) {
  return `${STORAGE_PREFIX}_${userId}_${role}`
}

function pendingKey(userId) {
  return `${PENDING_PREFIX}_${userId}`
}

/** Mark that this user should see the guide once after account creation. */
export function markOnboardingPending(userId) {
  if (!userId) return
  try {
    localStorage.setItem(pendingKey(userId), '1')
  } catch {
    // ignore quota / private mode
  }
}

export function clearOnboardingPending(userId) {
  if (!userId) return
  try {
    localStorage.removeItem(pendingKey(userId))
  } catch {
    // ignore
  }
}

export function isOnboardingPending(userId) {
  if (!userId) return false
  try {
    return localStorage.getItem(pendingKey(userId)) === '1'
  } catch {
    return false
  }
}

/** Auto-show only for brand-new accounts that have not finished the guide yet. */
export function shouldAutoShowOnboarding(userId, role) {
  if (!userId || !role) return false
  return isOnboardingPending(userId) && !isOnboardingDismissed(userId, role)
}

/** Persist that the user has seen the guide (any close counts). */
export function finishOnboarding(userId, role) {
  dismissOnboarding(userId, role)
  clearOnboardingPending(userId)
}

export function isOnboardingDismissed(userId, role) {
  if (!userId || !role) return true
  try {
    return localStorage.getItem(storageKey(userId, role)) === String(ONBOARDING_GUIDE_VERSION)
  } catch {
    return true
  }
}

export function dismissOnboarding(userId, role) {
  if (!userId || !role) return
  try {
    localStorage.setItem(storageKey(userId, role), String(ONBOARDING_GUIDE_VERSION))
  } catch {
    // ignore quota / private mode
  }
}

export function clearOnboardingDismissed(userId, role) {
  if (!userId || !role) return
  try {
    localStorage.removeItem(storageKey(userId, role))
  } catch {
    // ignore
  }
}

const artistPayoutPercent = Math.round(ARTIST_PAYOUT_RATE * 100)

const GUIDES = {
  artist: {
    eyebrow: 'Artist guide',
    title: 'Welcome to The Callsheet',
    intro:
      'A quick tour of how bookings, projects, and payouts work for artists. You can reopen this anytime from Help or the sidebar.',
    steps: [
      {
        title: 'Set up your profile & calendar',
        body: 'Hirers book you from your public profile. Open availability on days and hours you want work.',
        bullets: [
          'My profile → Edit Availability to open days and hours',
          'Set your working timezone, pick dates, tap hours to open, then Save this day',
          'Edit bio, rates, and reels from My profile',
        ],
        cta: { label: 'Go to Dashboard', path: '/dashboard' },
      },
      {
        title: 'Respond to booking requests',
        body: 'When a hirer sends a request, confirm or decline from Schedule.',
        bullets: [
          'Schedule lists pending, confirmed, and past bookings',
          'Messages is where you coordinate details before and after booking',
        ],
        cta: { label: 'Open Schedule', path: '/bookings' },
      },
      {
        title: 'How you get paid',
        body: `Client payments are held in escrow until work is approved. You keep ${artistPayoutPercent}% (${PLATFORM_FEE_PERCENT}% platform fee).`,
        bullets: [
          'First time: connect Stripe from Earnings so we can send payouts to your bank',
          'Funds sit in escrow after the client pays; they release when the hirer approves a milestone or booking',
          'Bank deposits follow Stripe’s schedule — not instant on approval',
          'Upload tax docs (W-9) from Account when prompted',
        ],
        cta: { label: 'Open Earnings', path: '/payments' },
      },
      {
        title: 'Projects & agreements',
        body: 'Larger engagements use Projects with milestones, signatures, and deliverables.',
        bullets: [
          'Review and sign agreements from Projects — you and the client can sign in either order',
          'Submit milestone deliverables; request release when work is done',
          'Export contract or invoice PDFs from the project detail view',
        ],
        cta: { label: 'View Projects', path: '/projects' },
      },
      {
        title: 'Find work & get help',
        body: 'Browse Open Briefs for posted opportunities, and use Disputes if you need platform mediation.',
        bullets: [
          'Open Briefs — hirers post needs; you can respond from the brief',
          'Disputes — open a case if payment or delivery needs mediation',
          'Help — full FAQ and support email',
        ],
        cta: { label: 'Browse Open Briefs', path: '/briefs' },
      },
    ],
  },
  hirer: {
    eyebrow: 'Hirer guide',
    title: 'Welcome to The Callsheet',
    intro:
      'How to discover artists, book time, pay securely, and run projects. Reopen this guide anytime from Help or the sidebar.',
    steps: [
      {
        title: 'Find the right artist',
        body: 'Search and filter the roster, save favorites, and open profiles to view reels and availability.',
        bullets: [
          'Artist Database — browse ranked artists and filters',
          'Open a profile → View Calendar to see open days and hours',
          'Message an artist before booking if you need to align on scope',
        ],
        cta: { label: 'Browse artists', path: '/home' },
      },
      {
        title: 'Book time on their calendar',
        body: 'Pick Hours for part of one day, or Days for a multi-day block — every day in the range must be open.',
        bullets: [
          'Hours: click a day, then start and end hour',
          'Days: click first day, then last day',
          'Continue to book → confirm fee and notes on Schedule',
        ],
        cta: { label: 'Your Schedule', path: '/bookings' },
      },
      {
        title: 'Paying artists',
        body: `Set up payments once, then checkout by milestone. The ${PLATFORM_FEE_PERCENT}% platform fee is retained; the rest goes to the artist after you approve release.`,
        bullets: [
          'Payments — set up Stripe before your first checkout',
          'Client funds are held in escrow until you approve milestone or booking release',
          'Receipts and invoices download from Payments or the project record',
        ],
        cta: { label: 'Open Payments', path: '/payments' },
      },
      {
        title: 'Projects & contracts',
        body: 'For longer work, create a Project with milestones, typed signatures, and optional uploaded agreements.',
        bullets: [
          'Standard or custom agreement; you and the artist sign in Projects — either order is fine',
          'Fund milestones, review deliverables, approve release',
          'Export contract or invoice from the project detail modal',
        ],
        cta: { label: 'View Projects', path: '/projects' },
      },
      {
        title: 'Briefs, messages & disputes',
        body: 'Post Open Briefs to attract artists, keep threads in Messages, and escalate to Disputes if needed.',
        bullets: [
          'Open Briefs — post a need and review artist responses',
          'Messages — templates for common questions during hiring',
          'Disputes — platform mediation for payment or delivery issues',
        ],
        cta: { label: 'Post a brief', path: '/briefs' },
      },
    ],
  },
  admin: {
    eyebrow: 'Admin guide',
    title: 'Admin console overview',
    intro:
      'Review applications, manage disputes, and test the product as an artist or hirer. Reopen this guide from Help or the sidebar.',
    steps: [
      {
        title: 'Applications & invites',
        body: 'Approve artist applications and send invites before profiles go live.',
        bullets: [
          'Applications — review pending submissions and approve or reject',
          'Invites — generate links for new artists joining the beta',
        ],
        cta: { label: 'Review applications', path: '/admin/applications' },
      },
      {
        title: 'Disputes & moderation',
        body: 'Handle open disputes and keep engagement records for both parties.',
        bullets: [
          'Admin Disputes — triage cases, notes, and resolution outcomes',
          'Artist Database — spot-check public profiles like a hirer would',
        ],
        cta: { label: 'Open disputes', path: '/admin/disputes' },
      },
      {
        title: 'Test as artist or hirer',
        body: 'Use View as in the sidebar to walk through payouts and bookings with a test persona.',
        bullets: [
          'View as Artist — connect Stripe test Connect, check Earnings escrow/release',
          'View as Hirer — fund a milestone, switch back to artist to confirm payout flow',
          'Mock personas appear in the sidebar when demo mode is on',
        ],
        cta: { label: 'Go to Dashboard', path: '/dashboard' },
      },
      {
        title: 'Payments & projects (all roles)',
        body: 'The same Schedule, Projects, and Payments areas exist in admin view for support and testing.',
        bullets: [
          'Payments — inspect checkout and fee breakdown as a hirer',
          'Projects — agreements, milestones, exports',
          'Help — share the role guides with users who get stuck',
        ],
        cta: { label: 'Open Help docs', path: '/help' },
      },
    ],
  },
}

export function getOnboardingGuide(role) {
  return GUIDES[role] ?? GUIDES.hirer
}
