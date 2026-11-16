# 3. Publikacja

## 3.1. Poziom 1: rejestr GitHub (bez serwera)

Wymagania: repo na `github.com`, publiczne, `registry.json` w korzeniu, wszystkie wskazane pliki istnieją.

```bash
pnpm dlx shadcn@latest registry validate
git add .
git commit -m "feat: scrubline registry"
git push
```

Od tej chwili każdy może zainstalować komponent:

```bash
npx shadcn@latest add TWOJ_LOGIN/scrubline/scrubline
```

Format adresu to `właściciel/repo/element`. Bez dopisku CLI bierze domyślną gałąź.

## 3.2. Wersje

Wersją jest tag gita:

```bash
git tag v0.1.0
git push --tags
```

```bash
npx shadcn@latest add TWOJ_LOGIN/scrubline/scrubline#v0.1.0
```

Po `#` może stać tag, gałąź albo pełny SHA commita. W README podawaj komendę z tagiem, wtedy zmiany na `main` nie psują nikomu instalacji.

## 3.3. Poziom 2: rejestr hostowany

Potrzebny do instalacji po URL, do przestrzeni nazw `@scrubline` i do wpisu w katalogu.

1. Zbuduj pliki JSON:

```bash
pnpm dlx shadcn@latest build
```

Wynik trafia do `public/r/` (`registry.json`, `scrubline.json`, `scrubline-demo.json`...). Szablon ma to podpięte pod skrypt w `package.json`. Sprawdź, czy uruchamia się przed `next build`, żeby wdrożenie zawsze miało świeże pliki.

2. Wdróż repo na Vercel (Import Project → repo `scrubline`, ustawienia domyślne). Dowolny inny hosting plików statycznych też wystarczy.

3. Sprawdź:

```bash
npx shadcn@latest view https://DOMENA/r/scrubline.json
npx shadcn@latest add https://DOMENA/r/scrubline.json
```

4. Przestrzeń nazw. Użytkownik dodaje ją raz w swoim projekcie:

```bash
npx shadcn@latest registry add @scrubline=https://DOMENA/r/{name}.json
npx shadcn@latest add @scrubline/scrubline
```

To samo ręcznie w `components.json`:

```json
{
  "registries": {
    "@scrubline": "https://DOMENA/r/{name}.json"
  }
}
```

## 3.4. Test przed ogłoszeniem

W świeżym projekcie (osobny katalog, nie repo Scrubline):

```bash
pnpm create next-app@latest scrubline-test
cd scrubline-test
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add TWOJ_LOGIN/scrubline/scrubline --dry-run
pnpm dlx shadcn@latest add TWOJ_LOGIN/scrubline/scrubline
pnpm build
```

Do sprawdzenia:

- Trzy pliki trafiły do `components/ui/`, `hooks/` i `lib/`.
- W zainstalowanych plikach nie został żaden import zaczynający się od `@/registry/`. Jeśli został, układ katalogów w rejestrze nie pasuje do reguł przepisywania importów i trzeba go poprawić albo dodać `target` w `files`.
- `pnpm build` przechodzi bez błędów typów.
- To samo dla projektu Vite z aliasem `@/` wskazującym `src/`.

## 3.5. Poziom 3: katalog shadcn

Wpis sprawia, że `@scrubline` działa u każdego bez konfiguracji i że rejestr widać w katalogu na stronie shadcn.

Wymagania z dokumentacji:

- rejestr jest open source i publicznie dostępny,
- poprawny JSON zgodny ze schematem rejestru,
- rejestr jest płaski: `registry.json` i pliki elementów (`scrubline.json`) leżą w tym samym katalogu, bez zagnieżdżeń (wynik `shadcn build` w `public/r/` to spełnia),
- tablica `files` w `registry.json` nie zawiera pola `content`.

Kroki:

1. Zrób fork `https://github.com/shadcn-ui/ui`.
2. Dopisz rejestr do `apps/v4/registry/directory.json`. Skopiuj kształt sąsiedniego wpisu i podmień wartości. Adres URL ma postać `https://DOMENA/r/{name}.json`.
3. Uruchom `pnpm validate:registries`.
4. Otwórz pull request. Po scaleniu rejestr jest opublikowany od razu.

Przed PR warto mieć: działającą stronę z demo, README z komendą instalacji, tag `v1.0.0` i przetestowane gesty na dotyku. Recenzent zobaczy stronę jako pierwszą.
