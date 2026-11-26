import { audioBus, fxAllowed } from '../audio.js'

const TAU = 2600
const BASE_CEIL = 29 * 1.5 * 1.12

let bed = null

function ensure() {
  if (!fxAllowed()) return null
  if (bed) return bed
  const bus = audioBus()
  if (!bus) return null
  const { ctx, master } = bus
  const osc = ctx.createOscillator()
  const filter = ctx.createBiquadFilter()
  const gain = ctx.createGain()
  osc.type = 'triangle'
  osc.frequency.value = 640
  filter.type = 'bandpass'
  filter.frequency.value = 900
  filter.Q.value = 2.4
  gain.gain.value = 0.0001
  osc.connect(filter)
  filter.connect(gain)
  gain.connect(master)
  osc.start()
  bed = { ctx, osc, filter, gain, next: 0 }
  return bed
}

export function createScale() {
  return {
    mark: 1000,
    ping: 0,
    at: 0,
    ease: 0,
    felt: 0,
    gap: 0,
    ceil: BASE_CEIL,
  }
}

export function resetScale(scale) {
  scale.mark = 1000
  scale.ping = 0
  scale.at = 0
  scale.ease = 0
  scale.felt = 0
  scale.gap = 0
  scale.ceil = BASE_CEIL
}

export function stepScale(scale, shown, raw, dt, lod) {
  const over = shown > 1000 ? shown - 1000 : 0
  const target = over > 0 ? 1 - Math.exp(-over / TAU) : 0
  const blend = 1 - Math.exp(-dt * 1.6)
  scale.ease += (target - scale.ease) * blend
  if (raw <= 1000) scale.felt = raw
  else {
    const creep = (lod ? 28 : 64) * scale.ease
    scale.felt = 1000 + creep
  }
  scale.gap = scale.ease * (lod ? 0.3 : 0.75)
  scale.ceil = BASE_CEIL * (1 + scale.ease * (lod ? 0.025 : 0.06))
  if (shown < 1500) return
  const band = 1000 + Math.floor((shown - 1000) / 500) * 500
  if (band > scale.mark) {
    scale.mark = band
    scale.at = band
    scale.ping = 1
  }
}

export function takeScalePing(scale) {
  if (!scale.ping) return 0
  const at = scale.at
  scale.ping = 0
  return at
}

export function scaleChime(quiet) {
  if (quiet || document.hidden) return
  const graph = ensure()
  if (!graph) return
  const now = graph.ctx.currentTime
  if (now < graph.next) return
  graph.next = now + 0.36
  const { osc, filter, gain } = graph
  osc.frequency.cancelScheduledValues(now)
  osc.frequency.setValueAtTime(880, now)
  osc.frequency.exponentialRampToValueAtTime(520, now + 0.07)
  filter.frequency.setTargetAtTime(1100, now, 0.01)
  gain.gain.cancelScheduledValues(now)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.linearRampToValueAtTime(quiet ? 0.012 : 0.022, now + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09)
}

export function restScaleAudio() {
  if (!bed) return
  const graph = bed
  bed = null
  const now = graph.ctx.currentTime
  graph.gain.gain.cancelScheduledValues(now)
  graph.gain.gain.setTargetAtTime(0.0001, now, 0.012)
  try {
    graph.osc.stop(now + 0.04)
  } catch {
    /* already stopped */
  }
  graph.osc.onended = () => {
    try {
      graph.osc.disconnect()
      graph.filter.disconnect()
      graph.gain.disconnect()
    } catch {
      /* already disconnected */
    }
  }
}
