"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Cell, Scatter, ScatterChart, ZAxis, ReferenceLine, Label } from "recharts"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

interface PriceChartProps {
  pricingData: Array<{
    hotel_name: string
    avg_price_per_night: number
  }>
  occupancyData: Array<{
    hotel_name: string
    occupancy_rate: number
  }>
  referenceProperty: string
}

interface OccupancyChartProps {
  data: Array<{
    hotel_name: string
    occupancy_rate: number
    sold_out: number
    available: number
  }>
  referenceProperty: string
}

interface RoomChartProps {
  data: Array<{
    hotel_name: string
    avg_room_occupancy_rate: number
    room_price_spread_pct: number
    uses_room_tiering: boolean
  }>
  referenceProperty: string
}

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

export function PriceComparisonChart({ pricingData, occupancyData, referenceProperty }: PriceChartProps) {
  // Merge pricing and occupancy data
  const chartData = pricingData
    .map(pricing => {
      const occupancy = occupancyData.find(o => o.hotel_name === pricing.hotel_name)
      return {
        name: pricing.hotel_name,
        price: Math.round(pricing.avg_price_per_night || 0),
        occupancy: Number((occupancy?.occupancy_rate || 0).toFixed(1)),
        isReference: pricing.hotel_name === referenceProperty
      }
    })
    .filter(item => item.price > 0 && item.occupancy > 0) // Only show properties with both metrics

  // Calculate average price and occupancy for reference lines
  const avgPrice = chartData.reduce((sum, item) => sum + item.price, 0) / chartData.length
  const avgOccupancy = chartData.reduce((sum, item) => sum + item.occupancy, 0) / chartData.length

  return (
    <Card>
      <CardHeader>
        <CardTitle>Market Positioning</CardTitle>
        <CardDescription>Price vs Occupancy - optimal position is top-right</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[400px] w-full">
          <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="occupancy"
              name="Occupancy"
              unit="%"
              domain={[0, 100]}
              label={{ value: 'Occupancy Rate (%)', position: 'bottom', offset: 0, style: { fontSize: 12 } }}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              type="number"
              dataKey="price"
              name="Price"
              tickFormatter={(value) => `R${(value / 1000).toFixed(0)}k`}
              label={{ value: 'Avg Price/Night', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
              tick={{ fontSize: 11 }}
            />
            <ZAxis range={[200, 400]} />
            
            {/* Reference lines for average price and occupancy */}
            <ReferenceLine 
              x={avgOccupancy} 
              stroke="hsl(var(--muted-foreground))" 
              strokeDasharray="3 3" 
              opacity={0.5}
            />
            <ReferenceLine 
              y={avgPrice} 
              stroke="hsl(var(--muted-foreground))" 
              strokeDasharray="3 3" 
              opacity={0.5}
            />
            
            <ChartTooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-sm">
                      <div className="grid gap-2">
                        <div className="flex flex-col">
                          <span className="text-[0.70rem] font-bold">
                            {data.name}
                            {data.isReference && " ⭐"}
                          </span>
                          <span className="text-[0.70rem] text-muted-foreground">
                            Price: R {Number(data.price).toLocaleString('en-ZA')}
                          </span>
                          <span className="text-[0.70rem] text-muted-foreground">
                            Occupancy: {data.occupancy}%
                          </span>
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
                  key={`cell-${index}`}
                  fill={entry.isReference ? "hsl(var(--chart-2))" : "hsl(var(--chart-1))"}
                  opacity={entry.isReference ? 1 : 0.7}
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

export function OccupancyComparisonChart({ data, referenceProperty }: OccupancyChartProps) {
  // Sort by occupancy descending and take top 8
  const sortedData = [...data]
    .sort((a, b) => (b.occupancy_rate || 0) - (a.occupancy_rate || 0))
    .slice(0, 8)
    .map(item => ({
      name: item.hotel_name,
      soldOut: Number(item.sold_out || 0),
      available: Number(item.available || 0),
      occupancyRate: Number((item.occupancy_rate || 0).toFixed(1)),
      isReference: item.hotel_name === referenceProperty
    }))

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
            <YAxis
              tick={{ fontSize: 12 }}
              label={{ value: 'Number of Checks', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
            />
            <ChartTooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-sm">
                      <div className="grid gap-2">
                        <div className="flex flex-col">
                          <span className="text-[0.70rem] font-bold">
                            {data.name}
                            {data.isReference && " ⭐"}
                          </span>
                          <span className="text-[0.70rem] text-muted-foreground">
                            Occupancy: {data.occupancyRate}%
                          </span>
                          <div className="mt-1 space-y-0.5">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(var(--chart-1))' }}></div>
                              <span className="text-[0.65rem]">Sold Out: {data.soldOut}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(var(--muted))' }}></div>
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
                <Cell 
                  key={`sold-${index}`} 
                  fill={entry.isReference ? "hsl(var(--chart-2))" : "var(--color-soldOut)"} 
                />
              ))}
            </Bar>
            <Bar dataKey="available" stackId="a" radius={[4, 4, 0, 0]}>
              {sortedData.map((entry, index) => (
                <Cell 
                  key={`avail-${index}`} 
                  fill={entry.isReference ? "hsl(var(--muted))" : "var(--color-available)"} 
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
        <div className="mt-2 text-xs text-muted-foreground text-center">
          Higher sold-out ratio indicates stronger demand and market positioning
        </div>
      </CardContent>
    </Card>
  )
}

export function RoomStrategyChart({ data, referenceProperty }: RoomChartProps) {
  // Sort by price spread descending and take top 8
  const sortedData = [...data]
    .sort((a, b) => (b.room_price_spread_pct || 0) - (a.room_price_spread_pct || 0))
    .slice(0, 8)
    .map(item => ({
      name: item.hotel_name,
      value: Number((item.room_price_spread_pct || 0).toFixed(1)),
      isReference: item.hotel_name === referenceProperty,
      usesTiering: item.uses_room_tiering
    }))

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
            <YAxis
              tickFormatter={(value) => `${value}%`}
              tick={{ fontSize: 12 }}
              label={{ value: 'Price Spread (%)', angle: -90, position: 'insideLeft' }}
            />
            <ChartTooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-sm">
                      <div className="grid gap-2">
                        <div className="flex flex-col">
                          <span className="text-[0.70rem] font-bold">
                            {data.name}
                          </span>
                          <span className="text-[0.70rem] text-muted-foreground">
                            Price Spread: {data.value}%
                          </span>
                          <span className="text-[0.70rem] text-muted-foreground">
                            Tiered Pricing: {data.usesTiering ? 'Yes' : 'No'}
                          </span>
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
                <Cell
                  key={`cell-${index}`}
                  fill={entry.isReference ? "hsl(var(--chart-2))" : "hsl(var(--chart-1))"}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
        <div className="mt-2 text-xs text-muted-foreground text-center">
          Higher spread indicates multiple room types at different price points
        </div>
      </CardContent>
    </Card>
  )
}
