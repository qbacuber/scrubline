# 4. Użycie w osobnej aplikacji

## 4.1. Wymagania

- React 19 lub 18, Tailwind v4.
- Projekt zainicjowany przez shadcn (`components.json`, `lib/utils.ts` z `cn`, zmienne motywu w CSS). Jeśli nie:

```bash
npx shadcn@latest init
```

## 4.2. Instalacja

```bash
# z GitHuba, przypięte do wersji
npx shadcn@latest add TWOJ_LOGIN/scrubline/scrubline#v0.1.0

# albo po URL (poziom 2)
npx shadcn@latest add https://DOMENA/r/scrubline.json
```

Podgląd zmian bez zapisywania: dopisz `--dry-run` albo `--diff`.

Po instalacji w projekcie są trzy pliki i od tej chwili należą do aplikacji:

```
components/ui/scrubline.tsx
hooks/use-scrubline.ts
lib/scrubline-scale.ts
```

## 4.3. Przykład

```tsx
"use client"

import * as React from "react"

import * as Scrubline from "@/components/ui/scrubline"
import type { Segment, View } from "@/lib/scrubline-scale"

const COUNT = 5000

// Posortowane po start, bez nakładania, end wyłączny.
const segments: Segment[] = Array.from({ length: 50 }, (_, i) => ({
  id: `s${i}`,
  start: i * 100,
  end: (i + 1) * 100,
  label: `Scena ${i + 1}`,
  color: i % 2 ? "var(--chart-1)" : "var(--chart-2)",
}))

// Głowica przyciąga się do początków odcinków. Tablica posortowana.
const snapTo = segments.map((s) => s.start)

export function Timeline() {
  const [step, setStep] = React.useState(0)
  const [view, setView] = React.useState<View>({ start: 0, end: 1000 })

  return (
    <Scrubline.Root
      count={COUNT}
      value={step}
      onValueChange={setStep}
      view={view}
      onViewChange={setView}
      snapTo={snapTo}
    >
      {/* <Scrubline.Ruler formatLabel={(s) => `${s + 1}`} origin={1} /> */}
      <Scrubline.Viewport>
        <Scrubline.Track>
          <Scrubline.Segments items={segments} />
        </Scrubline.Track>
        <Scrubline.Playhead aria-label="Krok" formatPosition={(s) => `Krok ${s + 1} z ${COUNT}`} />
      </Scrubline.Viewport>
      {/* <Scrubline.Minimap /> <Scrubline.Controls /> */}
    </Scrubline.Root>
  )
}
```

Zakomentowane części pojawią się po wykonaniu TODO.md, sekcja A.

Zasady, o których trzeba pamiętać:

- `value` to liczba całkowita od `0` do `count - 1`. Czas lub klatki to tylko format podpisu.
- Stan może być wewnętrzny: zamiast `value`/`view` podaj `defaultValue`/`defaultView` albo nic.
- `Playhead` musi być bezpośrednim dzieckiem `Viewport`.
- Tablice `segments`, `markers` i `snapTo` trzymaj poza renderem albo w `useMemo`. Nowa tablica w każdym renderze unieważnia cache ścieżek.
- Własny układ bez gotowych części: `useScrublineContext()` wewnątrz `Root` albo sam hook `useScrubline()` z `hooks/use-scrubline`.

## 4.4. Zmiana wyglądu

Kolory pochodzą ze zmiennych motywu (`--primary`, `--muted`, `--border`, `--ring`), więc ciemny tryb działa bez pracy. Trzy sposoby zmian, od najlżejszego:

1. `className` na dowolnej części, np. `<Scrubline.Viewport className="rounded-none border-x-0" />`.
2. `color` w danych odcinka (dowolny kolor CSS, także `var(--chart-3)`).
3. Edycja `components/ui/scrubline.tsx`. To jest sens modelu shadcn: kod jest twój.

## 4.5. Aktualizacja

```bash
npx shadcn@latest add TWOJ_LOGIN/scrubline/scrubline#v0.2.0 --diff       # zobacz różnice
npx shadcn@latest add TWOJ_LOGIN/scrubline/scrubline#v0.2.0 --overwrite  # nadpisz
```

`--overwrite` kasuje lokalne zmiany w tych trzech plikach. Jeśli edytowałeś komponent, zrób commit przed aktualizacją i scal różnice przez gita.
