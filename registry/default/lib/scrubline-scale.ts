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
