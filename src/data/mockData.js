// Placeholder data for features not yet backed by Supabase.
// Artist roster, bookings, messages, contracts, and payments come from the database.

export const messages = []

export const bookings = []

/** Open client briefs on Artist Spotlight — budgets are listed; final fees are negotiated in thread. */
export const availableProjects = [
  {
    id: 'ap1',
    title: 'AI luxury lookbook — SS26 campaign',
    client: 'House of Vale',
    budgetMin: 18000,
    budgetMax: 28000,
    location: 'Remote · EU-friendly hours',
    skills: ['Midjourney', 'Photoshop', 'CLO3D'],
    posted: '2026-04-18',
    timeline: '4–6 weeks',
  },
  {
    id: 'ap2',
    title: 'NeRF virtual showroom for auto launch',
    client: 'Northline Motors',
    budgetMin: 35000,
    budgetMax: 52000,
    location: 'Hybrid · Detroit + remote',
    skills: ['NeRF', 'Unreal Engine', 'Blender'],
    posted: '2026-04-16',
    timeline: '8–10 weeks',
  },
  {
    id: 'ap3',
    title: 'Cinematic AI trailer — 90s cut',
    client: 'Driftwood Pictures',
    budgetMin: 12000,
    budgetMax: 18000,
    location: 'Remote · US Pacific',
    skills: ['Runway', 'After Effects', 'Sora'],
    posted: '2026-04-20',
    timeline: '3 weeks',
  },
  {
    id: 'ap4',
    title: 'In-game concept pack (sci-fi environments)',
    client: 'Riftline Games',
    budgetMin: 22000,
    budgetMax: 30000,
    location: 'Remote',
    skills: ['Stable Diffusion', 'ControlNet', 'Photoshop'],
    posted: '2026-04-19',
    timeline: '6 weeks',
  },
]

export const contracts = []

export const payments = []
