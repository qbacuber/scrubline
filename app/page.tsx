import type { ReactNode } from "react"

import { DemoBlock } from "@/components/demo-block"
import { ScrublineBasic } from "@/registry/default/examples/scrubline-basic"
import { ScrublineCompact } from "@/registry/default/examples/scrubline-compact"
import { ScrublineCustom } from "@/registry/default/examples/scrubline-custom"
import { ScrublineDemo } from "@/registry/default/examples/scrubline-demo"
import { ScrublineMinimap } from "@/registry/default/examples/scrubline-minimap"
import { ScrublineTime } from "@/registry/default/examples/scrubline-time"

type Row = [string, string, string, string]

const INSTALL = "npx shadcn@latest add qbacuber/ui/scrubline"
const INSTALL_TAG = "npx shadcn@latest add qbacuber/ui/scrubline#v0.1.0"

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

const CUSTOM = `<Scrubline.Controls>
  <Scrubline.ControlPlay>
    {(playing) => (playing ? <MyPause /> : <MyPlay />)}
  </Scrubline.ControlPlay>
  <Scrubline.ControlPrevStep aria-label="Back" />
  <Scrubline.ControlPosition />
  <Scrubline.ControlNextStep aria-label="Forward" />
  <Scrubline.ControlZoomIn>
    <Scrubline.ScrublineIcon><path d="M12 5v14M5 12h14" /></Scrubline.ScrublineIcon>
  </Scrubline.ControlZoomIn>
</Scrubline.Controls>`

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
      ["playing / defaultPlaying", "boolean", "false", "Playback state (controlled / uncontrolled)."],
      ["onPlayingChange", "(playing: boolean) => void", "-", "Called when playback starts or stops."],
      ["stepsPerSecond", "number", "10", "Playback speed."],
      ["loop", "boolean", "false", "Restart from the first step at the end instead of stopping."],
      ["onStepClick", "(step: number, event) => void", "-", "Click on the background. preventDefault() keeps the playhead where it is."],
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
      ["onSegmentClick", "(segment, event) => void", "-", "Click on a segment. preventDefault() suppresses the playhead move."],
      ["onSegmentHover", "(segment | null) => void", "-", "Pointer enters a segment, or null when it leaves."],
      ["renderLabel", "(segment, { width }) => ReactNode", "segment.label", "Custom label content; width is the segment width in px."],
    ],
  },
  {
    name: "Markers",
    note: "Absolutely positioned SVG overlay. Put it inside Track (or Viewport).",
    rows: [
      ["items", "Marker[]", "required", "Sorted by at. Marker: { at, variant?, label? }. The variant \"major\" is drawn taller."],
      ["variantClassName", "Record<string, string>", "-", "Tailwind classes per variant, e.g. stroke color."],
      ["labelMinPxPerStep", "number", "12", "Marker labels (tooltips) appear once a step is at least this wide."],
      ["onMarkerClick", "(marker, event) => void", "-", "Click within clickTolerancePx of a marker. preventDefault() suppresses the playhead move."],
      ["clickTolerancePx", "number", "6", "Click distance to a marker in px."],
    ],
  },
  {
    name: "Items",
    note: "Custom React nodes placed at steps, in their own lane. Only visible items are rendered. Put it inside Track.",
    rows: [
      ["items", "T[] (T extends { at: number; id: string })", "required", "Sorted by at."],
      ["renderItem", "(item: T, { x, step }) => ReactNode", "required", "Content of an item; x is its position in px. Items catch pointer events; call stopPropagation() in onPointerDown to not move the playhead."],
      ["minGapPx", "number", "0", "Skip items closer than this to the previous one."],
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
    note: "Toolbar (role=toolbar). Without children it renders the default set; with children it renders only those.",
    rows: [
      ["labels", "Partial<ControlsLabels>", "English", "Button labels: prevStep, nextStep, prevSegment, nextSegment, zoomIn, zoomOut, fit, reveal, play, pause."],
      ["formatPosition", "(step: number) => string", "step + 1", "Text of the position readout."],
      ["showPlay", "boolean", "false", "Adds a play/pause button to the default set."],
      ["children", "ReactNode", "default set", "Compose from the parts below."],
    ],
  },
  {
    name: "Control parts",
    note: "ControlPrevStep, ControlNextStep (hold to repeat, with acceleration), ControlPrevSegment, ControlNextSegment, ControlZoomIn, ControlZoomOut, ControlFit, ControlReveal, ControlPlay, ControlPosition. Buttons accept button props.",
    rows: [
      ["children", "ReactNode", "default icon", "Replaces the icon of a button."],
      ["ControlPlay children", "ReactNode | (playing: boolean) => ReactNode", "Play / Pause icons", "Use the function form to switch icons by state."],
      ["ControlPosition formatPosition", "(step: number) => string", "step + 1", "Text of the readout."],
      ["ScrublineIcon", "ComponentProps<'svg'>", "-", "24x24 SVG wrapper with the shared size and stroke for custom icons."],
      ["ScrublineIcons", "PrevSegment, PrevStep, NextStep, NextSegment, ZoomOut, ZoomIn, Fit, Reveal, Play, Pause", "-", "Default icons, reusable in your own buttons."],
      ["useHoldRepeat", "hook", "-", "Hold-to-repeat with acceleration for your own step buttons."],
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

      <Section title="Basic">
        <p className="text-sm text-muted-foreground">
          23 steps in 5 fragments. A step is one integer position; a segment
          covers steps <code>start</code> to <code>end</code> (exclusive). The
          ruler uses <code>origin=&#123;1&#125;</code> so its numbers match the
          playhead.
        </p>
        <DemoBlock name="scrubline-basic"><ScrublineBasic /></DemoBlock>
      </Section>

      <Section title="Demo">
        <p className="text-sm text-muted-foreground">
          5,000 steps, segments, markers, ruler and controls. Shift + arrows
          jump between snap points.
        </p>
        <DemoBlock name="scrubline-demo"><ScrublineDemo /></DemoBlock>
      </Section>

      <Section title="Minimap, 100,000 steps">
        <p className="text-sm text-muted-foreground">
          10,000 generated segments. Drag the minimap frame to navigate.
        </p>
        <DemoBlock name="scrubline-minimap"><ScrublineMinimap /></DemoBlock>
      </Section>

      <Section title="Compact">
        <p className="text-sm text-muted-foreground">
          <code>size=&quot;sm&quot;</code> with only a viewport and a playhead.
        </p>
        <DemoBlock name="scrubline-compact"><ScrublineCompact /></DemoBlock>
      </Section>

      <Section title="Time and frames">
        <p className="text-sm text-muted-foreground">
          Steps are just integers; <code>formatLabel</code> and{" "}
          <code>formatPosition</code> turn them into mm:ss (top, 1 step per
          second) or mm:ss:ff at 25 fps (bottom). Press play:{" "}
          <code>stepsPerSecond</code> sets the playback speed.
        </p>
        <DemoBlock name="scrubline-time"><ScrublineTime /></DemoBlock>
      </Section>

      <Section title="Custom controls, items and callbacks">
        <p className="text-sm text-muted-foreground">
          Own control composition with inline SVG icons, React nodes placed at
          steps with <code>Items</code>, a custom segment label, and click
          callbacks. Click things and watch the line below the timeline.
        </p>
        <DemoBlock name="scrubline-custom"><ScrublineCustom /></DemoBlock>
      </Section>

      <Section title="Customization">
        <p className="text-sm text-muted-foreground">
          shadcn copies the source into your project, so everything is
          editable: change the classes, the sizes or the icons directly in{" "}
          <code>components/ui/scrubline.tsx</code>. You can also customize
          without editing it.
        </p>
        <ul className="list-disc pl-5 text-sm text-muted-foreground">
          <li>
            <b>Compose Controls.</b> Pass children to <code>Controls</code> and
            it renders only those, in your order. Use the parts{" "}
            <code>ControlPrevStep</code>, <code>ControlNextStep</code>,{" "}
            <code>ControlPrevSegment</code>, <code>ControlNextSegment</code>,{" "}
            <code>ControlZoomIn</code>, <code>ControlZoomOut</code>,{" "}
            <code>ControlFit</code>, <code>ControlReveal</code>,{" "}
            <code>ControlPlay</code> and <code>ControlPosition</code>.
          </li>
          <li>
            <b>Replace icons.</b> Give a control <code>children</code> to
            replace its icon. Draw your own with <code>ScrublineIcon</code>{" "}
            (an SVG wrapper with the shared size and stroke) or reuse{" "}
            <code>ScrublineIcons.*</code>.
          </li>
          <li>
            <b>Labels.</b> <code>labels</code> on <code>Controls</code>, or{" "}
            <code>aria-label</code> on a single part, for translation.
          </li>
          <li>
            <b>Your own nodes.</b> <code>Items</code> places any React node at
            a step, <code>Segments</code> accepts <code>renderLabel</code>.
          </li>
          <li>
            <b>Your own controls.</b> <code>useScrublineContext()</code> gives
            value, view, playing and the setters, and <code>useHoldRepeat</code>{" "}
            adds hold-to-repeat to any button.
          </li>
        </ul>
        <Code>{CUSTOM}</Code>
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
