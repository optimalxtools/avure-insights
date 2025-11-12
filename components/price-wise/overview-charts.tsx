"use client"

import { useState } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Cell, Line, LineChart, Area, AreaChart } from "recharts"
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
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
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

// Simple price comparison bar chart
interface SimplePriceChartProps {
  pricingData: Array<{
    hotel_name: string
    avg_price_per_night: number
    preferred_price_per_night?: number | null
    preferred_price_source?: string | null
    property_avg_price_per_night?: number | null
    avg_room_price_avg?: number | null
    room_type_count_estimate?: number | null
  }>
  referenceProperty: string
}

export function SimplePriceChart({ pricingData, referenceProperty }: SimplePriceChartProps) {
  const chartData = pricingData
    .map(item => ({
      name: item.hotel_name,
      preferredPrice: toNumber(item.preferred_price_per_night)
        ?? toNumber(item.avg_room_price_avg)
        ?? toNumber(item.avg_price_per_night)
        ?? 0,
      propertyPrice: toNumber(item.property_avg_price_per_night)
        ?? toNumber(item.avg_price_per_night)
        ?? 0,
      hasRoomPrice: (item.preferred_price_source ?? (toNumber(item.avg_room_price_avg) !== null ? "room" : "property")) === "room",
      priceSource: item.preferred_price_source ?? (toNumber(item.avg_room_price_avg) !== null ? "room" : "property"),
      roomsTracked: toNumber(item.room_type_count_estimate),
      isReference: item.hotel_name === referenceProperty,
    }))
  .sort((a, b) => b.preferredPrice - a.preferredPrice)
    .map(item => ({
      ...item,
      price: Math.round(item.preferredPrice || 0),
      rawPrice: item.preferredPrice,
      fallbackPrice: item.propertyPrice,
    }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Average Prices</CardTitle>
        <CardDescription>Average price per night across all properties</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[360px] w-full">
          <BarChart data={chartData} margin={{ top: 20, right: 10, left: 10, bottom: 70 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="name"
              angle={-45}
              textAnchor="end"
              height={100}
              interval={0}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              tickFormatter={(value) => `R${(value / 1000).toFixed(0)}k`}
              tick={{ fontSize: 11 }}
              label={{ value: 'Price per Night', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
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
                            {data.hasRoomPrice ? 'Avg room price' : 'Avg nightly price'}: R {data.price.toLocaleString('en-ZA')}
                          </span>
                          {data.hasRoomPrice && data.fallbackPrice ? (
                            <span className="text-[0.70rem] text-muted-foreground">
                              Property average: R {Math.round(data.fallbackPrice).toLocaleString('en-ZA')}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )
                }
                return null
              }}
            />
            <Bar dataKey="price" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.isReference ? "hsl(var(--chart-2))" : "hsl(var(--chart-1))"}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

// Simple occupancy comparison bar chart
interface SimpleOccupancyChartProps {
  occupancyData: Array<{
    hotel_name: string
    occupancy_rate: number
    preferred_occupancy_rate?: number | null
    preferred_occupancy_source?: string | null
    property_occupancy_rate?: number | null
    avg_room_occupancy_rate?: number | null
    room_type_count_estimate?: number | null
  }>
  roomInventoryData?: Array<{
    hotel_name: string
    avg_room_occupancy_rate?: number | null
    avg_total_room_types?: number | null
    avg_available_room_types?: number | null
    room_type_count_estimate?: number | null
  }>
  referenceProperty: string
}

export function SimpleOccupancyChart({ occupancyData, roomInventoryData = [], referenceProperty }: SimpleOccupancyChartProps) {
  const roomInventoryMap = new Map(roomInventoryData.map(entry => [entry.hotel_name, entry]))

  const chartData = occupancyData
    .map(item => {
      const roomEntry = roomInventoryMap.get(item.hotel_name)
      const roomRate = roomEntry ? toNumber(roomEntry.avg_room_occupancy_rate) : null

      const preferredRate = toNumber(item.preferred_occupancy_rate)
        ?? toNumber(item.avg_room_occupancy_rate)
        ?? roomRate
        ?? toNumber(item.occupancy_rate)
        ?? 0

      const propertyRate = toNumber(item.property_occupancy_rate)
        ?? toNumber(item.occupancy_rate)
        ?? preferredRate

      const occupancySource = item.preferred_occupancy_source ?? (roomRate !== null ? "room" : "property")
      const hasRoomData = occupancySource === "room"
      const roomsTracked = toNumber(item.room_type_count_estimate) ?? toNumber(roomEntry?.room_type_count_estimate)

      return {
        name: item.hotel_name,
        occupancy: Number(preferredRate.toFixed(1)),
        isReference: item.hotel_name === referenceProperty,
        hasRoomData,
        roomOccupancy: hasRoomData ? Number(preferredRate.toFixed(1)) : (roomRate !== null ? Number(roomRate.toFixed(1)) : null),
        propertyOccupancy: Number((propertyRate ?? 0).toFixed(1)),
        avgTotalRooms: roomEntry?.avg_total_room_types ?? null,
        avgAvailableRooms: roomEntry?.avg_available_room_types ?? null,
        roomsTracked,
        occupancySource,
      }
    })
    .sort((a, b) => b.occupancy - a.occupancy)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Occupancy Rates</CardTitle>
        <CardDescription>Current occupancy percentage for each property</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[360px] w-full">
          <BarChart data={chartData} margin={{ top: 20, right: 10, left: 10, bottom: 70 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="name"
              angle={-45}
              textAnchor="end"
              height={100}
              interval={0}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
              tick={{ fontSize: 11 }}
              label={{ value: 'Occupancy Rate', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
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
                            {data.hasRoomData ? 'Preferred room occupancy' : 'Property occupancy'}: {data.occupancy}%
                          </span>
                          <span className="text-[0.70rem] text-muted-foreground">
                            Basis: {data.occupancySource === 'room' ? 'Room types' : 'Property summary'}
                          </span>
                          {data.hasRoomData ? (
                            <span className="text-[0.70rem] text-muted-foreground">
                              Property occupancy checks: {data.propertyOccupancy}%
                            </span>
                          ) : null}
                          {!data.hasRoomData && data.roomOccupancy !== null ? (
                            <span className="text-[0.70rem] text-muted-foreground">
                              Room-derived estimate: {data.roomOccupancy}%
                            </span>
                          ) : null}
                          {data.hasRoomData && data.avgTotalRooms ? (
                            <span className="text-[0.70rem] text-muted-foreground">
                              Avg rooms available: {Number(data.avgAvailableRooms || 0).toFixed(1)} of {Number(data.avgTotalRooms).toFixed(1)}
                            </span>
                          ) : null}
                          {data.roomsTracked !== null ? (
                            <span className="text-[0.70rem] text-muted-foreground">
                              Room types tracked: {Number(data.roomsTracked).toFixed(0)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )
                }
                return null
              }}
            />
            <Bar dataKey="occupancy" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.isReference ? "hsl(var(--chart-2))" : "hsl(var(--chart-1))"}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

// Simple price range chart showing min and max
interface SimplePriceRangeChartProps {
  pricingData: Array<{
    hotel_name: string
    avg_price_per_night: number
    min_price: number
    max_price: number
    avg_min_room_price?: number | null
    avg_max_room_price?: number | null
    avg_room_price_avg?: number | null
    preferred_price_per_night?: number | null
    preferred_price_source?: string | null
    preferred_price_range?: number | null
    property_avg_price_per_night?: number | null
    property_min_price?: number | null
    property_max_price?: number | null
    room_type_count_estimate?: number | null
  }>
  referenceProperty: string
}

export function SimplePriceRangeChart({ pricingData, referenceProperty }: SimplePriceRangeChartProps) {
  const chartData = pricingData
    .map(item => {
      const preferredMin = toNumber(item.min_price)
        ?? toNumber(item.avg_min_room_price)
        ?? 0
      const preferredMax = toNumber(item.max_price)
        ?? toNumber(item.avg_max_room_price)
        ?? preferredMin
      const preferredAvg = toNumber(item.preferred_price_per_night)
        ?? toNumber(item.avg_room_price_avg)
        ?? toNumber(item.avg_price_per_night)
        ?? (preferredMin + preferredMax) / 2

      const propertyMin = toNumber(item.property_min_price) ?? toNumber(item.min_price)
      const propertyMax = toNumber(item.property_max_price) ?? toNumber(item.max_price)
      const propertyAvg = toNumber(item.property_avg_price_per_night) ?? toNumber(item.avg_price_per_night)

      const priceSource = item.preferred_price_source ?? (toNumber(item.avg_min_room_price) !== null ? "room" : "property")
      const roomsTracked = toNumber(item.room_type_count_estimate)

      return {
        name: item.hotel_name,
        minRaw: preferredMin,
        maxRaw: preferredMax,
        avgRaw: preferredAvg,
        min: Math.round(preferredMin || 0),
        max: Math.round(preferredMax || 0),
        avg: Math.round(preferredAvg || 0),
        range: Math.max(Math.round((preferredMax || 0) - (preferredMin || 0)), 0),
        propertyMin: propertyMin ?? preferredMin,
        propertyMax: propertyMax ?? preferredMax,
        propertyAverage: propertyAvg ?? preferredAvg,
        hasRoomPrices: priceSource === "room",
        priceSource,
        roomsTracked,
        isReference: item.hotel_name === referenceProperty,
      }
    })
    .sort((a, b) => b.avg - a.avg)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Price Ranges</CardTitle>
        <CardDescription>Minimum and maximum prices observed for each property</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[400px] w-full">
          <BarChart data={chartData} margin={{ top: 20, right: 10, left: 10, bottom: 100 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="name"
              angle={-45}
              textAnchor="end"
              height={120}
              interval={0}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              tickFormatter={(value) => `R${(value / 1000).toFixed(0)}k`}
              tick={{ fontSize: 11 }}
              label={{ value: 'Price Range', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
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
                            Min: R{data.min.toLocaleString('en-ZA')}
                          </span>
                          <span className="text-[0.70rem] text-muted-foreground">
                            Max: R{data.max.toLocaleString('en-ZA')}
                          </span>
                          <span className="text-[0.70rem] text-muted-foreground">
                            Avg: R{data.avg.toLocaleString('en-ZA')}
                          </span>
                          <span className="text-[0.70rem] text-muted-foreground">
                            Basis: {data.priceSource === 'room' ? 'Room types' : 'Property summary'}
                          </span>
                          {data.hasRoomPrices ? (
                            <span className="text-[0.70rem] text-muted-foreground">
                              Property range: R{Math.round(data.propertyMin).toLocaleString('en-ZA')} - R{Math.round(data.propertyMax).toLocaleString('en-ZA')}
                            </span>
                          ) : null}
                          {data.roomsTracked !== null ? (
                            <span className="text-[0.70rem] text-muted-foreground">
                              Room types tracked: {Number(data.roomsTracked).toFixed(0)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )
                }
                return null
              }}
            />
            <Bar dataKey="min" stackId="a" fill="hsl(var(--muted))" radius={[0, 0, 0, 0]} />
            <Bar dataKey="range" stackId="a" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.isReference ? "hsl(var(--chart-2))" : "hsl(var(--chart-1))"}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

// Daily booking status chart with competitor comparison
interface DailyBookingStatusChartProps {
  dailyData: Array<{
    hotel_name: string
    check_in_date: string
    availability: string
    total_price: number | null
    day_offset: number
    total_room_types?: number | null
    available_room_types?: number | null
    sold_out_room_types?: number | null
    property_occupancy_rate?: number | null
  }>
  referenceProperty: string
  roomInventoryData?: Array<{
    hotel_name: string
    room_type_count_estimate?: number | null
    avg_total_room_types?: number | null
  }>
}

export function DailyBookingStatusChart({ dailyData, referenceProperty, roomInventoryData = [] }: DailyBookingStatusChartProps) {
  // Get unique day offsets and sort, limit to 90 days
  const dayOffsets = Array.from(new Set(dailyData.map(d => d.day_offset)))
    .sort((a, b) => a - b)
    .slice(0, 90)
  
  type AvailabilityStatus = 'sold_out' | 'limited' | 'available' | 'unknown'

  const STATUS_PRIORITY: Record<AvailabilityStatus, number> = {
    sold_out: 3,
    limited: 2,
    available: 1,
    unknown: 0,
  }

  const normalizeStatus = (value: string | undefined | null): AvailabilityStatus => {
    if (!value) return 'unknown'
    const trimmed = value.replace(/\s+/g, '_').toLowerCase()
    if (trimmed === 'sold_out') return 'sold_out'
    if (trimmed === 'available' || trimmed === 'open') return 'available'
    if (trimmed === 'limited' || trimmed === 'partial' || trimmed === 'mixed') return 'limited'
    return 'unknown'
  }

  type CountPair = { total: number; available: number }

  type AvailabilityAccumulator = {
    statusHint: AvailabilityStatus
    statusPriority: number
    bestPair: CountPair | null
    fallbackTotal: number | null
    fallbackAvailable: number | null
    soldPercent: number | null
    inventoryTotal: number | null
  }

  type AvailabilityCell = {
    status: AvailabilityStatus
    soldPercent: number | null
    availabilityRatio: number | null
    totalRooms: number | null
    availableRooms: number | null
    soldRooms: number | null
  }

  const roomInventoryMap = new Map(roomInventoryData.map(entry => [entry.hotel_name, entry]))
  const accumulators = new Map<string, AvailabilityAccumulator>()

  dailyData.forEach(d => {
    const key = `${d.hotel_name}-${d.day_offset}`
    const statusHint = normalizeStatus(d.availability)

    const inventoryEntry = roomInventoryMap.get(d.hotel_name)
    const inventoryTotal = inventoryEntry
      ? toNumber(inventoryEntry.room_type_count_estimate)
        ?? toNumber(inventoryEntry.avg_total_room_types)
        ?? null
      : null

    let totalRooms = toNumber(d.total_room_types)
    if (totalRooms !== null && totalRooms <= 0) totalRooms = null
    let availableRooms = toNumber(d.available_room_types)
    if (availableRooms !== null && availableRooms < 0) availableRooms = null
    let soldRooms = toNumber(d.sold_out_room_types)
    if (soldRooms !== null && soldRooms < 0) soldRooms = null

    if (totalRooms === null && inventoryTotal !== null) {
      totalRooms = inventoryTotal
    } else if (totalRooms !== null && inventoryTotal !== null && inventoryTotal > totalRooms) {
      totalRooms = inventoryTotal
    }

    if (totalRooms === null && availableRooms !== null && soldRooms !== null) {
      const derivedTotal = availableRooms + soldRooms
      if (derivedTotal > 0) {
        totalRooms = derivedTotal
      }
    }

    if (totalRooms !== null && soldRooms !== null && availableRooms === null) {
      availableRooms = Math.max(totalRooms - soldRooms, 0)
    }

    if (totalRooms !== null && availableRooms === null) {
      if (statusHint === 'sold_out') {
        availableRooms = 0
      } else if (statusHint === 'available') {
        availableRooms = totalRooms
      }
    }

    if (totalRooms !== null && availableRooms !== null) {
      availableRooms = Math.min(Math.max(availableRooms, 0), totalRooms)
    }

    let pair: CountPair | null = null
    if (totalRooms !== null && availableRooms !== null) {
      pair = { total: totalRooms, available: availableRooms }
      soldRooms = totalRooms - availableRooms
    } else if (totalRooms !== null && soldRooms !== null) {
      const derivedAvailable = Math.max(totalRooms - soldRooms, 0)
      pair = { total: totalRooms, available: derivedAvailable }
      availableRooms = derivedAvailable
    }

    let soldPercent: number | null = null
    if (pair && pair.total > 0) {
      soldPercent = ((pair.total - pair.available) / pair.total) * 100
    } else if (soldRooms !== null && totalRooms !== null && totalRooms > 0) {
      soldPercent = (soldRooms / totalRooms) * 100
    } else if (d.property_occupancy_rate !== undefined && d.property_occupancy_rate !== null) {
      const occupancy = Number(d.property_occupancy_rate)
      if (Number.isFinite(occupancy)) {
        soldPercent = Math.min(100, Math.max(0, occupancy))
      }
    }

    let accumulator = accumulators.get(key)
    if (!accumulator) {
      accumulator = {
        statusHint,
        statusPriority: STATUS_PRIORITY[statusHint],
        bestPair: pair,
        fallbackTotal: totalRooms ?? inventoryTotal ?? null,
        fallbackAvailable: availableRooms,
        soldPercent,
        inventoryTotal,
      }
      accumulators.set(key, accumulator)
      return
    }

    const candidatePriority = STATUS_PRIORITY[statusHint]
    if (candidatePriority > accumulator.statusPriority) {
      accumulator.statusHint = statusHint
      accumulator.statusPriority = candidatePriority
    }

    if (inventoryTotal !== null) {
      accumulator.inventoryTotal = accumulator.inventoryTotal !== null
        ? Math.max(accumulator.inventoryTotal, inventoryTotal)
        : inventoryTotal
    }

    if (pair) {
      if (!accumulator.bestPair) {
        accumulator.bestPair = pair
      } else if (pair.total > accumulator.bestPair.total) {
        accumulator.bestPair = pair
      } else if (pair.total === accumulator.bestPair.total && pair.available < accumulator.bestPair.available) {
        accumulator.bestPair = pair
      }
    }

    if (totalRooms !== null) {
      accumulator.fallbackTotal = accumulator.fallbackTotal !== null
        ? Math.max(accumulator.fallbackTotal, totalRooms)
        : totalRooms
    }

    if (availableRooms !== null) {
      accumulator.fallbackAvailable = accumulator.fallbackAvailable !== null
        ? Math.min(accumulator.fallbackAvailable, availableRooms)
        : availableRooms
    }

    if (soldPercent !== null) {
      accumulator.soldPercent = accumulator.soldPercent !== null
        ? Math.max(accumulator.soldPercent, soldPercent)
        : soldPercent
    }
  })

  const availabilityMap = new Map<string, AvailabilityCell>()
  accumulators.forEach((accumulator, key) => {
    let totalRooms = accumulator.bestPair?.total
      ?? accumulator.fallbackTotal
      ?? accumulator.inventoryTotal
      ?? null

    let availableRooms = accumulator.bestPair?.available
      ?? accumulator.fallbackAvailable
      ?? null

    if (totalRooms !== null) {
      if (availableRooms === null) {
        if (accumulator.soldPercent !== null) {
          const remaining = totalRooms * (1 - accumulator.soldPercent / 100)
          availableRooms = Math.max(0, remaining)
        } else if (accumulator.statusHint === 'sold_out') {
          availableRooms = 0
        } else if (accumulator.statusHint === 'available') {
          availableRooms = totalRooms
        }
      }

      if (availableRooms !== null) {
        availableRooms = Math.min(Math.max(availableRooms, 0), totalRooms)
      }
    }

    let availabilityRatio: number | null = null
    let soldPercent = accumulator.soldPercent
    let soldRooms: number | null = null

    if (totalRooms !== null && availableRooms !== null && totalRooms > 0) {
      availabilityRatio = availableRooms / totalRooms
      soldRooms = totalRooms - availableRooms
      soldPercent = (soldRooms / totalRooms) * 100
    }

    if (soldPercent !== null) {
      soldPercent = Math.min(100, Math.max(0, soldPercent))
    }

    let status: AvailabilityStatus = accumulator.statusHint
    if (totalRooms !== null && availableRooms !== null) {
      if (availableRooms <= 0) {
        status = 'sold_out'
      } else if (availableRooms < totalRooms) {
        status = 'limited'
      } else {
        status = 'available'
      }
    } else if (soldPercent !== null) {
      if (soldPercent >= 100) {
        status = 'sold_out'
      } else if (soldPercent > 0) {
        status = 'limited'
      } else {
        status = 'available'
      }
    }

    availabilityMap.set(key, {
      status,
      soldPercent,
      availabilityRatio,
      totalRooms,
      availableRooms,
      soldRooms,
    })
  })

  // Rank hotels by occupancy (percentage of sold-out days)
  const hotels = Array.from(new Set(dailyData.map(d => d.hotel_name)))
    .map(hotel => {
      const soldOutDays = dayOffsets.reduce((sum, offset) => {
        const cell = availabilityMap.get(`${hotel}-${offset}`)
        return cell?.status === 'sold_out' ? sum + 1 : sum
      }, 0)
      const occupancyRate = dayOffsets.length > 0 ? soldOutDays / dayOffsets.length : 0
      return { hotel, occupancyRate }
    })
    .sort((a, b) => {
      if (b.occupancyRate !== a.occupancyRate) {
        return b.occupancyRate - a.occupancyRate
      }
      return a.hotel.localeCompare(b.hotel)
    })
    .map(entry => entry.hotel)
  
  const getDateLabel = (offset: number) => {
    const date = new Date()
    date.setDate(date.getDate() + offset)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  
  const getWeekLabel = (offset: number) => {
    const date = new Date()
    date.setDate(date.getDate() + offset)
    return date.toLocaleDateString('en-US', { day: 'numeric' })
  }
  
  // Group days into weeks for header
  const weeks: number[][] = []
  let currentWeek: number[] = []
  dayOffsets.forEach((offset, index) => {
    currentWeek.push(offset)
    if (currentWeek.length >= 7 || index === dayOffsets.length - 1) {
      weeks.push([...currentWeek])
      currentWeek = []
    }
  })
  
  const computeCellColor = (cell: AvailabilityCell | undefined) => {
    if (!cell) {
      return '#e2e8f0'
    }

    if (cell.status === 'sold_out') {
      return '#ffffff'
    }

    if (cell.status === 'available' || cell.status === 'limited') {
      if (cell.availabilityRatio !== null) {
        const alpha = Math.min(1, Math.max(0.08, cell.availabilityRatio))
        return `rgba(34, 197, 94, ${alpha.toFixed(3)})`
      }
      return 'rgba(34, 197, 94, 1)'
    }

    return '#e2e8f0'
  }
  
  const statusLabel: Record<AvailabilityStatus, string> = {
    sold_out: 'Sold Out',
    limited: 'Limited Availability',
    available: 'Available',
    unknown: 'No Data',
  }

  const getCellTitle = (hotel: string, offset: number) => {
    const cell = availabilityMap.get(`${hotel}-${offset}`)
    const status = cell ? statusLabel[cell.status] : statusLabel.unknown
    const date = getDateLabel(offset)
    const total = cell?.totalRooms
    const available = cell?.availableRooms
    const soldRooms = cell?.soldRooms ?? (total != null && available != null ? total - available : null)
    const soldPercent = cell?.soldPercent != null ? Math.round(cell.soldPercent) : null

    // Build a cleaner, multi-line title
    let lines = [
      `${hotel}${hotel === referenceProperty ? ' ⭐' : ''}`,
      `${date} (Day +${offset})`,
      `Status: ${status}`
    ]

    if (soldPercent != null) {
      lines.push(`Sold: ${soldPercent}%`)
    }

    if (total != null && soldRooms != null) {
      lines.push(`Rooms: ${soldRooms.toFixed(0)} / ${total.toFixed(0)}`)
    }

    if (available != null) {
      lines.push(`Available: ${available.toFixed(0)}`)
    }

    return lines.join('\n')
  }
  
  const propertyColumnWidth = 180
  const dayColumnWidth = `calc((100% - ${propertyColumnWidth}px) / ${dayOffsets.length || 1})`

  return (
    <Card>
      <CardHeader>
        <CardTitle>90-Day Booking Status Heatmap</CardTitle>
        <CardDescription>
          White = Booked, deeper green = more rooms available • Hover any day to view % of rooms sold
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <style jsx>{`
          .heatmap-cell {
            position: relative;
          }
          .heatmap-cell[data-tooltip]:hover::after {
            content: attr(data-tooltip);
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
            background: #ffffff;
            color: #000000;
            border: 1px solid hsl(var(--border));
            border-radius: 0.5rem;
            padding: 0.5rem;
            font-size: 0.75rem;
            white-space: pre-line;
            z-index: 1000;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
            pointer-events: none;
            margin-bottom: 0.25rem;
            min-width: 150px;
          }
        `}</style>
        <div className="p-6 pb-4">
          {/* Legend */}
          <div className="flex items-center gap-6 text-xs border-b pb-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded border border-green-600"></div>
              <span>Available</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-white rounded border border-gray-200"></div>
              <span>Booked</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="h-3 w-12 rounded border border-green-600/40"
                style={{ background: 'linear-gradient(to right, rgba(34,197,94,1), rgba(34,197,94,0.1))' }}
              ></div>
              <span>Lighter = fewer rooms left</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">⭐ {referenceProperty}</span>
            </div>
          </div>
        </div>
        
        {/* Heatmap - Compact and fills width */}
        <div className="px-6 pb-6">
          <table className="border-collapse text-xs w-full table-fixed">
            <colgroup>
              <col style={{ width: `${propertyColumnWidth}px` }} />
              {dayOffsets.map(offset => (
                <col key={`col-${offset}`} style={{ width: dayColumnWidth }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th className="sticky left-6 bg-background border-r border-b p-1 text-left font-medium text-[11px] z-10">
                  Property
                </th>
                {weeks.map((week, weekIndex) => (
                  <th 
                    key={weekIndex}
                    colSpan={week.length}
                    className="border-b border-r p-1 text-center font-medium text-[10px]"
                  >
                    W{weekIndex + 1}
                  </th>
                ))}
              </tr>
              <tr>
                <th className="sticky left-6 bg-background border-r border-b p-0.5 z-10"></th>
                {dayOffsets.map(offset => (
                  <th 
                    key={offset}
                    className="border-b p-0 text-center text-[9px] font-normal text-muted-foreground"
                  >
                    {getWeekLabel(offset)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hotels.map((hotel, hotelIndex) => {
                const isReference = hotel === referenceProperty
                const rowBackground = isReference ? 'bg-amber-100/40' : hotelIndex % 2 === 0 ? 'bg-muted/20' : ''
                const stickyBg = isReference ? 'bg-amber-100/70' : 'bg-background'
                return (
                  <tr key={hotel} className={`${rowBackground}`}>
                    <td className={`sticky left-6 ${stickyBg} border-r p-1 text-[10px] font-medium truncate z-10`}>
                    {hotel === referenceProperty && "⭐"}
                    <span className="ml-0.5">{hotel}</span>
                  </td>
                  {dayOffsets.map(offset => {
                    const cell = availabilityMap.get(`${hotel}-${offset}`)
                    const background = computeCellColor(cell)
                    const title = getCellTitle(hotel, offset)

                    return (
                      <td
                        key={offset}
                        className="heatmap-cell p-0 border-r border-b h-5 hover:opacity-80 transition-opacity cursor-pointer"
                        style={{ background }}
                        data-tooltip={title}
                      />
                    )
                  })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

// Daily availability components
interface DailyAvailabilityChartProps {
  dailyData: Array<{
    hotel_name: string
    check_in_date: string
    availability: string
    total_price: number | null
    day_offset: number
  }>
  referenceProperty: string
}

export function DailyAvailabilityChart({ dailyData, referenceProperty }: DailyAvailabilityChartProps) {
  // Group data by hotel and day_offset
  const hotels = Array.from(new Set(dailyData.map(d => d.hotel_name)))
  
  // Calculate average availability per hotel (excluding reference)
  const hotelAvailability = hotels.map(hotel => {
    const dataPoints = dailyData.filter(d => d.hotel_name === hotel)
    const availableCount = dataPoints.filter(d => d.availability === "available").length
    const availabilityRate = dataPoints.length > 0 ? (availableCount / dataPoints.length) * 100 : 0
    return { hotel, availabilityRate, isReference: hotel === referenceProperty }
  }).sort((a, b) => a.availabilityRate - b.availabilityRate) // Sort by availability (lowest = most booked)
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily Availability Tracking</CardTitle>
        <CardDescription>
          Properties ranked by booking pressure (lowest availability = highest demand)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Ranking Table */}
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-2 text-left font-medium">Rank</th>
                  <th className="p-2 text-left font-medium">Property</th>
                  <th className="p-2 text-right font-medium">Availability</th>
                  <th className="p-2 text-left font-medium">Booking Pressure</th>
                </tr>
              </thead>
              <tbody>
                {hotelAvailability.map((h, index) => (
                  <tr 
                    key={h.hotel} 
                    className={`border-b last:border-0 ${h.isReference ? 'bg-muted/30' : ''}`}
                  >
                    <td className="p-2 font-medium">{index + 1}</td>
                    <td className="p-2">
                      {h.hotel}
                      {h.isReference && " ⭐"}
                    </td>
                    <td className="p-2 text-right">
                      <span className={h.availabilityRate < 30 ? 'text-red-600 font-medium' : h.availabilityRate < 60 ? 'text-orange-600' : 'text-green-600'}>
                        {h.availabilityRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${h.availabilityRate < 30 ? 'bg-red-500' : h.availabilityRate < 60 ? 'bg-orange-500' : 'bg-green-500'}`}
                            style={{ width: `${100 - h.availabilityRate}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-16">
                          {(100 - h.availabilityRate).toFixed(0)}% booked
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Key Insights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="rounded-md border p-3">
              <div className="text-muted-foreground mb-1">Most In-Demand</div>
              <div className="font-semibold">{hotelAvailability[0]?.hotel}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {hotelAvailability[0]?.availabilityRate.toFixed(1)}% available
              </div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-muted-foreground mb-1">{referenceProperty} Rank</div>
              <div className="font-semibold">
                #{hotelAvailability.findIndex(h => h.isReference) + 1} of {hotels.length}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {hotelAvailability.find(h => h.isReference)?.availabilityRate.toFixed(1)}% available
              </div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-muted-foreground mb-1">Market Average</div>
              <div className="font-semibold">
                {(hotelAvailability.reduce((sum, h) => sum + h.availabilityRate, 0) / hotelAvailability.length).toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                availability across all properties
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
