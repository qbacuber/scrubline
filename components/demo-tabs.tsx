"use client"

import * as React from "react"

export function DemoTabs({
  preview,
  codeHtml,
  code,
}: {
  preview: React.ReactNode
  codeHtml: string
  code: string
}) {
  const [tab, setTab] = React.useState<"preview" | "code">("preview")
  const [copied, setCopied] = React.useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }

  const tabClass = (active: boolean) =>
    `rounded-md px-3 py-1 text-sm ${
      active ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground"
    }`

  return (
    <div className="flex flex-col gap-2">
      <div role="tablist" className="flex items-center gap-1">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "preview"}
          className={tabClass(tab === "preview")}
          onClick={() => setTab("preview")}
        >
          Preview
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "code"}
          className={tabClass(tab === "code")}
          onClick={() => setTab("code")}
        >
          Code
        </button>
        {tab === "code" && (
          <button
            type="button"
            onClick={copy}
            className="ml-auto rounded-md border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        )}
      </div>
      <div role="tabpanel" hidden={tab !== "preview"}>
        {preview}
      </div>
      <div
        role="tabpanel"
        hidden={tab !== "code"}
        className="max-h-[32rem] overflow-auto rounded-md border bg-muted text-sm [&_pre]:p-3 [&_pre]:bg-transparent!"
        dangerouslySetInnerHTML={{ __html: codeHtml }}
      />
    </div>
  )
}
