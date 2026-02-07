'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface PlayerPosition {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  team: 'home' | 'away'
}

interface BallState {
  x: number
  y: number
  vx: number
  vy: number
}

interface PitchMapProps {
  state: 'idle' | 'uploading' | 'analyzing' | 'complete'
  className?: string
}

const PLAYER_RADIUS = 2.6
const BALL_RADIUS = 1.4
const PITCH_MIN = 2
const PITCH_MAX = 98
const GOAL_MIN_Y = 40
const GOAL_MAX_Y = 60
const GOAL_DEPTH = 0.4

function generateInitialPositions(): PlayerPosition[] {
  const homePositions = [
    { x: 10, y: 50 },
    { x: 25, y: 20 },
    { x: 25, y: 40 },
    { x: 25, y: 60 },
    { x: 25, y: 80 },
    { x: 45, y: 25 },
    { x: 45, y: 50 },
    { x: 45, y: 75 },
    { x: 65, y: 20 },
    { x: 65, y: 50 },
    { x: 65, y: 80 },
  ]

  const awayPositions = [
    { x: 90, y: 50 },
    { x: 75, y: 80 },
    { x: 75, y: 60 },
    { x: 75, y: 40 },
    { x: 75, y: 20 },
    { x: 55, y: 75 },
    { x: 55, y: 50 },
    { x: 55, y: 25 },
    { x: 35, y: 80 },
    { x: 35, y: 50 },
    { x: 35, y: 20 },
  ]

  return [
    ...homePositions.map((pos, i) => ({
      id: `home_${i}`,
      ...pos,
      vx: 0,
      vy: 0,
      team: 'home' as const,
    })),
    ...awayPositions.map((pos, i) => ({
      id: `away_${i}`,
      ...pos,
      vx: 0,
      vy: 0,
      team: 'away' as const,
    })),
  ]
}

export function PitchMap({ state, className }: PitchMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const lastFrameRef = useRef<number | null>(null)
  const playersRef = useRef<PlayerPosition[]>(generateInitialPositions())
  const ballRef = useRef<BallState>({ x: 50, y: 50, vx: 0, vy: 0 })
  const lastTouchTeamRef = useRef<'home' | 'away' | null>(null)
  const controlRef = useRef<{
    type: 'player' | 'ball'
    id?: string
    targetX: number
    targetY: number
  } | null>(null)

  const [players, setPlayers] = useState<PlayerPosition[]>(playersRef.current)
  const [ball, setBall] = useState<BallState>(ballRef.current)
  const [score, setScore] = useState({ home: 0, away: 0 })
  const [showConfetti, setShowConfetti] = useState(false)

  const speedMultiplier = useMemo(() => {
    if (state === 'analyzing') return 1.25
    if (state === 'uploading') return 1.05
    return 1
  }, [state])

  const toPitchCoords = useCallback((event: PointerEvent | React.PointerEvent) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return { x: 50, y: 50 }
    const x = ((event.clientX - rect.left) / rect.width) * 100
    const y = ((event.clientY - rect.top) / rect.height) * 100
    return {
      x: Math.max(PITCH_MIN, Math.min(PITCH_MAX, x)),
      y: Math.max(PITCH_MIN, Math.min(PITCH_MAX, y)),
    }
  }, [])

  const resetBall = useCallback(() => {
    const next = {
      x: 50,
      y: 50,
      vx: (Math.random() - 0.5) * 6,
      vy: (Math.random() - 0.5) * 4,
    }
    ballRef.current = next
    setBall(next)
  }, [])

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!controlRef.current) return
      const coords = toPitchCoords(event)
      controlRef.current.targetX = coords.x
      controlRef.current.targetY = coords.y
    }

    const handlePointerUp = () => {
      // keep selection active; click on pitch clears it
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [toPitchCoords])

  useEffect(() => {
    let raf = 0

    const animate = (time: number) => {
      if (!lastFrameRef.current) {
        lastFrameRef.current = time
      }
      const delta = Math.min(0.032, (time - lastFrameRef.current) / 1000)
      lastFrameRef.current = time

      const nextPlayers = playersRef.current.map((player, index) => {
        let { x, y, vx, vy } = player
        if (controlRef.current?.type === 'player' && controlRef.current.id === player.id) {
          const targetX = controlRef.current.targetX
          const targetY = controlRef.current.targetY
          const spring = 18
          vx += (targetX - x) * spring * delta
          vy += (targetY - y) * spring * delta
        }

        if (!controlRef.current || controlRef.current.id !== player.id) {
          const drift = 0.28
          vx += Math.sin(time * 0.0006 + index) * drift
          vy += Math.cos(time * 0.0007 + index) * drift
        }

        vx *= 0.86
        vy *= 0.86
        x += vx * delta * 0.55
        y += vy * delta * 0.55

        x = Math.max(PITCH_MIN + PLAYER_RADIUS, Math.min(PITCH_MAX - PLAYER_RADIUS, x))
        y = Math.max(PITCH_MIN + PLAYER_RADIUS, Math.min(PITCH_MAX - PLAYER_RADIUS, y))

        return { ...player, x, y, vx, vy }
      })

      let nextBall = { ...ballRef.current }
      if (controlRef.current?.type === 'ball') {
        const targetX = controlRef.current.targetX
        const targetY = controlRef.current.targetY
        const spring = 20
        nextBall.vx += (targetX - nextBall.x) * spring * delta
        nextBall.vy += (targetY - nextBall.y) * spring * delta
      }

      nextBall.vx *= 0.985
      nextBall.vy *= 0.985
      nextBall.x += nextBall.vx * delta * speedMultiplier
      nextBall.y += nextBall.vy * delta * speedMultiplier

      if (nextBall.y <= PITCH_MIN + BALL_RADIUS || nextBall.y >= PITCH_MAX - BALL_RADIUS) {
        nextBall.vy *= -0.8
        nextBall.y = Math.max(PITCH_MIN + BALL_RADIUS, Math.min(PITCH_MAX - BALL_RADIUS, nextBall.y))
      }

      const inGoalMouth = nextBall.y >= GOAL_MIN_Y && nextBall.y <= GOAL_MAX_Y
      if (nextBall.x <= PITCH_MIN + BALL_RADIUS) {
        if (!inGoalMouth) {
          nextBall.vx *= -0.9
          nextBall.x = PITCH_MIN + BALL_RADIUS
        }
      }
      if (nextBall.x >= PITCH_MAX - BALL_RADIUS) {
        if (!inGoalMouth) {
          nextBall.vx *= -0.9
          nextBall.x = PITCH_MAX - BALL_RADIUS
        }
      }

      nextPlayers.forEach((player) => {
        const dx = nextBall.x - player.x
        const dy = nextBall.y - player.y
        const dist = Math.hypot(dx, dy)
        const minDist = PLAYER_RADIUS + BALL_RADIUS
        if (dist > 0 && dist < minDist) {
          const nx = dx / dist
          const ny = dy / dist
          const push = (minDist - dist) * 0.6
          nextBall.x += nx * push
          nextBall.y += ny * push
          const impact = 7
          nextBall.vx = nx * impact + player.vx * 0.1
          nextBall.vy = ny * impact + player.vy * 0.1
          lastTouchTeamRef.current = player.team
        }
      })

      const isGoalLeft = nextBall.x <= PITCH_MIN + BALL_RADIUS && inGoalMouth
      const isGoalRight = nextBall.x >= PITCH_MAX - BALL_RADIUS && inGoalMouth

      if (isGoalLeft || isGoalRight) {
        setScore((prev) => {
          if (lastTouchTeamRef.current === 'home') return { ...prev, home: prev.home + 1 }
          if (lastTouchTeamRef.current === 'away') return { ...prev, away: prev.away + 1 }
          return isGoalLeft ? { ...prev, away: prev.away + 1 } : { ...prev, home: prev.home + 1 }
        })
        lastTouchTeamRef.current = null
        setShowConfetti(true)
        window.setTimeout(() => setShowConfetti(false), 1400)
        nextBall = {
          x: 50,
          y: 50,
          vx: (Math.random() - 0.5) * 6,
          vy: (Math.random() - 0.5) * 4,
        }
      }

      playersRef.current = nextPlayers
      ballRef.current = nextBall
      setPlayers(nextPlayers)
      setBall(nextBall)

      raf = requestAnimationFrame(animate)
    }

    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [resetBall, speedMultiplier])

  const handleSelect = useCallback(
    (event: React.MouseEvent, id: string, type: 'player' | 'ball') => {
      const coords = toPitchCoords(event)
      controlRef.current = {
        type,
        id: type === 'player' ? id : undefined,
        targetX: coords.x,
        targetY: coords.y,
      }
      if (type === 'player') {
        const player = players.find((p) => p.id === id)
        if (player) lastTouchTeamRef.current = player.team
      }
    },
    [players, toPitchCoords]
  )

  const handlePitchPointerDown = useCallback((event: React.PointerEvent) => {
    if ((event.target as HTMLElement).dataset.role === 'draggable') return
    controlRef.current = null
  }, [])

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePitchPointerDown}
      className={cn('relative w-full aspect-[3/2] overflow-hidden rounded-xl select-none', className)}
    >
      {showConfetti && (
        <div className="pointer-events-none absolute inset-0 z-20">
          {Array.from({ length: 24 }).map((_, index) => (
            <span
              key={index}
              className="absolute h-2 w-2 rounded-sm"
              style={{
                left: `${10 + Math.random() * 80}%`,
                top: `${10 + Math.random() * 20}%`,
                backgroundColor: index % 2 === 0 ? '#3b82f6' : '#ef4444',
                animation: `confetti-fall 1.2s ease-out ${index * 0.02}s forwards`,
              }}
            />
          ))}
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a472a] to-[#0d2818]" />

      <div className="absolute inset-0" style={{ transform: 'perspective(900px) rotateX(8deg) rotateY(-6deg)' }}>
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet">
          <rect x="2" y="2" width="96" height="96" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.5" />
          <line x1="50" y1="2" x2="50" y2="98" stroke="rgba(255,255,255,0.35)" strokeWidth="0.5" />
          <circle cx="50" cy="50" r="12" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.5" />
          <circle cx="50" cy="50" r="0.8" fill="rgba(255,255,255,0.5)" />
          <rect x="2" y="22" width="16" height="56" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.5" />
          <rect x="2" y="35" width="6" height="30" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.5" />
          <circle cx="12" cy="50" r="0.6" fill="rgba(255,255,255,0.4)" />
          <path d="M 18 38 A 12 12 0 0 1 18 62" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.5" />
          <rect x="82" y="22" width="16" height="56" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.5" />
          <rect x="92" y="35" width="6" height="30" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.5" />
          <circle cx="88" cy="50" r="0.6" fill="rgba(255,255,255,0.4)" />
          <path d="M 82 38 A 12 12 0 0 0 82 62" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.5" />
          <path d="M 2 5 A 3 3 0 0 0 5 2" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.5" />
          <path d="M 95 2 A 3 3 0 0 0 98 5" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.5" />
          <path d="M 2 95 A 3 3 0 0 1 5 98" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.5" />
          <path d="M 95 98 A 3 3 0 0 1 98 95" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.5" />
        </svg>
      </div>

      <div className="absolute left-[2%] top-[40%] h-[20%] w-[2.4%]">
        <div className="absolute inset-y-0 left-0 w-[42%] rounded-full bg-white/90 shadow-[0_0_12px_rgba(255,255,255,0.45)]" />
        <div className="absolute inset-y-0 left-[38%] w-[34%] rounded-full bg-white/55" />
        <div className="absolute left-0 top-0 h-[10%] w-full bg-white/75 shadow-[0_0_10px_rgba(255,255,255,0.35)]" />
      </div>
      <div className="absolute right-[2%] top-[40%] h-[20%] w-[2.4%]">
        <div className="absolute inset-y-0 right-0 w-[42%] rounded-full bg-white/90 shadow-[0_0_12px_rgba(255,255,255,0.45)]" />
        <div className="absolute inset-y-0 right-[38%] w-[34%] rounded-full bg-white/55" />
        <div className="absolute right-0 top-0 h-[10%] w-full bg-white/75 shadow-[0_0_10px_rgba(255,255,255,0.35)]" />
      </div>

      {players.map((player) => (
        <div
          key={player.id}
          onClick={(event) => handleSelect(event, player.id, 'player')}
          data-role="draggable"
          className="player-3d absolute rounded-full cursor-pointer"
          style={{
            left: `${player.x}%`,
            top: `${player.y}%`,
            width: `${PLAYER_RADIUS * 2}%`,
            height: `${PLAYER_RADIUS * 2}%`,
            transform: 'translate(-50%, -50%)',
            backgroundImage:
              player.team === 'home'
                ? 'radial-gradient(circle at 30% 30%, #93c5fd 0%, #3b82f6 45%, #1d4ed8 100%)'
                : 'radial-gradient(circle at 30% 30%, #fca5a5 0%, #ef4444 45%, #b91c1c 100%)',
            boxShadow: `0 0 18px ${player.team === 'home' ? 'rgba(59,130,246,0.65)' : 'rgba(239,68,68,0.65)'}, inset 0 0 8px rgba(255,255,255,0.5)`,
            border: '1px solid rgba(255,255,255,0.35)',
          }}
        />
      ))}

      <div
        className="absolute rounded-full bg-white"
        style={{
          left: `${ball.x}%`,
          top: `${ball.y}%`,
          width: `${BALL_RADIUS * 2}%`,
          height: `${BALL_RADIUS * 2}%`,
          transform: 'translate(-50%, -50%)',
          backgroundImage:
            'radial-gradient(circle at 30% 30%, #ffffff 0%, #f3f4f6 55%, #e5e7eb 100%), radial-gradient(circle at 32% 36%, #111827 0 8%, transparent 9%), radial-gradient(circle at 60% 50%, #111827 0 8%, transparent 9%), radial-gradient(circle at 48% 68%, #111827 0 7%, transparent 8%), radial-gradient(circle at 70% 30%, #111827 0 7%, transparent 8%)',
          backgroundBlendMode: 'normal',
          boxShadow: '0 0 12px rgba(255,255,255,0.6)',
          border: '2px solid rgba(0,0,0,0.35)',
        }}
      />

      <div
        className="absolute left-6 top-6 rounded-full bg-black/50 px-6 py-3 text-lg font-semibold text-white shadow-lg backdrop-blur"
        style={{ transform: 'perspective(600px) rotateX(12deg) rotateY(-8deg)' }}
      >
        Blue {score.home} : {score.away} Red
      </div>
    </div>
  )
}
