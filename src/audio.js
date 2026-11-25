let ctx = null
let master = null
let noiseBuffer = null
let drone = null
let echo = null
let muted = false

function getCtx() {
  if (ctx) return ctx
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) return null
  ctx = new AudioCtx()
  master = ctx.createGain()
  master.gain.value = muted ? 0.0001 : 0.62
  master.connect(ctx.destination)
  return ctx
}

export function setMuted(next) {
  muted = Boolean(next)
  const c = getCtx()
  if (!c || !master) return
  master.gain.setTargetAtTime(muted ? 0.0001 : 0.62, c.currentTime, 0.03)
}

function ensureEcho() {
  const c = getCtx()
  if (!c || !master || echo) return echo
  const delay = c.createDelay(0.6)
  const feedback = c.createGain()
  const tone = c.createBiquadFilter()
  const wet = c.createGain()
  delay.delayTime.value = 0.15
  feedback.gain.value = 0.42
  tone.type = 'bandpass'
  tone.frequency.value = 1400
  tone.Q.value = 0.7
  wet.gain.value = 0.5
  delay.connect(feedback)
  feedback.connect(tone)
  tone.connect(delay)
  delay.connect(wet)
  wet.connect(master)
  const conv = c.createConvolver()
  const length = Math.floor(c.sampleRate * 0.35)
  const buffer = c.createBuffer(2, length, c.sampleRate)
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel)
    for (let i = 0; i < length; i += 1) {
      const fade = 1 - i / length
      data[i] = (Math.random() * 2 - 1) * fade * fade * 0.7
    }
  }
  conv.buffer = buffer
  const room = c.createGain()
  room.gain.value = 0.28
  conv.connect(room)
  room.connect(master)
  echo = { delay, conv }
  return echo
}

function noise() {
  const c = getCtx()
  if (!c || noiseBuffer) return noiseBuffer
  const length = Math.floor(c.sampleRate * 0.4)
  noiseBuffer = c.createBuffer(1, length, c.sampleRate)
  const data = noiseBuffer.getChannelData(0)
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1
  return noiseBuffer
}

function burst({ type, from, to, dur, peak, filterFreq, filterTo, filterType = 'lowpass' }) {
  const c = getCtx()
  if (!c || !master) return
  const t = c.currentTime
  const osc = c.createOscillator()
  const gain = c.createGain()
  const filter = c.createBiquadFilter()
  osc.type = type
  osc.frequency.setValueAtTime(Math.max(1, from), t)
  if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur)
  filter.type = filterType
  filter.frequency.setValueAtTime(filterFreq, t)
  if (filterTo) filter.frequency.exponentialRampToValueAtTime(Math.max(20, filterTo), t + dur)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(filter)
  filter.connect(gain)
  gain.connect(master)
  osc.start(t)
  osc.stop(t + dur + 0.02)
  osc.onended = () => {
    osc.disconnect()
    filter.disconnect()
    gain.disconnect()
  }
}

function noiseHit(dur, freq, q, peak) {
  const c = getCtx()
  const buffer = noise()
  if (!c || !buffer || !master) return
  const t = c.currentTime
  const src = c.createBufferSource()
  const filter = c.createBiquadFilter()
  const gain = c.createGain()
  src.buffer = buffer
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(freq, t)
  filter.Q.value = q
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(filter)
  filter.connect(gain)
  gain.connect(master)
  src.start(t)
  src.stop(t + dur + 0.02)
  src.onended = () => {
    src.disconnect()
    filter.disconnect()
    gain.disconnect()
  }
}

export function unlock() {
  const c = getCtx()
  if (!c) return Promise.resolve()
  if (c.state !== 'running') return c.resume().catch(() => {})
  return Promise.resolve()
}

export function audioBus() {
  const c = getCtx()
  if (!c || !master) return null
  return { ctx: c, master }
}

export function fxAllowed() {
  if (!ctx || !master || muted) return false
  return ctx.state === 'running'
}

export function vibrate(ms) {
  try {
    navigator.vibrate?.(ms)
  } catch {
    /* haptic API is optional */
  }
}

export function gravitySound(side = 1) {
  unlock()
  burst({
    type: 'sawtooth',
    from: 280,
    to: 62,
    dur: 0.22,
    peak: 0.16,
    filterFreq: 1600,
    filterTo: 220,
  })
  burst({
    type: 'sine',
    from: 920,
    to: 180,
    dur: 0.13,
    peak: 0.1,
    filterFreq: 2400,
    filterTo: 400,
  })
  const c = getCtx()
  const buffer = noise()
  if (!c || !buffer || !master) return
  const t = c.currentTime
  const src = c.createBufferSource()
  const filter = c.createBiquadFilter()
  const gain = c.createGain()
  const pan = c.createStereoPanner()
  src.buffer = buffer
  filter.type = 'bandpass'
  filter.Q.value = 0.85
  filter.frequency.setValueAtTime(1900, t)
  filter.frequency.exponentialRampToValueAtTime(160, t + 0.2)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(0.13, t + 0.018)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2)
  pan.pan.setValueAtTime(Math.max(-0.85, Math.min(0.85, side * 0.7)), t)
  src.connect(filter)
  filter.connect(gain)
  gain.connect(pan)
  pan.connect(master)
  src.start(t)
  src.stop(t + 0.24)
  src.onended = () => {
    src.disconnect()
    filter.disconnect()
    gain.disconnect()
    pan.disconnect()
  }
}

export function pulseSound() {
  unlock()
  burst({
    type: 'sine',
    from: 140,
    to: 42,
    dur: 0.42,
    peak: 0.2,
    filterFreq: 800,
    filterTo: 120,
  })
  burst({
    type: 'triangle',
    from: 640,
    to: 180,
    dur: 0.28,
    peak: 0.05,
    filterFreq: 1800,
    filterTo: 300,
  })
  noiseHit(0.34, 420, 0.45, 0.09)
  const c = getCtx()
  const bus = ensureEcho()
  if (!c || !bus || !master) return
  const t = c.currentTime
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(1880, t)
  osc.frequency.exponentialRampToValueAtTime(540, t + 0.22)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(0.1, t + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.24)
  osc.connect(gain)
  gain.connect(master)
  gain.connect(bus.delay)
  gain.connect(bus.conv)
  osc.start(t)
  osc.stop(t + 0.28)
  osc.onended = () => {
    osc.disconnect()
    gain.disconnect()
  }
}

export function passSound() {
  unlock()
  burst({
    type: 'triangle',
    from: 680,
    to: 1240,
    dur: 0.09,
    peak: 0.07,
    filterFreq: 2200,
    filterType: 'highpass',
  })
}

export function nearMissSound(mult) {
  unlock()
  burst({
    type: 'triangle',
    from: 740,
    to: mult >= 3 ? 1880 : 1320,
    dur: mult >= 3 ? 0.16 : 0.11,
    peak: mult >= 3 ? 0.12 : 0.08,
    filterFreq: 2800,
    filterType: 'highpass',
  })
  burst({
    type: 'sine',
    from: mult >= 3 ? 1320 : 980,
    to: 420,
    dur: 0.14,
    peak: 0.05,
    filterFreq: 2400,
    filterTo: 700,
  })
}

export function focusSound() {
  unlock()
  burst({
    type: 'sine',
    from: 480,
    to: 860,
    dur: 0.12,
    peak: 0.04,
    filterFreq: 2000,
    filterTo: 900,
  })
}

export function impulseSound(speed) {
  unlock()
  const drive = Math.min(1, Math.max(0, (speed - 12) / 17))
  burst({
    type: 'sawtooth',
    from: 90 + drive * 40,
    to: 36,
    dur: 0.24,
    peak: 0.14 + drive * 0.08,
    filterFreq: 900 + drive * 800,
    filterTo: 140,
  })
  noiseHit(0.16, 500 + drive * 400, 0.5, 0.06 + drive * 0.05)
}

export function echoSyncSound() {
  unlock()
  burst({
    type: 'sine',
    from: 520,
    to: 1480,
    dur: 0.16,
    peak: 0.09,
    filterFreq: 2400,
    filterTo: 900,
  })
  burst({
    type: 'triangle',
    from: 880,
    to: 1760,
    dur: 0.12,
    peak: 0.05,
    filterFreq: 2800,
    filterType: 'highpass',
  })
}

export function echoWarnSound() {
  unlock()
  burst({
    type: 'square',
    from: 240,
    to: 70,
    dur: 0.14,
    peak: 0.08,
    filterFreq: 900,
    filterTo: 180,
  })
  noiseHit(0.1, 320, 0.7, 0.06)
}

function wetTone({ type, from, to, dur, peak }) {
  const c = getCtx()
  const bus = ensureEcho()
  if (!c || !master) return
  const t = c.currentTime
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(Math.max(1, from), t)
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(gain)
  gain.connect(master)
  if (bus) {
    gain.connect(bus.delay)
    gain.connect(bus.conv)
  }
  osc.start(t)
  osc.stop(t + dur + 0.02)
  osc.onended = () => {
    osc.disconnect()
    gain.disconnect()
  }
}

export function loanSound() {
  unlock()
  burst({
    type: 'sine',
    from: 92,
    to: 34,
    dur: 0.42,
    peak: 0.18,
    filterFreq: 220,
    filterTo: 70,
  })
  wetTone({ type: 'triangle', from: 180, to: 64, dur: 0.5, peak: 0.07 })
}

export function debtStrikeSound() {
  unlock()
  burst({
    type: 'square',
    from: 140,
    to: 32,
    dur: 0.22,
    peak: 0.16,
    filterFreq: 480,
    filterTo: 80,
  })
  noiseHit(0.16, 180, 0.8, 0.1)
  wetTone({ type: 'sawtooth', from: 90, to: 40, dur: 0.28, peak: 0.06 })
}

export function debtClearSound() {
  unlock()
  wetTone({ type: 'sine', from: 220, to: 1320, dur: 0.28, peak: 0.1 })
  burst({
    type: 'triangle',
    from: 440,
    to: 1760,
    dur: 0.18,
    peak: 0.06,
    filterFreq: 2400,
    filterType: 'highpass',
  })
}

export function clickShiftSound() {
  unlock()
  burst({
    type: 'square',
    from: 168,
    to: 58,
    dur: 0.032,
    peak: 0.1,
    filterFreq: 480,
    filterTo: 80,
  })
  burst({
    type: 'sine',
    from: 92,
    to: 40,
    dur: 0.036,
    peak: 0.15,
    filterFreq: 150,
    filterTo: 48,
  })
}

export function abyssSting() {
  unlock()
  burst({
    type: 'sawtooth',
    from: 70,
    to: 34,
    dur: 0.28,
    peak: 0.1,
    filterFreq: 220,
    filterTo: 60,
  })
  wetTone({ type: 'sine', from: 180, to: 48, dur: 0.36, peak: 0.05 })
}

export function mirageHum() {
  unlock()
  wetTone({ type: 'sine', from: 520, to: 880, dur: 0.42, peak: 0.045 })
  burst({
    type: 'triangle',
    from: 660,
    to: 990,
    dur: 0.2,
    peak: 0.03,
    filterFreq: 1800,
    filterTo: 700,
  })
}

export function mirageSnap() {
  unlock()
  burst({
    type: 'square',
    from: 120,
    to: 28,
    dur: 0.18,
    peak: 0.16,
    filterFreq: 360,
    filterTo: 50,
  })
  noiseHit(0.14, 140, 0.7, 0.08)
}

export function rewindSound() {
  unlock()
  burst({
    type: 'sawtooth',
    from: 240,
    to: 36,
    dur: 1.15,
    peak: 0.1,
    filterFreq: 1400,
    filterTo: 70,
  })
  wetTone({ type: 'sine', from: 520, to: 48, dur: 1.25, peak: 0.07 })
  noiseHit(0.4, 180, 0.5, 0.05)
}

export function decoySound() {
  unlock()
  wetTone({ type: 'sine', from: 920, to: 360, dur: 0.2, peak: 0.045 })
  burst({
    type: 'triangle',
    from: 700,
    to: 210,
    dur: 0.16,
    peak: 0.035,
    filterFreq: 2200,
    filterTo: 380,
  })
}

export function surgeSound() {
  unlock()
  burst({
    type: 'sawtooth',
    from: 48,
    to: 190,
    dur: 0.36,
    peak: 0.13,
    filterFreq: 180,
    filterTo: 1700,
  })
  wetTone({ type: 'square', from: 64, to: 260, dur: 0.42, peak: 0.05 })
}

export function surgeClearSound() {
  unlock()
  wetTone({ type: 'sine', from: 280, to: 1560, dur: 0.26, peak: 0.09 })
  burst({
    type: 'triangle',
    from: 440,
    to: 1320,
    dur: 0.14,
    peak: 0.05,
    filterFreq: 2400,
    filterTo: 600,
  })
}

export function heartSound() {
  unlock()
  burst({
    type: 'sine',
    from: 58,
    to: 28,
    dur: 0.16,
    peak: 0.22,
    filterFreq: 120,
    filterTo: 40,
  })
  burst({
    type: 'triangle',
    from: 92,
    to: 40,
    dur: 0.1,
    peak: 0.05,
    filterFreq: 240,
    filterTo: 60,
  })
}

export function repaySound() {
  unlock()
  burst({
    type: 'sawtooth',
    from: 42,
    to: 280,
    dur: 0.26,
    peak: 0.14,
    filterFreq: 240,
    filterTo: 1800,
  })
  wetTone({ type: 'square', from: 80, to: 420, dur: 0.22, peak: 0.05 })
  noiseHit(0.12, 900, 0.6, 0.07)
}

export function crashSound() {
  unlock()
  burst({
    type: 'square',
    from: 210,
    to: 40,
    dur: 0.36,
    peak: 0.18,
    filterFreq: 900,
    filterTo: 80,
  })
  burst({
    type: 'sawtooth',
    from: 130,
    to: 36,
    dur: 0.42,
    peak: 0.1,
    filterFreq: 600,
    filterTo: 70,
  })
  noiseHit(0.28, 180, 0.4, 0.14)
}

export function startDrone() {
  const c = getCtx()
  if (!c || !master) return
  stopDrone()
  const low = c.createOscillator()
  const high = c.createOscillator()
  const sub = c.createOscillator()
  const filter = c.createBiquadFilter()
  const gain = c.createGain()
  const subGain = c.createGain()
  const lfo = c.createOscillator()
  const lfoGain = c.createGain()
  low.type = 'sine'
  high.type = 'triangle'
  sub.type = 'sine'
  low.frequency.value = 52
  high.frequency.value = 104
  sub.frequency.value = 38
  filter.type = 'lowpass'
  filter.frequency.value = 360
  gain.gain.value = 0.02
  subGain.gain.value = 0.028
  lfo.frequency.value = 1.3
  lfoGain.gain.value = 0.02
  low.connect(filter)
  high.connect(filter)
  lfo.connect(lfoGain)
  lfoGain.connect(subGain.gain)
  sub.connect(subGain)
  subGain.connect(filter)
  filter.connect(gain)
  gain.connect(master)
  low.start()
  high.start()
  sub.start()
  lfo.start()
  drone = { low, high, sub, gain, filter, subGain, lfo, lfoGain }
}

export function setDrive(speed, focus = false) {
  if (!drone || !ctx) return
  const t = ctx.currentTime
  const drive = Math.min(1, Math.max(0, (speed - 12) / 17))
  const calm = focus ? 0.5 : 1
  drone.low.frequency.setTargetAtTime((40 + speed * 0.65) * calm, t, 0.12)
  drone.high.frequency.setTargetAtTime((88 + speed * 1.25) * calm, t, 0.12)
  drone.sub?.frequency.setTargetAtTime((32 + drive * 16) * calm, t, 0.12)
  drone.gain.gain.setTargetAtTime((0.02 + drive * 0.055) * (focus ? 0.5 : 1), t, 0.08)
  drone.subGain?.gain.setTargetAtTime(focus ? 0.01 : 0.018 + drive * 0.05, t, 0.1)
  drone.lfo?.frequency.setTargetAtTime(focus ? 0.4 : 1.05 + drive * 3.1, t, 0.12)
  drone.lfoGain?.gain.setTargetAtTime(focus ? 0.006 : 0.016 + drive * 0.04, t, 0.12)
  drone.filter.frequency.setTargetAtTime(focus ? 150 : 240 + drive * 1600, t, focus ? 0.05 : 0.1)
}

export function stopDrone() {
  if (!drone || !ctx) {
    drone = null
    return
  }
  const { low, high, sub, lfo, gain } = drone
  const t = ctx.currentTime
  gain.gain.cancelScheduledValues(t)
  gain.gain.setTargetAtTime(0.0001, t, 0.04)
  try {
    low.stop(t + 0.18)
    high.stop(t + 0.18)
    sub?.stop(t + 0.18)
    lfo?.stop(t + 0.18)
  } catch {
    /* already stopped */
  }
  drone = null
}

export function tremorWarn() {
  unlock()
  burst({
    type: 'sine',
    from: 96,
    to: 52,
    dur: 0.14,
    peak: 0.04,
    filterFreq: 170,
    filterTo: 70,
  })
}

export function tremorHit() {
  unlock()
  burst({
    type: 'sine',
    from: 74,
    to: 32,
    dur: 0.22,
    peak: 0.11,
    filterFreq: 150,
    filterTo: 48,
  })
  noiseHit(0.08, 90, 0.45, 0.035)
}

export function tremorHeart() {
  unlock()
  burst({
    type: 'triangle',
    from: 46,
    to: 34,
    dur: 0.11,
    peak: 0.065,
    filterFreq: 110,
    filterTo: 55,
  })
}

export function tremorBreach() {
  unlock()
  burst({
    type: 'sawtooth',
    from: 88,
    to: 28,
    dur: 0.32,
    peak: 0.13,
    filterFreq: 220,
    filterTo: 42,
  })
  noiseHit(0.14, 100, 0.4, 0.05)
}

export function curseSting() {
  unlock()
  burst({
    type: 'sawtooth',
    from: 62,
    to: 28,
    dur: 0.42,
    peak: 0.12,
    filterFreq: 190,
    filterTo: 40,
  })
  wetTone({ type: 'sine', from: 96, to: 42, dur: 0.48, peak: 0.055 })
}

export function finaleSting() {
  unlock()
  burst({
    type: 'sine',
    from: 58,
    to: 26,
    dur: 0.55,
    peak: 0.14,
    filterFreq: 140,
    filterTo: 36,
  })
  wetTone({ type: 'triangle', from: 74, to: 32, dur: 0.62, peak: 0.05 })
  noiseHit(0.22, 70, 0.35, 0.05)
}
