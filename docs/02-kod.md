# 2. Kod: najtrudniejsze części

Trzy pliki do wklejenia w całości. Wszystko, czego tu nie ma (Ruler, Minimap, Controls, testy, przykłady), jest rozpisane w [TODO.md](TODO.md).

Podział odpowiedzialności:

| Plik | Odpowiada za | Zna Reacta | Zna DOM |
| --- | --- | --- | --- |
| `lib/scrubline-scale.ts` | przeliczenia, zoom, podziałka, ścieżki SVG | nie | nie |
| `hooks/use-scrubline.ts` | stan, gesty, klawiatura | tak | tak |
| `ui/scrubline.tsx` | rysowanie, klasy Tailwind, ARIA | tak | tylko JSX |

## 2.1. `registry/default/lib/scrubline-scale.ts`

Co tu jest trudne:

- `zoomAround`: punkt pod kursorem zostaje pod tym samym pikselem, także przy limitach i krawędziach osi.
- `getTicks`: gęstość 1, 2, 5 × 10ⁿ, kreski pomocnicze, `origin`. Liczba kresek zależy od szerokości w pikselach, nie od `count`.
- `segmentPaths` i `markerPaths`: to one dają wydajność przy 10 000+ elementów. Wynik to kilka ścieżek SVG, których długość ogranicza szerokość ekranu.
- `visibleRange`: wyszukiwanie binarne, więc koszt renderu to O(log n + widoczne).

```ts
/**
 * scrubline-scale.ts: czysta matematyka osi. Zero Reacta, zero DOM.
 *
 * Konwencja (obowiązuje w całym komponencie):
 * - Oś ma dziedzinę [0, count]. Krok `i` to komórka [i, i + 1).
 * - Głowica, podziałka i znaczniki stoją na ŚRODKU komórki (i + 0.5).
 * - Odcinek { start, end } zajmuje komórki start..end-1 (end wyłączny),
 *   więc rysuje się od krawędzi `start` do krawędzi `end`.
 * - View to zakres osi w jednostkach kroków (liczby zmiennoprzecinkowe).
 */

export interface View {
  start: number
  end: number
}

export interface Segment {
  id: string
  start: number
  /** Wyłączny. */
  end: number
  color?: string
  label?: string
}

export interface Marker {
  at: number
  variant?: string
  label?: string
}

export interface ZoomLimits {
  minSpan: number
  maxSpan: number
}

export const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v))

export const spanOf = (view: View) => view.end - view.start

export const pxPerStep = (view: View, width: number) => width / spanOf(view)

/** Pozycja na osi (krawędź, float) -> piksel. */
export const axisToX = (pos: number, view: View, width: number) =>
  (pos - view.start) * pxPerStep(view, width)

/** Piksel -> pozycja na osi (float). */
export const xToAxis = (x: number, view: View, width: number) =>
  view.start + x / pxPerStep(view, width)

/** Krok -> piksel środka jego komórki. */
export const stepToX = (step: number, view: View, width: number) =>
  axisToX(step + 0.5, view, width)

/** Piksel -> krok (komórka pod kursorem), zawsze w [0, count - 1]. */
export const xToStep = (x: number, view: View, width: number, count: number) =>
  clamp(Math.floor(xToAxis(x, view, width)), 0, count - 1)

/* ------------------------------------------------------------------ */
/* Widok: limity, zoom, przesuwanie                                    */
/* ------------------------------------------------------------------ */

export function zoomLimits(
  count: number,
  width: number,
  maxPxPerStep = 48
): ZoomLimits {
  const maxSpan = Math.max(1, count)
  // Najbliższy zoom: krok ma najwyżej maxPxPerStep pikseli szerokości.
  const minSpan = clamp(width / maxPxPerStep, 1, maxSpan)
  return { minSpan, maxSpan }
}

/** Wciska widok w [0, count] i w limity zoomu, zachowując jego środek. */
export function clampView(view: View, count: number, limits: ZoomLimits): View {
  const raw = spanOf(view)
  if (!Number.isFinite(raw) || raw <= 0) return { start: 0, end: count }
  const span = clamp(raw, limits.minSpan, limits.maxSpan)
  const center = (view.start + view.end) / 2
  const start = clamp(center - span / 2, 0, Math.max(0, count - span))
  return { start, end: start + span }
}

/**
 * Zoom wokół punktu: pozycja `anchor` (na osi) zostaje pod tym samym
 * pikselem. factor > 1 przybliża, < 1 oddala.
 */
export function zoomAround(
  view: View,
  factor: number,
  anchor: number,
  count: number,
  limits: ZoomLimits
): View {
  const span = spanOf(view)
  const next = clamp(span / factor, limits.minSpan, limits.maxSpan)
  const t = (anchor - view.start) / span // 0..1: gdzie kotwica leży w widoku
  const start = clamp(anchor - t * next, 0, Math.max(0, count - next))
  return { start, end: start + next }
}

export function panBy(view: View, deltaSteps: number, count: number): View {
  const span = spanOf(view)
  const start = clamp(view.start + deltaSteps, 0, Math.max(0, count - span))
  return { start, end: start + span }
}

/** Minimalne przesunięcie widoku, żeby krok był widoczny (z marginesem). */
export function reveal(
  view: View,
  step: number,
  count: number,
  padding = 0.1
): View {
  const span = spanOf(view)
  const pad = span * padding
  const pos = step + 0.5
  if (pos < view.start + pad) return panBy(view, pos - pad - view.start, count)
  if (pos > view.end - pad) return panBy(view, pos + pad - view.end, count)
  return view
}

/* ------------------------------------------------------------------ */
/* Podziałka                                                           */
/* ------------------------------------------------------------------ */

/** Najmniejsza "ładna" liczba całkowita (1, 2, 5 x 10^n) >= raw. */
export function niceStep(raw: number): number {
  if (!(raw > 1)) return 1
  const pow = 10 ** Math.floor(Math.log10(raw))
  const n = raw / pow
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow
}

export interface Tick {
  step: number
  major: boolean
}

export interface TickOptions {
  /** Minimalny odstęp podpisów w px. Podaj szerokość najdłuższego podpisu + margines. */
  minLabelPx?: number
  /** Minimalny odstęp kresek pomocniczych w px. */
  minMinorPx?: number
  /**
   * Przesunięcie numeracji. Przy podpisach `step + 1` ustaw origin = 1,
   * wtedy kreski główne wypadną na 10, 20, 30, a nie na 11, 21, 31.
   */
  origin?: number
}

/**
 * Kreski widoczne w widoku. Liczba wyników zależy od szerokości w px,
 * nie od count, więc działa tak samo dla 100 i 10 000 000 kroków.
 */
export function getTicks(
  view: View,
  width: number,
  count: number,
  { minLabelPx = 64, minMinorPx = 6, origin = 0 }: TickOptions = {}
): Tick[] {
  if (width <= 0 || count <= 0) return []
  const pps = pxPerStep(view, width)
  const major = niceStep(minLabelPx / pps)
  const lead = Math.round(major / 10 ** Math.floor(Math.log10(major))) // 1 | 2 | 5
  let minor = lead === 2 ? major / 2 : major / 5
  if (!Number.isInteger(minor) || minor * pps < minMinorPx) minor = major

  const ticks: Tick[] = []
  // n = numer z podpisu (step + origin); kreska stoi na środku komórki.
  let n = Math.ceil((view.start - 0.5 + origin) / minor) * minor
  for (; n - origin + 0.5 <= view.end; n += minor) {
    const step = n - origin
    if (step < 0 || step > count - 1) continue
    ticks.push({ step, major: n % major === 0 })
  }
  return ticks
}

/* ------------------------------------------------------------------ */
/* Wyszukiwanie binarne, przyciąganie                                  */
/* ------------------------------------------------------------------ */

/** Pierwszy indeks w [0, n), dla którego pred jest true (pred monotoniczny). */
export function lowerBound(n: number, pred: (i: number) => boolean): number {
  let lo = 0
  let hi = n
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (pred(mid)) hi = mid
    else lo = mid + 1
  }
  return lo
}

/**
 * Zakres [lo, hi) odcinków przecinających widok.
 * WYMAGA: items posortowane po start i nienachodzące na siebie.
 */
export function visibleRange(
  items: readonly Segment[],
  view: View
): [number, number] {
  const lo = lowerBound(items.length, (i) => items[i].end > view.start)
  const hi = lowerBound(items.length, (i) => items[i].start >= view.end)
  return [lo, Math.max(lo, hi)]
}

/** Najbliższy cel w zasięgu maxDist albo null. targets posortowane rosnąco. */
export function snap(
  targets: readonly number[],
  pos: number,
  maxDist: number
): number | null {
  if (targets.length === 0) return null
  const i = lowerBound(targets.length, (k) => targets[k] >= pos)
  let best: number | null = null
  for (const k of [i - 1, i]) {
    const t = targets[k]
    if (t === undefined || Math.abs(t - pos) > maxDist) continue
    if (best === null || Math.abs(t - pos) < Math.abs(best - pos)) best = t
  }
  return best
}

/** Poprzedni (dir = -1) lub następny (dir = 1) cel względem value, albo null. */
export function neighbor(
  targets: readonly number[],
  value: number,
  dir: -1 | 1
): number | null {
  const i =
    dir === 1
      ? lowerBound(targets.length, (k) => targets[k] > value)
      : lowerBound(targets.length, (k) => targets[k] >= value) - 1
  return targets[i] ?? null
}

/* ------------------------------------------------------------------ */
/* Ścieżki SVG                                                         */
/* ------------------------------------------------------------------ */

const r = (n: number) => Math.round(n * 100) / 100

/**
 * Jedna ścieżka SVG na kolor zamiast jednego elementu na odcinek.
 *
 * Sedno wydajności: z odcinków węższych niż 1 px rysowany jest jeden
 * na kolumnę pikseli, a stykające się prostokąty tego samego koloru są
 * sklejane. Długość ścieżek zależy więc od szerokości w px, a nie od
 * liczby odcinków. Klucz mapy: kolor ("" = domyślny).
 */
export function segmentPaths(
  items: readonly Segment[],
  lo: number,
  hi: number,
  view: View,
  width: number,
  { height, gap = 1 }: { height: number; gap?: number }
): Map<string, string> {
  const out = new Map<string, string>()
  const runs = new Map<string, { x0: number; x1: number }>()
  let lastColumn = -1

  const flush = (color: string, run: { x0: number; x1: number }) => {
    const w = r(run.x1 - run.x0)
    out.set(color, (out.get(color) ?? "") + `M${r(run.x0)} 0h${w}v${height}h${-w}z`)
  }

  for (let i = lo; i < hi; i++) {
    const s = items[i]
    const color = s.color ?? ""
    let x0 = clamp(axisToX(s.start, view, width), 0, width)
    let x1 = clamp(axisToX(s.end, view, width), 0, width)
    if (x1 - x0 >= 1) {
      // Szerokie odcinki dostają przerwę między sobą.
      if (x1 - x0 > gap * 3) x1 -= gap
    } else {
      // Odcinek węższy niż piksel: jedna kolumna pikseli = jeden odcinek
      // (pierwszy, który w nią trafi). Reszta jest pomijana.
      x0 = Math.floor(x0)
      if (x0 === lastColumn) continue
      lastColumn = x0
      x1 = x0 + 1
    }

    const run = runs.get(color)
    if (run && x0 <= run.x1 + 0.25) {
      run.x1 = Math.max(run.x1, x1) // styka się z poprzednim: sklej
    } else {
      if (run) flush(color, run)
      runs.set(color, { x0, x1 })
    }
  }
  runs.forEach((run, color) => flush(color, run))
  return out
}

/**
 * Jedna ścieżka na wariant. Znaczniki trafiające w tę samą kolumnę
 * pikseli są rysowane raz. WYMAGA: items posortowane po `at`.
 */
export function markerPaths(
  items: readonly Marker[],
  view: View,
  width: number,
  heightOf: (variant: string) => number
): Map<string, string> {
  const out = new Map<string, string>()
  const lastX = new Map<string, number>()
  const lo = lowerBound(items.length, (i) => items[i].at + 1 > view.start)
  const hi = lowerBound(items.length, (i) => items[i].at >= view.end)
  for (let i = lo; i < hi; i++) {
    const variant = items[i].variant ?? "default"
    const x = Math.round(stepToX(items[i].at, view, width)) + 0.5
    if (lastX.get(variant) === x) continue
    lastX.set(variant, x)
    out.set(variant, (out.get(variant) ?? "") + `M${x} 0v${heightOf(variant)}`)
  }
  return out
}
```

## 2.2. `registry/default/hooks/use-scrubline.ts`

Co tu jest trudne:

- **Kółko**: listener natywny z `passive: false`, bo inaczej `preventDefault()` nie działa i Ctrl + kółko zoomuje całą stronę. Szczypanie na touchpadzie przychodzi jako `wheel` z `ctrlKey`.
- **Jedna maszyna stanów dla tła**: `press → pan` po przekroczeniu progu, `press → klik` bez ruchu, dwa wskaźniki to `pinch`, a po puszczeniu jednego palca gest przechodzi w `pan` bez fałszywego kliku.
- **Świeży stan między renderami**: refy aktualizowane od razu w setterze, bo kilka zdarzeń `pointermove` przychodzi przed kolejnym renderem.
- **Przeciąganie przy krawędzi**: pętla `requestAnimationFrame` działa tylko, gdy wskaźnik stoi w strefie krawędzi, i po każdym przesunięciu widoku przelicza krok pod wskaźnikiem.

```ts
"use client"

import * as React from "react"

import {
  clamp,
  clampView,
  neighbor,
  panBy as panView,
  pxPerStep,
  reveal as revealView,
  snap,
  spanOf,
  stepToX as stepToXPure,
  xToAxis,
  xToStep as xToStepPure,
  zoomAround,
  zoomLimits,
  type View,
} from "@/registry/default/lib/scrubline-scale"

const ZOOM_SPEED = 0.005 // czułość Ctrl + kółko / szczypania na touchpadzie
const DRAG_THRESHOLD = 4 // px: poniżej to klik, powyżej przeciąganie tła
const EDGE = 32 // px: strefa przy krawędzi, w której widok sam się przesuwa
const EDGE_SPEED = 0.3 // px przesunięcia na klatkę na każdy px wejścia w strefę

export interface UseScrublineOptions {
  count: number
  value?: number
  defaultValue?: number
  onValueChange?: (value: number) => void
  view?: View
  defaultView?: View
  onViewChange?: (view: View) => void
  /** Limit przybliżenia. */
  maxPxPerStep?: number
  /** Posortowane kroki, do których głowica się przyciąga (granice odcinków, znaczniki). */
  snapTo?: readonly number[]
  /** Zasięg przyciągania w px. */
  snapPx?: number
  /** Przesuwanie widoku, gdy głowica jest ciągnięta przy krawędzi. */
  edgeScroll?: boolean
}

/**
 * Stan sterowany lub wewnętrzny (jak w Radix).
 * Ref jest aktualizowany od razu w set(), bo kilka zdarzeń wskaźnika
 * może przyjść przed kolejnym renderem i każde musi widzieć świeży stan.
 */
function useControllable<T>(
  controlled: T | undefined,
  initial: T,
  onChange: ((v: T) => void) | undefined,
  equal: (a: T, b: T) => boolean
) {
  const [inner, setInner] = React.useState(initial)
  const isControlled = controlled !== undefined
  const value = isControlled ? controlled : inner
  const ref = React.useRef(value)
  ref.current = value
  const onChangeRef = React.useRef(onChange)
  onChangeRef.current = onChange

  const set = React.useCallback(
    (next: T) => {
      if (equal(ref.current, next)) return
      ref.current = next
      if (!isControlled) setInner(next)
      onChangeRef.current?.(next)
    },
    [isControlled, equal]
  )
  return [value, set, ref] as const
}

const sameView = (a: View, b: View) => a.start === b.start && a.end === b.end

export function useScrubline(options: UseScrublineOptions) {
  const {
    count,
    maxPxPerStep = 48,
    snapTo,
    snapPx = 8,
    edgeScroll = true,
  } = options

  const [viewportEl, setViewportEl] = React.useState<HTMLElement | null>(null)
  const [width, setWidth] = React.useState(0)
  const [dragging, setDragging] = React.useState(false)

  const [value, setValueRaw, valueRef] = useControllable<number>(
    options.value,
    options.defaultValue ?? 0,
    options.onValueChange,
    Object.is
  )
  const [view, setViewRaw, viewRef] = useControllable<View>(
    options.view,
    options.defaultView ?? { start: 0, end: count },
    options.onViewChange,
    sameView
  )

  // Wszystko, czego potrzebują handlery, w jednym refie: dzięki temu
  // funkcje API są stabilne i nie trzeba przepinać listenerów.
  const limits = React.useMemo(
    () => zoomLimits(count, width, maxPxPerStep),
    [count, width, maxPxPerStep]
  )
  const latest = React.useRef({ count, width, limits, snapTo, snapPx, edgeScroll })
  latest.current = { count, width, limits, snapTo, snapPx, edgeScroll }

  /* ------------------------------ API ------------------------------ */

  const api = React.useMemo(() => {
    const L = () => latest.current
    const setView = (next: View) => {
      if (L().width <= 0) return
      setViewRaw(clampView(next, L().count, L().limits))
    }
    return {
      setValue: (step: number) =>
        setValueRaw(clamp(Math.round(step), 0, L().count - 1)),
      zoomTo: setView,
      /** anchorX w px względem viewportu; domyślnie środek. */
      zoomBy: (factor: number, anchorX = L().width / 2) => {
        const v = viewRef.current
        const anchor = xToAxis(anchorX, v, L().width)
        setView(zoomAround(v, factor, anchor, L().count, L().limits))
      },
      panBy: (steps: number) =>
        setView(panView(viewRef.current, steps, L().count)),
      fit: () => setView({ start: 0, end: L().count }),
      reveal: (step: number = valueRef.current) =>
        setView(revealView(viewRef.current, step, L().count)),
      stepToX: (step: number) => stepToXPure(step, viewRef.current, L().width),
      xToStep: (x: number) =>
        xToStepPure(x, viewRef.current, L().width, L().count),
    }
  }, [setValueRaw, setViewRaw, viewRef, valueRef])

  /* --------------------------- Rozmiar ----------------------------- */

  React.useLayoutEffect(() => {
    if (!viewportEl) return
    const ro = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width)
    )
    ro.observe(viewportEl)
    return () => ro.disconnect()
  }, [viewportEl])

  // Zmiana szerokości lub count mogła wypchnąć widok poza limity.
  React.useEffect(() => {
    if (width > 0) setViewRaw(clampView(viewRef.current, count, limits))
  }, [width, count, limits, setViewRaw, viewRef])

  /* ---------------------------- Kółko ------------------------------ */

  // Natywny listener, bo React rejestruje wheel jako passive
  // i preventDefault() by nie zadziałał (strona by się zoomowała).
  React.useEffect(() => {
    if (!viewportEl) return
    const onWheel = (e: WheelEvent) => {
      const unit =
        e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? viewportEl.clientWidth : 1
      const dx = e.deltaX * unit
      const dy = e.deltaY * unit

      // Ctrl/Cmd + kółko. Szczypanie na touchpadzie też przychodzi
      // jako wheel z ctrlKey = true (Chrome, Firefox, Edge).
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const x = e.clientX - viewportEl.getBoundingClientRect().left
        api.zoomBy(Math.exp(-clamp(dy, -100, 100) * ZOOM_SPEED), x)
        return
      }

      // Przesuwamy tylko przy ruchu poziomym albo z Shiftem.
      // Zwykłe pionowe kółko zostaje dla strony.
      const pan = e.shiftKey ? dx || dy : Math.abs(dx) > Math.abs(dy) ? dx : 0
      if (pan === 0) return
      e.preventDefault()
      api.panBy(pan / pxPerStep(viewRef.current, latest.current.width))
    }
    viewportEl.addEventListener("wheel", onWheel, { passive: false })
    return () => viewportEl.removeEventListener("wheel", onWheel)
  }, [viewportEl, api, viewRef])

  /* ------------------- Tło: klik, przesuwanie, pinch ---------------- */

  type Pt = { x: number; y: number }
  type Gesture =
    | { kind: "idle" }
    | { kind: "press"; startX: number; lastX: number } // jeszcze nie wiadomo: klik czy pan
    | { kind: "pan"; lastX: number }
    | { kind: "pinch"; dist: number; mid: number }

  const pointers = React.useRef(new Map<number, Pt>())
  const gesture = React.useRef<Gesture>({ kind: "idle" })

  const viewportProps = React.useMemo(() => {
    const left = (el: Element) => el.getBoundingClientRect().left
    const pinchState = (el: Element): Gesture => {
      const [a, b] = [...pointers.current.values()]
      return {
        kind: "pinch",
        dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        mid: (a.x + b.x) / 2 - left(el),
      }
    }
    const pps = () => pxPerStep(viewRef.current, latest.current.width)

    const end = (e: React.PointerEvent<HTMLElement>) => {
      if (!pointers.current.delete(e.pointerId)) return
      const g = gesture.current
      if (g.kind === "press" && e.type === "pointerup") {
        // Palec/mysz się nie ruszyły: to klik, przenieś głowicę.
        api.setValue(api.xToStep(e.clientX - left(e.currentTarget)))
      }
      const rest = [...pointers.current.values()]
      // Po pinchu zostaje jeden palec: kontynuuj jako pan (bez kliku na końcu).
      gesture.current =
        rest.length === 1 ? { kind: "pan", lastX: rest[0].x } : { kind: "idle" }
    }

    return {
      onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
        if (e.pointerType === "mouse" && e.button !== 0) return
        e.currentTarget.setPointerCapture(e.pointerId)
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
        const n = pointers.current.size
        if (n === 1)
          gesture.current = { kind: "press", startX: e.clientX, lastX: e.clientX }
        else if (n === 2) gesture.current = pinchState(e.currentTarget)
      },
      onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
        if (!pointers.current.has(e.pointerId)) return
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
        let g = gesture.current

        if (g.kind === "pinch" && pointers.current.size === 2) {
          const next = pinchState(e.currentTarget)
          if (next.kind !== "pinch") return
          // Najpierw przesunięcie o ruch środka, potem zoom wokół środka.
          api.panBy(-(next.mid - g.mid) / pps())
          api.zoomBy(next.dist / g.dist, next.mid)
          gesture.current = next
          return
        }
        if (g.kind === "press" && Math.abs(e.clientX - g.startX) > DRAG_THRESHOLD) {
          g = gesture.current = { kind: "pan", lastX: g.lastX }
        }
        if (g.kind === "pan") {
          api.panBy(-(e.clientX - g.lastX) / pps())
          g.lastX = e.clientX
        }
      },
      onPointerUp: end,
      onPointerCancel: end,
    }
  }, [api, viewRef])

  /* ---------------------------- Głowica ----------------------------- */

  const drag = React.useRef<{ clientX: number; el: Element; raf: number } | null>(null)

  const playheadProps = React.useMemo(() => {
    /** Ustawia wartość z pozycji wskaźnika, z przyciąganiem. */
    const apply = () => {
      const d = drag.current
      if (!d) return
      const { width, count, snapTo, snapPx } = latest.current
      const v = viewRef.current
      const x = clamp(d.clientX - d.el.getBoundingClientRect().left, 0, width)
      const pos = xToAxis(x, v, width)
      const snapped = snapTo
        ? snap(snapTo, pos - 0.5, snapPx / pxPerStep(v, width))
        : null
      api.setValue(snapped ?? xToStepPure(x, v, width, count))
    }

    /** Pętla rAF: działa tylko wtedy, gdy wskaźnik stoi w strefie krawędzi. */
    const tick = () => {
      const d = drag.current
      if (!d) return
      const { width } = latest.current
      const x = d.clientX - d.el.getBoundingClientRect().left
      const over = x < EDGE ? x - EDGE : x > width - EDGE ? x - (width - EDGE) : 0
      if (over === 0) {
        d.raf = 0
        return
      }
      const px = clamp(over, -EDGE * 3, EDGE * 3) * EDGE_SPEED
      api.panBy(px / pxPerStep(viewRef.current, width))
      apply() // widok się przesunął, więc pod wskaźnikiem jest już inny krok
      d.raf = requestAnimationFrame(tick)
    }

    const stop = (e: React.PointerEvent<HTMLElement>) => {
      if (!drag.current) return
      cancelAnimationFrame(drag.current.raf)
      drag.current = null
      setDragging(false)
      e.currentTarget.releasePointerCapture?.(e.pointerId)
    }

    return {
      onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
        if (e.pointerType === "mouse" && e.button !== 0) return
        e.stopPropagation() // inaczej viewport zacząłby przesuwanie tła
        const v = viewRef.current
        const pos = valueRef.current + 0.5
        if (pos < v.start || pos > v.end) {
          api.reveal() // głowica poza widokiem działa jak strzałka "pokaż mnie"
          return
        }
        const viewport = e.currentTarget.offsetParent ?? e.currentTarget
        e.currentTarget.setPointerCapture(e.pointerId)
        drag.current = { clientX: e.clientX, el: viewport, raf: 0 }
        setDragging(true)
      },
      onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
        const d = drag.current
        if (!d) return
        d.clientX = e.clientX
        apply()
        if (latest.current.edgeScroll && d.raf === 0)
          d.raf = requestAnimationFrame(tick)
      },
      onPointerUp: stop,
      onPointerCancel: stop,
      onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
        const { count, snapTo } = latest.current
        const cur = valueRef.current
        const page = Math.max(1, Math.floor(spanOf(viewRef.current)))
        const jump = (dir: -1 | 1) =>
          (snapTo && neighbor(snapTo, cur, dir)) ?? (dir === 1 ? count - 1 : 0)

        let next: number | null = null
        switch (e.key) {
          case "ArrowLeft":
            next = e.shiftKey ? jump(-1) : cur - 1
            break
          case "ArrowRight":
            next = e.shiftKey ? jump(1) : cur + 1
            break
          case "Home":
            next = 0
            break
          case "End":
            next = count - 1
            break
          case "PageUp":
            next = cur - page
            break
          case "PageDown":
            next = cur + page
            break
          case "+":
          case "=":
            api.zoomBy(1.5, api.stepToX(cur))
            break
          case "-":
            api.zoomBy(1 / 1.5, api.stepToX(cur))
            break
          case "0":
            api.fit()
            break
          default:
            return
        }
        e.preventDefault()
        if (next !== null) {
          api.setValue(next)
          api.reveal(clamp(next, 0, count - 1))
        }
      },
    }
  }, [api, viewRef, valueRef])

  React.useEffect(
    () => () => {
      if (drag.current) cancelAnimationFrame(drag.current.raf)
    },
    []
  )

  return {
    ...api,
    count,
    value,
    view,
    width,
    dragging,
    viewportRef: setViewportEl,
    viewportProps,
    playheadProps,
  }
}

export type ScrublineApi = ReturnType<typeof useScrubline>
```

## 2.3. `registry/default/ui/scrubline.tsx` (trzon)

Gotowe: kontekst, `Root`, `Viewport`, `Track`, `Segments`, `Markers`, `Playhead`. Do dopisania według TODO.md: `Ruler`, `Minimap`, `Controls`.

Co tu jest trudne:

- `Segments`: ścieżki SVG na kolor plus podpisy tylko dla odcinków szerszych niż `minLabelPx`, więc liczba elementów DOM jest ograniczona szerokością.
- `Playhead`: `role="slider"`, pole chwytu 24 px przy linii 2 px, stan `data-offscreen`.
- Klasa `touch-pan-y` na `Viewport` i `touch-none` na głowicy: bez nich przeglądarka przejmuje gesty dotykowe.

```tsx
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
```

## 2.4. Wzorzec dla pozostałych części

Każda nowa część wygląda tak samo: bierze stan z `useScrublineContext()`, liczy geometrię funkcją ze `scrubline-scale.ts` w `useMemo` i rysuje. Żadna część nie trzyma własnego stanu widoku ani nie liczy pikseli "ręcznie". Jeśli brakuje funkcji, dopisuje się ją w `scrubline-scale.ts` razem z testem.
