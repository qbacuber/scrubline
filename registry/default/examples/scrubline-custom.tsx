"use client"

import * as React from "react"

import * as Scrubline from "@/registry/default/ui/scrubline"
import type { Marker, Segment } from "@/registry/default/lib/scrubline-scale"

const COUNT = 600

const SEGMENTS: Segment[] = [
  { id: "talk", start: 0, end: 150, label: "Talk", color: "#6366f1" },
  { id: "demo", start: 150, end: 380, label: "Demo", color: "#0ea5e9" },
  { id: "qa", start: 380, end: 600, label: "Q&A", color: "#10b981" },
]

const MARKERS: Marker[] = [
  { at: 150, variant: "major", label: "Demo starts" },
  { at: 380, variant: "major", label: "Questions" },
]

type Note = { id: string; at: number; icon: string; text: string }

const NOTES: Note[] = [
  { id: "n1", at: 20, icon: "💡", text: "Idea" },
  { id: "n2", at: 90, icon: "⭐", text: "Highlight" },
  { id: "n3", at: 200, icon: "🐞", text: "Bug found" },
  { id: "n4", at: 310, icon: "🎯", text: "Goal" },
  { id: "n5", at: 450, icon: "❓", text: "Question" },
  { id: "n6", at: 560, icon: "👏", text: "Applause" },
]

const SEGMENT_ICONS: Record<string, string> = { talk: "🎤", demo: "💻", qa: "💬" }

/** Own icons: ScrublineIcon gives the shared size and stroke style. */
const Icon = {
  Back: () => (
    <Scrubline.ScrublineIcon>
      <path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" />
    </Scrubline.ScrublineIcon>
  ),
  Forward: () => (
    <Scrubline.ScrublineIcon>
      <path d="M13 17l5-5-5-5M6 17l5-5-5-5" />
    </Scrubline.ScrublineIcon>
  ),
  Play: () => (
    <Scrubline.ScrublineIcon className="fill-current">
      <circle cx="12" cy="12" r="9" />
      <path d="M10 8.5v7l5.5-3.5z" className="fill-background stroke-none" />
    </Scrubline.ScrublineIcon>
  ),
  Pause: () => (
    <Scrubline.ScrublineIcon className="fill-current">
      <circle cx="12" cy="12" r="9" />
      <path d="M10 9v6M14 9v6" className="stroke-background" />
    </Scrubline.ScrublineIcon>
  ),
  Plus: () => (
    <Scrubline.ScrublineIcon>
      <path d="M12 5v14M5 12h14" />
    </Scrubline.ScrublineIcon>
  ),
  Minus: () => (
    <Scrubline.ScrublineIcon>
      <path d="M5 12h14" />
    </Scrubline.ScrublineIcon>
  ),
}

export function ScrublineCustom() {
  const [value, setValue] = React.useState(0)
  const [last, setLast] = React.useState("Nothing clicked yet.")

  return (
    <div className="flex flex-col gap-2">
      <Scrubline.Root
        count={COUNT}
        value={value}
        onValueChange={setValue}
        stepsPerSecond={20}
        onStepClick={(step) => setLast(`Step ${step + 1} (background click)`)}
      >
        {/* Own composition: custom order, icons and labels. */}
        <Scrubline.Controls>
          <Scrubline.ControlPlay>
            {(playing) => (playing ? <Icon.Pause /> : <Icon.Play />)}
          </Scrubline.ControlPlay>
          <Scrubline.ControlPrevStep aria-label="One step back" />
          <Scrubline.ControlPosition
            formatPosition={(s) => `${s + 1} / ${COUNT}`}
            className="min-w-20"
          />
          <Scrubline.ControlNextStep aria-label="One step forward" />
          <Scrubline.ControlPrevSegment aria-label="Previous chapter">
            <Icon.Back />
          </Scrubline.ControlPrevSegment>
          <Scrubline.ControlNextSegment aria-label="Next chapter">
            <Icon.Forward />
          </Scrubline.ControlNextSegment>
          <span className="flex-1" />
          <Scrubline.ControlZoomOut aria-label="Less detail">
            <Icon.Minus />
          </Scrubline.ControlZoomOut>
          <Scrubline.ControlZoomIn aria-label="More detail">
            <Icon.Plus />
          </Scrubline.ControlZoomIn>
          <Scrubline.ControlFit aria-label="Whole talk" />
        </Scrubline.Controls>
        <Scrubline.Ruler origin={1} formatLabel={(s) => String(s + 1)} />
        <Scrubline.Viewport>
          <Scrubline.Track>
            <Scrubline.Segments
              items={SEGMENTS}
              onSegmentClick={(s) => setLast(`Segment "${s.label}"`)}
              renderLabel={(s, { width }) => (
                <span className="flex items-center gap-1 px-1 text-xs font-medium text-white">
                  <span aria-hidden="true">{SEGMENT_ICONS[s.id]}</span>
                  {width > 90 ? s.label : null}
                </span>
              )}
            />
            <Scrubline.Items
              items={NOTES}
              minGapPx={20}
              renderItem={(n) => (
                <button
                  type="button"
                  title={n.text}
                  aria-label={n.text}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setLast(`Note "${n.text}" at step ${n.at + 1}`)}
                  className="grid size-full place-items-center rounded bg-background/80 px-1 text-sm shadow-sm"
                >
                  {n.icon}
                </button>
              )}
            />
            <Scrubline.Markers
              items={MARKERS}
              variantClassName={{ major: "stroke-destructive stroke-2" }}
              onMarkerClick={(m) => setLast(`Marker "${m.label}"`)}
            />
          </Scrubline.Track>
          <Scrubline.Playhead />
        </Scrubline.Viewport>
      </Scrubline.Root>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Last click: {last}
      </p>
    </div>
  )
}
