"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"

export type SoccerHeroMode = "idle" | "upload" | "analyzing" | "complete"

type SoccerBallHeroProps = {
  className?: string
  mode?: SoccerHeroMode
}

export function SoccerBallHero({
  className,
  mode = "idle",
}: SoccerBallHeroProps) {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
    camera.position.set(0, 0, 3.2)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    mount.appendChild(renderer.domElement)

    const key = new THREE.DirectionalLight(0xffffff, 1.2)
    key.position.set(2, 2, 4)
    scene.add(key)

    const fill = new THREE.DirectionalLight(0xffffff, 0.6)
    fill.position.set(-3, 1, 2)
    scene.add(fill)

    const glow = new THREE.PointLight(0x6ee7ff, 1.2, 30)
    glow.position.set(0, 0, 6)
    scene.add(glow)

    const ballGeo = new THREE.SphereGeometry(1, 64, 64)
    const texture = buildSoccerTexture()
    const ballMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#ffffff"),
      metalness: 0.1,
      roughness: 0.55,
      map: texture,
    })
    const ball = new THREE.Mesh(ballGeo, ballMat)
    scene.add(ball)

    const resize = () => {
      const w = mount.clientWidth
      const h = mount.clientHeight
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    resize()
    window.addEventListener("resize", resize)

    const modeParams = (m: SoccerHeroMode) => {
      switch (m) {
        case "upload":
          return { rot: 0.75, wobble: 0.18, glow: 1.4 }
        case "analyzing":
          return { rot: 1.45, wobble: 0.28, glow: 2.2 }
        case "complete":
          return { rot: 0.45, wobble: 0.1, glow: 1.0 }
        case "idle":
        default:
          return { rot: 0.55, wobble: 0.12, glow: 1.2 }
      }
    }

    let raf = 0
    const clock = new THREE.Clock()

    const animate = () => {
      raf = requestAnimationFrame(animate)
      const t = clock.getElapsedTime()
      const p = modeParams(mode)

      ball.rotation.y = t * p.rot
      ball.rotation.x = Math.sin(t * 0.35) * p.wobble
      glow.intensity = p.glow + Math.sin(t * 1.2) * 0.25

      renderer.render(scene, camera)
    }

    animate()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", resize)
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement)
      }
      ballGeo.dispose()
      ballMat.dispose()
      texture.dispose()
      renderer.dispose()
    }
  }, [mode])

  return <div ref={mountRef} className={className} />
}

function buildSoccerTexture() {
  const size = 1024
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    return new THREE.Texture()
  }

  ctx.fillStyle = "#f8fafc"
  ctx.fillRect(0, 0, size, size)

  const hexRadius = size / 14
  const hexHeight = Math.sqrt(3) * hexRadius
  let row = 0

  for (let y = -hexHeight; y < size + hexHeight; y += hexHeight * 0.85) {
    const offset = row % 2 === 0 ? 0 : hexRadius * 0.9
    for (let x = -hexRadius; x < size + hexRadius; x += hexRadius * 1.8) {
      const centerX = x + offset
      const centerY = y
      const isBlack = ((row + Math.round(x / hexRadius)) % 3 === 0)
      if (isBlack) {
        drawHexagon(ctx, centerX, centerY, hexRadius * 0.8, "#0b0f19")
      }
    }
    row += 1
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(1, 1)
  texture.anisotropy = 8
  texture.needsUpdate = true
  return texture
}

function drawHexagon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  fill: string
) {
  ctx.beginPath()
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 3) * i + Math.PI / 6
    const px = x + r * Math.cos(angle)
    const py = y + r * Math.sin(angle)
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
}
