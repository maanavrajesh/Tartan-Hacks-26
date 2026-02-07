"use client"

import { ShaderAnimation } from "./shader-animation"

type BouncingBallsProps = {
  numBalls?: number
  speed?: number
  maxRadius?: number
  minRadius?: number
  trailAlpha?: number
  className?: string
}

export function BouncingBalls({ className }: BouncingBallsProps) {
  return (
    <div className={`absolute inset-0 ${className || ""}`}>
      <ShaderAnimation />
      <div className="pointer-events-none absolute inset-0">
        {Array.from({ length: 12 }).map((_, index) => (
          <span
            key={index}
            className="absolute h-2 w-2 rounded-full bg-white/70"
            style={{
              left: `${10 + (index * 7) % 80}%`,
              top: `${15 + (index * 11) % 70}%`,
              boxShadow: "0 0 10px rgba(255,255,255,0.35)",
              opacity: 0.7,
            }}
          />
        ))}
      </div>
    </div>
  )
}
