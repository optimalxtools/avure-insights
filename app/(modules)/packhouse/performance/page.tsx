"use client"

import * as React from "react"
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Lock, Unlock, ChevronDown, RotateCcw, RefreshCcw } from "lucide-react"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { RangeCalendar } from "@/components/ui/range-calendar"
import { useMasterConfigFilters } from "@/lib/hooks/useMasterConfigFilters"
import { FILTER_WRAPPER_CLASS } from "@/lib/filter-styles"
import { usePackhouseData, type PackhouseRecord } from "../utils/usePackhouseData"
import { ExportButton } from "@/components/export-button"

import { MetricsPage } from "./components/pages/metrics"
import type { Granularity } from "./components/charts/packing-analytics"
import { InsightsPage } from "./components/pages/insights"
import { SectionTitle } from "@/components/section-title"
import { cn } from "@/lib/utils"
import { LOCKED_SELECT_TRIGGER_CLASS } from "@/lib/select"
import { AIButton } from "@/components/ai-button"
import { usePDFExport } from "@/lib/hooks/usePDFExport"
import { useClientDatasetPaths } from "@/lib/hooks/useClientDatasetPaths"
import { STORAGE_KEYS } from "@/lib/config"

/* eslint-disable react-hooks/exhaustive-deps */

export default function Page() {
  const { exportReport, isExporting } = usePDFExport()
  const { logoPath } = useClientDatasetPaths()
  
  // Get client name from sessionStorage
  const getClientName = React.useCallback(() => {
    if (typeof window === "undefined") return "Vera Insights"
    try {
      const cache = window.sessionStorage.getItem(STORAGE_KEYS.SIDEBAR_CACHE)
      if (cache) {
        const parsed = JSON.parse(cache)
        return parsed.clientName || "Vera Insights"
      }
    } catch (err) {
      console.error("Error reading client name:", err)
    }
    return "Vera Insights"
  }, [])
  const {
    data: packhouseData,
    isLoading: isDataLoading,
    isRefreshing: isDataRefreshing,
    seasons,
    refresh: refreshPackhouseData,
    lastUpdatedAt: packhouseLastUpdatedAt,
  } = usePackhouseData()

  const {
    loading: configLoading,
    error: configError,
    variety,
    block,
    puc,
    season,
    setVariety,
    setBlock,
    setPuc,
    setSeason,
  resetVariety,
  resetBlock,
  resetPuc,
  resetSeason,
    lockVariety,
    lockBlock,
    lockPuc,
    lockSeason,
    setLockVariety,
    setLockBlock,
    setLockPuc,
    setLockSeason,
    varietyOptions,
    blockOptions,
    pucOptions,
    seasonOptions,
    formatLabel,
    formatBlockLabel,
  defaultVarietyValue,
  defaultBlockValue,
  defaultPucValue,
  defaultSeasonValue,
    allVarietiesValue,
    allBlocksValue,
    allPucsValue,
    getBlockPucs,
  } = useMasterConfigFilters({
    sharedKey: "filters:shared",
    pageKey: "filters:packhouse:performance",
    seasons,
    autoSelectFirstVariety: true,
    autoSelectFirstSeason: true,
  })

  const [frequency, setFrequency] = React.useState<Granularity>("weekly")
  const [rangeStart, setRangeStart] = React.useState<string>("")
  const [rangeEnd, setRangeEnd] = React.useState<string>("")
  const [rangeDirty, setRangeDirty] = React.useState(false)
  const [showPrevSeason, setShowPrevSeason] = React.useState(false)
  const [progressPrevAvailable, setProgressPrevAvailable] = React.useState(false)
  const [distributorPrevAvailable, setDistributorPrevAvailable] = React.useState(false)

  const prevSeasonAvailable = progressPrevAvailable || distributorPrevAvailable

  const [refreshHydrated, setRefreshHydrated] = React.useState(false)
  React.useEffect(() => { setRefreshHydrated(true) }, [])

  const refreshStatus = React.useMemo(() => {
    if (!refreshHydrated) {
      return { full: "Never", compact: "Never" }
    }

    if (!packhouseLastUpdatedAt) {
      const label = isDataLoading ? "Loading..." : "Never"
      return { full: label, compact: label }
    }
    const date = new Date(packhouseLastUpdatedAt)
    if (Number.isNaN(date.getTime())) {
      return { full: "Unknown", compact: "Unknown" }
    }
    return {
      full: date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }),
      compact: date.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }),
    }
  }, [packhouseLastUpdatedAt, isDataLoading, refreshHydrated])

  const fmt = React.useCallback((d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const da = String(d.getDate()).padStart(2, "0")
    return `${y}-${m}-${da}`
  }, [])

  const fmtDisplay = React.useCallback((iso?: string) => {
    if (!iso) return ""
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ""
    const dd = String(d.getDate()).padStart(2, "0")
    const mon = d.toLocaleString(undefined, { month: "short" })
    return `${dd}-${mon}`
  }, [])

  const handleRefreshData = React.useCallback(() => {
    refreshPackhouseData().catch((err) => {
      console.error("Failed to refresh packhouse data:", err)
    })
  }, [refreshPackhouseData])

  // Auto-refresh data on page mount
  React.useEffect(() => {
    handleRefreshData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleExportReport = React.useCallback(async () => {
    await exportReport({
      metadata: {
        title: "Packhouse_Performance",
        moduleName: "Packhouse",
        pageName: "Performance",
        companyName: getClientName(),
        logoUrl: logoPath || "/logo_vera.png",
        filters: {
          Variety: variety === allVarietiesValue ? "All Varieties" : formatLabel(variety),
          Block: block === allBlocksValue ? "All Blocks" : formatBlockLabel(block),
          PUC: puc === allPucsValue ? "All PUCs" : formatLabel(puc),
          Season: season || "N/A",
          Frequency: frequency.charAt(0).toUpperCase() + frequency.slice(1),
          ...(rangeStart && rangeEnd
            ? { "Date Range": `${fmtDisplay(rangeStart)} - ${fmtDisplay(rangeEnd)}` }
            : {}),
        },
      },
      charts: [
        { elementId: "packing-analytics-chart", title: "" },
        { elementId: "packing-class-chart", title: "" },
        { elementId: "packing-spread-chart", title: "" },
        { elementId: "packing-distributor-chart", title: "" },
      ],
    })
  }, [
    allBlocksValue,
    allPucsValue,
    allVarietiesValue,
    block,
    exportReport,
    fmtDisplay,
    frequency,
    getClientName,
    logoPath,
    puc,
    rangeEnd,
    rangeStart,
    season,
    formatBlockLabel,
    formatLabel,
    variety,
  ])

  React.useEffect(() => {
    if (!prevSeasonAvailable && showPrevSeason) {
      setShowPrevSeason(false)
    }
  }, [prevSeasonAvailable, showPrevSeason])

  const matchesFilters = React.useCallback(
    (record: PackhouseRecord, seasonOverride?: string) => {
      const matchesVariety =
        !variety || variety === allVarietiesValue ? true : record.variety === variety

      const matchesBlock =
        !block || block === allBlocksValue ? true : record.block === block

      const matchesPuc = (() => {
        if (!puc || puc === allPucsValue) {
          return true
        }

        const normalizeValue = (value: string) => value.trim().toLowerCase()
        const selected = normalizeValue(puc)
        if (!selected) {
          return true
        }

        const recordPuc = (record as { puc?: string }).puc ?? ""
        if (recordPuc && normalizeValue(recordPuc) === selected) {
          return true
        }

        const blockPucs = getBlockPucs(record.block)
        if (blockPucs.some((value) => normalizeValue(value) === selected)) {
          return true
        }

        return false
      })()

      const effectiveSeason = seasonOverride ?? season
      const matchesSeason = effectiveSeason ? record.season === effectiveSeason : true

      return matchesVariety && matchesBlock && matchesPuc && matchesSeason
    },
    [allBlocksValue, allPucsValue, allVarietiesValue, block, getBlockPucs, puc, season, variety]
  )

  const filteredRecords = React.useMemo(() => {
    if (!packhouseData.length) return []

    return packhouseData.filter((record) => matchesFilters(record))
  }, [
    matchesFilters,
    packhouseData,
  ])

  const previousSeasonValue = React.useMemo(() => {
    if (!season) return null
    const currentIndex = seasons.findIndex((value) => value === season)
    if (currentIndex === -1) return null
    return seasons[currentIndex + 1] ?? null
  }, [season, seasons])

  const previousSeasonRecords = React.useMemo(() => {
    if (!previousSeasonValue) return []
    if (!packhouseData.length) return []
    return packhouseData.filter((record) => matchesFilters(record, previousSeasonValue))
  }, [matchesFilters, packhouseData, previousSeasonValue])

  const rangeStartDate = React.useMemo(() => (rangeStart ? new Date(rangeStart) : null), [rangeStart])
  const rangeEndDate = React.useMemo(() => (rangeEnd ? new Date(rangeEnd) : null), [rangeEnd])
  const rangeFilteredRecords = React.useMemo(() => {
    if (!filteredRecords.length) return []
    const startTs = rangeStartDate ? rangeStartDate.getTime() : Number.NEGATIVE_INFINITY
    const endTs = rangeEndDate ? rangeEndDate.getTime() : Number.POSITIVE_INFINITY
    return filteredRecords.filter((record) => record.timestamp >= startTs && record.timestamp <= endTs)
  }, [filteredRecords, rangeEndDate, rangeStartDate])

  const previousRangeFilteredRecords = React.useMemo(() => {
    if (!previousSeasonRecords.length) return []

    if (!rangeStartDate && !rangeEndDate) {
      return previousSeasonRecords
    }

    const shiftTimestamp = (date: Date | null, years: number) => {
      if (!date) return null
      const shifted = new Date(date)
      shifted.setFullYear(shifted.getFullYear() + years)
      return shifted.getTime()
    }

    const startTs = shiftTimestamp(rangeStartDate, -1) ?? Number.NEGATIVE_INFINITY
    const endTs = shiftTimestamp(rangeEndDate, -1) ?? Number.POSITIVE_INFINITY

    return previousSeasonRecords.filter(
      (record) => record.timestamp >= startTs && record.timestamp <= endTs
    )
  }, [previousSeasonRecords, rangeEndDate, rangeStartDate])

  const chartsRecords = rangeFilteredRecords
  const chartsPreviousRecords = previousRangeFilteredRecords
  const selectionRange = React.useMemo(() => {
    if (!filteredRecords.length) return null
    const sortedByDate = [...filteredRecords].sort((a, b) => a.timestamp - b.timestamp)
    return {
      start: sortedByDate[0].date,
      end: sortedByDate[sortedByDate.length - 1].date,
    }
  }, [filteredRecords])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (!selectionRange) {
      if (!rangeDirty) {
        setRangeStart("")
        setRangeEnd("")
      }
      return
    }

    if (!rangeDirty) {
      setRangeStart(selectionRange.start)
      setRangeEnd(selectionRange.end)
    }
  }, [selectionRange, rangeDirty])

  React.useEffect(() => {
    setRangeDirty(false)
  }, [variety, block, puc, season])

  const setEntireRange = React.useCallback(() => {
    if (!selectionRange) return
    setRangeStart(selectionRange.start)
    setRangeEnd(selectionRange.end)
    setRangeDirty(true)
  }, [selectionRange])

  const setToday = React.useCallback(() => {
    const nowDate = new Date()
    const iso = fmt(nowDate)
    setRangeStart(iso)
    setRangeEnd(iso)
    setRangeDirty(true)
  }, [fmt])

  const setThisWeek = React.useCallback(() => {
    const nowDate = new Date()
    const day = nowDate.getDay()
    const diffToMonday = (day + 6) % 7
    const start = new Date(nowDate)
    start.setDate(nowDate.getDate() - diffToMonday)
    setRangeStart(fmt(start))
    setRangeEnd(fmt(nowDate))
    setRangeDirty(true)
  }, [fmt])

  const setThisMonth = React.useCallback(() => {
    const nowDate = new Date()
    const start = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1)
    setRangeStart(fmt(start))
    setRangeEnd(fmt(nowDate))
    setRangeDirty(true)
  }, [fmt])

  const now = new Date()
  const todayISO = fmt(now)
  const thisWeekStart = (() => {
    const d = new Date(now)
    const diff = (d.getDay() + 6) % 7
    d.setDate(d.getDate() - diff)
    return fmt(d)
  })()
  const thisMonthStart = fmt(new Date(now.getFullYear(), now.getMonth(), 1))
  const selectedSeasonYear = Number.parseInt(season, 10)
  const isSeasonCurrent = Number.isFinite(selectedSeasonYear) && selectedSeasonYear === now.getFullYear()

  const entireRangeStart = selectionRange?.start ?? ""
  const entireRangeEnd = selectionRange?.end ?? ""

  const isEntireSelected =
    selectionRange != null && rangeStart === entireRangeStart && rangeEnd === entireRangeEnd
  const isTodaySelected = rangeStart === todayISO && rangeEnd === todayISO
  const isThisWeekSelected = rangeStart === thisWeekStart && rangeEnd === todayISO
  const isThisMonthSelected = rangeStart === thisMonthStart && rangeEnd === todayISO

  const defaultFrequency: Granularity = "weekly"

  const isVarietyDefault = variety === defaultVarietyValue
  const isBlockDefault = block === defaultBlockValue
  const isPucDefault = puc === defaultPucValue
  const isSeasonDefault = season === defaultSeasonValue
  const isFrequencyDefault = frequency === defaultFrequency

  const handleResetRange = React.useCallback(() => {
    if (selectionRange) {
      setRangeStart(selectionRange.start)
      setRangeEnd(selectionRange.end)
    } else {
      setRangeStart("")
      setRangeEnd("")
    }
    setRangeDirty(false)
  }, [selectionRange])

  const handleResetFrequency = React.useCallback(() => {
    setFrequency(defaultFrequency)
  }, [defaultFrequency, setFrequency])

  const varietyDisabled = lockVariety || configLoading || !!configError
  const blockDisabled = lockBlock || configLoading || !!configError
  const pucDisabled = lockPuc || configLoading || !!configError
  const seasonDisabled = lockSeason || isDataLoading || !seasonOptions.length

  const varietyLabel =
    variety === allVarietiesValue ? "All Varieties" : formatLabel(variety)
  const blockLabel =
    block === allBlocksValue ? "All Blocks" : formatBlockLabel(block)
  const pucLabel = puc === allPucsValue ? "All PUCs" : formatLabel(puc)
  const seasonLabelRaw = season || (seasonOptions[0] ?? "")
  const seasonLabel = seasonLabelRaw || "Season"


  const [hydrated, setHydrated] = React.useState(false)
  React.useEffect(() => { setHydrated(true) }, [])
  const selectionLabel = hydrated && varietyLabel && blockLabel && pucLabel && seasonLabel
    ? `${varietyLabel} | ${blockLabel} | ${pucLabel} | ${seasonLabel}`
    : ""
  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
        <div className="flex items-center justify-between w-full px-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage><SectionTitle /></BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground whitespace-nowrap md:inline">
              Last refreshed: {refreshStatus.full}
            </span>
            <span className="text-xs text-muted-foreground whitespace-nowrap md:hidden">
              {refreshStatus.compact}
            </span>
            <button
              type="button"
              onClick={handleRefreshData}
              className="inline-flex h-8 w-8 items-center justify-center rounded text-muted-foreground transition hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Refresh packhouse data"
              title="Refresh data"
              disabled={isDataLoading || isDataRefreshing}
            >
              <RefreshCcw
                className={cn("h-5 w-5", (isDataRefreshing || isDataLoading) && "animate-spin")}
                style={isDataRefreshing || isDataLoading ? { animationDirection: "reverse" } : undefined}
              />
            </button>
            <AIButton currentPage="Packhouse - Performance" />
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 px-2 md:px-4 pt-0 md:pt-0 pb-2 md:pb-4 overflow-x-auto" style={{ maxWidth: "100vw" }}>
        {/* Client name above the heading */}
        <div className="px-2 md:px-0">
          <span className="text-muted-foreground">Packhouse</span>
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              Performance
              {/* Or use the folder-derived title again: <SectionTitle /> */}
            </h1>
            <ExportButton
              onClick={handleExportReport}
              disabled={isExporting}
              isExporting={isExporting}
            />
          </div>
        </div>

        <Tabs defaultValue="metrics" className="space-y-4">
          {/* Toolbar: filters only */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            {/* Filters (left on desktop, below on mobile) */}
            <div className="order-2 md:order-1 grid w-full gap-3 grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 md:flex-1">
              {/* Variety */}
              <div className={FILTER_WRAPPER_CLASS}>
                <span className="absolute -top-2 left-2 bg-background px-1 text-xs text-muted-foreground z-10">Variety</span>
                <Select
                  value={variety}
                  onValueChange={(value) => {
                    if (lockVariety) return
                    setVariety(value)
                    setRangeDirty(false)
                  }}
                >
                  <SelectTrigger
                    className={cn(
                      "w-full h-9 text-sm",
                      lockVariety && LOCKED_SELECT_TRIGGER_CLASS,
                      varietyDisabled && !lockVariety && "opacity-60 pointer-events-none"
                    )}
                    aria-label="Variety"
                    disabled={varietyDisabled}
                    aria-disabled={varietyDisabled}
                  >
                    <SelectValue placeholder={configLoading ? "Loading..." : "Select variety"} />
                  </SelectTrigger>
                  <SelectContent>
                    {varietyOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option === allVarietiesValue ? "All Varieties" : formatLabel(option)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="absolute -top-2 right-2 flex items-center gap-1">
                  <button
                    type="button"
                    aria-pressed={lockVariety}
                    onClick={() => setLockVariety(!lockVariety)}
                    className="bg-background px-1 rounded text-muted-foreground hover:text-foreground"
                    title={lockVariety ? "Unlock" : "Lock"}
                  >
                    {lockVariety ? (
                      <Lock className="h-3 w-3 text-emerald-700" />
                    ) : (
                      <Unlock className="h-3 w-3" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => resetVariety()}
                    className="bg-background px-1 rounded text-muted-foreground hover:text-foreground disabled:text-muted-foreground disabled:cursor-not-allowed"
                    title="Reset"
                    aria-label="Reset variety"
                    disabled={lockVariety || isVarietyDefault}
                  >
                    <RotateCcw className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* PUC */}
              <div className={FILTER_WRAPPER_CLASS}>
                <span className="absolute -top-2 left-2 bg-background px-1 text-xs text-muted-foreground z-10">PUC</span>
                <Select
                  value={puc}
                  onValueChange={(value) => {
                    if (lockPuc) return
                    setPuc(value)
                    setRangeDirty(false)
                  }}
                >
                  <SelectTrigger
                    className={cn(
                      "w-full h-9 text-sm",
                      lockPuc && LOCKED_SELECT_TRIGGER_CLASS,
                      pucDisabled && !lockPuc && "opacity-60 pointer-events-none"
                    )}
                    aria-label="PUC"
                    disabled={pucDisabled}
                    aria-disabled={pucDisabled}
                  >
                    <SelectValue placeholder={configLoading ? "Loading..." : "Select PUC"} />
                  </SelectTrigger>
                  <SelectContent>
                    {pucOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option === allPucsValue ? "All PUCs" : formatLabel(option)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="absolute -top-2 right-2 flex items-center gap-1">
                  <button
                    type="button"
                    aria-pressed={lockPuc}
                    onClick={() => setLockPuc(!lockPuc)}
                    className="bg-background px-1 rounded text-muted-foreground hover:text-foreground"
                    title={lockPuc ? "Unlock" : "Lock"}
                  >
                    {lockPuc ? (
                      <Lock className="h-3 w-3 text-emerald-700" />
                    ) : (
                      <Unlock className="h-3 w-3" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => resetPuc()}
                    className="bg-background px-1 rounded text-muted-foreground hover:text-foreground disabled:text-muted-foreground disabled:cursor-not-allowed"
                    title="Reset"
                    aria-label="Reset PUC"
                    disabled={lockPuc || isPucDefault}
                  >
                    <RotateCcw className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* Block */}
              <div className={FILTER_WRAPPER_CLASS}>
                <span className="absolute -top-2 left-2 bg-background px-1 text-xs text-muted-foreground z-10">Block</span>
                <Select
                  value={block}
                  onValueChange={(value) => {
                    if (lockBlock) return
                    setBlock(value)
                    setRangeDirty(false)
                  }}
                >
                  <SelectTrigger
                    className={cn(
                      "w-full h-9 text-sm",
                      lockBlock && LOCKED_SELECT_TRIGGER_CLASS,
                      blockDisabled && !lockBlock && "opacity-60 pointer-events-none"
                    )}
                    aria-label="Block"
                    disabled={blockDisabled}
                    aria-disabled={blockDisabled}
                  >
                    <SelectValue placeholder={configLoading ? "Loading..." : "Select block"} />
                  </SelectTrigger>
                  <SelectContent>
                    {blockOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option === allBlocksValue ? "All Blocks" : formatBlockLabel(option)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="absolute -top-2 right-2 flex items-center gap-1">
                  <button
                    type="button"
                    aria-pressed={lockBlock}
                    onClick={() => setLockBlock(!lockBlock)}
                    className="bg-background px-1 rounded text-muted-foreground hover:text-foreground"
                    title={lockBlock ? "Unlock" : "Lock"}
                  >
                    {lockBlock ? (
                      <Lock className="h-3 w-3 text-emerald-700" />
                    ) : (
                      <Unlock className="h-3 w-3" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => resetBlock()}
                    className="bg-background px-1 rounded text-muted-foreground hover:text-foreground disabled:text-muted-foreground disabled:cursor-not-allowed"
                    title="Reset"
                    aria-label="Reset block"
                    disabled={lockBlock || isBlockDefault}
                  >
                    <RotateCcw className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* Season */}
              <div className={FILTER_WRAPPER_CLASS}>
                <span className="absolute -top-2 left-2 bg-background px-1 text-xs text-muted-foreground z-10">Season</span>
                <Select
                  value={season}
                  onValueChange={(value) => {
                    if (lockSeason) return
                    setSeason(value)
                    setRangeDirty(false)
                  }}
                >
                  <SelectTrigger
                    className={cn(
                      "w-full h-9 text-sm",
                      lockSeason && LOCKED_SELECT_TRIGGER_CLASS,
                      seasonDisabled && !lockSeason && "opacity-60 pointer-events-none"
                    )}
                    aria-label="Season"
                    disabled={seasonDisabled}
                    aria-disabled={seasonDisabled}
                  >
                    <SelectValue placeholder={isDataLoading ? "Loading..." : "Select season"} />
                  </SelectTrigger>
                  <SelectContent>
                    {seasonOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="absolute -top-2 right-2 flex items-center gap-1">
                  <button
                    type="button"
                    aria-pressed={lockSeason}
                    onClick={() => setLockSeason(!lockSeason)}
                    className="bg-background px-1 rounded text-muted-foreground hover:text-foreground"
                    title={lockSeason ? "Unlock" : "Lock"}
                  >
                    {lockSeason ? (
                      <Lock className="h-3 w-3 text-emerald-700" />
                    ) : (
                      <Unlock className="h-3 w-3" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => resetSeason()}
                    className="bg-background px-1 rounded text-muted-foreground hover:text-foreground disabled:text-muted-foreground disabled:cursor-not-allowed"
                    title="Reset"
                    aria-label="Reset season"
                    disabled={lockSeason || isSeasonDefault}
                  >
                    <RotateCcw className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* Range (date range with quick presets) */}
              <div className={FILTER_WRAPPER_CLASS}>
                <span className="absolute -top-2 left-2 bg-background px-1 text-xs text-muted-foreground z-10">Range</span>
                <div className="absolute -top-2 right-2 flex items-center">
                  <button
                    type="button"
                    onClick={handleResetRange}
                    className="bg-background px-1 rounded text-muted-foreground hover:text-foreground disabled:text-muted-foreground disabled:cursor-not-allowed"
                    title="Reset"
                    aria-label="Reset range"
                    disabled={!rangeDirty}
                  >
                    <RotateCcw className="h-3 w-3" />
                  </button>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      aria-label="Range"
                    >
                      <span className="truncate">
                        {rangeStart && rangeEnd
                          ? `${fmtDisplay(rangeStart)} - ${fmtDisplay(rangeEnd)}`
                          : rangeStart
                            ? `From ${fmtDisplay(rangeStart)}`
                            : <span className="text-muted-foreground">Select range</span>
                        }
                      </span>
                      <ChevronDown className="h-4 w-4 opacity-50" aria-hidden="true" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-[340px] p-2">
                    <div className="flex gap-2 px-1 pb-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        className={`h-8 ${isEntireSelected ? "bg-sidebar text-white hover:bg-sidebar-accent border-transparent" : ""} ${selectionRange ? "" : "pointer-events-none opacity-60"}`}
                        onClick={(e) => { e.preventDefault(); setEntireRange() }}
                        disabled={!selectionRange}
                      >
                        Entire range
                      </Button>
                      {isSeasonCurrent && selectionRange && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className={`h-8 ${isTodaySelected ? "bg-sidebar text-white hover:bg-sidebar-accent border-transparent" : ""}`}
                            onClick={(e) => { e.preventDefault(); setToday() }}
                          >
                            Today
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className={`h-8 ${isThisWeekSelected ? "bg-sidebar text-white hover:bg-sidebar-accent border-transparent" : ""}`}
                            onClick={(e) => { e.preventDefault(); setThisWeek() }}
                          >
                            This week
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className={`h-8 ${isThisMonthSelected ? "bg-sidebar text-white hover:bg-sidebar-accent border-transparent" : ""}`}
                            onClick={(e) => { e.preventDefault(); setThisMonth() }}
                          >
                            This month
                          </Button>
                        </>
                      )}
                    </div>
                    <DropdownMenuSeparator />
                    <div className="p-1">
                      <RangeCalendar
                        value={{
                          start: rangeStart ? new Date(rangeStart) : undefined,
                          end: rangeEnd ? new Date(rangeEnd) : undefined,
                        }}
                        limitYear={Number.isFinite(selectedSeasonYear) ? selectedSeasonYear : undefined}
                        onChange={(r) => {
                          setRangeStart(r.start ? fmt(r.start) : "")
                          setRangeEnd(r.end ? fmt(r.end) : "")
                          setRangeDirty(true)
                        }}
                      />
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              <div className={FILTER_WRAPPER_CLASS}>
                <span className="absolute -top-2 left-2 bg-background px-1 text-xs text-muted-foreground z-10">Frequency</span>
                <div className="absolute -top-2 right-2 flex items-center">
                  <button
                    type="button"
                    onClick={handleResetFrequency}
                    className="bg-background px-1 rounded text-muted-foreground hover:text-foreground disabled:text-muted-foreground disabled:cursor-not-allowed"
                    title="Reset"
                    aria-label="Reset frequency"
                    disabled={isFrequencyDefault}
                  >
                    <RotateCcw className="h-3 w-3" />
                  </button>
                </div>
                <Select value={frequency} onValueChange={(value) => setFrequency(value as Granularity)}>
                  <SelectTrigger className="w-full h-9 text-sm" aria-label="Frequency">
                    <SelectValue placeholder="Daily" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className={cn(FILTER_WRAPPER_CLASS, "flex items-center justify-center")}>
                <label className="flex h-9 items-center gap-2 text-sm font-medium text-foreground">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border border-input bg-background text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                    checked={showPrevSeason}
                    onChange={(event) => setShowPrevSeason(event.target.checked)}
                    disabled={!prevSeasonAvailable}
                  />
                  Prev Season
                </label>
              </div>

            </div>
          </div>

          {/* Tabs below the dropdowns */}
          <div>
            <TabsList>
              <TabsTrigger value="metrics">Metrics</TabsTrigger>
              <TabsTrigger value="insights">Insights</TabsTrigger>
              <TabsTrigger value="compare">Compare</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="metrics" className="space-y-4">
            <MetricsPage
              selectionLabel={selectionLabel}
              records={chartsRecords}
              previousRecords={chartsPreviousRecords}
              granularity={frequency}
              showPrevSeason={showPrevSeason}
              onProgressPrevAvailabilityChange={setProgressPrevAvailable}
              onDistributorPrevAvailabilityChange={setDistributorPrevAvailable}
            />
          </TabsContent>
          <TabsContent value="insights" className="space-y-4">
            <InsightsPage />
          </TabsContent>
          <TabsContent value="compare" className="space-y-4">
            <div className="rounded-md border p-6 text-sm text-muted-foreground">
              Comparisons coming soon
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
