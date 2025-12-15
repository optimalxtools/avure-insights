import { randomUUID } from "crypto"
import { spawn } from "child_process"
import { createWriteStream, existsSync } from "fs"
import { promises as fs } from "fs"
import path from "path"

import type {
  PriceWiseAnalysis,
  PriceWiseConfig,
  PriceWiseDailyPricingRecord,
  PriceWiseDailyProgress,
  PriceWiseHistoryEntry,
  PriceWiseRunState,
  PriceWiseSnapshot,
  PriceWiseStatusPayload,
} from "./types"

const SCRAPER_ROOT = path.join(process.cwd(), "app", "(modules)", "price-wise", "data-acquisition", "runtime")
const DATA_ACQUISITION_ROOT = path.join(process.cwd(), "app", "(modules)", "price-wise", "data-acquisition")
const OUTPUT_DIR = path.join(DATA_ACQUISITION_ROOT, "outputs")
const LOGS_DIR = path.join(DATA_ACQUISITION_ROOT, "logs")
const ARCHIVE_DIR = path.join(DATA_ACQUISITION_ROOT, "archive")
const CONFIG_MANAGER = path.join(SCRAPER_ROOT, "config_manager.py")
const RUN_SCRIPT = path.join(SCRAPER_ROOT, "run.py")
const ANALYZE_SCRIPT = path.join(SCRAPER_ROOT, "analyze.py")
const SCRAPE_LOG = path.join(OUTPUT_DIR, "scrape_log.json")
const DAILY_PROGRESS_FILE = path.join(OUTPUT_DIR, "daily_progress.json")
const ANALYSIS_JSON = path.join(OUTPUT_DIR, "pricing_analysis.json")
const PRICING_CSV = path.join(OUTPUT_DIR, "pricing_data.csv")
const RUN_STATE_FILE = path.join(OUTPUT_DIR, "run_state.json")

const OUTPUT_FALLBACK_DIRS = [
  path.join(process.cwd(), "public", "data", "price-wise"),
  path.join(process.cwd(), ".next", "server", "app", "(modules)", "price-wise", "data-acquisition", "outputs"),
  path.join(process.cwd(), ".next", "standalone", "app", "(modules)", "price-wise", "data-acquisition", "outputs"),
  path.join(process.cwd(), ".output", "server", "app", "(modules)", "price-wise", "data-acquisition", "outputs"),
]
  .filter((value, index, array) => array.indexOf(value) === index)

const ARCHIVE_FALLBACK_DIRS = [
  path.join(process.cwd(), "public", "data", "price-wise", "archive"),
  path.join(process.cwd(), ".next", "server", "app", "(modules)", "price-wise", "data-acquisition", "archive"),
  path.join(process.cwd(), ".next", "standalone", "app", "(modules)", "price-wise", "data-acquisition", "archive"),
  path.join(process.cwd(), ".output", "server", "app", "(modules)", "price-wise", "data-acquisition", "archive"),
]
  .filter((value, index, array) => array.indexOf(value) === index)

const LOGS_FALLBACK_DIRS = [
  path.join(process.cwd(), ".next", "server", "app", "(modules)", "price-wise", "data-acquisition", "logs"),
  path.join(process.cwd(), ".next", "standalone", "app", "(modules)", "price-wise", "data-acquisition", "logs"),
  path.join(process.cwd(), ".output", "server", "app", "(modules)", "price-wise", "data-acquisition", "logs"),
]
  .filter((value, index, array) => array.indexOf(value) === index)

function logResolution(message: string, data: Record<string, unknown>) {
  const parts = Object.entries(data)
    .map(([key, value]) => `${key}=${value}`)
    .join(" ")
  console.info(`[price-wise] ${message} ${parts}`)
}

function resolveDirectoryWithFallback(primaryDir: string, fallbacks: string[]): string | undefined {
  if (existsSync(primaryDir)) return primaryDir
  for (const dir of fallbacks) {
    if (existsSync(dir)) {
      logResolution("Resolved fallback directory", { primaryDir, dir })
      return dir
    }
  }
  logResolution("No readable directory", { primaryDir, fallbacks: fallbacks.length })
  return undefined
}

function resolveFileWithFallback(primaryFile: string, fallbacks: string[]): string | undefined {
  if (existsSync(primaryFile)) return primaryFile
  const filename = path.basename(primaryFile)
  for (const dir of fallbacks) {
    const candidate = path.join(dir, filename)
    if (existsSync(candidate)) {
      logResolution("Resolved fallback file", { primaryFile, candidate })
      return candidate
    }
  }
  logResolution("No readable file", { primaryFile, fallbacks: fallbacks.length })
  return undefined
}

function getFallbackCandidates(filePath: string): string[] {
  if (filePath.startsWith(OUTPUT_DIR)) return OUTPUT_FALLBACK_DIRS
  if (filePath.startsWith(ARCHIVE_DIR)) return ARCHIVE_FALLBACK_DIRS
  if (filePath.startsWith(LOGS_DIR)) return LOGS_FALLBACK_DIRS
  return []
}

function resolveReadablePath(filePath: string): string | undefined {
  const resolved = resolveFileWithFallback(filePath, getFallbackCandidates(filePath))
  return resolved ?? (existsSync(filePath) ? filePath : undefined)
}

const PYTHON_CMD = process.env.PRICE_WISE_PYTHON || "python"
const LOG_LINES = 200

type RunStateFile = PriceWiseRunState & {
  logFile?: string
}

type PythonResult = {
  stdout: string
  stderr: string
}

async function ensureOutputDirectory() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true })
  await fs.mkdir(LOGS_DIR, { recursive: true })
}

type EnvDict = Record<string, string | undefined>

function spawnPython(args: string[], opts?: { env?: EnvDict }) {
  // Add -u flag to run Python in unbuffered mode for real-time output
  return spawn(PYTHON_CMD, ["-u", ...args], {
    cwd: SCRAPER_ROOT,
    env: { ...process.env, PYTHONUNBUFFERED: "1", ...opts?.env },
  })
}

async function runPython(args: string[], opts?: { env?: EnvDict }): Promise<PythonResult> {
  return new Promise((resolve, reject) => {
    const child = spawnPython(args, opts)
    let stdout = ""
    let stderr = ""

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString()
    })

    child.on("error", (error) => {
      reject(error)
    })

    child.on("close", (code) => {
      if (code && code !== 0) {
        const message = stderr || `Python exited with code ${code}`
        reject(new Error(message))
      } else {
        resolve({ stdout, stderr })
      }
    })
  })
}

function parseConfigPayload(raw: string): PriceWiseConfig {
  const data = JSON.parse(raw)
  return {
    occupancyMode: Boolean(data.OCCUPANCY_MODE),
    daysAhead: Number(data.DAYS_AHEAD),
    occupancyCheckInterval: Number(data.OCCUPANCY_CHECK_INTERVAL),
    checkInOffsets: Array.isArray(data.CHECK_IN_OFFSETS) ? data.CHECK_IN_OFFSETS.map(Number) : [],
    stayDurations: Array.isArray(data.STAY_DURATIONS) ? data.STAY_DURATIONS.map(Number) : [],
    guests: Number(data.GUESTS),
    rooms: Number(data.ROOMS),
    referenceProperty: String(data.REFERENCE_PROPERTY || ""),
    headless: Boolean(data.HEADLESS),
    browserTimeout: Number(data.BROWSER_TIMEOUT || 0),
    enableArchiving: Boolean(data.ENABLE_ARCHIVING),
    maxArchiveFiles: Number(data.MAX_ARCHIVE_FILES || 0),
    showProgress: Boolean(data.SHOW_PROGRESS),
    progressInterval: Number(data.PROGRESS_INTERVAL || 0),
    requestDelay: Number(data.REQUEST_DELAY || 0),
    modeName: String(data.MODE_NAME || (data.OCCUPANCY_MODE ? "OCCUPANCY TRACKING" : "PRICING ANALYSIS")),
  }
}

export async function getScraperConfig(): Promise<PriceWiseConfig> {
  const { stdout } = await runPython([CONFIG_MANAGER, "get"])
  return parseConfigPayload(stdout)
}

export async function updateScraperConfig(payload: Partial<PriceWiseConfig>) {
  const mapped: Record<string, unknown> = {}
  if (payload.occupancyMode !== undefined) mapped.OCCUPANCY_MODE = payload.occupancyMode
  if (payload.daysAhead !== undefined) mapped.DAYS_AHEAD = payload.daysAhead
  if (payload.occupancyCheckInterval !== undefined) mapped.OCCUPANCY_CHECK_INTERVAL = payload.occupancyCheckInterval
  if (payload.checkInOffsets !== undefined) mapped.CHECK_IN_OFFSETS = payload.checkInOffsets
  if (payload.stayDurations !== undefined) mapped.STAY_DURATIONS = payload.stayDurations
  if (payload.guests !== undefined) mapped.GUESTS = payload.guests
  if (payload.rooms !== undefined) mapped.ROOMS = payload.rooms
  if (payload.referenceProperty !== undefined) mapped.REFERENCE_PROPERTY = payload.referenceProperty
  if (payload.headless !== undefined) mapped.HEADLESS = payload.headless
  if (payload.browserTimeout !== undefined) mapped.BROWSER_TIMEOUT = payload.browserTimeout
  if (payload.enableArchiving !== undefined) mapped.ENABLE_ARCHIVING = payload.enableArchiving
  if (payload.maxArchiveFiles !== undefined) mapped.MAX_ARCHIVE_FILES = payload.maxArchiveFiles
  if (payload.showProgress !== undefined) mapped.SHOW_PROGRESS = payload.showProgress
  if (payload.progressInterval !== undefined) mapped.PROGRESS_INTERVAL = payload.progressInterval

  if (Object.keys(mapped).length === 0) {
    return
  }

  await runPython([CONFIG_MANAGER, "set"], {
    env: {
      CONFIG_PAYLOAD: JSON.stringify(mapped),
    },
  })
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const resolvedPath = resolveReadablePath(filePath)
    if (!resolvedPath) return fallback
    const raw = await fs.readFile(resolvedPath, "utf-8")
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

async function readRunState(): Promise<RunStateFile> {
  return readJsonFile<RunStateFile>(RUN_STATE_FILE, { status: "idle" })
}

async function writeRunState(state: RunStateFile) {
  await fs.writeFile(RUN_STATE_FILE, JSON.stringify(state, null, 2), "utf-8")
}

async function fileExists(filePath: string): Promise<boolean> {
  const candidates = [filePath]
  const fallbacks = getFallbackCandidates(filePath)
  for (const dir of fallbacks) {
    candidates.push(path.join(dir, path.basename(filePath)))
  }

  for (const candidate of candidates) {
    try {
      await fs.access(candidate)
      return true
    } catch {
      // Try next candidate
    }
  }

  return false
}

async function cleanupOldLogs(maxLogs: number = 10): Promise<void> {
  try {
    const files = await fs.readdir(LOGS_DIR)
    const logFiles = files
      .filter(f => f.startsWith("run-") && f.endsWith(".log"))
      .map(f => ({
        name: f,
        path: path.join(LOGS_DIR, f),
      }))

    if (logFiles.length <= maxLogs) return

    // Get file stats and sort by modification time
    const filesWithStats = await Promise.all(
      logFiles.map(async (f) => ({
        ...f,
        mtime: (await fs.stat(f.path)).mtime,
      }))
    )

    filesWithStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime())

    // Delete old files
    const filesToDelete = filesWithStats.slice(maxLogs)
    await Promise.all(filesToDelete.map(f => fs.unlink(f.path)))
  } catch {
    // Ignore cleanup errors
  }
}

async function tailFile(filePath: string, maxLines: number): Promise<string[] | undefined> {
  try {
    const resolvedPath = resolveReadablePath(filePath) ?? filePath
    if (!existsSync(resolvedPath)) return undefined
    const stat = await fs.stat(resolvedPath)
    if (stat.size === 0) return []
    const content = await fs.readFile(resolvedPath, "utf-8")
    const lines = content.split(/\r?\n/).filter(Boolean)
    return lines.slice(-maxLines)
  } catch {
    return undefined
  }
}

async function parseJsonToAnalysis(filePath: string): Promise<PriceWiseAnalysis | undefined> {
  try {
    const content = await fs.readFile(filePath, "utf-8")
    const data = JSON.parse(content)
    return {
      generated_at: data.generated_at || new Date().toISOString(),
      reference_property: data.reference_property || '',
      mode: data.mode || '',
      pricing_metrics: data.pricing_metrics || [],
      occupancy_metrics: data.occupancy_metrics || [],
      comparison: data.comparison || [],
      room_inventory: data.room_inventory || [],
    }
  } catch (error) {
    console.error('Error parsing JSON:', error)
    return undefined
  }
}

export async function getScraperHistory(): Promise<PriceWiseHistoryEntry[]> {
  const history = await readJsonFile<PriceWiseHistoryEntry[]>(SCRAPE_LOG, [])
  return history.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
}

export async function getDailyProgress(): Promise<PriceWiseDailyProgress | undefined> {
  if (!(await fileExists(DAILY_PROGRESS_FILE))) return undefined
  return readJsonFile<PriceWiseDailyProgress | undefined>(DAILY_PROGRESS_FILE, undefined)
}

async function readDailyPricingCsv(filePath: string): Promise<PriceWiseDailyPricingRecord[]> {
  try {
    const csvContent = await fs.readFile(filePath, "utf-8")
    const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0)

    if (lines.length < 2) return []

    const parseLine = (line: string): string[] => {
      const result: string[] = []
      let current = ""
      let inQuotes = false

      for (let i = 0; i < line.length; i += 1) {
        const char = line[i]
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"'
            i += 1
          } else {
            inQuotes = !inQuotes
          }
        } else if (char === ',' && !inQuotes) {
          result.push(current)
          current = ""
        } else {
          current += char
        }
      }

      result.push(current)
      return result.map(value => value.replace(/\r$/, ""))
    }

    const header = parseLine(lines[0])
    const headerIndex = new Map(header.map((name, index) => [name.trim(), index]))

    const getValue = (columns: string[], key: string): string => {
      const index = headerIndex.get(key)
      if (index === undefined) return ""
      return (columns[index] ?? "").trim()
    }

    const parseNumber = (columns: string[], key: string): number | null => {
      const raw = getValue(columns, key)
      if (raw === "") return null
      const value = Number(raw)
      return Number.isFinite(value) ? value : null
    }

    return lines
      .slice(1)
      .map<PriceWiseDailyPricingRecord>((line) => {
        const columns = parseLine(line)
        const totalRooms = parseNumber(columns, "total_room_types")
        const availableRooms = parseNumber(columns, "available_room_types")
        const soldRooms = parseNumber(columns, "sold_out_room_types")
        const dayOffset = parseNumber(columns, "day_offset")

        return {
          hotel_name: getValue(columns, "hotel_name"),
          check_in_date: getValue(columns, "check_in_date"),
          availability: getValue(columns, "availability"),
          total_price: parseNumber(columns, "total_price"),
          day_offset: dayOffset != null ? Math.trunc(dayOffset) : 0,
          total_room_types: totalRooms,
          available_room_types: availableRooms,
          sold_out_room_types: soldRooms,
          property_occupancy_rate: parseNumber(columns, "property_occupancy_rate"),
        }
      })
      .filter((row) => row.hotel_name && row.check_in_date)
  } catch (error) {
    console.error("Error reading daily pricing data:", error)
    return []
  }
}

export async function getDailyPricingData(): Promise<PriceWiseDailyPricingRecord[]> {
  const csvPath = resolveReadablePath(PRICING_CSV)
  if (!csvPath) return []
  return readDailyPricingCsv(csvPath)
}

export async function getScraperStatus(): Promise<PriceWiseStatusPayload> {
  await ensureOutputDirectory()
  const [runStateRaw, config, history, dailyProgress] = await Promise.all([
    readRunState(),
    getScraperConfig(),
    getScraperHistory(),
    getDailyProgress(),
  ])

  const outputs = {
    analysisJson: await fileExists(ANALYSIS_JSON),
    pricingCsv: await fileExists(PRICING_CSV),
  }

  // Try to get log from current running state, otherwise use lastRunId to find the log
  let logFilePath = runStateRaw.logFile
  if (logFilePath) {
    logFilePath = resolveReadablePath(logFilePath) ?? logFilePath
  }
  if (!logFilePath && runStateRaw.lastRunId) {
    const candidate = path.join(LOGS_DIR, `run-${runStateRaw.lastRunId}.log`)
    logFilePath = resolveReadablePath(candidate) ?? candidate
  }
  
  const logTail = logFilePath ? await tailFile(logFilePath, LOG_LINES) : undefined

  const { logFile: _logFile, ...restState } = runStateRaw
  void _logFile

  return {
    runState: restState,
    config,
    history,
    outputs,
    dailyProgress,
    logTail,
  }
}

export async function startScraperRun(): Promise<{ runId: string }> {
  await ensureOutputDirectory()
  const currentState = await readRunState()
  if (currentState.status === "running") {
    throw new Error("Scraper is already running")
  }

  const runId = randomUUID()
  const logPath = path.join(LOGS_DIR, `run-${runId}.log`)
  const logStream = createWriteStream(logPath, { flags: "a" })

  // Write initial log entry
  logStream.write(`[Runner] Starting scraper run ${runId} at ${new Date().toISOString()}\n`)

  const child = spawnPython([RUN_SCRIPT])

  if (child.stdout) {
    child.stdout.on("data", (chunk) => {
      logStream.write(chunk)
    })
  }
  
  if (child.stderr) {
    child.stderr.on("data", (chunk) => {
      logStream.write(chunk)
    })
  }

  child.on("close", (code) => {
    logStream.write(`\n[Runner] Process exited with code ${code}\n`)
    logStream.end()
    const finalState: RunStateFile = {
      status: "idle",
      lastExitCode: code ?? null,
      lastEndedAt: new Date().toISOString(),
      lastRunId: runId,
    }
    writeRunState(finalState).catch(() => {})
    // Cleanup old logs after run completes
    cleanupOldLogs(10).catch(() => {})
  })

  child.on("error", (error) => {
    logStream.write(`\n[Runner] ${error.message}\n`)
    logStream.end()
    writeRunState({
      status: "idle",
      lastExitCode: -1,
      lastEndedAt: new Date().toISOString(),
      lastRunId: runId,
      errorMessage: error.message,
    }).catch(() => {})
  })

  await writeRunState({
    status: "running",
    startedAt: new Date().toISOString(),
    runId,
    pid: child.pid,
    logFile: logPath,
  })

  return { runId }
}

export async function stopScraperRun(): Promise<void> {
  const currentState = await readRunState()
  
  if (currentState.status !== "running") {
    throw new Error("No scraper is currently running")
  }
  
  if (!currentState.pid) {
    throw new Error("No process ID found for running scraper")
  }
  
  try {
    // Try to kill the process gracefully first, then forcefully
    process.kill(currentState.pid, "SIGTERM")
    
    // Wait a bit and check if process is still alive
    await new Promise((resolve) => setTimeout(resolve, 1000))
    
    try {
      // Check if process still exists
      process.kill(currentState.pid, 0)
      // If we get here, process still exists, force kill it
      process.kill(currentState.pid, "SIGKILL")
    } catch {
      // Process already terminated
    }
    
    // Update state to reflect stopped status
    await writeRunState({
      status: "idle",
      lastExitCode: -1,
      lastEndedAt: new Date().toISOString(),
      lastRunId: currentState.runId,
      errorMessage: "Manually stopped by user",
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes("ESRCH")) {
      // Process doesn't exist anymore
      await writeRunState({
        status: "idle",
        lastExitCode: -1,
        lastEndedAt: new Date().toISOString(),
        lastRunId: currentState.runId,
      })
    } else {
      throw error
    }
  }
}

export async function runAnalyzer(): Promise<void> {
  // Check if pricing data exists
  if (!(await fileExists(PRICING_CSV))) {
    throw new Error("No pricing data available. Run the scraper first.")
  }

  // Check if scraper has completed successfully (all properties scraped)
  const dailyProgress = await getDailyProgress()
  if (dailyProgress) {
    // Load hotels configuration to check total count
    const hotelsFile = path.join(SCRAPER_ROOT, "config", "urls.json")
    const resolvedHotelsFile = resolveReadablePath(hotelsFile)
    try {
      const filePath = resolvedHotelsFile ?? hotelsFile
      const hotelsData = await fs.readFile(filePath, "utf-8")
      const hotels = JSON.parse(hotelsData)
      const totalHotels = hotels.length
      const completedCount = dailyProgress.completed_properties?.length || 0
      
      if (completedCount < totalHotels) {
        throw new Error(`Scraper incomplete: ${completedCount}/${totalHotels} properties scraped. Please wait for scraper to finish.`)
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("Scraper incomplete")) {
        throw error
      }
      // If we can't read hotels file, continue anyway
    }
  }

  // Run the analyzer script
  await runPython(["-u", ANALYZE_SCRIPT])
}

export async function isAnalysisOutdated(): Promise<boolean> {
  try {
    const [pricingExists, analysisExists] = await Promise.all([
      fileExists(PRICING_CSV),
      fileExists(ANALYSIS_JSON),
    ])

    if (!pricingExists) return false // No data to analyze
    if (!analysisExists) return false // Don't auto-refresh if no analysis exists yet

    // Check if scraper has completed all properties
    const dailyProgress = await getDailyProgress()
    if (dailyProgress) {
      const hotelsFile = path.join(SCRAPER_ROOT, "config", "urls.json")
      const resolvedHotelsFile = resolveReadablePath(hotelsFile)
      try {
        const filePath = resolvedHotelsFile ?? hotelsFile
        const hotelsData = await fs.readFile(filePath, "utf-8")
        const hotels = JSON.parse(hotelsData)
        const totalHotels = hotels.length
        const completedCount = dailyProgress.completed_properties?.length || 0
        
        if (completedCount < totalHotels) {
          // Scraper still running - don't refresh
          return false
        }
      } catch {
        // If we can't check, assume it's not safe to refresh
        return false
      }
    }

    const pricingPath = resolveReadablePath(PRICING_CSV)
    const analysisPath = resolveReadablePath(ANALYSIS_JSON)
    if (!pricingPath || !analysisPath) return false

    const [pricingStat, analysisStat] = await Promise.all([
      fs.stat(pricingPath),
      fs.stat(analysisPath),
    ])

    // Analysis is outdated if pricing data is newer AND scraper is complete
    return pricingStat.mtime > analysisStat.mtime
  } catch {
    return false
  }
}
async function listArchiveDates(): Promise<string[]> {
  try {
    const archiveDir = resolveDirectoryWithFallback(ARCHIVE_DIR, ARCHIVE_FALLBACK_DIRS)
    if (!archiveDir) return []
    const files = await fs.readdir(archiveDir)
    const dates = files
      .filter((filename) => filename.startsWith("pricing_analysis_") && filename.endsWith(".json"))
      .map((filename) => filename.replace("pricing_analysis_", "").replace(".json", ""))
      .filter(Boolean)

    const unique = Array.from(new Set(dates))
    return unique.sort((a, b) => b.localeCompare(a))
  } catch {
    return []
  }
}

async function loadSnapshotFromFiles(params: {
  id: string
  source: "current" | "archive"
  analysisPath: string
  csvPath?: string
}): Promise<PriceWiseSnapshot | undefined> {
  const resolvedAnalysisPath = resolveReadablePath(params.analysisPath)
  if (!resolvedAnalysisPath) return undefined

  const analysis = await parseJsonToAnalysis(resolvedAnalysisPath)
  if (!analysis) return undefined

  let dailyData: PriceWiseDailyPricingRecord[] = []
  if (params.csvPath) {
    const resolvedCsvPath = resolveReadablePath(params.csvPath)
    if (resolvedCsvPath) {
      dailyData = await readDailyPricingCsv(resolvedCsvPath)
    }
  }

  const generatedAt = analysis.generated_at ? String(analysis.generated_at) : null

  return {
    id: params.id,
    source: params.source,
    generatedAt,
    analysis,
    dailyData,
  }
}

export async function getPriceWiseSnapshots(limit: number = 2): Promise<PriceWiseSnapshot[]> {
  const target = Math.max(limit, 1)
  const snapshots: PriceWiseSnapshot[] = []
  const seenGeneratedAt = new Set<string>()

  const addSnapshot = (snapshot: PriceWiseSnapshot | undefined) => {
    if (!snapshot) return false
    const key = snapshot.generatedAt || snapshot.id
    if (seenGeneratedAt.has(key)) return false
    seenGeneratedAt.add(key)
    snapshots.push(snapshot)
    return snapshots.length >= target
  }

  if (addSnapshot(await loadSnapshotFromFiles({
    id: "current",
    source: "current",
    analysisPath: ANALYSIS_JSON,
    csvPath: PRICING_CSV,
  }))) {
    return snapshots
  }

  const archiveDates = await listArchiveDates()
  for (const dateStr of archiveDates) {
    const done = addSnapshot(await loadSnapshotFromFiles({
      id: `archive-${dateStr}`,
      source: "archive",
      analysisPath: path.join(ARCHIVE_DIR, `pricing_analysis_${dateStr}.json`),
      csvPath: path.join(ARCHIVE_DIR, `pricing_data_${dateStr}.csv`),
    }))
    if (done) break
  }

  if (snapshots.length === 0) {
    const fallback = await loadSnapshotFromFiles({
      id: "current",
      source: "current",
      analysisPath: ANALYSIS_JSON,
      csvPath: PRICING_CSV,
    })
    if (fallback) {
      snapshots.push(fallback)
    }
  }

  return snapshots
}

export async function getAllPriceWiseSnapshots(): Promise<PriceWiseSnapshot[]> {
  const snapshots: PriceWiseSnapshot[] = []
  const seenGeneratedAt = new Set<string>()

  const addSnapshot = (snapshot: PriceWiseSnapshot | undefined) => {
    if (!snapshot) return
    const key = snapshot.generatedAt || snapshot.id
    if (seenGeneratedAt.has(key)) return
    seenGeneratedAt.add(key)
    snapshots.push(snapshot)
  }

  // Add current snapshot
  addSnapshot(await loadSnapshotFromFiles({
    id: "current",
    source: "current",
    analysisPath: ANALYSIS_JSON,
    csvPath: PRICING_CSV,
  }))

  // Add all archive snapshots
  const archiveDates = await listArchiveDates()
  for (const dateStr of archiveDates) {
    addSnapshot(await loadSnapshotFromFiles({
      id: `archive-${dateStr}`,
      source: "archive",
      analysisPath: path.join(ARCHIVE_DIR, `pricing_analysis_${dateStr}.json`),
      csvPath: path.join(ARCHIVE_DIR, `pricing_data_${dateStr}.csv`),
    }))
  }

  return snapshots
}

export async function getScraperAnalysis(): Promise<PriceWiseAnalysis | undefined> {
  const snapshots = await getPriceWiseSnapshots(1)
  return snapshots[0]?.analysis
}

export async function getScraperReportMarkdown(): Promise<string | undefined> {
  // No longer generating or storing markdown reports
  return undefined
}

export async function getScraperFile(target: string): Promise<{ buffer: Buffer; filename: string; contentType: string } | undefined> {
  // Check if it's an archive file (format: archive-YYYYMMDD)
  if (target.startsWith("archive-")) {
    const dateStr = target.replace("archive-", "")
    const archivePath = resolveReadablePath(path.join(ARCHIVE_DIR, `pricing_data_${dateStr}.csv`))
    if (!archivePath) return undefined
    const buffer = await fs.readFile(archivePath)
    return { buffer, filename: `pricing_data_${dateStr}.csv`, contentType: "text/csv" }
  }

  const mapping: Record<string, { path: string; filename: string; contentType: string }> = {
    "pricing-csv": { path: PRICING_CSV, filename: "price-wise-raw.csv", contentType: "text/csv" },
    "analysis-json": { path: ANALYSIS_JSON, filename: "price-wise-analysis.json", contentType: "application/json" },
  }

  const info = mapping[target]
  if (!info) return undefined
  const resolvedPath = resolveReadablePath(info.path)
  if (!resolvedPath || !(await fileExists(resolvedPath))) return undefined
  const buffer = await fs.readFile(resolvedPath)
  return { buffer, filename: info.filename, contentType: info.contentType }
}
