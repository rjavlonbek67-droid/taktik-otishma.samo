export const WALL = 2.08
export const PLAYER_R = 0.34
export const STICK = WALL - PLAYER_R - 0.1
export const SEG = 8
export const TUNNEL_LEN = 176
export const POOL = 36
export const BEST_KEY = 'oyin-sbp-best'
export const CHECK_KEY = 'oyin-sbp-checkpoint'
export const COLORS = ['#00f3ff', '#ff2bd6', '#3d7eff']

export function readBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0
  } catch {
    return 0
  }
}

export function writeBest(score) {
  try {
    localStorage.setItem(BEST_KEY, String(score))
  } catch {
    /* private mode */
  }
}

export function readCheckpoint() {
  try {
    const band = Math.floor(Number(localStorage.getItem(CHECK_KEY)) || 0)
    if (band < 1000) return 0
    return Math.min(50000, Math.floor(band / 1000) * 1000)
  } catch {
    return 0
  }
}

export function writeCheckpoint(score) {
  try {
    const band = Math.floor(Number(score) / 1000) * 1000
    if (band < 1000) return 0
    const saved = Math.min(50000, band)
    localStorage.setItem(CHECK_KEY, String(saved))
    return saved
  } catch {
    return 0
  }
}
