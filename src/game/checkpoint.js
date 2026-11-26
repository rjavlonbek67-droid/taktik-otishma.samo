import { seedAbyss } from './abyss.js'
import { seedCurse } from './curse.js'
import { seedMind } from './mind.js'
import { seedScale } from './scale.js'
import { seedSilence } from './silence.js'

export function applySpawn(state, from) {
  const score = from >= 1000 ? Math.floor(from / 1000) * 1000 : 0
  if (score < 1000) return
  state.z = score / 0.45
  state.prevZ = state.z
  state.bonus = score - state.z * 0.45
  if (state.z * 0.45 + state.bonus < score) state.bonus += 1e-4
  state.nextSpawn = state.z + 36
  seedCurse(state.curse, score)
  seedScale(state.scale, score)
  seedAbyss(state, score)
  seedMind(state.mind, score)
  seedSilence(state.silence, score)
}
