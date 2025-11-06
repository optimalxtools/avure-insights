"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { GalleryVerticalEnd} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail
} from "@/components/ui/sidebar"

import { auth, db } from "@/lib/firebaseClient"
import { onAuthStateChanged } from "firebase/auth"
import {
  collection,
  query,
  where,
  getDocs,
  doc as fsDoc,
  getDoc,
  onSnapshot,
  limit,
} from "firebase/firestore"
import { NAV_MAIN, NAV_AVURE, NAV_ORGANISATION } from "@/lib/nav"
import { UKANYI_CLIENT_ID, UKANYI_CLIENT_SLUG } from "@/lib/client-constants"
import { STORAGE_KEYS } from "@/lib/config"

const SIDEBAR_CACHE_KEY = STORAGE_KEYS.SIDEBAR_CACHE
const SIDEBAR_CACHE_EVENT = STORAGE_KEYS.SIDEBAR_CACHE_EVENT

type SidebarCache = {
  uid: string
  userInfo: { name: string; email: string; avatar?: string } | null
  clientId: string | null
  clientSlug: string | null
  clientName: string
  clientLogo: string | null
  teams: { name: string; logo: React.ComponentType; plan: string }[]
  allowedModules: string[]
  showUnsubscribedModules: boolean
  dataVisible: "yes" | "no"
  dataOnly: "yes" | "no"
}

// 1Ã—1 transparent PNG to keep <img> node stable on SSR/CSR
const TRANSPARENT_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII="

function slugify(value: string | null | undefined): string | null {
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

function computeClientSlug(name: string | null | undefined, id: string | null | undefined) {
  const slugFromName = slugify(name)
  if (slugFromName) return slugFromName
  return slugify(id)
}

function readCache(): SidebarCache | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(SIDEBAR_CACHE_KEY)
    return raw ? (JSON.parse(raw) as SidebarCache) : null
  } catch {
    return null
  }
}

function dispatchCacheEvent(payload: SidebarCache | null) {
  if (typeof window === "undefined") return
  try {
    window.dispatchEvent(new CustomEvent(SIDEBAR_CACHE_EVENT, { detail: payload }))
  } catch {
    /* ignore */
  }
}

function writeCache(c: SidebarCache) {
  try {
    sessionStorage.setItem(SIDEBAR_CACHE_KEY, JSON.stringify(c))
  } catch {
    /* ignore */
  }
  dispatchCacheEvent(c)
}

function clearCache() {
  try {
    sessionStorage.removeItem(SIDEBAR_CACHE_KEY)
  } catch {
    /* ignore */
  }
  dispatchCacheEvent(null)
}

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const isActive = React.useCallback(
    (url: string) => pathname.startsWith(url),
    [pathname]
  )

  // SSR-safe initial state (deterministic)
  const [userInfo, setUserInfo] = React.useState<{
    name: string
    email: string
    avatar?: string
  } | null>(null)
  const [clientName, setClientName] = React.useState<string>("")
  const [clientLogo, setClientLogo] = React.useState<string | null>(null)
  const [, setTeams] = React.useState<
    { name: string; logo: React.ComponentType; plan: string }[]
  >([])
  const [allowedModules, setAllowedModules] = React.useState<string[]>([])
  const [loadingClient, setLoadingClient] = React.useState<boolean>(true)
  const [showUnsubscribedModules, setShowUnsubscribedModules] =
    React.useState<boolean>(false)
  const [clientId, setClientId] = React.useState<string | null>(null)
  const [clientSlugValue, setClientSlugValue] = React.useState<string | null>(null)
  const [dataVisible, setDataVisible] = React.useState<"yes" | "no">("yes")
  const [dataOnly, setDataOnly] = React.useState<"yes" | "no">("no")

  React.useEffect(() => {
    let mounted = true
    let unsubModules: (() => void) | null = null

    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!mounted) return

      if (unsubModules) {
        unsubModules()
        unsubModules = null
      }

      if (!u) {
        setUserInfo(null)
        setClientName("")
        setClientLogo(null)
        setTeams([])
        setAllowedModules([])
        setShowUnsubscribedModules(false)
        setClientId(null)
        setClientSlugValue(null)
        setDataVisible("yes")
        setDataOnly("no")
        setLoadingClient(false)
        clearCache()
        return
      }

      let clientIdFromUser: string | undefined
      let clientSlug: string | null = null
      let cachedLogo: string | null = null
      let nextDataVisible: "yes" | "no" = "yes"
      let nextDataOnly: "yes" | "no" = "no"

      const cached = readCache()
      if (cached && cached.uid === u.uid) {
        setUserInfo(cached.userInfo)
        setClientName(cached.clientName)
        setClientLogo(cached.clientLogo)
        setTeams(cached.teams)
        setAllowedModules(cached.allowedModules)
        setShowUnsubscribedModules(cached.showUnsubscribedModules || false)
        setLoadingClient(false)
        clientIdFromUser = cached.clientId ?? clientIdFromUser
        clientSlug = cached.clientSlug ?? clientSlug
        cachedLogo = cached.clientLogo ?? cachedLogo
        setClientId(cached.clientId ?? null)
        setClientSlugValue(cached.clientSlug ?? null)
        nextDataVisible = cached.dataVisible ?? "yes"
        nextDataOnly = cached.dataOnly ?? "no"
      }

      const normalizedEmail = (u.email ?? "").toLowerCase().trim()
      let firstName =
        u.displayName?.split(" ")[0] ||
        normalizedEmail.split("@")[0].split(/[._-]/)[0] ||
        ""
      let lastName = u.displayName?.split(" ").slice(1).join(" ") || ""
      let effectiveEmail = u.email ?? ""

      try {
        await u.getIdToken(false)
      } catch (err) {
        console.warn("[Sidebar] Token read failed:", err)
      }

      let userModules: string[] = []
      let userDoc: ReturnType<typeof fsDoc> | null = null
      let clientModVisible = false

      try {
        if (normalizedEmail) {
          const qUsers = query(
            collection(db, "users"),
            where("email", "==", normalizedEmail),
            limit(1)
          )
          const snap = await getDocs(qUsers)
          if (!snap.empty) {
            const rawData = snap.docs[0].data() as {
              firstName?: string
              lastName?: string
              email?: string
              clientId?: string
              clientID?: string
              modules?: string[]
            }
            firstName = rawData.firstName || firstName
            lastName = rawData.lastName || lastName
            effectiveEmail = rawData.email || effectiveEmail
            clientIdFromUser = rawData.clientId || rawData.clientID
            userModules = rawData.modules || []
            userDoc = snap.docs[0].ref
          }
        }
      } catch (err) {
        console.error("[Sidebar] Users lookup error:", err)
      }

      if (!clientIdFromUser && u.uid) {
        try {
          const docRef = fsDoc(db, "users", u.uid)
          const uidDoc = await getDoc(docRef)
          if (uidDoc.exists()) {
            const data = uidDoc.data() as {
              firstName?: string
              lastName?: string
              email?: string
              clientId?: string
              clientID?: string
              modules?: string[]
            }
            firstName = data.firstName || firstName
            lastName = data.lastName || lastName
            effectiveEmail = data.email || effectiveEmail
            clientIdFromUser = data.clientId || data.clientID
            userModules = data.modules || userModules
            userDoc = docRef
          }
        } catch (err) {
          console.warn("[Sidebar] UID lookup failed:", err)
        }
      }

      setLoadingClient(true)

      let cName: string = "Unknown organisation"
      let cLogo: string | null = cachedLogo ?? null
      let teamList = [
        { name: "Unknown organisation", logo: GalleryVerticalEnd, plan: "Enterprise" },
      ]

      try {
        if (clientIdFromUser) {
          const cSnap = await getDoc(fsDoc(db, "clients", clientIdFromUser))
          if (cSnap.exists()) {
            const c = cSnap.data() as {
              name?: string
              logo?: string
              modVisible?: string
              dataVisible?: string
              dataOnly?: string
            }

            cName = c.name || cName
            clientSlug = computeClientSlug(cName, clientIdFromUser ?? null) || clientSlug
            const docLogo = c.logo ? `/${c.logo}` : null
            const derivedLogo = clientSlug ? `/data/${clientSlug}/logo.png` : null
            const finalLogo = docLogo && !docLogo.startsWith("/logo_")
              ? docLogo
              : derivedLogo ?? docLogo ?? cLogo
            cLogo = finalLogo ?? cLogo
            clientModVisible = c.modVisible?.toLowerCase() === "yes"
            const normalizedDataVisible = (c.dataVisible ?? "yes").toLowerCase() === "no" ? "no" : "yes"
            const normalizedDataOnly = (c.dataOnly ?? "no").toLowerCase() === "yes" ? "yes" : "no"
            teamList = [
              { name: c.name || "Unknown organisation", logo: GalleryVerticalEnd, plan: "Enterprise" },
            ]

            setClientName(c.name || "Unknown organisation")
            setClientLogo(cLogo)
            setTeams(teamList)
            setShowUnsubscribedModules(clientModVisible)
            nextDataVisible = normalizedDataVisible
            nextDataOnly = normalizedDataOnly
          } else {
            console.warn("[Sidebar] client doc missing for clientId:", clientIdFromUser)
            setClientName("Unknown organisation")
            clientSlug = computeClientSlug(null, clientIdFromUser ?? null) || clientSlug
            const derivedLogo = clientSlug ? `/data/${clientSlug}/logo.png` : null
            cLogo = derivedLogo ?? cLogo
            setClientLogo(cLogo)
            setTeams(teamList)
            setShowUnsubscribedModules(false)
            nextDataVisible = "yes"
            nextDataOnly = "no"
          }
        } else {
          console.log("[Sidebar] No clientId found for user:", normalizedEmail)
          setClientName("Unknown organisation")
          const derivedLogo = clientSlug ? `/data/${clientSlug}/logo.png` : null
          cLogo = derivedLogo ?? cLogo
          setClientLogo(cLogo)
          setTeams(teamList)
          setShowUnsubscribedModules(false)
          nextDataVisible = "yes"
          nextDataOnly = "no"
        }
      } catch (err) {
        console.warn("[Sidebar] client lookup failed (rules or data):", err)
        setClientName("Unknown organisation")
        clientSlug = computeClientSlug(cName, clientIdFromUser ?? null) || clientSlug
        const derivedLogo = clientSlug ? `/data/${clientSlug}/logo.png` : null
        cLogo = derivedLogo ?? cLogo
        setClientLogo(cLogo)
        setTeams(teamList)
        setShowUnsubscribedModules(false)
        nextDataVisible = "yes"
        nextDataOnly = "no"
      } finally {
        setLoadingClient(false)
      }

      if (!clientSlug) {
        clientSlug = computeClientSlug(cName, clientIdFromUser ?? null)
      }
      if (!cLogo && clientSlug) {
        cLogo = `/data/${clientSlug}/logo.png`
        setClientLogo(cLogo)
      }

      setClientId(clientIdFromUser ?? null)
      setClientSlugValue(clientSlug ?? null)

      const info = {
        name: `${firstName.trim()} ${lastName.trim()}`.trim() || "Unknown User",
        email: effectiveEmail || "",
        avatar: u.photoURL || undefined,
      }

      setUserInfo(info)
      setAllowedModules(userModules)
      setDataVisible(nextDataVisible)
      setDataOnly(nextDataOnly)

      const builtCache: SidebarCache = {
        uid: u.uid,
        userInfo: info,
        clientId: clientIdFromUser ?? null,
        clientSlug: clientSlug ?? null,
        clientName: cName,
        clientLogo: cLogo,
        teams: teamList,
        allowedModules: userModules,
        showUnsubscribedModules: clientModVisible,
        dataVisible: nextDataVisible,
        dataOnly: nextDataOnly,
      }
      writeCache(builtCache)

      if (userDoc) {
        unsubModules = onSnapshot(userDoc, (snap) => {
          const data = snap.data() as { modules?: string[] } | undefined
          const mods = data?.modules || []
          setAllowedModules(mods)
          const current = readCache()
          if (current && current.uid === u.uid) {
              writeCache({ ...current, allowedModules: mods })
          }
        })
      }
    })

    return () => {
      mounted = false
      unsub()
      if (unsubModules) unsubModules()
    }
  }, [])

  const hasAccess = React.useCallback((url: string) => {
    const normalized = url.replace(/^\/+/, "")
    const topLevel = normalized.split("/")[0] ?? ""
    const variants = new Set<string>()
    variants.add(url)
    variants.add(normalized)
    variants.add(`/${normalized}`)
    if (topLevel) {
      variants.add(topLevel)
      variants.add(`/${topLevel}`)
    }
    const variantsLower = new Set(Array.from(variants).map((value) => value.toLowerCase()))

    return allowedModules.some((entry) => {
      if (!entry) return false
      const trimmed = entry.replace(/^\/+/, "")
      return (
        variants.has(entry) ||
        variants.has(trimmed) ||
        variantsLower.has(entry.toLowerCase()) ||
        variantsLower.has(trimmed.toLowerCase())
      )
    })
  }, [allowedModules])

  const navMain = React.useMemo(() => {
    const overrideToDataOnly = dataOnly === "yes" && dataVisible === "yes"
    const hideDataAcquisition = !overrideToDataOnly && dataVisible === "no"

    return NAV_MAIN.map((mod) => {
      const processedItems = mod.items.map((sub) => {
        const isDataAcquisition = sub.title === "Data Acquisition"
        const forcedHidden = overrideToDataOnly ? !isDataAcquisition : hideDataAcquisition && isDataAcquisition
        const baseDisabled = !hasAccess(sub.url)
        const forcedDisabled = forcedHidden || baseDisabled
        return {
          ...sub,
          isActive: isActive(sub.url),
          disabled: forcedDisabled,
          shouldRender: !forcedHidden,
        }
      })

      const hasEnabledItem = processedItems.some((item) => item.shouldRender && !item.disabled)
      const visibleItems = processedItems.filter((item) => {
        if (!item.shouldRender) return false
        if (showUnsubscribedModules) {
          return true
        }
        return !item.disabled
      })

      const cleanedItems = visibleItems.map((item) => {
        const { shouldRender, ...rest } = item
        void shouldRender
        return rest
      })

      return {
        title: mod.title,
        icon: mod.icon,
        url: mod.url,
        isActive: cleanedItems.some((s) => s.isActive && !s.disabled),
        items: cleanedItems,
        disabled: !hasEnabledItem,
      }
    }).filter((mod) => (showUnsubscribedModules ? true : !mod.disabled))
  }, [dataOnly, dataVisible, hasAccess, isActive, showUnsubscribedModules])

  const navOrganisation = React.useMemo(
    () =>
      NAV_ORGANISATION.map((group) => {
        const processedItems = group.items.map((item) => ({
          ...item,
          isActive: isActive(item.url),
        }))
        return {
          title: group.title,
          icon: group.icon,
          url: group.url,
          isActive: processedItems.some((item) => item.isActive),
          items: processedItems,
        }
      }),
    [isActive]
  )

  const navAvure = React.useMemo(
    () => {
      const forceShowAvure = clientId === UKANYI_CLIENT_ID || clientSlugValue === UKANYI_CLIENT_SLUG
      if (!forceShowAvure) {
        return []
      }

      const overrideToDataOnly = dataOnly === "yes" && dataVisible === "yes"
      const hideDataAcquisition = !overrideToDataOnly && dataVisible === "no"

      return NAV_AVURE.map((mod) => {
        const processedItems = mod.items.map((sub) => {
          const isDataAcquisition = sub.title === "Data Acquisition"
          const forcedHidden = overrideToDataOnly ? !isDataAcquisition : hideDataAcquisition && isDataAcquisition
          const baseDisabled = !hasAccess(sub.url)
          const forcedDisabled = forcedHidden || baseDisabled
          return {
            ...sub,
            isActive: isActive(sub.url),
            disabled: forcedDisabled,
            shouldRender: !forcedHidden,
          }
        })

        // If forceShowAvure, include Avure items but still hide those the user can't access.
        const visibleItems = processedItems.filter((s) => {
          if (!s.shouldRender) return false
          if (showUnsubscribedModules) {
            return true
          }
          return !s.disabled
        })

        const cleanedItems = visibleItems.map((item) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { shouldRender, ...rest } = item
          return rest
        })

        const moduleDisabled = cleanedItems.length === 0

        return {
          title: mod.title,
          icon: mod.icon,
          url: mod.url,
          isActive: cleanedItems.some((s) => s.isActive),
          items: cleanedItems,
          disabled: moduleDisabled,
        }
      })
    },
    [clientId, clientSlugValue, hasAccess, isActive, dataOnly, dataVisible, showUnsubscribedModules]
  )

  const fallbackUser = userInfo ?? { name: "Loading", email: "" }
  const orgLabel = loadingClient ? "Loading" : clientName || "Unknown organisation"

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <Link href="/" aria-label="Home" className="flex items-center gap-2">
          <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg border overflow-hidden">
            <Image
              src={clientLogo ?? TRANSPARENT_PNG}
              alt={orgLabel}
              width={32}
              height={32}
              unoptimized
            />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate font-semibold">{orgLabel}</span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {/* Organisation */}
        {navOrganisation.length > 0 && (
          <NavMain title="Overview" items={navOrganisation} forceDefaultOpen />
        )}

        {/* Modules */}
        {navMain.length > 0 && (
          <NavMain title="Modules" items={navMain} />
        )}
        {navAvure.length > 0 && (
          <>
            <NavMain title="Avure" items={navAvure} />
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="sticky bottom-0 z-10 bg-sidebar shrink-0">
        <NavUser user={fallbackUser} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
