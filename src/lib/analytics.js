const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * Build last N calendar months of { label, value } from dated rows.
 * @param {Array<{ date?: string, createdAt?: string, amount?: number, agreedTotal?: number }>} rows
 * @param {number} months
 * @param {(row: object) => number} getAmount
 * @param {(row: object) => Date | null} getDate
 */
export function buildMonthlySeries(rows, months, getAmount, getDate) {
  const now = new Date()
  const buckets = []

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    buckets.push({
      year: d.getFullYear(),
      month: d.getMonth(),
      label: MONTH_LABELS[d.getMonth()],
      value: 0,
    })
  }

  for (const row of rows || []) {
    const dt = getDate(row)
    if (!dt || Number.isNaN(dt.getTime())) continue
    const bucket = buckets.find((b) => b.year === dt.getFullYear() && b.month === dt.getMonth())
    if (bucket) bucket.value += getAmount(row) || 0
  }

  return buckets.map(({ label, value }) => ({ label, value: Math.round(value) }))
}

/**
 * Count items per month for sparkline / trend charts.
 */
export function buildMonthlyCounts(rows, months, getDate) {
  const series = buildMonthlySeries(
    rows,
    months,
    () => 1,
    getDate
  )
  return series.map((s) => s.value)
}

export function parseRowDate(row) {
  const raw = row?.date || row?.createdAt || row?.paid_at || row?.paidAt
  if (!raw) return null
  const dt = new Date(raw)
  return Number.isNaN(dt.getTime()) ? null : dt
}
