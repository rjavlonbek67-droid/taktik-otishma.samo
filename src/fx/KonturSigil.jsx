import { useEffect, useRef } from 'react'

const S = 'M70 24 H28 V46 H62 M28 60 H68 V86 H24'
const B = 'M108 24 H156 M108 24 V86 M108 54 H132 M156 24 V40 M108 86 H160 M160 70 V86'
const P = 'M214 86 V24 H266 V52 H214'
const SD = 'M73 27 H31 V49 H65 M31 63 H71 V89 H27'
const BD = 'M111 27 H159 M111 27 V89 M111 57 H135 M159 27 V43 M111 89 H163 M163 73 V89'
const PD = 'M217 89 V27 H269 V55 H217'

export default function KonturSigil({ mood = 'idle', strike = 0, hit = false }) {
  const rootRef = useRef(null)
  const draftRef = useRef(null)
  const axisRef = useRef(null)
  const lettersRef = useRef(null)
  const eyeRef = useRef(null)
  const innerRef = useRef(null)
  const reticleRef = useRef(null)
  const pupilRef = useRef(null)
  const cyanRef = useRef(null)
  const magentaRef = useRef(null)
  const sparkARef = useRef(null)
  const sparkBRef = useRef(null)
  const moodRef = useRef(mood)
  const strikeRef = useRef(strike)
  const hitRef = useRef(hit)
  moodRef.current = mood
  strikeRef.current = strike
  hitRef.current = hit

  useEffect(() => {
    const root = rootRef.current
    const draft = draftRef.current
    const axis = axisRef.current
    const letters = lettersRef.current
    const eye = eyeRef.current
    const inner = innerRef.current
    const reticle = reticleRef.current
    const pupil = pupilRef.current
    const cyan = cyanRef.current
    const magenta = magentaRef.current
    const sparkA = sparkARef.current
    const sparkB = sparkBRef.current
    if (!root || !draft || !letters || !eye || !inner || !reticle || !pupil) return undefined
    let raf = 0
    let last = performance.now()
    let time = 0
    let fps = 60
    let seen = strikeRef.current
    let kick = 0
    let boomed = false
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      time += dt
      const inst = dt > 0 ? 1 / dt : 60
      fps += (inst - fps) * 0.08
      const soft = fps < 50
      if (strikeRef.current !== seen) {
        seen = strikeRef.current
        kick = 0.32
      }
      if (!boomed && hitRef.current && time > 0.58) {
        boomed = true
        kick = 0.32
      }
      const axisU = time < 0.22 ? time / 0.22 : 1
      const letterU = time < 0.18 ? 0 : Math.min(1, (time - 0.18) / 0.27)
      const eyeU = time < 0.42 ? 0 : Math.min(1, (time - 0.42) / 0.18)
      draft.style.opacity = String(axisU)
      if (axis && axisU < 1) axis.style.strokeDashoffset = String((1 - axisU) * 240)
      if (letterU < 1) letters.style.setProperty('--draw', String((1 - letterU) * 520))
      letters.style.opacity = String(Math.min(1, letterU + 0.15))
      eye.style.opacity = String(eyeU)
      const state = moodRef.current
      let aperture = state === 'curse' ? 0.62 : state === 'surge' ? 1.22 : state === 'near' ? 0.78 : 1
      const spin = state === 'surge' ? 48 : state === 'curse' ? 22 : state === 'near' ? 16 : 10
      const breath = time < 0.6 ? 0 : Math.sin(time * 1.5) * (soft ? 0.45 : 1.15)
      const nod = time < 0.6 ? 0 : Math.cos(time * 1.15) * breath * 0.35
      if (kick > 0) kick = Math.max(0, kick - dt)
      const hitU = kick / 0.32
      const slide = hitU > 0 ? Math.sin(hitU * 16) * hitU * (soft ? 1.1 : 2.6) : breath
      root.setAttribute('transform', `translate(${slide} ${nod})`)
      if (cyan && magenta) {
        const flash = hitU > 0 && !soft ? hitU : 0
        cyan.style.opacity = String(flash * 0.85)
        magenta.style.opacity = String(flash * 0.75)
        cyan.setAttribute('transform', `translate(${3.2 * hitU} 0)`)
        magenta.setAttribute('transform', `translate(${-3.2 * hitU} 0)`)
      }
      if (sparkA && sparkB) {
        const spark = hitU > 0 && !soft ? hitU : 0
        sparkA.style.opacity = String(spark)
        sparkB.style.opacity = String(spark * 0.8)
        sparkA.setAttribute('x', String(168 + hitU * 10))
        sparkB.setAttribute('x', String(132 - hitU * 12))
      }
      inner.setAttribute('transform', `scale(1 ${aperture})`)
      const gaze = Math.sin(time * 0.85) * (state === 'surge' ? 2.2 : state === 'curse' ? 1.6 : 1.1)
      reticle.setAttribute('transform', `rotate(${time * spin + gaze * 4}) translate(${gaze} 0)`)
      pupil.setAttribute('x', String(-2.1 + gaze))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <svg
      className="sigil"
      viewBox="0 0 300 110"
      role="img"
      aria-label="SBP"
    >
      <g ref={rootRef}>
        <g ref={draftRef} className="sigil-draft" fill="none" stroke="#7eefff" strokeWidth="0.6">
          <rect x="7" y="7" width="286" height="96" />
          <path ref={axisRef} d="M8 55 H292 M150 8 V102" strokeDasharray="5 3" />
          <path d="M7 7 H18 M7 7 V18 M293 7 H282 M293 7 V18 M7 103 H18 M7 103 V92 M293 103 H282 M293 103 V92" />
          <path d="M46 14 V20 M96 14 V20 M196 14 V20 M246 14 V20 M46 96 V90 M96 96 V90 M196 96 V90 M246 96 V90" />
          <g fill="#9af6ff" stroke="none">
            <rect x="18" y="10" width="1.2" height="1.2" />
            <rect x="62" y="10" width="1.2" height="1.2" />
            <rect x="118" y="10" width="1.2" height="1.2" />
            <rect x="180" y="10" width="1.2" height="1.2" />
            <rect x="236" y="10" width="1.2" height="1.2" />
            <rect x="278" y="10" width="1.2" height="1.2" />
            <rect x="18" y="98" width="1.2" height="1.2" />
            <rect x="62" y="98" width="1.2" height="1.2" />
            <rect x="118" y="98" width="1.2" height="1.2" />
            <rect x="180" y="98" width="1.2" height="1.2" />
            <rect x="236" y="98" width="1.2" height="1.2" />
            <rect x="278" y="98" width="1.2" height="1.2" />
          </g>
        </g>
        <g ref={cyanRef} className="sigil-ghost" fill="none" stroke="#00f3ff" strokeWidth="1.4" opacity="0">
          <path d={S} />
          <path d={B} />
          <path d={P} />
        </g>
        <g ref={magentaRef} className="sigil-ghost" fill="none" stroke="#ff2bd6" strokeWidth="1.4" opacity="0">
          <path d={S} />
          <path d={B} />
          <path d={P} />
        </g>
        <g
          ref={lettersRef}
          className="sigil-letters"
          fill="none"
          stroke="#f4feff"
          strokeWidth="1.7"
          strokeLinejoin="miter"
          strokeLinecap="square"
        >
          <path d={SD} stroke="#7eefff" strokeWidth="0.8" />
          <path d={BD} stroke="#7eefff" strokeWidth="0.8" />
          <path d={PD} stroke="#7eefff" strokeWidth="0.8" />
          <path d={S} />
          <path d={B} />
          <path d={P} />
        </g>
        <g ref={eyeRef} transform="translate(150 55)" opacity="0">
          <path className="sigil-eye" d="M0 -18 L22 0 L0 18 L-22 0 Z" />
          <path ref={innerRef} className="sigil-eye" d="M0 -9 L11 0 L0 9 L-11 0 Z" />
          <g ref={reticleRef} className="sigil-reticle">
            <path d="M-26 0 H-8 M8 0 H26 M0 -26 V-8 M0 8 V26" />
            <path d="M-6 -6 H6 V6 H-6 Z" />
          </g>
          <rect ref={pupilRef} className="sigil-pupil" x="-2.1" y="-2.1" width="4.2" height="4.2" />
        </g>
        <rect ref={sparkARef} x="168" y="48" width="1.6" height="1.6" fill="#f4feff" opacity="0" />
        <rect ref={sparkBRef} x="132" y="60" width="1.4" height="1.4" fill="#ff2bd6" opacity="0" />
      </g>
    </svg>
  )
}
