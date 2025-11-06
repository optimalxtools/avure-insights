"use client"

import * as React from "react"
import { STORAGE_KEYS } from "@/lib/config"

const SIDEBAR_CACHE_KEY = STORAGE_KEYS.SIDEBAR_CACHE
const SIDEBAR_CACHE_EVENT = STORAGE_KEYS.SIDEBAR_CACHE_EVENT

export type ModuleAccessSnapshot = {
  allowedModules?: string[]
  showUnsubscribedModules?: boolean
  clientId?: string | null
  clientSlug?: string | null
  dataVisible?: "yes" | "no"
  dataOnly?: "yes" | "no"
}

function readSidebarCache(): ModuleAccessSnapshot | null {
  if (typeof window === "undefined") {
    return null
  }
  try {
    const raw = window.sessionStorage.getItem(SIDEBAR_CACHE_KEY)
    return raw ? (JSON.parse(raw) as ModuleAccessSnapshot) : null
  } catch {
    return null
  }
}

function normalizeSnapshot(snapshot: ModuleAccessSnapshot | null): Required<ModuleAccessSnapshot> {
  return {
    allowedModules: snapshot?.allowedModules ?? [],
    showUnsubscribedModules: Boolean(snapshot?.showUnsubscribedModules),
    clientId: snapshot?.clientId ?? null,
    clientSlug: snapshot?.clientSlug ?? null,
    dataVisible: snapshot?.dataVisible === "no" ? "no" : "yes",
    dataOnly: snapshot?.dataOnly === "yes" ? "yes" : "no",
  }
}

export function useModuleAccess() {
  const getSnapshot = React.useCallback(() => normalizeSnapshot(readSidebarCache()), [])

  const [state, setState] = React.useState(() => {
    const snapshot = getSnapshot()
    return {
      ...snapshot,
      ready: false,
    }
  })

  React.useEffect(() => {
    const sync = () => {
      setState({
        ...getSnapshot(),
        ready: true,
      })
    }

    sync()

    const handleCacheUpdate = (event: Event) => {
      const detail = (event as CustomEvent<ModuleAccessSnapshot | null>).detail ?? null
      setState({
        ...normalizeSnapshot(detail),
        ready: true,
      })
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.storageArea === window.sessionStorage && event.key === SIDEBAR_CACHE_KEY) {
        sync()
      }
    }

    window.addEventListener(SIDEBAR_CACHE_EVENT, handleCacheUpdate as EventListener)
    window.addEventListener("storage", handleStorage)

    return () => {
      window.removeEventListener(SIDEBAR_CACHE_EVENT, handleCacheUpdate as EventListener)
      window.removeEventListener("storage", handleStorage)
    }
  }, [getSnapshot])

  return state
}
