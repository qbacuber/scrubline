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
