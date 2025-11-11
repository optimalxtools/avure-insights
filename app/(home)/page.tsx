"use client"

import { useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  limit,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'

import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { type LucideIcon } from 'lucide-react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { NAV_MAIN, NAV_ORGANISATION } from '@/lib/nav'
import type { NavGroup } from '@/lib/nav'
import { useClientDatasetPaths } from '@/lib/hooks/useClientDatasetPaths'
import { cn } from '@/lib/utils'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'

function formatName(
  displayName?: string | null,
  email?: string | null,
  firstName?: string | null,
  lastName?: string | null
) {
  if (firstName || lastName) return `${firstName}`.trim()
  if (displayName && displayName.trim().length > 0) return displayName
  if (!email) return 'User'
  const firstPart = email.split('@')[0]
  const formatted = firstPart
    .split(/[._]/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(' ')
  return formatted.length > 0 ? formatted : 'User'
}

type ModuleCard = {
  key: string
  label: string
  href: string
  icon: LucideIcon
  category: 'organisation' | 'main'
  dataHref?: string
}

function buildModuleCards(groups: NavGroup[], category: ModuleCard['category']): ModuleCard[] {
  return groups.map((group) => {
    const key = group.url.replace(/^\/+/g, '').split('/')[0] || group.title.toLowerCase().replace(/\s+/g, '-')
    const primaryItem =
      group.items.find((item) => item.title.toLowerCase() === 'overview') ||
      group.items[0]
    const href = primaryItem?.url || group.url || `/${key}`
    const dataItem = group.items.find((item) => item.title.toLowerCase() === 'data acquisition')
    return {
      key,
      label: group.title,
      href,
      icon: group.icon,
      category: category,
      dataHref: dataItem?.url,
    }
  })
}

const MODULE_CARDS: ModuleCard[] = [
  ...buildModuleCards(NAV_ORGANISATION, 'organisation'),
  ...buildModuleCards(NAV_MAIN, 'main'),
]

function normalizeModules(modules?: unknown): string[] {
  if (!Array.isArray(modules)) return []
  const entries = new Set<string>()
  for (const mod of modules) {
    if (typeof mod !== 'string') continue
    const lower = mod.trim().toLowerCase()
    if (!lower) continue
    const noLeading = lower.replace(/^\/+/g, '')
    if (!noLeading) continue
    entries.add(lower)
    entries.add(noLeading)
    entries.add(`/${noLeading}`)
    const topLevel = noLeading.split('/')[0]
    if (topLevel) {
      entries.add(topLevel)
      entries.add(`/${topLevel}`)
    }
  }
  return Array.from(entries)
}

export default function Page() {
  const [greetingName, setGreetingName] = useState('User')
  const [clientName, setClientName] = useState('')
  const [allowedModules, setAllowedModules] = useState<string[]>([])
  const [modulesLoaded, setModulesLoaded] = useState(false)
  const { logoPath, clientSlug } = useClientDatasetPaths()
  const [heroLogoSrc, setHeroLogoSrc] = useState('/logo_avure.png')
  const [clientId, setClientId] = useState<string | null>(null)
  const [showUnsubscribedModules, setShowUnsubscribedModules] = useState(false)
  const [dataVisibleFlag, setDataVisibleFlag] = useState<'yes' | 'no'>('yes')
  const [dataOnlyFlag, setDataOnlyFlag] = useState<'yes' | 'no'>('no')

  useEffect(() => {
    setHeroLogoSrc(logoPath ?? '/logo_avure.png')
  }, [logoPath])

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setGreetingName('User')
        setClientName('')
        setAllowedModules([])
        setClientId(null)
        setShowUnsubscribedModules(false)
        setDataVisibleFlag('yes')
        setDataOnlyFlag('no')
        setModulesLoaded(true)
        return
      }

      setModulesLoaded(false)

      const normalizedEmail = u.email?.toLowerCase().trim()

      let firstName = ''
      let lastName = ''
      let currentClientId: string | undefined
      let userModules: string[] = []
      let nextDataVisible: 'yes' | 'no' = 'yes'
      let nextDataOnly: 'yes' | 'no' = 'no'

      try {
        if (normalizedEmail) {
          const qUsers = query(
            collection(db, 'users'),
            where('email', '==', normalizedEmail),
            limit(1)
          )
          const snap = await getDocs(qUsers)
          if (!snap.empty) {
            const data = snap.docs[0].data() as {
              firstName?: string
              lastName?: string
              clientId?: string
              clientID?: string
              modules?: string[]
            }
            firstName = data.firstName ?? ''
            lastName = data.lastName ?? ''
            currentClientId = data.clientId || data.clientID
            const docModules = normalizeModules(data.modules)
            if (docModules.length > 0 || Object.prototype.hasOwnProperty.call(data, 'modules')) {
              userModules = docModules
            }
          }
        }

        if (!currentClientId && u.uid) {
          const uidDoc = await getDoc(doc(db, 'users', u.uid))
          if (uidDoc.exists()) {
            const data = uidDoc.data() as {
              firstName?: string
              lastName?: string
              clientId?: string
              clientID?: string
              modules?: string[]
            }
            firstName = data.firstName ?? firstName
            lastName = data.lastName ?? lastName
            currentClientId = data.clientId || data.clientID
            const docModules = normalizeModules(data.modules)
            if (docModules.length > 0 || Object.prototype.hasOwnProperty.call(data, 'modules')) {
              userModules = docModules
            }
          }
        }

        let cName = ''
        if (currentClientId) {
          const cSnap = await getDoc(doc(db, 'clients', currentClientId))
          if (cSnap.exists()) {
            const cData = cSnap.data() as { name?: string; modVisible?: string; dataVisible?: string; dataOnly?: string }
            cName = cData.name ?? ''
            setShowUnsubscribedModules((cData.modVisible ?? '').toLowerCase() === 'yes')
            nextDataVisible = (cData.dataVisible ?? 'yes').toLowerCase() === 'no' ? 'no' : 'yes'
            nextDataOnly = (cData.dataOnly ?? 'no').toLowerCase() === 'yes' ? 'yes' : 'no'
          } else {
            setShowUnsubscribedModules(false)
            nextDataVisible = 'yes'
            nextDataOnly = 'no'
          }
        } else {
          setShowUnsubscribedModules(false)
          nextDataVisible = 'yes'
          nextDataOnly = 'no'
        }

        setGreetingName(
          formatName(u.displayName ?? '', u.email ?? '', firstName, lastName)
        )
        setClientName(cName)
      } catch (err) {
        console.error('Error retrieving user/client information', err)
        setGreetingName(formatName(u.displayName ?? '', u.email ?? ''))
        setShowUnsubscribedModules(false)
  setDataVisibleFlag('yes')
  setDataOnlyFlag('no')
      } finally {
        setAllowedModules(userModules)
        setClientId(currentClientId ?? null)
        setDataVisibleFlag(nextDataVisible)
        setDataOnlyFlag(nextDataOnly)
        setModulesLoaded(true)
      }
    })
    return () => unsub()
  }, [])

  const allowedModulesSet = useMemo(() => new Set(allowedModules), [allowedModules])

  const overrideToDataOnly = useMemo(
    () => dataOnlyFlag === 'yes' && dataVisibleFlag === 'yes',
    [dataOnlyFlag, dataVisibleFlag]
  )

  const renderedModules = useMemo(() => {
    return MODULE_CARDS.map((module) => {
      const targetHref = overrideToDataOnly && module.category === 'main' && module.dataHref
        ? module.dataHref
        : module.href
      const normalizedHref = targetHref.trim().toLowerCase().replace(/^\/+/, '')
      const topLevel = module.key
      const isOrganisation = module.category === 'organisation'
      const isExplicitlyAllowed =
        allowedModulesSet.has(normalizedHref) ||
        allowedModulesSet.has(`/${normalizedHref}`) ||
        allowedModulesSet.has(topLevel) ||
        allowedModulesSet.has(`/${topLevel}`)

      const isAllowed =
        isOrganisation ||
        isExplicitlyAllowed

      const shouldRender =
        isAllowed ||
        (showUnsubscribedModules && !isOrganisation)

      return {
        ...module,
        href: targetHref,
        isAllowed,
        shouldRender,
      }
    }).filter((module) => module.shouldRender)
  }, [allowedModulesSet, overrideToDataOnly, showUnsubscribedModules])

  const hasAccessibleNonOrganisation = renderedModules.some(
    (module) => module.category !== 'organisation' && module.isAllowed
  )

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 bg-white">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage></BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-6 p-4 pt-0 bg-white">
        <div className="container max-w-6xl mx-auto flex flex-col">
          {/* Centered hero + module grid */}
          <div className="flex justify-center py-6 sm:py-8">
            <div className="w-full max-w-5xl px-2 sm:px-4">
              <div className="text-center mb-2 sm:mb-4 md:mb-6 space-y-1.5">
                <div className="flex justify-center mb-4 md:mb-6">
                  <Image
                    src={heroLogoSrc}
                    alt={clientName || 'Client logo'}
                    width={160}
                    height={44}
                    priority
                  />
                </div>
                <p className="text-muted-foreground">
                  {clientName || 'Start exploring your insights.'}
                 </p>
                <h1 className="text-3xl sm:text-4xl font-bold">Welcome {greetingName}</h1>
                <p className="text-base sm:text-lg text-muted-foreground">
                  {new Date().toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
              <div className="mx-auto w-full max-w-[70rem] mt-8 sm:mt-6">
                  {/* Mobile layout */}
                  <div className="flex flex-col gap-4 sm:hidden">
                    {renderedModules.map(({ key, href, label, icon: Icon, isAllowed, category }) => {
                      const isDisabled = modulesLoaded && !isAllowed
                      const isOrganisation = key === 'organisation'
                      return (
                      <Button
                        key={key}
                        asChild
                          className={cn(
                            '!h-[7rem] w-full text-xl',
                            isOrganisation
                              ? 'bg-[#181818] text-neutral-400 hover:bg-neutral-800'
                              : 'bg-sidebar text-sidebar-foreground hover:bg-sidebar-accent',
                            isDisabled && 'opacity-40 pointer-events-none'
                          )}
                      >
                        <Link
                          href={href}
                            className="flex h-full w-full flex-row items-center justify-center gap-3"
                            aria-disabled={isDisabled || undefined}
                            tabIndex={isDisabled ? -1 : undefined}
                        >
                          <Icon className="!h-10 !w-10" />
                          <span>{label}</span>
                          {overrideToDataOnly && category === 'main' ? (
                            <span className="text-xs text-muted-foreground">Data Acquisition</span>
                          ) : null}
                        </Link>
                      </Button>
                      )
                    })}
                  </div>

                  {/* Desktop / tablet layout */}
                  <div className="hidden w-full justify-center gap-4 md:gap-5 lg:gap-6 px-2 sm:flex sm:flex-nowrap sm:px-0">
                    {renderedModules.map(({ key, href, label, icon: Icon, isAllowed, category }) => {
                      const isDisabled = modulesLoaded && !isAllowed
                      const isOrganisation = key === 'organisation'
                      return (
                      <Button
                        key={key}
                        asChild
                          className={cn(
                            'h-32 w-32 flex-none text-base md:h-40 md:w-40 md:text-lg',
                            isOrganisation
                              ? 'bg-[#181818] text-neutral-400 hover:bg-neutral-800'
                              : 'bg-sidebar text-sidebar-foreground hover:bg-sidebar-accent',
                            isDisabled && 'opacity-40 pointer-events-none'
                          )}
                      >
                        <Link
                          href={href}
                            className="flex h-full w-full flex-col items-center justify-center gap-3"
                            aria-disabled={isDisabled || undefined}
                            tabIndex={isDisabled ? -1 : undefined}
                        >
                          <Icon className="!h-12 !w-12 md:!h-16 md:!w-16" />
                          <span>{label}</span>
                          {overrideToDataOnly && category === 'main' ? (
                            <span className="text-xs text-muted-foreground">Data Acquisition</span>
                          ) : null}
                        </Link>
                      </Button>
                      )
                    })}
                  </div>
              </div>
              {modulesLoaded && !hasAccessibleNonOrganisation ? (
                <div className="mt-6 rounded-lg border border-dashed py-6 text-center text-sm sm:text-base text-muted-foreground">
                  You currently do not have access to these modules. Reach out to your administrator if you believe this is an error.
                </div>
              ) : null}
              {/* Footer meta */}
              <div className="mt-10 text-center text-xs text-muted-foreground space-y-3">
                <div>
                  <span>&copy; {new Date().getFullYear()} Avure</span>
                  <span className="mx-2">&middot;</span>
                  <span>Version v1.0.2</span>
                  <span className="mx-2">&middot;</span>
                  <span>All rights reserved</span>
                </div>
                <div className="flex justify-center pt-4">
                  <div className="h-20 md:h-28 w-auto flex items-center" style={{ minHeight: '5rem' }}>
                    <Image
                      src="/logo_avure.png"
                      alt="Avure"
                      width={460}
                      height={124}
                      priority={true}
                      sizes="(max-width: 640px) 280px, (max-width: 1024px) 380px, 460px"
                      className="h-full w-auto"
                      style={{ maxHeight: '7rem' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}







