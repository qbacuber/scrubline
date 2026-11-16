"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import {
  useScrubline,
  type ScrublineApi,
  type UseScrublineOptions,
} from "@/registry/default/hooks/use-scrubline"
import {
  axisToX,
  markerPaths,
  segmentPaths,
  visibleRange,
  type Marker,
  type Segment,
} from "@/registry/default/lib/scrubline-scale"

type Size = "sm" | "default" | "lg"

// Wysokości w px, bo ścieżki SVG potrzebują liczb, a nie klas.
const SIZES: Record<Size, { lane: number; marker: number }> = {
  sm: { lane: 14, marker: 8 },
  default: { lane: 24, marker: 12 },
  lg: { lane: 36, marker: 16 },
}

const ScrublineContext = React.createContext<
  (ScrublineApi & { size: Size }) | null
>(null)

export function useScrublineContext() {
  const ctx = React.useContext(ScrublineContext)
  if (!ctx) throw new Error("Scrubline parts must be used inside <Root>.")
  return ctx
}

/* ------------------------------- Root ------------------------------- */

type RootProps = UseScrublineOptions &
  Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> & {
    size?: Size
  }

export function Root({
  count,
  value,
  defaultValue,
  onValueChange,
  view,
  defaultView,
  onViewChange,
  maxPxPerStep,
  snapTo,
  snapPx,
  edgeScroll,
  size = "default",
  className,
  children,
  ...props
}: RootProps) {
  const api = useScrubline({
    count,
    value,
    defaultValue,
    onValueChange,
    view,
    defaultView,
    onViewChange,
    maxPxPerStep,
    snapTo,
    snapPx,
    edgeScroll,
  })
  const ctx = React.useMemo(() => ({ ...api, size }), [api, size])
  return (
    <ScrublineContext.Provider value={ctx}>
      <div
        data-slot="scrubline"
        data-size={size}
        data-dragging={api.dragging || undefined}
        className={cn("flex w-full flex-col gap-1 text-foreground", className)}
        {...props}
      >
        {children}
      </div>
    </ScrublineContext.Provider>
  )
}

/* ----------------------------- Viewport ----------------------------- */

export function Viewport({ className, ...props }: React.ComponentProps<"div">) {
  const { viewportRef, viewportProps } = useScrublineContext()
  return (
    <div
      ref={viewportRef}
      data-slot="scrubline-viewport"
      // touch-pan-y: pionowe przewijanie strony zostaje w przeglądarce,
      // poziomy ruch i szczypanie dostajemy my jako pointer events.
      className={cn(
        "relative touch-pan-y overflow-hidden rounded-md border bg-muted/40 select-none",
        "cursor-grab active:cursor-grabbing",
        className
      )}
      {...viewportProps}
      {...props}
    />
  )
}

/* ----------------------------- Segments ----------------------------- */

/**
 * `items` muszą być posortowane po `start` i nie mogą na siebie nachodzić.
 * Kilka ścieżek (lanes) = kilka <Segments> jeden pod drugim.
 */
export function Segments({
  items,
  minLabelPx = 48,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  items: readonly Segment[]
  minLabelPx?: number
}) {
  const { view, width, size } = useScrublineContext()
  const height = SIZES[size].lane

  const { paths, labels } = React.useMemo(() => {
    if (width <= 0) return { paths: [], labels: [] }
    const [lo, hi] = visibleRange(items, view)
    const labels: { id: string; text: string; left: number; width: number }[] = []
    for (let i = lo; i < hi; i++) {
      const s = items[i]
      if (!s.label) continue
      const x0 = Math.max(0, axisToX(s.start, view, width))
      const x1 = Math.min(width, axisToX(s.end, view, width))
      // Najwyżej width / minLabelPx podpisów, niezależnie od liczby odcinków.
      if (x1 - x0 >= minLabelPx)
        labels.push({ id: s.id, text: s.label, left: x0, width: x1 - x0 })
    }
    return {
      paths: [...segmentPaths(items, lo, hi, view, width, { height })],
      labels,
    }
  }, [items, view, width, height])

  return (
    <div
      data-slot="scrubline-segments"
      className={cn("relative", className)}
      style={{ height }}
      {...props}
    >
      <svg className="absolute inset-0 size-full" aria-hidden="true">
        {paths.map(([color, d]) => (
          <path
            key={color}
            d={d}
            fill={color || undefined}
            className={color ? undefined : "fill-primary/60"}
          />
        ))}
      </svg>
      {labels.map((l) => (
        <span
          key={l.id}
          className="pointer-events-none absolute top-0 truncate px-1.5 text-xs text-primary-foreground"
          style={{ left: l.left, width: l.width, lineHeight: `${height}px` }}
        >
          {l.text}
        </span>
      ))}
    </div>
  )
}

/* ------------------------------ Markers ----------------------------- */

/** `items` posortowane po `at`. Klasy per wariant przez `variantClassName`. */
export function Markers({
  items,
  variantClassName,
  className,
  ...props
}: React.ComponentProps<"svg"> & {
  items: readonly Marker[]
  variantClassName?: Record<string, string>
}) {
  const { view, width, size } = useScrublineContext()
  const base = SIZES[size].marker
  const paths = React.useMemo(
    () =>
      width <= 0
        ? []
        : [...markerPaths(items, view, width, (v) => (v === "major" ? base * 1.5 : base))],
    [items, view, width, base]
  )
  return (
    <svg
      data-slot="scrubline-markers"
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 size-full", className)}
      {...props}
    >
      {paths.map(([variant, d]) => (
        <path
          key={variant}
          d={d}
          data-variant={variant}
          fill="none"
          className={cn("stroke-foreground/70", variantClassName?.[variant])}
        />
      ))}
    </svg>
  )
}

/* ------------------------------ Playhead ---------------------------- */

/**
 * Jeden element pełni trzy role: linia, uchwyt i (gdy głowica jest poza
 * widokiem) strzałka przy krawędzi. Dzięki temu fokus klawiatury nigdy
 * nie znika, nawet po przewinięciu widoku.
 * Musi być bezpośrednim dzieckiem <Viewport> (hook używa offsetParent).
 */
export function Playhead({
  formatPosition = (step) => String(step + 1),
  className,
  ...props
}: React.ComponentProps<"div"> & {
  formatPosition?: (step: number) => string
}) {
  const { value, count, width, stepToX, playheadProps, dragging } =
    useScrublineContext()
  const raw = stepToX(value)
  const offscreen = raw < 0 ? "start" : raw > width ? "end" : undefined
  const x = Math.min(width, Math.max(0, raw))

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-orientation="horizontal"
      aria-valuemin={0}
      aria-valuemax={count - 1}
      aria-valuenow={value}
      aria-valuetext={formatPosition(value)}
      data-slot="scrubline-playhead"
      data-offscreen={offscreen}
      data-dragging={dragging || undefined}
      className={cn(
        // Pole chwytu 24 px (dotyk), widoczna linia 2 px w środku.
        "group absolute inset-y-0 left-0 -ml-3 w-6 cursor-ew-resize touch-none outline-none",
        "data-[offscreen]:cursor-pointer",
        className
      )}
      style={{ transform: `translateX(${x}px)` }}
      {...playheadProps}
      {...props}
    >
      <div className="mx-auto h-full w-0.5 bg-primary group-data-[offscreen]:opacity-0" />
      <div
        className={cn(
          "absolute top-0 left-1/2 size-3 -translate-x-1/2 rounded-b-sm bg-primary",
          "ring-ring/50 group-focus-visible:ring-[3px]",
          // TODO(TODO.md, A3): zamienić na strzałkę dla data-offscreen=start|end
          "group-data-[offscreen]:top-1/2 group-data-[offscreen]:-translate-y-1/2 group-data-[offscreen]:rounded-full"
        )}
      />
    </div>
  )
}

/* -------- Track, Ruler, Minimap, Controls: patrz TODO.md (A1-A5) ----- */

export function Track({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="scrubline-track"
      className={cn("relative flex flex-col gap-px py-1", className)}
      {...props}
    />
  )
}
