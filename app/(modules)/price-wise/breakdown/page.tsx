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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getScraperAnalysis } from "@/lib/price-wise/scraper"
import { RefreshButton } from "@/components/price-wise-refresh-button"
import { PriceDifferenceChart, PriceRangeChart, OccupancyComparisonChart as MetricsOccupancyChart, RoomInventoryChart } from "@/components/price-wise/breakdown-charts"
import { PriceComparisonChart, OpportunityCostChart } from "@/components/price-wise/insights-charts"

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export default async function Page() {
  const analysis = await getScraperAnalysis()

  // Parse additional data for new sections
  const pricingMetrics = analysis?.pricing_metrics || []
  const occupancyMetrics = analysis?.occupancy_metrics || []
  const comparison = analysis?.comparison || []
  const roomInventory = analysis?.room_inventory || []
  
  // Sort occupancy by rate (descending)
  const sortedOccupancy = [...occupancyMetrics].sort((a: any, b: any) => (b.occupancy_rate || 0) - (a.occupancy_rate || 0))
  
  // Sort comparison by price difference
  const sortedComparison = [...comparison].sort((a: any, b: any) => (a.price_vs_ref_pct || 0) - (b.price_vs_ref_pct || 0))
  
  // Sort room inventory by room occupancy rate
  const sortedRoomInventory = [...roomInventory].sort((a: any, b: any) => (b.avg_room_occupancy_rate || 0) - (a.avg_room_occupancy_rate || 0))
  
  // Add reference property to comparison if it's not there
  const refPricing = pricingMetrics.find((p: any) => p.hotel_name === analysis?.reference_property)
  const refOccupancy = occupancyMetrics.find((o: any) => o.hotel_name === analysis?.reference_property)
  const comparisonWithRef = [...sortedComparison]
  if (analysis && refPricing && !comparisonWithRef.find((c: any) => c.hotel_name === analysis.reference_property)) {
    // Add reference property with 0 difference
    comparisonWithRef.push({
      hotel_name: analysis.reference_property,
      avg_price: refPricing.avg_price_per_night,
      price_vs_ref: 0,
      price_vs_ref_pct: 0,
      occupancy: refOccupancy?.occupancy_rate || 0,
      position: 'Reference'
    })
    comparisonWithRef.sort((a: any, b: any) => (a.price_vs_ref_pct || 0) - (b.price_vs_ref_pct || 0))
  }

  const referenceProperty = analysis?.reference_property || ""
  const referencePricingMetric = pricingMetrics.find((entry: any) => entry.hotel_name === referenceProperty)
  const referenceOccupancyMetric = occupancyMetrics.find((entry: any) => entry.hotel_name === referenceProperty)

  const currentReferencePrice = toNumber(referencePricingMetric?.avg_price_per_night) ?? 0
  const currentReferenceOccupancy = toNumber(referenceOccupancyMetric?.occupancy_rate) ?? 0

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
            <RefreshButton lastUpdated={analysis?.generated_at || null} />
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
                {analysis?.generated_at
                  ? `Generated at ${new Date(analysis.generated_at).toLocaleString()}`
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
            <TabsTrigger value="rooms">Rooms</TabsTrigger>
          </TabsList>

          <TabsContent value="metrics">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-4">
                {comparisonWithRef.length > 0 && (
                  <PriceDifferenceChart
                    comparisonData={comparisonWithRef as any}
                    referenceProperty={referenceProperty}
                  />
                )}

                {occupancyMetrics.length > 0 && (
                  <MetricsOccupancyChart
                    data={occupancyMetrics as any}
                    referenceProperty={referenceProperty}
                  />
                )}
              </div>

              {pricingMetrics.length > 0 && (
                <PriceRangeChart
                  pricingData={pricingMetrics as any}
                  referenceProperty={referenceProperty}
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="insights" className="space-y-4">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <PriceComparisonChart
                pricingData={pricingMetrics as any}
                occupancyData={occupancyMetrics as any}
                referenceProperty={referenceProperty}
              />

              <OpportunityCostChart
                currentPrice={currentReferencePrice}
                currentOccupancy={currentReferenceOccupancy}
                referenceProperty={referenceProperty}
              />
            </div>
          </TabsContent>

          <TabsContent value="rooms">
            {/* Room Inventory Analysis */}
            {roomInventory.length > 0 ? (
              <div className="space-y-4">
                <RoomInventoryChart data={roomInventory as any} referenceProperty={referenceProperty} />

                <Card>
                  <CardHeader>
                    <CardTitle>Room Inventory & Pricing Strategy</CardTitle>
                    <CardDescription>Room-level insights showing inventory management and tiered pricing</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Property</TableHead>
                          <TableHead className="text-right">Total Rooms</TableHead>
                          <TableHead className="text-right">Room Occupancy</TableHead>
                          <TableHead className="text-right">Avg Room Price</TableHead>
                          <TableHead className="text-right">Price Spread</TableHead>
                          <TableHead>Price Tiering</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedRoomInventory.map((row: any, index: number) => {
                          const isReference = row.hotel_name === analysis?.reference_property
                          const priceSpread = Number(row.room_price_spread_pct || 0)
                          const usesTiering = row.uses_room_tiering || false
                          const totalRooms = toNumber(row.room_type_count_estimate ?? row.avg_total_room_types) ?? 0

                          return (
                            <TableRow key={index} className={isReference ? "bg-muted/50" : ""}>
                              <TableCell className="font-medium">
                                {row.hotel_name}
                                {isReference && " ⭐"}
                              </TableCell>
                              <TableCell className="text-right">{totalRooms > 0 ? totalRooms.toFixed(0) : "—"}</TableCell>
                              <TableCell className="text-right">{Number(row.avg_room_occupancy_rate || 0).toFixed(1)}%</TableCell>
                              <TableCell className="text-right">
                                {row.avg_room_price ? `R ${Number(row.avg_room_price).toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "—"}
                              </TableCell>
                              <TableCell className="text-right">
                                {priceSpread > 0 ? `${priceSpread.toFixed(1)}%` : "—"}
                              </TableCell>
                              <TableCell>
                                <span className={usesTiering ? "text-green-600 font-medium" : "text-muted-foreground"}>
                                  {usesTiering ? "Yes" : "No"}
                                </span>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                    <div className="mt-4 space-y-1 text-sm text-muted-foreground">
                      <p><strong>Total Rooms:</strong> Estimated number of distinct room types being tracked for each property</p>
                      <p><strong>Room Occupancy:</strong> Percentage of room types that are sold out</p>
                      <p><strong>Price Spread:</strong> Difference between the cheapest and most expensive room as a percentage</p>
                      <p><strong>Price Tiering:</strong> Highlights properties using multiple room tiers at different price points</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="py-8">
                  <p className="text-sm text-muted-foreground text-center">No room inventory data available.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}

