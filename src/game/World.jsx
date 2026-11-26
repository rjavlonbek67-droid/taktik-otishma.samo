import { memo, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, ChromaticAberration, EffectComposer } from '@react-three/postprocessing'
import * as THREE from 'three'
import {
  crashSound,
  curseSting,
  debtClearSound,
  debtStrikeSound,
  decoySound,
  echoSyncSound,
  echoWarnSound,
  heartSound,
  loanSound,
  nearMissSound,
  passSound,
  pulseSound,
  repaySound,
  restTapAudio,
  rewindSound,
  setDrive,
  stopDrone,
  surgeClearSound,
  surgeSound,
  tapTick,
  tremorBreach,
  tremorHeart,
  tremorHit,
  tremorWarn,
  vibrate,
} from '../audio.js'
import { restPressure, syncPressure } from '../audioPressure.js'
import { COLORS, PLAYER_R, POOL, STICK, WALL } from './constants.js'
import { buildTunnelGeometry, createTunnelMaterial, syncTunnel } from './tunnel.js'
import { ABYSS_TINT, stepAbyss } from './abyss.js'
import { applyTremor, createTremor, resetTremor, stepTremor } from './tremor.js'
import { applyCurse, createCurse, curseBoon, curseScore, resetCurse, stepCurse } from './curse.js'
import { createScale, resetScale, restScaleAudio, scaleChime, stepScale, takeScalePing } from './scale.js'
import { createMind, noteHabit, resetMind, restMindAudio, stepMind, takeMindPing } from './mind.js'

const HALF_THIN = 0.26
const HALF_WIDE = 0.85
const HALF_DEEP = 0.64
const OMEGA_FAR = 18
const OMEGA_NEAR = 11
const turnScratch = { angle: 0, vel: 0 }

function integrateAngle(angle, vel, target, step) {
  const diff = shortest(target, angle)
  const far = Math.abs(diff) > 0.4
  const omega = far ? OMEGA_FAR : OMEGA_NEAR
  const accel = diff * omega * omega - 2 * omega * vel
  const cap = far ? 14 : 8
  const nextVel = Math.max(-cap, Math.min(cap, vel + accel * step))
  turnScratch.angle = angle + nextVel * step
  turnScratch.vel = nextVel
  return turnScratch
}

function turnEase(u) {
  const t = u < 0 ? 0 : (u > 1 ? 1 : u)
  const cubic = 1 - (1 - t) * (1 - t) * (1 - t)
  const exp = 1 - Math.exp(-t * 6)
  return exp * 0.42 + cubic * 0.58
}
const ARC = 32
const SPECKS = 72
const SPARKS = 48

function shortest(target, current) {
  return Math.atan2(Math.sin(target - current), Math.cos(target - current))
}

function placeBall(z, angle, targetWall, out) {
  const err = Math.abs(shortest(targetWall * Math.PI * 0.5, angle))
  const lift = Math.sin(Math.min(1, err / (Math.PI * 0.5)) * Math.PI) * 0.74
  const radial = STICK - lift
  out.set(Math.sin(angle) * radial, -Math.cos(angle) * radial, z)
  return out
}

function boxCenter(wall, z, out) {
  const a = wall * Math.PI * 0.5
  const dist = WALL - HALF_THIN
  out.set(Math.sin(a) * dist, -Math.cos(a) * dist, z)
  return out
}

function boxGap(ball, wall, center) {
  const wide = wall % 2 === 0
  const hx = wide ? HALF_WIDE : HALF_THIN
  const hy = wide ? HALF_THIN : HALF_WIDE
  const dx = Math.max(Math.abs(ball.x - center.x) - hx, 0)
  const dy = Math.max(Math.abs(ball.y - center.y) - hy, 0)
  const dz = Math.max(Math.abs(ball.z - center.z) - HALF_DEEP, 0)
  return Math.hypot(dx, dy, dz) - PLAYER_R
}

function sphereHitsBox(ball, wall, center) {
  return boxGap(ball, wall, center) <= 0
}

function pickBlocked(count, avoid, bias) {
  const walls = [0, 1, 2, 3]
  for (let i = walls.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const swap = walls[i]
    walls[i] = walls[j]
    walls[j] = swap
  }
  if (avoid != null && count === 1 && walls[0] === avoid) {
    const swap = walls[0]
    walls[0] = walls[1]
    walls[1] = swap
  }
  if (bias != null && count > 0 && count < 4) {
    let at = -1
    for (let i = 0; i < 4; i += 1) if (walls[i] === bias) at = i
    if (at >= count) {
      const held = walls[count - 1]
      walls[count - 1] = walls[at]
      walls[at] = held
    }
  }
  return walls.slice(0, count)
}

function createRuntime() {
  return {
    runId: -1,
    z: 0,
    prevZ: 0,
    angle: 0,
    angleVel: 0,
    targetWall: 0,
    bonus: 0,
    age: 0,
    time: 0,
    didIntro: false,
    cooldown: 0,
    crashed: false,
    alive: true,
    nextSpawn: 36,
    gid: 1,
    pid: 1,
    lastScore: -1,
    mix: 0,
    boost: 0,
    dwell: 0,
    suspicion: 0,
    peekSide: 1,
    peekKick: 0,
    armedPeek: 0,
    flinch: 0,
    breath: 0,
    sway: 1,
    threat: 0,
    threatX: 0,
    threatY: 0,
    recoil: 0,
    rule: 0,
    dutch: 0,
    dutchSide: 1,
    gates: [],
    pulses: [],
    slots: Array.from({ length: POOL }, () => ({
      active: false,
      z: 0,
      wall: 0,
      glow: 0,
      color: COLORS[0],
      gateId: 0,
      lastPulse: 0,
      lastWave: 0,
      missed: false,
      flash: 0,
    })),
    waves: [],
    wid: 1,
    sparks: Array.from({ length: SPARKS }, () => ({
      life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
    })),
    sparkCursor: 0,
    combo: 0,
    echoCombo: 0,
    lastMiss: -10,
    lastEcho: -10,
    glitch: 0,
    ruleLatch: 0,
    echoes: [],
    loan: 'idle',
    loanT: 0,
    loanCd: 0,
    loanClean: true,
    mood: 0.35,
    strain: 0,
    rhythm: 1,
    rewind: 0,
    rewindCd: 5,
    heart: 0,
    heartCd: 9,
    heartGap: 0,
    heartFlash: 0,
    lie: 0,
    lieCd: 2.5,
    lieClock: 7,
    hudTick: 0,
    fakeSpeed: 0,
    fakeDist: 0,
    fakeSignal: 0,
    fakeWarn: 'SOKIN',
    scanTime: 0,
    witness: { on: false, wall: 0, z: 0, life: 0, cd: 3.5 },
    blind: { on: false, z: 0, len: 7, cd: 7 },
    decoys: [
      { on: false, z: 0, wall: 0, held: true },
      { on: false, z: 0, wall: 0, held: true },
    ],
    decoyCd: 4,
    decoyCombo: 0,
    lastDecoy: -10,
    surge: 0,
    surgeCd: 11,
    surgeClean: true,
    surgePulse: 0,
    surgeEvent: null,
    pulsePool: Array.from({ length: 4 }, () => ({
      id: 0,
      age: 0,
      radius: 0,
      sharp: 0,
      pos: new THREE.Vector3(),
    })),
    wavePool: Array.from({ length: 3 }, () => ({ id: 0, z: 0, life: 0, sharp: 0 })),
    echoPool: Array.from({ length: 8 }, () => ({ z: 0, wall: 0, synced: false })),
    fpsSmooth: 60,
    fpsReport: 0.4,
    fpsShown: 0,
    lod: 0,
    lodHold: 0,
    moodPack: { mood: 0.35, rhythm: 1, strain: 0, blindZ: 0, blindLen: 6, blindAmt: 0 },
    signals: { drive: 0, threat: 0, dirx: 0, diry: 0, spike: false, rule: 0 },
    turning: false,
    turnFrom: 0,
    turnDelta: 0,
    turnU: 1,
    fovKick: 0,
    hitStop: 0,
    arrow: 0,
    arrowSign: 1,
    abyssStage: 0,
    abyssMul: 1,
    abyssPush: 0,
    abyssCold: 0,
    abyssGlitch: 0,
    abyssWatch: 0,
    abyssCd: 9,
    abyssPulse: 2.2,
    abyssPing: 0,
    abyssSnap: 0,
    mirage: 0,
    tremor: createTremor(),
    curse: createCurse(),
    scale: createScale(),
    mind: createMind(),
    lodApplied: -1,
  }
}

function resetRuntime(state) {
  state.z = 0
  state.prevZ = 0
  state.angle = 0
  state.angleVel = 0
  state.targetWall = 0
  state.bonus = 0
  state.age = 0
  state.didIntro = false
  state.cooldown = 0
  state.crashed = false
  state.alive = true
  state.nextSpawn = 36
  state.gid = 1
  state.pid = 1
  state.lastScore = -1
  state.boost = 0
  state.dwell = 0
  state.suspicion = 0
  state.peekKick = 0
  state.armedPeek = 0
  state.flinch = 0
  state.sway = 1
  state.threat = 0
  state.threatX = 0
  state.threatY = 0
  state.recoil = 0
  state.rule = 0
  state.dutch = 0
  state.combo = 0
  state.echoCombo = 0
  state.lastMiss = -10
  state.lastEcho = -10
  state.glitch = 0
  state.ruleLatch = 0
  state.echoes.length = 0
  state.loan = 'idle'
  state.loanT = 0
  state.loanCd = 0
  state.loanClean = true
  state.mood = 0.35
  state.strain = 0
  state.rhythm = 1
  state.rewind = 0
  state.rewindCd = 5
  state.heart = 0
  state.heartCd = 9
  state.heartGap = 0
  state.heartFlash = 0
  state.lie = 0
  state.lieCd = 2.5
  state.lieClock = 7
  state.hudTick = 0
  state.scanTime = 0
  state.witness.on = false
  state.witness.life = 0
  state.witness.cd = 3.5
  state.blind.on = false
  state.blind.cd = 7
  state.decoyCd = 4
  state.decoyCombo = 0
  state.lastDecoy = -10
  state.surge = 0
  state.surgeCd = 11
  state.surgeClean = true
  state.surgePulse = 0
  state.surgeEvent = null
  state.turning = false
  state.turnU = 1
  state.fovKick = 0
  state.hitStop = 0
  state.arrow = 0
  state.abyssStage = 0
  state.abyssMul = 1
  state.abyssPush = 0
  state.abyssCold = 0
  state.abyssGlitch = 0
  state.abyssWatch = 0
  state.abyssCd = 9
  state.abyssPulse = 2.2
  state.abyssPing = 0
  state.abyssSnap = 0
  state.mirage = 0
  resetTremor(state.tremor)
  resetCurse(state.curse)
  resetScale(state.scale)
  resetMind(state.mind)
  for (const decoy of state.decoys) decoy.on = false
  state.gates.length = 0
  state.pulses.length = 0
  state.waves.length = 0
  for (const spark of state.sparks) spark.life = 0
  for (const slot of state.slots) {
    slot.active = false
    slot.glow = 0
    slot.lastPulse = 0
    slot.lastWave = 0
    slot.missed = false
    slot.flash = 0
  }
}

function claim(list, pool) {
  for (let i = 0; i < pool.length; i += 1) {
    if (list.indexOf(pool[i]) === -1) {
      list.push(pool[i])
      return pool[i]
    }
  }
  const item = list.shift()
  list.push(item)
  return item
}

function emitPulse(state, origin, sharp = 0) {
  const pulse = claim(state.pulses, state.pulsePool)
  pulse.id = state.pid
  pulse.age = 0
  pulse.radius = 0.45
  pulse.sharp = sharp ? 1 : 0
  pulse.pos.copy(origin)
  state.pid += 1
  const wave = claim(state.waves, state.wavePool)
  wave.id = state.wid
  wave.z = origin.z
  wave.life = 0
  wave.sharp = sharp ? 1 : 0
  state.wid += 1
  maybeDecoy(state)
}

function burstSparks(state, origin, count) {
  const amount = state.lod ? Math.max(3, count >> 1) : count
  for (let n = 0; n < amount; n += 1) {
    const spark = state.sparks[state.sparkCursor % SPARKS]
    state.sparkCursor += 1
    const angle = Math.random() * Math.PI * 2
    const speed = 0.8 + Math.random() * 2.4
    spark.life = 0.18 + Math.random() * 0.16
    spark.x = origin.x
    spark.y = origin.y
    spark.z = origin.z
    spark.vx = Math.cos(angle) * speed
    spark.vy = Math.sin(angle) * speed
    spark.vz = (Math.random() - 0.25) * 3.4
  }
}

function tripGlitch(state, callbacks) {
  state.glitch = 1
  callbacks.current.onGlitch?.()
}

function rememberEcho(state) {
  const echo = claim(state.echoes, state.echoPool)
  echo.z = state.z + 46
  echo.wall = state.targetWall
  echo.synced = false
}

function stepLoan(state, dt, callbacks) {
  state.loanEvent = null
  state.loanCd = Math.max(0, state.loanCd - dt)
  if (state.loan === 'slow') {
    state.loanT -= dt
    if (state.loanT <= 0) {
      state.loan = 'repay'
      state.loanT = 1.35
      state.boost = Math.max(state.boost, 1)
      state.loanEvent = 'peak'
      repaySound()
      callbacks.current.onLoan?.({ phase: 'repay' })
    }
  } else if (state.loan === 'repay') {
    state.loanT -= dt
    if (state.loanT <= 0) {
      const paid = state.alive && state.loanClean
      state.loan = 'idle'
      state.loanCd = 8
      if (paid) {
        const points = 96 + state.combo * 10 + state.echoCombo * 14
        state.bonus += points
        state.loanEvent = 'clear'
        callbacks.current.onLoan?.({ phase: 'clear', points })
      } else {
        state.loanEvent = 'fail'
      }
      callbacks.current.onLoan?.({ phase: 'idle' })
    }
  }
}

function playLoanEvent(state, callbacks, origin) {
  if (state.loanEvent === 'peak') {
    state.recoil = 1
    state.suspicion = 1
    state.dutch = 1
    state.glitch = 1
    emitPulse(state, origin, 1)
    burstSparks(state, origin, 22)
    tripGlitch(state, callbacks)
  } else if (state.loanEvent === 'clear') {
    state.flinch = 1
    state.suspicion = 0.15
    state.peekKick = 0
    state.glitch = Math.max(state.glitch, 0.45)
    emitPulse(state, origin, 1)
    burstSparks(state, origin, 14)
    debtClearSound()
  } else if (state.loanEvent === 'fail') {
    state.recoil = 0.45
    state.strain = Math.min(1, state.strain + 0.25)
  }
  state.loanEvent = null
}

function dreadAhead(state, v, reach) {
  let closest = 99
  for (const slot of state.slots) {
    if (!slot.active || slot.wall !== state.targetWall) continue
    const ahead = slot.z - state.z
    if (ahead < 0.45 || ahead > reach) continue
    if (ahead < closest) closest = ahead
    placeBall(slot.z, state.targetWall * Math.PI * 0.5, state.targetWall, v.sample)
    boxCenter(slot.wall, slot.z, v.box)
    if (ahead < 4.4 && sphereHitsBox(v.sample, slot.wall, v.box)) return true
  }
  return state.strain > 0.72 && closest < 6.2
}

function stepDread(state, dt, callbacks, v, cruise) {
  stepSurge(state, dt, callbacks)
  state.rewindCd = Math.max(0, state.rewindCd - dt)
  state.heartCd = Math.max(0, state.heartCd - dt)
  state.heartFlash = Math.max(0, state.heartFlash - dt)
  let speedSign = 1
  if (state.rewind > 0) {
    state.rewind -= dt
    speedSign = -1
    if (state.rewind <= 0) {
      state.rewind = 0
      callbacks.current.onDread?.({ phase: 'fracture-end' })
    }
  } else if (
    state.rewindCd <= 0
    && state.heart <= 0
    && state.loan !== 'repay'
    && state.surge <= 0
    && state.age > 6
    && dreadAhead(state, v, 7.2)
  ) {
    state.rewind = 1.38
    state.rewindCd = 13
    speedSign = -1
    state.glitch = Math.max(state.glitch, 0.85)
    tripGlitch(state, callbacks)
    rewindSound()
    callbacks.current.onDread?.({ phase: 'fracture' })
  }

  if (state.heart > 0) {
    state.heart -= dt
    state.heartGap -= dt
    if (state.heartGap <= 0 && state.heart > 0) {
      state.heartGap = 0.58
      state.heartFlash = 0.16
      placeBall(state.z, state.angle, state.targetWall, v.pos)
      emitPulse(state, v.pos)
      heartSound()
      state.recoil = Math.max(state.recoil, 0.42)
    }
    if (state.heart <= 0) {
      state.heart = 0
      state.heartCd = 15 + Math.random() * 7
      callbacks.current.onDread?.({ phase: 'heart-end' })
    }
  } else if (
    state.heartCd <= 0
    && state.rewind <= 0
    && state.surge <= 0
    && state.loan === 'idle'
    && state.age > 8
  ) {
    state.heart = 2.5
    state.heartGap = 0.02
    callbacks.current.onDread?.({ phase: 'heart' })
  }

  state.lieCd = Math.max(0, state.lieCd - dt)
  state.lie = Math.max(0, state.lie - dt)
  state.lieClock -= dt
  const tense = state.glitch > 0.62 || state.suspicion > 0.78 || state.lieClock <= 0
  if (state.lie <= 0 && state.lieCd <= 0 && tense && state.age > 3) {
    state.lie = 0.95
    state.lieCd = 5.2
    state.lieClock = 8 + Math.random() * 6
    state.fakeSpeed = 3 + Math.floor(Math.random() * 42)
    state.fakeDist = Math.floor(Math.random() * 980)
    state.fakeSignal = Math.floor(Math.random() * 100)
    state.fakeWarn = Math.random() > 0.5 ? 'CHAP TOZA' : 'ONG XAVF'
  }
  return cruise * speedSign
}

function maybeDecoy(state) {
  if (state.decoyCd > 0 || state.age < 5 || state.heart > 0 || state.rewind > 0) return
  if (Math.random() > 0.38) return
  const decoy = state.decoys.find((item) => !item.on)
  if (!decoy) return
  const z = state.z + 15 + Math.random() * 12
  const wall = state.targetWall
  const crowded = state.slots.some((slot) => (
    slot.active && slot.wall === wall && Math.abs(slot.z - z) < 3.2
  ))
  if (crowded) return
  decoy.on = true
  decoy.z = z
  decoy.wall = wall
  decoy.held = true
  state.decoyCd = 8
  decoySound()
}

function stepSurge(state, dt, callbacks) {
  state.surgeCd = Math.max(0, state.surgeCd - dt)
  state.decoyCd = Math.max(0, state.decoyCd - dt)
  state.blind.cd = Math.max(0, state.blind.cd - dt)
  if (state.blind.on && state.z > state.blind.z + state.blind.len + 6) {
    state.blind.on = false
    state.blind.cd = 12
  } else if (!state.blind.on && state.blind.cd <= 0 && state.age > 5 && state.rewind <= 0) {
    state.blind.on = true
    state.blind.z = state.z + 24 + Math.random() * 10
    state.blind.len = 6.4 + Math.random() * 2.2
    state.blind.cd = 14
    callbacks.current.onDread?.({ phase: 'blind' })
  }
  if (state.surge > 0) {
    state.surge -= dt
    state.glitch = Math.max(state.glitch, 0.18)
    if (state.surge <= 0) {
      state.surge = 0
      state.surgeCd = 17 + Math.random() * 6
      if (state.alive && state.surgeClean) {
        const points = 84 + state.combo * 12 + state.decoyCombo * 8
        state.bonus += points
        state.loanCd = Math.max(0, state.loanCd - 4.5)
        state.rewindCd = Math.max(0, state.rewindCd - 5)
        state.heartCd = Math.max(0, state.heartCd - 4)
        state.witness.cd = Math.max(0, state.witness.cd - 2.5)
        state.decoyCd = Math.max(0, state.decoyCd - 2)
        state.surgeEvent = 'clear'
        callbacks.current.onDread?.({ phase: 'surge-clear', points })
        surgeClearSound()
      } else if (state.alive) {
        callbacks.current.onDread?.({ phase: 'surge-fail' })
      }
    }
  } else if (
    state.surgeCd <= 0
    && state.age > 9
    && state.rewind <= 0
    && state.heart <= 0
    && state.loan === 'idle'
  ) {
    state.surge = 3.6
    state.surgeClean = true
    state.surgePulse = 1
    state.dutch = Math.max(state.dutch, 0.72)
    state.suspicion = Math.max(state.suspicion, 0.9)
    surgeSound()
    callbacks.current.onDread?.({ phase: 'surge' })
  }
}

function witnessFigure() {
  const pairs = [
    -0.42, 0.55, 0, 0, 0.82, 0,
    0, 0.82, 0, 0.42, 0.55, 0,
    0.42, 0.55, 0, 0, 0.28, 0,
    0, 0.28, 0, -0.42, 0.55, 0,
    0, 0.42, 0, 0, 0.68, 0,
    -0.1, 0.55, 0, 0.1, 0.55, 0,
    -0.58, 0.02, 0, 0.58, 0.02, 0,
    0, 0.24, 0, 0, -0.92, 0,
    -0.3, -0.92, 0, 0.3, -0.92, 0,
    -0.58, 0.02, 0, -0.78, -0.48, 0,
    0.58, 0.02, 0, 0.78, -0.48, 0,
  ]
  const lines = new THREE.BufferGeometry()
  lines.setAttribute('position', new THREE.Float32BufferAttribute(pairs, 3))
  const count = pairs.length / 6
  const dots = new Float32Array(count * 3)
  for (let i = 0; i < count; i += 1) {
    dots[i * 3] = pairs[i * 6]
    dots[i * 3 + 1] = pairs[i * 6 + 1]
    dots[i * 3 + 2] = pairs[i * 6 + 2]
  }
  const points = new THREE.BufferGeometry()
  points.setAttribute('position', new THREE.BufferAttribute(dots, 3))
  return { lines, points }
}

function aimWitness(group, wall, z, player) {
  const angle = wall * Math.PI * 0.5
  const inset = WALL - 0.1
  const x = Math.sin(angle) * inset
  const y = -Math.cos(angle) * inset
  group.position.set(x, y, z)
  const yaw = Math.atan2(player.x - x, player.z - z)
  const pitch = Math.atan2(player.y - y, player.z - z)
  if (wall === 0) group.rotation.set(-Math.PI / 2, 0, yaw)
  else if (wall === 2) group.rotation.set(Math.PI / 2, 0, -yaw)
  else if (wall === 1) group.rotation.set(pitch, Math.PI / 2, 0)
  else group.rotation.set(-pitch, -Math.PI / 2, 0)
}

function stepWitness(state, dt, v) {
  const witness = state.witness
  witness.cd = Math.max(0, witness.cd - dt)
  if (!witness.on) {
    if (witness.cd <= 0 && state.age > 4) {
      witness.on = true
      witness.wall = (state.targetWall + 1 + Math.floor(Math.random() * 3)) % 4
      witness.z = state.z + 18 + Math.random() * 20
      witness.life = 7
    }
    return false
  }
  witness.life -= dt
  const angle = witness.wall * Math.PI * 0.5
  const inset = WALL - 0.1
  const x = Math.sin(angle) * inset
  const y = -Math.cos(angle) * inset
  let broke = false
  for (const wave of state.waves) {
    if (Math.abs(wave.z - witness.z) < 1.35) broke = true
  }
  for (const pulse of state.pulses) {
    if (Math.hypot(x - pulse.pos.x, y - pulse.pos.y, witness.z - pulse.pos.z) < pulse.radius + 0.4) {
      broke = true
    }
  }
  const near = Math.hypot(v.pos.x - x, v.pos.y - y, v.pos.z - witness.z) < 3.7
  if (broke || near || witness.life <= 0 || witness.z < state.z - 8) {
    if (broke || near) burstSparks(state, v.box.set(x, y, witness.z), 16)
    witness.on = false
    witness.cd = broke || near ? 6.5 : 2.4
    return false
  }
  return true
}

function spawnGate(state) {
  const serial = state.gid
  const count = state.z < 220 ? 1 : state.z < 620 ? 2 : 3
  let bias = null
  if (state.mind.arm && serial > 2 && state.lastScore >= 750) {
    bias = (state.targetWall + state.mind.lastSign + 8) % 4
    state.mind.arm = 0
  }
  const blocked = pickBlocked(count, serial <= 2 ? 0 : null, bias)
  const gate = { id: serial, z: state.nextSpawn, scored: false }
  state.gates.push(gate)
  let colorIndex = serial
  for (const wall of blocked) {
    const slot = state.slots.find((item) => !item.active)
    if (!slot) break
    slot.active = true
    slot.z = gate.z
    slot.wall = wall
    slot.glow = 0
    slot.color = COLORS[colorIndex % COLORS.length]
    slot.gateId = gate.id
    slot.lastPulse = 0
    slot.lastWave = 0
    slot.missed = false
    slot.flash = 0
    colorIndex += 1
  }
  state.gid += 1
  const gap = Math.max(13.5, 23 - state.z * 0.007) + state.scale.gap
  state.nextSpawn += gap
}

function sectionLines() {
  const s = WALL
  const tick = 0.22
  const pairs = [
    [-s, -s, 0, s, -s, 0],
    [s, -s, 0, s, s, 0],
    [s, s, 0, -s, s, 0],
    [-s, s, 0, -s, -s, 0],
    [0, -s, 0, 0, -s - tick, 0],
    [0, s, 0, 0, s + tick, 0],
    [-s, 0, 0, -s - tick, 0, 0],
    [s, 0, 0, s + tick, 0, 0],
  ]
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pairs.flat(), 3))
  return geometry
}

function draftLabel() {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 64
  const context = canvas.getContext('2d')
  context.strokeStyle = '#8ee9ff'
  context.lineWidth = 3
  context.strokeRect(6, 8, 244, 48)
  context.fillStyle = '#f4feff'
  context.font = '600 26px Bahnschrift, Segoe UI, sans-serif'
  context.fillText('1.70 × 0.52', 24, 42)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(1.8, 0.45, 1)
  sprite.visible = false
  return { sprite, texture, material }
}

function liveCamera(state, dt, focusing, v, signals) {
  const external = Number(signals.rule) || 0
  if (external) {
    state.rule = Math.max(state.rule, Math.min(1, Math.abs(external)))
    state.dutchSide = external < 0 ? -1 : 1
  } else {
    state.rule = Math.max(0, state.rule - dt * 0.42)
  }
  const dutchTarget = external ? Math.min(1, Math.abs(external)) : state.rule
  const dutchLerp = dutchTarget > state.dutch ? 9 : 1.5
  state.dutch += (dutchTarget - state.dutch) * Math.min(1, dt * dutchLerp)

  state.dwell += dt
  if (state.dwell > 3.35 && !state.armedPeek) {
    state.peekSide = Math.sin(state.z * 0.17 + state.time) >= 0 ? 1 : -1
    state.armedPeek = 1
  }
  const suspectTarget = state.dwell > 3.35 ? Math.min(1, (state.dwell - 3.35) / 2.1) : 0
  const suspectLerp = state.flinch > 0 ? 9 : 1.2
  state.suspicion += (suspectTarget - state.suspicion) * Math.min(1, dt * suspectLerp)
  state.flinch = Math.max(0, state.flinch - dt * 2.4)
  state.peekKick += (0 - state.peekKick) * Math.min(1, dt * 7)

  const debt = state.loan === 'repay' ? 1 : state.loan === 'slow' ? 0.62 : 0
  if (state.loan === 'slow') state.suspicion = Math.max(state.suspicion, 0.84)
  if (state.loan === 'repay') state.suspicion = Math.max(state.suspicion, 0.96)
  if (state.surge > 0) state.suspicion = Math.max(state.suspicion, 0.92)
  if (state.abyssWatch > 0) state.suspicion = Math.max(state.suspicion, state.abyssWatch)
  if (state.curse.watch > 0) state.suspicion = Math.max(state.suspicion, state.curse.watch)
  const swayTarget = (focusing || state.loan === 'slow') ? 0 : (state.loan === 'repay' ? 0.4 : (state.surge > 0 ? 0.22 : 1))
  state.sway += (swayTarget - state.sway) * Math.min(1, dt * (focusing || debt ? 14 : 2.6))
  state.breath += dt * (0.82 + signals.drive * 0.4) * (0.12 + state.sway * 0.88)

  if (signals.spike) state.recoil = 1
  else state.recoil += (0 - state.recoil) * Math.min(1, dt * 2.5)

  const dirx = signals.threat > 0.04 ? signals.dirx : 0
  const diry = signals.threat > 0.04 ? signals.diry : 0
  state.threat += (signals.threat - state.threat) * Math.min(1, dt * 4)
  state.threatX += (dirx - state.threatX) * Math.min(1, dt * 3.4)
  state.threatY += (diry - state.threatY) * Math.min(1, dt * 3.4)

  v.right.crossVectors(v.up, v.forward).normalize()
  const calm = (focusing || state.loan === 'slow') ? 0.08 : 1
  const peek = state.suspicion * calm + state.peekKick
  const breathe = Math.sin(state.breath * 1.6) * 0.055 * state.sway
  const eye = Math.sin(state.breath * 0.67 + 0.4) * 0.03 * state.sway
  const shake = signals.drive * signals.drive * 0.05 * state.sway
  const lean = Math.tan(THREE.MathUtils.degToRad(4.4)) * 9 * state.threat * (focusing ? 0.4 : 1)

  v.cam.addScaledVector(v.right, peek * 1.28 * state.peekSide + eye + Math.sin(state.time * 41) * shake)
  v.cam.addScaledVector(v.up, Math.abs(peek) * 0.72 + breathe + Math.sin(state.time * 27 + 1.3) * shake * 0.7)
  v.cam.z -= state.recoil * 1.22
  if (state.loan === 'slow') v.cam.z += 1.5
  if (state.loan === 'repay') v.cam.z -= 0.95
  if (state.rewind > 0) v.cam.z += 0.7
  if (state.surge > 0) v.cam.z -= 0.55
  v.look.addScaledVector(v.right, peek * 0.24 * state.peekSide + eye * 1.35)
  v.look.addScaledVector(v.up, Math.cos(state.breath * 0.53) * 0.02 * state.sway)
  v.look.x += state.threatX * lean
  v.look.y += state.threatY * lean
  v.look.z -= state.recoil * 0.28

  const debtRoll = (state.loan === 'repay' ? 1 : state.loan === 'slow' ? 0.5 : 0) * THREE.MathUtils.degToRad(9)
  const rollCap = state.loan === 'repay' ? 16 : 12
  const roll = THREE.MathUtils.clamp(
    state.peekSide * state.suspicion * calm * THREE.MathUtils.degToRad(3.4)
      + state.dutchSide * state.dutch * THREE.MathUtils.degToRad(8)
      + state.dutchSide * debtRoll
      + Math.sign(state.threatX || 1) * state.threat * (focusing ? 0.35 : 1) * THREE.MathUtils.degToRad(3.2),
    THREE.MathUtils.degToRad(-rollCap),
    THREE.MathUtils.degToRad(rollCap),
  )
  v.rolled.copy(v.up).multiplyScalar(Math.cos(roll)).addScaledVector(v.right, Math.sin(roll))
}

function Scene({ active, runId, input, styleRef, callbacks }) {
  const tunnel = useMemo(() => {
    const { railGeo, ringGeo } = buildTunnelGeometry()
    const line = (color) => new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.16,
      toneMapped: false,
      depthWrite: false,
    })
    return {
      railGeo,
      ringGeo,
      railEdges: new THREE.EdgesGeometry(railGeo, 20),
      ringEdges: new THREE.EdgesGeometry(ringGeo, 20),
      rails: createTunnelMaterial('#00f3ff', 1),
      rings: createTunnelMaterial('#3d7eff', 1.15),
      railLines: line('#d7fbff'),
      ringLines: line('#7eb0ff'),
    }
  }, [])

  const boxEdges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), [])
  const sphereEdges = useMemo(() => new THREE.EdgesGeometry(new THREE.SphereGeometry(PLAYER_R, 14, 10)), [])
  const axes = useMemo(() => {
    const helper = new THREE.AxesHelper(0.62)
    helper.visible = false
    return helper
  }, [])
  const sectionGeo = useMemo(() => sectionLines(), [])
  const label = useMemo(() => draftLabel(), [])
  const arcGeo = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ARC * 3), 3))
    return geometry
  }, [])
  const dimGeo = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(18), 3))
    return geometry
  }, [])
  const speckGeo = useMemo(() => {
    const positions = new Float32Array(SPECKS * 3)
    for (let i = 0; i < SPECKS; i += 1) {
      const angle = Math.random() * Math.PI * 2
      const radius = 0.35 + Math.random() * (WALL - 0.45)
      positions[i * 3] = Math.cos(angle) * radius
      positions[i * 3 + 1] = Math.sin(angle) * radius
      positions[i * 3 + 2] = Math.random() * 70
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geometry
  }, [])
  const sparkGeo = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPARKS * 3), 3))
    geometry.setDrawRange(0, 0)
    return geometry
  }, [])
  const arrowGeo = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3))
    return geometry
  }, [])
  const witnessGeo = useMemo(() => witnessFigure(), [])

  useEffect(() => () => {
    tunnel.railGeo.dispose()
    tunnel.ringGeo.dispose()
    tunnel.railEdges.dispose()
    tunnel.ringEdges.dispose()
    tunnel.rails.dispose()
    tunnel.rings.dispose()
    tunnel.railLines.dispose()
    tunnel.ringLines.dispose()
    boxEdges.dispose()
    sphereEdges.dispose()
    sectionGeo.dispose()
    arcGeo.dispose()
    dimGeo.dispose()
    speckGeo.dispose()
    sparkGeo.dispose()
    arrowGeo.dispose()
    witnessGeo.lines.dispose()
    witnessGeo.points.dispose()
    label.texture.dispose()
    label.material.dispose()
  }, [arcGeo, arrowGeo, boxEdges, dimGeo, label, sectionGeo, sparkGeo, speckGeo, sphereEdges, tunnel, witnessGeo])

  const runtime = useRef(null)
  if (!runtime.current) runtime.current = createRuntime()

  const tunnelRef = useRef(null)
  const playerRef = useRef(null)
  const shellMat = useRef(null)
  const obstacleRefs = useRef([])
  const pulseRefs = useRef([])
  const trailRefs = useRef([])
  const trailCursor = useRef(0)
  const arcRef = useRef(null)
  const sectionRef = useRef(null)
  const wireRef = useRef(null)
  const speckRef = useRef(null)
  const dimRef = useRef(null)
  const edgeRefs = useRef([])
  const echoRefs = useRef([])
  const waveRefs = useRef([])
  const sparkRef = useRef(null)
  const decoyRefs = useRef([])
  const blindNear = useRef(null)
  const blindFar = useRef(null)
  const witnessRef = useRef(null)
  const shadowRef = useRef(null)
  const keyLight = useRef(null)
  const fillLight = useRef(null)
  const coreMat = useRef(null)
  const chromaFx = useRef(null)
  const bloomRef = useRef(null)
  const arrowRef = useRef(null)
  const tmp = useRef({
    pos: new THREE.Vector3(),
    up: new THREE.Vector3(),
    look: new THREE.Vector3(),
    cam: new THREE.Vector3(),
    box: new THREE.Vector3(),
    gravity: new THREE.Vector3(0, -1, 0),
    sample: new THREE.Vector3(),
    moodColor: new THREE.Color(),
    right: new THREE.Vector3(),
    forward: new THREE.Vector3(0, 0, 1),
    rolled: new THREE.Vector3(),
  })

  const { camera, size, gl } = useThree()

  useFrame((_, delta) => {
    const dt = delta > 0.2 ? 0 : Math.min(0.05, delta)
    const state = runtime.current
    const v = tmp.current
    const frame = Math.max(delta, 0.001)
    state.fpsSmooth += (1 / frame - state.fpsSmooth) * 0.08
    state.fpsReport -= frame
    if (state.fpsReport <= 0) {
      state.fpsReport = 0.35
      const shown = Math.round(state.fpsSmooth)
      if (shown !== state.fpsShown) {
        state.fpsShown = shown
        callbacks.current.onFps?.(shown)
      }
      if (state.fpsSmooth < 54) state.lodHold = Math.min(1.5, state.lodHold + 0.4)
      else if (state.fpsSmooth >= 59) state.lodHold = Math.max(0, state.lodHold - 0.45)
      state.lod = state.lodHold > 0.5 ? 1 : 0
    }
    state.time += dt

    if (active && state.runId !== runId) {
      resetRuntime(state)
      state.runId = runId
      const specks = speckGeo.attributes.position.array
      for (let i = 0; i < SPECKS; i += 1) {
        const angle = (i / SPECKS) * Math.PI * 2
        const radius = 0.4 + ((i * 17) % 10) * 0.1 * (WALL - 0.55)
        specks[i * 3] = Math.cos(angle) * radius
        specks[i * 3 + 1] = Math.sin(angle) * radius
        specks[i * 3 + 2] = 6 + (i * 1.15) % 72
      }
      speckGeo.attributes.position.needsUpdate = true
    }

    const playing = active && state.runId === runId && state.alive

    if (!playing) {
      restPressure()
      restScaleAudio()
      restTapAudio()
      restMindAudio()
      const idle = state.time
      if (tunnelRef.current) tunnelRef.current.position.z = -((idle * 5) % 8)
      placeBall(0, Math.sin(idle * 0.35) * 0.04, 0, v.pos)
      v.pos.y += Math.sin(idle * 1.6) * 0.05
      if (playerRef.current) {
        playerRef.current.position.copy(v.pos)
        playerRef.current.rotation.x -= dt * 0.4
      }
      if (shellMat.current) {
        shellMat.current.emissiveIntensity = 3.1 + Math.sin(idle * 2.4) * 0.45
      }
      v.gravity.set(Math.sin(v.pos.x), -1, 0).normalize()
      v.up.set(-v.gravity.x, -v.gravity.y, 0)
      camera.up.set(0, 1, 0)
      state.breath += dt * 0.7
      camera.position.set(0, v.pos.y + 1.35 + Math.sin(state.breath * 1.6) * 0.04, -6.4)
      camera.lookAt(0, v.pos.y + 0.2, 10)
      camera.fov = size.width < size.height ? 84 : 68
      camera.updateProjectionMatrix()
      syncTunnel(tunnel.rails, [], 0, v.gravity, state.time)
      syncTunnel(tunnel.rings, [], 0, v.gravity, state.time)
      for (const mesh of obstacleRefs.current) if (mesh) mesh.visible = false
      for (const mesh of pulseRefs.current) if (mesh) mesh.visible = false
      for (const mesh of trailRefs.current) if (mesh) mesh.visible = false
      if (arcRef.current) arcRef.current.visible = false
      if (sectionRef.current) sectionRef.current.visible = false
      if (dimRef.current) dimRef.current.visible = false
      if (label.sprite) label.sprite.visible = false
      for (const mesh of waveRefs.current) if (mesh) mesh.visible = false
      for (const mesh of echoRefs.current) if (mesh) mesh.visible = false
      if (sparkRef.current) sparkRef.current.visible = false
      for (const mesh of decoyRefs.current) if (mesh) mesh.visible = false
      if (blindNear.current) blindNear.current.visible = false
      if (blindFar.current) blindFar.current.visible = false
      if (witnessRef.current) witnessRef.current.visible = false
      if (shadowRef.current) shadowRef.current.visible = false
      if (arrowRef.current) arrowRef.current.visible = false
      if (keyLight.current) keyLight.current.intensity = 10
      if (fillLight.current) fillLight.current.intensity = 3
      if (coreMat.current) coreMat.current.opacity = 1
      if (tunnelRef.current) tunnelRef.current.scale.set(1, 1, 1)
      state.glitch = 0
      const idleMixTarget = styleRef?.current === 'kontur' ? 1 : 0
      state.mix += (idleMixTarget - state.mix) * Math.min(1, dt * 7)
      tunnel.rails.uniforms.uGain.value = 1 - state.mix * 0.7
      tunnel.rings.uniforms.uGain.value = 1.15 * (1 - state.mix * 0.7)
      tunnel.railLines.opacity = state.mix * 0.92
      tunnel.ringLines.opacity = state.mix * 0.8
      if (wireRef.current) {
        wireRef.current.visible = state.mix > 0.05
        wireRef.current.material.opacity = 0.3 + state.mix * 0.7
      }
      axes.visible = state.mix > 0.3
      axes.position.copy(v.pos)
      return
    }

    state.age += dt
    state.cooldown = Math.max(0, state.cooldown - dt)
    state.fovKick = Math.max(0, state.fovKick - dt)
    state.arrow = Math.max(0, state.arrow - dt)
    const focusing = Boolean(input.current.focus)
    const queue = input.current

    if (queue.qCount > 0 && state.cooldown <= 0) {
      const cmd = queue.slots[queue.head]
      const sign = cmd.sign
      const immediate = cmd.immediate
      queue.head = (queue.head + 1) % 2
      queue.qCount -= 1
      const nextWall = (state.targetWall + sign + 8) % 4
      for (const decoy of state.decoys) {
        if (decoy.on && decoy.wall === state.targetWall && nextWall !== decoy.wall) decoy.held = false
      }
      state.targetWall = nextWall
      state.dwell = 0
      state.armedPeek = 0
      state.peekKick = -state.suspicion * state.peekSide
      state.suspicion = 0
      state.flinch = 1
      state.fovKick = 0.032
      state.arrow = 0.16
      state.arrowSign = sign
      noteHabit(state.mind, sign, state.time)
      if (Math.abs(sign) >= 2) {
        state.rule = 1
        state.dutchSide = sign > 0 ? 1 : -1
      }
      if (immediate) {
        state.turning = false
        state.angle = state.targetWall * Math.PI * 0.5
        state.angleVel = 0
        state.cooldown = 0.07
        state.recoil = Math.max(state.recoil, 0.85)
      } else {
        state.turning = true
        state.turnFrom = state.angle
        state.turnDelta = shortest(state.targetWall * Math.PI * 0.5, state.angle)
        state.turnU = 0
        state.angleVel = 0
        state.cooldown = 0.13
        state.recoil = Math.max(state.recoil, 0.5)
      }
      placeBall(state.z, state.angle, state.targetWall, v.pos)
      rememberEcho(state)
      emitPulse(state, v.pos)
      tapTick(sign)
      vibrate(12)
    }

    if (input.current.impulse) {
      input.current.impulse = false
      state.boost = 1
      placeBall(state.z, state.angle, state.targetWall, v.pos)
      emitPulse(state, v.pos)
      tapTick(0)
      vibrate(16)
    }

    if (input.current.loan && state.loan === 'idle' && state.loanCd <= 0) {
      input.current.loan = false
      state.loan = 'slow'
      state.loanT = 1.8
      state.loanClean = true
      state.suspicion = Math.max(state.suspicion, 0.86)
      state.dutch = 0.95
      state.sway = 0
      loanSound()
      callbacks.current.onLoan?.({ phase: 'slow' })
    } else if (input.current.loan) {
      input.current.loan = false
    }
    stepLoan(state, dt, callbacks)
    const timeScale = state.loan === 'slow' ? 0.26 : (focusing ? 0.34 : 1)
    const step = dt * timeScale

    if (!state.didIntro && state.age > 0.45) {
      state.didIntro = true
      placeBall(state.z, state.angle, state.targetWall, v.pos)
      emitPulse(state, v.pos)
      pulseSound()
    }

    const target = state.targetWall * Math.PI * 0.5
    if (state.turning) {
      state.turnU += dt / 0.128
      if (state.turnU >= 1) {
        state.turning = false
        state.angle = state.turnFrom + state.turnDelta
        state.angleVel = 0
      } else {
        state.angle = state.turnFrom + state.turnDelta * turnEase(state.turnU)
        state.angleVel = 0
      }
    } else {
      const turned = integrateAngle(state.angle, state.angleVel, target, step)
      state.angle = turned.angle
      state.angleVel = turned.vel
    }

    const cruise = Math.min(29, 13 + state.z * 0.011) * Math.min(1, 0.35 + state.age / 0.7)
    state.boost = Math.max(0, state.boost - dt * 1.4)
    const signed = stepDread(state, dt, callbacks, v, cruise)
    let speed = Math.abs(signed) * (1 + state.boost * 0.62)
    if (state.loan === 'repay') speed *= 1.72
    if (state.surge > 0) speed *= 1.36
    if (signed < 0) speed = -Math.abs(cruise) * 0.58
    stepAbyss(state, dt, callbacks)
    if (signed > 0 && state.abyssMul > 1) speed *= state.abyssMul
    if (signed > 0 && state.curse.rush > 1) speed *= state.curse.rush
    if (
      signed > 0
      && state.surge <= 0
      && state.loan !== 'repay'
      && state.boost <= 0.02
      && state.lastScore > 1000
    ) {
      const lifted = speed * (1 + state.scale.ease * (state.lod ? 0.02 : 0.045))
      speed = lifted > state.scale.ceil ? state.scale.ceil : lifted
    }
    state.prevZ = state.z
    const motion = state.rewind > 0 ? dt : step
    const stopping = state.hitStop > 0
    if (stopping) state.hitStop = Math.max(0, state.hitStop - dt)
    state.z = Math.max(0, state.z + speed * motion * (stopping ? 0.08 : 1))
    state.scanTime += state.rewind > 0 ? -dt * 2.6 : dt
    setDrive(
      state.rewind > 0 ? 6 : Math.abs(speed),
      state.loan === 'repay' ? false : (focusing || state.loan === 'slow' || state.rewind > 0),
    )
    syncPressure(
      state.scale.felt > 0 ? state.scale.felt : state.z * 0.45 + state.bonus,
      Math.abs(speed),
      state.surge,
      state.abyssStage,
      state.mirage,
      state.witness.on ? Math.max(state.abyssWatch, 0.72) : state.abyssWatch,
      state.heart,
      dt,
    )

    while (state.nextSpawn < state.z + 95) spawnGate(state)

    placeBall(state.z, state.angle, state.targetWall, v.pos)
    playLoanEvent(state, callbacks, v.pos)
    if (state.surgePulse) {
      state.surgePulse = 0
      emitPulse(state, v.pos, 1)
      burstSparks(state, v.pos, 14)
      tripGlitch(state, callbacks)
    }
    if (state.surgeEvent === 'clear') {
      emitPulse(state, v.pos, 1)
      burstSparks(state, v.pos, 10)
      state.surgeEvent = null
    }
    if (state.abyssSnap) {
      state.abyssSnap = 0
      emitPulse(state, v.pos, 1)
      burstSparks(state, v.pos, state.lod ? 6 : 12)
      tripGlitch(state, callbacks)
    }
    if (state.abyssPing) {
      state.abyssPing = 0
      emitPulse(state, v.pos, state.abyssStage >= 6 ? 1 : 0)
    }
    let hit = false
    const sweepLo = Math.min(state.prevZ, state.z)
    const sweepHi = Math.max(state.prevZ, state.z)
    for (const slot of state.slots) {
      if (!slot.active) continue
      if (slot.z < sweepLo - 1.4 || slot.z > sweepHi + 1.4) continue
      const sampleZ = THREE.MathUtils.clamp(slot.z, sweepLo, sweepHi)
      placeBall(sampleZ, state.angle, state.targetWall, v.sample)
      boxCenter(slot.wall, slot.z, v.box)
      if (sphereHitsBox(v.sample, slot.wall, v.box)) {
        hit = true
        break
      }
    }

    if (hit && !state.crashed) {
      state.loanClean = false
      state.surgeClean = false
      state.crashed = true
      state.alive = false
      if (state.lastScore >= 750) {
        state.glitch = 1
        state.recoil = 1
        state.fovKick = Math.max(state.fovKick, state.lod ? 0.04 : 0.09)
      }
      const crashedScore = Math.floor(curseScore(state.curse, state.z * 0.45 + state.bonus))
      if (state.loan !== 'idle') {
        debtStrikeSound()
        tripGlitch(state, callbacks)
        callbacks.current.onLoan?.({ phase: 'strike' })
      }
      crashSound()
      stopDrone()
      restPressure()
      restScaleAudio()
      restTapAudio()
      restMindAudio()
      vibrate(48)
      callbacks.current.onCrash(crashedScore, state.curse.on ? 1 : 0)
      return
    }

    for (const echo of state.echoes) {
      if (echo.synced || state.rewind > 0) continue
      if (!(state.prevZ < echo.z && echo.z <= state.z)) continue
      echo.synced = true
      const aligned = echo.wall === state.targetWall
      const danger = state.slots.some((slot) => (
        slot.active && slot.wall === echo.wall && Math.abs(slot.z - echo.z) < 3.4
      ))
      if (!aligned) continue
      if (danger) {
        state.strain = Math.min(1, state.strain + 0.55)
        state.echoCombo = 0
        state.surgeClean = false
        state.recoil = 1
        echoWarnSound()
        tripGlitch(state, callbacks)
        burstSparks(state, v.pos, state.loan === 'idle' ? 8 : 18)
        if (state.loan !== 'idle') {
          state.loanClean = false
          emitPulse(state, v.pos, 1)
          debtStrikeSound()
          callbacks.current.onLoan?.({ phase: 'strike' })
        }
        callbacks.current.onEcho?.({ kind: 'warn' })
        continue
      }
      if (state.time - state.lastEcho > 3.2) state.echoCombo = 0
      state.echoCombo = Math.min(8, state.echoCombo + 1)
      state.lastEcho = state.time
      const points = 24 * state.echoCombo
      state.bonus += points
      state.strain *= 0.45
      placeBall(state.z, state.angle, state.targetWall, v.pos)
      emitPulse(state, v.pos)
      pulseSound()
      echoSyncSound()
      state.glitch = Math.max(state.glitch, 0.7)
      callbacks.current.onEcho?.({ kind: 'sync', points, combo: state.echoCombo })
    }

    if (state.rewind <= 0) {
      for (const decoy of state.decoys) {
        if (!decoy.on) continue
        if (!(state.prevZ < decoy.z && decoy.z <= state.z)) continue
        decoy.on = false
        const clean = decoy.held && state.targetWall === decoy.wall
        if (clean) {
          if (state.time - state.lastDecoy > 4) state.decoyCombo = 0
          state.decoyCombo = Math.min(8, state.decoyCombo + 1)
          state.lastDecoy = state.time
          const points = 26 * state.decoyCombo
          state.bonus += points
          state.glitch = Math.max(state.glitch, 0.45)
          burstSparks(state, v.pos, 8)
          callbacks.current.onDread?.({ phase: 'decoy', points, combo: state.decoyCombo })
        } else {
          state.decoyCombo = 0
          state.surgeClean = false
          state.strain = Math.min(1, state.strain + 0.28)
          tripGlitch(state, callbacks)
          callbacks.current.onDread?.({ phase: 'decoy-fool' })
        }
      }
    }

    let bestGap = 0.48
    let bestMult = 0
    let bestSlot = null
    for (const slot of state.slots) {
      if (!slot.active || slot.missed || state.rewind > 0) continue
      if (!(state.prevZ < slot.z && slot.z <= state.z)) continue
      slot.missed = true
      placeBall(slot.z, state.angle, state.targetWall, v.sample)
      boxCenter(slot.wall, slot.z, v.box)
      const gap = boxGap(v.sample, slot.wall, v.box)
      if (gap > 0 && gap < bestGap) {
        bestGap = gap
        bestMult = gap < 0.18 ? 3 : 2
        bestSlot = slot
      }
    }
    if (bestMult && bestSlot) {
      if (state.time - state.lastMiss > 2.8) state.combo = 0
      state.combo = Math.min(8, state.combo + 1)
      state.lastMiss = state.time
      const points = (bestMult === 3 ? 40 : 18) * state.combo
      const closeExtra = bestMult === 3 && state.lastScore >= 750 ? (state.lod ? 6 : 12) : 0
      state.bonus += points + closeExtra
      const nearBoon = curseBoon(state.curse, true)
      if (nearBoon) {
        state.bonus += nearBoon
        callbacks.current.onCurse?.({ phase: 'gift', points: nearBoon })
      }
      bestSlot.flash = 1
      state.hitStop = 0.03
      emitPulse(state, v.pos, 1)
      nearMissSound(bestMult)
      vibrate(18)
      burstSparks(state, v.pos, 8)
      tripGlitch(state, callbacks)
      callbacks.current.onNearMiss?.({ mult: bestMult, points: points + closeExtra, combo: state.combo })
      state.recoil = 1
    }
    if (input.current.glitch) {
      input.current.glitch = 0
      state.recoil = 1
      placeBall(state.z, state.angle, state.targetWall, v.pos)
      emitPulse(state, v.pos, 1)
      burstSparks(state, v.pos, 14)
      pulseSound()
      tripGlitch(state, callbacks)
    }
    const externalRule = Number(input.current.rule) || 0
    if (externalRule && !state.ruleLatch) {
      state.ruleLatch = 1
      placeBall(state.z, state.angle, state.targetWall, v.pos)
      burstSparks(state, v.pos, 12)
      tripGlitch(state, callbacks)
    } else if (!externalRule) {
      state.ruleLatch = 0
    }

    for (let i = state.gates.length - 1; i >= 0; i -= 1) {
      const gate = state.gates[i]
      if (!gate.scored && state.z > gate.z + 1.15) {
        gate.scored = true
        state.bonus += 25
        passSound()
        const gateDanger = state.surge > 0 || state.heart > 0 || state.lie > 0 || state.witness.on || state.strain > 0.4
        const gateBoon = curseBoon(state.curse, gateDanger)
        if (gateBoon) {
          state.bonus += gateBoon
          callbacks.current.onCurse?.({ phase: 'gift', points: gateBoon })
        }
      }
      if (gate.z < state.z - 12) state.gates.splice(i, 1)
    }

    const raw = state.z * 0.45 + state.bonus
    stepCurse(state.curse, raw, dt, state.lod)
    if (state.curse.forceLie) {
      state.curse.forceLie = 0
      state.lieClock = 0
    }
    if (state.curse.press > 0) {
      if (state.lie <= 0) state.lieCd = Math.max(0, state.lieCd - dt * state.curse.press)
      if (!state.witness.on) state.witness.cd = Math.max(0, state.witness.cd - dt * state.curse.press)
    }
    if (state.curse.sting) {
      state.curse.sting = 0
      curseSting()
      emitPulse(state, v.pos, 1)
      burstSparks(state, v.pos, state.lod ? 5 : 12)
      tripGlitch(state, callbacks)
      state.curse.banner = 1
    }
    const total = Math.floor(curseScore(state.curse, raw))
    stepScale(state.scale, total, raw, dt, state.lod)
    stepMind(state, total, dt)
    const scaleAt = takeScalePing(state.scale)
    if (scaleAt) {
      scaleChime(state.lod)
      callbacks.current.onScale?.({ phase: 'mark', at: scaleAt })
    }
    const mindAt = takeMindPing(state.mind)
    if (mindAt) callbacks.current.onMind?.({ phase: 'band', at: mindAt })
    if (total !== state.lastScore) {
      state.lastScore = total
      callbacks.current.onScore(total)
    }
    const tremor = state.tremor
    stepTremor(tremor, total, dt, state.lod)
    if (tremor.pulse === 1) tremorWarn()
    else if (tremor.pulse === 2) {
      tremorHit()
      emitPulse(state, v.pos, 1)
      burstSparks(state, v.pos, state.lod ? 6 : 12)
      tripGlitch(state, callbacks)
      callbacks.current.onTremor?.({ phase: 'wall' })
    } else if (tremor.pulse === 3) tremorHeart()
    else if (tremor.pulse === 4) {
      tremorBreach()
      emitPulse(state, v.pos, 1)
      burstSparks(state, v.pos, state.lod ? 8 : 16)
      tripGlitch(state, callbacks)
      callbacks.current.onTremor?.({ phase: 'breach' })
    }
    if (tremor.cue && !tremor.cueSent) {
      tremor.cueSent = 1
      callbacks.current.onTremor?.({ phase: 'near' })
    } else if (!tremor.cue && tremor.cueSent && tremor.mark < 2) {
      tremor.cueSent = 0
      callbacks.current.onTremor?.({ phase: 'calm' })
    }
    if (state.curse.banner) {
      state.curse.banner = 0
      callbacks.current.onCurse?.({ phase: 'awaken' })
    }

    for (const pulse of state.pulses) {
      pulse.age += step
      pulse.radius += step * 38
    }
    for (let i = state.pulses.length - 1; i >= 0; i -= 1) {
      if (state.pulses[i].age > 2.4) state.pulses.splice(i, 1)
    }
    for (let i = state.waves.length - 1; i >= 0; i -= 1) {
      const wave = state.waves[i]
      wave.z += step * 52
      wave.life += step
      if (wave.life > 1.55) state.waves.splice(i, 1)
    }
    state.glitch = Math.max(0, state.glitch - dt / 0.18)
    if (state.abyssGlitch > 0) state.glitch = Math.max(state.glitch, state.abyssGlitch)
    if (state.tremor.glint > 0) state.glitch = Math.max(state.glitch, state.tremor.glint)
    if (state.curse.glint > 0) state.glitch = Math.max(state.glitch, state.curse.glint)

    for (const slot of state.slots) {
      if (!slot.active) continue
      if (slot.z < state.z - 10) {
        slot.active = false
        continue
      }
      boxCenter(slot.wall, slot.z, v.box)
      for (const pulse of state.pulses) {
        if (slot.lastPulse === pulse.id) continue
        if (pulse.radius >= v.box.distanceTo(pulse.pos)) {
          slot.glow = 1
          slot.lastPulse = pulse.id
        }
      }
      const inBlind = state.blind.on && Math.abs(slot.z - state.blind.z) < state.blind.len
      slot.glow = Math.max(0, slot.glow - step / (inBlind ? 0.7 : 3.4))
      slot.flash = Math.max(0, slot.flash - dt / 0.18)
      for (const wave of state.waves) {
        if (slot.lastWave === wave.id) continue
        const reach = step * 52 + 1.2
        if (slot.z <= wave.z + 0.4 && slot.z >= wave.z - reach) {
          slot.glow = 1
          slot.lastWave = wave.id
        }
      }
    }

    v.gravity.set(Math.sin(state.angle), -Math.cos(state.angle), 0)
    v.up.set(-v.gravity.x, -v.gravity.y, 0)
    const back = size.width < size.height ? 7.5 : 5.7
    v.cam.set(v.pos.x + v.up.x * 1.2, v.pos.y + v.up.y * 1.2, v.pos.z - back)
    v.look.set(v.pos.x + v.up.x * 0.28, v.pos.y + v.up.y * 0.28, v.pos.z + 9)
    let threatScore = 0
    let threatX = 0
    let threatY = 0
    for (const slot of state.slots) {
      if (!slot.active) continue
      const ahead = slot.z - state.z
      if (ahead < 0.6 || ahead > 18) continue
      const dark = slot.glow < 0.12 ? 1.4 : 0.72
      const score = ((18 - ahead) / 18) * dark
      if (score <= threatScore) continue
      threatScore = score
      const wallAngle = slot.wall * Math.PI * 0.5
      threatX = Math.sin(wallAngle)
      threatY = -Math.cos(wallAngle)
    }
    const drive = THREE.MathUtils.clamp((Math.abs(speed) - 13) / 16, 0, 1)
    state.hudTick -= dt
    if (state.hudTick <= 0) {
      state.hudTick = 0.14
      const lying = state.lie > 0
      callbacks.current.onTelemetry?.({
        lie: lying,
        speed: lying ? state.fakeSpeed : Math.round(Math.abs(speed)),
        dist: lying ? state.fakeDist : Math.floor(state.z),
        signal: lying ? state.fakeSignal : Math.round(Math.min(1, threatScore) * 100),
        warn: lying ? state.fakeWarn : (threatScore > 0.55 ? 'XAVF' : 'SOKIN'),
      })
    }
    const streak = Math.min(1, (state.combo + state.echoCombo) / 8)
    const moodTarget = THREE.MathUtils.clamp(0.2 + drive * 0.48 + streak * 0.38 - state.strain * 0.42, 0.06, 1)
    state.mood += (moodTarget - state.mood) * Math.min(1, dt * 1.7)
    state.strain = Math.max(0, state.strain - dt * 0.07)
    if (state.curse.on && state.strain > state.curse.strainPrev + 0.18) {
      state.curse.impulse = Math.max(state.curse.impulse, state.lod ? 0.34 : 0.72)
      state.glitch = Math.max(state.glitch, state.lod ? 0.28 : 0.58)
    }
    state.curse.strainPrev = state.strain
    state.rhythm = 0.55 + drive * 1.35 + streak * 0.7 + (state.loan === 'repay' ? 1 : 0) + (state.surge > 0 ? 0.95 : 0)
    state.rhythm += state.abyssPush || 0
    const pack = state.moodPack
    pack.mood = state.mood
    pack.rhythm = state.rhythm
    pack.strain = state.strain
    pack.blindZ = state.blind.z
    pack.blindLen = state.blind.len
    pack.blindAmt = state.blind.on ? 0.86 : 0
    const sig = state.signals
    sig.drive = drive
    sig.threat = Math.min(1, threatScore)
    sig.dirx = threatX
    sig.diry = threatY
    sig.spike = false
    sig.rule = input.current.rule
    liveCamera(state, dt, focusing, v, sig)
    applyTremor(state.tremor, state.time, v)
    applyCurse(state.curse, state.time, v)
    const loanFov = state.loan === 'slow' ? -11 : state.loan === 'repay' ? 10 : 0
    const heartFov = state.heart > 0 ? (state.heartFlash > 0.02 ? 6 : -8) : 0
    const surgeFov = state.surge > 0 ? 7 : 0
    const kickFov = state.fovKick > 0 ? 6 * (state.fovKick / 0.032) : 0
    const abyssFov = (state.abyssCold || 0) * 3
    const tremorFov = state.tremor.fov * 18 + state.tremor.amp * (state.lod ? 0.5 : 1.2)
    const curseFov = state.curse.on ? (state.lod ? -2.2 : -5) + state.curse.impulse * (state.lod ? 3 : 7) : 0
    const fov = Math.min(98, (size.width < size.height ? 84 : 68) + drive * 14 - (focusing ? 8 : 0) + loanFov + heartFov + surgeFov + kickFov + abyssFov + tremorFov + curseFov + state.recoil * 3.2)
    if (Math.abs(camera.fov - fov) > 0.12) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
    camera.up.copy(v.rolled)
    camera.position.copy(v.cam)
    camera.lookAt(v.look)
    if (chromaFx.current) {
      const split = state.lod ? state.glitch * 0.28 : state.glitch
      chromaFx.current.offset.set(
        (Math.random() - 0.5) * 0.02 * split,
        (Math.random() - 0.5) * 0.012 * split,
      )
    }
    if (bloomRef.current && state.lodApplied !== state.lod) {
      state.lodApplied = state.lod
      bloomRef.current.intensity = state.lod ? 0.58 : 1.25
    }

    const anchor = Math.floor(state.z / 8) * 8
    if (tunnelRef.current) {
      const width = (1 + state.mood * 0.04 - state.strain * 0.028) * (1 + Math.sin(state.time * (0.7 + state.rhythm)) * 0.012)
      tunnelRef.current.position.z = anchor
      tunnelRef.current.scale.set(width, width, 1)
    }
    v.moodColor.set(state.strain > state.mood ? 0x12010c : 0x001016)
    v.moodColor.multiplyScalar(0.35 + state.mood * 0.2)
    if (state.abyssCold > 0) v.moodColor.lerp(ABYSS_TINT, state.abyssCold)
    gl.setClearColor(v.moodColor)
    if (state.heart > 0 && state.heartFlash < 0.04) v.moodColor.set(0x000000)
    syncTunnel(tunnel.rails, state.pulses, state.z, v.gravity, state.scanTime, state.moodPack)
    syncTunnel(tunnel.rings, state.pulses, state.z, v.gravity, state.scanTime, state.moodPack)

    if (playerRef.current) {
      playerRef.current.position.copy(v.pos)
      playerRef.current.rotation.x -= dt * (1.2 + speed * 0.05)
    }
    if (shellMat.current) {
      shellMat.current.emissiveIntensity = state.heart > 0
        ? (state.heartFlash > 0.02 ? 4.2 : 0.18)
        : 3.4
    }
    if (keyLight.current) {
      keyLight.current.intensity = state.heart > 0 ? (state.heartFlash > 0.02 ? 16 : 0.3) : 10
    }
    if (fillLight.current) {
      fillLight.current.intensity = state.heart > 0 ? (state.heartFlash > 0.02 ? 5 : 0.04) : 3
    }
    if (coreMat.current) {
      coreMat.current.opacity = state.heart > 0 && state.heartFlash < 0.04 ? 0.12 : 1
    }

    trailCursor.current = (trailCursor.current + 1) % trailRefs.current.length
    const trail = trailRefs.current[trailCursor.current]
    if (trail) {
      trail.visible = true
      trail.position.copy(v.pos)
      trail.scale.setScalar(1)
    }
    for (let i = 0; i < trailRefs.current.length; i += 1) {
      const mesh = trailRefs.current[i]
      if (!mesh?.visible) continue
      const age = (trailCursor.current - i + trailRefs.current.length) % trailRefs.current.length
      const life = 1 - age / trailRefs.current.length
      mesh.scale.setScalar(0.35 + life * 0.65)
      mesh.material.opacity = life * 0.28
    }

    const want = styleRef?.current === 'kontur' ? 1 : 0
    state.mix += (want - state.mix) * Math.min(1, dt * 7)
    const mix = state.mix
    const flash = state.glitch
    const moodGain = 0.7 + state.mood * 0.6
    tunnel.rails.uniforms.uGain.value = (1 - mix * 0.7 + flash * 0.85) * moodGain
    tunnel.rings.uniforms.uGain.value = (1.15 * (1 - mix * 0.7) + flash * 0.7) * moodGain
    tunnel.railLines.opacity = Math.min(1, (mix * 0.92 + flash * 0.9) * moodGain + (1 - mix) * state.mood * 0.28)
    tunnel.ringLines.opacity = Math.min(1, (mix * 0.8 + flash * 0.75) * moodGain + (1 - mix) * state.mood * 0.2)
    if (state.tremor.line > 0.04) {
      const tense = state.tremor.line * (state.lod ? 0.18 : 0.34)
      tunnel.railLines.opacity = Math.min(1, tunnel.railLines.opacity + tense)
      tunnel.ringLines.opacity = Math.min(1, tunnel.ringLines.opacity + tense * 0.72)
    }
    if (state.mind.press > 0.04) {
      const trial = state.mind.press * (state.lod ? 0.1 : 0.26)
      tunnel.railLines.opacity = Math.min(1, tunnel.railLines.opacity + trial)
      tunnel.ringLines.opacity = Math.min(1, tunnel.ringLines.opacity + trial * 0.55)
    }
    if (state.heart > 0 && state.heartFlash < 0.04) {
      tunnel.rails.uniforms.uGain.value *= 0.16
      tunnel.rings.uniforms.uGain.value *= 0.16
      tunnel.railLines.opacity = Math.max(tunnel.railLines.opacity, 0.78)
      tunnel.ringLines.opacity = Math.max(tunnel.ringLines.opacity, 0.62)
    }
    if (state.surge > 0) {
      tunnel.rails.uniforms.uGain.value *= 1.2
      tunnel.rings.uniforms.uGain.value *= 1.15
    }
    if (state.blind.on && Math.abs(state.z - state.blind.z) < state.blind.len + 0.6) {
      tunnel.railLines.opacity *= 0.38
      tunnel.ringLines.opacity *= 0.38
    }
    if (shellMat.current) {
      shellMat.current.opacity = 1 - mix * 0.78
      shellMat.current.depthWrite = mix < 0.8
    }
    if (wireRef.current) {
      wireRef.current.visible = mix > 0.05
      wireRef.current.material.opacity = 0.3 + mix * 0.7
    }
    axes.visible = mix > 0.3
    axes.position.copy(v.pos)
    if (sectionRef.current) {
      sectionRef.current.visible = mix > 0.2
      sectionRef.current.position.set(0, 0, state.z)
      sectionRef.current.material.opacity = mix * 0.62
    }

    let nearest = null
    let nearestAhead = 16
    if (state.mind.decoy > 0) {
      let hot = null
      let hotAhead = 16
      for (let i = 0; i < state.slots.length; i += 1) {
        const slot = state.slots[i]
        if (!slot.active) continue
        const ahead = slot.z - state.z
        if (ahead < hotAhead && ahead > -0.8) {
          hotAhead = ahead
          hot = slot
        }
      }
      if (hot) hot.flash = Math.max(hot.flash, state.lod ? 0.12 : 0.42)
    }
    for (let i = 0; i < state.slots.length; i += 1) {
      const mesh = obstacleRefs.current[i]
      const slot = state.slots[i]
      const edge = edgeRefs.current[i]
      if (!mesh) continue
      if (!slot.active) {
        mesh.visible = false
        if (edge) edge.visible = false
        continue
      }
      const ahead = slot.z - state.z
      const fade = 1 - THREE.MathUtils.smoothstep(ahead, 26, 78)
      const glow = slot.glow * fade
      const close = ahead < 16 && ahead > -0.8
      const inBlind = state.blind.on && Math.abs(slot.z - state.blind.z) < state.blind.len
      const shadowNear = ahead < 2.55 && ahead > -1.1
      const sonarLit = glow > 0.2 || slot.flash > 0.04
      if (inBlind && !sonarLit && !shadowNear) {
        mesh.visible = false
        if (edge) edge.visible = false
        continue
      }
      const showEdge = mix > 0.08 || close || glow > 0.15 || slot.flash > 0.04
      const showFill = glow > 0.03
      mesh.visible = showFill || showEdge
      if (!mesh.visible) {
        if (edge) edge.visible = false
        continue
      }
      boxCenter(slot.wall, slot.z, v.box)
      mesh.position.copy(v.box)
      if (slot.wall % 2 === 0) mesh.scale.set(1.7, 0.52, 1.28)
      else mesh.scale.set(0.52, 1.7, 1.28)
      mesh.material.emissive.set(slot.color)
      mesh.material.opacity = showFill ? Math.min(1, glow * 1.2) * (1 - mix * 0.72) : 0
      mesh.material.depthWrite = mesh.material.opacity > 0.25
      mesh.material.emissiveIntensity = 1.4 + glow * 6
      if (edge) {
        const hot = close || slot.flash > 0.04
        edge.visible = showEdge || slot.flash > 0.04
        edge.material.color.set(slot.flash > 0.04 ? '#fff1a8' : hot ? '#ff4d6a' : '#d9fbff')
        edge.material.opacity = Math.min(1, (hot ? 0.96 : 0.16 + mix * 0.62) + slot.flash)
        if (!state.lod && state.mind.decoy > 0 && i === state.mind.decoySlot && slot.flash < 0.08) {
          edge.material.color.set('#7f93ff')
          edge.material.opacity = Math.min(0.62, edge.material.opacity + 0.22)
        }
      }
      if (close && ahead < nearestAhead && !inBlind) {
        nearestAhead = ahead
        nearest = slot
      }
    }

    for (let i = 0; i < state.decoys.length; i += 1) {
      const mesh = decoyRefs.current[i]
      const decoy = state.decoys[i]
      if (!mesh) continue
      const ahead = decoy.on ? decoy.z - state.z : 99
      if (!decoy.on || ahead < -3 || ahead > 72) {
        mesh.visible = false
        continue
      }
      boxCenter(decoy.wall, decoy.z, v.box)
      mesh.visible = true
      mesh.position.copy(v.box)
      if (decoy.wall % 2 === 0) mesh.scale.set(1.62, 0.46, 1.2)
      else mesh.scale.set(0.46, 1.62, 1.2)
      mesh.material.opacity = 0.22 + Math.abs(Math.sin(state.time * 16 + i)) * 0.5
    }
    if (blindNear.current && blindFar.current) {
      const showBlind = state.blind.on
      blindNear.current.visible = showBlind
      blindFar.current.visible = showBlind
      if (showBlind) {
        blindNear.current.position.set(0, 0, state.blind.z - state.blind.len)
        blindFar.current.position.set(0, 0, state.blind.z + state.blind.len)
      }
    }

    if (dimRef.current && nearest) {
      boxCenter(nearest.wall, nearest.z, v.box)
      const wide = nearest.wall % 2 === 0
      const half = 0.85
      const points = dimGeo.attributes.position.array
      const tick = 0.16
      const x = v.box.x
      const y = v.box.y
      const z = v.box.z
      const write = (index, px, py, pz) => {
        points[index] = px
        points[index + 1] = py
        points[index + 2] = pz
      }
      if (wide) {
        write(0, x - half, y, z)
        write(3, x + half, y, z)
        write(6, x - half, y - tick, z)
        write(9, x - half, y + tick, z)
        write(12, x + half, y - tick, z)
        write(15, x + half, y + tick, z)
      } else {
        write(0, x, y - half, z)
        write(3, x, y + half, z)
        write(6, x - tick, y - half, z)
        write(9, x + tick, y - half, z)
        write(12, x - tick, y + half, z)
        write(15, x + tick, y + half, z)
      }
      dimGeo.attributes.position.needsUpdate = true
      dimRef.current.visible = true
      label.sprite.visible = true
      label.sprite.position.set(x, y + (wide ? 0.62 : 0), z - 0.15)
      label.sprite.material.opacity = 0.35 + mix * 0.65
    } else {
      if (dimRef.current) dimRef.current.visible = false
      label.sprite.visible = false
    }

    if (arcRef.current) {
      let arcAngle = state.angle
      let arcVel = state.angleVel
      let arcZ = state.z
      const arcSpeed = cruise * (1 + state.boost * 0.62)
      const positions = arcGeo.attributes.position.array
      const stride = 0.045
      for (let i = 0; i < ARC; i += 1) {
        const stepTurn = integrateAngle(arcAngle, arcVel, target, stride)
        arcVel = stepTurn.vel
        arcAngle = stepTurn.angle
        arcZ += arcSpeed * stride
        positions[i * 3] = Math.sin(arcAngle) * STICK
        positions[i * 3 + 1] = -Math.cos(arcAngle) * STICK
        positions[i * 3 + 2] = arcZ
      }
      arcGeo.attributes.position.needsUpdate = true
      arcRef.current.computeLineDistances()
      arcRef.current.visible = true
    }

    const specks = speckGeo.attributes.position.array
    const speckStride = state.lod ? 2 : 1
    for (let i = 0; i < SPECKS; i += speckStride) {
      specks[i * 3 + 2] -= speed * motion * (0.45 + (i % 5) * 0.09)
      if (state.rewind > 0) {
        if (specks[i * 3 + 2] > state.z + 78) specks[i * 3 + 2] -= 82
      } else if (specks[i * 3 + 2] < state.z - 8) specks[i * 3 + 2] += 82
    }
    speckGeo.attributes.position.needsUpdate = true
    if (speckRef.current) {
      speckRef.current.material.opacity = (0.14 + drive * 0.62) * (focusing ? 0.55 : 1) * (state.heart > 0 && state.heartFlash < 0.04 ? 0.12 : 1)
      speckRef.current.material.size = 0.04 + drive * 0.08
    }

    const sparkPos = sparkGeo.attributes.position.array
    let sparkCount = 0
    for (const spark of state.sparks) {
      if (spark.life <= 0) continue
      spark.life -= dt
      if (spark.life <= 0) continue
      spark.x += spark.vx * dt * 8
      spark.y += spark.vy * dt * 8
      spark.z += spark.vz * dt * 8
      if (state.rewind > 0) spark.z -= speed * dt * 3.2
      sparkPos[sparkCount * 3] = spark.x
      sparkPos[sparkCount * 3 + 1] = spark.y
      sparkPos[sparkCount * 3 + 2] = spark.z
      sparkCount += 1
    }
    sparkGeo.setDrawRange(0, sparkCount)
    sparkGeo.attributes.position.needsUpdate = true
    if (sparkRef.current) sparkRef.current.visible = sparkCount > 0

    let echoShown = 0
    for (const echo of state.echoes) {
      const ahead = echo.z - state.z
      if (echo.synced || ahead < -2 || ahead > 36) continue
      const mesh = echoRefs.current[echoShown]
      echoShown += 1
      if (!mesh) continue
      const danger = state.slots.some((slot) => (
        slot.active && slot.wall === echo.wall && Math.abs(slot.z - echo.z) < 3.4
      ))
      placeBall(echo.z, echo.wall * Math.PI * 0.5, echo.wall, v.sample)
      mesh.visible = true
      mesh.position.copy(v.sample)
      mesh.material.color.set(danger ? '#ff4d6a' : '#d9fff6')
      mesh.material.opacity = 0.28 + (1 - Math.min(ahead, 36) / 36) * 0.5
    }
    for (let i = echoShown; i < echoRefs.current.length; i += 1) {
      if (echoRefs.current[i]) echoRefs.current[i].visible = false
    }

    for (let i = 0; i < waveRefs.current.length; i += 1) {
      const mesh = waveRefs.current[i]
      const wave = state.waves[state.waves.length - 1 - i]
      if (!mesh) continue
      if (!wave || !wave.sharp) {
        mesh.visible = false
        continue
      }
      mesh.visible = true
      mesh.position.set(0, 0, wave.z)
      const fade = Math.max(0, 1 - wave.life / 1.55)
      mesh.material.opacity = 0.25 + fade * 0.7
    }

    for (let i = 0; i < pulseRefs.current.length; i += 1) {
      const mesh = pulseRefs.current[i]
      const pulse = state.pulses[state.pulses.length - 1 - i]
      if (!mesh) continue
      if (!pulse || (pulse.sharp ? pulse.age > 1.35 : pulse.age > 0.18)) {
        mesh.visible = false
        continue
      }
      mesh.visible = true
      mesh.position.copy(pulse.pos)
      const quiet = !pulse.sharp
      mesh.scale.setScalar(quiet ? 0.42 : Math.max(0.001, pulse.radius))
      const fade = quiet ? Math.max(0, 1 - pulse.age / 0.18) : Math.max(0, 1 - pulse.age / 1.35)
      const kids = mesh.children
      for (let c = 0; c < kids.length; c += 1) {
        const child = kids[c]
        child.visible = quiet ? c === 1 : true
        if (child.material) child.material.opacity = fade * (quiet ? 0.9 : (c === 0 ? 0.55 : 0.8))
      }
    }

    if (arrowRef.current) {
      const showArrow = state.arrow > 0.001
      arrowRef.current.visible = showArrow
      if (showArrow) {
        const dir = Math.sign(state.arrowSign || 1) || 1
        const tx = Math.cos(state.angle) * dir
        const ty = Math.sin(state.angle) * dir
        const arr = arrowGeo.attributes.position.array
        const ox = v.pos.x + tx * 0.2
        const oy = v.pos.y + ty * 0.2
        const oz = v.pos.z + 0.25
        const px = -ty
        const py = tx
        arr[0] = ox - tx * 0.26 + px * 0.16
        arr[1] = oy - ty * 0.26 + py * 0.16
        arr[2] = oz
        arr[3] = ox + tx * 0.36
        arr[4] = oy + ty * 0.36
        arr[5] = oz
        arr[6] = ox - tx * 0.26 - px * 0.16
        arr[7] = oy - ty * 0.26 - py * 0.16
        arr[8] = oz
        arrowGeo.attributes.position.needsUpdate = true
        arrowRef.current.material.opacity = Math.min(1, state.arrow / 0.16)
      }
    }
    if (witnessRef.current) {
      const shown = stepWitness(state, dt, v)
      witnessRef.current.visible = shown
      if (shown) aimWitness(witnessRef.current, state.witness.wall, state.witness.z, v.pos)
    }
    if (shadowRef.current) {
      const shade = !state.lod && state.heart > 0 && state.heartFlash < 0.05
      shadowRef.current.visible = shade
      if (shade) {
        shadowRef.current.position.set(
          v.pos.x - v.up.x * 0.62,
          v.pos.y - v.up.y * 0.62,
          v.pos.z - 0.35,
        )
        if (playerRef.current) shadowRef.current.quaternion.copy(playerRef.current.quaternion)
      }
    }
  })

  return (
    <>
      <group ref={tunnelRef} dispose={null}>
        <mesh geometry={tunnel.railGeo} material={tunnel.rails} dispose={null} />
        <mesh geometry={tunnel.ringGeo} material={tunnel.rings} dispose={null} />
        <lineSegments geometry={tunnel.railEdges} material={tunnel.railLines} />
        <lineSegments geometry={tunnel.ringEdges} material={tunnel.ringLines} />
      </group>

      <primitive object={axes} />
      <primitive object={label.sprite} />
      <lineSegments ref={sectionRef} geometry={sectionGeo} visible={false}>
        <lineBasicMaterial color="#7eb6ff" transparent opacity={0.4} toneMapped={false} depthWrite={false} />
      </lineSegments>
      <lineSegments ref={dimRef} geometry={dimGeo} visible={false} frustumCulled={false}>
        <lineBasicMaterial color="#ff4d6a" transparent opacity={0.92} toneMapped={false} depthWrite={false} />
      </lineSegments>
      <line ref={arrowRef} geometry={arrowGeo} visible={false} frustumCulled={false}>
        <lineBasicMaterial color="#e7fbff" transparent opacity={0.9} toneMapped={false} depthWrite={false} />
      </line>
      <line ref={arcRef} geometry={arcGeo} visible={false} frustumCulled={false}>
        <lineDashedMaterial
          color="#9af6ff"
          dashSize={0.34}
          gapSize={0.18}
          transparent
          opacity={0.88}
          toneMapped={false}
          depthWrite={false}
        />
      </line>
      <points ref={speckRef} geometry={speckGeo} frustumCulled={false}>
        <pointsMaterial
          color="#bff7ff"
          size={0.055}
          transparent
          opacity={0.2}
          depthWrite={false}
          toneMapped={false}
          sizeAttenuation
        />
      </points>

      <group ref={playerRef}>
        <mesh>
          <sphereGeometry args={[PLAYER_R, 28, 20]} />
          <meshStandardMaterial
            ref={shellMat}
            color="#001014"
            emissive="#00f3ff"
            emissiveIntensity={3.4}
            roughness={0.18}
            metalness={0.15}
            transparent
            toneMapped={false}
          />
        </mesh>
        <lineSegments ref={wireRef} geometry={sphereEdges}>
          <lineBasicMaterial color="#e7fbff" transparent opacity={0.15} toneMapped={false} />
        </lineSegments>
        <mesh>
          <sphereGeometry args={[PLAYER_R * 0.42, 20, 14]} />
          <meshBasicMaterial ref={coreMat} color="#ff2bd6" transparent opacity={1} toneMapped={false} />
        </mesh>
        <pointLight ref={keyLight} color="#7af7ff" intensity={10} distance={8} decay={2} />
        <pointLight ref={fillLight} color="#ff2bd6" intensity={3} distance={3.5} decay={2} />
      </group>

      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={`trail-${i}`} ref={(node) => { trailRefs.current[i] = node }} visible={false}>
          <ringGeometry args={[0.16, 0.22, 18]} />
          <meshBasicMaterial
            color="#00f3ff"
            transparent
            opacity={0.2}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}

      {runtime.current.slots.map((_, i) => (
        <mesh key={`obs-${i}`} ref={(node) => { obstacleRefs.current[i] = node }} visible={false}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color="#000000"
            emissive="#00f3ff"
            emissiveIntensity={0}
            transparent
            opacity={0}
            roughness={1}
            metalness={0}
            toneMapped={false}
          />
          <lineSegments
            ref={(node) => { edgeRefs.current[i] = node }}
            geometry={boxEdges}
          >
            <lineBasicMaterial
              color="#d9fbff"
              transparent
              opacity={0.35}
              toneMapped={false}
              depthWrite={false}
            />
          </lineSegments>
        </mesh>
      ))}

      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={`echo-${i}`} ref={(node) => { echoRefs.current[i] = node }} visible={false}>
          <ringGeometry args={[0.22, 0.28, 20]} />
          <meshBasicMaterial
            color="#d9fff6"
            transparent
            opacity={0.45}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      {Array.from({ length: 3 }, (_, i) => (
        <mesh key={`wave-${i}`} ref={(node) => { waveRefs.current[i] = node }} visible={false}>
          <torusGeometry args={[1.9, 0.03, 6, 40]} />
          <meshBasicMaterial
            color="#bff8ff"
            transparent
            opacity={0.8}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}

      <points ref={sparkRef} geometry={sparkGeo} frustumCulled={false} visible={false}>
        <pointsMaterial
          color="#f4fdff"
          size={0.07}
          transparent
          opacity={0.9}
          depthWrite={false}
          toneMapped={false}
          sizeAttenuation
        />
      </points>

      {Array.from({ length: 2 }, (_, i) => (
        <lineSegments
          key={`decoy-${i}`}
          ref={(node) => { decoyRefs.current[i] = node }}
          geometry={boxEdges}
          visible={false}
          frustumCulled={false}
        >
          <lineBasicMaterial color="#9af6ff" transparent opacity={0.45} toneMapped={false} depthWrite={false} />
        </lineSegments>
      ))}
      <mesh ref={blindNear} visible={false} frustumCulled={false}>
        <torusGeometry args={[2.02, 0.03, 6, 28]} />
        <meshBasicMaterial color="#ff2a4a" transparent opacity={0.22} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={blindFar} visible={false} frustumCulled={false}>
        <torusGeometry args={[2.02, 0.03, 6, 28]} />
        <meshBasicMaterial color="#3d7eff" transparent opacity={0.16} depthWrite={false} toneMapped={false} />
      </mesh>

      <group ref={witnessRef} visible={false}>
        <lineSegments geometry={witnessGeo.lines} frustumCulled={false}>
          <lineBasicMaterial color="#d7fbff" transparent opacity={0.92} toneMapped={false} depthWrite={false} />
        </lineSegments>
        <points geometry={witnessGeo.points} frustumCulled={false}>
          <pointsMaterial
            color="#00f3ff"
            size={0.05}
            transparent
            opacity={0.95}
            depthWrite={false}
            toneMapped={false}
            sizeAttenuation
          />
        </points>
      </group>
      <lineSegments ref={shadowRef} geometry={sphereEdges} visible={false} frustumCulled={false}>
        <lineBasicMaterial color="#ff2bd6" transparent opacity={0.28} toneMapped={false} depthWrite={false} />
      </lineSegments>

      {Array.from({ length: 3 }, (_, i) => (
        <group key={`pulse-${i}`} ref={(node) => { pulseRefs.current[i] = node }} visible={false}>
          <mesh>
            <sphereGeometry args={[1, 20, 14]} />
            <meshBasicMaterial
              color="#9af8ff"
              wireframe
              transparent
              opacity={0.6}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          <mesh>
            <ringGeometry args={[0.9, 1, 64]} />
            <meshBasicMaterial
              color="#00f3ff"
              transparent
              opacity={0.8}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          <mesh scale={0.72}>
            <ringGeometry args={[0.86, 1, 48]} />
            <meshBasicMaterial
              color="#ff2bd6"
              transparent
              opacity={0.75}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}

      <EffectComposer
        multisampling={0}
        enableNormalPass={false}
        frameBufferType={THREE.UnsignedByteType}
      >
        <Bloom
          ref={bloomRef}
          intensity={1.25}
          luminanceThreshold={0.22}
          luminanceSmoothing={0.2}
          mipmapBlur={false}
          radius={0.55}
        />
        <ChromaticAberration ref={chromaFx} offset={[0, 0]} radialModulation modulationOffset={0.15} />
      </EffectComposer>
    </>
  )
}

function WorldCanvas({ active, runId, input, styleRef, onScore, onCrash, onNearMiss, onGlitch, onEcho, onLoan, onDread, onTelemetry, onFps, onAbyss, onTremor, onCurse, onScale, onMind }) {
  const callbacks = useRef({ onScore, onCrash, onNearMiss, onGlitch, onEcho, onLoan, onDread, onTelemetry, onFps, onAbyss, onTremor, onCurse, onScale, onMind })
  callbacks.current.onScore = onScore
  callbacks.current.onCrash = onCrash
  callbacks.current.onNearMiss = onNearMiss
  callbacks.current.onGlitch = onGlitch
  callbacks.current.onEcho = onEcho
  callbacks.current.onLoan = onLoan
  callbacks.current.onDread = onDread
  callbacks.current.onTelemetry = onTelemetry
  callbacks.current.onFps = onFps
  callbacks.current.onAbyss = onAbyss
  callbacks.current.onTremor = onTremor
  callbacks.current.onCurse = onCurse
  callbacks.current.onScale = onScale
  callbacks.current.onMind = onMind

  return (
    <Canvas
      className="view"
      flat
      dpr={[1, Math.min(window.devicePixelRatio || 1, 2)]}
      gl={{
        antialias: false,
        alpha: false,
        powerPreference: 'high-performance',
        stencil: false,
      }}
      camera={{ fov: 68, near: 0.1, far: 280, position: [0, 0.4, -6.4] }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 1)
      }}
    >
      <Scene active={active} runId={runId} input={input} styleRef={styleRef} callbacks={callbacks} />
    </Canvas>
  )
}

export default memo(WorldCanvas)
