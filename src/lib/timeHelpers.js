export function addMinutesToTime(timeStr, minutesToAdd) {
  if (!timeStr || !timeStr.includes(':')) return ''
  const [h, m] = timeStr.split(':').map(Number)
  const base = new Date()
  base.setHours(h || 0, m || 0, 0, 0)
  base.setMinutes(base.getMinutes() + minutesToAdd)
  const hh = String(base.getHours()).padStart(2, '0')
  const mm = String(base.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

export function buildWaterIceStepsFromStart(startTime) {
  const offsets = [10, 15, 20, 25, 27]
  const actions = [
    'Add 500 ml water + ice',
    'Add 500 ml water + ice',
    'Add 500 ml water + ice',
    'Add 500 ml water',
    'Add all remaining water',
  ]

  return offsets.map((offset, idx) => ({
    step_no: idx + 1,
    entry_time: addMinutesToTime(startTime, offset),
    action_text: actions[idx],
  }))
}