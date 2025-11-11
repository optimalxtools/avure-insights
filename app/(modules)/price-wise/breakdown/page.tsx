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
import type { PriceWiseAnalysis } from "@/lib/price-wise/types"
import { RefreshButton } from "@/components/price-wise-refresh-button"
import { PriceDifferenceChart, PriceRangeChart, OccupancyComparisonChart } from "@/components/price-wise/breakdown-charts"

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const currencyFormatter = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  maximumFractionDigits: 0,
})

const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
})

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
})

function formatCurrency(value: unknown) {
  const num = toNumber(value)
  if (num === null) return "—"
  return currencyFormatter.format(num)
}

function formatPercent(value: unknown) {
  const num = toNumber(value)
  if (num === null) return "—"
  return percentFormatter.format(num / 100)
}

function formatNumber(value: unknown) {
  const num = toNumber(value)
  if (num === null) return "—"
  return numberFormatter.format(num)
}

function buildPricingRows(analysis?: PriceWiseAnalysis) {
  return analysis?.pricing_metrics?.map((entry) => ({
    hotel: String(entry.hotel_name ?? "Unknown"),
    average: formatCurrency(entry.avg_price_per_night),
    minimum: formatCurrency(entry.min_price),
    maximum: formatCurrency(entry.max_price),
    sample: formatNumber(entry.sample_size),
  }))
}

function buildOccupancyRows(analysis?: PriceWiseAnalysis) {
  return analysis?.occupancy_metrics?.map((entry) => ({
    hotel: String(entry.hotel_name ?? "Unknown"),
    occupancy: formatPercent(entry.occupancy_rate),
    soldOut: formatNumber(entry.sold_out),
    available: formatNumber(entry.available),
  }))
}

export default async function Page() {
  const analysis = await getScraperAnalysis()

  const pricingRows = buildPricingRows(analysis)
  const occupancyRows = buildOccupancyRows(analysis)

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
        <Tabs defaultValue="pricing" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pricing">Pricing</TabsTrigger>
            <TabsTrigger value="occupancy">Occupancy</TabsTrigger>
            <TabsTrigger value="room-analysis">Rooms</TabsTrigger>
          </TabsList>

          <TabsContent value="pricing">
            {/* Two Column Layout for Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Left Column: Price Difference and Occupancy */}
              <div className="space-y-4">
                {comparisonWithRef.length > 0 && (
                  <PriceDifferenceChart 
                    comparisonData={comparisonWithRef as any}
                    referenceProperty={analysis?.reference_property || ''}
                  />
                )}
                
                {occupancyMetrics.length > 0 && (
                  <OccupancyComparisonChart 
                    data={occupancyMetrics as any} 
                    referenceProperty={analysis?.reference_property || ''}
                  />
                )}
              </div>

              {/* Right Column: Price Range */}
              {pricingMetrics.length > 0 && (
                <PriceRangeChart 
                  pricingData={pricingMetrics as any}
                  referenceProperty={analysis?.reference_property || ''}
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="occupancy">
            {occupancyMetrics.length > 0 ? (
              <Card>
                <CardContent className="py-8">
                  <p className="text-sm text-muted-foreground text-center">
                    Occupancy analysis has been moved to the Pricing tab for better comparison with pricing metrics.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-8">
                  <p className="text-sm text-muted-foreground text-center">No occupancy metrics were generated.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="room-analysis">
            {/* Room Inventory Analysis */}
            {roomInventory.length > 0 ? (
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
                        <TableHead className="text-right">Avg Room Types</TableHead>
                        <TableHead className="text-right">Room Occupancy</TableHead>
                        <TableHead className="text-right">Low Inventory %</TableHead>
                        <TableHead className="text-right">Avg Room Price</TableHead>
                        <TableHead className="text-right">Price Spread</TableHead>
                        <TableHead>Price Tiering</TableHead>
                        <TableHead className="text-right">Samples</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedRoomInventory.map((row: any, index: number) => {
                        const isReference = row.hotel_name === analysis?.reference_property
                        const priceSpread = Number(row.room_price_spread_pct || 0)
                        const usesTiering = row.uses_room_tiering || false
                        
                        return (
                          <TableRow key={index} className={isReference ? "bg-muted/50" : ""}>
                            <TableCell className="font-medium">
                              {row.hotel_name}
                              {isReference && " ⭐"}
                            </TableCell>
                            <TableCell className="text-right">{Number(row.avg_total_room_types || 0).toFixed(1)}</TableCell>
                            <TableCell className="text-right">{Number(row.avg_room_occupancy_rate || 0).toFixed(1)}%</TableCell>
                            <TableCell className="text-right">{Number(row.low_inventory_pct || 0).toFixed(1)}%</TableCell>
                            <TableCell className="text-right">
                              {row.avg_room_price ? `R ${Number(row.avg_room_price).toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '—'}
                            </TableCell>
                            <TableCell className="text-right">
                              {priceSpread > 0 ? `${priceSpread.toFixed(1)}%` : '—'}
                            </TableCell>
                            <TableCell>
                              <span className={usesTiering ? "text-green-600 font-medium" : "text-muted-foreground"}>
                                {usesTiering ? "Yes" : "No"}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">{row.sample_size || 0}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                  <div className="mt-4 text-sm text-muted-foreground space-y-1">
                    <p><strong>Room Occupancy:</strong> Percentage of available room types that are sold out</p>
                    <p><strong>Low Inventory %:</strong> How often properties have limited room availability</p>
                    <p><strong>Price Spread:</strong> Difference between cheapest and most expensive room as a percentage</p>
                    <p><strong>Price Tiering:</strong> Properties using multiple room types at different price points (&gt;50% spread)</p>
                  </div>
                </CardContent>
              </Card>
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

