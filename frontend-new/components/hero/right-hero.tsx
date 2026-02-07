"use client"

import { ShaderAnimation } from "@/components/ui/shader-animation"
import { SoccerBallHero, type SoccerHeroMode } from "@/components/ui/soccer-ball-hero"

type RightHeroProps = {
  mode?: SoccerHeroMode
}

export function RightHero({ mode = "idle" }: RightHeroProps) {
  return (
    <div className="relative h-[640px] w-full overflow-hidden rounded-2xl border border-white/10 bg-zinc-950">
      <div className="absolute inset-0 opacity-55">
        <ShaderAnimation />
      </div>

      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/50" />

      <div className="absolute inset-0 grid place-items-center">
        <SoccerBallHero
          mode={mode}
          className="h-[520px] w-[520px] max-h-[90%] max-w-[90%]"
        />
      </div>

      {/* intentionally left empty */}
    </div>
  )
}
