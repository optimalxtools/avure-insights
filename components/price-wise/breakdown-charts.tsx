"use client"

import { useState } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Cell, ReferenceLine, Scatter, ScatterChart, ZAxis, Line, ComposedChart } from "recharts"
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

interface PriceDifferenceChartProps {
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

export function PriceDifferenceChart({ comparisonData, referenceProperty }: PriceDifferenceChartProps) {
  const [showTable, setShowTable] = useState(false)
  
  const chartData = comparisonData.map((item) => ({
    property: item.hotel_name,
    priceDiff: Number(item.price_vs_ref || 0),
    priceDiffPct: Number(item.price_vs_ref_pct || 0),
    isReference: item.hotel_name === referenceProperty,
  }))

  const maxAbsDiff = Math.max(...chartData.map(d => Math.abs(d.priceDiff)))
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Price Difference Analysis</CardTitle>
            <CardDescription>
              Price differences vs {referenceProperty}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowTable(!showTable)}
            className="ml-auto"
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
      </CardHeader>
      <CardContent className="p-0">
        {!showTable ? (
          <>
            <ChartContainer config={chartConfig} className="aspect-[4/3] w-full">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 20, left: 20, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis 
              type="number"
              tickFormatter={(value) => `R${value.toLocaleString()}`}
              domain={[-maxAbsDiff * 1.1, maxAbsDiff * 1.1]}
            />
            <YAxis 
              type="category" 
              dataKey="property" 
              width={90}
              tick={{ fontSize: 12 }}
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
              {comparisonData.map((row, index) => {
                const priceDiff = Number(row.price_vs_ref || 0)
                const priceDiffPct = Number(row.price_vs_ref_pct || 0)
                const isLower = priceDiff < 0
                const isReference = row.hotel_name === referenceProperty
                
                return (
                  <TableRow key={index} className={isReference ? "bg-muted/50" : ""}>
                    <TableCell className="font-medium">
                      {row.hotel_name}
                      {isReference && " ⭐"}
                    </TableCell>
                    <TableCell className="text-right">R {Number(row.avg_price || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className={`text-right ${isReference ? '' : isLower ? 'text-green-600' : 'text-red-600'}`}>
                      {priceDiff === 0 ? '—' : `R ${priceDiff > 0 ? '+' : ''}${priceDiff.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    </TableCell>
                    <TableCell className={`text-right ${isReference ? '' : isLower ? 'text-green-600' : 'text-red-600'}`}>
                      {priceDiffPct === 0 ? '—' : `${priceDiffPct > 0 ? '+' : ''}${priceDiffPct.toFixed(1)}%`}
                    </TableCell>
                    <TableCell className="text-right">{Number(row.occupancy || 0).toFixed(1)}%</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

interface PriceRangeChartProps {
  pricingData: Array<{
    hotel_name: string
    avg_price_per_night: number
    min_price: number
    max_price: number
  }>
  referenceProperty: string
}

export function PriceRangeChart({ pricingData, referenceProperty }: PriceRangeChartProps) {
  const [showTable, setShowTable] = useState(false)
  
  const chartData = pricingData.map((item) => ({
    property: item.hotel_name,
    average: Number(item.avg_price_per_night || 0),
    min: Number(item.min_price || 0),
    max: Number(item.max_price || 0),
    range: Number(item.max_price || 0) - Number(item.min_price || 0),
    isReference: item.hotel_name === referenceProperty,
  })).sort((a, b) => b.average - a.average)

  // Create data points for each property with min, avg, max
  const scatterData = chartData.flatMap((item, index) => [
    { property: item.property, value: item.min, type: 'min', propertyIndex: index, isReference: item.isReference },
    { property: item.property, value: item.average, type: 'avg', propertyIndex: index, isReference: item.isReference },
    { property: item.property, value: item.max, type: 'max', propertyIndex: index, isReference: item.isReference },
  ])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Price Range Comparison</CardTitle>
            <CardDescription>
              Average, minimum, and maximum prices by property
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowTable(!showTable)}
            className="ml-auto"
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
      </CardHeader>
      <CardContent className="p-0">
        {!showTable ? (
          <>
            <ChartContainer config={chartConfig} className="min-h-[600px] w-full">
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
              tick={{ fontSize: 12 }}
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
              shape={(props: any) => {
                const { x, y, width, height, payload } = props
                if (!payload || !x || !y || width <= 0) return <g />
                
                // x is where min starts, width is the range (max - min)
                const minX = x
                const maxX = x + width
                const avgX = x + (width * (payload.average - payload.min) / payload.range)
                const centerY = y + height / 2
                
                const lineColor = payload.isReference ? 'hsl(var(--chart-2))' : 'hsl(var(--chart-1))'
                const minColor = payload.isReference ? 'hsl(var(--chart-2))' : 'hsl(var(--chart-4))'
                const avgColor = payload.isReference ? 'hsl(var(--chart-2))' : 'hsl(var(--chart-3))'
                const maxColor = payload.isReference ? 'hsl(var(--chart-2))' : 'hsl(var(--chart-1))'
                
                return (
                  <g>
                    {/* Line from min to max */}
                    <line
                      x1={minX}
                      y1={centerY}
                      x2={maxX}
                      y2={centerY}
                      stroke={lineColor}
                      strokeWidth={2}
                    />
                    {/* Min dot */}
                    <circle
                      cx={minX}
                      cy={centerY}
                      r={6}
                      fill={minColor}
                      stroke="white"
                      strokeWidth={1}
                    />
                    {/* Average dot (larger) */}
                    <circle
                      cx={avgX}
                      cy={centerY}
                      r={8}
                      fill={avgColor}
                      stroke="white"
                      strokeWidth={1}
                    />
                    {/* Max dot */}
                    <circle
                      cx={maxX}
                      cy={centerY}
                      r={6}
                      fill={maxColor}
                      stroke="white"
                      strokeWidth={1}
                    />
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
              {pricingData.map((row) => {
                const isReference = row.hotel_name === referenceProperty
                return (
                  <TableRow key={row.hotel_name} className={isReference ? "bg-muted/50" : ""}>
                    <TableCell className="font-medium">
                      {row.hotel_name}
                      {isReference && " ⭐"}
                    </TableCell>
                    <TableCell>R {Number(row.avg_price_per_night || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell>R {Number(row.min_price || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell>R {Number(row.max_price || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
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

export function OccupancyComparisonChart({ data, referenceProperty }: OccupancyChartProps) {
  const [showTable, setShowTable] = useState(false)
  
  // Sort by occupancy descending
  const sortedData = [...data]
    .sort((a, b) => (b.occupancy_rate || 0) - (a.occupancy_rate || 0))
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
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Occupancy Analysis</CardTitle>
            <CardDescription>Availability vs Sold Out checks by property</CardDescription>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowTable(!showTable)}
            className="ml-auto"
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
      </CardHeader>
      <CardContent className="p-0">
        {!showTable ? (
          <>
            <ChartContainer config={stackedChartConfig} className="aspect-[4/3] w-full">
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
                  tick={{ fontSize: 12 }}
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
              {data
                .sort((a, b) => (b.occupancy_rate || 0) - (a.occupancy_rate || 0))
                .map((row, index) => {
                  const isReference = row.hotel_name === referenceProperty
                  return (
                    <TableRow key={index} className={isReference ? "bg-muted/50" : ""}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-medium">
                        {row.hotel_name}
                        {isReference && " ⭐"}
                      </TableCell>
                      <TableCell className="text-right">{Number(row.occupancy_rate || 0).toFixed(1)}%</TableCell>
                      <TableCell className="text-right">{row.sold_out || 0}</TableCell>
                      <TableCell className="text-right">{row.available || 0}</TableCell>
                    </TableRow>
                  )
                })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
