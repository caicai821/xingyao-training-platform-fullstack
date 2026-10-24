export function nextCode(codes: string[], prefix: string, pad = 3): string {
  const max = codes.reduce((current, code) => {
    const sequence = Number(code.split('-').pop())
    return Number.isFinite(sequence) ? Math.max(current, sequence) : current
  }, 0)
  return `${prefix}-${String(max + 1).padStart(pad, '0')}`
}

export function yearPrefix(base: string, date = new Date()): string {
  return `${base}-${date.getFullYear()}`
}
