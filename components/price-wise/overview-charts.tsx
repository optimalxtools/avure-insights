"use client"

import { useEffect, useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Cell } from "recharts"
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
import { SnapshotToggle } from "@/components/price-wise/snapshot-toggle"
import type {
  PriceWiseDailyPricingRecord,
  PriceWiseOccupancyMetricView,
  PriceWisePricingMetricView,
  PriceWiseRoomInventoryMetricView,
} from "@/lib/price-wise/types"

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

type SnapshotMeta = {
  id: string
  label: string
  dateLabel: string
  fullLabel: string
}

interface PriceChartSnapshot extends SnapshotMeta {
  pricingData: PriceWisePricingMetricView[]
  referenceProperty: string
}

interface SimplePriceChartProps {
  snapshots: PriceChartSnapshot[]
}

export function SimplePriceChart({ snapshots }: SimplePriceChartProps) {
  const [activeSnapshotId, setActiveSnapshotId] = useState(() => snapshots[0]?.id ?? "")

  useEffect(() => {
    if (snapshots.length === 0) {
      if (activeSnapshotId !== "") {
        setActiveSnapshotId("")
      }
      return
    }

    if (!snapshots.some((snapshot) => snapshot.id === activeSnapshotId)) {
      setActiveSnapshotId(snapshots[0].id)
    }
  }, [snapshots, activeSnapshotId])

  const options = useMemo(
    () => snapshots.map((snapshot) => ({ id: snapshot.id, label: snapshot.label, dateLabel: snapshot.dateLabel })),
    [snapshots],
  )

  const activeSnapshot = snapshots.find((snapshot) => snapshot.id === activeSnapshotId) ?? snapshots[0] ?? null

  const chartData = useMemo(() => {
    if (!activeSnapshot) {
      return []
    }

    const referenceProperty = activeSnapshot.referenceProperty

    return activeSnapshot.pricingData
      .map((item) => {
        const preferredPrice =
          toNumber(item.preferred_price_per_night) ??
          toNumber(item.avg_room_price_avg) ??
          toNumber(item.avg_price_per_night) ??
          0

        const propertyPrice =
          toNumber(item.property_avg_price_per_night) ??
          toNumber(item.avg_price_per_night) ??
          preferredPrice

        const priceSource =
          item.preferred_price_source ?? (toNumber(item.avg_room_price_avg) !== null ? "room" : "property")

        const roomsTracked = toNumber(item.room_type_count_estimate)

        return {
          name: item.hotel_name,
          preferredPrice,
          propertyPrice,
          hasRoomPrice: priceSource === "room",
          priceSource,
          roomsTracked,
          isReference: item.hotel_name === referenceProperty,
        }
      })
      .sort((a, b) => b.preferredPrice - a.preferredPrice)
      .map((item) => ({
        ...item,
        price: Math.round(item.preferredPrice || 0),
        rawPrice: item.preferredPrice,
        fallbackPrice: item.propertyPrice,
      }))
  }, [activeSnapshot])

  if (!activeSnapshot) {
    return null
  }

  if (!activeSnapshot) {
    return null
  }

  const handleSnapshotChange = (nextId: string) => {
    setActiveSnapshotId(nextId)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Average Prices</CardTitle>
            <CardDescription>Average price per night across all properties</CardDescription>
          </div>
          <div className="w-full sm:w-auto">
            <SnapshotToggle options={options} value={activeSnapshot.id} onChange={handleSnapshotChange} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div key={activeSnapshot.id} className="transition-opacity duration-300 animate-in fade-in-50">
          <ChartContainer config={chartConfig} className="h-[360px] w-full">
            <BarChart data={chartData} margin={{ top: 20, right: 10, left: 10, bottom: 70 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} interval={0} tick={{ fontSize: 11 }} />
              <YAxis
                tickFormatter={(value) => `R${(value / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11 }}
                label={{ value: "Price per Night", angle: -90, position: "insideLeft", style: { fontSize: 12 } }}
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
                              {data.hasRoomPrice ? "Avg room price" : "Avg nightly price"}: R {data.price.toLocaleString("en-ZA")}
                            </span>
                            {data.hasRoomPrice && data.fallbackPrice ? (
                              <span className="text-[0.70rem] text-muted-foreground">
                                Property average: R {Math.round(data.fallbackPrice).toLocaleString("en-ZA")}
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
              <Bar dataKey="price" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.isReference ? "hsl(var(--chart-2))" : "hsl(var(--chart-1))"} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  )
}

interface OccupancyChartSnapshot extends SnapshotMeta {
  occupancyData: PriceWiseOccupancyMetricView[]
  roomInventoryData: PriceWiseRoomInventoryMetricView[]
  referenceProperty: string
}

interface SimpleOccupancyChartProps {
  snapshots: OccupancyChartSnapshot[]
}

export function SimpleOccupancyChart({ snapshots }: SimpleOccupancyChartProps) {
  const [activeSnapshotId, setActiveSnapshotId] = useState(() => snapshots[0]?.id ?? "")

  useEffect(() => {
    if (snapshots.length === 0) {
      if (activeSnapshotId !== "") {
        setActiveSnapshotId("")
      }
      return
    }

    if (!snapshots.some((snapshot) => snapshot.id === activeSnapshotId)) {
      setActiveSnapshotId(snapshots[0].id)
    }
  }, [snapshots, activeSnapshotId])

  const options = useMemo(
    () => snapshots.map((snapshot) => ({ id: snapshot.id, label: snapshot.label, dateLabel: snapshot.dateLabel })),
    [snapshots],
  )

  const activeSnapshot = snapshots.find((snapshot) => snapshot.id === activeSnapshotId) ?? snapshots[0] ?? null

  const roomInventoryMap = useMemo(() => {
    if (!activeSnapshot) {
      return new Map<string, PriceWiseRoomInventoryMetricView>()
    }

    return new Map(activeSnapshot.roomInventoryData.map((entry) => [entry.hotel_name, entry]))
  }, [activeSnapshot])

  const chartData = useMemo(() => {
    if (!activeSnapshot) {
      return []
    }

    const referenceProperty = activeSnapshot.referenceProperty

    return activeSnapshot.occupancyData
      .map((item) => {
        const roomEntry = roomInventoryMap.get(item.hotel_name)
        const roomRate = roomEntry ? toNumber(roomEntry.avg_room_occupancy_rate) : null

        const preferredRate =
          toNumber(item.preferred_occupancy_rate) ??
          toNumber(item.avg_room_occupancy_rate) ??
          roomRate ??
          toNumber(item.occupancy_rate) ??
          0

        const propertyRate =
          toNumber(item.property_occupancy_rate) ?? toNumber(item.occupancy_rate) ?? preferredRate

        const occupancySource = item.preferred_occupancy_source ?? (roomRate !== null ? "room" : "property")
        const hasRoomData = occupancySource === "room"
        const roomsTracked =
          toNumber(item.room_type_count_estimate) ?? toNumber(roomEntry?.room_type_count_estimate)

        return {
          name: item.hotel_name,
          occupancy: Number(preferredRate.toFixed(1)),
          isReference: item.hotel_name === referenceProperty,
          hasRoomData,
          roomOccupancy: hasRoomData
            ? Number(preferredRate.toFixed(1))
            : roomRate !== null
              ? Number(roomRate.toFixed(1))
              : null,
          propertyOccupancy: Number((propertyRate ?? 0).toFixed(1)),
          avgTotalRooms: roomEntry?.avg_total_room_types ?? null,
          avgAvailableRooms: roomEntry?.avg_available_room_types ?? null,
          roomsTracked,
          occupancySource,
        }
      })
      .sort((a, b) => b.occupancy - a.occupancy)
  }, [activeSnapshot, roomInventoryMap])

  if (!activeSnapshot) {
    return null
  }

  const handleSnapshotChange = (nextId: string) => {
    setActiveSnapshotId(nextId)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Occupancy Rates</CardTitle>
            <CardDescription>Current occupancy percentage for each property</CardDescription>
          </div>
          <div className="w-full sm:w-auto">
            <SnapshotToggle options={options} value={activeSnapshot.id} onChange={handleSnapshotChange} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div key={activeSnapshot.id} className="transition-opacity duration-300 animate-in fade-in-50">
          <ChartContainer config={chartConfig} className="h-[360px] w-full">
            <BarChart data={chartData} margin={{ top: 20, right: 10, left: 10, bottom: 70 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} interval={0} tick={{ fontSize: 11 }} />
              <YAxis
                domain={[0, 100]}
                tickFormatter={(value) => `${value}%`}
                tick={{ fontSize: 11 }}
                label={{ value: "Occupancy Rate", angle: -90, position: "insideLeft", style: { fontSize: 12 } }}
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
                              {data.hasRoomData ? "Preferred room occupancy" : "Property occupancy"}: {data.occupancy}%
                            </span>
                            <span className="text-[0.70rem] text-muted-foreground">
                              Basis: {data.occupancySource === "room" ? "Room types" : "Property summary"}
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
                  <Cell key={`cell-${index}`} fill={entry.isReference ? "hsl(var(--chart-2))" : "hsl(var(--chart-1))"} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  )
}

// Daily booking status chart with competitor comparison
type AvailabilityStatus = "sold_out" | "limited" | "available" | "unknown"

const AVAILABILITY_STATUS_PRIORITY: Record<AvailabilityStatus, number> = {
  sold_out: 3,
  limited: 2,
  available: 1,
  unknown: 0,
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

const AVAILABILITY_STATUS_LABEL: Record<AvailabilityStatus, string> = {
  sold_out: "Sold Out",
  limited: "Limited Availability",
  available: "Available",
  unknown: "No Data",
}

const normalizeAvailabilityStatus = (value: string | null | undefined): AvailabilityStatus => {
  if (!value) return "unknown"
  const normalized = value.replace(/\s+/g, "_").toLowerCase()
  if (normalized === "sold_out" || normalized === "unavailable") return "sold_out"
  if (normalized === "limited" || normalized === "partial" || normalized === "mixed") return "limited"
  if (normalized === "available" || normalized === "open") return "available"
  return "unknown"
}

const computeAvailabilityColor = (cell?: AvailabilityCell): string => {
  if (!cell) {
    return "#e2e8f0"
  }

  if (cell.status === "sold_out") {
    return "#ffffff"
  }

  if (cell.status === "available" || cell.status === "limited") {
    if (cell.availabilityRatio !== null) {
      const alpha = Math.min(1, Math.max(0.08, cell.availabilityRatio))
      return `rgba(34, 197, 94, ${alpha.toFixed(3)})`
    }
    return "rgba(34, 197, 94, 1)"
  }

  return "#e2e8f0"
}

interface BookingStatusChartSnapshot extends SnapshotMeta {
  dailyData: PriceWiseDailyPricingRecord[]
  referenceProperty: string
  roomInventoryData?: PriceWiseRoomInventoryMetricView[]
}

interface DailyBookingStatusChartProps {
  snapshots: BookingStatusChartSnapshot[]
}

export function DailyBookingStatusChart({ snapshots }: DailyBookingStatusChartProps) {
  const [activeSnapshotId, setActiveSnapshotId] = useState(() => snapshots[0]?.id ?? "")

  useEffect(() => {
    if (snapshots.length === 0) {
      if (activeSnapshotId !== "") {
        setActiveSnapshotId("")
      }
      return
    }

    if (!snapshots.some((snapshot) => snapshot.id === activeSnapshotId)) {
      setActiveSnapshotId(snapshots[0].id)
    }
  }, [snapshots, activeSnapshotId])

  const options = useMemo(
    () => snapshots.map((snapshot) => ({ id: snapshot.id, label: snapshot.label, dateLabel: snapshot.dateLabel })),
    [snapshots],
  )

  const activeSnapshot = snapshots.find((snapshot) => snapshot.id === activeSnapshotId) ?? snapshots[0] ?? null

  const heatmap = useMemo(() => {
    const emptyState = {
      dayOffsets: [] as number[],
      weeks: [] as number[][],
      hotels: [] as string[],
      availabilityMap: new Map<string, AvailabilityCell>(),
      offsetDateMap: new Map<number, Date>(),
    }

    if (!activeSnapshot || !activeSnapshot.dailyData || activeSnapshot.dailyData.length === 0) {
      return emptyState
    }

    const dayOffsets = Array.from(
      new Set(
        activeSnapshot.dailyData
          .map((record) => record.day_offset)
          .filter((offset): offset is number => typeof offset === "number" && Number.isFinite(offset)),
      ),
    )
      .sort((a, b) => a - b)
      .slice(0, 90)

    if (dayOffsets.length === 0) {
      return emptyState
    }

    const activeOffsets = new Set(dayOffsets)
    const filteredRecords = activeSnapshot.dailyData.filter((record) => activeOffsets.has(record.day_offset))

    if (filteredRecords.length === 0) {
      return emptyState
    }

    const offsetDateMap = new Map<number, Date>()
    filteredRecords.forEach((record) => {
      if (!offsetDateMap.has(record.day_offset) && record.check_in_date) {
        const parsed = new Date(record.check_in_date)
        if (!Number.isNaN(parsed.getTime())) {
          offsetDateMap.set(record.day_offset, parsed)
        }
      }
    })

    const roomInventoryMap = new Map(
      (activeSnapshot.roomInventoryData ?? []).map((entry) => [entry.hotel_name, entry]),
    )

    const accumulators = new Map<string, AvailabilityAccumulator>()

    filteredRecords.forEach((record) => {
      const key = `${record.hotel_name}-${record.day_offset}`
      const statusHint = normalizeAvailabilityStatus(record.availability)

      const inventoryEntry = roomInventoryMap.get(record.hotel_name)
      const inventoryTotal = inventoryEntry
        ? toNumber(inventoryEntry.room_type_count_estimate) ?? toNumber(inventoryEntry.avg_total_room_types)
        : null

      let totalRooms = toNumber(record.total_room_types)
      if (totalRooms !== null && totalRooms <= 0) totalRooms = null

      let availableRooms = toNumber(record.available_room_types)
      if (availableRooms !== null && availableRooms < 0) availableRooms = null

      let soldRooms = toNumber(record.sold_out_room_types)
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
        if (statusHint === "sold_out") {
          availableRooms = 0
        } else if (statusHint === "available") {
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
      } else if (record.property_occupancy_rate !== undefined && record.property_occupancy_rate !== null) {
        const occupancy = Number(record.property_occupancy_rate)
        if (Number.isFinite(occupancy)) {
          soldPercent = Math.min(100, Math.max(0, occupancy))
        }
      }

      let accumulator = accumulators.get(key)
      if (!accumulator) {
        accumulator = {
          statusHint,
          statusPriority: AVAILABILITY_STATUS_PRIORITY[statusHint],
          bestPair: pair,
          fallbackTotal: totalRooms ?? inventoryTotal ?? null,
          fallbackAvailable: availableRooms,
          soldPercent,
          inventoryTotal,
        }
        accumulators.set(key, accumulator)
        return
      }

      const candidatePriority = AVAILABILITY_STATUS_PRIORITY[statusHint]
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
      const totalRooms = accumulator.bestPair?.total
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
          } else if (accumulator.statusHint === "sold_out") {
            availableRooms = 0
          } else if (accumulator.statusHint === "available") {
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
          status = "sold_out"
        } else if (availableRooms < totalRooms) {
          status = "limited"
        } else {
          status = "available"
        }
      } else if (soldPercent !== null) {
        if (soldPercent >= 100) {
          status = "sold_out"
        } else if (soldPercent > 0) {
          status = "limited"
        } else {
          status = "available"
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

    const hotels = Array.from(new Set(filteredRecords.map((record) => record.hotel_name)))
      .map((hotel) => {
        const soldOutDays = dayOffsets.reduce((sum, offset) => {
          const cell = availabilityMap.get(`${hotel}-${offset}`)
          return cell?.status === "sold_out" ? sum + 1 : sum
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
      .map((entry) => entry.hotel)

    const weeks: number[][] = []
    let currentWeek: number[] = []
    dayOffsets.forEach((offset, index) => {
      currentWeek.push(offset)
      if (currentWeek.length >= 7 || index === dayOffsets.length - 1) {
        weeks.push([...currentWeek])
        currentWeek = []
      }
    })

    return {
      dayOffsets,
      weeks,
      hotels,
      availabilityMap,
      offsetDateMap,
    }
  }, [activeSnapshot])

  const handleSnapshotChange = (nextId: string) => {
    setActiveSnapshotId(nextId)
  }

  const formatDate = (offset: number) => {
    const date = heatmap.offsetDateMap.get(offset)
    if (date) {
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    }
    const fallback = new Date()
    fallback.setDate(fallback.getDate() + offset)
    return fallback.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  const formatDay = (offset: number) => {
    const date = heatmap.offsetDateMap.get(offset)
    if (date) {
      return date.toLocaleDateString("en-US", { day: "numeric" })
    }
    return `${offset}`
  }

  const getCellTitle = (hotel: string, offset: number) => {
    const cell = heatmap.availabilityMap.get(`${hotel}-${offset}`)
    const status = cell ? AVAILABILITY_STATUS_LABEL[cell.status] : AVAILABILITY_STATUS_LABEL.unknown
    const total = cell?.totalRooms
    const available = cell?.availableRooms
    const soldRooms = cell?.soldRooms ?? (total != null && available != null ? total - available : null)
    const soldPercent = cell?.soldPercent != null ? Math.round(cell.soldPercent) : null

    const lines = [
      `${hotel}${hotel === activeSnapshot.referenceProperty ? " ⭐" : ""}`,
      `${formatDate(offset)} (Day +${offset})`,
      `Status: ${status}`,
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

    return lines.join("\n")
  }

  const propertyColumnWidth = 180
  const dayColumnWidth = `calc((100% - ${propertyColumnWidth}px) / ${Math.max(heatmap.dayOffsets.length, 1)})`
  const showEmptyState = heatmap.dayOffsets.length === 0 || heatmap.hotels.length === 0

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>90-Day Booking Status Heatmap</CardTitle>
            <CardDescription>White = booked, deeper green = more rooms available</CardDescription>
            <div className="text-xs text-muted-foreground mt-1">{activeSnapshot.fullLabel}</div>
          </div>
          <div className="w-full sm:w-auto">
            <SnapshotToggle options={options} value={activeSnapshot.id} onChange={handleSnapshotChange} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div key={activeSnapshot.id} className="transition-opacity duration-300 animate-in fade-in-50">
          {showEmptyState ? (
            <div className="p-6 text-sm text-muted-foreground">No booking status data available for this snapshot.</div>
          ) : (
            <>
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
              <div className="px-6 py-4">
                <div className="flex items-center gap-6 text-xs border-b pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded border border-green-600" />
                    <span>Available</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-white rounded border border-gray-200" />
                    <span>Booked</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-12 rounded border border-green-600/40"
                      style={{ background: "linear-gradient(to right, rgba(34,197,94,1), rgba(34,197,94,0.1))" }}
                    />
                    <span>Lighter = fewer rooms left</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">⭐ {activeSnapshot.referenceProperty}</span>
                  </div>
                </div>
              </div>
              <div className="px-6 pb-6">
                <div className="overflow-x-auto w-full">
                  <table className="border-collapse text-xs w-full table-fixed">
                    <colgroup>
                    <col style={{ width: `${propertyColumnWidth}px` }} />
                    {heatmap.dayOffsets.map((offset) => (
                      <col key={`col-${offset}`} style={{ width: dayColumnWidth }} />
                    ))}
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="sticky left-0 bg-background border-r border-b p-1 pl-6 text-left font-medium text-[11px] z-10">
                        Property
                      </th>
                      {heatmap.weeks.map((week, weekIndex) => (
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
                      <th className="sticky left-0 bg-background border-r border-b p-0.5 pl-6 z-10" />
                      {heatmap.dayOffsets.map((offset) => (
                        <th
                          key={offset}
                          className="border-b p-0 text-center text-[9px] font-normal text-muted-foreground"
                        >
                          {formatDay(offset)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {heatmap.hotels.map((hotel, index) => {
                      const isReference = hotel === activeSnapshot.referenceProperty
                      const rowBackground = isReference ? "bg-amber-100/40" : index % 2 === 0 ? "bg-muted/20" : ""
                      const stickyBg = isReference ? "bg-amber-100/70" : "bg-background"
                      return (
                        <tr key={hotel} className={rowBackground}>
                          <td className={`sticky left-0 ${stickyBg} border-r p-1 pl-6 text-[10px] font-medium truncate z-10`}>
                            {hotel === activeSnapshot.referenceProperty && "⭐"}
                            <span className="ml-0.5">{hotel}</span>
                          </td>
                          {heatmap.dayOffsets.map((offset) => {
                            const cell = heatmap.availabilityMap.get(`${hotel}-${offset}`)
                            const background = computeAvailabilityColor(cell)
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
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Daily availability components
interface AvailabilityChartSnapshot extends SnapshotMeta {
  dailyData: PriceWiseDailyPricingRecord[]
  referenceProperty: string
}

interface DailyAvailabilityChartProps {
  snapshots: AvailabilityChartSnapshot[]
}

export function DailyAvailabilityChart({ snapshots }: DailyAvailabilityChartProps) {
  const [activeSnapshotId, setActiveSnapshotId] = useState(() => snapshots[0]?.id ?? "")

  useEffect(() => {
    if (snapshots.length === 0) {
      if (activeSnapshotId !== "") {
        setActiveSnapshotId("")
      }
      return
    }

    if (!snapshots.some((snapshot) => snapshot.id === activeSnapshotId)) {
      setActiveSnapshotId(snapshots[0].id)
    }
  }, [snapshots, activeSnapshotId])

  const options = useMemo(
    () => snapshots.map((snapshot) => ({ id: snapshot.id, label: snapshot.label, dateLabel: snapshot.dateLabel })),
    [snapshots],
  )

  const activeSnapshot = snapshots.find((snapshot) => snapshot.id === activeSnapshotId) ?? snapshots[0] ?? null

  type AvailabilityRow = {
    hotel: string
    availabilityRate: number
    bookingPressure: number
    totalDays: number
    availableDays: number
    limitedDays: number
    soldOutDays: number
    isReference: boolean
  }

  const availability = useMemo(() => {
    const empty = {
      rows: [] as AvailabilityRow[],
      averageAvailability: 0,
      averagePressure: 0,
      referenceIndex: -1,
    }

    if (!activeSnapshot || !activeSnapshot.dailyData || activeSnapshot.dailyData.length === 0) {
      return empty
    }

    const counts = new Map<string, {
      total: number
      available: number
      limited: number
      soldOut: number
    }>()

    activeSnapshot.dailyData.forEach((record) => {
      const status = normalizeAvailabilityStatus(record.availability)
      const entry = counts.get(record.hotel_name) ?? { total: 0, available: 0, limited: 0, soldOut: 0 }
      entry.total += 1
      if (status === "available") {
        entry.available += 1
      } else if (status === "limited") {
        entry.limited += 1
      } else if (status === "sold_out") {
        entry.soldOut += 1
      }
      counts.set(record.hotel_name, entry)
    })

    const rows: AvailabilityRow[] = Array.from(counts.entries()).map(([hotel, stats]) => {
      // Treat "limited" inventory as partial availability so pressure reflects constrained supply.
      const weightedAvailable = stats.available + stats.limited * 0.5
      const availabilityRate = stats.total > 0 ? (weightedAvailable / stats.total) * 100 : 0
      const bookingPressure = Math.max(0, Math.min(100, 100 - availabilityRate))
      return {
        hotel,
        availabilityRate,
        bookingPressure,
        totalDays: stats.total,
        availableDays: stats.available,
        limitedDays: stats.limited,
        soldOutDays: stats.soldOut,
        isReference: hotel === activeSnapshot.referenceProperty,
      }
    })

    rows.sort((a, b) => a.availabilityRate - b.availabilityRate || a.hotel.localeCompare(b.hotel))

    const averageAvailability = rows.length > 0
      ? rows.reduce((sum, row) => sum + row.availabilityRate, 0) / rows.length
      : 0

    const averagePressure = rows.length > 0
      ? rows.reduce((sum, row) => sum + row.bookingPressure, 0) / rows.length
      : 0

    const referenceIndex = rows.findIndex((row) => row.isReference)

    return {
      rows,
      averageAvailability,
      averagePressure,
      referenceIndex,
    }
  }, [activeSnapshot])

  if (!activeSnapshot) {
    return null
  }

  const handleSnapshotChange = (nextId: string) => {
    setActiveSnapshotId(nextId)
  }

  const showEmptyState = availability.rows.length === 0
  const mostInDemand = availability.rows[0]
  const referenceRow = availability.referenceIndex >= 0 ? availability.rows[availability.referenceIndex] : null

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Daily Availability Tracking</CardTitle>
            <CardDescription>Properties ranked by booking pressure (lowest availability = highest demand)</CardDescription>
            <div className="text-xs text-muted-foreground mt-1">{activeSnapshot.fullLabel}</div>
          </div>
          <div className="w-full sm:w-auto">
            <SnapshotToggle options={options} value={activeSnapshot.id} onChange={handleSnapshotChange} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div key={activeSnapshot.id} className="transition-opacity duration-300 animate-in fade-in-50">
          {showEmptyState ? (
            <div className="p-6 text-sm text-muted-foreground">No availability data available for this snapshot.</div>
          ) : (
            <div className="space-y-4">
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
                    {availability.rows.map((row, index) => (
                      <tr
                        key={row.hotel}
                        className={`border-b last:border-0 ${row.isReference ? "bg-muted/30" : ""}`}
                      >
                        <td className="p-2 font-medium">{index + 1}</td>
                        <td className="p-2">
                          {row.hotel}
                          {row.isReference && " ⭐"}
                        </td>
                        <td className="p-2 text-right">
                          <span
                            className={
                              row.availabilityRate < 30
                                ? "text-red-600 font-medium"
                                : row.availabilityRate < 60
                                  ? "text-orange-600"
                                  : "text-green-600"
                            }
                          >
                            {row.availabilityRate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className={
                                  row.bookingPressure > 70
                                    ? "h-full bg-red-500"
                                    : row.bookingPressure > 40
                                      ? "h-full bg-orange-500"
                                      : "h-full bg-green-500"
                                }
                                style={{ width: `${row.bookingPressure}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground w-16 text-right">
                              {row.bookingPressure.toFixed(0)}% booked
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="rounded-md border p-3">
                  <div className="text-muted-foreground mb-1">Most In-Demand</div>
                  <div className="font-semibold">{mostInDemand?.hotel ?? "-"}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {mostInDemand ? `${mostInDemand.availabilityRate.toFixed(1)}% available` : "No data"}
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-muted-foreground mb-1">{activeSnapshot.referenceProperty} Rank</div>
                  <div className="font-semibold">
                    {availability.referenceIndex >= 0
                      ? `#${availability.referenceIndex + 1} of ${availability.rows.length}`
                      : "Not ranked"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {referenceRow ? `${referenceRow.availabilityRate.toFixed(1)}% available` : "No data"}
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-muted-foreground mb-1">Market Average</div>
                  <div className="font-semibold">{availability.averageAvailability.toFixed(1)}%</div>
                  <div className="text-xs text-muted-foreground mt-1">average availability across all properties</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
