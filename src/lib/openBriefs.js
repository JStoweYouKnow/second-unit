/**
 * Map live bookings/contracts into dashboard "open brief" cards (replaces mockData).
 */
export function buildOpenBriefCards({ bookings = [], contracts = [], isArtist, artistId }) {
  const cards = []

  if (isArtist && artistId) {
    for (const c of contracts) {
      if (String(c.artistId) !== String(artistId)) continue
      if (c.status !== 'pending' && c.status !== 'active') continue
      cards.push({
        id: `contract-${c.id}`,
        title: c.title,
        client: c.clientName || 'Client',
        budgetMin: c.value || 0,
        budgetMax: c.value || 0,
        location: 'Remote',
        skills: [],
        posted: c.createdAt ? String(c.createdAt).slice(0, 10) : 'Today',
        timeline:
          c.startDate && c.endDate ? `${c.startDate} → ${c.endDate}` : c.status,
        isOffer: true,
        contractStatus: c.status,
      })
    }

    for (const b of bookings) {
      if (String(b.artistId) !== String(artistId)) continue
      if (b.status !== 'pending' && b.status !== 'confirmed') continue
      cards.push({
        id: `booking-${b.id}`,
        title: `${b.type || 'Booking'} request`,
        client: 'Client',
        budgetMin: b.agreedTotal || 0,
        budgetMax: b.agreedTotal || 0,
        location: 'Scheduled',
        skills: [b.type].filter(Boolean),
        posted: b.date || 'Upcoming',
        timeline: `${b.date} · ${b.status}`,
        isOffer: b.status === 'confirmed',
      })
    }

    return cards
  }

  for (const b of bookings) {
    if (b.status !== 'pending' && b.status !== 'confirmed') continue
    cards.push({
      id: `booking-${b.id}`,
      title: `${b.type || 'Project'} — ${b.artistName || 'Artist'}`,
      client: 'Your booking',
      budgetMin: b.agreedTotal || 0,
      budgetMax: b.agreedTotal || 0,
      location: 'In thread',
      skills: [b.type].filter(Boolean),
      posted: b.createdAt ? String(b.createdAt).slice(0, 10) : b.date,
      timeline: `${b.date} · ${b.status}`,
    })
  }

  for (const c of contracts) {
    if (c.status !== 'pending' && c.status !== 'active') continue
    cards.push({
      id: `contract-${c.id}`,
      title: c.title,
      client: c.artistName || 'Artist',
      budgetMin: c.value || 0,
      budgetMax: c.value || 0,
      location: 'Contract',
      skills: [],
      posted: c.createdAt ? String(c.createdAt).slice(0, 10) : 'Today',
      timeline: c.status,
    })
  }

  return cards
}
