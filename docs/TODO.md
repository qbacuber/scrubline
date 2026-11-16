# TODO

Rzeczy łatwiejsze niż kod z 02-kod.md. Każdy punkt da się zlecić osobno, także słabszemu modelowi: podaj mu ten punkt, plik `scrubline-scale.ts` i sekcję 2.4 z 02-kod.md.

Oznaczenia: **[łatwe]** mechaniczna praca, **[średnie]** wymaga przeczytania hooka.

## A. Brakujące części w `scrubline.tsx`

- [ ] **A1. `Ruler` [łatwe].** Propsy: `formatLabel?: (step) => string` (domyślnie `String(step)`), `origin?: number`, `minLabelPx?: number`. W `useMemo` wywołaj `getTicks(view, width, count, { minLabelPx, origin })`. Kreski jako jedna ścieżka SVG dla głównych i jedna dla pomocniczych (`M{x} {y}v{h}`, x z `stepToX`). Podpisy jako `<span>` tylko dla `major`, `tabular-nums text-[10px] text-muted-foreground`. Domyślne `minLabelPx`: długość `formatLabel(count - 1)` × 7 px + 16 px. Ruler ma tę samą szerokość co Viewport (ten sam rodzic, brak paddingu poziomego). Wysokość z `SIZES`.
- [ ] **A2. `Controls` [łatwe].** Przyciski: poprzedni/następny krok (`setValue(value ± 1)` + `reveal`), poprzedni/następny odcinek (`neighbor(snapTo, value, ±1)`), zoom +/− (`zoomBy(1.5)`, `zoomBy(1 / 1.5)`), "pokaż całość" (`fit`), "pokaż głowicę" (`reveal`). Etykieta pozycji z `formatPosition`. Wszystkie napisy przez props `labels` z angielskimi domyślnymi. Zwykłe `<button>` z klasami, bez importu `Button` z shadcn (zero zależności rejestrowych). Ikony jako inline SVG, bez `lucide-react`. Żeby Controls znały `snapTo`, dodaj je do wartości zwracanej przez hook.
- [ ] **A3. Strzałka głowicy poza widokiem [łatwe].** W `Playhead` zamień kółko dla `data-offscreen="start" | "end"` na strzałkę w lewo/prawo (inline SVG). Dodaj `aria-description` z propsa.
- [ ] **A4. `Minimap` [średnie].** Pasek całej osi: własny "widok" `{ start: 0, end: count }` i własna szerokość (osobny `ResizeObserver`). Odcinki: `segmentPaths(items, 0, items.length, fullView, width, { height, gap: 0 })`. Ramka: `left = axisToX(view.start, fullView, w)`, `width = spanOf(view) * w / count`, minimalnie 8 px. Trzy strefy wskaźnika: środek ramki przesuwa (`zoomTo({ start, end })` z zachowaniem rozpiętości), lewy/prawy brzeg (8 px) zmienia `start` albo `end`, klik poza ramką centruje widok. `setPointerCapture`, `touch-none`. Limity załatwia `zoomTo` (clampView).
- [ ] **A5. Łączenie handlerów [łatwe].** W `Viewport` i `Playhead` propsy użytkownika (`onPointerDown` itd.) nadpisują handlery z hooka. Dodaj mały helper `compose(ours, theirs)`, który woła oba.
- [ ] **A6. Warianty `size` [łatwe].** Dopracować `SIZES` (wysokości Ruler, Minimap, pole chwytu) i wersję `sm` do paska stanu.
- [ ] **A7. Etykiety znaczników [łatwe].** `Marker.label` jako `<title>`/tooltip tylko dla znaczników widocznych przy bliskim zoomie (ten sam próg co podpisy odcinków).

## B. Testy (Vitest, tylko `scrubline-scale.ts`)

Plik `registry/default/lib/scrubline-scale.test.ts`. Dobre zadanie dla słabszego modelu, przypadki są wypisane.

- [ ] `stepToX` / `xToStep`: środek komórki; `xToStep(0)` i `xToStep(width - 1)`; wynik zawsze w `[0, count - 1]`; `xToStep(stepToX(i)) === i` dla losowych widoków.
- [ ] `zoomAround`: kotwica zostaje pod tym samym pikselem (`axisToX(anchor)` przed i po, tolerancja 1e-6); kotwica na lewej i prawej krawędzi; `factor` ogromny zatrzymuje się na `minSpan`; `factor` bliski zera daje `{ 0, count }`.
- [ ] `clampView`: ujemny `start`; `end > count`; rozpiętość większa niż `count`; `NaN` i rozpiętość ≤ 0 dają pełny widok; środek zachowany, gdy jest miejsce.
- [ ] `panBy`: zatrzymanie na obu krańcach, rozpiętość bez zmian.
- [ ] `reveal`: krok widoczny zwraca ten sam obiekt; krok z lewej i z prawej; krok 0 i `count - 1`.
- [ ] `niceStep`: `[0.5, 1, 1.2, 2, 3, 5, 7, 10, 11, 150, 2001] → [1, 1, 2, 2, 5, 5, 10, 10, 20, 200, 5000]`.
- [ ] `getTicks`: widok 0..100 przy 1000 px daje główne co 10 i 40 pomocniczych; `origin: 1` daje główne na krokach 9, 19, 29; widok 0..10 daje kreskę na każdym kroku bez pomocniczych; `count = 10 000 000` daje mniej niż 200 kresek; `width = 0` daje `[]`.
- [ ] `lowerBound`, `visibleRange`: pusta tablica; widok przed pierwszym i za ostatnim odcinkiem; odcinek stykający się z krawędzią widoku nie jest wliczany.
- [ ] `snap`, `neighbor`: pusta tablica; remis odległości; poza zasięgiem `null`; `neighbor` na pierwszym i ostatnim elemencie.
- [ ] `segmentPaths`: 3 szerokie odcinki dają oczekiwany `d` z przerwą; 10 000 odcinków w 1000 px daje ścieżki krótsze niż 40 000 znaków; odcinki częściowo poza widokiem są przycinane.
- [ ] `markerPaths`: 50 000 znaczników w 1000 px daje najwyżej 1001 komend `M`; warianty trafiają do osobnych ścieżek.
- [ ] Skrypt `"test": "vitest run"` i uruchamianie w CI (GitHub Actions: install, `tsc --noEmit`, test, `shadcn registry validate`).

## C. Przykłady i dokumentacja

- [ ] **C1.** `scrubline-demo.tsx`: 5000 kroków, odcinki, znaczniki, Ruler, Controls.
- [ ] **C2.** `scrubline-minimap.tsx`: 100 000 kroków i 10 000 odcinków z Minimapą (to jest też test wydajności).
- [ ] **C3.** `scrubline-compact.tsx`: `size="sm"`, sam Viewport + Playhead.
- [ ] **C4.** Wpisy przykładów w `registry.json`.
- [ ] **C5.** Strona `app/page.tsx`: demo na żywo, komenda instalacji, tabela propsów każdej części, tabela skrótów klawiszowych.
- [ ] **C6.** README: opis, GIF, instalacja (z tagiem), minimalny przykład, link do strony.
- [ ] **C7.** Przykład z `formatLabel` dla czasu (`mm:ss`) i klatek.

## D. Do sprawdzenia ręcznie (kod z 02-kod.md nie był uruchamiany w przeglądarce)

- [ ] **D1.** Ctrl/⌘ + kółko zoomuje wokół kursora i nie zoomuje strony (Chrome, Firefox, Safari).
- [ ] **D2.** Szczypanie na touchpadzie w Safari na macOS. Safari nie wysyła `wheel` z `ctrlKey`, tylko `gesturestart`/`gesturechange`. Jeśli nie działa: dodać w hooku listenery tych zdarzeń (`e.scale` względem poprzedniej wartości → `zoomBy`) z `preventDefault()`.
- [ ] **D3.** iPhone: jeden palec przesuwa, dwa palce zoomują, pionowe przewijanie strony nadal działa, gdy palec zaczyna na osi.
- [ ] **D4.** Czułość: `ZOOM_SPEED`, `EDGE`, `EDGE_SPEED`, `DRAG_THRESHOLD` dobrać na myszy i touchpadzie.
- [ ] **D5.** Przeciąganie głowicy do krawędzi przesuwa widok płynnie i zatrzymuje się na końcu osi.
- [ ] **D6.** Tryb sterowany, w którym rodzic odrzuca zmianę (`onViewChange` nic nie robi): komponent nie może się rozjechać.
- [ ] **D7.** ESLint z regułami React Compiler zgłosi przypisania `ref.current = ...` w trakcie renderu (hook, `useControllable`, `latest`). Wariant zgodny: przenieść przypisania do `useLayoutEffect` albo użyć `useEffectEvent`. Sprawdzić, czy nie pojawia się opóźnienie o jedną klatkę.
- [ ] **D8.** Czytnik ekranu (VoiceOver): głowica ogłasza `aria-valuetext`, strzałki zmieniają wartość.
- [ ] **D9.** Wydajność: 100 000 kroków i 10 000 odcinków, profil w DevTools przy przesuwaniu. Cel: render poniżej 4 ms.
- [ ] **D10.** Przy bardzo dalekim zoomie, gdy wiele kolorowych odcinków mieści się w jednym pikselu, `segmentPaths` bierze kolor pierwszego odcinka w kolumnie. Ocenić, czy wygląda dobrze. Ewentualna poprawka: kolor zajmujący największą część kolumny.
- [ ] **D11.** Test instalacji z 03-publikacja.md, punkt 3.4 (przepisywanie importów, Next.js i Vite).

## E. Po wersji 1

- [ ] Edycja: przeciąganie i zmiana długości odcinków.
- [ ] Orientacja pionowa, RTL.
- [ ] Odcinki nakładające się na siebie w jednej ścieżce.
- [ ] Bezwładność przesuwania po puszczeniu palca.
