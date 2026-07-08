import { emailLayout, emailProfile } from './email.js'
import { notifyUser } from './notifications.js'
import { FRONTEND_URL } from './stripe.js'

export async function notifyMessageReceived(db, {
  recipientId,
  senderName,
  preview,
}) {
  if (!recipientId) return null
  const profile = await emailProfile(db, recipientId)
  const body = preview.length > 120 ? `${preview.slice(0, 120)}…` : preview

  return notifyUser(
    db,
    recipientId,
    {
      type: 'message',
      title: `New message from ${senderName}`,
      body,
      link: '/messages',
    },
    profile
      ? {
          email: {
            to: profile.email,
            subject: `New message from ${senderName}`,
            html: emailLayout({
              title: `New message from ${senderName}`,
              body,
              ctaLabel: 'Open Messages',
              ctaUrl: `${FRONTEND_URL}/messages`,
            }),
            prefs: profile.notification_prefs,
            category: 'message',
          },
        }
      : {}
  )
}

export async function notifyBookingRequested(db, { booking, employerId, artistProfileId }) {
  if (!artistProfileId) return null

  const employer = await emailProfile(db, employerId)
  const artist = await emailProfile(db, artistProfileId)
  const employerName = employer?.full_name || 'A client'
  const dateLabel = booking.date
    ? String(booking.date).slice(0, 10)
    : 'TBD'
  const title = `New booking request from ${employerName}`
  const body = `${booking.type || booking.booking_type || 'Project'} on ${dateLabel} — confirm to activate the agreement.`

  return notifyUser(
    db,
    artistProfileId,
    { type: 'booking', title, body, link: '/bookings' },
    artist
      ? {
          email: {
            to: artist.email,
            subject: title,
            html: emailLayout({
              title,
              body,
              ctaLabel: 'Review Booking',
              ctaUrl: `${FRONTEND_URL}/bookings`,
            }),
            prefs: artist.notification_prefs,
            category: 'booking',
          },
        }
      : {}
  )
}

export async function notifyBookingConfirmed(db, { booking, employerId, artistProfileId }) {
  const employer = await emailProfile(db, employerId)
  const title = `${booking.artist_name || 'Artist'} confirmed your booking`
  const body = `${booking.booking_type || 'Booking'} on ${String(booking.date).slice(0, 10)} — sign the project agreement to begin milestone payments.`

  await notifyUser(
    db,
    employerId,
    { type: 'booking', title, body, link: '/projects' },
    employer
      ? {
          email: {
            to: employer.email,
            subject: title,
            html: emailLayout({
              title,
              body,
              ctaLabel: 'View Project',
              ctaUrl: `${FRONTEND_URL}/projects`,
            }),
            prefs: employer.notification_prefs,
            category: 'booking',
          },
        }
      : {}
  )

  if (artistProfileId) {
    const artist = await emailProfile(db, artistProfileId)
    const artistTitle = 'Booking confirmed — sign the agreement'
    const artistBody = `Your booking with ${employer?.full_name || 'the client'} is confirmed. Both parties must sign before milestone payments begin.`
    await notifyUser(
      db,
      artistProfileId,
      { type: 'booking', title: artistTitle, body: artistBody, link: '/projects' },
      artist
        ? {
            email: {
              to: artist.email,
              subject: artistTitle,
              html: emailLayout({
                title: artistTitle,
                body: artistBody,
                ctaLabel: 'Sign Agreement',
                ctaUrl: `${FRONTEND_URL}/projects`,
              }),
              prefs: artist.notification_prefs,
              category: 'booking',
            },
          }
        : {}
    )
  }
}

export async function notifyContractSigned(db, {
  contract,
  signedByUserId,
  otherPartyId,
  bothSigned,
}) {
  const signer = await emailProfile(db, signedByUserId)
  const signerName = signer?.full_name || 'A party'

  if (bothSigned) {
    for (const userId of [contract.employer_id, otherPartyId].filter(Boolean)) {
      const profile = await emailProfile(db, userId)
      const title = `Agreement active: ${contract.title}`
      const body = 'Both parties have signed. Milestone payments are now unlocked.'
      await notifyUser(
        db,
        userId,
        { type: 'contract', title, body, link: `/projects?contract_id=${contract.id}` },
        profile
          ? {
              email: {
                to: profile.email,
                subject: title,
                html: emailLayout({
                  title,
                  body,
                  ctaLabel: 'Pay Milestones',
                  ctaUrl: `${FRONTEND_URL}/projects?contract_id=${contract.id}`,
                }),
                prefs: profile.notification_prefs,
                category: 'contract',
              },
            }
          : {}
      )
    }
    return
  }

  if (!otherPartyId) return
  const other = await emailProfile(db, otherPartyId)
  const title = `${signerName} signed: ${contract.title}`
  const body = 'Your signature is needed to activate the agreement and unlock milestone payments.'

  await notifyUser(
    db,
    otherPartyId,
    {
      type: 'contract',
      title,
      body,
      link: `/projects?contract_id=${contract.id}`,
    },
    other
      ? {
          email: {
            to: other.email,
            subject: title,
            html: emailLayout({
              title,
              body,
              ctaLabel: 'Sign Agreement',
              ctaUrl: `${FRONTEND_URL}/projects?contract_id=${contract.id}`,
            }),
            prefs: other.notification_prefs,
            category: 'contract',
          },
        }
      : {}
  )
}

export async function notifyMilestoneFunded(db, { contract, milestone, artistProfileId }) {
  if (!artistProfileId) return null
  const profile = await emailProfile(db, artistProfileId)
  const title = `Milestone funded: ${milestone.title}`
  const body = `${contract.title} — ${milestone.title} has been paid. Deliver work and await client approval for payout release.`

  return notifyUser(
    db,
    artistProfileId,
    {
      type: 'payment',
      title,
      body,
      link: `/projects?contract_id=${contract.id}`,
    },
    profile
      ? {
          email: {
            to: profile.email,
            subject: title,
            html: emailLayout({
              title,
              body,
              ctaLabel: 'View Project',
              ctaUrl: `${FRONTEND_URL}/projects?contract_id=${contract.id}`,
            }),
            prefs: profile.notification_prefs,
            category: 'payment',
          },
        }
      : {}
  )
}

export async function notifyMilestoneReleased(db, { contract, milestone, artistProfileId }) {
  if (!artistProfileId) return null
  const profile = await emailProfile(db, artistProfileId)
  const title = `Payout released: ${milestone.title}`
  const body = `Your payout for "${milestone.title}" on ${contract.title} has been released.`

  return notifyUser(
    db,
    artistProfileId,
    {
      type: 'payment',
      title,
      body,
      link: '/payments',
    },
    profile
      ? {
          email: {
            to: profile.email,
            subject: title,
            html: emailLayout({
              title,
              body,
              ctaLabel: 'View Earnings',
              ctaUrl: `${FRONTEND_URL}/payments`,
            }),
            prefs: profile.notification_prefs,
            category: 'payment',
          },
        }
      : {}
  )
}

export async function notifyReviewResponse(db, { review, artistProfileId }) {
  if (!review?.reviewer_id || !artistProfileId) return null

  const { data: artistRow } = await db
    .from('artists')
    .select('stage_name, profile_id')
    .eq('profile_id', artistProfileId)
    .maybeSingle()

  const artistName = artistRow?.stage_name || 'Artist'
  const body = (review.artist_response || '').trim()
  const preview = body.length > 120 ? `${body.slice(0, 120)}…` : body
  const profile = await emailProfile(db, review.reviewer_id)

  return notifyUser(
    db,
    review.reviewer_id,
    {
      type: 'system',
      title: `${artistName} replied to your review`,
      body: preview,
      link: `/artist/${artistProfileId}?tab=reviews`,
    },
    profile
      ? {
          email: {
            to: profile.email,
            subject: `${artistName} replied to your review`,
            html: emailLayout({
              title: `${artistName} replied to your review`,
              body: preview,
              ctaLabel: 'View review',
              ctaUrl: `${FRONTEND_URL}/artist/${artistProfileId}?tab=reviews`,
            }),
            prefs: profile.notification_prefs,
            category: 'booking',
          },
        }
      : {}
  )
}
