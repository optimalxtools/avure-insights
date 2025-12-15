export const dynamic = "force-dynamic"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { SectionTitle } from "@/components/section-title"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { AIButton } from "@/components/ai-button"
import { ExportButton } from "@/components/export-button"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { getPriceWiseSnapshots } from "@/lib/price-wise/scraper"
import { buildSnapshotViews } from "@/lib/price-wise/snapshot-utils"
import { RefreshButton } from "@/components/price-wise-refresh-button"
import { PriceDifferenceChart, PriceRangeChart, OccupancyComparisonChart as MetricsOccupancyChart, RoomInventoryChart } from "@/components/price-wise/breakdown-metrics-charts"
import { PriceComparisonChart, OpportunityCostChart } from "@/components/price-wise/breakdown-insights-charts"
import { SimplePriceChart, SimpleOccupancyChart, DailyBookingStatusChart, DailyAvailabilityChart } from "@/components/price-wise/overview-charts"

export default async function Page() {
  const rawSnapshots = await getPriceWiseSnapshots(3)
  const snapshotViews = buildSnapshotViews(rawSnapshots, [
    "Current (T)",
    "Previous (T-1)",
    "Two Periods Back (T-2)",
  ])
  const latestSnapshot = snapshotViews[0] ?? null

  const referenceProperty = latestSnapshot?.referenceProperty ?? ""
  
  // Build snapshots for PriceDifferenceChart
  const priceDifferenceSnapshots = snapshotViews.map((snapshot) => {
    const referencePricingMetric = snapshot.pricingMetrics.find((entry) => entry.hotel_name === referenceProperty)
    const referenceOccupancyMetric = snapshot.occupancyMetrics.find((entry) => entry.hotel_name === referenceProperty)

    const comparisonWithRef = [...snapshot.comparisonMetrics]
    if (
      referencePricingMetric &&
      !comparisonWithRef.some((entry) => entry.hotel_name === referenceProperty)
    ) {
      comparisonWithRef.push({
        hotel_name: referenceProperty,
        avg_price: referencePricingMetric.avg_price_per_night,
        price_vs_ref: 0,
        price_vs_ref_pct: 0,
        occupancy: referenceOccupancyMetric?.occupancy_rate ?? 0,
        position: "Reference",
      })
    }
    comparisonWithRef.sort((a, b) => a.price_vs_ref_pct - b.price_vs_ref_pct)

    return {
      id: snapshot.id,
      label: snapshot.label,
      dateLabel: snapshot.dateLabel,
      fullLabel: snapshot.fullLabel,
      comparisonData: comparisonWithRef,
      referenceProperty,
    }
  })

  // Build snapshots for PriceRangeChart
  const priceRangeSnapshots = snapshotViews.map((snapshot) => ({
    id: snapshot.id,
    label: snapshot.label,
    dateLabel: snapshot.dateLabel,
    fullLabel: snapshot.fullLabel,
    pricingData: snapshot.pricingMetrics,
    referenceProperty,
  }))

  // Build snapshots for OccupancyComparisonChart
  const occupancySnapshots = snapshotViews.map((snapshot) => ({
    id: snapshot.id,
    label: snapshot.label,
    dateLabel: snapshot.dateLabel,
    fullLabel: snapshot.fullLabel,
    data: snapshot.occupancyMetrics,
    referenceProperty,
  }))

  // Build snapshots for RoomInventoryChart
  const roomInventorySnapshots = snapshotViews.map((snapshot) => ({
    id: snapshot.id,
    label: snapshot.label,
    dateLabel: snapshot.dateLabel,
    fullLabel: snapshot.fullLabel,
    data: snapshot.roomInventoryMetrics,
    referenceProperty,
  }))

  // Build snapshots for SimplePriceChart (from Overview)
  const priceChartSnapshots = snapshotViews.map((snapshot) => ({
    id: snapshot.id,
    label: snapshot.label,
    dateLabel: snapshot.dateLabel,
    fullLabel: snapshot.fullLabel,
    pricingData: snapshot.pricingMetrics,
    referenceProperty: snapshot.referenceProperty,
  }))

  // Build snapshots for SimpleOccupancyChart (from Overview)
  const occupancyChartSnapshots = snapshotViews.map((snapshot) => ({
    id: snapshot.id,
    label: snapshot.label,
    dateLabel: snapshot.dateLabel,
    fullLabel: snapshot.fullLabel,
    occupancyData: snapshot.occupancyMetrics,
    roomInventoryData: snapshot.roomInventoryMetrics,
    referenceProperty: snapshot.referenceProperty,
  }))

  // Build snapshots for DailyBookingStatusChart (from Overview)
  const bookingStatusSnapshots = snapshotViews.map((snapshot) => ({
    id: snapshot.id,
    label: snapshot.label,
    dateLabel: snapshot.dateLabel,
    fullLabel: snapshot.fullLabel,
    dailyData: snapshot.dailyData,
    referenceProperty: snapshot.referenceProperty,
    roomInventoryData: snapshot.roomInventoryMetrics,
  }))

  // Build snapshots for DailyAvailabilityChart (from Overview)
  const availabilitySnapshots = snapshotViews.map((snapshot) => ({
    id: snapshot.id,
    label: snapshot.label,
    dateLabel: snapshot.dateLabel,
    fullLabel: snapshot.fullLabel,
    dailyData: snapshot.dailyData,
    referenceProperty: snapshot.referenceProperty,
  }))

  const hasPricingData = snapshotViews.some((snapshot) => snapshot.pricingMetrics.length > 0)
  const hasOccupancyData = snapshotViews.some((snapshot) => snapshot.occupancyMetrics.length > 0)
  const hasDailyData = snapshotViews.some((snapshot) => snapshot.dailyData.length > 0)

  // For the compare tab (was insights), use the latest snapshot data
  const currentReferencePrice = latestSnapshot?.pricingMetrics.find(
    (entry) => entry.hotel_name === referenceProperty
  )?.avg_price_per_night ?? 0
  
  const currentReferenceOccupancy = latestSnapshot?.occupancyMetrics.find(
    (entry) => entry.hotel_name === referenceProperty
  )?.occupancy_rate ?? 0

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
                  <BreadcrumbPage>
                    <SectionTitle />
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="flex items-center gap-2">
            <RefreshButton lastUpdated={latestSnapshot?.generatedAt || null} />
            <AIButton currentPage="Price-Wise - Breakdown" />
          </div>
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-4 px-2 md:px-4 pt-0 md:pt-0 pb-2 md:pb-4 overflow-x-auto" style={{ maxWidth: "100vw" }}>
        <div className="px-2 md:px-0">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <span className="text-muted-foreground">Price Wise</span>
              <h1 className="text-3xl font-semibold tracking-tight">Breakdown</h1>
              <p className="text-sm text-muted-foreground">
                {latestSnapshot?.generatedAt
                  ? `Generated at ${new Date(latestSnapshot.generatedAt).toLocaleString()}`
                  : "No analysis has been produced yet"}
              </p>
            </div>
            <ExportButton />
          </div>
        </div>
        <Tabs defaultValue="metrics" className="space-y-4">
          <TabsList>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
            <TabsTrigger value="tips">Tips</TabsTrigger>
          </TabsList>

          <TabsContent value="metrics">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-w-0">
              {hasPricingData && (
                <SimplePriceChart 
                  snapshots={priceChartSnapshots}
                />
              )}
              {hasOccupancyData && (
                <SimpleOccupancyChart 
                  snapshots={occupancyChartSnapshots}
                />
              )}
            </div>

            {hasDailyData && (
              <div className="mt-4">
                <DailyBookingStatusChart 
                  snapshots={bookingStatusSnapshots}
                />
              </div>
            )}

            {hasDailyData && (
              <div className="mt-4">
                <DailyAvailabilityChart 
                  snapshots={availabilitySnapshots}
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="insights">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {priceDifferenceSnapshots.length > 0 && priceDifferenceSnapshots[0].comparisonData.length > 0 && (
                <PriceDifferenceChart snapshots={priceDifferenceSnapshots} />
              )}

              {priceRangeSnapshots.length > 0 && priceRangeSnapshots[0].pricingData.length > 0 && (
                <PriceRangeChart snapshots={priceRangeSnapshots} />
              )}

              {occupancySnapshots.length > 0 && occupancySnapshots[0].data.length > 0 && (
                <MetricsOccupancyChart snapshots={occupancySnapshots} />
              )}

              {roomInventorySnapshots.length > 0 && roomInventorySnapshots[0].data.length > 0 && (
                <RoomInventoryChart snapshots={roomInventorySnapshots} />
              )}
            </div>
          </TabsContent>

          <TabsContent value="tips" className="space-y-4">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <PriceComparisonChart
                pricingData={latestSnapshot?.pricingMetrics ?? []}
                occupancyData={latestSnapshot?.occupancyMetrics ?? []}
                referenceProperty={referenceProperty}
              />

              <OpportunityCostChart
                currentPrice={currentReferencePrice}
                currentOccupancy={currentReferenceOccupancy}
                referenceProperty={referenceProperty}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}

