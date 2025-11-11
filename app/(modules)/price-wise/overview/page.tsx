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
import { PriceComparisonChart, OccupancyComparisonChart, RoomStrategyChart, OpportunityCostChart } from "@/components/price-wise/overview-charts"

export default async function Page() {
  const analysis = await getScraperAnalysis()

  const generatedLabel = analysis?.generated_at
    ? `Generated at ${new Date(analysis.generated_at).toLocaleString()}`
    : "No analysis has been produced yet"

  // Parse data from analysis
  const pricingMetrics = analysis?.pricing_metrics || []
  const occupancyMetrics = analysis?.occupancy_metrics || []
  const comparison = analysis?.comparison || []
  const roomInventory = analysis?.room_inventory || []
  
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

  // Calculate optimal price recommendation (focused on increasing occupancy)
  const calculateOptimalPrice = () => {
    if (!refPricing || !refOccupancy) return null

    const currentPrice = Number(refPricing.avg_price_per_night || 0)
    const currentOccupancy = Number(refOccupancy.occupancy_rate || 0)
    
    // Get competitors with both pricing and occupancy data
    const competitorData = pricingMetrics
      .map((p: any) => {
        const occ = occupancyMetrics.find((o: any) => o.hotel_name === p.hotel_name)
        return {
          name: p.hotel_name,
          price: Number(p.avg_price_per_night || 0),
          occupancy: Number(occ?.occupancy_rate || 0)
        }
      })
      .filter((c: any) => c.price > 0 && c.occupancy > 0 && c.name !== analysis?.reference_property)

    if (competitorData.length === 0) return null

    // Find competitors with higher occupancy than us
    const higherOccupancyCompetitors = competitorData
      .filter((c: any) => c.occupancy > currentOccupancy)
      .sort((a: any, b: any) => b.occupancy - a.occupancy)

    // Calculate market averages
    const avgMarketPrice = competitorData.reduce((sum: number, c: any) => sum + c.price, 0) / competitorData.length
    const avgMarketOccupancy = competitorData.reduce((sum: number, c: any) => sum + c.occupancy, 0) / competitorData.length

    // Find high occupancy performers (>70% occupancy)
    const highOccupancyPerformers = competitorData.filter((c: any) => c.occupancy >= 70)
    const avgHighOccupancyPrice = highOccupancyPerformers.length > 0 
      ? highOccupancyPerformers.reduce((sum: number, c: any) => sum + c.price, 0) / highOccupancyPerformers.length 
      : avgMarketPrice

    let recommendedMin = currentPrice
    let recommendedMax = currentPrice
    let reasoning = ""
    let strategy = ""

    // GOAL: Increase occupancy - pricing strategy depends on current position
    if (currentOccupancy >= 80) {
      // Already at excellent occupancy - can try increasing price slightly
      recommendedMin = currentPrice
      recommendedMax = currentPrice * 1.05
      reasoning = `Excellent occupancy (${currentOccupancy.toFixed(1)}%). Maintain current pricing or test modest increases.`
      strategy = "Maintain strong performance"
    } else if (currentOccupancy >= 70) {
      // Good occupancy but room to grow
      if (currentPrice > avgHighOccupancyPrice) {
        // Priced above high occupancy competitors - consider price reduction
        recommendedMin = avgHighOccupancyPrice * 0.95
        recommendedMax = avgHighOccupancyPrice * 1.02
        reasoning = `Good occupancy (${currentOccupancy.toFixed(1)}%) but priced ${((currentPrice/avgHighOccupancyPrice - 1) * 100).toFixed(0)}% above high-occupancy competitors. Competitive pricing could boost to 80%+.`
        strategy = "Competitive pricing to capture market share"
      } else {
        // Priced competitively - maintain
        recommendedMin = currentPrice * 0.98
        recommendedMax = currentPrice * 1.02
        reasoning = `Solid occupancy (${currentOccupancy.toFixed(1)}%) with competitive pricing. Continue current strategy.`
        strategy = "Maintain momentum"
      }
    } else if (currentOccupancy >= 50) {
      // Moderate occupancy - need to improve
      if (higherOccupancyCompetitors.length > 0) {
        const avgHigherOccPrice = higherOccupancyCompetitors.reduce((sum: number, c: any) => sum + c.price, 0) / higherOccupancyCompetitors.length
        if (currentPrice > avgHigherOccPrice * 1.1) {
          // Significantly more expensive than better performers - price is likely barrier
          recommendedMin = avgHigherOccPrice * 0.90
          recommendedMax = avgHigherOccPrice
          reasoning = `Moderate occupancy (${currentOccupancy.toFixed(1)}%). You're priced ${((currentPrice/avgHigherOccPrice - 1) * 100).toFixed(0)}% above competitors with ${higherOccupancyCompetitors[0].occupancy.toFixed(0)}%+ occupancy. Price reduction recommended.`
          strategy = "Price adjustment to boost bookings"
        } else {
          // Pricing is competitive - issue may not be price
          recommendedMin = currentPrice * 0.95
          recommendedMax = currentPrice
          reasoning = `Moderate occupancy (${currentOccupancy.toFixed(1)}%). Pricing is competitive. Consider value-adds, marketing, or modest price reduction.`
          strategy = "Multi-factor approach needed"
        }
      } else {
        // You have highest occupancy - can maintain/increase
        recommendedMin = currentPrice
        recommendedMax = currentPrice * 1.08
        reasoning = `You lead the market at ${currentOccupancy.toFixed(1)}% occupancy. Room to increase prices.`
        strategy = "Market leader pricing"
      }
    } else {
      // Low occupancy (<50%) - urgent action needed
      const lowPricePoint = avgMarketPrice * 0.85
      recommendedMin = Math.min(lowPricePoint, currentPrice * 0.90)
      recommendedMax = avgMarketPrice * 0.95
      reasoning = `Low occupancy (${currentOccupancy.toFixed(1)}%) requires immediate action. Competitive pricing essential to drive bookings.`
      strategy = "Aggressive pricing to drive occupancy"
    }

    return {
      min: Math.round(recommendedMin),
      max: Math.round(recommendedMax),
      current: Math.round(currentPrice),
      reasoning,
      strategy,
      marketAvg: Math.round(avgMarketPrice),
      highOccupancyAvg: Math.round(avgHighOccupancyPrice),
      targetOccupancy: currentOccupancy >= 80 ? "80%+ (Achieved!)" : "75-85% (Optimal)"
    }
  }

  const optimalPrice = calculateOptimalPrice()

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
            {/* Executive Summary - Snapshot Blocks */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {refPricing && (
                <Card className="relative overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground mb-2">Average Price/Night</p>
                        <h3 className="text-3xl font-bold tracking-tight">
                          R {Number(refPricing.avg_price_per_night || 0).toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">{analysis.reference_property}</p>
                      </div>
                      <div className="rounded-lg bg-primary/10 p-3">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                        </svg>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {refOccupancy && (
                <Card className="relative overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground mb-2">Occupancy Rate</p>
                        <h3 className="text-3xl font-bold tracking-tight">
                          {Number(refOccupancy.occupancy_rate || 0).toFixed(1)}%
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">Current booking rate</p>
                      </div>
                      <div className="rounded-lg bg-blue-500/10 p-3">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
                          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                          <polyline points="9 22 9 12 15 12 15 22"/>
                        </svg>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {refPricing && (
                <Card className="relative overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground mb-2">Price Range</p>
                        <h3 className="text-2xl font-bold tracking-tight">
                          R {Number(refPricing.min_price || 0).toLocaleString('en-ZA', { minimumFractionDigits: 0 })} - {Number(refPricing.max_price || 0).toLocaleString('en-ZA', { minimumFractionDigits: 0 })}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">Min - Max pricing</p>
                      </div>
                      <div className="rounded-lg bg-orange-500/10 p-3">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500">
                          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                          <line x1="3" y1="6" x2="21" y2="6"/>
                          <path d="M16 10a4 4 0 0 1-8 0"/>
                        </svg>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {refPricing && (
                <Card className="relative overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground mb-2">Discount Frequency</p>
                        <h3 className="text-3xl font-bold tracking-tight">
                          {Number(refPricing.discount_frequency || 0).toFixed(1)}%
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">Discounted listings</p>
                      </div>
                      <div className="rounded-lg bg-pink-500/10 p-3">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-pink-500">
                          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                          <polyline points="7.5 4.21 12 6.81 16.5 4.21"/>
                          <polyline points="7.5 19.79 7.5 14.6 3 12"/>
                          <polyline points="21 12 16.5 14.6 16.5 19.79"/>
                          <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                          <line x1="12" y1="22.08" x2="12" y2="12"/>
                        </svg>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Optimal Price Recommendation and Market Position */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {optimalPrice && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Optimal Price Recommendation</CardTitle>
                      <span className="text-xs text-primary font-medium px-2 py-1 bg-primary/10 rounded">{optimalPrice.strategy}</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-semibold text-primary">
                          R {optimalPrice.min.toLocaleString('en-ZA')} - R {optimalPrice.max.toLocaleString('en-ZA')}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          (Current: R {optimalPrice.current.toLocaleString('en-ZA')})
                        </span>
                      </div>
                      <p className="text-sm">{optimalPrice.reasoning}</p>
                      <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                        <span>Market Avg: R {optimalPrice.marketAvg.toLocaleString('en-ZA')}</span>
                        <span>High Occupancy Avg: R {optimalPrice.highOccupancyAvg.toLocaleString('en-ZA')}</span>
                        <span>Target: {optimalPrice.targetOccupancy}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {comparison.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Market Position</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-6">
                      <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-green-500/10 p-2">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                          </svg>
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{cheaperCount}</p>
                          <p className="text-xs text-muted-foreground">Competitors priced lower</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-red-500/10 p-2">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                          </svg>
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{expensiveCount}</p>
                          <p className="text-xs text-muted-foreground">Competitors priced higher</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Visualization Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {pricingMetrics.length > 0 && occupancyMetrics.length > 0 && (
                <PriceComparisonChart 
                  pricingData={pricingMetrics as any}
                  occupancyData={occupancyMetrics as any}
                  referenceProperty={analysis.reference_property}
                />
              )}
              {occupancyMetrics.length > 0 && (
                <OccupancyComparisonChart 
                  data={occupancyMetrics as any} 
                  referenceProperty={analysis.reference_property}
                />
              )}
            </div>

            {/* Opportunity Cost Analysis - Full Width */}
            {refPricing && refOccupancy && (
              <OpportunityCostChart 
                currentPrice={Number(refPricing.avg_price_per_night || 0)}
                currentOccupancy={Number(refOccupancy.occupancy_rate || 0)}
                referenceProperty={analysis.reference_property}
              />
            )}
          </>
        )}
      </div>
    </>
  )
}
