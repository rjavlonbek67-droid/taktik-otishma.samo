import { useCallback, useEffect, useRef, useState } from 'react'
import { finaleSting, focusSound, setMuted, startDrone, unlock } from './audio.js'
import { LABEL } from './build.js'
import { readBest, writeBest } from './game/constants.js'
import World from './game/World.jsx'

const FINALE_LINES = [
  "1000 DAN O'TDING — LEKIN OXIRI YO'Q",
  'CHEGARA BUZILDI, LEKIN SEN QOLDING',
  "1000+ DAN KEYIN HAM YOL YOPIQ",
]
const HOLD_MS = 140
const SWIPE_FAST = 12
const SWIPE_FIRM = 24
const SECTOR = Math.PI / 2

function vectorSign(dx, dy, elapsed) {
  const mag = Math.hypot(dx, dy)
  const fast = mag >= SWIPE_FAST && elapsed <= 180
  if (!fast && mag < SWIPE_FIRM) return 0
  const sector = Math.round(Math.atan2(dy, dx) / SECTOR)
  if (sector === 0) return 1
  if (sector === 1) return 2
  if (sector === -1) return -2
  return -1
}

export default function App() {
  const [phase, setPhase] = useState('menu')
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(readBest)
  const [runId, setRunId] = useState(0)
  const [style, setStyle] = useState('neon')
  const [focusUi, setFocusUi] = useState(false)
  const [miss, setMiss] = useState(null)
  const [muted, setMutedUi] = useState(false)
  const [glitch, setGlitch] = useState(null)
  const [note, setNote] = useState(null)
  const [ultra, setUltra] = useState(null)
  const [loanPhase, setLoanPhase] = useState('idle')
  const [loanLeft, setLoanLeft] = useState(0)
  const [tele, setTele] = useState(null)
  const [dread, setDread] = useState(null)
  const [fps, setFps] = useState(0)
  const [abyss, setAbyss] = useState(null)
  const [tremorCue, setTremorCue] = useState(false)
  const [cursed, setCursed] = useState(false)
  const [finale, setFinale] = useState(null)
  const phaseRef = useRef(phase)
  const styleRef = useRef(style)
  const input = useRef({
    pending: false,
    sign: 1,
    immediate: false,
    focus: false,
    impulse: false,
    rule: 0,
    glitch: 0,
    loan: false,
    buffer: 0,
    head: 0,
    qCount: 0,
    slots: [
      { sign: 1, immediate: false, at: 0 },
      { sign: 1, immediate: false, at: 0 },
    ],
  })
  const fingers = useRef(new Map())
  const fingerPool = useRef([
    { id: 0, x: 0, y: 0, t: 0, swiped: false, held: false, live: false, timer: 0 },
    { id: 0, x: 0, y: 0, t: 0, swiped: false, held: false, live: false, timer: 0 },
    { id: 0, x: 0, y: 0, t: 0, swiped: false, held: false, live: false, timer: 0 },
  ])
  const appRef = useRef(null)
  const bind = useRef({})
  const crashTimer = useRef(0)
  const missTimer = useRef(0)
  const glitchTimer = useRef(0)
  const noteTimer = useRef(0)
  const ultraTimer = useRef(0)

  phaseRef.current = phase
  styleRef.current = style

  const remember = useCallback((value) => {
    setScore(value)
    setBest((prev) => {
      if (value <= prev) return prev
      writeBest(value)
      return value
    })
  }, [])

  const queueFlip = useCallback((sign, immediate = false) => {
    if (phaseRef.current !== 'play') return
    const queue = input.current
    const now = performance.now()
    if (queue.qCount >= 2) {
      const newest = (queue.head + 1) % 2
      queue.slots[newest].sign = sign
      queue.slots[newest].immediate = immediate
      queue.slots[newest].at = now
      return
    }
    const index = (queue.head + queue.qCount) % 2
    queue.slots[index].sign = sign
    queue.slots[index].immediate = immediate
    queue.slots[index].at = now
    queue.qCount += 1
  }, [])

  const clearHold = useCallback(() => {
    fingerPool.current.forEach((finger) => {
      window.clearTimeout(finger.timer)
      finger.held = false
    })
    input.current.focus = false
    setFocusUi(false)
  }, [])

  const start = useCallback(() => {
    window.clearTimeout(crashTimer.current)
    clearHold()
    unlock()
    startDrone()
    input.current.pending = false
    input.current.buffer = 0
    input.current.qCount = 0
    input.current.head = 0
    input.current.impulse = false
    input.current.loan = false
    setLoanPhase('idle')
    setLoanLeft(0)
    setNote(null)
    setUltra(null)
    setTele(null)
    setDread(null)
    setAbyss(null)
    setTremorCue(false)
    setCursed(false)
    setFinale(null)
    setScore(0)
    setMiss(null)
    setRunId((value) => value + 1)
    setPhase('play')
  }, [clearHold])

  const onCrash = useCallback((finalScore, passed) => {
    clearHold()
    remember(finalScore)
    setDread(null)
    window.clearTimeout(crashTimer.current)
    if (passed) {
      const over = Math.max(0, finalScore - 1000)
      setFinale({
        score: finalScore,
        over,
        line: FINALE_LINES[finalScore % FINALE_LINES.length],
      })
      setPhase('finale')
      setGlitch({ id: performance.now() })
      window.clearTimeout(glitchTimer.current)
      glitchTimer.current = window.setTimeout(() => setGlitch(null), 280)
      finaleSting()
      return
    }
    setFinale(null)
    setPhase('dead')
    crashTimer.current = window.setTimeout(() => setPhase('menu'), 720)
  }, [clearHold, remember])

  const onNearMiss = useCallback((hit) => {
    const id = performance.now()
    setMiss({ id, ...hit })
    window.clearTimeout(missTimer.current)
    missTimer.current = window.setTimeout(() => setMiss(null), 720)
  }, [])

  const showNote = useCallback((text, ms = 900) => {
    const id = performance.now()
    setNote({ id, text })
    window.clearTimeout(noteTimer.current)
    noteTimer.current = window.setTimeout(() => setNote(null), ms)
  }, [])

  const onEcho = useCallback((hit) => {
    if (hit.kind === 'sync') showNote(`ECHO SYNC +${hit.points}`, 800)
    else showNote('XAVFLI IZ', 700)
  }, [showNote])

  const flashUltra = useCallback((kind, kicker, title, ms) => {
    const id = performance.now()
    setUltra({ id, kind, kicker, title })
    window.clearTimeout(ultraTimer.current)
    ultraTimer.current = window.setTimeout(() => setUltra(null), ms)
  }, [])

  const onLoan = useCallback((info) => {
    if (info.phase === 'slow') {
      setLoanPhase('slow')
      flashUltra('debt', 'XAVF', 'VAQT QARZI', 1700)
    } else if (info.phase === 'repay') {
      setLoanPhase('repay')
      flashUltra('peak', 'AVJ', 'QARZ QAYTARILMOQDA', 1200)
    } else if (info.phase === 'clear') {
      flashUltra('win', 'ULTRA', `+${info.points}`, 1000)
    } else if (info.phase === 'strike') {
      setLoanPhase('idle')
      flashUltra('hit', 'ZARBA', 'QARZ SINDI', 720)
    } else {
      setLoanPhase('idle')
      setLoanLeft(8)
    }
  }, [flashUltra])

  const onAbyss = useCallback((info) => {
    const marks = ['', 'I', 'II', 'III', 'IV', 'V', '1000']
    if (info.phase === 'stage') {
      setAbyss({
        text: info.stage >= 6 ? '1000' : `ABYSS ${marks[info.stage]}`,
        hot: info.stage >= 4,
      })
      if (info.stage >= 4) flashUltra('debt', 'ABYSS', marks[info.stage], 900)
    } else if (info.phase === 'mirage') {
      showNote('OCHIQ YOL', 800)
    } else if (info.phase === 'snap') {
      flashUltra('hit', 'SAROB', 'YOL YOPIQ', 720)
    }
  }, [flashUltra, showNote])

  const onTremor = useCallback((info) => {
    if (info.phase === 'wall') flashUltra('hit', '500', 'BIRINCHI SINOV', 820)
    else if (info.phase === 'near') setTremorCue(true)
    else if (info.phase === 'calm') setTremorCue(false)
    else if (info.phase === 'breach') {
      setTremorCue(false)
      flashUltra('hit', '1000', 'CHEGARA BUZILDI', 1200)
    }
  }, [flashUltra])

  const onCurse = useCallback((info) => {
    if (info.phase === 'awaken') {
      setCursed(true)
      flashUltra('hit', '1000+', "LA'NATLANGAN MUKOFOT", 1400)
    } else if (info.phase === 'gift') {
      showNote(`MUKOFOT +${info.points}`, 700)
    }
  }, [flashUltra, showNote])

  const onDread = useCallback((info) => {
    if (info.phase === 'fracture') {
      setDread('rewind')
      flashUltra('hit', 'UZILISH', 'XOTIRA', 1200)
    } else if (info.phase === 'fracture-end') {
      setDread((current) => (current === 'rewind' ? null : current))
    } else if (info.phase === 'heart') {
      setDread('heart')
      flashUltra('debt', 'QORONG‘U', 'YURAK', 900)
    } else if (info.phase === 'heart-end') {
      setDread((current) => (current === 'heart' ? null : current))
    } else if (info.phase === 'decoy') {
      showNote(`ANIQ +${info.points}`, 800)
    } else if (info.phase === 'decoy-fool') {
      showNote('SOXTA AKS', 700)
    } else if (info.phase === 'blind') {
      showNote("O'LIK NUQTA", 800)
    } else if (info.phase === 'surge') {
      setDread('surge')
      flashUltra('peak', 'QALTIS', 'SURGE', 1100)
    } else if (info.phase === 'surge-clear') {
      setDread((current) => (current === 'surge' ? null : current))
      flashUltra('win', 'SURGE', `+${info.points}`, 1000)
    } else if (info.phase === 'surge-fail') {
      setDread((current) => (current === 'surge' ? null : current))
      flashUltra('hit', 'SINDI', 'SURGE', 700)
    }
  }, [flashUltra, showNote])

  const onTelemetry = useCallback((info) => {
    setTele(info)
  }, [])

  const requestLoan = useCallback(() => {
    if (phaseRef.current !== 'play') return
    input.current.loan = true
  }, [])

  const onGlitch = useCallback(() => {
    const id = performance.now()
    setGlitch({ id })
    window.clearTimeout(glitchTimer.current)
    glitchTimer.current = window.setTimeout(() => setGlitch(null), 190)
  }, [])

  const toggleMute = useCallback((event) => {
    event.stopPropagation()
    setMutedUi((current) => {
      const next = !current
      unlock()
      setMuted(next)
      return next
    })
  }, [])

  const toggleStyle = useCallback((event) => {
    event.stopPropagation()
    setStyle((current) => (current === 'kontur' ? 'neon' : 'kontur'))
  }, [])

  useEffect(() => () => {
    window.clearTimeout(crashTimer.current)
    fingerPool.current.forEach((finger) => window.clearTimeout(finger.timer))
    window.clearTimeout(missTimer.current)
    window.clearTimeout(glitchTimer.current)
    window.clearTimeout(noteTimer.current)
    window.clearTimeout(ultraTimer.current)
  }, [])

  useEffect(() => {
    if (loanLeft <= 0) return undefined
    const id = window.setInterval(() => {
      setLoanLeft((value) => (value <= 0.1 ? 0 : value - 0.1))
    }, 100)
    return () => window.clearInterval(id)
  }, [loanLeft > 0])

  useEffect(() => {
    const node = appRef.current
    const opts = { passive: false }
    const block = (event) => {
      if (phaseRef.current !== 'play') return
      if (event.target?.closest?.('button')) return
      event.preventDefault()
    }
    const down = (event) => bind.current.down?.(event)
    const move = (event) => bind.current.move?.(event)
    const up = (event) => bind.current.up?.(event)
    node?.addEventListener('pointerdown', down, opts)
    node?.addEventListener('pointermove', move, opts)
    node?.addEventListener('pointerup', up, opts)
    node?.addEventListener('pointercancel', up, opts)
    window.addEventListener('touchstart', block, opts)
    window.addEventListener('touchmove', block, opts)
    window.addEventListener('gesturestart', block, opts)
    return () => {
      node?.removeEventListener('pointerdown', down)
      node?.removeEventListener('pointermove', move)
      node?.removeEventListener('pointerup', up)
      node?.removeEventListener('pointercancel', up)
      window.removeEventListener('touchstart', block)
      window.removeEventListener('touchmove', block)
      window.removeEventListener('gesturestart', block)
    }
  }, [])

  useEffect(() => {
    const onKey = (event) => {
      if (event.repeat) return
      if (event.code === 'Space' || event.code === 'KeyW' || event.code === 'ArrowRight') {
        event.preventDefault()
        queueFlip(1, event.code === 'ArrowRight')
      } else if (event.code === 'KeyS' || event.code === 'ArrowLeft') {
        event.preventDefault()
        queueFlip(-1, event.code === 'ArrowLeft')
      } else if (event.code === 'ArrowUp' || event.code === 'ArrowDown') {
        event.preventDefault()
        queueFlip(event.code === 'ArrowDown' ? -2 : 2, true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [queueFlip])

  const takeFinger = () => {
    const pool = fingerPool.current
    for (let i = 0; i < pool.length; i += 1) {
      if (!pool[i].live) return pool[i]
    }
    return null
  }

  const onPointerDown = (event) => {
    if (event.target.closest?.('button')) return
    if (phaseRef.current === 'play') event.preventDefault()
    const finger = takeFinger()
    if (!finger) return
    finger.live = true
    finger.id = event.pointerId
    finger.x = event.clientX
    finger.y = event.clientY
    finger.t = performance.now()
    finger.swiped = false
    finger.held = false
    fingers.current.set(event.pointerId, finger)
    let live = 0
    let swiped = false
    fingers.current.forEach((item) => {
      if (!item.live) return
      live += 1
      if (item.swiped) swiped = true
    })
    if (phaseRef.current === 'play' && live >= 2 && !swiped) {
      fingers.current.forEach((item) => {
        window.clearTimeout(item.timer)
        item.swiped = true
        item.held = false
      })
      input.current.focus = false
      setFocusUi(false)
      requestLoan()
      return
    }
    if (phaseRef.current !== 'play') return
    finger.timer = window.setTimeout(() => {
      if (!finger.live || finger.swiped || phaseRef.current !== 'play') return
      finger.held = true
      input.current.focus = true
      setFocusUi(true)
      focusSound()
    }, HOLD_MS)
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const onPointerMove = (event) => {
    if (phaseRef.current === 'play') event.preventDefault()
    const finger = fingers.current.get(event.pointerId)
    if (!finger || finger.swiped || phaseRef.current !== 'play') return
    const sign = vectorSign(event.clientX - finger.x, event.clientY - finger.y, performance.now() - finger.t)
    if (!sign) return
    finger.swiped = true
    window.clearTimeout(finger.timer)
    if (finger.held) {
      finger.held = false
      let otherHeld = false
      fingers.current.forEach((item) => {
        if (item !== finger && item.live && item.held) otherHeld = true
      })
      if (!otherHeld) {
        input.current.focus = false
        input.current.impulse = true
        setFocusUi(false)
      }
    }
    queueFlip(sign, true)
  }

  const onPointerUp = (event) => {
    const finger = fingers.current.get(event.pointerId)
    if (!finger) return
    window.clearTimeout(finger.timer)
    fingers.current.delete(event.pointerId)
    const wasHeld = finger.held
    const wasSwiped = finger.swiped
    finger.live = false
    finger.held = false
    let stillHeld = false
    let others = 0
    fingers.current.forEach((item) => {
      if (!item.live) return
      others += 1
      if (item.held) stillHeld = true
    })
    if (wasHeld && !stillHeld && phaseRef.current === 'play') {
      input.current.focus = false
      input.current.impulse = true
      setFocusUi(false)
      return
    }
    if (!wasSwiped && !wasHeld && others === 0 && phaseRef.current === 'play') queueFlip(1, false)
  }

  bind.current.down = onPointerDown
  bind.current.move = onPointerMove
  bind.current.up = onPointerUp

  return (
    <div
      ref={appRef}
      className={`app${phase === 'play' ? ' is-play' : ''}${focusUi ? ' is-focus' : ''}${loanPhase === 'slow' ? ' is-loan' : ''}${loanPhase === 'repay' ? ' is-repay' : ''}${dread === 'heart' ? ' is-heart' : ''}${dread === 'rewind' ? ' is-rewind' : ''}${dread === 'surge' ? ' is-surge' : ''}${abyss?.hot ? ' is-abyss' : ''}${cursed ? ' is-curse' : ''}`}
      onContextMenu={(event) => event.preventDefault()}
    >
      <World
        active={phase === 'play'}
        runId={runId}
        input={input}
        styleRef={styleRef}
        onScore={remember}
        onCrash={onCrash}
        onNearMiss={onNearMiss}
        onGlitch={onGlitch}
        onEcho={onEcho}
        onLoan={onLoan}
        onDread={onDread}
        onTelemetry={onTelemetry}
        onFps={setFps}
        onAbyss={onAbyss}
        onTremor={onTremor}
        onCurse={onCurse}
      />

      <button
        className={muted ? 'sound is-off' : 'sound'}
        type="button"
        onPointerDown={toggleMute}
      >
        OVOZ
      </button>

      <button
        className={style === 'kontur' ? 'mode is-kontur' : 'mode'}
        type="button"
        onPointerDown={toggleStyle}
      >
        <span className={style === 'kontur' ? 'on' : ''}>KONTUR</span>
        <span className={style === 'neon' ? 'on' : ''}>NEON</span>
      </button>

      {phase === 'play' && <div className="hud">{score}</div>}
      {phase === 'play' && abyss && (
        <div className={abyss.hot ? 'abyss is-hot' : 'abyss'}>{abyss.text}</div>
      )}
      {phase === 'play' && tremorCue && <div className="tremor-cue">1000</div>}
      {phase === 'play' && cursed && <div className="curse-chip">LA'NAT ×1.35</div>}
      {phase === 'play' && cursed && <div className="curse-veil" />}
      {phase === 'play' && tele && (
        <div className={tele.lie ? 'tele is-lie' : 'tele'}>
          <span>TEZ<b>{tele.speed}</b></span>
          <span>MASOFA<b>{tele.dist}</b></span>
          <span>SIGNAL<b>{tele.signal}</b></span>
          <span>{tele.warn}</span>
          {tele.lie && <i>YOLG‘ON</i>}
        </div>
      )}
      {miss && (
        <div key={miss.id} className="near" data-mult={miss.mult}>
          NEAR MISS +{miss.points}
          <b>{miss.combo > 1 ? `COMBO x${miss.combo}` : `x${miss.mult}`}</b>
        </div>
      )}
      {ultra && (
        <div key={ultra.id} className={`ultra ultra-${ultra.kind}`}>
          <small>{ultra.kicker}</small>
          <strong>{ultra.title}</strong>
        </div>
      )}
      {note && (
        <div key={note.id} className={loanPhase === 'repay' ? 'note is-hot' : 'note'}>
          {note.text}
        </div>
      )}
      {glitch && <div key={glitch.id} className="glitch-fx" />}
      {phase === 'play' && (
        <button
          className={loanLeft > 0 || loanPhase !== 'idle' ? 'loan is-wait' : 'loan'}
          type="button"
          onPointerDown={(event) => {
            event.stopPropagation()
            requestLoan()
          }}
        >
          {loanLeft > 0 ? loanLeft.toFixed(0) : 'QARZ'}
        </button>
      )}
      {phase === 'dead' && <div className="flash" />}
      {phase === 'finale' && finale && (
        <div
          className="finale"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <p className="finale-kicker">1000+ DAHSHAT YAKUNI</p>
          <h1>{finale.line}</h1>
          <div className="finale-stats">
            <div>
              <span>BALL</span>
              <b>{finale.score}</b>
            </div>
            <div>
              <span>1000+</span>
              <b>+{finale.over}</b>
            </div>
          </div>
          <button
            className="start"
            type="button"
            onPointerDown={(event) => {
              event.stopPropagation()
              start()
            }}
          >
            QAYTA
          </button>
        </div>
      )}

      <div className="build">{LABEL}{fps > 0 ? ` · ${fps}` : ''}</div>

      {phase === 'menu' && (
        <div className="menu">
          <div className="stats">
            <div>
              <span>BALL</span>
              <b>{score}</b>
            </div>
            <div className="record">
              <span>REKORD</span>
              <b>{best}</b>
            </div>
          </div>
          <button
            className="start"
            type="button"
            onPointerDown={(event) => {
              event.stopPropagation()
              start()
            }}
          >
            BOSHLASH
          </button>
        </div>
      )}
    </div>
  )
}
