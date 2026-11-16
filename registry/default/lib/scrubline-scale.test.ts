import { describe, it, expect } from "vitest"
import {
  stepToX,
  xToStep,
  zoomLimits,
  zoomAround,
  clampView,
  panBy,
  reveal,
  niceStep,
  getTicks,
  lowerBound,
  visibleRange,
  snap,
  neighbor,
  segmentPaths,
  markerPaths,
  segmentAt,
  markerAt,
  holdStepSize,
  HOLD_DELAY_MS,
  HOLD_RAMP_MS,
  type Segment,
  type Marker,
  type View,
} from "@/registry/default/lib/scrubline-scale"

/* Deterministyczny generator (LCG), żeby testy losowe były powtarzalne. */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

const countMoves = (d: string) => d.split("M").length - 1

describe("stepToX / xToStep", () => {
  it("stawia krok na środku jego komórki", () => {
    const view = { start: 0, end: 10 }
    expect(stepToX(0, view, 100)).toBe(5)
    expect(stepToX(3, view, 100)).toBe(35)
    expect(xToStep(35, view, 100, 10)).toBe(3)
  })

  it("xToStep dla krawędzi osi", () => {
    const view = { start: 0, end: 10 }
    expect(xToStep(0, view, 100, 10)).toBe(0)
    expect(xToStep(99, view, 100, 10)).toBe(9)

    const shifted = { start: 5, end: 15 }
    expect(xToStep(0, shifted, 100, 20)).toBe(5)
    expect(xToStep(99, shifted, 100, 20)).toBe(14)
  })

  it("wynik zawsze mieści się w [0, count - 1]", () => {
    const view = { start: -5, end: 5 }
    expect(xToStep(-1000, view, 100, 10)).toBe(0)
    expect(xToStep(-1, view, 100, 10)).toBe(0)
    expect(xToStep(10_000, view, 100, 10)).toBe(9)
  })

  it("xToStep(stepToX(i)) === i dla losowych widoków", () => {
    const rand = rng(42)
    for (let k = 0; k < 200; k++) {
      const count = 1 + Math.floor(rand() * 5000)
      const width = 100 + Math.floor(rand() * 1900)
      const span = 1 + rand() * (count - 1)
      const start = rand() * (count - span)
      const view: View = { start, end: start + span }
      for (let j = 0; j < 50; j++) {
        const i = Math.floor(rand() * count)
        expect(xToStep(stepToX(i, view, width), view, width, count)).toBe(i)
      }
    }
  })
})

describe("zoomAround", () => {
  it("kotwica zostaje pod tym samym pikselem", () => {
    const count = 100
    const width = 400
    const limits = zoomLimits(count, width)
    const view = { start: 40, end: 60 }
    const rand = rng(7)
    for (let k = 0; k < 100; k++) {
      const anchor = 42 + rand() * 16
      const factor = 0.7 + rand() * 1.6
      const next = zoomAround(view, factor, anchor, count, limits)
      const before = (anchor - view.start) * (width / (view.end - view.start))
      const after = (anchor - next.start) * (width / (next.end - next.start))
      expect(Math.abs(before - after)).toBeLessThan(1e-6)
    }
  })

  it("kotwica na lewej krawędzi", () => {
    const count = 100
    const width = 200
    const limits = zoomLimits(count, width)
    const view = { start: 20, end: 40 }
    const next = zoomAround(view, 2, 20, count, limits)
    expect(next).toEqual({ start: 20, end: 30 })
    expect(axisToXLocal(20, next, width)).toBe(0)
  })

  it("kotwica na prawej krawędzi", () => {
    const count = 100
    const width = 200
    const limits = zoomLimits(count, width)
    const view = { start: 20, end: 40 }
    const next = zoomAround(view, 2, 40, count, limits)
    expect(next).toEqual({ start: 30, end: 40 })
    expect(axisToXLocal(40, next, width)).toBe(200)
  })

  it("ogromny factor zatrzymuje się na minSpan", () => {
    const count = 100
    const width = 480
    const limits = zoomLimits(count, width)
    const next = zoomAround({ start: 30, end: 70 }, 1e9, 50, count, limits)
    expect(next.end - next.start).toBeCloseTo(limits.minSpan, 9)
    expect(limits.minSpan).toBe(10)
    expect(next).toEqual({ start: 45, end: 55 })
  })

  it("factor bliski zera daje cały zakres { 0, count }", () => {
    const count = 100
    const limits = zoomLimits(count, 480)
    const next = zoomAround({ start: 30, end: 70 }, 1e-9, 50, count, limits)
    expect(next).toEqual({ start: 0, end: count })
  })
})

describe("clampView", () => {
  const count = 100
  const limits = zoomLimits(count, 480) // minSpan 10, maxSpan 100

  it("ujemny start jest przesuwany do 0", () => {
    expect(clampView({ start: -5, end: 5 }, count, limits)).toEqual({
      start: 0,
      end: 10,
    })
  })

  it("end większy niż count jest przesuwany do count", () => {
    expect(clampView({ start: 95, end: 105 }, count, limits)).toEqual({
      start: 90,
      end: 100,
    })
  })

  it("rozpiętość większa niż count daje pełny widok", () => {
    expect(clampView({ start: -20, end: 150 }, count, limits)).toEqual({
      start: 0,
      end: count,
    })
  })

  it("NaN i rozpiętość <= 0 dają pełny widok", () => {
    expect(clampView({ start: NaN, end: 10 }, count, limits)).toEqual({
      start: 0,
      end: count,
    })
    expect(clampView({ start: 5, end: 5 }, count, limits)).toEqual({
      start: 0,
      end: count,
    })
    expect(clampView({ start: 10, end: 5 }, count, limits)).toEqual({
      start: 0,
      end: count,
    })
  })

  it("zachowuje środek, gdy jest miejsce", () => {
    expect(clampView({ start: 40, end: 60 }, count, limits)).toEqual({
      start: 40,
      end: 60,
    })
  })

  it("rozpiętość mniejsza niż minSpan jest podbijana, środek zachowany", () => {
    const next = clampView({ start: 40, end: 41 }, count, limits)
    expect(next.end - next.start).toBe(limits.minSpan)
    expect((next.start + next.end) / 2).toBe(40.5)
  })
})

describe("panBy", () => {
  it("zatrzymuje się na lewym krańcu", () => {
    expect(panBy({ start: 10, end: 20 }, -50, 100)).toEqual({ start: 0, end: 10 })
  })

  it("zatrzymuje się na prawym krańcu", () => {
    expect(panBy({ start: 10, end: 20 }, 500, 100)).toEqual({
      start: 90,
      end: 100,
    })
  })

  it("nie zmienia rozpiętości", () => {
    const next = panBy({ start: 10, end: 20 }, 7, 100)
    expect(next).toEqual({ start: 17, end: 27 })
    expect(next.end - next.start).toBe(10)
  })
})

describe("reveal", () => {
  it("krok widoczny zwraca ten sam obiekt", () => {
    const view = { start: 0, end: 100 }
    expect(reveal(view, 50, 100)).toBe(view)
  })

  it("krok z lewej przesuwa widok tak, by krok był widoczny z marginesem", () => {
    const view = { start: 40, end: 60 }
    expect(reveal(view, 10, 100)).toEqual({ start: 8.5, end: 28.5 })
  })

  it("krok z prawej przesuwa widok tak, by krok był widoczny z marginesem", () => {
    const view = { start: 40, end: 60 }
    expect(reveal(view, 90, 100)).toEqual({ start: 72.5, end: 92.5 })
  })

  it("krok 0 i krok count - 1 zatrzymują się na krawędzi osi", () => {
    expect(reveal({ start: 50, end: 60 }, 0, 100)).toEqual({ start: 0, end: 10 })
    expect(reveal({ start: 0, end: 10 }, 99, 100)).toEqual({
      start: 90,
      end: 100,
    })
  })
})

describe("niceStep", () => {
  it("zwraca najmniejszą ładną liczbę >= raw", () => {
    const cases: [number, number][] = [
      [0.5, 1],
      [1, 1],
      [1.2, 2],
      [2, 2],
      [3, 5],
      [5, 5],
      [7, 10],
      [10, 10],
      [11, 20],
      [150, 200],
      [2001, 5000],
    ]
    for (const [raw, expected] of cases) {
      expect(niceStep(raw)).toBe(expected)
    }
  })
})

describe("getTicks", () => {
  // -0 normalizujemy (+ 0), bo kreska na kroku 0 bywa liczona jako -0.
  const steps = (ticks: { step: number }[]) => ticks.map((t) => t.step + 0)

  it("widok 0..100 przy 1000 px: główne co 10 i 40 pomocniczych", () => {
    const ticks = getTicks({ start: 0, end: 100 }, 1000, 100)
    const majors = ticks.filter((t) => t.major)
    const minors = ticks.filter((t) => !t.major)
    expect(steps(majors)).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90])
    expect(minors).toHaveLength(40)
  })

  it("origin: 1 daje główne kreski na krokach 9, 19, 29", () => {
    const ticks = getTicks({ start: 0, end: 100 }, 1000, 100, { origin: 1 })
    const majors = steps(ticks.filter((t) => t.major))
    expect(majors.slice(0, 3)).toEqual([9, 19, 29])
    expect(majors).toEqual([9, 19, 29, 39, 49, 59, 69, 79, 89, 99])
  })

  it("widok 0..10 daje kreskę na każdym kroku, bez pomocniczych", () => {
    const ticks = getTicks({ start: 0, end: 10 }, 1000, 10)
    expect(steps(ticks)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(ticks.every((t) => t.major)).toBe(true)
  })

  it("count = 10 000 000 daje mniej niż 200 kresek", () => {
    const count = 10_000_000
    const ticks = getTicks({ start: 0, end: count }, 1000, count)
    expect(ticks.length).toBeGreaterThan(0)
    expect(ticks.length).toBeLessThan(200)
  })

  it("width = 0 daje pustą tablicę", () => {
    expect(getTicks({ start: 0, end: 100 }, 0, 100)).toEqual([])
  })
})

describe("lowerBound", () => {
  it("dla n = 0 zwraca 0", () => {
    expect(lowerBound(0, () => true)).toBe(0)
  })
})

describe("visibleRange", () => {
  const items: Segment[] = [
    { id: "a", start: 10, end: 20 },
    { id: "b", start: 30, end: 40 },
  ]

  it("pusta tablica daje [0, 0]", () => {
    expect(visibleRange([], { start: 0, end: 100 })).toEqual([0, 0])
  })

  it("widok przed pierwszym odcinkiem jest pusty", () => {
    expect(visibleRange(items, { start: 0, end: 5 })).toEqual([0, 0])
  })

  it("widok za ostatnim odcinkiem jest pusty", () => {
    expect(visibleRange(items, { start: 50, end: 60 })).toEqual([2, 2])
  })

  it("odcinek stykający się z lewą krawędzią widoku nie jest wliczany", () => {
    const touching: Segment[] = [
      { id: "a", start: 0, end: 10 },
      { id: "b", start: 10, end: 20 },
    ]
    expect(visibleRange(touching, { start: 10, end: 20 })).toEqual([1, 2])
  })

  it("odcinek stykający się z prawą krawędzią widoku nie jest wliczany", () => {
    const touching: Segment[] = [
      { id: "a", start: 0, end: 10 },
      { id: "b", start: 10, end: 20 },
    ]
    expect(visibleRange(touching, { start: 0, end: 10 })).toEqual([0, 1])
  })
})

describe("snap", () => {
  it("pusta tablica daje null", () => {
    expect(snap([], 5, 10)).toBeNull()
  })

  it("remis odległości: wygrywa cel niższy", () => {
    // 5 leży w równej odległości od 0 i 10; implementacja wybiera mniejszy.
    expect(snap([0, 10], 5, 10)).toBe(0)
  })

  it("poza zasięgiem maxDist daje null", () => {
    expect(snap([0, 10], 50, 5)).toBeNull()
    expect(snap([0, 10], -20, 5)).toBeNull()
  })

  it("w zasięgu zwraca najbliższy cel", () => {
    expect(snap([0, 10], 8, 3)).toBe(10)
  })
})

describe("neighbor", () => {
  const targets = [0, 10, 20]

  it("pusta tablica daje null", () => {
    expect(neighbor([], 5, 1)).toBeNull()
    expect(neighbor([], 5, -1)).toBeNull()
  })

  it("następny i poprzedni cel względem wartości", () => {
    expect(neighbor(targets, 5, 1)).toBe(10)
    expect(neighbor(targets, 5, -1)).toBe(0)
    expect(neighbor(targets, 10, 1)).toBe(20)
    expect(neighbor(targets, 10, -1)).toBe(0)
  })

  it("na pierwszym elemencie poprzedni daje null", () => {
    expect(neighbor(targets, 0, -1)).toBeNull()
  })

  it("na ostatnim elemencie następny daje null", () => {
    expect(neighbor(targets, 20, 1)).toBeNull()
    expect(neighbor(targets, 20, -1)).toBe(10)
  })
})

describe("segmentPaths", () => {
  it("3 szerokie odcinki dają oczekiwany d z przerwą", () => {
    const items: Segment[] = [
      { id: "a", start: 0, end: 2 },
      { id: "b", start: 3, end: 5 },
      { id: "c", start: 6, end: 8 },
    ]
    const paths = segmentPaths(items, 0, items.length, { start: 0, end: 10 }, 100, {
      height: 20,
    })
    expect(paths.get("")).toBe(
      "M0 0h19v20h-19zM30 0h19v20h-19zM60 0h19v20h-19z"
    )
  })

  it("10 000 odcinków w 1000 px daje ścieżki krótsze niż 40 000 znaków", () => {
    const count = 10_000
    const items: Segment[] = Array.from({ length: count }, (_, i) => ({
      id: String(i),
      start: i,
      end: i + 1,
    }))
    const paths = segmentPaths(items, 0, items.length, { start: 0, end: count }, 1000, {
      height: 20,
    })
    const total = [...paths.values()].reduce((sum, d) => sum + d.length, 0)
    expect(total).toBeLessThan(40_000)
  })

  it("odcinki częściowo poza widokiem są przycinane do krawędzi", () => {
    const items: Segment[] = [
      { id: "a", start: -5, end: 2 },
      { id: "b", start: 8, end: 15 },
    ]
    const paths = segmentPaths(items, 0, items.length, { start: 0, end: 10 }, 100, {
      height: 20,
    })
    expect(paths.get("")).toBe("M0 0h19v20h-19zM80 0h19v20h-19z")
  })
})

describe("markerPaths", () => {
  it("50 000 znaczników w 1000 px daje najwyżej 1001 komend M", () => {
    const items = Array.from({ length: 50_000 }, (_, i) => ({ at: i }))
    const paths = markerPaths(items, { start: 0, end: 50_000 }, 1000, () => 20)
    const total = [...paths.values()].reduce((sum, d) => sum + countMoves(d), 0)
    expect(total).toBeLessThanOrEqual(1001)
  })

  it("warianty trafiają do osobnych ścieżek", () => {
    const items = [
      { at: 1, variant: "major" },
      { at: 2 },
      { at: 3, variant: "major" },
    ]
    const heights: Record<string, number> = { major: 30, default: 10 }
    const paths = markerPaths(items, { start: 0, end: 10 }, 100, (v) => heights[v])
    expect(paths.size).toBe(2)
    expect(paths.get("major")).toBe("M15.5 0v30M35.5 0v30")
    expect(paths.get("default")).toBe("M25.5 0v10")
  })
})

/** Piksel kraweędzi w widoku (pomocnicze, bez importu axisToX). */
function axisToXLocal(pos: number, view: View, width: number) {
  return ((pos - view.start) * width) / (view.end - view.start)
}

describe("segmentAt", () => {
  const segs: Segment[] = [
    { id: "a", start: 0, end: 5 },
    { id: "b", start: 5, end: 8 },
    { id: "c", start: 10, end: 20 },
  ]
  it("finds the segment containing pos", () => {
    expect(segmentAt(segs, 0)?.id).toBe("a")
    expect(segmentAt(segs, 4.9)?.id).toBe("a")
    expect(segmentAt(segs, 5)?.id).toBe("b")
    expect(segmentAt(segs, 19.99)?.id).toBe("c")
  })
  it("returns null in gaps and outside", () => {
    expect(segmentAt(segs, 8)).toBeNull()
    expect(segmentAt(segs, 9.5)).toBeNull()
    expect(segmentAt(segs, 20)).toBeNull()
    expect(segmentAt(segs, -1)).toBeNull()
    expect(segmentAt([], 3)).toBeNull()
  })
})

describe("markerAt", () => {
  const ms: Marker[] = [{ at: 2 }, { at: 3 }, { at: 50 }]
  it("finds the nearest marker within tolerance", () => {
    expect(markerAt(ms, 2.5, 0.2)?.at).toBe(2)
    expect(markerAt(ms, 3.6, 0.2)?.at).toBe(3)
    expect(markerAt(ms, 50.4, 0.2)?.at).toBe(50)
  })
  it("returns null when too far", () => {
    expect(markerAt(ms, 10, 1)).toBeNull()
    expect(markerAt([], 1, 5)).toBeNull()
  })
})

describe("holdStepSize", () => {
  it("is 1 before the delay", () => {
    expect(holdStepSize(0, 1_000_000)).toBe(1)
    expect(holdStepSize(HOLD_DELAY_MS - 1, 1_000_000)).toBe(1)
  })
  it("stays 1 for small counts", () => {
    expect(holdStepSize(10_000, 40)).toBe(1)
  })
  it("grows linearly to ~count / 50", () => {
    const count = 100_000
    const mid = holdStepSize(HOLD_DELAY_MS + HOLD_RAMP_MS / 2, count)
    expect(mid).toBeGreaterThan(900)
    expect(mid).toBeLessThan(1100)
    expect(holdStepSize(HOLD_DELAY_MS + HOLD_RAMP_MS, count)).toBe(2000)
    expect(holdStepSize(60_000, count)).toBe(2000)
  })
  it("is monotonic", () => {
    let prev = 0
    for (let t = 0; t < 5000; t += 50) {
      const s = holdStepSize(t, 5000)
      expect(s).toBeGreaterThanOrEqual(prev)
      prev = s
    }
  })
})
