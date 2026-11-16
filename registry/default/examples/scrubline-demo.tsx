"use client"

import * as React from "react"

import * as Scrubline from "@/registry/default/ui/scrubline"
import type { Marker, Segment } from "@/registry/default/lib/scrubline-scale"

const COUNT = 5000

const SEGMENTS: Segment[] = [
  { id: "intro", start: 0, end: 600, label: "Intro", color: "#6366f1" },
  { id: "verse-1", start: 600, end: 1700, label: "Verse 1", color: "#0ea5e9" },
  { id: "chorus-1", start: 1700, end: 2300, label: "Chorus", color: "#f59e0b" },
  { id: "verse-2", start: 2300, end: 3500, label: "Verse 2", color: "#0ea5e9" },
  { id: "chorus-2", start: 3500, end: 4300, label: "Chorus", color: "#f59e0b" },
  { id: "outro", start: 4300, end: 5000, label: "Outro", color: "#6366f1" },
]

const MARKERS: Marker[] = [
  { at: 250, label: "Cue A" },
  { at: 1000, variant: "major", label: "Key change" },
  { at: 1700, variant: "major", label: "Drop" },
  { at: 2900, label: "Cue B" },
  { at: 3500, variant: "major", label: "Drop" },
  { at: 4600, label: "Fade" },
]

const SNAP = Array.from(
  new Set([
    ...SEGMENTS.flatMap((s) => [s.start, s.end]),
    ...MARKERS.map((m) => m.at),
  ])
).sort((a, b) => a - b)

export function ScrublineDemo() {
  const [value, setValue] = React.useState(0)

  return (
    <Scrubline.Root
      count={COUNT}
      value={value}
      onValueChange={setValue}
      snapTo={SNAP}
    >
      <Scrubline.Controls />
      <Scrubline.Ruler origin={1} formatLabel={(s) => String(s + 1)} />
      <Scrubline.Viewport>
        <Scrubline.Track>
          <Scrubline.Segments items={SEGMENTS} />
          <Scrubline.Markers
            items={MARKERS}
            variantClassName={{ major: "stroke-destructive stroke-2" }}
          />
        </Scrubline.Track>
        <Scrubline.Playhead />
      </Scrubline.Viewport>
    </Scrubline.Root>
  )
}
