# 1. Repozytorium

Repo pełni dwie role: jest źródłem rejestru (pliki komponentu + `registry.json`) i stroną z dokumentacją oraz przykładami.

## 1.1. Założenie repo

Najmniej pracy daje oficjalny szablon `shadcn-ui/registry-template` (Next.js + Tailwind v4, gotowy skrypt budowania rejestru).

1. Wejdź na `https://github.com/shadcn-ui/registry-template` i kliknij **Use this template → Create a new repository**.
2. Nazwa: `scrubline`. Widoczność: **Public** (wymagane dla rejestru GitHub bez logowania i dla katalogu shadcn).
3. Lokalnie:

```bash
git clone git@github.com:TWOJ_LOGIN/scrubline.git
cd scrubline
pnpm install
pnpm dev
```

4. Usuń przykładowe elementy szablonu z katalogu `registry/` i ich wpisy z `registry.json`.
5. Dodaj plik `LICENSE` (MIT).

Jeśli wolisz Vite albo własny projekt: rejestrowi wystarcza `registry.json` w korzeniu repo i pliki, na które wskazuje. Framework jest potrzebny tylko stronie z dokumentacją. Pamiętaj wtedy, żeby alias `@/` wskazywał katalog, w którym leży `registry/`.

## 1.2. Struktura

```
scrubline/
├─ registry.json
├─ registry/
│  └─ default/
│     ├─ ui/
│     │  └─ scrubline.tsx            # części: Root, Viewport, Ruler, Track, Segments...
│     ├─ hooks/
│     │  └─ use-scrubline.ts         # stan, gesty, klawiatura
│     ├─ lib/
│     │  ├─ scrubline-scale.ts       # czysta matematyka
│     │  └─ scrubline-scale.test.ts  # Vitest (nie trafia do rejestru)
│     └─ examples/
│        ├─ scrubline-demo.tsx
│        ├─ scrubline-minimap.tsx
│        └─ scrubline-compact.tsx
├─ app/                              # strona z dokumentacją i przykładami
├─ public/r/                         # wynik `shadcn build` (poziom 2)
├─ LICENSE
└─ README.md
```

W plikach rejestru importuj wyłącznie tak:

```ts
import { cn } from "@/lib/utils"
import { useScrubline } from "@/registry/default/hooks/use-scrubline"
import { getTicks } from "@/registry/default/lib/scrubline-scale"
```

CLI zamieni te ścieżki na aliasy użytkownika (`@/components/ui`, `@/hooks`, `@/lib`). Importy względne (`./scale`) nie są przepisywane i zepsują się, gdy pliki trafią do różnych katalogów.

## 1.3. registry.json

```json
{
  "$schema": "https://ui.shadcn.com/schema/registry.json",
  "name": "scrubline",
  "homepage": "https://github.com/TWOJ_LOGIN/scrubline",
  "items": [
    {
      "name": "scrubline",
      "type": "registry:ui",
      "title": "Scrubline",
      "description": "A step-based timeline with zoom, pan, playhead, ruler, segments, markers and minimap. Renders only the visible range, so it stays smooth with 100k+ steps.",
      "files": [
        { "path": "registry/default/ui/scrubline.tsx", "type": "registry:ui" },
        { "path": "registry/default/hooks/use-scrubline.ts", "type": "registry:hook" },
        { "path": "registry/default/lib/scrubline-scale.ts", "type": "registry:lib" }
      ]
    },
    {
      "name": "scrubline-demo",
      "type": "registry:component",
      "title": "Scrubline Demo",
      "description": "Scrubline with ruler, segments, markers and controls.",
      "registryDependencies": ["TWOJ_LOGIN/scrubline/scrubline"],
      "files": [
        { "path": "registry/default/examples/scrubline-demo.tsx", "type": "registry:component" }
      ]
    }
  ]
}
```

Uwagi:

- `scrubline-minimap` i `scrubline-compact` dopisz tak samo jak `scrubline-demo`.
- `dependencies` jest puste celowo: zero paczek npm poza Reactem.
- Komponent używa `cn` z `@/lib/utils`. Ten plik powstaje przy `shadcn init`, więc ma go każdy projekt shadcn.
- `registryDependencies` w przykładach używa adresu GitHub, bo taki adres działa niezależnie od tego, skąd ktoś instaluje. Po uruchomieniu poziomu 2 można go zamienić na `https://DOMENA/r/scrubline.json`.
- Opisy po angielsku: czytają je ludzie w katalogu i modele (serwer MCP shadcn).

## 1.4. Sprawdzenie lokalne

```bash
pnpm dlx shadcn@latest registry validate   # schemat + czy pliki istnieją
pnpm dlx shadcn@latest build               # generuje public/r/*.json
pnpm dev
pnpm dlx shadcn@latest view http://localhost:3000/r/scrubline.json
```

Prawdziwy test to instalacja w świeżym projekcie, opisana w [03-publikacja.md](03-publikacja.md), punkt 3.4.

## 1.5. Kolejność prac

1. Repo z szablonu, czyszczenie, `LICENSE`.
2. Wklejenie trzech plików z [02-kod.md](02-kod.md), `registry.json` z jednym elementem `scrubline`.
3. Minimalna strona demo w `app/page.tsx` (Root + Viewport + Segments + Playhead) i ręczne testy gestów.
4. `git push`: od tej chwili działa instalacja z GitHuba (poziom 1).
5. Części z TODO.md, sekcja A (Ruler, Minimap, Controls).
6. Testy, przykłady, dokumentacja (TODO.md, sekcje B i C).
7. Wdrożenie strony (poziom 2), tag `v0.1.0`.
8. PR do katalogu shadcn (poziom 3).
