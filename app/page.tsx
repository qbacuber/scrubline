import type { ReactNode } from "react"

import { ScrublineCompact } from "@/registry/default/examples/scrubline-compact"
import { ScrublineDemo } from "@/registry/default/examples/scrubline-demo"
import { ScrublineMinimap } from "@/registry/default/examples/scrubline-minimap"
import { ScrublineTime } from "@/registry/default/examples/scrubline-time"

type Row = [string, string, string, string]

const INSTALL = "npx shadcn@latest add qbacuber/scrubline/scrubline"
const INSTALL_TAG = "npx shadcn@latest add qbacuber/scrubline/scrubline#v0.1.0"

const USAGE = `import * as Scrubline from "@/components/ui/scrubline"

<Scrubline.Root count={5000} snapTo={[0, 1200, 3400]}>
  <Scrubline.Controls />
  <Scrubline.Ruler />
  <Scrubline.Viewport>
    <Scrubline.Track>
      <Scrubline.Segments items={segments} />
      <Scrubline.Markers items={markers} />
    </Scrubline.Track>
    <Scrubline.Playhead />
  </Scrubline.Viewport>
</Scrubline.Root>`

const PARTS: { name: string; note: string; rows: Row[] }[] = [
  {
    name: "Root",
    note: "Owns the state (value and view) and provides it to the other parts. Also accepts div props.",
    rows: [
      ["count", "number", "required", "Number of steps on the axis."],
      ["value / defaultValue", "number", "0", "Playhead step (controlled / uncontrolled)."],
      ["onValueChange", "(value: number) => void", "-", "Called when the playhead moves."],
      ["view / defaultView", "{ start: number; end: number }", "whole axis", "Visible range in steps (controlled / uncontrolled)."],
      ["onViewChange", "(view: View) => void", "-", "Called when zoom or pan changes the view."],
      ["maxPxPerStep", "number", "48", "Maximum zoom, in pixels per step."],
      ["snapTo", "readonly number[]", "-", "Sorted steps the playhead snaps to (segment edges, markers). Also used by Shift+arrows and the segment buttons."],
      ["snapPx", "number", "8", "Snap distance in pixels."],
      ["edgeScroll", "boolean", "true", "Pan the view while dragging the playhead near an edge."],
      ["size", '"sm" | "default" | "lg"', '"default"', "Heights of lanes, ruler, minimap and buttons."],
    ],
  },
  {
    name: "Viewport",
    note: "The zoomable, pannable area. Handles wheel, drag and pinch. Put Track and Playhead inside. Accepts div props.",
    rows: [["className, ...div props", "ComponentProps<'div'>", "-", "Merged with the built-in gesture handlers."]],
  },
  {
    name: "Track",
    note: "Relatively positioned stack of lanes. Place several Segments in it for multiple lanes, and Markers over them.",
    rows: [["className, ...div props", "ComponentProps<'div'>", "-", ""]],
  },
  {
    name: "Segments",
    note: "One lane of colored ranges. Only visible segments are rendered.",
    rows: [
      ["items", "Segment[]", "required", "Sorted by start, non-overlapping. Segment: { id, start, end (exclusive), color?, label? }."],
      ["minLabelPx", "number", "48", "Minimum segment width in px to show its label."],
    ],
  },
  {
    name: "Markers",
    note: "Absolutely positioned SVG overlay. Put it inside Track (or Viewport).",
    rows: [
      ["items", "Marker[]", "required", "Sorted by at. Marker: { at, variant?, label? }. The variant \"major\" is drawn taller."],
      ["variantClassName", "Record<string, string>", "-", "Tailwind classes per variant, e.g. stroke color."],
      ["labelMinPxPerStep", "number", "12", "Marker labels (tooltips) appear once a step is at least this wide."],
    ],
  },
  {
    name: "Playhead",
    note: "A focusable slider. Must be a direct child of Viewport.",
    rows: [
      ["formatPosition", "(step: number) => string", "step + 1", "Text for aria-valuetext."],
      ["offscreenDescription", "string", "English sentence", "aria-description when the playhead is outside the view."],
    ],
  },
  {
    name: "Ruler",
    note: "Tick marks and labels. Must share a parent with Viewport.",
    rows: [
      ["formatLabel", "(step: number) => string", "String", "Label text for major ticks."],
      ["origin", "number", "0", "Numbering offset. Use 1 when labels show step + 1 so ticks land on 10, 20, 30."],
      ["minLabelPx", "number", "from label length", "Minimum distance between labels in px."],
    ],
  },
  {
    name: "Controls",
    note: "Toolbar: previous/next segment and step, position, zoom out/in, fit, reveal playhead.",
    rows: [
      ["labels", "Partial<ControlsLabels>", "English", "Button labels: prevStep, nextStep, prevSegment, nextSegment, zoomIn, zoomOut, fit, reveal."],
      ["formatPosition", "(step: number) => string", "step + 1", "Text of the position readout."],
    ],
  },
  {
    name: "Minimap",
    note: "Overview of the whole axis with a frame for the current view. Drag the frame or its edges, or click to center.",
    rows: [["items", "Segment[]", "-", "Segments drawn in the overview."]],
  },
]

const KEYS: [string, string][] = [
  ["Left / Right", "Previous / next step"],
  ["Shift + Left / Right", "Previous / next snap point (or start / end)"],
  ["Home / End", "First / last step"],
  ["PageUp / PageDown", "Back / forward by the visible span"],
  ["+ or =", "Zoom in around the playhead"],
  ["-", "Zoom out around the playhead"],
  ["0", "Fit the whole axis"],
]

const GESTURES: [string, string][] = [
  ["Ctrl / Cmd + wheel, trackpad pinch", "Zoom around the cursor"],
  ["Horizontal wheel, Shift + wheel", "Pan"],
  ["Drag the background", "Pan"],
  ["Click the background", "Move the playhead there"],
  ["Drag the playhead", "Scrub, snapping to snapTo; pans near the edges"],
  ["Two-finger pinch (touch)", "Zoom; one finger pans, vertical page scroll still works"],
]

function Code({ children }: { children: ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-md border bg-muted px-3 py-2 font-mono text-sm">
      <code>{children}</code>
    </pre>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="border-b pb-1 text-xl font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  )
}

function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b text-muted-foreground">
            {head.map((h) => (
              <th key={h} className="px-2 py-1.5 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

const mono = "px-2 py-1.5 align-top font-mono text-xs"

export default function Home() {
  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col gap-10 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Scrubline</h1>
        <p className="text-muted-foreground">
          A step-based timeline for React with zoom, pan, playhead, ruler,
          segments, markers and a minimap. It renders only the visible range,
          so it stays smooth with 100,000+ steps. Distributed as a shadcn
          registry item.
        </p>
      </header>

      <Section title="Installation">
        <Code>{INSTALL}</Code>
        <p className="text-sm text-muted-foreground">Pin a release with a tag:</p>
        <Code>{INSTALL_TAG}</Code>
        <p className="text-sm text-muted-foreground">Usage:</p>
        <Code>{USAGE}</Code>
      </Section>

      <Section title="Demo">
        <p className="text-sm text-muted-foreground">
          5,000 steps, segments, markers, ruler and controls. Shift + arrows
          jump between snap points.
        </p>
        <ScrublineDemo />
      </Section>

      <Section title="Minimap, 100,000 steps">
        <p className="text-sm text-muted-foreground">
          10,000 generated segments. Drag the minimap frame to navigate.
        </p>
        <ScrublineMinimap />
      </Section>

      <Section title="Compact">
        <p className="text-sm text-muted-foreground">
          <code>size=&quot;sm&quot;</code> with only a viewport and a playhead.
        </p>
        <ScrublineCompact />
      </Section>

      <Section title="Time and frames">
        <p className="text-sm text-muted-foreground">
          Steps are just integers; <code>formatLabel</code> and{" "}
          <code>formatPosition</code> turn them into mm:ss (top) or mm:ss:ff at
          25 fps (bottom).
        </p>
        <ScrublineTime />
      </Section>

      <Section title="API">
        {PARTS.map((p) => (
          <div key={p.name} className="flex flex-col gap-1">
            <h3 className="font-mono text-base font-semibold">Scrubline.{p.name}</h3>
            <p className="text-sm text-muted-foreground">{p.note}</p>
            <Table head={["Prop", "Type", "Default", "Description"]}>
              {p.rows.map(([name, type, def, desc]) => (
                <tr key={name} className="border-b last:border-0">
                  <td className={mono}>{name}</td>
                  <td className={mono}>{type}</td>
                  <td className={mono}>{def}</td>
                  <td className="px-2 py-1.5 align-top text-sm">{desc}</td>
                </tr>
              ))}
            </Table>
          </div>
        ))}
      </Section>

      <Section title="Keyboard shortcuts">
        <p className="text-sm text-muted-foreground">With the playhead focused.</p>
        <Table head={["Key", "Action"]}>
          {KEYS.map(([k, a]) => (
            <tr key={k} className="border-b last:border-0">
              <td className={mono}>{k}</td>
              <td className="px-2 py-1.5 text-sm">{a}</td>
            </tr>
          ))}
        </Table>
      </Section>

      <Section title="Mouse and touch">
        <Table head={["Gesture", "Action"]}>
          {GESTURES.map(([k, a]) => (
            <tr key={k} className="border-b last:border-0">
              <td className="px-2 py-1.5 align-top text-sm">{k}</td>
              <td className="px-2 py-1.5 text-sm">{a}</td>
            </tr>
          ))}
        </Table>
      </Section>
    </main>
  )
}
