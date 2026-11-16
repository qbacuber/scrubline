"use client"

import * as React from "react"

import * as Scrubline from "@/registry/default/ui/scrubline"
import type { Segment } from "@/registry/default/lib/scrubline-scale"

const COUNT = 10_000

const SEGMENTS: Segment[] = [
  { id: "intro", start: 0, end: 1200, label: "Intro" },
  { id: "verse-a", start: 1200, end: 3400, label: "Zwrotka A" },
  { id: "chorus-a", start: 3400, end: 4600, label: "Refren" },
  { id: "bridge", start: 4600, end: 6100, label: "Most" },
  { id: "verse-b", start: 6100, end: 8000, label: "Zwrotka B" },
  { id: "outro", start: 8000, end: 10000, label: "Outro" },
]

export default function Home() {
  const [value, setValue] = React.useState(0)

  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col gap-6 px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight">Scrubline</h1>

      <Scrubline.Root
        count={COUNT}
        value={value}
        onValueChange={setValue}
        snapTo={SEGMENTS.flatMap((s) => [s.start, s.end])}
      >
        <Scrubline.Viewport>
          <Scrubline.Segments items={SEGMENTS} />
          <Scrubline.Playhead />
        </Scrubline.Viewport>
      </Scrubline.Root>
    </main>
  )
}
