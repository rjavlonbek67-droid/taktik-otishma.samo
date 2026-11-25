export const WALL = 2.08
export const PLAYER_R = 0.34
export const STICK = WALL - PLAYER_R - 0.1
export const SEG = 8
export const TUNNEL_LEN = 176
export const POOL = 36
export const BEST_KEY = 'oyin-sbp-best'
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
