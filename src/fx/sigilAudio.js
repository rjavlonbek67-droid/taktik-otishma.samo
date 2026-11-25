import { audioBus, fxAllowed } from '../audio.js'

let bed = null
let users = 0
let microAt = 0
let hitAt = 0

const DRAFT_FROM = [1320, 980, 760, 540, 1680]

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
  osc.frequency.value = 880
  filter.type = 'bandpass'
  filter.frequency.value = 1400
  filter.Q.value = 3.2
  gain.gain.value = 0.0001
  sub.type = 'sine'
  sub.frequency.value = 46
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

function stopBed() {
  if (!bed) return
  const graph = bed
  bed = null
  const now = graph.ctx.currentTime
  graph.gain.gain.cancelScheduledValues(now)
  graph.subGain.gain.cancelScheduledValues(now)
  graph.gain.gain.setTargetAtTime(0.0001, now, 0.012)
  graph.subGain.gain.setTargetAtTime(0.0001, now, 0.012)
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

export function armSigilAudio() {
  users += 1
}

export function releaseSigilAudio() {
  users -= 1
  if (users > 0) return
  users = 0
  microAt = 0
  hitAt = 0
  stopBed()
}

export function sigilDraft(step, quiet) {
  if (document.hidden) return
  if (quiet && (step === 1 || step === 3)) return
  const graph = ensure()
  if (!graph) return
  const now = graph.ctx.currentTime
  if (now < microAt || now < hitAt) return
  microAt = now + (quiet ? 0.14 : 0.07)
  const from = DRAFT_FROM[step] || 720
  const dur = 0.042
  const peak = quiet ? 0.012 : 0.026
  const { osc, filter, gain } = graph
  osc.frequency.cancelScheduledValues(now)
  osc.frequency.setValueAtTime(from, now)
  osc.frequency.exponentialRampToValueAtTime(Math.max(160, from * 0.52), now + dur)
  filter.frequency.setTargetAtTime(from, now, 0.008)
  gain.gain.cancelScheduledValues(now)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.linearRampToValueAtTime(peak, now + 0.005)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur)
}

export function sigilEye(narrow) {
  if (document.hidden) return
  const graph = ensure()
  if (!graph) return
  const now = graph.ctx.currentTime
  if (now < microAt || now < hitAt) return
  microAt = now + 0.18
  const from = narrow ? 2140 : 1560
  const { osc, filter, gain } = graph
  osc.frequency.cancelScheduledValues(now)
  osc.frequency.setValueAtTime(from, now)
  osc.frequency.exponentialRampToValueAtTime(narrow ? 1180 : 820, now + 0.028)
  filter.frequency.setTargetAtTime(from, now, 0.006)
  gain.gain.cancelScheduledValues(now)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.linearRampToValueAtTime(0.02, now + 0.004)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.032)
}

export function sigilHit(quiet) {
  if (document.hidden) return
  const graph = ensure()
  if (!graph) return
  const now = graph.ctx.currentTime
  if (now < hitAt) return
  hitAt = now + 0.3
  microAt = now + 0.22
  const { osc, filter, gain, sub, subGain } = graph
  osc.frequency.cancelScheduledValues(now)
  osc.frequency.setValueAtTime(quiet ? 240 : 720, now)
  osc.frequency.exponentialRampToValueAtTime(86, now + 0.05)
  filter.frequency.setTargetAtTime(quiet ? 480 : 1680, now, 0.008)
  gain.gain.cancelScheduledValues(now)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.linearRampToValueAtTime(quiet ? 0.028 : 0.05, now + 0.006)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07)
  sub.frequency.cancelScheduledValues(now)
  sub.frequency.setValueAtTime(52, now)
  sub.frequency.exponentialRampToValueAtTime(32, now + 0.16)
  subGain.gain.cancelScheduledValues(now)
  subGain.gain.setValueAtTime(0.0001, now)
  subGain.gain.linearRampToValueAtTime(quiet ? 0.035 : 0.068, now + 0.018)
  subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18)
}
