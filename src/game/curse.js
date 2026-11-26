export function createCurse() {
  return {
    on: 0,
    anchor: 0,
    mul: 1,
    rush: 1,
    press: 0,
    watch: 0,
    impulse: 0,
    sting: 0,
    banner: 0,
    boonCd: 0,
    lieTick: 6.2,
    forceLie: 0,
    strainPrev: 0,
    phase: 0,
    glint: 0,
  }
}

export function seedCurse(curse, raw) {
  resetCurse(curse)
  if (raw < 1000) return
  curse.on = 1
  curse.anchor = raw
  curse.mul = 1.35
  curse.rush = 1.12
  curse.press = 0.9
  curse.watch = 0.6
}

export function resetCurse(curse) {
  curse.on = 0
  curse.anchor = 0
  curse.mul = 1
  curse.rush = 1
  curse.press = 0
  curse.watch = 0
  curse.impulse = 0
  curse.sting = 0
  curse.banner = 0
  curse.boonCd = 0
  curse.lieTick = 6.2
  curse.forceLie = 0
  curse.strainPrev = 0
  curse.phase = 0
  curse.glint = 0
}

export function curseScore(curse, raw) {
  if (!curse.on) return raw
  return curse.anchor + (raw - curse.anchor) * curse.mul
}

export function curseBoon(curse, danger) {
  if (!curse.on || !danger || curse.boonCd > 0) return 0
  curse.boonCd = 0.48
  return 16
}

export function stepCurse(curse, raw, dt, lod) {
  curse.boonCd = Math.max(0, curse.boonCd - dt)
  if (!curse.on) {
    if (raw < 1000) return
    curse.on = 1
    curse.anchor = raw
    curse.mul = 1.35
    curse.impulse = 1
    curse.sting = 1
    curse.lieTick = 1.4
  }
  const soft = lod ? 0.48 : 1
  curse.rush = lod ? 1.06 : 1.12
  curse.press = 0.9 * soft
  curse.watch = 0.6 * soft
  curse.impulse = Math.max(0, curse.impulse - dt * 2.3)
  curse.phase += dt
  const wave = 0.5 + 0.5 * Math.sin(curse.phase * 0.85)
  curse.glint = (lod ? 0.05 : 0.1) + wave * (lod ? 0.04 : 0.1)
  curse.lieTick -= dt
  if (curse.lieTick <= 0) {
    curse.lieTick = lod ? 9.6 : 6.1
    curse.forceLie = 1
  }
}

export function applyCurse(curse, time, v) {
  if (curse.impulse < 0.04) return
  const kick = curse.impulse * 0.1
  v.cam.addScaledVector(v.right, Math.sin(time * 62) * kick)
  v.cam.addScaledVector(v.up, Math.cos(time * 44) * kick * 0.6)
  v.look.addScaledVector(v.up, Math.sin(time * 51) * kick * 0.25)
}
