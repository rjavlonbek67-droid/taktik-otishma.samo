import { memo, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, ChromaticAberration, EffectComposer } from '@react-three/postprocessing'
import * as THREE from 'three'
import {
  crashSound,
  echoSyncSound,
  echoWarnSound,
  gravitySound,
  impulseSound,
  loanSound,
  nearMissSound,
  passSound,
  pulseSound,
  repaySound,
  setDrive,
  stopDrone,
  vibrate,
} from '../audio.js'
import { COLORS, PLAYER_R, POOL, STICK, WALL } from './constants.js'
import { buildTunnelGeometry, createTunnelMaterial, syncTunnel } from './tunnel.js'

const HALF_THIN = 0.26
const HALF_WIDE = 0.85
const HALF_DEEP = 0.64
const OMEGA = 12
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

function pickBlocked(count, avoid) {
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

function emitPulse(state, origin) {
  state.pulses.push({
    id: state.pid,
    age: 0,
    radius: 0.45,
    pos: origin.clone(),
  })
  state.pid += 1
  if (state.pulses.length > 4) state.pulses.shift()
  state.waves.push({ id: state.wid, z: origin.z, life: 0 })
  state.wid += 1
  if (state.waves.length > 3) state.waves.shift()
}

function burstSparks(state, origin, count) {
  for (let n = 0; n < count; n += 1) {
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
  state.echoes.push({
    z: state.z + 46,
    wall: state.targetWall,
    synced: false,
  })
  if (state.echoes.length > 8) state.echoes.shift()
}

function stepLoan(state, dt, callbacks) {
  state.loanCd = Math.max(0, state.loanCd - dt)
  if (state.loan === 'slow') {
    state.loanT -= dt
    if (state.loanT <= 0) {
      state.loan = 'repay'
      state.loanT = 1.25
      state.boost = Math.max(state.boost, 0.9)
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
        state.bonus += 36
        callbacks.current.onLoan?.({ phase: 'clear', points: 36 })
      }
      callbacks.current.onLoan?.({ phase: 'idle' })
    }
  }
}

function spawnGate(state) {
  const serial = state.gid
  const count = state.z < 220 ? 1 : state.z < 620 ? 2 : 3
  const blocked = pickBlocked(count, serial <= 2 ? 0 : null)
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
  const gap = Math.max(13.5, 23 - state.z * 0.007)
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

  const swayTarget = focusing ? 0 : 1
  state.sway += (swayTarget - state.sway) * Math.min(1, dt * (focusing ? 14 : 2.6))
  state.breath += dt * (0.82 + signals.drive * 0.4) * (0.12 + state.sway * 0.88)

  if (signals.spike) state.recoil = 1
  else state.recoil += (0 - state.recoil) * Math.min(1, dt * 2.5)

  const dirx = signals.threat > 0.04 ? signals.dirx : 0
  const diry = signals.threat > 0.04 ? signals.diry : 0
  state.threat += (signals.threat - state.threat) * Math.min(1, dt * 4)
  state.threatX += (dirx - state.threatX) * Math.min(1, dt * 3.4)
  state.threatY += (diry - state.threatY) * Math.min(1, dt * 3.4)

  v.right.crossVectors(v.up, v.forward).normalize()
  const calm = focusing ? 0.05 : 1
  const peek = state.suspicion * calm + state.peekKick
  const breathe = Math.sin(state.breath * 1.6) * 0.055 * state.sway
  const eye = Math.sin(state.breath * 0.67 + 0.4) * 0.03 * state.sway
  const shake = signals.drive * signals.drive * 0.05 * state.sway
  const lean = Math.tan(THREE.MathUtils.degToRad(4.4)) * 9 * state.threat * (focusing ? 0.4 : 1)

  v.cam.addScaledVector(v.right, peek * 1.28 * state.peekSide + eye + Math.sin(state.time * 41) * shake)
  v.cam.addScaledVector(v.up, Math.abs(peek) * 0.72 + breathe + Math.sin(state.time * 27 + 1.3) * shake * 0.7)
  v.cam.z -= state.recoil * 1.22
  v.look.addScaledVector(v.right, peek * 0.24 * state.peekSide + eye * 1.35)
  v.look.addScaledVector(v.up, Math.cos(state.breath * 0.53) * 0.02 * state.sway)
  v.look.x += state.threatX * lean
  v.look.y += state.threatY * lean
  v.look.z -= state.recoil * 0.28

  const roll = THREE.MathUtils.clamp(
    state.peekSide * state.suspicion * calm * THREE.MathUtils.degToRad(3.4)
      + state.dutchSide * state.dutch * THREE.MathUtils.degToRad(8)
      + Math.sign(state.threatX || 1) * state.threat * (focusing ? 0.35 : 1) * THREE.MathUtils.degToRad(3.2),
    THREE.MathUtils.degToRad(-11),
    THREE.MathUtils.degToRad(11),
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
    label.texture.dispose()
    label.material.dispose()
  }, [arcGeo, boxEdges, dimGeo, label, sectionGeo, sparkGeo, speckGeo, sphereEdges, tunnel])

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
  const chromaFx = useRef(null)
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
    const dt = Math.min(0.033, delta)
    const state = runtime.current
    const v = tmp.current
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
    const focusing = Boolean(input.current.focus)

    if (input.current.pending && state.cooldown <= 0) {
      const sign = input.current.sign
      const immediate = input.current.immediate
      input.current.pending = false
      input.current.immediate = false
      state.targetWall = (state.targetWall + sign + 8) % 4
      state.dwell = 0
      state.armedPeek = 0
      state.peekKick = -state.suspicion * state.peekSide
      state.suspicion = 0
      state.flinch = 1
      if (Math.abs(sign) >= 2) {
        state.rule = 1
        state.dutchSide = sign > 0 ? 1 : -1
      }
      if (immediate) {
        state.angle = state.targetWall * Math.PI * 0.5
        state.angleVel = 0
        state.cooldown = 0.1
      } else {
        state.cooldown = 0.18
      }
      placeBall(state.z, state.angle, state.targetWall, v.pos)
      rememberEcho(state)
      emitPulse(state, v.pos)
      burstSparks(state, v.pos, Math.abs(sign) >= 2 ? 16 : 10)
      tripGlitch(state, callbacks)
      gravitySound(sign)
      pulseSound()
      vibrate(12)
    } else if (input.current.pending) {
      input.current.pending = false
      input.current.immediate = false
    }

    if (input.current.impulse) {
      input.current.impulse = false
      state.boost = 1
      placeBall(state.z, state.angle, state.targetWall, v.pos)
      emitPulse(state, v.pos)
      impulseSound(Math.min(29, 13 + state.z * 0.011))
      pulseSound()
      vibrate(16)
    }

    if (input.current.loan && state.loan === 'idle' && state.loanCd <= 0) {
      input.current.loan = false
      state.loan = 'slow'
      state.loanT = 1.8
      state.loanClean = true
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
    const diff = shortest(target, state.angle)
    const accel = diff * OMEGA * OMEGA - 2 * OMEGA * state.angleVel
    state.angleVel = Math.max(-9, Math.min(9, state.angleVel + accel * step))
    state.angle += state.angleVel * step

    const cruise = Math.min(29, 13 + state.z * 0.011) * Math.min(1, 0.35 + state.age / 0.7)
    state.boost = Math.max(0, state.boost - dt * 1.4)
    let speed = cruise * (1 + state.boost * 0.62)
    if (state.loan === 'repay') speed *= 1.42
    state.prevZ = state.z
    state.z += speed * step
    setDrive(speed, state.loan === 'repay' ? false : (focusing || state.loan === 'slow'))

    while (state.nextSpawn < state.z + 95) spawnGate(state)

    placeBall(state.z, state.angle, state.targetWall, v.pos)
    let hit = false
    for (const slot of state.slots) {
      if (!slot.active) continue
      if (slot.z < state.prevZ - 1.4 || slot.z > state.z + 1.4) continue
      const sampleZ = Math.min(Math.max(slot.z, state.prevZ), state.z)
      placeBall(sampleZ, state.angle, state.targetWall, v.sample)
      boxCenter(slot.wall, slot.z, v.box)
      if (sphereHitsBox(v.sample, slot.wall, v.box)) {
        hit = true
        break
      }
    }

    if (hit && !state.crashed) {
      state.loanClean = false
      state.crashed = true
      state.alive = false
      const crashedScore = Math.floor(state.z * 0.45 + state.bonus)
      crashSound()
      stopDrone()
      vibrate(48)
      callbacks.current.onCrash(crashedScore)
      return
    }

    for (const echo of state.echoes) {
      if (echo.synced) continue
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
        echoWarnSound()
        tripGlitch(state, callbacks)
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

    let bestGap = 0.48
    let bestMult = 0
    let bestSlot = null
    for (const slot of state.slots) {
      if (!slot.active || slot.missed) continue
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
      state.bonus += points
      bestSlot.flash = 1
      nearMissSound(bestMult)
      vibrate(18)
      burstSparks(state, v.pos, 8)
      tripGlitch(state, callbacks)
      callbacks.current.onNearMiss?.({ mult: bestMult, points, combo: state.combo })
      state.recoil = 1
    }
    if (input.current.glitch) {
      input.current.glitch = 0
      state.recoil = 1
      placeBall(state.z, state.angle, state.targetWall, v.pos)
      burstSparks(state, v.pos, 14)
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
      }
      if (gate.z < state.z - 12) state.gates.splice(i, 1)
    }

    const total = Math.floor(state.z * 0.45 + state.bonus)
    if (total !== state.lastScore) {
      state.lastScore = total
      callbacks.current.onScore(total)
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
      slot.glow = Math.max(0, slot.glow - step / 3.4)
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
    const drive = THREE.MathUtils.clamp((speed - 13) / 16, 0, 1)
    const streak = Math.min(1, (state.combo + state.echoCombo) / 8)
    const moodTarget = THREE.MathUtils.clamp(0.2 + drive * 0.48 + streak * 0.38 - state.strain * 0.42, 0.06, 1)
    state.mood += (moodTarget - state.mood) * Math.min(1, dt * 1.7)
    state.strain = Math.max(0, state.strain - dt * 0.07)
    state.rhythm = 0.55 + drive * 1.35 + streak * 0.7 + (state.loan === 'repay' ? 1 : 0)
    const mood = { mood: state.mood, rhythm: state.rhythm, strain: state.strain }
    state.moodPack = mood
    liveCamera(state, dt, focusing, v, {
      drive,
      threat: Math.min(1, threatScore),
      dirx: threatX,
      diry: threatY,
      spike: false,
      rule: input.current.rule,
    })
    const loanFov = state.loan === 'slow' ? -7 : state.loan === 'repay' ? 5 : 0
    const fov = Math.min(98, (size.width < size.height ? 84 : 68) + drive * 14 - (focusing ? 8 : 0) + loanFov + state.recoil * 3.2)
    if (Math.abs(camera.fov - fov) > 0.12) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
    camera.up.copy(v.rolled)
    camera.position.copy(v.cam)
    camera.lookAt(v.look)
    if (chromaFx.current) {
      const split = state.glitch
      chromaFx.current.offset.set(
        (Math.random() - 0.5) * 0.02 * split,
        (Math.random() - 0.5) * 0.012 * split,
      )
    }

    const anchor = Math.floor(state.z / 8) * 8
    if (tunnelRef.current) {
      const width = (1 + state.mood * 0.04 - state.strain * 0.028) * (1 + Math.sin(state.time * (0.7 + state.rhythm)) * 0.012)
      tunnelRef.current.position.z = anchor
      tunnelRef.current.scale.set(width, width, 1)
    }
    v.moodColor.set(state.strain > state.mood ? 0x12010c : 0x001016)
    v.moodColor.multiplyScalar(0.35 + state.mood * 0.2)
    gl.setClearColor(v.moodColor)
    syncTunnel(tunnel.rails, state.pulses, state.z, v.gravity, state.time, state.moodPack)
    syncTunnel(tunnel.rings, state.pulses, state.z, v.gravity, state.time, state.moodPack)

    if (playerRef.current) {
      playerRef.current.position.copy(v.pos)
      playerRef.current.rotation.x -= dt * (1.2 + speed * 0.05)
    }
    if (shellMat.current) shellMat.current.emissiveIntensity = 3.4

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
      }
      if (close && ahead < nearestAhead) {
        nearestAhead = ahead
        nearest = slot
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
        const turn = shortest(target, arcAngle)
        const push = turn * OMEGA * OMEGA - 2 * OMEGA * arcVel
        arcVel = Math.max(-9, Math.min(9, arcVel + push * stride))
        arcAngle += arcVel * stride
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
    for (let i = 0; i < SPECKS; i += 1) {
      specks[i * 3 + 2] -= speed * step * (0.45 + (i % 5) * 0.09)
      if (specks[i * 3 + 2] < state.z - 8) specks[i * 3 + 2] += 82
    }
    speckGeo.attributes.position.needsUpdate = true
    if (speckRef.current) {
      speckRef.current.material.opacity = (0.14 + drive * 0.62) * (focusing ? 0.55 : 1)
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
      if (!wave) {
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
      if (!pulse || pulse.age > 1.35) {
        mesh.visible = false
        continue
      }
      mesh.visible = true
      mesh.position.copy(pulse.pos)
      mesh.scale.setScalar(Math.max(0.001, pulse.radius))
      const fade = Math.max(0, 1 - pulse.age / 1.35)
      mesh.children.forEach((child, index) => {
        if (child.material) child.material.opacity = fade * (index === 0 ? 0.55 : 0.8)
      })
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
          <meshBasicMaterial color="#ff2bd6" toneMapped={false} />
        </mesh>
        <pointLight color="#7af7ff" intensity={10} distance={8} decay={2} />
        <pointLight color="#ff2bd6" intensity={3} distance={3.5} decay={2} />
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

function WorldCanvas({ active, runId, input, styleRef, onScore, onCrash, onNearMiss, onGlitch, onEcho, onLoan }) {
  const callbacks = useRef({ onScore, onCrash, onNearMiss, onGlitch, onEcho, onLoan })
  callbacks.current.onScore = onScore
  callbacks.current.onCrash = onCrash
  callbacks.current.onNearMiss = onNearMiss
  callbacks.current.onGlitch = onGlitch
  callbacks.current.onEcho = onEcho
  callbacks.current.onLoan = onLoan

  return (
    <Canvas
      className="view"
      flat
      dpr={[1, 1.6]}
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
