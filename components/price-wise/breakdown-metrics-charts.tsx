"use client"

import { useEffect, useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Cell, ReferenceLine, Scatter, ScatterChart, ZAxis, LabelList } from "recharts"
import type { LabelProps } from "recharts"
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
import { SnapshotToggle } from "@/components/price-wise/snapshot-toggle"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

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

const splitPropertyLabel = (name: string): { line1: string; line2: string } => {
  const trimmed = name.trim()
  if (trimmed === "") return { line1: "", line2: "" }

  const words = trimmed.split(/\s+/)
  if (words.length === 1) {
    return { line1: words[0], line2: "" }
  }

  if (words.length === 2) {
    return { line1: words[0], line2: words[1] }
  }

  const midpoint = Math.ceil(words.length / 2)
  return {
    line1: words.slice(0, midpoint).join(" "),
    line2: words.slice(midpoint).join(" "),
  }
}

type SnapshotMeta = {
  id: string
  label: string
  dateLabel: string
  fullLabel: string
}

type PriceDifferenceSnapshot = SnapshotMeta & {
  comparisonData: Array<{
    hotel_name: string
    avg_price: number
    price_vs_ref: number
    price_vs_ref_pct: number
    occupancy: number
    position: string
  }>
  referenceProperty: string
}

interface PriceDifferenceChartProps {
  snapshots: PriceDifferenceSnapshot[]
  className?: string
}

export function PriceDifferenceChart({ snapshots, className }: PriceDifferenceChartProps) {
  const [showTable, setShowTable] = useState(false)
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
    if (!activeSnapshot) return []

    return activeSnapshot.comparisonData.map((item) => {
      const priceDiff = toNumber(item.price_vs_ref) ?? 0
      const priceDiffPct = toNumber(item.price_vs_ref_pct) ?? 0

      return {
        property: item.hotel_name,
        priceDiff,
        priceDiffPct,
        isReference: item.hotel_name === activeSnapshot.referenceProperty,
      }
    })
  }, [activeSnapshot])

  if (!activeSnapshot) {
    return null
  }

  const maxAbsDiff = chartData.length
    ? Math.max(...chartData.map(d => Math.abs(d.priceDiff)))
    : 0
  const axisExtent = Math.max(maxAbsDiff * 1.1, 10)
  const cardClasses = `flex w-full flex-col ${className ?? ""}`
    .replace(/\s+/g, " ")
    .trim()

  const handleSnapshotChange = (nextId: string) => {
    setActiveSnapshotId(nextId)
  }
  
  return (
    <Card className={cardClasses}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle>Price Difference Analysis</CardTitle>
            <CardDescription>
              Price differences vs {activeSnapshot.referenceProperty}
            </CardDescription>
            <div className="mt-3 sm:hidden">
              <SnapshotToggle
                options={options}
                value={activeSnapshot.id}
                onChange={handleSnapshotChange}
                disabled={snapshots.length <= 1}
              />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden sm:block">
              <SnapshotToggle
                options={options}
                value={activeSnapshot.id}
                onChange={handleSnapshotChange}
                disabled={snapshots.length <= 1}
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowTable(!showTable)}
            >
            {showTable ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"/>
                <line x1="12" y1="20" x2="12" y2="4"/>
                <line x1="6" y1="20" x2="6" y2="14"/>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2"/>
                <path d="M3 9h18"/>
                <path d="M3 15h18"/>
                <path d="M9 3v18"/>
              </svg>
            )}
          </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col p-0">
        {!showTable ? (
          <>
            <ChartContainer config={chartConfig} className="h-[480px] w-full sm:h-[540px]">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 20, left: 20, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis 
              type="number"
              tickFormatter={(value) => `R${value.toLocaleString()}`}
              domain={[-axisExtent, axisExtent]}
            />
            <YAxis 
              type="category" 
              dataKey="property" 
              width={90}
              tick={{ fontSize: 10 }}
            />
            <ChartTooltip 
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-sm">
                      <div className="grid gap-2">
                        <div className="flex flex-col">
                          <span className="text-[0.70rem] uppercase text-muted-foreground">
                            {data.property}
                          </span>
                          <span className="font-bold text-muted-foreground">
                            {data.isReference ? 'Reference Property' : (
                              <>
                                <span className={data.priceDiff < 0 ? 'text-green-600' : 'text-red-600'}>
                                  {data.priceDiff > 0 ? '+' : ''}R{data.priceDiff.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                                <span className="text-xs ml-1">
                                  ({data.priceDiffPct > 0 ? '+' : ''}{data.priceDiffPct.toFixed(1)}%)
                                </span>
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                }
                return null
              }}
            />
            <ReferenceLine x={0} stroke="hsl(var(--border))" strokeWidth={2} />
            <Bar dataKey="priceDiff" radius={4}>
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={
                    entry.isReference 
                      ? 'hsl(var(--chart-2))' 
                      : entry.priceDiff < 0 
                        ? 'hsl(142, 76%, 36%)' 
                        : 'hsl(0, 84%, 60%)'
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
        <div className="mt-0 mb-2 flex items-center justify-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: 'hsl(142, 76%, 36%)' }}></div>
            <span className="text-muted-foreground">Lower</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: 'hsl(var(--chart-2))' }}></div>
            <span className="text-muted-foreground">Reference</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: 'hsl(0, 84%, 60%)' }}></div>
            <span className="text-muted-foreground">Higher</span>
          </div>
        </div>
          </>
        ) : (
          <div className="flex-1 overflow-auto">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property</TableHead>
                <TableHead className="text-right">Avg Price</TableHead>
                <TableHead className="text-right">Difference</TableHead>
                <TableHead className="text-right">% Diff</TableHead>
                <TableHead className="text-right">Occupancy</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeSnapshot.comparisonData.map((row, index) => {
                const priceDiff = toNumber(row.price_vs_ref) ?? 0
                const priceDiffPct = toNumber(row.price_vs_ref_pct) ?? 0
                const isLower = priceDiff < 0
                const isReference = row.hotel_name === activeSnapshot.referenceProperty
                
                return (
                  <TableRow key={index} className={isReference ? "bg-muted/50" : ""}>
                    <TableCell className="font-medium">
                      {row.hotel_name}
                      {isReference && " ⭐"}
                    </TableCell>
                    <TableCell className="text-right">R {(toNumber(row.avg_price) ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className={`text-right ${isReference ? '' : isLower ? 'text-green-600' : 'text-red-600'}`}>
                      {priceDiff === 0 ? '—' : `R ${priceDiff > 0 ? '+' : ''}${priceDiff.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    </TableCell>
                    <TableCell className={`text-right ${isReference ? '' : isLower ? 'text-green-600' : 'text-red-600'}`}>
                      {priceDiffPct === 0 ? '—' : `${priceDiffPct > 0 ? '+' : ''}${priceDiffPct.toFixed(1)}%`}
                    </TableCell>
                    <TableCell className="text-right">{(toNumber(row.occupancy) ?? 0).toFixed(1)}%</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface PriceRangeSnapshot extends SnapshotMeta {
  pricingData: Array<{
    hotel_name: string
    avg_price_per_night: number
    min_price: number
    max_price: number
  }>
  referenceProperty: string
}

interface PriceRangeChartProps {
  snapshots: PriceRangeSnapshot[]
  className?: string
}

type PriceRangeShapeProps = {
  x: number
  y: number
  width: number
  height: number
  payload?: {
    range?: number | string | null
    min?: number | string | null
    average?: number | string | null
    isReference?: boolean
  }
}

function isPriceRangeShapeProps(value: unknown): value is PriceRangeShapeProps {
  if (!value || typeof value !== "object") return false
  const candidate = value as { x?: unknown; y?: unknown; width?: unknown; height?: unknown }
  return (
    typeof candidate.x === "number" &&
    typeof candidate.y === "number" &&
    typeof candidate.width === "number" &&
    typeof candidate.height === "number"
  )
}

export function PriceRangeChart({ snapshots, className }: PriceRangeChartProps) {
  const [showTable, setShowTable] = useState(false)
  const [activeSnapshotId, setActiveSnapshotId] = useState<string>(snapshots[0]?.id || 'current')

  useEffect(() => {
    if (snapshots.length > 0 && !snapshots.find(s => s.id === activeSnapshotId)) {
      setActiveSnapshotId(snapshots[0].id)
    }
  }, [snapshots, activeSnapshotId])

  const activeSnapshot = useMemo(
    () => snapshots.find(s => s.id === activeSnapshotId) || snapshots[0],
    [snapshots, activeSnapshotId]
  )

  const snapshotOptions = useMemo(
    () => snapshots.map(s => ({ id: s.id, value: s.id, label: s.label, dateLabel: s.dateLabel })),
    [snapshots]
  )
  
  const chartData = activeSnapshot.pricingData
    .map((item) => {
      const min = toNumber(item.min_price) ?? 0
      const max = toNumber(item.max_price) ?? 0
      const average = toNumber(item.avg_price_per_night) ?? 0

      return {
        property: item.hotel_name,
        average,
        min,
        max,
        range: Math.max(max - min, 0),
        isReference: item.hotel_name === activeSnapshot.referenceProperty,
      }
    })
    .sort((a, b) => b.average - a.average)

  const cardClasses = `flex w-full flex-col ${className ?? ""}`
    .replace(/\s+/g, " ")
    .trim()

  return (
    <Card className={cardClasses}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle>Price Range Comparison</CardTitle>
            <CardDescription>
              Average, minimum, and maximum prices by property
            </CardDescription>
            <div className="mt-3 sm:hidden">
              <SnapshotToggle
                options={snapshotOptions}
                value={activeSnapshotId}
                onChange={setActiveSnapshotId}
              />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden sm:block">
              <SnapshotToggle
                options={snapshotOptions}
                value={activeSnapshotId}
                onChange={setActiveSnapshotId}
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowTable(!showTable)}
            >
              {showTable ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10"/>
                  <line x1="12" y1="20" x2="12" y2="4"/>
                  <line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="3" rx="2"/>
                  <path d="M3 9h18"/>
                  <path d="M3 15h18"/>
                  <path d="M9 3v18"/>
                </svg>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col p-0">
        {!showTable ? (
          <>
            <ChartContainer config={chartConfig} className="h-[480px] w-full sm:h-[540px]">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis 
              type="number"
              tickFormatter={(value) => `R${value.toLocaleString()}`}
            />
            <YAxis 
              type="category" 
              dataKey="property" 
              width={90}
              tick={{ fontSize: 10 }}
            />
            <ChartTooltip 
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-sm">
                      <div className="grid gap-2">
                        <div className="flex flex-col">
                          <span className="text-[0.70rem] uppercase text-muted-foreground">
                            {data.property}
                          </span>
                          <div className="flex flex-col gap-1 mt-1">
                            <span className="text-xs">
                              <span className="font-semibold">Min:</span> R{data.min.toLocaleString('en-ZA')}
                            </span>
                            <span className="text-xs">
                              <span className="font-semibold">Avg:</span> R{data.average.toLocaleString('en-ZA')}
                            </span>
                            <span className="text-xs">
                              <span className="font-semibold">Max:</span> R{data.max.toLocaleString('en-ZA')}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Range: R{data.range.toLocaleString('en-ZA')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                }
                return null
              }}
            />
            {/* Stacked bars to create the range from min to max */}
            <Bar dataKey="min" stackId="range" fill="transparent" />
            <Bar 
              dataKey="range" 
              stackId="range"
              shape={(rawProps: unknown) => {
                if (!isPriceRangeShapeProps(rawProps)) {
                  return <></>
                }

                const { x, y, width, height, payload } = rawProps

                if (!payload || width <= 0) {
                  return <></>
                }

                const range = Number(payload.range ?? 0) || 0
                const minValue = Number(payload.min ?? 0) || 0
                const averageValue = Number(payload.average ?? minValue) || minValue

                const minX = x
                const maxX = x + width
                const avgX = range === 0 ? x : x + (width * (averageValue - minValue)) / Math.max(range, 1)
                const centerY = y + height / 2

                const lineColor = payload.isReference ? "hsl(var(--chart-2))" : "hsl(var(--chart-1))"
                const minColor = payload.isReference ? "hsl(var(--chart-2))" : "hsl(var(--chart-4))"
                const avgColor = payload.isReference ? "hsl(var(--chart-2))" : "hsl(var(--chart-3))"
                const maxColor = payload.isReference ? "hsl(var(--chart-2))" : "hsl(var(--chart-1))"

                return (
                  <g>
                    <line x1={minX} y1={centerY} x2={maxX} y2={centerY} stroke={lineColor} strokeWidth={2} />
                    <circle cx={minX} cy={centerY} r={6} fill={minColor} stroke="white" strokeWidth={1} />
                    <circle cx={avgX} cy={centerY} r={8} fill={avgColor} stroke="white" strokeWidth={1} />
                    <circle cx={maxX} cy={centerY} r={6} fill={maxColor} stroke="white" strokeWidth={1} />
                  </g>
                )
              }}
            />
          </BarChart>
        </ChartContainer>
        <div className="mt-0 mb-2 flex items-center justify-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: 'hsl(var(--chart-4))' }}></div>
            <span className="text-muted-foreground">Minimum</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(var(--chart-3))' }}></div>
            <span className="text-muted-foreground">Average</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: 'hsl(var(--chart-1))' }}></div>
            <span className="text-muted-foreground">Maximum</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: 'hsl(var(--chart-2))' }}></div>
            <span className="text-muted-foreground">Reference</span>
          </div>
        </div>
          </>
        ) : (
          <div className="flex-1 overflow-auto">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property</TableHead>
                <TableHead>Average</TableHead>
                <TableHead>Minimum</TableHead>
                <TableHead>Maximum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeSnapshot.pricingData.map((row) => {
                const isReference = row.hotel_name === activeSnapshot.referenceProperty
                return (
                  <TableRow key={row.hotel_name} className={isReference ? "bg-muted/50" : ""}>
                    <TableCell className="font-medium">
                      {row.hotel_name}
                      {isReference && " ⭐"}
                    </TableCell>
                    <TableCell>R {(toNumber(row.avg_price_per_night) ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell>R {(toNumber(row.min_price) ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell>R {(toNumber(row.max_price) ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface OccupancySnapshot extends SnapshotMeta {
  data: Array<{
    hotel_name: string
    occupancy_rate: number
    sold_out: number
    available: number
  }>
  referenceProperty: string
}

interface OccupancyChartProps {
  snapshots: OccupancySnapshot[]
  className?: string
}

export function OccupancyComparisonChart({ snapshots, className }: OccupancyChartProps) {
  const [showTable, setShowTable] = useState(false)
  const [activeSnapshotId, setActiveSnapshotId] = useState<string>(snapshots[0]?.id || 'current')

  useEffect(() => {
    if (snapshots.length > 0 && !snapshots.find(s => s.id === activeSnapshotId)) {
      setActiveSnapshotId(snapshots[0].id)
    }
  }, [snapshots, activeSnapshotId])

  const activeSnapshot = useMemo(
    () => snapshots.find(s => s.id === activeSnapshotId) || snapshots[0],
    [snapshots, activeSnapshotId]
  )

  const snapshotOptions = useMemo(
    () => snapshots.map(s => ({ id: s.id, value: s.id, label: s.label, dateLabel: s.dateLabel })),
    [snapshots]
  )
  
  // Sort by occupancy descending
  const sortedData = [...activeSnapshot.data]
    .sort((a, b) => (toNumber(b.occupancy_rate) ?? 0) - (toNumber(a.occupancy_rate) ?? 0))
    .map(item => ({
      name: item.hotel_name,
      soldOut: toNumber(item.sold_out) ?? 0,
      available: toNumber(item.available) ?? 0,
      occupancyRate: Number((toNumber(item.occupancy_rate) ?? 0).toFixed(1)),
      isReference: item.hotel_name === activeSnapshot.referenceProperty
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

  const cardClasses = `flex w-full flex-col ${className ?? ""}`
    .replace(/\s+/g, " ")
    .trim()

  return (
    <Card className={cardClasses}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle>Occupancy Analysis</CardTitle>
            <CardDescription>Availability vs Sold Out checks by property</CardDescription>
            <div className="mt-3 sm:hidden">
              <SnapshotToggle
                options={snapshotOptions}
                value={activeSnapshotId}
                onChange={setActiveSnapshotId}
              />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden sm:block">
              <SnapshotToggle
                options={snapshotOptions}
                value={activeSnapshotId}
                onChange={setActiveSnapshotId}
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowTable(!showTable)}
            >
              {showTable ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10"/>
                  <line x1="12" y1="20" x2="12" y2="4"/>
                  <line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="3" rx="2"/>
                  <path d="M3 9h18"/>
                  <path d="M3 15h18"/>
                  <path d="M9 3v18"/>
                </svg>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col p-0">
        {!showTable ? (
          <>
            <ChartContainer config={stackedChartConfig} className="h-[480px] w-full sm:h-[540px]">
              <BarChart data={sortedData} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={90}
                  tick={{ fontSize: 10 }}
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
                      fill={entry.isReference ? "hsl(var(--chart-2))" : "hsl(var(--chart-1))"} 
                    />
                  ))}
                </Bar>
                <Bar dataKey="available" stackId="a" radius={[4, 4, 0, 0]}>
                  {sortedData.map((entry, index) => (
                    <Cell 
                      key={`avail-${index}`} 
                      fill={entry.isReference ? "hsl(var(--muted))" : "hsl(var(--muted))"} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
            <div className="mt-0 mb-2 text-xs text-muted-foreground text-center">
              Higher sold-out ratio indicates stronger demand and market positioning
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-auto">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rank</TableHead>
                <TableHead>Property</TableHead>
                <TableHead className="text-right">Occupancy</TableHead>
                <TableHead className="text-right">Sold Out</TableHead>
                <TableHead className="text-right">Available</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeSnapshot.data
                .slice()
                .sort((a, b) => (toNumber(b.occupancy_rate) ?? 0) - (toNumber(a.occupancy_rate) ?? 0))
                .map((row, index) => {
                  const isReference = row.hotel_name === activeSnapshot.referenceProperty
                  return (
                    <TableRow key={index} className={isReference ? "bg-muted/50" : ""}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-medium">
                        {row.hotel_name}
                        {isReference && " ⭐"}
                      </TableCell>
                      <TableCell className="text-right">{(toNumber(row.occupancy_rate) ?? 0).toFixed(1)}%</TableCell>
                      <TableCell className="text-right">{toNumber(row.sold_out) ?? 0}</TableCell>
                      <TableCell className="text-right">{toNumber(row.available) ?? 0}</TableCell>
                    </TableRow>
                  )
                })}
            </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface RoomInventorySnapshot extends SnapshotMeta {
  data: Array<{
    hotel_name: string
    avg_room_occupancy_rate?: number | null
    avg_total_room_types?: number | null
    avg_available_room_types?: number | null
    avg_sold_out_room_types?: number | null
    room_type_count_estimate?: number | null
    avg_room_price?: number | null
    avg_room_price_avg?: number | null
    room_price_spread?: number | null
    room_price_spread_pct?: number | null
    uses_room_tiering?: boolean | null
  }>
  referenceProperty: string
}

interface RoomInventoryChartProps {
  snapshots: RoomInventorySnapshot[]
}

export function RoomInventoryChart({ snapshots }: RoomInventoryChartProps) {
  const [showTable, setShowTable] = useState(false)
  const [activeSnapshotId, setActiveSnapshotId] = useState<string>(snapshots[0]?.id || 'current')

  useEffect(() => {
    if (snapshots.length > 0 && !snapshots.find(s => s.id === activeSnapshotId)) {
      setActiveSnapshotId(snapshots[0].id)
    }
  }, [snapshots, activeSnapshotId])

  const activeSnapshot = useMemo(
    () => snapshots.find(s => s.id === activeSnapshotId) || snapshots[0],
    [snapshots, activeSnapshotId]
  )

  const snapshotOptions = useMemo(
    () => snapshots.map(s => ({ id: s.id, value: s.id, label: s.label, dateLabel: s.dateLabel })),
    [snapshots]
  )
  
  const chartData = activeSnapshot.data
    .map((item) => {
      const totalRoomsRaw = toNumber(item.room_type_count_estimate) ?? toNumber(item.avg_total_room_types)
      const avgRoomPrice = toNumber(item.avg_room_price) ?? toNumber(item.avg_room_price_avg)
      const occupancyRaw = toNumber(item.avg_room_occupancy_rate)
      const occupancy = (() => {
        if (occupancyRaw === null) return null
        if (!Number.isFinite(occupancyRaw)) return null
        return occupancyRaw > 1 ? occupancyRaw : occupancyRaw * 100
      })()
      const priceSpreadPct = toNumber(item.room_price_spread_pct)
      const { line1, line2 } = splitPropertyLabel(item.hotel_name)

      return {
        property: item.hotel_name,
        totalRooms: totalRoomsRaw ?? null,
        avgRoomPrice: avgRoomPrice ?? null,
        occupancy: occupancy ?? null,
        priceSpreadPct: priceSpreadPct ?? null,
        hasTiering: Boolean(item.uses_room_tiering),
        isReference: item.hotel_name === activeSnapshot.referenceProperty,
        labelLine1: line1,
        labelLine2: line2,
      }
    })
    .filter((item) => item.property && item.totalRooms !== null && item.totalRooms > 0 && item.avgRoomPrice !== null && item.avgRoomPrice > 0)

  if (chartData.length === 0) {
    return null
  }

  const maxRooms = Math.ceil(Math.max(...chartData.map((item) => Number(item.totalRooms ?? 0))))
  const maxTickValue = Math.max(maxRooms, 2)
  const roomDomain: [number, number] = [0, maxTickValue]
  const roomTicks = Array.from({ length: maxTickValue }, (_, index) => index + 1)
  const maxPrice = Math.max(...chartData.map((item) => Number(item.avgRoomPrice ?? 0)))
  const priceDomain: [number, number] = [0, Math.ceil(maxPrice / 5000) * 5000]

  const occupancyValues = chartData
    .map((item) => item.occupancy)
    .filter((value): value is number => value !== null && Number.isFinite(value))
  const zMin = occupancyValues.length > 0 ? Math.min(...occupancyValues) : 0
  const zMax = occupancyValues.length > 0 ? Math.max(...occupancyValues) : 100
  const bubbleRange: [number, number] = [120, 420]

  const chartLegend = (
    <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <div className="h-2.5 w-2.5 rounded" style={{ backgroundColor: "hsl(var(--chart-1))" }} />
        <span>Tiered pricing</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="h-2.5 w-2.5 rounded" style={{ backgroundColor: "hsl(var(--chart-4))" }} />
        <span>Single tier</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="h-2.5 w-2.5 rounded" style={{ backgroundColor: "hsl(var(--chart-2))" }} />
        <span>{activeSnapshot.referenceProperty || "Reference"}</span>
      </div>
    </div>
  )

  const config = {
    occupancy: {
      label: "Occupancy",
      color: "hsl(var(--chart-1))",
    },
  } satisfies ChartConfig

  const cardClasses = `flex w-full flex-col`
    .replace(/\s+/g, " ")
    .trim()

  return (
    <Card className={cardClasses}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle>Room Inventory Mix</CardTitle>
            <CardDescription>Total room types vs. room pricing with occupancy bubble size</CardDescription>
            <div className="mt-3 sm:hidden">
              <SnapshotToggle
                options={snapshotOptions}
                value={activeSnapshotId}
                onChange={setActiveSnapshotId}
              />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden sm:block">
              <SnapshotToggle
                options={snapshotOptions}
                value={activeSnapshotId}
                onChange={setActiveSnapshotId}
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowTable(!showTable)}
            >
              {showTable ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10"/>
                  <line x1="12" y1="20" x2="12" y2="4"/>
                  <line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="3" rx="2"/>
                  <path d="M3 9h18"/>
                  <path d="M3 15h18"/>
                  <path d="M9 3v18"/>
                </svg>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col p-0">
        {!showTable ? (
          <>
            <ChartContainer config={config} className="h-[480px] w-full sm:h-[540px]">
          <ScatterChart margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="totalRooms"
              domain={roomDomain}
              label={{ value: "Total room types", position: "bottom", offset: 0, style: { fontSize: 12 } }}
              tick={{ fontSize: 11 }}
              allowDecimals={false}
              ticks={roomTicks}
              interval={0}
            />
            <YAxis
              type="number"
              dataKey="avgRoomPrice"
              domain={priceDomain}
              tickFormatter={(value) => `R${Number(value).toLocaleString("en-ZA")}`}
              label={{ value: "Average room price", angle: -90, position: "insideLeft", style: { fontSize: 12 } }}
              tick={{ fontSize: 11 }}
            />
            <ZAxis
              type="number"
              dataKey="occupancy"
              range={bubbleRange}
              domain={[zMin || 0, zMax || 100]}
              name="Room occupancy"
              unit="%"
            />
            <ChartTooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const datum = payload[0].payload as typeof chartData[number]
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-sm">
                      <div className="grid gap-2">
                        <div className="flex flex-col">
                          <span className="text-[0.70rem] font-semibold">
                            {datum.property}
                            {datum.isReference ? " ⭐" : ""}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Total room types: {Number(datum.totalRooms).toFixed(0)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Avg room price: R{Number(datum.avgRoomPrice).toLocaleString("en-ZA")}
                          </span>
                          {datum.occupancy !== null ? (
                            <span className="text-xs text-muted-foreground">
                              Room occupancy: {Number(datum.occupancy).toFixed(1)}%
                            </span>
                          ) : null}
                          {datum.priceSpreadPct !== null ? (
                            <span className="text-[0.70rem] text-muted-foreground">
                              Price spread: {Number(datum.priceSpreadPct).toFixed(1)}%
                            </span>
                          ) : null}
                          <span className="text-[0.65rem] text-muted-foreground">
                            Tiered pricing: {datum.hasTiering ? "Yes" : "No"}
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
              {chartData.map((entry, index) => {
                const fillColor = entry.isReference
                  ? "hsl(var(--chart-2))"
                  : entry.hasTiering
                    ? "hsl(var(--chart-1))"
                    : "hsl(var(--chart-4))"
                return (
                  <Cell
                    key={`room-mix-${index}`}
                    fill={fillColor}
                    opacity={entry.isReference ? 1 : 0.8}
                  />
                )
              })}
              <LabelList
                dataKey="property"
                content={(props) => {
                  const { x, y } = props
                  const datum = (props as LabelProps & { payload?: typeof chartData[number] }).payload
                  if (typeof x !== "number" || typeof y !== "number" || !datum) {
                    return null
                  }

                  const line1 = datum.labelLine1 || datum.property
                  const line2 = datum.labelLine2
                  const labelX = x + 12

                  return (
                    <text
                      x={labelX}
                      y={y}
                      fontSize={9}
                      fill="currentColor"
                      textAnchor="start"
                    >
                      <tspan x={labelX} dy={-4}>{line1}</tspan>
                      {line2 ? <tspan x={labelX} dy={10}>{line2}</tspan> : null}
                    </text>
                  )
                }}
              />
            </Scatter>
          </ScatterChart>
        </ChartContainer>
        {chartLegend}
        <div className="mt-3 text-xs text-muted-foreground text-center">
          Bubble size reflects room-level occupancy; larger bubbles indicate higher sold-through rates.
        </div>
          </>
        ) : (
          <div className="flex-1 overflow-auto">
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
                {activeSnapshot.data.map((row, index) => {
                  const isReference = row.hotel_name === activeSnapshot.referenceProperty
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
            <div className="mt-4 space-y-1 text-sm text-muted-foreground px-6 pb-4">
              <p><strong>Total Rooms:</strong> Estimated number of distinct room types being tracked for each property</p>
              <p><strong>Room Occupancy:</strong> Percentage of room types that are sold out</p>
              <p><strong>Price Spread:</strong> Difference between the cheapest and most expensive room as a percentage</p>
              <p><strong>Price Tiering:</strong> Highlights properties using multiple room tiers at different price points</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
