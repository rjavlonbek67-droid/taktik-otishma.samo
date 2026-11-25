import { useEffect, useRef } from 'react'
import { pulseFx, stopFx } from './fxAudio.js'

const CAP = 80
const BARS = 5

function makePool() {
  const list = new Array(CAP)
  for (let i = 0; i < CAP; i += 1) {
    list[i] = {
      x: (i * 0.173) % 1,
      y: (i * 0.091) % 1,
      s: 0.7 + (i % 5) * 0.35,
      v: 0.02 + (i % 7) * 0.008,
      drift: ((i % 2) ? 0.012 : -0.012),
      hot: i % 6 === 0,
    }
  }
  return list
}

export default function ScreenFx({ mode }) {
  const canvasRef = useRef(null)
  const poolRef = useRef(null)
  const barsRef = useRef(null)
  const glowRef = useRef(null)
  const splitRef = useRef(null)
  if (!poolRef.current) poolRef.current = makePool()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return undefined
    const pool = poolRef.current
    const hard = mode === 'finale'
    const sharp = mode === 'dead' || mode === 'launch' || hard
    let raf = 0
    let last = performance.now()
    let fps = 60
    let clock = 0
    let glitchIn = sharp ? 0 : 0.35
    let glitchOut = 0
    let lit = false
    let announced = false
    const resize = () => {
      const width = canvas.clientWidth || 1
      const height = canvas.clientHeight || 1
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25)
      const nextW = Math.max(1, Math.floor(width * dpr))
      const nextH = Math.max(1, Math.floor(height * dpr))
      if (canvas.width !== nextW || canvas.height !== nextH) {
        canvas.width = nextW
        canvas.height = nextH
      }
    }
    resize()
    window.addEventListener('resize', resize)
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      clock += dt
      const inst = dt > 0 ? 1 / dt : 60
      fps += (inst - fps) * 0.08
      const count = fps < 50 ? 18 : hard ? 64 : sharp ? 46 : 36
      const w = canvas.width
      const h = canvas.height
      const scale = hard ? 2.1 : 1.35
      ctx.clearRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'lighter'
      ctx.fillStyle = '#00f3ff'
      ctx.globalAlpha = hard ? 0.5 : 0.28
      for (let i = 0; i < count; i += 1) {
        const p = pool[i]
        if (p.hot) continue
        p.y -= p.v * dt
        p.x += p.drift * dt
        if (p.y < 0) p.y += 1
        if (p.x < 0) p.x += 1
        else if (p.x > 1) p.x -= 1
        ctx.fillRect(p.x * w, p.y * h, p.s * scale, p.s * scale)
      }
      ctx.fillStyle = '#ff2bd6'
      ctx.globalAlpha = hard ? 0.72 : 0.4
      for (let i = 0; i < count; i += 1) {
        const p = pool[i]
        if (!p.hot) continue
        p.y -= p.v * dt * (hard ? 1.6 : 1)
        p.x += p.drift * dt * 1.4
        if (p.y < 0) p.y += 1
        if (p.x < 0) p.x += 1
        else if (p.x > 1) p.x -= 1
        ctx.fillRect(p.x * w, p.y * h, p.s * scale * 1.3, p.s * scale * 0.7)
      }
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
      const pulse = 0.22 + Math.sin(clock * (hard ? 2.6 : 1.15)) * (hard ? 0.24 : 0.1)
      if (glowRef.current) glowRef.current.style.opacity = String(sharp ? Math.min(1, pulse + 0.38) : pulse)
      glitchIn -= dt
      if (glitchOut > 0) glitchOut -= dt
      if (glitchIn <= 0) {
        glitchIn = (hard ? 0.42 : sharp ? 0.28 : 1.15) + (fps < 50 ? 0.45 : 0)
        glitchOut = hard ? 0.16 : 0.09
        lit = true
        const bars = barsRef.current
        if (bars) {
          const shift = hard ? 22 : 12
          for (let i = 0; i < BARS; i += 1) {
            const bar = bars.children[i]
            if (!bar) continue
            const dir = i % 2 ? shift : -shift
            bar.style.transform = `translate3d(${dir}px,0,0)`
            bar.style.top = `${(i * 19 + clock * 13) % 92}%`
            bar.style.opacity = hard ? '0.9' : '0.62'
          }
        }
        if (splitRef.current) splitRef.current.style.opacity = hard ? '0.95' : '0.5'
        if (!announced && (hard || mode === 'dead')) {
          announced = true
          pulseFx(hard ? 'finale' : 'dead')
        } else if (mode === 'menu' && fps >= 50) pulseFx('menu')
        else if (hard && fps >= 50) pulseFx('tick')
      } else if (lit && glitchOut <= 0) {
        lit = false
        const bars = barsRef.current
        if (bars) {
          for (let i = 0; i < BARS; i += 1) {
            const bar = bars.children[i]
            if (bar) bar.style.opacity = '0'
          }
        }
        if (splitRef.current) splitRef.current.style.opacity = '0'
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    const onHide = () => {
      if (document.hidden) stopFx()
    }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onHide)
      stopFx()
    }
  }, [mode])

  return (
    <div className={`screen-fx is-${mode}`} aria-hidden="true">
      <canvas ref={canvasRef} />
      <div className="fx-glow" ref={glowRef} />
      <div className="fx-rays" />
      <div className="fx-split" ref={splitRef} />
      <div className="fx-burst" />
      <div className="fx-bars" ref={barsRef}>
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
    </div>
  )
}
