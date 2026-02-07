'use client'

import type { Track, BoundingBox } from './types'

export function generateFrameDetections(
  timestamp: number,
  tracks: Track[]
): Array<{ id: string; bbox: BoundingBox; confidence: number }> {
  return tracks
    .map((track) => {
      const pos = track.positions.find(
        (p) => Math.abs(p.timestamp - timestamp) < 0.5
      )
      if (!pos) return null

      const width = track.class === 'person' ? 0.04 : 0.015
      const height = track.class === 'person' ? 0.12 : 0.015

      return {
        id: track.id,
        bbox: {
          x: pos.x - width / 2,
          y: pos.y - height / 2,
          width,
          height,
        },
        confidence: pos.confidence ?? 1,
      }
    })
    .filter((d): d is NonNullable<typeof d> => d !== null)
}

export function generateHeatmapData(
  tracks: Track[],
  gridSize: number = 20
): number[][] {
  const heatmap: number[][] = Array.from({ length: gridSize }, () =>
    Array(gridSize).fill(0)
  )

  tracks
    .filter((t) => t.class === 'person')
    .forEach((track) => {
      track.positions.forEach((pos) => {
        const gridX = Math.min(Math.floor(pos.x * gridSize), gridSize - 1)
        const gridY = Math.min(Math.floor(pos.y * gridSize), gridSize - 1)
        if (gridX >= 0 && gridY >= 0) {
          heatmap[gridY][gridX] += 1
        }
      })
    })

  const maxVal = Math.max(...heatmap.flat())
  if (maxVal > 0) {
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        heatmap[y][x] = heatmap[y][x] / maxVal
      }
    }
  }

  return heatmap
}
