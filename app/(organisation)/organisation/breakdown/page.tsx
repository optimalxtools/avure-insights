"use client"

import * as React from "react"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Lock, Unlock, RotateCcw } from "lucide-react"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { LOCKED_SELECT_TRIGGER_CLASS } from "@/lib/select"

import { MetricsPage } from "./components/pages/metrics"
import { InsightsPage } from "./components/pages/insights"
import { SectionTitle } from "@/components/section-title"
import { useMasterConfigFilters } from "@/lib/hooks/useMasterConfigFilters"
import { FILTER_WRAPPER_CLASS } from "@/lib/filter-styles"
import { AIButton } from "@/components/ai-button"
import { ExportButton } from "@/components/export-button"

const SEASON_OPTIONS = ["2025", "2024"]
const SHOW_METRICS_CONTENT = false

export default function Page() {
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
  } = useMasterConfigFilters({
    sharedKey: "filters:shared",
    pageKey: "filters:organisation:breakdown",
    seasons: SEASON_OPTIONS,
    autoSelectFirstVariety: true,
    autoSelectFirstSeason: true,
  })

  const [hydrated, setHydrated] = React.useState(false)
  React.useEffect(() => { setHydrated(true) }, [])

  const loadingOrError = configLoading || Boolean(configError)
  const varietyDisabled = lockVariety || loadingOrError
  const blockDisabled = lockBlock || loadingOrError
  const pucDisabled = lockPuc || loadingOrError
  const seasonDisabled = lockSeason || seasonOptions.length === 0

  const isVarietyDefault = variety === defaultVarietyValue
  const isBlockDefault = block === defaultBlockValue
  const isPucDefault = puc === defaultPucValue
  const isSeasonDefault = season === defaultSeasonValue

  const varietyLabel =
    variety === allVarietiesValue
      ? "All Varieties"
      : formatLabel(variety)
  const blockLabel =
    block === allBlocksValue
      ? "All Blocks"
      : formatBlockLabel(block)
  const pucLabel =
    puc === allPucsValue
      ? "All PUCs"
      : formatLabel(puc)
  const seasonLabel = season || (seasonOptions[0] ?? "Season")

  const selectionLabel = hydrated
    ? `${varietyLabel} | ${blockLabel} | ${pucLabel} | ${seasonLabel}`
    : ""

  const headerSection = (
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
          <AIButton currentPage="Organisation - Breakdown" />
        </div>
      </div>
    </header>
  )

  const titleSection = (
    <>
      {/* Client name above the heading */}
      <div className="px-2 md:px-0">
        <span className="text-muted-foreground">Organisation</span>
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Breakdown
            {/* Or use the folder-derived title again: <SectionTitle /> */}
          </h1>
          <ExportButton />
        </div>
      </div>
    </>
  )

  return (
    <>
      {headerSection}

      <div className="flex flex-1 flex-col gap-4 px-2 md:px-4 pt-0 md:pt-0 pb-2 md:pb-4 overflow-x-auto debug-border-2" style={{ maxWidth: "100vw" }}>
        {titleSection}

        <Tabs defaultValue="metrics" className="space-y-4">
          {/* Tabs below the dropdowns */}
          <div>
            <TabsList>
              <TabsTrigger value="metrics">Metrics</TabsTrigger>
              <TabsTrigger value="insights">Insights</TabsTrigger>
              <TabsTrigger value="compare">Compare</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="metrics" className="space-y-4">
            {SHOW_METRICS_CONTENT ? (
              <MetricsPage selectionLabel={selectionLabel} />
            ) : (
              <div className="rounded-md border p-6 text-sm text-muted-foreground">
                Metrics coming soon
              </div>
            )}
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
