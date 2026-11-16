"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import {
  useHoldRepeat,
  useScrubline,
  type ScrublineApi,
  type UseScrublineOptions,
} from "@/registry/default/hooks/use-scrubline"
import {
  axisToX,
  getTicks,
  lowerBound,
  markerAt,
  markerPaths,
  neighbor,
  segmentAt,
  segmentPaths,
  spanOf,
  stepToX as stepToXPure,
  visibleRange,
  xToAxis,
  type View,
  type Marker,
  type Segment,
} from "@/registry/default/lib/scrubline-scale"

type Size = "sm" | "default" | "lg"

// Wysokości w px, bo ścieżki SVG potrzebują liczb, a nie klas.
// grip = szerokość pola chwytu głowicy (dotyk), btn = rozmiar przycisku Controls.
const SIZES: Record<
  Size,
  { lane: number; marker: number; ruler: number; minimap: number; grip: number; btn: number }
> = {
  sm: { lane: 10, marker: 6, ruler: 14, minimap: 16, grip: 20, btn: 24 },
  default: { lane: 24, marker: 12, ruler: 20, minimap: 32, grip: 24, btn: 32 },
  lg: { lane: 36, marker: 16, ruler: 26, minimap: 44, grip: 32, btn: 40 },
}

/** Woła oba handlery: najpierw z hooka, potem użytkownika. */
function compose<E>(ours?: (e: E) => void, theirs?: (e: E) => void) {
  return (e: E) => {
    ours?.(e)
    theirs?.(e)
  }
}

const GESTURE_KEYS = [
  "onPointerDown",
  "onPointerMove",
  "onPointerUp",
  "onPointerCancel",
  "onPointerLeave",
  "onKeyDown",
  "onClick",
  "onBlur",
] as const

/** Łączy propsy z hooka z propsami użytkownika; handlery są składane, reszta nadpisywana. */
function mergeProps<A extends object, B extends object>(ours: A, theirs: B) {
  const out = { ...ours, ...theirs } as Record<string, unknown>
  for (const k of GESTURE_KEYS) {
    const a = (ours as Record<string, unknown>)[k]
    const b = (theirs as Record<string, unknown>)[k]
    if (a && b)
      out[k] = compose(a as (e: unknown) => void, b as (e: unknown) => void)
  }
  return out
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
  playing,
  defaultPlaying,
  onPlayingChange,
  stepsPerSecond,
  loop,
  onStepClick,
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
    playing,
    defaultPlaying,
    onPlayingChange,
    stepsPerSecond,
    loop,
    onStepClick,
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
      {...mergeProps(viewportProps, props)}
    />
  )
}

/* ----------------------------- Segments ----------------------------- */

/**
 * `items` muszą być posortowane po `start` i nie mogą na siebie nachodzić.
 * Kilka ścieżek (lanes) = kilka <Segments> jeden pod drugim.
 * Klik i hover to hit-test binarny po pozycji wskaźnika, bez elementów DOM
 * na odcinek. Klik liczy się tylko bez przesunięcia (nie psuje przesuwania tła);
 * `event.preventDefault()` w onSegmentClick nie przesuwa głowicy.
 * `renderLabel` zastępuje tekst podpisu (np. ikona); działa też bez `label`.
 */
export function Segments({
  items,
  minLabelPx = 48,
  onSegmentClick,
  onSegmentHover,
  renderLabel,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "onClick"> & {
  items: readonly Segment[]
  minLabelPx?: number
  onSegmentClick?: (
    segment: Segment,
    event: React.PointerEvent<HTMLElement>
  ) => void
  onSegmentHover?: (segment: Segment | null) => void
  renderLabel?: (segment: Segment, ctx: { width: number }) => React.ReactNode
}) {
  const { view, width, size, subscribeClick } = useScrublineContext()
  const height = SIZES[size].lane
  const ref = React.useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = React.useState<Segment | null>(null)
  const hoverRef = React.useRef<Segment | null>(null)

  const latest = React.useRef({ items, view, width, onSegmentClick })
  latest.current = { items, view, width, onSegmentClick }

  const hit = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return null
    const { items, view, width } = latest.current
    return segmentAt(items, xToAxis(clientX - rect.left, view, width))
  }

  React.useEffect(
    () =>
      subscribeClick((e) => {
        const { onSegmentClick } = latest.current
        const rect = ref.current?.getBoundingClientRect()
        if (!onSegmentClick || !rect) return
        if (e.clientY < rect.top || e.clientY > rect.bottom) return
        const s = hit(e.clientX)
        if (s) onSegmentClick(s, e)
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [subscribeClick]
  )

  const setHover = (s: Segment | null) => {
    if (hoverRef.current === s) return
    hoverRef.current = s
    setHovered(s)
    onSegmentHover?.(s)
  }

  const { paths, labels } = React.useMemo(() => {
    if (width <= 0) return { paths: [], labels: [] }
    const [lo, hi] = visibleRange(items, view)
    const labels: { segment: Segment; left: number; width: number }[] = []
    for (let i = lo; i < hi; i++) {
      const s = items[i]
      if (!s.label && !renderLabel) continue
      const x0 = Math.max(0, axisToX(s.start, view, width))
      const x1 = Math.min(width, axisToX(s.end, view, width))
      // Najwyżej width / minLabelPx podpisów, niezależnie od liczby odcinków.
      if (x1 - x0 >= minLabelPx)
        labels.push({ segment: s, left: x0, width: x1 - x0 })
    }
    return {
      paths: [...segmentPaths(items, lo, hi, view, width, { height })],
      labels,
    }
  }, [items, view, width, height, minLabelPx, renderLabel])

  return (
    <div
      ref={ref}
      data-slot="scrubline-segments"
      className={cn(
        "relative",
        onSegmentClick && hovered && "cursor-pointer",
        className
      )}
      style={{ height }}
      {...mergeProps(
        {
          onPointerMove: (e: React.PointerEvent<HTMLElement>) =>
            setHover(hit(e.clientX)),
          onPointerLeave: () => setHover(null),
        },
        props
      )}
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
          key={l.segment.id}
          className="pointer-events-none absolute top-0 truncate px-1.5 text-xs text-primary-foreground"
          style={{ left: l.left, width: l.width, lineHeight: `${height}px` }}
        >
          {renderLabel
            ? renderLabel(l.segment, { width: l.width })
            : l.segment.label}
        </span>
      ))}
    </div>
  )
}

/* ------------------------------ Markers ----------------------------- */

/**
 * `items` posortowane po `at`. Klasy per wariant przez `variantClassName`.
 * `Marker.label` pokazuje się jako tooltip (<title>) tylko przy bliskim zoomie:
 * gdy krok ma co najmniej `labelMinPxPerStep` px.
 */
export function Markers({
  items,
  variantClassName,
  labelMinPxPerStep = 12,
  onMarkerClick,
  clickTolerancePx = 6,
  className,
  ref: userRef,
  ...props
}: React.ComponentProps<"svg"> & {
  items: readonly Marker[]
  variantClassName?: Record<string, string>
  labelMinPxPerStep?: number
  /** Klik (bez przesunięcia) w promieniu `clickTolerancePx`; preventDefault nie przesuwa głowicy. */
  onMarkerClick?: (marker: Marker, event: React.PointerEvent<HTMLElement>) => void
  clickTolerancePx?: number
}) {
  const { view, width, size, subscribeClick } = useScrublineContext()
  const svgRef = React.useRef<SVGSVGElement | null>(null)
  const latest = React.useRef({ items, view, width, onMarkerClick, clickTolerancePx })
  latest.current = { items, view, width, onMarkerClick, clickTolerancePx }
  React.useEffect(
    () =>
      subscribeClick((e) => {
        const { items, view, width, onMarkerClick, clickTolerancePx } = latest.current
        const rect = svgRef.current?.getBoundingClientRect()
        if (!onMarkerClick || !rect) return
        if (e.clientY < rect.top || e.clientY > rect.bottom) return
        const pos = xToAxis(e.clientX - rect.left, view, width)
        const m = markerAt(items, pos, clickTolerancePx / (width / spanOf(view)))
        if (m) onMarkerClick(m, e)
      }),
    [subscribeClick]
  )
  const base = SIZES[size].marker
  const { paths, tips } = React.useMemo(() => {
    if (width <= 0) return { paths: [], tips: [] }
    const heightOf = (v: string) => (v === "major" ? base * 1.5 : base)
    const tips: { key: number; x: number; h: number; text: string }[] = []
    if (width / spanOf(view) >= labelMinPxPerStep) {
      // Przy tym zoomie widocznych jest najwyżej width / labelMinPxPerStep znaczników.
      const lo = lowerBound(items.length, (i) => items[i].at + 1 > view.start)
      const hi = lowerBound(items.length, (i) => items[i].at >= view.end)
      for (let i = lo; i < hi; i++) {
        const m = items[i]
        if (m.label)
          tips.push({
            key: i,
            x: stepToXPure(m.at, view, width),
            h: heightOf(m.variant ?? "default"),
            text: m.label,
          })
      }
    }
    return { paths: [...markerPaths(items, view, width, heightOf)], tips }
  }, [items, view, width, base, labelMinPxPerStep])
  return (
    <svg
      ref={(el) => {
        svgRef.current = el
        if (typeof userRef === "function") userRef(el)
        else if (userRef) userRef.current = el
      }}
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
      {tips.map((t) => (
        <rect
          key={t.key}
          x={t.x - 4}
          y={0}
          width={8}
          height={t.h}
          fill="transparent"
          pointerEvents="all"
        >
          <title>{t.text}</title>
        </rect>
      ))}
    </svg>
  )
}

/* ------------------------------- Items ------------------------------ */

/**
 * Własna zawartość React przy krokach. Renderuje tylko widoczne elementy
 * (wyszukiwanie binarne); `minGapPx` pomija te, które by na siebie nachodziły,
 * więc liczba węzłów DOM jest ograniczona szerokością. `items` posortowane po `at`.
 * Kontener ma pointer-events: none, a każdy element pointer-events: auto.
 * Klik w element NIE jest wyłączony z klików tła: jeśli nie chcesz
 * przesuwać głowicy, wywołaj e.stopPropagation() w onPointerDown elementu.
 */
export function Items<T extends { at: number; id: string }>({
  items,
  renderItem,
  minGapPx = 0,
  className,
  style,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  items: readonly T[]
  renderItem: (item: T, ctx: { x: number; step: number }) => React.ReactNode
  minGapPx?: number
}) {
  const { view, width, size } = useScrublineContext()

  const visible = React.useMemo(() => {
    if (width <= 0) return []
    const lo = lowerBound(items.length, (i) => items[i].at + 1 > view.start)
    const hi = lowerBound(items.length, (i) => items[i].at >= view.end)
    const out: { item: T; x: number }[] = []
    let lastX = -Infinity
    for (let i = lo; i < hi; i++) {
      const x = stepToXPure(items[i].at, view, width)
      if (x - lastX < minGapPx) continue
      lastX = x
      out.push({ item: items[i], x })
    }
    return out
  }, [items, view, width, minGapPx])

  return (
    <div
      data-slot="scrubline-items"
      className={cn("pointer-events-none relative", className)}
      style={{ height: SIZES[size].lane, ...style }}
      {...props}
    >
      {visible.map(({ item, x }) => (
        <div
          key={item.id}
          className="pointer-events-auto absolute top-0 h-full"
          style={{ left: x, transform: "translateX(-50%)" }}
        >
          {renderItem(item, { x, step: item.at })}
        </div>
      ))}
    </div>
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
  offscreenDescription = "Playhead is outside the visible range. Activate to bring it into view.",
  className,
  style,
  ...props
}: React.ComponentProps<"div"> & {
  formatPosition?: (step: number) => string
  /** Opis (aria-description) czytany, gdy głowica jest poza widokiem. */
  offscreenDescription?: string
}) {
  const { value, count, width, stepToX, playheadProps, dragging, size } =
    useScrublineContext()
  const raw = stepToX(value)
  const offscreen = raw < 0 ? "start" : raw > width ? "end" : undefined
  const x = Math.min(width, Math.max(0, raw))
  const grip = SIZES[size].grip
  const a11y = offscreen ? { "aria-description": offscreenDescription } : {}

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-orientation="horizontal"
      aria-valuemin={0}
      aria-valuemax={count - 1}
      aria-valuenow={value}
      aria-valuetext={formatPosition(value)}
      {...a11y}
      data-slot="scrubline-playhead"
      data-offscreen={offscreen}
      data-dragging={dragging || undefined}
      className={cn(
        // Pole chwytu (dotyk), widoczna linia 2 px w środku.
        "group absolute inset-y-0 left-0 cursor-ew-resize touch-none outline-none",
        "data-[offscreen]:cursor-pointer",
        className
      )}
      style={{
        width: grip,
        marginLeft: -grip / 2,
        transform: `translateX(${x}px)`,
        ...style,
      }}
      {...mergeProps(playheadProps, props)}
    >
      <div className="mx-auto h-full w-0.5 bg-primary group-data-[offscreen]:opacity-0" />
      <div
        className={cn(
          "absolute top-0 left-1/2 size-3 -translate-x-1/2 rounded-b-sm bg-primary",
          "ring-ring/50 group-focus-visible:ring-[3px]",
          "group-data-[offscreen]:hidden"
        )}
      />
      {offscreen && (
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className={cn(
            "absolute top-1/2 size-5 -translate-y-1/2 fill-none stroke-primary stroke-[3]",
            "rounded-sm ring-ring/50 group-focus-visible:ring-[3px]",
            offscreen === "start" ? "left-0" : "right-0"
          )}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={offscreen === "start" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
        </svg>
      )}
    </div>
  )
}

/* ------------------------------- Ruler ------------------------------ */

/** Podziałka. Musi mieć tego samego rodzica co <Viewport> (ta sama szerokość). */
export function Ruler({
  formatLabel = String,
  origin = 0,
  minLabelPx,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  formatLabel?: (step: number) => string
  /** Przesunięcie numeracji (np. 1, gdy formatLabel pokazuje step + 1). */
  origin?: number
  minLabelPx?: number
}) {
  const { view, width, count, size } = useScrublineContext()
  const height = SIZES[size].ruler
  const minPx = minLabelPx ?? formatLabel(count - 1).length * 7 + 16
  const tick = Math.round(height * 0.4)

  const { major, minor, labels } = React.useMemo(() => {
    let major = ""
    let minor = ""
    const labels: { step: number; x: number }[] = []
    for (const t of getTicks(view, width, count, { minLabelPx: minPx, origin })) {
      const x = Math.round(stepToXPure(t.step, view, width)) + 0.5
      if (t.major) {
        major += `M${x} ${height - tick}v${tick}`
        labels.push({ step: t.step, x })
      } else {
        minor += `M${x} ${height - tick / 2}v${tick / 2}`
      }
    }
    return { major, minor, labels }
  }, [view, width, count, minPx, origin, height, tick])

  return (
    <div
      data-slot="scrubline-ruler"
      aria-hidden="true"
      className={cn("pointer-events-none relative overflow-hidden", className)}
      style={{ height }}
      {...props}
    >
      <svg className="absolute inset-0 size-full">
        <path d={minor} fill="none" className="stroke-muted-foreground/40" />
        <path d={major} fill="none" className="stroke-muted-foreground" />
      </svg>
      {labels.map((l) => (
        <span
          key={l.step}
          className={cn(
            "absolute top-0 tabular-nums text-muted-foreground",
            size === "sm" ? "text-[9px]" : "text-[10px]"
          )}
          style={{ left: l.x + 3, lineHeight: `${height - tick - 2}px` }}
        >
          {formatLabel(l.step)}
        </span>
      ))}
    </div>
  )
}

/* ------------------------------ Controls ---------------------------- */

const DEFAULT_LABELS = {
  prevStep: "Previous step",
  nextStep: "Next step",
  prevSegment: "Previous segment",
  nextSegment: "Next segment",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  fit: "Show all",
  reveal: "Show playhead",
  play: "Play",
  pause: "Pause",
}
export type ControlsLabels = typeof DEFAULT_LABELS

/** Opakowanie ikon SVG; użyj go do własnych ikon w tym samym stylu. */
export function ScrublineIcon({
  className,
  children,
  ...props
}: React.ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn("size-4 fill-none stroke-current stroke-2", className)}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  )
}

type IconProps = React.ComponentProps<"svg">
const mk = (paths: React.ReactNode) =>
  function Icon(props: IconProps) {
    return <ScrublineIcon {...props}>{paths}</ScrublineIcon>
  }

/** Domyślne ikony przycisków; można ich użyć we własnych <Control*>. */
export const ScrublineIcons = {
  PrevSegment: mk(<path d="M6 5v14M19 5l-9 7 9 7z" />),
  PrevStep: mk(<path d="M15 5l-7 7 7 7" />),
  NextStep: mk(<path d="M9 5l7 7-7 7" />),
  NextSegment: mk(<path d="M18 5v14M5 5l9 7-9 7z" />),
  ZoomOut: mk(
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4.5-4.5M8 11h6" />
    </>
  ),
  ZoomIn: mk(
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4.5-4.5M8 11h6M11 8v6" />
    </>
  ),
  Fit: mk(<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />),
  Reveal: mk(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
    </>
  ),
  Play: mk(<path d="M7 4.5v15l12-7.5z" />),
  Pause: mk(<path d="M8 5v14M16 5v14" />),
}

type ButtonProps = React.ComponentProps<"button">

/** Wspólny przycisk: domyślny aria-label/title, klasy scalone, handlery składane z użytkownika. */
function ControlButton({
  label,
  ours,
  className,
  children,
  ...props
}: ButtonProps & { label: string; ours?: object }) {
  const { size } = useScrublineContext()
  const name = props["aria-label"] ?? label
  return (
    <button
      type="button"
      aria-label={name}
      title={name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none",
        "hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "disabled:pointer-events-none disabled:opacity-40",
        className
      )}
      style={{ width: SIZES[size].btn, height: SIZES[size].btn }}
      {...mergeProps(ours ?? {}, props)}
    >
      {children}
    </button>
  )
}

/** Krok o `delta` z odsłonięciem głowicy; false, gdy dotarliśmy do krawędzi. */
function useStepper(dir: -1 | 1) {
  const { value, count, setValue, reveal } = useScrublineContext()
  const hold = useHoldRepeat((size) => {
    const next = Math.min(count - 1, Math.max(0, value + dir * size))
    setValue(next)
    reveal(next)
    return next > 0 && next < count - 1
  }, count)
  return { value, count, hold }
}

/* Przyciski kroku: przytrzymanie powtarza z przyspieszeniem (useHoldRepeat). */

export function ControlPrevStep({ children, ...props }: ButtonProps) {
  const { value, hold } = useStepper(-1)
  return (
    <ControlButton
      data-slot="scrubline-prev-step"
      label={DEFAULT_LABELS.prevStep}
      disabled={value <= 0}
      ours={hold}
      {...props}
    >
      {children ?? <ScrublineIcons.PrevStep />}
    </ControlButton>
  )
}

export function ControlNextStep({ children, ...props }: ButtonProps) {
  const { value, count, hold } = useStepper(1)
  return (
    <ControlButton
      data-slot="scrubline-next-step"
      label={DEFAULT_LABELS.nextStep}
      disabled={value >= count - 1}
      ours={hold}
      {...props}
    >
      {children ?? <ScrublineIcons.NextStep />}
    </ControlButton>
  )
}

function SegmentButton({
  direction,
  label,
  icon,
  slot,
  children,
  ...props
}: ButtonProps & { direction: -1 | 1; label: string; icon: React.ReactNode; slot: string }) {
  const { value, snapTo, setValue, reveal } = useScrublineContext()
  const target = snapTo ? neighbor(snapTo, value, direction) : null
  return (
    <ControlButton
      data-slot={slot}
      label={label}
      disabled={target === null}
      ours={{
        onClick: () => {
          if (target === null) return
          setValue(target)
          reveal(target)
        },
      }}
      {...props}
    >
      {children ?? icon}
    </ControlButton>
  )
}

export function ControlPrevSegment(props: ButtonProps) {
  return (
    <SegmentButton
      direction={-1}
      slot="scrubline-prev-segment"
      label={DEFAULT_LABELS.prevSegment}
      icon={<ScrublineIcons.PrevSegment />}
      {...props}
    />
  )
}

export function ControlNextSegment(props: ButtonProps) {
  return (
    <SegmentButton
      direction={1}
      slot="scrubline-next-segment"
      label={DEFAULT_LABELS.nextSegment}
      icon={<ScrublineIcons.NextSegment />}
      {...props}
    />
  )
}

export function ControlZoomIn({ children, ...props }: ButtonProps) {
  const { zoomBy } = useScrublineContext()
  return (
    <ControlButton
      data-slot="scrubline-zoom-in"
      label={DEFAULT_LABELS.zoomIn}
      ours={{ onClick: () => zoomBy(1.5) }}
      {...props}
    >
      {children ?? <ScrublineIcons.ZoomIn />}
    </ControlButton>
  )
}

export function ControlZoomOut({ children, ...props }: ButtonProps) {
  const { zoomBy } = useScrublineContext()
  return (
    <ControlButton
      data-slot="scrubline-zoom-out"
      label={DEFAULT_LABELS.zoomOut}
      ours={{ onClick: () => zoomBy(1 / 1.5) }}
      {...props}
    >
      {children ?? <ScrublineIcons.ZoomOut />}
    </ControlButton>
  )
}

export function ControlFit({ children, ...props }: ButtonProps) {
  const { fit } = useScrublineContext()
  return (
    <ControlButton
      data-slot="scrubline-fit"
      label={DEFAULT_LABELS.fit}
      ours={{ onClick: () => fit() }}
      {...props}
    >
      {children ?? <ScrublineIcons.Fit />}
    </ControlButton>
  )
}

export function ControlReveal({ children, ...props }: ButtonProps) {
  const { reveal } = useScrublineContext()
  return (
    <ControlButton
      data-slot="scrubline-reveal"
      label={DEFAULT_LABELS.reveal}
      ours={{ onClick: () => reveal() }}
      {...props}
    >
      {children ?? <ScrublineIcons.Reveal />}
    </ControlButton>
  )
}

/** Play/pauza. `children`: węzeł albo funkcja `(playing) => ReactNode`. */
export function ControlPlay({
  children,
  ...props
}: Omit<ButtonProps, "children"> & {
  children?: React.ReactNode | ((playing: boolean) => React.ReactNode)
}) {
  const { playing, togglePlay, count } = useScrublineContext()
  const content =
    typeof children === "function" ? children(playing) : children
  return (
    <ControlButton
      data-slot="scrubline-play"
      data-playing={playing || undefined}
      label={playing ? DEFAULT_LABELS.pause : DEFAULT_LABELS.play}
      disabled={count <= 1}
      ours={{ onClick: () => togglePlay() }}
      {...props}
    >
      {content ??
        (playing ? <ScrublineIcons.Pause /> : <ScrublineIcons.Play />)}
    </ControlButton>
  )
}

export function ControlPosition({
  formatPosition = (step) => String(step + 1),
  className,
  ...props
}: Omit<React.ComponentProps<"span">, "children"> & {
  formatPosition?: (step: number) => string
}) {
  const { value } = useScrublineContext()
  return (
    <span
      data-slot="scrubline-position"
      className={cn(
        "min-w-12 px-1 text-center text-xs tabular-nums text-muted-foreground",
        className
      )}
      {...props}
    >
      {formatPosition(value)}
    </span>
  )
}

/**
 * Pasek narzędzi. Z `children` renderuje je (składaj z Control*),
 * bez nich - domyślny zestaw (z `showPlay` także play/pauza).
 */
export function Controls({
  labels,
  formatPosition,
  showPlay = false,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  labels?: Partial<ControlsLabels>
  formatPosition?: (step: number) => string
  showPlay?: boolean
}) {
  const L = { ...DEFAULT_LABELS, ...labels }
  return (
    <div
      data-slot="scrubline-controls"
      role="toolbar"
      aria-label="Timeline controls"
      className={cn("flex flex-wrap items-center gap-0.5", className)}
      {...props}
    >
      {children ?? (
        <>
          <ControlPrevSegment aria-label={L.prevSegment} />
          <ControlPrevStep aria-label={L.prevStep} />
          <ControlPosition formatPosition={formatPosition} />
          <ControlNextStep aria-label={L.nextStep} />
          <ControlNextSegment aria-label={L.nextSegment} />
          {showPlay && <ControlPlay />}
          <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
          <ControlZoomOut aria-label={L.zoomOut} />
          <ControlZoomIn aria-label={L.zoomIn} />
          <ControlFit aria-label={L.fit} />
          <ControlReveal aria-label={L.reveal} />
        </>
      )}
    </div>
  )
}

/* ------------------------------ Minimap ----------------------------- */

const MIN_FRAME = 8 // px: minimalna szerokość ramki; tyle samo mają strefy brzegowe

type MinimapDrag = {
  mode: "move" | "left" | "right"
  startX: number
  view: View
}

/** Pasek całej osi z ramką bieżącego widoku. Własna szerokość i widok. */
export function Minimap({
  items,
  className,
  ...props
}: React.ComponentProps<"div"> & { items?: readonly Segment[] }) {
  const { view, count, size, zoomTo } = useScrublineContext()
  const height = SIZES[size].minimap
  const [el, setEl] = React.useState<HTMLDivElement | null>(null)
  const [w, setW] = React.useState(0)
  const drag = React.useRef<MinimapDrag | null>(null)

  React.useLayoutEffect(() => {
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setW(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [el])

  const fullView = React.useMemo<View>(() => ({ start: 0, end: count }), [count])
  const paths = React.useMemo(
    () =>
      w > 0 && items
        ? [...segmentPaths(items, 0, items.length, fullView, w, { height, gap: 0 })]
        : [],
    [items, fullView, w, height]
  )

  const frameLeft = axisToX(view.start, fullView, w)
  const frameWidth = Math.max(MIN_FRAME, (spanOf(view) * w) / count)
  const edge = Math.min(MIN_FRAME, frameWidth / 3)

  const axisAt = (e: React.PointerEvent<HTMLElement>) =>
    xToAxis(e.clientX - e.currentTarget.getBoundingClientRect().left, fullView, w)

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (w <= 0 || (e.pointerType === "mouse" && e.button !== 0)) return
    const x = e.clientX - e.currentTarget.getBoundingClientRect().left
    const span = spanOf(view)
    let mode: MinimapDrag["mode"] = "move"
    let base = view
    if (x >= frameLeft && x <= frameLeft + frameWidth) {
      if (x <= frameLeft + edge) mode = "left"
      else if (x >= frameLeft + frameWidth - edge) mode = "right"
    } else {
      // Klik poza ramką: wyśrodkuj widok i przeciągaj dalej.
      const c = axisAt(e)
      base = { start: c - span / 2, end: c + span / 2 }
      zoomTo(base)
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { mode, startX: e.clientX, view: base }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || w <= 0) return
    const dAxis = ((e.clientX - d.startX) / w) * count
    if (d.mode === "move")
      zoomTo({ start: d.view.start + dAxis, end: d.view.end + dAxis })
    else if (d.mode === "left")
      zoomTo({ start: Math.min(d.view.start + dAxis, d.view.end - 1), end: d.view.end })
    else
      zoomTo({ start: d.view.start, end: Math.max(d.view.end + dAxis, d.view.start + 1) })
  }

  const stop = (e: React.PointerEvent<HTMLDivElement>) => {
    drag.current = null
    e.currentTarget.releasePointerCapture?.(e.pointerId)
  }

  return (
    <div
      ref={setEl}
      data-slot="scrubline-minimap"
      aria-hidden="true"
      className={cn(
        "relative touch-none overflow-hidden rounded-md border bg-muted/40 select-none",
        className
      )}
      style={{ height }}
      {...mergeProps({ onPointerDown, onPointerMove, onPointerUp: stop, onPointerCancel: stop }, props)}
    >
      <svg className="pointer-events-none absolute inset-0 size-full">
        {paths.map(([color, d]) => (
          <path
            key={color}
            d={d}
            fill={color || undefined}
            className={color ? undefined : "fill-primary/60"}
          />
        ))}
      </svg>
      <div
        data-slot="scrubline-minimap-frame"
        className="absolute inset-y-0 cursor-grab rounded-sm border-2 border-primary bg-primary/10 active:cursor-grabbing"
        style={{ left: frameLeft, width: frameWidth }}
      >
        <div className="absolute inset-y-0 left-0 cursor-ew-resize" style={{ width: edge }} />
        <div className="absolute inset-y-0 right-0 cursor-ew-resize" style={{ width: edge }} />
      </div>
    </div>
  )
}

/* ------------------------------- Track ------------------------------ */

export function Track({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="scrubline-track"
      className={cn("relative flex flex-col gap-px py-1", className)}
      {...props}
    />
  )
}
