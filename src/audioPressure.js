import { audioBus } from './audio.js'

let bed = null

function tensionOf(score) {
  if (score < 250) return 0
  if (score < 400) return ((score - 250) / 150) * 0.06
  if (score < 520) return 0.06 + ((score - 400) / 120) * 0.3
  if (score < 700) return 0.36 + ((score - 520) / 180) * 0.16
  if (score < 760) return 0.52 + ((score - 700) / 60) * 0.2
  if (score < 900) return 0.72 + ((score - 760) / 140) * 0.12
  return Math.min(1, 0.84 + ((score - 900) / 140) * 0.16)
}

function makeNoise(ctx) {
  const length = Math.floor(ctx.sampleRate * 0.45)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let hold = 0
  for (let i = 0; i < length; i += 1) {
    if ((i & 63) === 0) hold = Math.random() * 2 - 1
    data[i] = hold * 0.65 + (Math.random() * 2 - 1) * 0.35
  }
  return buffer
}

function panner(ctx, value) {
  if (typeof ctx.createStereoPanner !== 'function') {
    const gain = ctx.createGain()
    gain.gain.value = 1
    return gain
  }
  const node = ctx.createStereoPanner()
  node.pan.value = value
  return node
}

function ensure() {
  if (bed) return bed
  const bus = audioBus()
  if (!bus) return null
  const { ctx, master } = bus
  const out = ctx.createGain()
  out.gain.value = 0.0001

  const sub = ctx.createOscillator()
  const subFilter = ctx.createBiquadFilter()
  const subGain = ctx.createGain()
  sub.type = 'sine'
  sub.frequency.value = 30
  subFilter.type = 'lowpass'
  subFilter.frequency.value = 78
  subFilter.Q.value = 0.6
  subGain.gain.value = 0.0001
  sub.connect(subFilter)
  subFilter.connect(subGain)
  subGain.connect(out)

  const resL = ctx.createOscillator()
  const resR = ctx.createOscillator()
  const delay = ctx.createDelay(0.02)
  const left = panner(ctx, -0.28)
  const right = panner(ctx, 0.28)
  const resGain = ctx.createGain()
  resL.type = 'sine'
  resR.type = 'sine'
  resL.frequency.value = 54
  resR.frequency.value = 54
  resR.detune.value = 3
  delay.delayTime.value = 0.0004
  resGain.gain.value = 0.0001
  resL.connect(left)
  left.connect(resGain)
  resR.connect(delay)
  delay.connect(right)
  right.connect(resGain)
  resGain.connect(out)

  const air = ctx.createBufferSource()
  const airFilter = ctx.createBiquadFilter()
  const airGain = ctx.createGain()
  air.buffer = makeNoise(ctx)
  air.loop = true
  airFilter.type = 'bandpass'
  airFilter.frequency.value = 120
  airFilter.Q.value = 0.55
  airGain.gain.value = 0.0001
  air.connect(airFilter)
  airFilter.connect(airGain)
  airGain.connect(out)

  const heart = ctx.createOscillator()
  const heartFilter = ctx.createBiquadFilter()
  const heartGain = ctx.createGain()
  heart.type = 'triangle'
  heart.frequency.value = 46
  heartFilter.type = 'lowpass'
  heartFilter.frequency.value = 140
  heartFilter.Q.value = 0.7
  heartGain.gain.value = 0.0001
  heart.connect(heartFilter)
  heartFilter.connect(heartGain)
  heartGain.connect(out)

  const lfo = ctx.createOscillator()
  const lfoGain = ctx.createGain()
  const lfoInv = ctx.createGain()
  lfo.frequency.value = 0.08
  lfoGain.gain.value = 0.0001
  lfoInv.gain.value = -1
  lfo.connect(lfoGain)
  if (left.pan && right.pan) {
    lfoGain.connect(lfoInv)
    lfoInv.connect(left.pan)
    lfoGain.connect(right.pan)
  }

  out.connect(master)
  sub.start()
  resL.start()
  resR.start()
  air.start()
  heart.start()
  lfo.start()

  bed = {
    ctx,
    out,
    sub,
    subGain,
    resL,
    resR,
    delay,
    resGain,
    airFilter,
    airGain,
    heartGain,
    lfo,
    lfoGain,
    clock: 0,
    restAt: 0,
    nextBeat: 0,
    beating: false,
  }
  return bed
}

function pulseHeart(graph, now, interval, amp) {
  if (amp < 0.008) {
    if (graph.beating) {
      graph.heartGain.gain.cancelScheduledValues(now)
      graph.heartGain.gain.setTargetAtTime(0.0001, now, 0.06)
      graph.beating = false
    }
    return
  }
  if (now < graph.nextBeat) return
  const gain = graph.heartGain.gain
  const gap = Math.max(interval, 0.4)
  gain.cancelScheduledValues(now)
  gain.setValueAtTime(0.0001, now)
  gain.linearRampToValueAtTime(amp, now + 0.028)
  gain.linearRampToValueAtTime(0.0001, now + 0.09)
  gain.linearRampToValueAtTime(amp * 0.55, now + 0.15)
  gain.linearRampToValueAtTime(0.0001, now + 0.26)
  graph.nextBeat = now + gap
  graph.beating = true
}

export function syncPressure(score, speed, surge, abyssStage, mirage, watch, heart, dt) {
  const graph = ensure()
  if (!graph) return
  const now = graph.ctx.currentTime
  let tension = tensionOf(score)
  if (surge > 0) tension = Math.max(tension, 0.78)
  if (abyssStage >= 6) tension = Math.max(tension, 0.96)
  else if (abyssStage >= 5) tension = Math.max(tension, 0.88)
  else if (abyssStage >= 3) tension = Math.max(tension, 0.6)
  if (heart > 0) tension = Math.max(tension, 0.5)

  const danger = surge > 0 || heart > 0 || abyssStage >= 4
  let interval = 1.22 - tension * 0.42 - Math.min(0.1, speed / 360)
  if (surge > 0) interval = 0.48
  else if (abyssStage >= 6) interval = 0.52
  else if (abyssStage >= 4) interval = 0.66
  else if (heart > 0) interval = 0.6
  const amp = danger || tension > 0.34 ? 0.018 + tension * 0.05 : tension * 0.02
  pulseHeart(graph, now, interval, amp)

  graph.clock -= dt
  if (graph.clock > 0) return
  graph.clock = 0.1

  const shift = mirage > 0 || watch > 0.45
  const subHz = 27 + tension * 11
  graph.out.gain.setTargetAtTime(0.12 + tension * 0.78, now, 0.18)
  graph.sub.frequency.setTargetAtTime(subHz, now, 0.2)
  graph.subGain.gain.setTargetAtTime(0.008 + tension * 0.05, now, 0.18)
  graph.resL.frequency.setTargetAtTime(48 + tension * 22, now, 0.22)
  graph.resR.frequency.setTargetAtTime(48 + tension * 22, now, 0.22)
  graph.resR.detune.setTargetAtTime(shift ? 11 + tension * 16 : 2.5, now, 0.15)
  graph.resGain.gain.setTargetAtTime(0.004 + tension * 0.026, now, 0.18)
  graph.airFilter.frequency.setTargetAtTime(90 + tension * 80, now, 0.25)
  graph.airGain.gain.setTargetAtTime(0.002 + tension * 0.014, now, 0.2)
  graph.delay.delayTime.setTargetAtTime(shift ? 0.0034 : 0.00035, now, 0.12)
  graph.lfo.frequency.setTargetAtTime(shift ? (mirage > 0 ? 0.33 : 0.14) : 0.05, now, 0.2)
  graph.lfoGain.gain.setTargetAtTime(shift ? 0.55 : 0.0001, now, 0.16)
}

export function restPressure() {
  if (!bed) return
  const now = bed.ctx.currentTime
  if (now < bed.restAt) return
  bed.restAt = now + 0.25
  bed.clock = 0
  bed.out.gain.setTargetAtTime(0.0001, now, 0.08)
  bed.subGain.gain.setTargetAtTime(0.0001, now, 0.08)
  bed.resGain.gain.setTargetAtTime(0.0001, now, 0.08)
  bed.airGain.gain.setTargetAtTime(0.0001, now, 0.08)
  bed.lfoGain.gain.setTargetAtTime(0.0001, now, 0.08)
  bed.heartGain.gain.cancelScheduledValues(now)
  bed.heartGain.gain.setTargetAtTime(0.0001, now, 0.05)
  bed.nextBeat = now + 0.5
  bed.beating = false
}
