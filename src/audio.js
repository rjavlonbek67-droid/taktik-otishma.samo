let ctx = null
let master = null
let noiseBuffer = null
let drone = null

function getCtx() {
  if (ctx) return ctx
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) return null
  ctx = new AudioCtx()
  master = ctx.createGain()
  master.gain.value = 0.62
  master.connect(ctx.destination)
  return ctx
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
  if (c && c.state !== 'running') c.resume()
}

export function vibrate(ms) {
  try {
    navigator.vibrate?.(ms)
  } catch {
    /* haptic API is optional */
  }
}

export function gravitySound() {
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
  noiseHit(0.11, 900, 0.6, 0.07)
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
  const filter = c.createBiquadFilter()
  const gain = c.createGain()
  low.type = 'sine'
  high.type = 'triangle'
  low.frequency.value = 52
  high.frequency.value = 104
  filter.type = 'lowpass'
  filter.frequency.value = 360
  gain.gain.value = 0.02
  low.connect(filter)
  high.connect(filter)
  filter.connect(gain)
  gain.connect(master)
  low.start()
  high.start()
  drone = { low, high, gain }
}

export function setDrive(speed) {
  if (!drone || !ctx) return
  const t = ctx.currentTime
  drone.low.frequency.setTargetAtTime(44 + speed * 0.55, t, 0.15)
  drone.high.frequency.setTargetAtTime(88 + speed * 1.1, t, 0.15)
}

export function stopDrone() {
  if (!drone || !ctx) {
    drone = null
    return
  }
  const { low, high, gain } = drone
  const t = ctx.currentTime
  gain.gain.cancelScheduledValues(t)
  gain.gain.setTargetAtTime(0.0001, t, 0.04)
  try {
    low.stop(t + 0.18)
    high.stop(t + 0.18)
  } catch {
    /* already stopped */
  }
  drone = null
}
