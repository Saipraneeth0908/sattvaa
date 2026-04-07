export function normalizeUnit(unit) {
  return (unit || '').trim().toLowerCase()
}

export function convertToInventoryUnit(quantity, fromUnit, toUnit) {
  const from = normalizeUnit(fromUnit)
  const to = normalizeUnit(toUnit)
  if (!from || !to) return null
  if (from === to) return quantity

  const mass = { kg: 1, g: 0.001, lb: 0.453592, oz: 0.0283495 }
  const volume = { l: 1, ml: 0.001, cups: 0.236588 }

  if (mass[from] && mass[to]) return quantity * (mass[from] / mass[to])
  if (volume[from] && volume[to]) return quantity * (volume[from] / volume[to])

  return null
}