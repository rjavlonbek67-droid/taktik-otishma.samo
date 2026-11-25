import { audioBus, fxAllowed } from '../audio.js'

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
  const sub = ctx.createOscillator()
  const subGain = ctx.createGain()
  osc.type = 'square'
  osc.frequency.value = 180
  filter.type = 'lowpass'
  filter.frequency.value = 900
  filter.Q.value = 0.7
  gain.gain.value = 0.0001
  sub.type = 'sine'
  sub.frequency.value = 42
  subGain.gain.value = 0.0001
  osc.connect(filter)
  filter.connect(gain)
  gain.connect(master)
  sub.connect(subGain)
  subGain.connect(master)
  osc.start()
  sub.start()
  bed = { ctx, osc, filter, gain, sub, subGain }
  return bed
}

const SPECS = {
  menu: { from: 320, to: 140, filter: 1600, peak: 0.035, dur: 0.06, sub: 0 },
  tick: { from: 210, to: 96, filter: 1400, peak: 0.028, dur: 0.05, sub: 0.02 },
  launch: { from: 180, to: 52, filter: 880, peak: 0.08, dur: 0.16, sub: 0.04 },
  dead: { from: 74, to: 34, filter: 240, peak: 0.09, dur: 0.26, sub: 0.07 },
  finale: { from: 58, to: 28, filter: 180, peak: 0.11, dur: 0.4, sub: 0.1 },
}

export function pulseFx(kind) {
  const graph = ensure()
  if (!graph) return
  const spec = SPECS[kind] || SPECS.menu
  const now = graph.ctx.currentTime
  const { osc, filter, gain, sub, subGain } = graph
  osc.frequency.cancelScheduledValues(now)
  osc.frequency.setValueAtTime(Math.max(30, spec.from), now)
  osc.frequency.exponentialRampToValueAtTime(Math.max(28, spec.to), now + spec.dur)
  filter.frequency.setTargetAtTime(spec.filter, now, 0.02)
  gain.gain.cancelScheduledValues(now)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.linearRampToValueAtTime(spec.peak, now + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + spec.dur)
  sub.frequency.setValueAtTime(kind === 'finale' ? 36 : 46, now)
  subGain.gain.cancelScheduledValues(now)
  subGain.gain.setValueAtTime(0.0001, now)
  if (spec.sub > 0) {
    subGain.gain.linearRampToValueAtTime(spec.sub, now + 0.03)
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + spec.dur + 0.12)
  }
}

export function stopFx() {
  if (!bed) return
  const graph = bed
  bed = null
  const now = graph.ctx.currentTime
  graph.gain.gain.cancelScheduledValues(now)
  graph.subGain.gain.cancelScheduledValues(now)
  graph.gain.gain.setTargetAtTime(0.0001, now, 0.015)
  graph.subGain.gain.setTargetAtTime(0.0001, now, 0.015)
  try {
    graph.osc.stop(now + 0.04)
    graph.sub.stop(now + 0.04)
  } catch {
    /* already stopped */
  }
  graph.osc.onended = () => {
    try {
      graph.osc.disconnect()
      graph.filter.disconnect()
      graph.gain.disconnect()
      graph.sub.disconnect()
      graph.subGain.disconnect()
    } catch {
      /* already disconnected */
    }
  }
}
