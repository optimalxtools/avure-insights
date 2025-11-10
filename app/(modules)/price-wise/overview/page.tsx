export const dynamic = "force-dynamic"

import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb"
import { SectionTitle } from "@/components/section-title"
import { ExportButton } from "@/components/export-button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { AIButton } from "@/components/ai-button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { getScraperAnalysis } from "@/lib/price-wise/scraper"
import { RefreshButton } from "@/components/price-wise-refresh-button"

export default async function Page() {
  const analysis = await getScraperAnalysis()

  const generatedLabel = analysis?.generated_at
    ? `Generated at ${new Date(analysis.generated_at).toLocaleString()}`
    : "No analysis has been produced yet"

  // Parse data from analysis
  const pricingMetrics = analysis?.pricing_metrics || []
  const occupancyMetrics = analysis?.occupancy_metrics || []
  const comparison = analysis?.comparison || []
  
  // Find reference property data
  const refPricing = pricingMetrics.find((p: any) => p.hotel_name === analysis?.reference_property)
  const refOccupancy = occupancyMetrics.find((o: any) => o.hotel_name === analysis?.reference_property)
  
  // Sort occupancy by rate (descending)
  const sortedOccupancy = [...occupancyMetrics].sort((a: any, b: any) => (b.occupancy_rate || 0) - (a.occupancy_rate || 0))
  
  // Sort comparison by price difference
  const sortedComparison = [...comparison].sort((a: any, b: any) => (a.price_vs_ref_pct || 0) - (b.price_vs_ref_pct || 0))

  // Calculate market position
  const cheaperCount = comparison.filter((c: any) => (c.price_vs_ref || 0) < 0).length
  const expensiveCount = comparison.filter((c: any) => (c.price_vs_ref || 0) > 0).length

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
            <RefreshButton lastUpdated={analysis?.generated_at || null} />
            <AIButton currentPage="Price-Wise - Overview" />
          </div>
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-4 px-2 md:px-4 pt-0 md:pt-0 pb-2 md:pb-4 overflow-x-auto" style={{ maxWidth: "100vw" }}>
        <div className="px-2 md:px-0">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <span className="text-muted-foreground">Price Wise</span>
              <h1 className="text-3xl font-semibold tracking-tight">Overview</h1>
              <p className="text-sm text-muted-foreground">{generatedLabel}</p>
            </div>
            <ExportButton />
          </div>
        </div>

        {!analysis ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-sm text-muted-foreground text-center">
                Run the scraper to generate competitive pricing analysis.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Executive Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Executive Summary</CardTitle>
                <CardDescription>{analysis.reference_property} {analysis.mode && `(${analysis.mode})`}</CardDescription>
              </CardHeader>
              <CardContent>
                {refPricing && refOccupancy ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Average Price/Night</div>
                        <div className="text-2xl font-semibold">R {Number(refPricing.avg_price_per_night || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Price Range</div>
                        <div className="text-2xl font-semibold">R {Number(refPricing.min_price || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })} - R {Number(refPricing.max_price || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Occupancy Rate</div>
                        <div className="text-2xl font-semibold">{Number(refOccupancy.occupancy_rate || 0).toFixed(1)}%</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Discount Frequency</div>
                        <div className="text-2xl font-semibold">{Number(refPricing.discount_frequency || 0).toFixed(1)}%</div>
                      </div>
                    </div>
                    {comparison.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <div className="text-sm text-muted-foreground mb-2">Market Position</div>
                        <div className="flex gap-4">
                          <div>
                            <span className="font-semibold">{cheaperCount}</span> competitors priced lower
                          </div>
                          <div>
                            <span className="font-semibold">{expensiveCount}</span> competitors priced higher
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : refOccupancy ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Occupancy Rate</div>
                      <div className="text-2xl font-semibold">{Number(refOccupancy.occupancy_rate || 0).toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Availability Rate</div>
                      <div className="text-2xl font-semibold">{Number(refOccupancy.availability_rate || 0).toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Total Checks</div>
                      <div className="text-2xl font-semibold">{refOccupancy.total_checks || 0}</div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No data available for reference property.</p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </>
  )
}
