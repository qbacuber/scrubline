# Scrubline

A step-based timeline for React: zoom, pan, playhead, ruler, segments, markers and a minimap. It renders only the visible range, so it stays smooth with 100,000+ steps. Distributed as a [shadcn](https://ui.shadcn.com) registry item (Next.js, React 19, Tailwind v4).

<!-- TODO: record a GIF and save it as docs/scrubline.gif -->
![Scrubline demo](docs/scrubline.gif)

## Installation

```bash
npx shadcn@latest add qbacuber/scrubline/scrubline
```

Pin a release with a tag:

```bash
npx shadcn@latest add qbacuber/scrubline/scrubline#v0.1.0
```

Examples can be installed the same way, e.g. `qbacuber/scrubline/scrubline-demo`, `scrubline-minimap`, `scrubline-compact`, `scrubline-time`.

## Usage

```tsx
import * as Scrubline from "@/components/ui/scrubline"

const segments = [
  { id: "a", start: 0, end: 1200, label: "Intro", color: "#6366f1" },
  { id: "b", start: 1200, end: 5000, label: "Main", color: "#0ea5e9" },
]

export function Example() {
  return (
    <Scrubline.Root count={5000}>
      <Scrubline.Ruler />
      <Scrubline.Viewport>
        <Scrubline.Track>
          <Scrubline.Segments items={segments} />
        </Scrubline.Track>
        <Scrubline.Playhead />
      </Scrubline.Viewport>
    </Scrubline.Root>
  )
}
```

Documentation and live demos: <!-- TODO: replace with the deployed URL --> https://DOCS_URL_PLACEHOLDER (also available locally on the home page, see below).

## Local development

```bash
pnpm install
pnpm dev                    # docs page at http://localhost:3000
pnpm test                   # unit tests
pnpm exec shadcn build      # builds the registry into public/r
```

## License

MIT
