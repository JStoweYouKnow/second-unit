/** @typedef {{ name: string, verified?: boolean }} ArtistBrand */

/**
 * @param {string | ArtistBrand} brand
 */
export function brandName(brand) {
  return typeof brand === 'string' ? brand : brand?.name ?? ''
}

/**
 * @param {string | ArtistBrand} brand
 */
export function brandVerified(brand) {
  return typeof brand === 'object' && brand != null && brand.verified === true
}

/**
 * @param {Array<string | ArtistBrand> | null | undefined} brands
 * @returns {ArtistBrand[]}
 */
export function normalizeBrands(brands) {
  if (!brands?.length) return []
  return brands.map((b) =>
    typeof b === 'string' ? { name: b, verified: false } : { name: b.name, verified: !!b.verified }
  )
}
