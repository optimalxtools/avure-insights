"use client"

import { useMemo } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Cell, Scatter, ScatterChart, ZAxis, ReferenceLine } from "recharts"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart"

const chartConfig = {
  value: {
    label: "Value",
    color: "hsl(var(--chart-1))",
  },
  reference: {
    label: "Reference",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

const formatCurrency = (value: number) => `R${Math.round(value).toLocaleString("en-ZA")}`

interface PriceChartProps {
  pricingData: Array<{
    hotel_name: string
    avg_price_per_night: number | string | null
  }>
  occupancyData: Array<{
    hotel_name: string
    occupancy_rate: number | string | null
  }>
  referenceProperty: string
}

export function PriceComparisonChart({ pricingData, occupancyData, referenceProperty }: PriceChartProps) {
  const chartData = pricingData
    .map((pricing) => {
      const occupancy = occupancyData.find((o) => o.hotel_name === pricing.hotel_name)
      const price = toNumber(pricing.avg_price_per_night) ?? 0
      const occupancyRate = toNumber(occupancy?.occupancy_rate) ?? 0

      return {
        name: pricing.hotel_name,
        price: Math.round(price),
        occupancy: Number(occupancyRate.toFixed(1)),
        isReference: pricing.hotel_name === referenceProperty,
      }
    })
    .filter((item) => item.price > 0 && item.occupancy > 0)

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Market Positioning</CardTitle>
          <CardDescription>Price vs Occupancy - optimal position is top-right</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Insufficient data to display market positioning.</p>
        </CardContent>
      </Card>
    )
  }

  const avgPrice = chartData.reduce((sum, item) => sum + item.price, 0) / chartData.length
  const avgOccupancy = chartData.reduce((sum, item) => sum + item.occupancy, 0) / chartData.length
  const referencePoint = chartData.find((item) => item.isReference) ?? null
  const referenceName = referenceProperty || "Reference property"

  const summaryCards: Array<{ key: string; type: "insight" | "recommendation"; title: string; body: string }> = []

  if (referencePoint) {
    const occupancyDiff = referencePoint.occupancy - avgOccupancy
    const priceDiff = referencePoint.price - avgPrice
    const occupancyCopy = Math.abs(occupancyDiff) < 0.5
      ? "is in line with"
      : `is ${Math.abs(occupancyDiff).toFixed(1)}pp ${occupancyDiff >= 0 ? "above" : "below"}`
    const priceCopy = Math.abs(priceDiff) < 200
      ? "in line with"
      : `${priceDiff >= 0 ? "above" : "below"} peers by ${formatCurrency(Math.abs(priceDiff))}`

    summaryCards.push({
      key: "reference-market",
      type: "insight",
      title: "Reference positioning",
      body: `${referenceName} ${occupancyCopy} the market occupancy average and is priced ${priceCopy}.`,
    })
  }

  const leadingPeer = chartData
    .filter((item) => !item.isReference)
    .sort((a, b) => b.occupancy - a.occupancy || a.price - b.price)[0]

  if (leadingPeer && referencePoint) {
    const occupancyLead = leadingPeer.occupancy - referencePoint.occupancy
    const priceGap = referencePoint.price - leadingPeer.price
    const occupancyStatement = occupancyLead > 1
      ? `${leadingPeer.name} is achieving ${occupancyLead.toFixed(1)}pp higher occupancy`
      : `${leadingPeer.name} has comparable occupancy`
    const priceStatement = Math.abs(priceGap) < 200
      ? "at similar pricing"
      : priceGap > 0
        ? `while charging ${formatCurrency(Math.abs(priceGap))} less`
        : `despite charging ${formatCurrency(Math.abs(priceGap))} more`

    summaryCards.push({
      key: "peer-benchmark",
      type: "recommendation",
      title: "Benchmark to watch",
      body: `${occupancyStatement} ${priceStatement}. Test targeted offers to close the occupancy gap.`,
    })
  }

  while (summaryCards.length < 2) {
    const fallbackType = summaryCards.length === 0 ? "insight" : "recommendation"
    summaryCards.push({
      key: `fallback-${summaryCards.length}`,
      type: fallbackType,
      title: fallbackType === "insight" ? "Data coverage" : "Next action",
      body:
        fallbackType === "insight"
          ? "Collect more competitor pricing data to sharpen market positioning benchmarks."
          : "Refresh Price-Wise data after rate changes to confirm impact on demand.",
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Market Positioning</CardTitle>
        <CardDescription>Price vs Occupancy - optimal position is top-right</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          {summaryCards.map((card) => (
            <div key={card.key} className="rounded-lg border bg-muted/30 p-3">
              <div className="mb-1 flex items-center gap-2">
                <Badge
                  variant={card.type === "insight" ? "secondary" : "default"}
                  className="uppercase tracking-wide"
                >
                  {card.type === "insight" ? "Insight" : "Recommendation"}
                </Badge>
                <span className="text-xs font-semibold text-muted-foreground">{card.title}</span>
              </div>
              <p className="text-sm leading-5 text-foreground">{card.body}</p>
            </div>
          ))}
        </div>
        <ChartContainer config={chartConfig} className="h-[400px] w-full">
          <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="occupancy"
              name="Occupancy"
              unit="%"
              domain={[0, 100]}
              label={{ value: "Occupancy Rate (%)", position: "bottom", offset: 0, style: { fontSize: 12 } }}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              type="number"
              dataKey="price"
              name="Price"
              tickFormatter={(value) => `R${(value / 1000).toFixed(0)}k`}
              label={{ value: "Avg Price/Night", angle: -90, position: "insideLeft", style: { fontSize: 12 } }}
              tick={{ fontSize: 11 }}
            />
            <ZAxis range={[200, 400]} />
            <ReferenceLine x={avgOccupancy} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" opacity={0.5} />
            <ReferenceLine y={avgPrice} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" opacity={0.5} />
            <ChartTooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload as (typeof chartData)[number]
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-sm">
                      <div className="grid gap-2">
                        <div className="flex flex-col">
                          <span className="text-[0.70rem] font-bold">
                            {data.name}
                            {data.isReference && " ⭐"}
                          </span>
                          <span className="text-[0.70rem] text-muted-foreground">Price: R {data.price.toLocaleString("en-ZA")}</span>
                          <span className="text-[0.70rem] text-muted-foreground">Occupancy: {data.occupancy}%</span>
                        </div>
                      </div>
                    </div>
                  )
                }
                return null
              }}
            />
            <Scatter data={chartData} shape="circle">
              {chartData.map((entry, index) => (
                <Cell
                  key={`scatter-${index}`}
                  fill={entry.isReference ? "hsl(var(--chart-2))" : "hsl(var(--chart-1))"}
                  opacity={entry.isReference ? 1 : 0.75}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ChartContainer>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div className="text-center">
            <span className="font-medium">Top-Right:</span> Premium pricing with high demand
          </div>
          <div className="text-center">
            <span className="font-medium">Bottom-Right:</span> High demand, room to increase prices
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface OccupancyChartProps {
  data: Array<{
    hotel_name: string
    occupancy_rate: number | string | null
    sold_out: number | string | null
    available: number | string | null
  }>
  referenceProperty: string
}

export function InsightsOccupancyChart({ data, referenceProperty }: OccupancyChartProps) {
  const sortedData = [...data]
    .sort((a, b) => (toNumber(b.occupancy_rate) ?? 0) - (toNumber(a.occupancy_rate) ?? 0))
    .slice(0, 8)
    .map((item) => ({
      name: item.hotel_name,
      soldOut: Number(toNumber(item.sold_out) ?? 0),
      available: Number(toNumber(item.available) ?? 0),
      occupancyRate: Number((toNumber(item.occupancy_rate) ?? 0).toFixed(1)),
      isReference: item.hotel_name === referenceProperty,
    }))

  if (sortedData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Occupancy Analysis</CardTitle>
          <CardDescription>Availability vs Sold Out checks (Top 8)</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No occupancy metrics were generated.</p>
        </CardContent>
      </Card>
    )
  }

  const stackedChartConfig = {
    soldOut: {
      label: "Sold Out",
      color: "hsl(var(--chart-1))",
    },
    available: {
      label: "Available",
      color: "hsl(var(--muted))",
    },
  } satisfies ChartConfig

  return (
    <Card>
      <CardHeader>
        <CardTitle>Occupancy Analysis</CardTitle>
        <CardDescription>Availability vs Sold Out checks (Top 8)</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={stackedChartConfig} className="h-[400px] w-full">
          <BarChart data={sortedData} margin={{ top: 20, right: 10, left: 10, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="name"
              angle={-45}
              textAnchor="end"
              height={100}
              interval={0}
              tick={{ fontSize: 12 }}
            />
            <YAxis tick={{ fontSize: 12 }} label={{ value: "Number of Checks", angle: -90, position: "insideLeft", style: { fontSize: 12 } }} />
            <ChartTooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload as (typeof sortedData)[number]
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-sm">
                      <div className="grid gap-2">
                        <div className="flex flex-col">
                          <span className="text-[0.70rem] font-bold">
                            {data.name}
                            {data.isReference && " ⭐"}
                          </span>
                          <span className="text-[0.70rem] text-muted-foreground">Occupancy: {data.occupancyRate}%</span>
                          <div className="mt-1 space-y-0.5">
                            <div className="flex items-center gap-2">
                              <div className="h-3 w-3 rounded" style={{ backgroundColor: "hsl(var(--chart-1))" }} />
                              <span className="text-[0.65rem]">Sold Out: {data.soldOut}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="h-3 w-3 rounded" style={{ backgroundColor: "hsl(var(--muted))" }} />
                              <span className="text-[0.65rem]">Available: {data.available}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                }
                return null
              }}
            />
            <Bar dataKey="soldOut" stackId="a" radius={[0, 0, 0, 0]}>
              {sortedData.map((entry, index) => (
                <Cell key={`sold-${index}`} fill={entry.isReference ? "hsl(var(--chart-2))" : "hsl(var(--chart-1))"} />
              ))}
            </Bar>
            <Bar dataKey="available" stackId="a" radius={[4, 4, 0, 0]}>
              {sortedData.map((entry, index) => (
                <Cell key={`avail-${index}`} fill={entry.isReference ? "hsl(var(--muted))" : "hsl(var(--muted))"} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
        <div className="mt-2 text-center text-xs text-muted-foreground">Higher sold-out ratio indicates stronger demand and market positioning</div>
      </CardContent>
    </Card>
  )
}

interface RoomChartProps {
  data: Array<{
    hotel_name: string
    avg_room_occupancy_rate: number | string | null
    room_price_spread_pct: number | string | null
    uses_room_tiering: boolean | null
  }>
  referenceProperty: string
}

export function RoomStrategyChart({ data, referenceProperty }: RoomChartProps) {
  const sortedData = [...data]
    .sort((a, b) => (toNumber(b.room_price_spread_pct) ?? 0) - (toNumber(a.room_price_spread_pct) ?? 0))
    .slice(0, 8)
    .map((item) => ({
      name: item.hotel_name,
      value: Number((toNumber(item.room_price_spread_pct) ?? 0).toFixed(1)),
      isReference: item.hotel_name === referenceProperty,
      usesTiering: Boolean(item.uses_room_tiering),
    }))

  if (sortedData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Room Pricing Strategy</CardTitle>
          <CardDescription>Price spread across room types (Top 8)</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No room inventory data available.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Room Pricing Strategy</CardTitle>
        <CardDescription>Price spread across room types (Top 8)</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <BarChart data={sortedData} margin={{ top: 20, right: 10, left: 10, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="name"
              angle={-45}
              textAnchor="end"
              height={100}
              interval={0}
              tick={{ fontSize: 12 }}
            />
            <YAxis tickFormatter={(value) => `${value}%`} tick={{ fontSize: 12 }} label={{ value: "Price Spread (%)", angle: -90, position: "insideLeft" }} />
            <ChartTooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload as (typeof sortedData)[number]
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-sm">
                      <div className="grid gap-2">
                        <div className="flex flex-col">
                          <span className="text-[0.70rem] font-bold">{data.name}</span>
                          <span className="text-[0.70rem] text-muted-foreground">Price Spread: {data.value}%</span>
                          <span className="text-[0.70rem] text-muted-foreground">Tiered Pricing: {data.usesTiering ? "Yes" : "No"}</span>
                        </div>
                      </div>
                    </div>
                  )
                }
                return null
              }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {sortedData.map((entry, index) => (
                <Cell key={`room-${index}`} fill={entry.isReference ? "hsl(var(--chart-2))" : "hsl(var(--chart-1))"} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
        <div className="mt-2 text-center text-xs text-muted-foreground">Higher spread indicates multiple room types at different price points</div>
      </CardContent>
    </Card>
  )
}

interface OpportunityCostChartProps {
  currentPrice: number
  currentOccupancy: number
  referenceProperty: string
}

export function OpportunityCostChart({ currentPrice, currentOccupancy, referenceProperty }: OpportunityCostChartProps) {
  const chartPoints = useMemo(() => {
    if (currentPrice <= 0 || currentOccupancy <= 0) return []

    const points: Array<{
      occupancy: number
      revenue: number
      operatingCost: number
      netRevenue: number
      opportunityCost: number
      isCurrent: boolean
    }> = []

    const currentRevenue = currentPrice * (currentOccupancy / 100) * 30
    const baseCostRate = 0.25
    const currentBaseCost = currentRevenue * baseCostRate
    let currentVariableMultiplier = 1
    if (currentOccupancy > 75) {
      const stressFactor = (currentOccupancy - 75) / 20
      currentVariableMultiplier = 1 + Math.pow(stressFactor, 2.5) * 1.5
    }
    const currentVariableCost = currentRevenue * 0.15 * currentVariableMultiplier
    const currentNetRevenue = currentRevenue - (currentBaseCost + currentVariableCost)

    for (let occupancy = 40; occupancy <= 100; occupancy += 5) {
      const revenue = currentPrice * (occupancy / 100) * 30
      const baseCost = revenue * baseCostRate
      let variableCostMultiplier = 1
      if (occupancy > 75) {
        const stressFactor = (occupancy - 75) / 20
        variableCostMultiplier = 1 + Math.pow(stressFactor, 2.5) * 1.5
      }
      const variableCost = revenue * 0.15 * variableCostMultiplier
      const totalCost = baseCost + variableCost
      const netRevenue = revenue - totalCost
      const opportunityCost = netRevenue - currentNetRevenue

      points.push({
        occupancy,
        revenue: Math.round(revenue),
        operatingCost: Math.round(totalCost),
        netRevenue: Math.round(netRevenue),
        opportunityCost: Math.round(opportunityCost),
        isCurrent: Math.abs(occupancy - currentOccupancy) < 3,
      })
    }

    return points
  }, [currentPrice, currentOccupancy])

  if (chartPoints.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Occupancy Opportunity Cost Analysis</CardTitle>
          <CardDescription>Revenue vs operating costs across occupancy levels for {referenceProperty}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Insufficient data to analyse opportunity cost.</p>
        </CardContent>
      </Card>
    )
  }

  const optimalPoint = chartPoints
    .filter((point) => point.occupancy <= 90)
    .reduce((max, point) => (point.netRevenue > max.netRevenue ? point : max), chartPoints[0])

  const referenceName = referenceProperty || "Reference property"
  const currentPoint = chartPoints.reduce((closest, point) => {
    if (point.isCurrent) return point
    const currentDistance = Math.abs(point.occupancy - currentOccupancy)
    const closestDistance = Math.abs((closest.isCurrent ? currentOccupancy : closest.occupancy) - currentOccupancy)
    return currentDistance < closestDistance ? point : closest
  }, chartPoints[0])

  const netRevenueDelta = optimalPoint.netRevenue - currentPoint.netRevenue

  const opportunityCards: Array<{ key: string; type: "insight" | "recommendation"; title: string; body: string }> = [
    {
      key: "current-snapshot",
      type: "insight",
      title: "Current run-rate",
      body: `${referenceName} nets ${formatCurrency(currentPoint.netRevenue)} at ${currentPoint.occupancy}% occupancy with operating costs of ${formatCurrency(currentPoint.operatingCost)}.`,
    },
  ]

  if (Math.abs(optimalPoint.occupancy - currentPoint.occupancy) <= 2) {
    opportunityCards.push({
      key: "maintain-course",
      type: "recommendation",
      title: "Stay the course",
      body: `Current performance is within ${Math.abs(optimalPoint.occupancy - currentPoint.occupancy).toFixed(1)}pp of the optimal ${optimalPoint.occupancy}% occupancy. Maintain pricing and monitor demand shifts.`,
    })
  } else if (optimalPoint.occupancy > currentPoint.occupancy) {
    opportunityCards.push({
      key: "push-demand",
      type: "recommendation",
      title: "Stimulate demand",
      body: `Target ${optimalPoint.occupancy}% occupancy to unlock roughly ${formatCurrency(optimalPoint.opportunityCost)} in net revenue without materially increasing operating stress.`,
    })
  } else {
    opportunityCards.push({
      key: "optimize-load",
      type: "recommendation",
      title: "Relieve load",
      body: `Occupancy sits ${Math.abs(optimalPoint.occupancy - currentPoint.occupancy).toFixed(1)}pp above the optimal ${optimalPoint.occupancy}% level, costing about ${formatCurrency(Math.abs(netRevenueDelta))} in net revenue. Consider premium pricing or minimum stays to protect margin.`,
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Occupancy Opportunity Cost Analysis</CardTitle>
        <CardDescription>Revenue vs operating costs across occupancy levels for {referenceProperty}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          {opportunityCards.map((card) => (
            <div key={card.key} className="rounded-lg border bg-muted/30 p-3">
              <div className="mb-1 flex items-center gap-2">
                <Badge
                  variant={card.type === "insight" ? "secondary" : "default"}
                  className="uppercase tracking-wide"
                >
                  {card.type === "insight" ? "Insight" : "Recommendation"}
                </Badge>
                <span className="text-xs font-semibold text-muted-foreground">{card.title}</span>
              </div>
              <p className="text-sm leading-5 text-foreground">{card.body}</p>
            </div>
          ))}
        </div>
        <ChartContainer config={chartConfig} className="h-[400px] w-full">
          <BarChart data={chartPoints} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="occupancy"
              angle={-45}
              textAnchor="end"
              height={80}
              interval={0}
              tick={{ fontSize: 11 }}
              label={{ value: "Occupancy Rate (%)", position: "insideBottom", offset: -10 }}
            />
            <YAxis tickFormatter={(value) => `R${value.toLocaleString()}`} tick={{ fontSize: 11 }} label={{ value: "Revenue (ZAR)", angle: -90, position: "insideLeft" }} />
            <ChartTooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const point = payload[0].payload as (typeof chartPoints)[number]
                  return (
                    <div className="rounded-lg border bg-background p-3 shadow-sm">
                      <div className="grid gap-2">
                        <div className="flex flex-col">
                          <span className="mb-1 text-xs font-bold">{point.isCurrent && "⭐ "}Occupancy: {point.occupancy}%</span>
                          <span className="text-xs text-muted-foreground">Gross Revenue: R{point.revenue.toLocaleString()}</span>
                          <span className="text-xs text-muted-foreground">Operating Costs: R{point.operatingCost.toLocaleString()}</span>
                          <span className="mt-1 text-xs font-semibold text-green-600">Net Revenue: R{point.netRevenue.toLocaleString()}</span>
                          <span className={`mt-1 text-xs font-medium ${point.opportunityCost >= 0 ? "text-green-600" : "text-red-600"}`}>
                            vs Current: {point.opportunityCost >= 0 ? "+" : ""}R{point.opportunityCost.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                }
                return null
              }}
            />
            <ReferenceLine
              x={optimalPoint.occupancy}
              stroke="hsl(var(--primary))"
              strokeDasharray="5 5"
              strokeWidth={2}
              label={{ value: `Optimal: ${optimalPoint.occupancy}%`, position: "top", fill: "hsl(var(--primary))", fontSize: 12, fontWeight: "bold" }}
            />
            <Bar dataKey="netRevenue" radius={[4, 4, 0, 0]}>
              {chartPoints.map((entry, index) => (
                <Cell
                  key={`net-${index}`}
                  fill={
                    entry.isCurrent
                      ? "hsl(var(--chart-2))"
                      : entry.occupancy === optimalPoint.occupancy
                        ? "hsl(var(--primary))"
                        : "hsl(var(--chart-1))"
                  }
                  opacity={entry.isCurrent ? 1 : 0.8}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
        <div className="mt-3 space-y-2">
          <div className="text-center text-xs text-muted-foreground">
            Operating costs increase exponentially above 75% occupancy due to accelerated wear, maintenance demands, and property stress.
          </div>
          <div className="flex justify-center gap-6 text-xs">
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded" style={{ backgroundColor: "hsl(var(--chart-2))" }} />
              <span>Current: {currentOccupancy.toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded" style={{ backgroundColor: "hsl(var(--primary))" }} />
              <span>Optimal: {optimalPoint.occupancy}%</span>
            </div>
          </div>
          {Math.abs(optimalPoint.occupancy - currentOccupancy) > 5 ? (
            <div className="mt-2 rounded-md bg-muted/50 p-2 text-center text-xs">
              <span className={optimalPoint.occupancy > currentOccupancy ? "text-green-600 font-medium" : "text-orange-600 font-medium"}>
                {optimalPoint.occupancy > currentOccupancy
                  ? `Potential to increase net revenue by R${Math.abs(optimalPoint.opportunityCost).toLocaleString()} by targeting ${optimalPoint.occupancy}% occupancy`
                  : `Current occupancy (${currentOccupancy.toFixed(1)}%) exceeds optimal. Consider reducing to ${optimalPoint.occupancy}% to maximise net revenue and reduce property stress.`}
              </span>
            </div>
          ) : (
            <div className="mt-2 rounded-md bg-emerald-50 p-2 text-center text-xs">
              <span className="font-medium text-emerald-700">✓ Operating near optimal occupancy level ({optimalPoint.occupancy}%)</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
