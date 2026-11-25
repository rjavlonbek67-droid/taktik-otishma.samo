import { useCallback, useEffect, useRef, useState } from 'react'
import { focusSound, setMuted, startDrone, unlock } from './audio.js'
import { LABEL } from './build.js'
import { readBest, writeBest } from './game/constants.js'
import World from './game/World.jsx'

const SWIPE_AXIS = 12
const SWIPE_BIAS = 1.55
const HOLD_MS = 140
const BUFFER_S = 0.11

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
  })
  const pointers = useRef(new Set())
  const gesture = useRef(null)
  const holdTimer = useRef(0)
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
    input.current.pending = true
    input.current.sign = sign
    input.current.immediate = immediate
    input.current.buffer = BUFFER_S
  }, [])

  const clearHold = useCallback(() => {
    window.clearTimeout(holdTimer.current)
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
    input.current.impulse = false
    input.current.loan = false
    setLoanPhase('idle')
    setLoanLeft(0)
    setNote(null)
    setUltra(null)
    setTele(null)
    setDread(null)
    setScore(0)
    setMiss(null)
    setRunId((value) => value + 1)
    setPhase('play')
  }, [clearHold])

  const onCrash = useCallback((finalScore) => {
    clearHold()
    remember(finalScore)
    setPhase('dead')
    setDread(null)
    window.clearTimeout(crashTimer.current)
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
    window.clearTimeout(holdTimer.current)
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
    const block = (event) => {
      if (phaseRef.current !== 'play') return
      if (event.target?.closest?.('button')) return
      event.preventDefault()
    }
    const opts = { passive: false }
    window.addEventListener('touchstart', block, opts)
    window.addEventListener('touchmove', block, opts)
    window.addEventListener('gesturestart', block, opts)
    return () => {
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

  const onPointerDown = (event) => {
    if (event.target.closest('button')) return
    pointers.current.add(event.pointerId)
    if (phaseRef.current === 'play' && pointers.current.size >= 2) {
      window.clearTimeout(holdTimer.current)
      gesture.current = null
      input.current.focus = false
      setFocusUi(false)
      requestLoan()
      return
    }
    if (phaseRef.current !== 'play') return
    gesture.current = {
      x: event.clientX,
      y: event.clientY,
      swiped: false,
      held: false,
    }
    window.clearTimeout(holdTimer.current)
    holdTimer.current = window.setTimeout(() => {
      const current = gesture.current
      if (!current || current.swiped || phaseRef.current !== 'play') return
      current.held = true
      input.current.focus = true
      setFocusUi(true)
      focusSound()
    }, HOLD_MS)
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const onPointerMove = (event) => {
    const current = gesture.current
    if (!current || current.swiped || phaseRef.current !== 'play') return
    const dx = event.clientX - current.x
    const dy = event.clientY - current.y
    const adx = Math.abs(dx)
    const ady = Math.abs(dy)
    const along = Math.max(adx, ady)
    const across = Math.min(adx, ady)
    if (along < SWIPE_AXIS) return
    if (along < across * SWIPE_BIAS && along < 22) return
    current.swiped = true
    window.clearTimeout(holdTimer.current)
    if (current.held) {
      current.held = false
      input.current.focus = false
      input.current.impulse = true
      setFocusUi(false)
    }
    const horizontal = Math.abs(dx) >= Math.abs(dy)
    queueFlip(horizontal ? (dx > 0 ? 1 : -1) : (dy > 0 ? 2 : -2), true)
  }

  const onPointerUp = (event) => {
    pointers.current.delete(event.pointerId)
    window.clearTimeout(holdTimer.current)
    const current = gesture.current
    gesture.current = null
    if (pointers.current.size > 0) return
    if (!current || phaseRef.current !== 'play') return
    if (current.held) {
      input.current.focus = false
      input.current.impulse = true
      setFocusUi(false)
      return
    }
    if (!current.swiped) queueFlip(1, false)
  }

  return (
    <div
      className={`app${phase === 'play' ? ' is-play' : ''}${focusUi ? ' is-focus' : ''}${loanPhase === 'slow' ? ' is-loan' : ''}${loanPhase === 'repay' ? ' is-repay' : ''}${dread === 'heart' ? ' is-heart' : ''}${dread === 'rewind' ? ' is-rewind' : ''}${dread === 'surge' ? ' is-surge' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
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
