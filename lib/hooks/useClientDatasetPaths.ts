"use client"

import * as React from "react"
import { STORAGE_KEYS } from "@/lib/config"

const SIDEBAR_CACHE_KEY = STORAGE_KEYS.SIDEBAR_CACHE
const SIDEBAR_CACHE_EVENT = STORAGE_KEYS.SIDEBAR_CACHE_EVENT
const MASTER_CONFIG_VERSION = "2"

type SidebarCacheSnapshot = {
  clientId?: string | null
  clientName?: string | null
  clientSlug?: string | null
}

export type ClientDatasetPaths = {
  clientSlug: string | null
  masterConfigPath: string | null
  logoPath: string | null
}

const EMPTY_PATHS: ClientDatasetPaths = {
  clientSlug: null,
  masterConfigPath: null,
  logoPath: null,
}

function slugifyClient(value: string | null | undefined): string | null {
  if (!value) return null
  let cleaned = value.trim()
  if (typeof cleaned.normalize === "function") {
    cleaned = cleaned.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
  }
  const slug = cleaned
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return slug.length > 0 ? slug : null
}

function readSidebarCache(): SidebarCacheSnapshot | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(SIDEBAR_CACHE_KEY)
    return raw ? (JSON.parse(raw) as SidebarCacheSnapshot) : null
  } catch {
    return null
  }
}

function computePaths(cache?: SidebarCacheSnapshot | null): ClientDatasetPaths {
  const snapshot = cache ?? readSidebarCache()
  const slug =
    slugifyClient(snapshot?.clientSlug ?? undefined) ??
    slugifyClient(snapshot?.clientName ?? undefined) ??
    slugifyClient(snapshot?.clientId ?? undefined)

  if (!slug) {
    return { ...EMPTY_PATHS }
  }

  const base = `/data/${slug}`

  return {
    clientSlug: slug,
    masterConfigPath: `${base}/master-config.csv?v=${MASTER_CONFIG_VERSION}`,
    logoPath: `${base}/logo.png`,
  }
}

function arePathsEqual(a: ClientDatasetPaths, b: ClientDatasetPaths): boolean {
  return (
    a.clientSlug === b.clientSlug &&
    a.masterConfigPath === b.masterConfigPath &&
    a.logoPath === b.logoPath
  )
}

export function useClientDatasetPaths(): ClientDatasetPaths {
  const getInitialPaths = React.useCallback(() => {
    if (typeof window === "undefined") return { ...EMPTY_PATHS }
    return computePaths()
  }, [])

  const [paths, setPaths] = React.useState<ClientDatasetPaths>(() => getInitialPaths())

  React.useEffect(() => {
    setPaths((current) => {
      const next = getInitialPaths()
      return arePathsEqual(current, next) ? current : next
    })
  }, [getInitialPaths])

  React.useEffect(() => {
    if (typeof window === "undefined") return

    const handleCacheUpdate = (event: Event) => {
      const detail = (event as CustomEvent<SidebarCacheSnapshot | null>).detail ?? null
      setPaths((current) => {
        const next = computePaths(detail)
        return arePathsEqual(current, next) ? current : next
      })
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.storageArea === window.sessionStorage && event.key === SIDEBAR_CACHE_KEY) {
        setPaths((current) => {
          const next = computePaths()
          return arePathsEqual(current, next) ? current : next
        })
      }
    }

    window.addEventListener(SIDEBAR_CACHE_EVENT, handleCacheUpdate as EventListener)
    window.addEventListener("storage", handleStorage)

    return () => {
      window.removeEventListener(SIDEBAR_CACHE_EVENT, handleCacheUpdate as EventListener)
      window.removeEventListener("storage", handleStorage)
    }
  }, [])

  return paths
}
