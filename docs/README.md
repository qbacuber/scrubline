# Scrubline: plan wykonawczy

Scrubline to oś kroków w stylu programów do montażu, instalowana jako komponent shadcn. Ten katalog zamienia plan wstępny w konkretne kroki i kod.

## Czy da się to dodać do rejestru shadcn?

Tak, ale "rejestr shadcn" nie jest jednym centralnym serwerem jak npm. Nie ma komendy `publish`. Są trzy poziomy i każdy kolejny jest opcjonalny:

| Poziom | Co robisz | Jak instaluje użytkownik |
| --- | --- | --- |
| 1. Rejestr GitHub | Publiczne repo z `registry.json` w korzeniu. Publikacją jest `git push`. | `npx shadcn@latest add TWOJ_LOGIN/scrubline/scrubline` |
| 2. Rejestr hostowany | `shadcn build` generuje `public/r/*.json`, wdrażasz stronę. | `npx shadcn@latest add https://DOMENA/r/scrubline.json` albo `@scrubline/scrubline` po dodaniu przestrzeni nazw |
| 3. Wpis w katalogu shadcn | PR do `shadcn-ui/ui` dopisujący rejestr do `apps/v4/registry/directory.json`. | `npx shadcn@latest add @scrubline/scrubline` bez żadnej konfiguracji |

Zalecana kolejność: poziom 1 od pierwszego dnia (zero infrastruktury), poziom 2 razem ze stroną dokumentacji, poziom 3 dopiero gdy wersja 1 jest gotowa.

## Pliki

| Plik | Zawartość |
| --- | --- |
| [01-repozytorium.md](01-repozytorium.md) | Założenie repo, struktura katalogów, `registry.json` |
| [02-kod.md](02-kod.md) | Najtrudniejszy kod w całości: `scrubline-scale.ts`, `use-scrubline.ts`, trzon `scrubline.tsx` |
| [03-publikacja.md](03-publikacja.md) | Publikacja na trzech poziomach, wersjonowanie |
| [04-uzycie-w-aplikacji.md](04-uzycie-w-aplikacji.md) | Instalacja i użycie w osobnej aplikacji |
| [TODO.md](TODO.md) | Łatwiejsze części do dokończenia (także przez słabszy model) i rzeczy do sprawdzenia |

## Stan kodu z 02-kod.md

- Wszystkie trzy pliki przechodzą `tsc --strict`.
- `scrubline-scale.ts` został uruchomiony na próbnych danych (przeliczenia, zoom wokół punktu, limity, podziałka, przyciąganie, ścieżki dla 10 000 odcinków i 50 000 znaczników).
- Hook i komponenty **nie były uruchamiane w przeglądarce**. Gesty (pinch, przeciąganie przy krawędzi) trzeba przetestować ręcznie, lista jest w TODO.md, sekcja D.

## Decyzje, które doprecyzowują plan wstępny

1. **Krok to komórka.** Oś ma dziedzinę `[0, count]`, krok `i` zajmuje `[i, i + 1)`. Głowica, kreski podziałki i znaczniki stoją na środku komórki. Odcinek `{ start, end }` ma `end` wyłączny. Dzięki temu przy dużym zoomie klik w dowolne miejsce komórki wybiera ten krok, a odcinki stykają się bez dziur.
2. **Eksporty nazwane zamiast obiektu `Scrubline`.** Plik eksportuje `Root`, `Viewport`, `Playhead` itd., a użytkownik pisze `import * as Scrubline from "@/components/ui/scrubline"`. Składnia `<Scrubline.Root>` zostaje, a w Next.js nie psuje się na granicy Server/Client Components (dostęp przez kropkę do obiektu z modułu `"use client"` tam nie działa).
3. **Lanes to kilka `<Segments>`.** Każdy `<Segments>` dostaje własną tablicę posortowaną po `start`, bez nakładania. To warunek wyszukiwania binarnego widocznego zakresu, a pole `lane` w danych staje się zbędne.
4. **`origin` w podziałce.** Przy podpisach `step + 1` kreski główne muszą wypadać na 10, 20, 30, a nie na 11, 21, 31. Załatwia to parametr `origin` w `getTicks`.
5. **Układ katalogów `registry/default/{ui,hooks,lib}`** zamiast `registry/scrubline/`. CLI shadcn przepisuje importy `@/registry/<styl>/ui|hooks|lib/...` na aliasy z `components.json` użytkownika, więc ten układ jest najbezpieczniejszy. Plik z matematyką nazywa się `scrubline-scale.ts`, żeby nie kolidował z niczym w `lib/` użytkownika.
6. **Głowica poza widokiem to ten sam element**, przyklejony do krawędzi (`data-offscreen`). Fokus klawiatury nie znika po przewinięciu, a klik przewija widok do głowicy.

## Źródła

- [shadcn: Registry, Getting Started](https://ui.shadcn.com/docs/registry/getting-started)
- [shadcn: GitHub registries](https://ui.shadcn.com/docs/registry/github)
- [shadcn: Namespaces](https://ui.shadcn.com/docs/registry/namespace)
- [shadcn: registry-item.json](https://ui.shadcn.com/docs/registry/registry-item-json)
- [shadcn: Registry Index (katalog)](https://ui.shadcn.com/docs/registry/registry-index)
