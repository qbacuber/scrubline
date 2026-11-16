"use client"

import * as React from "react"

import * as Scrubline from "@/registry/default/ui/scrubline"
import type { Segment } from "@/registry/default/lib/scrubline-scale"

const COUNT = 100_000
const SEGMENT_COUNT = 10_000
const COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899"]

// Deterministic pseudo-random generator (mulberry32), so server and client agree.
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeSegments(): Segment[] {
  const rand = rng(42)
  const slot = COUNT / SEGMENT_COUNT // 10 steps per slot
  const out: Segment[] = []
  for (let i = 0; i < SEGMENT_COUNT; i++) {
    const start = Math.floor(i * slot)
    const end = Math.max(start + 1, Math.floor((i + 1) * slot) - 1 - Math.floor(rand() * 3))
    out.push({
      id: `s${i}`,
      start,
      end,
      label: `#${i + 1}`,
      color: COLORS[Math.floor(rand() * COLORS.length)],
    })
  }
  return out
}

const SEGMENTS = makeSegments()
const SNAP = SEGMENTS.flatMap((s) => [s.start, s.end])

export function ScrublineMinimap() {
  const [value, setValue] = React.useState(0)

  return (
    <Scrubline.Root
      count={COUNT}
      value={value}
      onValueChange={setValue}
      snapTo={SNAP}
    >
      <Scrubline.Minimap items={SEGMENTS} />
      <Scrubline.Ruler origin={1} formatLabel={(s) => String(s + 1)} />
      <Scrubline.Viewport>
        <Scrubline.Track>
          <Scrubline.Segments items={SEGMENTS} minLabelPx={40} />
        </Scrubline.Track>
        <Scrubline.Playhead />
      </Scrubline.Viewport>
      <Scrubline.Controls />
    </Scrubline.Root>
  )
}
