"use client"

import { useMemo, useState } from "react"
import { Line, CartesianGrid, XAxis, YAxis, Legend, ResponsiveContainer, Area, ComposedChart, ReferenceLine } from "recharts"
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
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronDown } from "lucide-react"

// Black color for reference property (Ukanyi)
const REFERENCE_COLOR = "hsl(0, 0%, 10%)" // Black

// Colors for % change area fills (positive/negative)
const POSITIVE_COLOR = "hsl(142, 71%, 45%)" // Green
const NEGATIVE_COLOR = "hsl(0, 84%, 60%)" // Red

// Color palette for comparison properties (red first)
const CHART_COLORS = [
  "hsl(0, 84%, 60%)", // Red - first comparison property
  "hsl(221, 83%, 53%)", // Blue
  "hsl(262, 83%, 58%)", // Purple
  "hsl(45, 93%, 47%)", // Orange/Yellow
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--chart-1))",
]

export type TimeSeriesDataPoint = {
  date: string
  dateLabel: string
  [key: string]: number | string | null
}

export type PropertyTimeSeriesData = {
  allProperties: string[]
  referenceProperty: string
  priceData: TimeSeriesDataPoint[]
  occupancyData: TimeSeriesDataPoint[]
}

interface TimeSeriesChartsProps {
  data: PropertyTimeSeriesData
}

export function OverviewTimeSeriesCharts({ data }: TimeSeriesChartsProps) {
  const { allProperties, referenceProperty, priceData, occupancyData } = data
  
  // Get non-reference properties for the dropdown
  const otherProperties = useMemo(
    () => allProperties.filter((p) => p !== referenceProperty),
    [allProperties, referenceProperty]
  )
  
  // Track selected properties (reference is always selected)
  const [selectedProperties, setSelectedProperties] = useState<Set<string>>(new Set())
  
  // Track % change mode
  const [showPercentChange, setShowPercentChange] = useState(false)
  
  // Properties to show on chart (always includes reference + selected)
  const visibleProperties = useMemo(() => {
    const visible = [referenceProperty, ...Array.from(selectedProperties)]
    return visible.filter((p) => allProperties.includes(p))
  }, [referenceProperty, selectedProperties, allProperties])
  
  // Build chart config dynamically
  const chartConfig = useMemo(() => {
    const config: ChartConfig = {}
    visibleProperties.forEach((property, index) => {
      const key = property.replace(/[^a-zA-Z0-9]/g, "_")
      const isReference = property === referenceProperty
      // Reference property gets turquoise, others get colors from palette (offset by 1 since reference is always first)
      const colorIndex = isReference ? -1 : index - 1
      config[key] = {
        label: property,
        color: isReference ? REFERENCE_COLOR : CHART_COLORS[colorIndex % CHART_COLORS.length],
      }
    })
    return config
  }, [visibleProperties, referenceProperty])
  
  const handlePropertyToggle = (property: string) => {
    setSelectedProperties((prev) => {
      const next = new Set(prev)
      if (next.has(property)) {
        next.delete(property)
      } else {
        next.add(property)
      }
      return next
    })
  }

  // Filter data to only include visible properties
  const filteredPriceData = useMemo(() => {
    return priceData.map((point) => {
      const filtered: TimeSeriesDataPoint = {
        date: point.date,
        dateLabel: point.dateLabel,
      }
      visibleProperties.forEach((property) => {
        const key = property.replace(/[^a-zA-Z0-9]/g, "_")
        filtered[key] = point[key] ?? null
      })
      return filtered
    })
  }, [priceData, visibleProperties])

  const filteredOccupancyData = useMemo(() => {
    return occupancyData.map((point) => {
      const filtered: TimeSeriesDataPoint = {
        date: point.date,
        dateLabel: point.dateLabel,
      }
      visibleProperties.forEach((property) => {
        const key = property.replace(/[^a-zA-Z0-9]/g, "_")
        filtered[key] = point[key] ?? null
      })
      return filtered
    })
  }, [occupancyData, visibleProperties])

  // Calculate % change data for price chart (period-over-period)
  const percentChangePriceData = useMemo(() => {
    if (filteredPriceData.length === 0) return []
    
    return filteredPriceData.map((point, index) => {
      const transformed: TimeSeriesDataPoint = {
        date: point.date,
        dateLabel: point.dateLabel,
      }
      visibleProperties.forEach((property) => {
        const key = property.replace(/[^a-zA-Z0-9]/g, "_")
        const currentValue = point[key]
        
        if (index === 0) {
          // First point has no previous, so % change is 0
          transformed[key] = 0
        } else {
          const previousValue = filteredPriceData[index - 1][key]
          if (
            typeof currentValue === "number" && Number.isFinite(currentValue) &&
            typeof previousValue === "number" && Number.isFinite(previousValue) && previousValue > 0
          ) {
            transformed[key] = ((currentValue - previousValue) / previousValue) * 100
          } else {
            transformed[key] = null
          }
        }
      })
      return transformed
    })
  }, [filteredPriceData, visibleProperties])

  // Calculate % change data for occupancy chart (period-over-period)
  const percentChangeOccupancyData = useMemo(() => {
    if (filteredOccupancyData.length === 0) return []
    
    return filteredOccupancyData.map((point, index) => {
      const transformed: TimeSeriesDataPoint = {
        date: point.date,
        dateLabel: point.dateLabel,
      }
      visibleProperties.forEach((property) => {
        const key = property.replace(/[^a-zA-Z0-9]/g, "_")
        const currentValue = point[key]
        
        if (index === 0) {
          // First point has no previous, so % change is 0
          transformed[key] = 0
        } else {
          const previousValue = filteredOccupancyData[index - 1][key]
          if (
            typeof currentValue === "number" && Number.isFinite(currentValue) &&
            typeof previousValue === "number" && Number.isFinite(previousValue) && previousValue > 0
          ) {
            transformed[key] = ((currentValue - previousValue) / previousValue) * 100
          } else {
            transformed[key] = null
          }
        }
      })
      return transformed
    })
  }, [filteredOccupancyData, visibleProperties])

  // Calculate dynamic Y-axis bounds for price chart (10% below min)
  const priceYAxisDomain = useMemo((): [number, number | "auto"] => {
    const values: number[] = []
    filteredPriceData.forEach((point) => {
      visibleProperties.forEach((property) => {
        const key = property.replace(/[^a-zA-Z0-9]/g, "_")
        const value = point[key]
        if (typeof value === "number" && Number.isFinite(value) && value > 0) {
          values.push(value)
        }
      })
    })
    if (values.length === 0) return [0, "auto"]
    const minValue = Math.min(...values)
    const maxValue = Math.max(...values)
    const padding = minValue * 0.1 // 10% below min
    const yMin = Math.max(0, Math.floor((minValue - padding) / 1000) * 1000) // Round down to nearest 1000
    const yMax = Math.ceil((maxValue * 1.05) / 1000) * 1000 // 5% above max, round up
    return [yMin, yMax]
  }, [filteredPriceData, visibleProperties])

  // Calculate dynamic Y-axis bounds for occupancy chart (10% below min, max 100)
  const occupancyYAxisDomain = useMemo((): [number, number] => {
    const values: number[] = []
    filteredOccupancyData.forEach((point) => {
      visibleProperties.forEach((property) => {
        const key = property.replace(/[^a-zA-Z0-9]/g, "_")
        const value = point[key]
        if (typeof value === "number" && Number.isFinite(value) && value > 0) {
          values.push(value)
        }
      })
    })
    if (values.length === 0) return [0, 100]
    const minValue = Math.min(...values)
    const padding = minValue * 0.1 // 10% below min
    const yMin = Math.max(0, Math.floor(minValue - padding)) // Round down, but never below 0
    return [yMin, 100]
  }, [filteredOccupancyData, visibleProperties])

  // Calculate Y-axis bounds for price % change mode
  const pricePercentChangeYAxisDomain = useMemo((): [number, number] => {
    const values: number[] = []
    percentChangePriceData.forEach((point) => {
      visibleProperties.forEach((property) => {
        const key = property.replace(/[^a-zA-Z0-9]/g, "_")
        const value = point[key]
        if (typeof value === "number" && Number.isFinite(value)) {
          values.push(value)
        }
      })
    })
    if (values.length === 0) return [-10, 10]
    const minValue = Math.min(...values)
    const maxValue = Math.max(...values)
    const padding = Math.max(Math.abs(minValue), Math.abs(maxValue)) * 0.1
    const yMin = Math.floor(minValue - padding)
    const yMax = Math.ceil(maxValue + padding)
    return [yMin, yMax]
  }, [percentChangePriceData, visibleProperties])

  // Calculate Y-axis bounds for occupancy % change mode
  const occupancyPercentChangeYAxisDomain = useMemo((): [number, number] => {
    const values: number[] = []
    percentChangeOccupancyData.forEach((point) => {
      visibleProperties.forEach((property) => {
        const key = property.replace(/[^a-zA-Z0-9]/g, "_")
        const value = point[key]
        if (typeof value === "number" && Number.isFinite(value)) {
          values.push(value)
        }
      })
    })
    if (values.length === 0) return [-10, 10]
    const minValue = Math.min(...values)
    const maxValue = Math.max(...values)
    const padding = Math.max(Math.abs(minValue), Math.abs(maxValue)) * 0.1
    const yMin = Math.floor(minValue - padding)
    const yMax = Math.ceil(maxValue + padding)
    return [yMin, yMax]
  }, [percentChangeOccupancyData, visibleProperties])

  // Split reference property values into positive/negative for area fills in % change mode
  const referenceKey = referenceProperty.replace(/[^a-zA-Z0-9]/g, "_")
  
  const pricePercentChangeWithSplit = useMemo(() => {
    return percentChangePriceData.map((point) => {
      const value = point[referenceKey]
      return {
        ...point,
        [`${referenceKey}_positive`]: typeof value === "number" && value >= 0 ? value : 0,
        [`${referenceKey}_negative`]: typeof value === "number" && value < 0 ? value : 0,
      }
    })
  }, [percentChangePriceData, referenceKey])

  const occupancyPercentChangeWithSplit = useMemo(() => {
    return percentChangeOccupancyData.map((point) => {
      const value = point[referenceKey]
      return {
        ...point,
        [`${referenceKey}_positive`]: typeof value === "number" && value >= 0 ? value : 0,
        [`${referenceKey}_negative`]: typeof value === "number" && value < 0 ? value : 0,
      }
    })
  }, [percentChangeOccupancyData, referenceKey])

  // Split normal price data into green (increasing) / red (decreasing) areas
  // Transition points need to be in BOTH colors to connect areas without gaps
  const priceDataWithTrend = useMemo(() => {
    return filteredPriceData.map((point, index) => {
      const currentValue = point[referenceKey]
      const prevValue = index > 0 ? filteredPriceData[index - 1][referenceKey] : null
      const nextValue = index < filteredPriceData.length - 1 ? filteredPriceData[index + 1][referenceKey] : null
      
      if (typeof currentValue !== "number") {
        return {
          ...point,
          [`${referenceKey}_green`]: null,
          [`${referenceKey}_red`]: null,
        }
      }
      
      const incomingIncreasing = typeof prevValue === "number" && currentValue >= prevValue
      const incomingDecreasing = typeof prevValue === "number" && currentValue < prevValue
      const outgoingIncreasing = typeof nextValue === "number" && nextValue >= currentValue
      const outgoingDecreasing = typeof nextValue === "number" && nextValue < currentValue
      
      // First point - only use outgoing direction
      if (index === 0) {
        return {
          ...point,
          [`${referenceKey}_green`]: outgoingIncreasing ? currentValue : null,
          [`${referenceKey}_red`]: outgoingDecreasing ? currentValue : null,
        }
      }
      
      // Last point - only use incoming direction
      if (index === filteredPriceData.length - 1) {
        return {
          ...point,
          [`${referenceKey}_green`]: incomingIncreasing ? currentValue : null,
          [`${referenceKey}_red`]: incomingDecreasing ? currentValue : null,
        }
      }
      
      // Middle points - include in color if part of ANY segment of that color
      return {
        ...point,
        [`${referenceKey}_green`]: (incomingIncreasing || outgoingIncreasing) ? currentValue : null,
        [`${referenceKey}_red`]: (incomingDecreasing || outgoingDecreasing) ? currentValue : null,
      }
    })
  }, [filteredPriceData, referenceKey])

  // Split normal occupancy data into green/red areas
  // Transition points need to be in BOTH colors to connect areas without gaps
  const occupancyDataWithTrend = useMemo(() => {
    return filteredOccupancyData.map((point, index) => {
      const currentValue = point[referenceKey]
      const prevValue = index > 0 ? filteredOccupancyData[index - 1][referenceKey] : null
      const nextValue = index < filteredOccupancyData.length - 1 ? filteredOccupancyData[index + 1][referenceKey] : null
      
      if (typeof currentValue !== "number") {
        return {
          ...point,
          [`${referenceKey}_green`]: null,
          [`${referenceKey}_red`]: null,
        }
      }
      
      const incomingIncreasing = typeof prevValue === "number" && currentValue >= prevValue
      const incomingDecreasing = typeof prevValue === "number" && currentValue < prevValue
      const outgoingIncreasing = typeof nextValue === "number" && nextValue >= currentValue
      const outgoingDecreasing = typeof nextValue === "number" && nextValue < currentValue
      
      // First point - only use outgoing direction
      if (index === 0) {
        return {
          ...point,
          [`${referenceKey}_green`]: outgoingIncreasing ? currentValue : null,
          [`${referenceKey}_red`]: outgoingDecreasing ? currentValue : null,
        }
      }
      
      // Last point - only use incoming direction
      if (index === filteredOccupancyData.length - 1) {
        return {
          ...point,
          [`${referenceKey}_green`]: incomingIncreasing ? currentValue : null,
          [`${referenceKey}_red`]: incomingDecreasing ? currentValue : null,
        }
      }
      
      // Middle points - include in color if part of ANY segment of that color
      return {
        ...point,
        [`${referenceKey}_green`]: (incomingIncreasing || outgoingIncreasing) ? currentValue : null,
        [`${referenceKey}_red`]: (incomingDecreasing || outgoingDecreasing) ? currentValue : null,
      }
    })
  }, [filteredOccupancyData, referenceKey])

  if (priceData.length === 0 && occupancyData.length === 0) {
    return null
  }

  const selectedCount = selectedProperties.size

  return (
    <div className="space-y-4">
      {/* Property selector */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Compare with:</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                {selectedCount === 0 ? "Select properties" : `${selectedCount} selected`}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {otherProperties.map((property) => (
                <DropdownMenuCheckboxItem
                  key={property}
                  checked={selectedProperties.has(property)}
                  onCheckedChange={() => handlePropertyToggle(property)}
                >
                  {property}
                </DropdownMenuCheckboxItem>
              ))}
              {otherProperties.length === 0 && (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                  No other properties available
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="percent-change"
            checked={showPercentChange}
            onChange={(e) => setShowPercentChange(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
          />
          <label
            htmlFor="percent-change"
            className="text-sm text-muted-foreground cursor-pointer"
          >
            % change
          </label>
        </div>
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Price Time Series Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{showPercentChange ? "Price % Change" : "Price Over Time"}</CardTitle>
            <CardDescription>{showPercentChange ? "Period-over-period percentage change" : "Average price per night trend"}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={showPercentChange ? pricePercentChangeWithSplit : priceDataWithTrend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="pricePositiveGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={POSITIVE_COLOR} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={POSITIVE_COLOR} stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="priceNegativeGradient" x1="0" y1="1" x2="0" y2="0">
                      <stop offset="5%" stopColor={NEGATIVE_COLOR} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={NEGATIVE_COLOR} stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="dateLabel"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tickFormatter={(value) => showPercentChange ? `${value > 0 ? "+" : ""}${value.toFixed(0)}%` : `R${(value / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={45}
                    domain={showPercentChange ? pricePercentChangeYAxisDomain : priceYAxisDomain}
                  />
                  <ChartTooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        // Filter to only show Line entries (exclude Area duplicates and trend splits)
                        const filteredPayload = payload.filter((entry) => {
                          const dataKey = String(entry.dataKey || "")
                          // Exclude area entries (all helper data keys)
                          if (dataKey.includes("_positive") || dataKey.includes("_negative") || dataKey.includes("_green") || dataKey.includes("_red")) return false
                          // Only include entries from Line components (they have stroke property)
                          return entry.stroke !== "none" && entry.stroke !== undefined
                        })
                        if (filteredPayload.length === 0) return null
                        return (
                          <div className="rounded-lg border bg-background p-2 shadow-sm">
                            <div className="mb-1 font-medium text-sm">{label}</div>
                            <div className="grid gap-1">
                              {filteredPayload.map((entry, index) => (
                                <div key={index} className="flex items-center gap-2 text-xs">
                                  <div
                                    className="h-2 w-2 rounded-full"
                                    style={{ backgroundColor: entry.color }}
                                  />
                                  <span className="text-muted-foreground">{entry.name}:</span>
                                  <span className="font-medium">
                                    {showPercentChange 
                                      ? `${Number(entry.value) > 0 ? "+" : ""}${Number(entry.value).toFixed(1)}%`
                                      : `R ${Number(entry.value).toLocaleString("en-ZA", { maximumFractionDigits: 0 })}`
                                    }
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    formatter={(value) => <span className="text-xs">{value}</span>}
                  />
                  {/* Green/red area fills for reference property in normal mode */}
                  {!showPercentChange && visibleProperties.includes(referenceProperty) && (
                    <>
                      {/* Green area for increasing segments */}
                      <Area
                        type="monotone"
                        dataKey={`${referenceKey}_green`}
                        fill={POSITIVE_COLOR}
                        fillOpacity={0.2}
                        stroke="none"
                        connectNulls={false}
                        legendType="none"
                      />
                      {/* Red area for decreasing segments */}
                      <Area
                        type="monotone"
                        dataKey={`${referenceKey}_red`}
                        fill={NEGATIVE_COLOR}
                        fillOpacity={0.2}
                        stroke="none"
                        connectNulls={false}
                        legendType="none"
                      />
                    </>
                  )}
                  {/* Green/red area fills for reference property in % change mode */}
                  {showPercentChange && visibleProperties.includes(referenceProperty) && (
                    <>
                      <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.3} />
                      <Area
                        type="monotone"
                        dataKey={`${referenceKey}_positive`}
                        fill="url(#pricePositiveGradient)"
                        stroke="none"
                        connectNulls
                        legendType="none"
                        baseLine={0}
                      />
                      <Area
                        type="monotone"
                        dataKey={`${referenceKey}_negative`}
                        fill="url(#priceNegativeGradient)"
                        stroke="none"
                        connectNulls
                        legendType="none"
                        baseLine={0}
                      />
                    </>
                  )}
                  {visibleProperties.map((property, index) => {
                    const key = property.replace(/[^a-zA-Z0-9]/g, "_")
                    const isReference = property === referenceProperty
                    const colorIndex = isReference ? -1 : index - 1
                    const strokeColor = isReference ? REFERENCE_COLOR : CHART_COLORS[colorIndex % CHART_COLORS.length]
                    return (
                      <Line
                        key={key}
                        type="monotone"
                        dataKey={key}
                        name={property}
                        stroke={strokeColor}
                        strokeWidth={isReference ? 3.5 : 1.5}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                        connectNulls
                      />
                    )
                  })}
                </ComposedChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Occupancy Time Series Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{showPercentChange ? "Occupancy % Change" : "Occupancy Over Time"}</CardTitle>
            <CardDescription>{showPercentChange ? "Period-over-period percentage change" : "Property occupancy rate trend"}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={showPercentChange ? occupancyPercentChangeWithSplit : occupancyDataWithTrend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="occupancyPositiveGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={POSITIVE_COLOR} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={POSITIVE_COLOR} stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="occupancyNegativeGradient" x1="0" y1="1" x2="0" y2="0">
                      <stop offset="5%" stopColor={NEGATIVE_COLOR} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={NEGATIVE_COLOR} stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="dateLabel"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tickFormatter={(value) => showPercentChange ? `${value > 0 ? "+" : ""}${value.toFixed(0)}%` : `${value}%`}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={35}
                    domain={showPercentChange ? occupancyPercentChangeYAxisDomain : occupancyYAxisDomain}
                  />
                  <ChartTooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        // Filter to only show Line entries (exclude Area duplicates and trend splits)
                        const filteredPayload = payload.filter((entry) => {
                          const dataKey = String(entry.dataKey || "")
                          // Exclude area entries (all helper data keys)
                          if (dataKey.includes("_positive") || dataKey.includes("_negative") || dataKey.includes("_green") || dataKey.includes("_red")) return false
                          // Only include entries from Line components (they have stroke property)
                          return entry.stroke !== "none" && entry.stroke !== undefined
                        })
                        if (filteredPayload.length === 0) return null
                        return (
                          <div className="rounded-lg border bg-background p-2 shadow-sm">
                            <div className="mb-1 font-medium text-sm">{label}</div>
                            <div className="grid gap-1">
                              {filteredPayload.map((entry, index) => (
                                <div key={index} className="flex items-center gap-2 text-xs">
                                  <div
                                    className="h-2 w-2 rounded-full"
                                    style={{ backgroundColor: entry.color }}
                                  />
                                  <span className="text-muted-foreground">{entry.name}:</span>
                                  <span className="font-medium">
                                    {showPercentChange 
                                      ? `${Number(entry.value) > 0 ? "+" : ""}${Number(entry.value).toFixed(1)}%`
                                      : `${Number(entry.value).toFixed(1)}%`
                                    }
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    formatter={(value) => <span className="text-xs">{value}</span>}
                  />
                  {/* Green/red area fills for reference property in normal mode */}
                  {!showPercentChange && visibleProperties.includes(referenceProperty) && (
                    <>
                      {/* Green area for increasing segments */}
                      <Area
                        type="monotone"
                        dataKey={`${referenceKey}_green`}
                        fill={POSITIVE_COLOR}
                        fillOpacity={0.2}
                        stroke="none"
                        connectNulls={false}
                        legendType="none"
                      />
                      {/* Red area for decreasing segments */}
                      <Area
                        type="monotone"
                        dataKey={`${referenceKey}_red`}
                        fill={NEGATIVE_COLOR}
                        fillOpacity={0.2}
                        stroke="none"
                        connectNulls={false}
                        legendType="none"
                      />
                    </>
                  )}
                  {/* Green/red area fills for reference property in % change mode */}
                  {showPercentChange && visibleProperties.includes(referenceProperty) && (
                    <>
                      <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.3} />
                      <Area
                        type="monotone"
                        dataKey={`${referenceKey}_positive`}
                        fill="url(#occupancyPositiveGradient)"
                        stroke="none"
                        connectNulls
                        legendType="none"
                        baseLine={0}
                      />
                      <Area
                        type="monotone"
                        dataKey={`${referenceKey}_negative`}
                        fill="url(#occupancyNegativeGradient)"
                        stroke="none"
                        connectNulls
                        legendType="none"
                        baseLine={0}
                      />
                    </>
                  )}
                  {visibleProperties.map((property, index) => {
                    const key = property.replace(/[^a-zA-Z0-9]/g, "_")
                    const isReference = property === referenceProperty
                    const colorIndex = isReference ? -1 : index - 1
                    const strokeColor = isReference ? REFERENCE_COLOR : CHART_COLORS[colorIndex % CHART_COLORS.length]
                    return (
                      <Line
                        key={key}
                        type="monotone"
                        dataKey={key}
                        name={property}
                        stroke={strokeColor}
                        strokeWidth={isReference ? 3.5 : 1.5}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                        connectNulls
                      />
                    )
                  })}
                </ComposedChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
