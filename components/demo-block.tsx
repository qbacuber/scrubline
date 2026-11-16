import fs from "node:fs"
import path from "node:path"
import type { ReactNode } from "react"
import { codeToHtml } from "shiki"

import { DemoTabs } from "@/components/demo-tabs"

/** Reads registry/default/examples/<name>.tsx at build time and renders Preview / Code tabs. */
export async function DemoBlock({ name, children }: { name: string; children: ReactNode }) {
  const code = fs
    .readFileSync(path.join(process.cwd(), "registry/default/examples", `${name}.tsx`), "utf8")
    .trimEnd()
  const codeHtml = await codeToHtml(code, {
    lang: "tsx",
    themes: { light: "github-light", dark: "github-dark" },
    defaultColor: false,
  })
  return <DemoTabs preview={children} codeHtml={codeHtml} code={code} />
}
