import * as THREE from 'three'
import { abyssSting, mirageHum, mirageSnap } from '../audio.js'

export const ABYSS_TINT = new THREE.Color('#07111c')

const STEPS = [0, 160, 340, 540, 740, 900, 1000]
const MUL = [1, 1.07, 1.14, 1.22, 1.31, 1.4, 1.5]
const PUSH = [0, 0.08, 0.16, 0.28, 0.4, 0.55, 0.75]
const COLD = [0, 0.1, 0.18, 0.3, 0.46, 0.64, 0.86]
const WATCH = [0, 0.16, 0.3, 0.44, 0.58, 0.76, 0.92]
const GLINT = [0, 0, 0.04, 0.08, 0.12, 0.18, 0.26]

function stageOf(score) {
  let stage = 0
  for (let i = 1; i < STEPS.length; i += 1) {
    if (score >= STEPS[i]) stage = i
  }
  return stage
}

function plantSnap(state) {
  const z = state.z + 12
  const crowded = state.slots.some((slot) => (
    slot.active && slot.wall === state.targetWall && Math.abs(slot.z - z) < 4.5
  ))
  if (crowded) return
  const slot = state.slots.find((item) => !item.active)
  if (!slot) return
  slot.active = true
  slot.z = z
  slot.wall = state.targetWall
  slot.glow = 0
  slot.color = '#9fb4ff'
  slot.gateId = 0
  slot.lastPulse = 0
  slot.lastWave = 0
  slot.missed = false
  slot.flash = 0
}

export function stepAbyss(state, dt, callbacks) {
  const score = state.z * 0.45 + state.bonus
  const stage = stageOf(score)
  if (stage !== state.abyssStage) {
    state.abyssStage = stage
    if (stage > 0) {
      abyssSting()
      callbacks.current.onAbyss?.({ phase: 'stage', stage })
    }
  }
  state.abyssMul = MUL[stage]
  state.abyssPush = PUSH[stage]
  state.abyssCold = state.mirage > 0 ? COLD[stage] * 0.25 : COLD[stage]
  state.abyssWatch = state.mirage > 0 ? 0.1 : WATCH[stage]
  state.abyssGlitch = state.mirage > 0 ? 0 : GLINT[stage]
  state.abyssCd = Math.max(0, state.abyssCd - dt)

  if (state.mirage > 0) {
    state.mirage -= dt
    state.strain = Math.max(0, state.strain - dt * 0.4)
    if (state.mirage <= 0) {
      state.mirage = 0
      plantSnap(state)
      state.strain = Math.min(1, state.strain + 0.5)
      state.recoil = 1
      state.glitch = 1
      state.abyssSnap = 1
      mirageSnap()
      callbacks.current.onAbyss?.({ phase: 'snap' })
    }
  } else if (
    stage >= 3
    && state.abyssCd <= 0
    && state.rewind <= 0
    && state.surge <= 0
    && state.loan !== 'repay'
    && state.age > 10
  ) {
    state.mirage = 0.92
    state.abyssCd = 15 + stage
    mirageHum()
    callbacks.current.onAbyss?.({ phase: 'mirage' })
  }

  if (stage >= 5) {
    state.abyssPulse -= dt
    if (state.abyssPulse <= 0) {
      state.abyssPulse = stage >= 6 ? 1.7 : 2.5
      state.abyssPing = 1
    }
  }
}
