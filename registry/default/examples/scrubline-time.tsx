"use client"

import * as React from "react"

import * as Scrubline from "@/registry/default/ui/scrubline"
import type { Segment } from "@/registry/default/lib/scrubline-scale"

const pad = (n: number) => String(n).padStart(2, "0")

/** One step = one second. */
const formatTime = (step: number) =>
  `${pad(Math.floor(step / 60))}:${pad(step % 60)}`

const FPS = 25

/** One step = one frame at 25 fps. Shows mm:ss:ff. */
const formatFrames = (step: number) => {
  const s = Math.floor(step / FPS)
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}:${pad(step % FPS)}`
}

const CLIPS: Segment[] = [
  { id: "a", start: 0, end: 420, label: "Opening", color: "#6366f1" },
  { id: "b", start: 420, end: 1500, label: "Interview", color: "#0ea5e9" },
  { id: "c", start: 1500, end: 2700, label: "B-roll", color: "#10b981" },
  { id: "d", start: 2700, end: 3600, label: "Credits", color: "#f59e0b" },
]

export function ScrublineTime() {
  const [seconds, setSeconds] = React.useState(0)
  const [frame, setFrame] = React.useState(0)

  return (
    <div className="flex flex-col gap-6">
      <Scrubline.Root count={3600} value={seconds} onValueChange={setSeconds}>
        <Scrubline.Controls formatPosition={formatTime} />
        <Scrubline.Ruler formatLabel={formatTime} />
        <Scrubline.Viewport>
          <Scrubline.Track>
            <Scrubline.Segments items={CLIPS} />
          </Scrubline.Track>
          <Scrubline.Playhead formatPosition={formatTime} />
        </Scrubline.Viewport>
      </Scrubline.Root>

      {/* Frames: 2 minutes at 25 fps = 3000 steps, labels as mm:ss:ff. */}
      <Scrubline.Root
        count={FPS * 120}
        value={frame}
        onValueChange={setFrame}
        size="sm"
      >
        <Scrubline.Ruler formatLabel={formatFrames} />
        <Scrubline.Viewport>
          <Scrubline.Playhead formatPosition={formatFrames} />
        </Scrubline.Viewport>
        <Scrubline.Controls formatPosition={formatFrames} />
      </Scrubline.Root>
    </div>
  )
}
