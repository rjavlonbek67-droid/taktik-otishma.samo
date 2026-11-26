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
  osc.type = 'triangle'
  osc.frequency.value = 320
  filter.type = 'lowpass'
  filter.frequency.value = 900
  filter.Q.value = 0.7
  gain.gain.value = 0.0001
  osc.connect(filter)
  filter.connect(gain)
  gain.connect(master)
  osc.start()
  bed = { ctx, osc, filter, gain, next: 0 }
  return bed
}

function blip(from, to, peak, dur, cutoff) {
  if (document.hidden) return
  const graph = ensure()
  if (!graph) return
  const now = graph.ctx.currentTime
  if (now < graph.next) return
  graph.next = now + 0.09
  const { osc, filter, gain } = graph
  osc.frequency.cancelScheduledValues(now)
  osc.frequency.setValueAtTime(from, now)
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, to), now + dur)
  filter.frequency.setTargetAtTime(cutoff, now, 0.01)
  gain.gain.cancelScheduledValues(now)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.linearRampToValueAtTime(peak, now + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur)
}

export function createMind() {
  return {
    lastSign: 0,
    run: 0,
    beat: 0,
    rhythm: 0,
    lastFlip: 0,
    arm: 0,
    armCd: 2.4,
    decoy: 0,
    decoyWall: 0,
    decoySlot: -1,
    cd: 7,
    fakeAsk: 0,
    realIn: 0,
    band: 0,
    at: 0,
    press: 0,
    ping: 0,
  }
}

export function resetMind(mind) {
  mind.lastSign = 0
  mind.run = 0
  mind.beat = 0
  mind.rhythm = 0
  mind.lastFlip = 0
  mind.arm = 0
  mind.armCd = 2.4
  mind.decoy = 0
  mind.decoyWall = 0
  mind.decoySlot = -1
  mind.cd = 7
  mind.fakeAsk = 0
  mind.realIn = 0
  mind.band = 0
  mind.at = 0
  mind.press = 0
  mind.ping = 0
}

export function noteHabit(mind, sign, time) {
  if (!sign) return
  const gap = mind.lastFlip > 0 ? time - mind.lastFlip : 0
  if (gap > 0.08 && gap < 1.6) {
    if (mind.rhythm > 0 && Math.abs(gap - mind.rhythm) < 0.11) mind.beat = Math.min(6, mind.beat + 1)
    else mind.beat = Math.max(0, mind.beat - 1)
    mind.rhythm += (gap - mind.rhythm) * 0.4
  }
  if (sign === mind.lastSign) mind.run = Math.min(8, mind.run + 1)
  else mind.run = 1
  mind.lastSign = sign
  mind.lastFlip = time
}

export function stepMind(state, shown, dt) {
  const mind = state.mind
  const lod = state.lod
  mind.armCd = Math.max(0, mind.armCd - dt)
  mind.cd = Math.max(0, mind.cd - dt)
  mind.press = Math.max(0, mind.press - dt * (lod ? 0.72 : 0.4))
  if (mind.decoy > 0) mind.decoy = Math.max(0, mind.decoy - dt)
  else mind.decoySlot = -1

  const habit = mind.run >= (lod ? 5 : 3) || mind.beat >= (lod ? 5 : 4)
  if (!mind.arm && mind.armCd <= 0 && shown >= 750 && habit) {
    mind.arm = 1
    mind.armCd = lod ? 6.4 : 3.3
  }

  if (mind.realIn > 0) {
    mind.realIn -= dt
    if (mind.realIn <= 0) {
      mind.realIn = 0
      blip(560, 340, lod ? 0.016 : 0.03, 0.04, 1400)
    }
  }

  if (shown >= 750 && mind.cd <= 0 && mind.decoy <= 0 && state.lie <= 0 && state.age > 8) {
    let closeAhead = 99
    let closeWall = state.targetWall
    let slot = -1
    let slotAhead = 99
    const slots = state.slots
    for (let i = 0; i < slots.length; i += 1) {
      const item = slots[i]
      if (!item.active) continue
      const ahead = item.z - state.z
      if (ahead > 0.4 && ahead < closeAhead) {
        closeAhead = ahead
        closeWall = item.wall
      }
    }
    for (let i = 0; i < slots.length; i += 1) {
      const item = slots[i]
      if (!item.active || item.wall === closeWall) continue
      const ahead = item.z - state.z
      if (ahead < closeAhead + 4 || ahead > 30) continue
      if (ahead < slotAhead) {
        slotAhead = ahead
        slot = i
      }
    }
    mind.decoySlot = slot
    mind.decoyWall = slot >= 0 ? slots[slot].wall : (closeWall + 1) % 4
    mind.decoy = lod ? 0.42 : 0.7
    mind.cd = (lod ? 15 : 9.5) + (shown >= 2000 ? 0 : 1.5)
    mind.fakeAsk = 1
    mind.realIn = 0.16
    state.lie = mind.decoy
    state.lieCd = lod ? 6 : 4.2
    state.fakeWarn = mind.decoyWall % 2 === 0 ? 'CHAP TOZA' : 'ONG XAVF'
    state.fakeSpeed = 11 + (mind.decoyWall * 3)
    state.fakeDist = Math.floor(state.z)
    state.fakeSignal = 72
    blip(240, 160, lod ? 0.01 : 0.018, 0.045, 520)
  }

  let band = 0
  if (shown >= 3000) band = 3000
  else if (shown >= 2000) band = 2000
  else if (shown >= 1000) band = 1000
  if (band > mind.band) {
    mind.band = band
    mind.at = band
    mind.press = 1
    mind.ping = 1
    blip(150, 78, lod ? 0.02 : 0.04, 0.07, 360)
  }
}

export function takeMindPing(mind) {
  if (!mind.ping) return 0
  const at = mind.at
  mind.ping = 0
  return at
}

export function restMindAudio() {
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
