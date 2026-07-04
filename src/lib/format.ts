const usdFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

export function usd(n: number | null | undefined): string {
  if (n == null) return '—'
  return usdFmt.format(n)
}
