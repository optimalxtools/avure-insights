export type PriceWiseConfig = {
  occupancyMode: boolean
  daysAhead: number
  occupancyCheckInterval: number
  checkInOffsets: number[]
  stayDurations: number[]
  guests: number
  rooms: number
  referenceProperty: string
  headless: boolean
  browserTimeout: number
  enableArchiving: boolean
  maxArchiveFiles: number
  showProgress: boolean
  progressInterval: number
  requestDelay: number
  modeName: string
}

export type PriceWiseRunState = {
  status: "idle" | "running"
  startedAt?: string
  runId?: string
  pid?: number
  logFile?: string
  lastEndedAt?: string
  lastExitCode?: number | null
  lastRunId?: string
  errorMessage?: string
}

export type PriceWiseHistoryEntry = {
  timestamp: string
  mode?: string
  scrape_success: boolean
  analysis_success: boolean
  config: {
    mode?: string
    occupancy_mode: boolean
    days_ahead: number
    guests: number
    rooms: number
    reference_property: string
    timestamp: string
  }
}

export type PriceWiseDailyProgress = {
  date: string
  completed_properties: string[]
  last_updated: string
}

export type PriceWiseStatusPayload = {
  runState: PriceWiseRunState
  history: PriceWiseHistoryEntry[]
  config: PriceWiseConfig
  outputs: {
    analysisJson: boolean
    pricingCsv: boolean
  }
  dailyProgress?: PriceWiseDailyProgress
  logTail?: string[]
}

export type PriceWiseAnalysis = {
  generated_at: string
  reference_property: string
  mode: string
  pricing_metrics?: Array<Record<string, number | string | null>>
  occupancy_metrics?: Array<Record<string, number | string | null>>
  comparison?: Array<Record<string, number | string | null>>
  room_inventory?: Array<Record<string, number | string | boolean | null>>
}
