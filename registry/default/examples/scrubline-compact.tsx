"use client"

import * as Scrubline from "@/registry/default/ui/scrubline"

export function ScrublineCompact() {
  return (
    <Scrubline.Root count={500} defaultValue={120} size="sm">
      <Scrubline.Viewport className="h-6">
        <Scrubline.Playhead />
      </Scrubline.Viewport>
    </Scrubline.Root>
  )
}
