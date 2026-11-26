import { audioBus, fxAllowed } from '../audio.js'

const TRIAL = 15

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
  osc.frequency.value = 480
  filter.type = 'bandpass'
  filter.frequency.value = 880
  filter.Q.value = 1.6
  gain.gain.value = 0.0001
  osc.connect(filter)
  filter.connect(gain)
  gain.connect(master)
  osc.start()
  bed = { ctx, osc, filter, gain, next: 0 }
  return bed
}

function blip(from, to, peak, dur) {
  if (document.hidden) return
  const graph = ensure()
  if (!graph) return
  const now = graph.ctx.currentTime
  if (now < graph.next) return
  graph.next = now + dur + 0.04
  const { osc, filter, gain } = graph
  osc.frequency.cancelScheduledValues(now)
  osc.frequency.setValueAtTime(from, now)
  osc.frequency.exponentialRampToValueAtTime(Math.max(48, to), now + dur)
  filter.frequency.setTargetAtTime(from < 200 ? 420 : 980, now, 0.01)
  gain.gain.cancelScheduledValues(now)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.linearRampToValueAtTime(peak, now + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur)
}

export function createSilence() {
  return {
    on: 0,
    left: 0,
    clean: 0,
    m1: 0,
    m2: 0,
    m3: 0,
    reward: 0,
    flash: 0,
    ping: 0,
    paid: 0,
  }
}

export function seedSilence(silence, shown) {
  resetSilence(silence)
  if (shown >= 1000) silence.m1 = 1
  if (shown >= 2000) silence.m2 = 1
  if (shown >= 3000) silence.m3 = 1
}

export function resetSilence(silence) {
  silence.on = 0
  silence.left = 0
  silence.clean = 0
  silence.m1 = 0
  silence.m2 = 0
  silence.m3 = 0
  silence.reward = 0
  silence.flash = 0
  silence.ping = 0
  silence.paid = 0
}

export function breakSilence(silence) {
  const was = silence.on
  silence.on = 0
  silence.left = 0
  silence.clean = 0
  silence.flash = 0
  silence.reward = 0
  if (was) silence.ping = 3
  return was
}

function openTrial(silence, reward, lod) {
  silence.on = 1
  silence.left = TRIAL
  silence.clean = 1
  silence.reward = reward
  silence.flash = 1
  silence.ping = 1
  silence.paid = 0
  blip(720, 420, lod ? 0.018 : 0.034, 0.05)
}

export function stepSilence(state, shown, dt) {
  const silence = state.silence
  const lod = state.lod ? 1 : 0
  if (silence.flash > 0) silence.flash = Math.max(0, silence.flash - dt * (lod ? 5.5 : 3.4))
  if (silence.on) {
    silence.left -= dt
    if (silence.left > 0) return
    silence.left = 0
    silence.on = 0
    if (silence.clean && silence.reward > 0) {
      state.bonus += silence.reward
      silence.paid = 1
    }
    silence.clean = 0
    silence.flash = 1
    silence.ping = 2
    blip(380, 220, lod ? 0.016 : 0.03, 0.06)
    return
  }
  if (!silence.m1 && shown >= 1000) {
    silence.m1 = 1
    openTrial(silence, lod ? 24 : 48, lod)
  } else if (!silence.m2 && shown >= 2000) {
    silence.m2 = 1
    openTrial(silence, lod ? 36 : 72, lod)
  } else if (!silence.m3 && shown >= 3000) {
    silence.m3 = 1
    openTrial(silence, lod ? 48 : 96, lod)
  }
}

export function takeSilence(silence) {
  if (!silence.ping) return 0
  const ping = silence.ping
  silence.ping = 0
  return ping
}

export function restSilenceAudio() {
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
