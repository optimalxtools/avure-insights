"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { Button } from "@/components/ui/button"
import { NAV_MAIN } from "@/lib/nav"
import { useModuleAccess } from "@/lib/hooks/useModuleAccess"

function normalizePath(pathname: string | null): string {
  if (!pathname) return ""
  return pathname.replace(/^\/+/, "").replace(/\/+$/, "")
}

const MAIN_SEGMENTS = new Set(
  NAV_MAIN.map((group) => group.url.replace(/^\/+/, "").split("/")[0] ?? "")
)
const ALWAYS_ALLOWED_SEGMENTS = new Set(["organisation", "account"])

function hasModulePermission(path: string, allowedModules: string[]): boolean {
  const normalized = normalizePath(path)
  if (!normalized) return true
  const variants = new Set<string>()
  const direct = normalized
  const topLevel = normalized.split("/")[0] ?? ""
  const withSlash = `/${direct}`
  variants.add(direct)
  variants.add(withSlash)
  if (topLevel) {
    variants.add(topLevel)
    variants.add(`/${topLevel}`)
  }
  const variantsLower = new Set<string>(Array.from(variants).map((value) => value.toLowerCase()))

  return allowedModules.some((entry) => {
    if (!entry) return false
    const trimmed = entry.replace(/^\/+/, "")
    const entryLower = entry.toLowerCase()
    const trimmedLower = trimmed.toLowerCase()
    return (
      variants.has(entry) ||
      variants.has(trimmed) ||
      variantsLower.has(entryLower) ||
      variantsLower.has(trimmedLower)
    )
  })
}

export function ModuleAccessGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { allowedModules, clientId, clientSlug, dataOnly, dataVisible, ready } = useModuleAccess()
  const [isAllowed, setIsAllowed] = React.useState<boolean | null>(null)

  const normalized = React.useMemo(() => normalizePath(pathname), [pathname])
  const topLevel = normalized.split("/")[0] ?? ""
  const overrideToDataOnly = dataOnly === "yes" && dataVisible === "yes"
  const hideDataAcquisition = !overrideToDataOnly && dataVisible === "no"

  const isDataAcquisitionPath = React.useMemo(() => {
    if (!normalized) return false
    if (!topLevel) return false
    return normalized === `${topLevel}/data-acquisition` || normalized.startsWith(`${topLevel}/data-acquisition/`)
  }, [normalized, topLevel])

  React.useEffect(() => {
    if (!ready) return

    if (!normalized) {
      setIsAllowed(true)
      return
    }

    if (!MAIN_SEGMENTS.has(topLevel)) {
      setIsAllowed(true)
      return
    }

    if (ALWAYS_ALLOWED_SEGMENTS.has(topLevel)) {
      setIsAllowed(true)
      return
    }

    if (MAIN_SEGMENTS.has(topLevel)) {
      if (overrideToDataOnly) {
        if (!isDataAcquisitionPath) {
          setIsAllowed(false)
          return
        }
      } else if (hideDataAcquisition && isDataAcquisitionPath) {
        setIsAllowed(false)
        return
      }
    }

    setIsAllowed(hasModulePermission(normalized, allowedModules))
  }, [allowedModules, hideDataAcquisition, isDataAcquisitionPath, normalized, overrideToDataOnly, ready, topLevel])

  if (!ready || isAllowed === null) {
    return null
  }

  if (!isAllowed) {
    return (
      <div className="flex h-full min-h-[60vh] w-full flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Module access required</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            You don&apos;t currently have permission to view this module. If you need access, contact your administrator.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/">Return to dashboard</Link>
        </Button>
      </div>
    )
  }

  return <>{children}</>
}
