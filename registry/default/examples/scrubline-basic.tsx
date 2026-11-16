"use client"

import * as React from "react"

import * as Scrubline from "@/registry/default/ui/scrubline"
import type { Segment } from "@/registry/default/lib/scrubline-scale"

/** 23 steps split into 5 fragments. `end` is exclusive. */
const COUNT = 23

const FRAGMENTS: Segment[] = [
  { id: "a", start: 0, end: 5, label: "Intro", color: "#6366f1" },
  { id: "b", start: 5, end: 9, label: "Setup", color: "#0ea5e9" },
  { id: "c", start: 9, end: 14, label: "Action", color: "#10b981" },
  { id: "d", start: 14, end: 18, label: "Twist", color: "#f59e0b" },
  { id: "e", start: 18, end: 23, label: "Finale", color: "#ec4899" },
]

export function ScrublineBasic() {
  const [value, setValue] = React.useState(0)

  return (
    <Scrubline.Root count={COUNT} value={value} onValueChange={setValue}>
      <Scrubline.Controls />
      {/* origin={1}: labels show step + 1, so ticks match the playhead. */}
      <Scrubline.Ruler origin={1} formatLabel={(s) => String(s + 1)} />
      <Scrubline.Viewport>
        <Scrubline.Track>
          <Scrubline.Segments items={FRAGMENTS} />
        </Scrubline.Track>
        <Scrubline.Playhead />
      </Scrubline.Viewport>
    </Scrubline.Root>
  )
}
