export function createTremor() {
  return {
    amp: 0,
    fov: 0,
    roll: 0,
    line: 0,
    glint: 0,
    warn: 0.45,
    heart: 0.4,
    mark: 0,
    cue: 0,
    cueSent: 0,
    pulse: 0,
  }
}

export function resetTremor(tremor) {
  tremor.amp = 0
  tremor.fov = 0
  tremor.roll = 0
  tremor.line = 0
  tremor.glint = 0
  tremor.warn = 0.45
  tremor.heart = 0.4
  tremor.mark = 0
  tremor.cue = 0
  tremor.cueSent = 0
  tremor.pulse = 0
}

export function stepTremor(tremor, score, dt, lod) {
  const soft = lod ? 0.45 : 1
  tremor.pulse = 0
  let target = 0
  let line = 0
  let glint = 0
  let cue = 0

  if (score >= 470 && score < 500) {
    const u = (score - 470) / 29
    target = (0.3 + u * 0.18) * soft
    line = 0.4 + u * 0.4
    tremor.warn -= dt
    if (tremor.warn <= 0) {
      tremor.warn = 0.8 - u * 0.16
      tremor.pulse = 1
    }
  }

  if (score >= 940 && score < 1000) {
    let step = 0.32
    if (score >= 960) step = 0.48
    if (score >= 980) step = 0.66
    if (score >= 990) step = 0.84
    target = Math.max(target, step * soft)
    glint = step
    line = Math.max(line, 0.18 + step * 0.32)
    if (score >= 990) {
      cue = 1
      tremor.heart -= dt
      if (tremor.heart <= 0) {
        tremor.heart = 0.56
        tremor.pulse = 3
      }
    }
  }

  if (score >= 500 && tremor.mark < 1) {
    tremor.mark = 1
    tremor.amp = Math.max(tremor.amp, soft)
    tremor.fov = 0.2
    tremor.roll = 1
    tremor.pulse = 2
    line = 1
  }
  if (score >= 1000 && tremor.mark < 2) {
    tremor.mark = 2
    tremor.amp = Math.max(tremor.amp, soft)
    tremor.fov = 0.28
    tremor.roll = 1
    tremor.pulse = 4
    glint = 1
    line = 1
    cue = 0
  }

  tremor.cue = cue
  const rate = target > tremor.amp ? 4.4 : 1.65
  tremor.amp += (target - tremor.amp) * Math.min(1, dt * rate)
  tremor.fov = Math.max(0, tremor.fov - dt)
  tremor.roll = Math.max(0, tremor.roll - dt * 3.2)
  tremor.line += (line - tremor.line) * Math.min(1, dt * 8)
  const glintTarget = glint * (lod ? 0.38 : 0.74)
  const glintRate = glintTarget > tremor.glint ? 6 : 1.7
  tremor.glint += (glintTarget - tremor.glint) * Math.min(1, dt * glintRate)
}

export function applyTremor(tremor, time, v) {
  if (tremor.amp < 0.02 && tremor.roll < 0.02) return
  const jx = Math.sin(time * 53) * tremor.amp * 0.14
  const jy = Math.sin(time * 37 + 1.7) * tremor.amp * 0.09
  v.cam.addScaledVector(v.right, jx)
  v.cam.addScaledVector(v.up, jy)
  v.look.addScaledVector(v.right, jx * 0.28)
  v.look.addScaledVector(v.up, jy * 0.2)
  const kick = Math.sin(time * 48) * tremor.roll * 0.05
  const micro = Math.sin(time * 29) * tremor.amp * 0.012
  v.rolled.addScaledVector(v.right, kick + micro)
  v.rolled.normalize()
}
