import { randomUUID } from "crypto"
import { spawn } from "child_process"
import { createWriteStream } from "fs"
import { promises as fs } from "fs"
import path from "path"

import type {
  PriceWiseAnalysis,
  PriceWiseConfig,
  PriceWiseDailyProgress,
  PriceWiseHistoryEntry,
  PriceWiseRunState,
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
    const raw = await fs.readFile(filePath, "utf-8")
    return JSON.parse(raw) as T
  } catch (error) {
    return fallback
  }
}

async function readJsonFileTolerant<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf-8")
    const sanitized = raw.replace(/\bNaN\b/g, "null").replace(/\bInfinity\b/g, "null").replace(/\b-?Infinity\b/g, "null")
    return JSON.parse(sanitized) as T
  } catch (error) {
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
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
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
    const stat = await fs.stat(filePath)
    if (stat.size === 0) return []
    const content = await fs.readFile(filePath, "utf-8")
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
  if (!logFilePath && runStateRaw.lastRunId) {
    logFilePath = path.join(LOGS_DIR, `run-${runStateRaw.lastRunId}.log`)
  }
  
  const logTail = logFilePath ? await tailFile(logFilePath, LOG_LINES) : undefined

  const { logFile, ...restState } = runStateRaw

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
    try {
      const hotelsData = await fs.readFile(hotelsFile, "utf-8")
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
      try {
        const hotelsData = await fs.readFile(hotelsFile, "utf-8")
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

    const [pricingStat, analysisStat] = await Promise.all([
      fs.stat(PRICING_CSV),
      fs.stat(ANALYSIS_JSON),
    ])

    // Analysis is outdated if pricing data is newer AND scraper is complete
    return pricingStat.mtime > analysisStat.mtime
  } catch {
    return false
  }
}

/**
 * Get the latest successful scrape from history
 * Returns the most recent entry where scrape_success is true
 */
async function getLatestSuccessfulScrape(): Promise<PriceWiseHistoryEntry | undefined> {
  const history = await getScraperHistory()
  return history.find(entry => entry.scrape_success === true)
}

/**
 * Get the latest archive file date from the archive directory
 * Returns YYYYMMDD format or undefined if no archives exist
 */
async function getLatestArchiveDate(): Promise<string | undefined> {
  try {
    const files = await fs.readdir(ARCHIVE_DIR)
    const archiveFiles = files
      .filter(f => f.startsWith('pricing_data_') && f.endsWith('.csv'))
      .map(f => f.replace('pricing_data_', '').replace('.csv', ''))
      .sort()
      .reverse()
    
    return archiveFiles[0]
  } catch {
    return undefined
  }
}

/**
 * Parse analysis JSON from an archive file
 * This assumes the archive has a corresponding analysis JSON in the archive folder
 */
async function parseArchiveAnalysis(dateStr: string): Promise<PriceWiseAnalysis | undefined> {
  const archiveAnalysisPath = path.join(ARCHIVE_DIR, `pricing_analysis_${dateStr}.json`)
  console.log('[parseArchiveAnalysis] Looking for archive at:', archiveAnalysisPath)
  const exists = await fileExists(archiveAnalysisPath)
  console.log('[parseArchiveAnalysis] File exists:', exists)
  if (exists) {
    const result = await parseJsonToAnalysis(archiveAnalysisPath)
    console.log('[parseArchiveAnalysis] Parse result:', result ? 'Success' : 'Failed')
    return result
  }
  return undefined
}

export async function getScraperAnalysis(): Promise<PriceWiseAnalysis | undefined> {
  // Get scrape history
  const history = await getScraperHistory()
  const latestEntry = history[0] // Already sorted by timestamp descending
  
  console.log('[getScraperAnalysis] Latest entry:', latestEntry)
  
  // Strategy: Always try to find the latest successful analysis, whether it's current or archived
  
  // 1. If latest scrape was fully successful AND current analysis exists and valid, use it
  if (latestEntry?.scrape_success && latestEntry?.analysis_success) {
    console.log('[getScraperAnalysis] Latest scrape was successful, checking for analysis file...')
    if (await fileExists(ANALYSIS_JSON)) {
      console.log('[getScraperAnalysis] Analysis file exists, attempting to parse...')
      const currentAnalysis = await parseJsonToAnalysis(ANALYSIS_JSON)
      if (currentAnalysis) {
        console.log('[getScraperAnalysis] Successfully parsed current analysis, returning it')
        return currentAnalysis
      }
      console.log('[getScraperAnalysis] Current analysis file is corrupted/empty, will try archive')
    }
  }
  
  // 2. Find the latest successful scrape from history (could be current or past)
  console.log('[getScraperAnalysis] Looking for latest successful scrape...')
  const latestSuccessful = history.find(entry => entry.scrape_success && entry.analysis_success)
  
  if (!latestSuccessful) {
    console.log('[getScraperAnalysis] No successful scrapes found in history')
    return undefined
  }
  
  console.log('[getScraperAnalysis] Latest successful scrape:', latestSuccessful.timestamp)
  
  // 3. Look for archive analysis matching this successful scrape
  const scrapeDate = new Date(latestSuccessful.timestamp)
  const dateStr = scrapeDate.toISOString().split('T')[0].replace(/-/g, '') // YYYYMMDD
  
  console.log('[getScraperAnalysis] Looking for archive with date:', dateStr)
  
  // Check archive for this date
  const archiveAnalysis = await parseArchiveAnalysis(dateStr)
  if (archiveAnalysis) {
    console.log('[getScraperAnalysis] Found archive analysis for date:', dateStr)
    return archiveAnalysis
  }
  
  console.log('[getScraperAnalysis] No archive found for date:', dateStr)
  
  // 4. Last resort: try the most recent archive file
  console.log('[getScraperAnalysis] Trying most recent archive as last resort...')
  const latestArchiveDate = await getLatestArchiveDate()
  if (latestArchiveDate) {
    console.log('[getScraperAnalysis] Latest archive date:', latestArchiveDate)
    const finalArchiveAnalysis = await parseArchiveAnalysis(latestArchiveDate)
    if (finalArchiveAnalysis) {
      console.log('[getScraperAnalysis] Returning latest archive analysis')
      return finalArchiveAnalysis
    }
  }
  
  console.log('[getScraperAnalysis] No analysis available')
  return undefined
}

export async function getScraperReportMarkdown(): Promise<string | undefined> {
  // No longer generating or storing markdown reports
  return undefined
}

export async function getScraperFile(target: string): Promise<{ buffer: Buffer; filename: string; contentType: string } | undefined> {
  // Check if it's an archive file (format: archive-YYYYMMDD)
  if (target.startsWith("archive-")) {
    const dateStr = target.replace("archive-", "")
    const archivePath = path.join(ARCHIVE_DIR, `pricing_data_${dateStr}.csv`)
    if (!(await fileExists(archivePath))) return undefined
    const buffer = await fs.readFile(archivePath)
    return { buffer, filename: `pricing_data_${dateStr}.csv`, contentType: "text/csv" }
  }

  const mapping: Record<string, { path: string; filename: string; contentType: string }> = {
    "pricing-csv": { path: PRICING_CSV, filename: "price-wise-raw.csv", contentType: "text/csv" },
    "analysis-json": { path: ANALYSIS_JSON, filename: "price-wise-analysis.json", contentType: "application/json" },
  }

  const info = mapping[target]
  if (!info) return undefined
  if (!(await fileExists(info.path))) return undefined
  const buffer = await fs.readFile(info.path)
  return { buffer, filename: info.filename, contentType: info.contentType }
}
