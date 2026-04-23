/** @typedef {'hourly' | 'daily' | 'flat'} PricingModel */

const HOURS_PER_DAY = 8

/**
 * Ensure daily / flat figures exist (derived from hourly when omitted).
 * @param {{ hourlyRate?: number, dailyRate?: number, projectFlatRate?: number }} artist
 */
export function normalizeArtistPricing(artist) {
  const hourlyRate = Number(artist.hourlyRate) || 0
  const dailyRate =
    artist.dailyRate != null ? Number(artist.dailyRate) : Math.round(hourlyRate * HOURS_PER_DAY)
  const projectFlatRate =
    artist.projectFlatRate != null
      ? Number(artist.projectFlatRate)
      : Math.round(hourlyRate * HOURS_PER_DAY * 5)
  return { hourlyRate, dailyRate, projectFlatRate }
}

/**
 * @param {PricingModel} mode
 * @param {{ hourlyRate?: number, dailyRate?: number, projectFlatRate?: number }} artist
 */
export function formatArtistRate(mode, artist) {
  const p = normalizeArtistPricing(artist)
  if (mode === 'hourly') return `$${p.hourlyRate}/hr`
  if (mode === 'daily') return `$${p.dailyRate.toLocaleString()}/day`
  return `$${p.projectFlatRate.toLocaleString()} flat`
}

/**
 * Estimated total for a booking request before taxes/fees.
 * @param {PricingModel} mode
 * @param {{ hourlyRate?: number, dailyRate?: number, projectFlatRate?: number }} artist
 * @param {number} duration — hours if hourly, days if daily, ignored if flat
 */
export function estimateBookingTotal(mode, artist, duration) {
  if (!artist) return 0
  const p = normalizeArtistPricing(artist)
  const d = Number(duration) || 0
  if (mode === 'hourly') return Math.round(p.hourlyRate * d)
  if (mode === 'daily') return Math.round(p.dailyRate * d)
  return Math.round(p.projectFlatRate)
}

/**
 * Line item for booking list / payment copy.
 * @param {{ pricingModel?: PricingModel, rate: number, duration: number }} booking
 */
export function bookingSubtotal(booking) {
  const model = booking.pricingModel || 'hourly'
  if (model === 'flat') return Math.round(booking.rate)
  return Math.round(booking.rate * booking.duration)
}

export function pricingModelLabel(model) {
  if (model === 'daily') return 'Daily'
  if (model === 'flat') return 'Flat project'
  return 'Hourly'
}

export function durationUnitLabel(model) {
  if (model === 'daily') return 'd'
  if (model === 'flat') return ''
  return 'h'
}
