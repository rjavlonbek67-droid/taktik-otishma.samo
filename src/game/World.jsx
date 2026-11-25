import { memo, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import * as THREE from 'three'
import {
  crashSound,
  gravitySound,
  passSound,
  pulseSound,
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

function sphereHitsBox(ball, wall, center) {
  const wide = wall % 2 === 0
  const hx = wide ? HALF_WIDE : HALF_THIN
  const hy = wide ? HALF_THIN : HALF_WIDE
  const dx = Math.max(Math.abs(ball.x - center.x) - hx, 0)
  const dy = Math.max(Math.abs(ball.y - center.y) - hy, 0)
  const dz = Math.max(Math.abs(ball.z - center.z) - HALF_DEEP, 0)
  return dx * dx + dy * dy + dz * dz < PLAYER_R * PLAYER_R
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
    })),
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
  state.gates.length = 0
  state.pulses.length = 0
  for (const slot of state.slots) {
    slot.active = false
    slot.glow = 0
    slot.lastPulse = 0
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
    colorIndex += 1
  }
  state.gid += 1
  const gap = Math.max(13.5, 23 - state.z * 0.007)
  state.nextSpawn += gap
}

function Scene({ active, runId, input, callbacks }) {
  const tunnel = useMemo(() => {
    const { railGeo, ringGeo } = buildTunnelGeometry()
    return {
      railGeo,
      ringGeo,
      rails: createTunnelMaterial('#00f3ff', 1),
      rings: createTunnelMaterial('#3d7eff', 1.15),
    }
  }, [])

  useEffect(() => () => {
    tunnel.railGeo.dispose()
    tunnel.ringGeo.dispose()
    tunnel.rails.dispose()
    tunnel.rings.dispose()
  }, [tunnel])

  const runtime = useRef(null)
  if (!runtime.current) runtime.current = createRuntime()

  const tunnelRef = useRef(null)
  const playerRef = useRef(null)
  const shellMat = useRef(null)
  const obstacleRefs = useRef([])
  const pulseRefs = useRef([])
  const trailRefs = useRef([])
  const trailCursor = useRef(0)
  const tmp = useRef({
    pos: new THREE.Vector3(),
    up: new THREE.Vector3(),
    look: new THREE.Vector3(),
    cam: new THREE.Vector3(),
    box: new THREE.Vector3(),
    gravity: new THREE.Vector3(0, -1, 0),
    sample: new THREE.Vector3(),
  })

  const { camera, size } = useThree()

  useFrame((_, delta) => {
    const dt = Math.min(0.033, delta)
    const state = runtime.current
    const v = tmp.current
    state.time += dt

    if (active && state.runId !== runId) {
      resetRuntime(state)
      state.runId = runId
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
      camera.position.set(0, v.pos.y + 1.35, -6.4)
      camera.lookAt(0, v.pos.y + 0.2, 10)
      camera.fov = size.width < size.height ? 84 : 68
      camera.updateProjectionMatrix()
      syncTunnel(tunnel.rails, [], 0, v.gravity, state.time)
      syncTunnel(tunnel.rings, [], 0, v.gravity, state.time)
      for (const mesh of obstacleRefs.current) if (mesh) mesh.visible = false
      for (const mesh of pulseRefs.current) if (mesh) mesh.visible = false
      for (const mesh of trailRefs.current) if (mesh) mesh.visible = false
      return
    }

    state.age += dt
    state.cooldown = Math.max(0, state.cooldown - dt)

    if (input.current.pending && state.cooldown <= 0) {
      const sign = input.current.sign
      input.current.pending = false
      state.targetWall = (state.targetWall + sign + 4) % 4
      state.cooldown = 0.18
      placeBall(state.z, state.angle, state.targetWall, v.pos)
      emitPulse(state, v.pos)
      gravitySound()
      pulseSound()
      vibrate(12)
    } else if (input.current.pending) {
      input.current.pending = false
    }

    if (!state.didIntro && state.age > 0.45) {
      state.didIntro = true
      placeBall(state.z, state.angle, state.targetWall, v.pos)
      emitPulse(state, v.pos)
      pulseSound()
    }

    const target = state.targetWall * Math.PI * 0.5
    const diff = shortest(target, state.angle)
    const accel = diff * OMEGA * OMEGA - 2 * OMEGA * state.angleVel
    state.angleVel = Math.max(-9, Math.min(9, state.angleVel + accel * dt))
    state.angle += state.angleVel * dt

    const speed = Math.min(29, 13 + state.z * 0.011) * Math.min(1, 0.35 + state.age / 0.7)
    state.prevZ = state.z
    state.z += speed * dt
    setDrive(speed)

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
      state.crashed = true
      state.alive = false
      const crashedScore = Math.floor(state.z * 0.45 + state.bonus)
      crashSound()
      stopDrone()
      vibrate(48)
      callbacks.current.onCrash(crashedScore)
      return
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
      pulse.age += dt
      pulse.radius += dt * 38
    }
    for (let i = state.pulses.length - 1; i >= 0; i -= 1) {
      if (state.pulses[i].age > 2.4) state.pulses.splice(i, 1)
    }

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
      slot.glow = Math.max(0, slot.glow - dt / 3.4)
    }

    v.gravity.set(Math.sin(state.angle), -Math.cos(state.angle), 0)
    v.up.set(-v.gravity.x, -v.gravity.y, 0)
    const back = size.width < size.height ? 7.5 : 5.7
    v.cam.set(v.pos.x + v.up.x * 1.2, v.pos.y + v.up.y * 1.2, v.pos.z - back)
    v.look.set(v.pos.x + v.up.x * 0.28, v.pos.y + v.up.y * 0.28, v.pos.z + 9)
    const fov = size.width < size.height ? 84 : 68
    if (camera.fov !== fov) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
    camera.up.copy(v.up)
    camera.position.copy(v.cam)
    camera.lookAt(v.look)

    const anchor = Math.floor(state.z / 8) * 8
    if (tunnelRef.current) tunnelRef.current.position.z = anchor
    syncTunnel(tunnel.rails, state.pulses, state.z, v.gravity, state.time)
    syncTunnel(tunnel.rings, state.pulses, state.z, v.gravity, state.time)

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

    for (let i = 0; i < state.slots.length; i += 1) {
      const mesh = obstacleRefs.current[i]
      const slot = state.slots[i]
      if (!mesh) continue
      if (!slot.active) {
        mesh.visible = false
        continue
      }
      const ahead = slot.z - state.z
      const fade = 1 - THREE.MathUtils.smoothstep(ahead, 26, 78)
      const glow = slot.glow * fade
      mesh.visible = glow > 0.03
      if (!mesh.visible) continue
      boxCenter(slot.wall, slot.z, v.box)
      mesh.position.copy(v.box)
      if (slot.wall % 2 === 0) mesh.scale.set(1.7, 0.52, 1.28)
      else mesh.scale.set(0.52, 1.7, 1.28)
      mesh.material.emissive.set(slot.color)
      mesh.material.opacity = Math.min(1, glow * 1.2)
      mesh.material.emissiveIntensity = 1.4 + glow * 6
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
      </group>

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
            toneMapped={false}
          />
        </mesh>
        <mesh>
          <sphereGeometry args={[PLAYER_R * 0.42, 20, 14]} />
          <meshBasicMaterial color="#ff2bd6" toneMapped={false} />
        </mesh>
        <pointLight color="#7af7ff" intensity={10} distance={8} decay={2} />
        <pointLight color="#ff2bd6" intensity={3} distance={3.5} decay={2} />
      </group>

      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={`trail-${i}`} ref={(node) => { trailRefs.current[i] = node }} visible={false}>
          <sphereGeometry args={[PLAYER_R * 0.72, 12, 10]} />
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
        </mesh>
      ))}

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
      </EffectComposer>
    </>
  )
}

function WorldCanvas({ active, runId, input, onScore, onCrash }) {
  const callbacks = useRef({ onScore, onCrash })
  callbacks.current.onScore = onScore
  callbacks.current.onCrash = onCrash

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
      <Scene active={active} runId={runId} input={input} callbacks={callbacks} />
    </Canvas>
  )
}

export default memo(WorldCanvas)
