import { useCallback, useEffect, useRef, useState } from 'react'
import { startDrone, unlock } from './audio.js'
import { readBest, writeBest } from './game/constants.js'
import World from './game/World.jsx'

export default function App() {
  const [phase, setPhase] = useState('menu')
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(readBest)
  const [runId, setRunId] = useState(0)
  const phaseRef = useRef(phase)
  const input = useRef({ pending: false, sign: 1 })
  const crashTimer = useRef(0)

  phaseRef.current = phase

  const remember = useCallback((value) => {
    setScore(value)
    setBest((prev) => {
      if (value <= prev) return prev
      writeBest(value)
      return value
    })
  }, [])

  const queueFlip = useCallback((sign) => {
    if (phaseRef.current !== 'play') return
    input.current.pending = true
    input.current.sign = sign
  }, [])

  const start = useCallback(() => {
    window.clearTimeout(crashTimer.current)
    unlock()
    startDrone()
    input.current.pending = false
    setScore(0)
    setRunId((value) => value + 1)
    setPhase('play')
  }, [])

  const onCrash = useCallback((finalScore) => {
    remember(finalScore)
    setPhase('dead')
    window.clearTimeout(crashTimer.current)
    crashTimer.current = window.setTimeout(() => setPhase('menu'), 720)
  }, [remember])

  useEffect(() => () => window.clearTimeout(crashTimer.current), [])

  useEffect(() => {
    const onKey = (event) => {
      if (event.repeat) return
      if (event.code === 'Space' || event.code === 'KeyW' || event.code === 'ArrowUp') {
        event.preventDefault()
        queueFlip(1)
      } else if (event.code === 'KeyS' || event.code === 'ArrowDown') {
        event.preventDefault()
        queueFlip(-1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [queueFlip])

  return (
    <div
      className={phase === 'play' ? 'app is-play' : 'app'}
      onPointerDown={() => queueFlip(1)}
      onContextMenu={(event) => event.preventDefault()}
    >
      <World
        active={phase === 'play'}
        runId={runId}
        input={input}
        onScore={remember}
        onCrash={onCrash}
      />

      {phase === 'play' && <div className="hud">{score}</div>}
      {phase === 'dead' && <div className="flash" />}

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
