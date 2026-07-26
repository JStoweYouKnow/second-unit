import { emailLayout, emailProfile } from './email.js'
import { smsDispatch } from './sms.js'
import { notifyUser } from './notifications.js'
import { FRONTEND_URL } from './stripe.js'

function channelOpts(profile, { title, body, link, category, ctaLabel, ctaUrl, subject }) {
  if (!profile) return {}
  const url = ctaUrl || (link ? `${FRONTEND_URL}${link}` : FRONTEND_URL)
  return {
    email: {
      to: profile.email,
      subject: subject || title,
      html: emailLayout({ title, body, ctaLabel, ctaUrl: url }),
      prefs: profile.notification_prefs,
      category,
    },
    sms: smsDispatch(profile, { title, body, link: url, category }),
  }
}

export async function notifyMessageReceived(db, {
  recipientId,
  senderName,
  preview,
}) {
  if (!recipientId) return null
  const profile = await emailProfile(db, recipientId)
  const body = preview.length > 120 ? `${preview.slice(0, 120)}…` : preview
  const title = `New message from ${senderName}`

  return notifyUser(
    db,
    recipientId,
    {
      type: 'message',
      title,
      body,
      link: '/messages',
    },
    channelOpts(profile, {
      title,
      body,
      link: '/messages',
      category: 'message',
      ctaLabel: 'Open Messages',
    })
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
    channelOpts(artist, {
      title,
      body,
      link: '/bookings',
      category: 'booking',
      ctaLabel: 'Review Booking',
    })
  )
}

export async function notifyBookingConfirmed(db, { booking, employerId, artistProfileId }) {
  const employer = await emailProfile(db, employerId)
  const title = `${booking.artist_name || 'Artist'} confirmed your booking`
  const body = `The project agreement is ready — you and the artist can both sign now, in either order, to unlock milestone payments.`

  await notifyUser(
    db,
    employerId,
    { type: 'booking', title, body, link: '/projects' },
    channelOpts(employer, {
      title,
      body,
      link: '/projects',
      category: 'booking',
      ctaLabel: 'View Project',
    })
  )

  if (artistProfileId) {
    const artist = await emailProfile(db, artistProfileId)
    const artistTitle = 'Booking confirmed — sign the agreement'
    const artistBody = `Your booking with ${employer?.full_name || 'the client'} is confirmed. You and the client can both sign the agreement now, in either order, before milestone payments begin.`
    await notifyUser(
      db,
      artistProfileId,
      { type: 'booking', title: artistTitle, body: artistBody, link: '/projects' },
      channelOpts(artist, {
        title: artistTitle,
        body: artistBody,
        link: '/projects',
        category: 'booking',
        ctaLabel: 'Sign Agreement',
      })
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
      const link = `/projects?contract_id=${contract.id}`
      await notifyUser(
        db,
        userId,
        { type: 'contract', title, body, link },
        channelOpts(profile, {
          title,
          body,
          link,
          category: 'contract',
          ctaLabel: 'Pay Milestones',
        })
      )
    }
    return
  }

  if (!otherPartyId) return
  const other = await emailProfile(db, otherPartyId)
  const title = `${signerName} signed: ${contract.title}`
  const body = `${signerName} signed the agreement. You can sign anytime — order does not matter. Both signatures are required to activate milestone payments.`
  const link = `/projects?contract_id=${contract.id}`

  await notifyUser(
    db,
    otherPartyId,
    {
      type: 'contract',
      title,
      body,
      link,
    },
    channelOpts(other, {
      title,
      body,
      link,
      category: 'contract',
      ctaLabel: 'Sign Agreement',
    })
  )

  // Confirm to the signer that their signature is recorded.
  const signerTitle = `Signature recorded: ${contract.title}`
  const signerBody = 'Your signature is on file. The agreement activates when the other party signs too — they can sign before or after you.'
  await notifyUser(
    db,
    signedByUserId,
    { type: 'contract', title: signerTitle, body: signerBody, link },
    channelOpts(signer, {
      title: signerTitle,
      body: signerBody,
      link,
      category: 'contract',
      ctaLabel: 'View Project',
    })
  )
}

export async function notifyMilestoneFunded(db, { contract, milestone, artistProfileId }) {
  if (!artistProfileId) return null
  const profile = await emailProfile(db, artistProfileId)
  const title = `Milestone funded: ${milestone.title}`
  const body = `${contract.title} — ${milestone.title} has been paid. Submit deliverables (optional) and request release when ready for client approval.`
  const link = `/projects?contract_id=${contract.id}`

  return notifyUser(
    db,
    artistProfileId,
    {
      type: 'payment',
      title,
      body,
      link,
    },
    channelOpts(profile, {
      title,
      body,
      link,
      category: 'payment',
      ctaLabel: 'View Project',
    })
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
    channelOpts(profile, {
      title,
      body,
      link: '/payments',
      category: 'payment',
      ctaLabel: 'View Earnings',
    })
  )
}

export async function notifyMilestoneReleaseRequested(db, { contract, milestone, employerId }) {
  if (!employerId) return null
  const profile = await emailProfile(db, employerId)
  const title = `Release requested: ${milestone.title}`
  const hasDeliverable = !!(
    milestone.deliverable_note ||
    milestone.deliverable_url ||
    milestone.deliverable_storage_path ||
    milestone.deliverable_name
  )
  const body = hasDeliverable
    ? `${contract.title} — the artist submitted work and asked you to approve "${milestone.title}" for payout.`
    : `${contract.title} — the artist asked you to approve "${milestone.title}" for payout.`
  const link = `/projects?contract_id=${contract.id}`

  return notifyUser(
    db,
    employerId,
    {
      type: 'payment',
      title,
      body,
      link,
    },
    channelOpts(profile, {
      title,
      body,
      link,
      category: 'payment',
      ctaLabel: 'Review Milestone',
    })
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
  const title = `${artistName} replied to your review`
  const link = `/artist/${artistProfileId}?tab=reviews`

  return notifyUser(
    db,
    review.reviewer_id,
    {
      type: 'system',
      title,
      body: preview,
      link,
    },
    channelOpts(profile, {
      title,
      body: preview,
      link,
      category: 'booking',
      ctaLabel: 'View review',
    })
  )
}
