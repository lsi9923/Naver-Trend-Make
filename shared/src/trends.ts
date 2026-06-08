export type TrendTimeUnit = "date" | "week" | "month";
export type TrendDeviceCode = "pc" | "mo";
export type TrendGenderCode = "f" | "m";
export type TrendAgeCode = "10" | "20" | "30" | "40" | "50" | "60";
export type TrendResultCount = 20 | 40;

export type TrendProfileStatus = "active" | "paused";
export type TrendCollectionRunStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export type TrendCollectionTaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled";
export type TrendCollectionTaskSource = "cache" | "naver";
export type TrendSyncStatus = "idle" | "syncing" | "synced" | "failed";

export interface TrendCategoryNode {
  cid: number;
  name: string;
  fullPath: string;
  level: number;
  leaf: boolean;
}

export interface TrendProfileInput {
  name: string;
  categoryCid: number;
  categoryPath: string;
  categoryDepth: number;
  timeUnit: TrendTimeUnit;
  devices: TrendDeviceCode[];
  genders: TrendGenderCode[];
  ages: TrendAgeCode[];
  spreadsheetId: string;
  resultCount?: TrendResultCount;
  excludeBrandProducts?: boolean;
  customExcludedTerms?: string[];
  forceRefresh?: boolean;
}

export interface TrendProfile extends TrendProfileInput {
  id: string;
  slug: string;
  status: TrendProfileStatus;
  startPeriod: string;
  endPeriod: string;
  lastCollectedPeriod?: string;
  lastSyncedAt?: string;
  syncStatus: TrendSyncStatus;
  latestRunId?: string;
  resultCount: TrendResultCount;
  excludeBrandProducts: boolean;
  customExcludedTerms: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TrendCollectionTask {
  id: string;
  runId: string;
  profileId: string;
  period: string;
  status: TrendCollectionTaskStatus;
  completedPages: number;
  totalPages: number;
  retryCount: number;
  source?: TrendCollectionTaskSource;
  startedAt?: string;
  completedAt?: string;
  failureReason?: string;
  failureSnippet?: string;
  updatedAt: string;
}

export interface TrendCollectionRun {
  id: string;
  profileId: string;
  status: TrendCollectionRunStatus;
  requestedBy: string;
  runType: "backfill";
  startPeriod: string;
  endPeriod: string;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  totalSnapshots: number;
  sheetUrl?: string;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TrendKeywordSnapshot {
  id: string;
  profileId: string;
  runId: string;
  taskId: string;
  period: string;
  rank: number;
  keyword: string;
  linkId: string;
  categoryCid: number;
  categoryPath: string;
  devices: TrendDeviceCode[];
  genders: TrendGenderCode[];
  ages: TrendAgeCode[];
  brandExcluded?: boolean;
  collectedAt: string;
}

export type TrendAnalysisCardKind =
  | "steady"
  | "seasonal"
  | "monthly"
  | "event"
  | "caution"
  | "recent";

export interface TrendAnalysisSeriesPoint {
  period: string;
  value: number;
}

export interface TrendAnalysisKeyword {
  keyword: string;
  confidence: number;
  confidenceLabel: "high" | "medium" | "low";
  rationale: string;
  latestScore: number;
  delta: number;
  momentum: number;
  seasonalIndex: number;
  appearanceCount: number;
  recommendedPeriods: string[];
  recommendedMonths: string[];
  cautionMonths: string[];
  sparkline: TrendAnalysisSeriesPoint[];
}

export interface TrendAnalysisCard {
  kind: TrendAnalysisCardKind;
  title: string;
  description: string;
  items: TrendAnalysisKeyword[];
}

export interface TrendAnalysisOverviewLine {
  keyword: string;
  confidence: number;
  points: TrendAnalysisSeriesPoint[];
}

export interface TrendMonthlyPreparationBucket {
  month: string;
  label: string;
  seasonLabel: string;
  items: TrendAnalysisKeyword[];
}

export interface TrendAnalysisHeroMetric {
  id: string;
  label: string;
  keyword: string;
  confidence: number;
  confidenceLabel: "high" | "medium" | "low";
  rationale: string;
  monthLabel?: string;
  sparkline: TrendAnalysisSeriesPoint[];
}

export interface TrendAnalysisHeatmapCell {
  key: string;
  label: string;
  value: number;
}

export interface TrendAnalysisHeatmapRow {
  keyword: string;
  confidence: number;
  confidenceLabel: "high" | "medium" | "low";
  rationale: string;
  seasonRationale: string;
  timelineRationale: string;
  recommendedMonths: string[];
  cautionMonths: string[];
  periodCells: TrendAnalysisHeatmapCell[];
  seasonCells: TrendAnalysisHeatmapCell[];
  timelineStats: {
    appearanceCount: number;
    peakWindowLabel: string;
    recentDelta: number;
  };
}

export interface TrendMonthlyExplorer {
  month: string;
  label: string;
  seasonLabel: string;
  monthConfidence: number;
  recommendedKeywords: TrendAnalysisKeyword[];
  cautionKeywords: TrendAnalysisKeyword[];
  historicalMonthScores: TrendAnalysisSeriesPoint[];
}

export interface TrendKeywordDrilldownSeries {
  keyword: string;
  confidence: number;
  confidenceLabel: "high" | "medium" | "low";
  rationale: string;
  observationMonths: number;
  recentTrendValue: number;
  seasonalityScore: number;
  seasonalityScoreLabel: "high" | "medium" | "low";
  recentRetentionValue: number;
  recentTrendExplanation: string;
  seasonalityExplanation: string;
  recentRetentionExplanation: string;
  recommendedMonths: string[];
  cautionMonths: string[];
  points: TrendAnalysisSeriesPoint[];
  recentPoints: TrendAnalysisSeriesPoint[];
  seasonalityPoints: TrendAnalysisSeriesPoint[];
}

export interface TrendAnalysisSummary {
  resultCount: TrendResultCount;
  includedKeywordCount: number;
  excludedKeywordCount: number;
  observedMonths: number;
  overviewSeries: TrendAnalysisOverviewLine[];
  monthlyPreparation: TrendMonthlyPreparationBucket[];
  highlights: string[];
  heroMetrics: TrendAnalysisHeroMetric[];
  seasonalityHeatmap: TrendAnalysisHeatmapRow[];
  monthlyPlanner: TrendMonthlyExplorer[];
  cautionByMonth: TrendMonthlyPreparationBucket[];
  keywordDrilldownSeries: TrendKeywordDrilldownSeries[];
}

export interface TrendRunDetail extends TrendCollectionRun {
  profile: TrendProfile;
  tasks: TrendCollectionTask[];
  snapshotsPreview: TrendKeywordSnapshot[];
  currentPeriod?: string;
  currentPage?: number;
  latestCompletedPeriod?: string;
  remainingTasks: number;
  cacheCompletedTasks?: number;
  naverCompletedTasks?: number;
  processingMode?: "idle" | "cache" | "naver" | "reused-report";
  averageTaskSeconds?: number;
  etaMinutes?: number;
  estimatedCompletionAt?: string;
  canCancel: boolean;
  canDelete: boolean;
  analysisReady: boolean;
  confidenceScore?: number;
  analysisSummary?: TrendAnalysisSummary;
  analysisCards: TrendAnalysisCard[];
}

export interface TrendAdminMetric {
  id: string;
  label: string;
  value: string;
  hint: string;
  tone: "stable" | "attention" | "progress";
}

export interface TrendAdminBoard {
  generatedAt: string;
  metrics: TrendAdminMetric[];
  profiles: TrendProfile[];
  runs: TrendRunDetail[];
}

export interface TrendSheetTabPayload {
  title: string;
  rows: string[][];
}

export const TREND_MONTHLY_START_PERIOD = "2021-01";
export const TREND_TIMEZONE = "Asia/Seoul";
export const TREND_DEFAULT_RESULT_COUNT: TrendResultCount = 20;
export const TREND_RESULT_COUNT_OPTIONS: TrendResultCount[] = [20, 40];
export const TREND_MAX_RANK = 40;
export const TREND_PAGE_SIZE = 20;
export const TREND_TOTAL_PAGES = Math.ceil(TREND_MAX_RANK / TREND_PAGE_SIZE);
export const TREND_DEVICE_OPTIONS: TrendDeviceCode[] = ["pc", "mo"];
export const TREND_GENDER_OPTIONS: TrendGenderCode[] = ["f", "m"];
export const TREND_AGE_OPTIONS: TrendAgeCode[] = ["10", "20", "30", "40", "50", "60"];

export function getLatestCollectibleTrendPeriod(date = new Date(), timeZone = TREND_TIMEZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit"
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value ?? "1970");
  const month = Number(parts.find((part) => part.type === "month")?.value ?? "01");
  let targetYear = year;
  let targetMonth = month - 1;

  if (targetMonth === 0) {
    targetYear -= 1;
    targetMonth = 12;
  }

  return `${targetYear}-${String(targetMonth).padStart(2, "0")}`;
}

export const TREND_MONTHLY_END_PERIOD = getLatestCollectibleTrendPeriod();

export function normalizeTrendResultCount(value?: number): TrendResultCount {
  return value === 40 ? 40 : 20;
}

export function getTrendTotalPages(resultCount: TrendResultCount = TREND_DEFAULT_RESULT_COUNT) {
  return Math.max(1, Math.ceil(resultCount / TREND_PAGE_SIZE));
}

export function normalizeExcludedTerms(values: string[] = []) {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => value.toLowerCase())
    )
  ).sort((left, right) => left.localeCompare(right, "ko"));
}

export function splitTrendExcludedTermsInput(value = "") {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeTrendExcludedTermsForMode(excludeBrandProducts?: boolean, values: string[] = []) {
  return excludeBrandProducts ? normalizeExcludedTerms(values) : [];
}

export interface TrendCollectionSettingsSnapshot {
  devices: TrendDeviceCode[];
  genders: TrendGenderCode[];
  ages: TrendAgeCode[];
  resultCount: TrendResultCount;
  excludeBrandProducts: boolean;
  customExcludedTerms: string[];
  spreadsheetId: string;
}

export interface TrendCollectionSettingsInput {
  devices?: TrendDeviceCode[];
  genders?: TrendGenderCode[];
  ages?: TrendAgeCode[];
  resultCount?: TrendResultCount;
  excludeBrandProducts?: boolean;
  customExcludedTerms?: string[];
  customExcludedTermsInput?: string;
  spreadsheetId?: string;
}

export interface TrendAutoCollectionRunRef {
  id: string;
  status: TrendCollectionRunStatus;
}

export type TrendAutoCollectionResultStatus = "completed" | "failed" | "cancelled" | "stopped";

export interface TrendAutoCollectionItemResult {
  category: TrendCategoryNode;
  status: TrendAutoCollectionResultStatus;
  run?: TrendAutoCollectionRunRef;
  message?: string;
}

export interface TrendAutoCollectionSummary {
  status: "completed" | "stopped";
  totalCount: number;
  completedCount: number;
  failedCount: number;
  cancelledCount: number;
  results: TrendAutoCollectionItemResult[];
}

export interface TrendAutoCollectionRetryEvent {
  category: TrendCategoryNode;
  index: number;
  attempt: number;
  maxAttempts: number;
  message?: string;
  nextDelayMs: number;
}

export function createTrendCollectionSettingsSnapshot(input: TrendCollectionSettingsInput = {}): TrendCollectionSettingsSnapshot {
  const excludeBrandProducts = Boolean(input.excludeBrandProducts);
  const rawExcludedTerms = input.customExcludedTermsInput
    ? splitTrendExcludedTermsInput(input.customExcludedTermsInput)
    : input.customExcludedTerms ?? [];

  return {
    devices: [...(input.devices ?? [])],
    genders: [...(input.genders ?? [])],
    ages: [...(input.ages ?? [])],
    resultCount: normalizeTrendResultCount(input.resultCount),
    excludeBrandProducts,
    customExcludedTerms: normalizeTrendExcludedTermsForMode(excludeBrandProducts, rawExcludedTerms),
    spreadsheetId: normalizeTrendSpreadsheetId(input.spreadsheetId ?? "")
  };
}

export function buildTrendCollectionInputForCategory(
  category: TrendCategoryNode,
  settings: TrendCollectionSettingsSnapshot,
  name: string
): TrendProfileInput {
  return {
    name,
    categoryCid: category.cid,
    categoryPath: category.fullPath,
    categoryDepth: category.level,
    timeUnit: "month",
    devices: [...settings.devices],
    genders: [...settings.genders],
    ages: [...settings.ages],
    spreadsheetId: settings.spreadsheetId,
    resultCount: settings.resultCount,
    excludeBrandProducts: settings.excludeBrandProducts,
    customExcludedTerms: [...settings.customExcludedTerms]
  };
}

export async function buildTrendAutoCollectionQueue(
  rootCategory: TrendCategoryNode,
  loadChildren: (cid: number) => Promise<TrendCategoryNode[]>
) {
  const leaves: TrendCategoryNode[] = [];
  const visited = new Set<number>();

  await appendTrendAutoCollectionLeaves(rootCategory, loadChildren, leaves, visited);
  return leaves;
}

export async function buildTrendAutoCollectionQueueForRoots(
  rootCategories: TrendCategoryNode[],
  loadChildren: (cid: number) => Promise<TrendCategoryNode[]>
) {
  const leaves: TrendCategoryNode[] = [];
  const visited = new Set<number>();

  for (const rootCategory of rootCategories) {
    await appendTrendAutoCollectionLeaves(rootCategory, loadChildren, leaves, visited);
  }

  return leaves;
}

async function appendTrendAutoCollectionLeaves(
  category: TrendCategoryNode,
  loadChildren: (cid: number) => Promise<TrendCategoryNode[]>,
  leaves: TrendCategoryNode[],
  visited: Set<number>
) {
  if (visited.has(category.cid)) {
    return;
  }
  visited.add(category.cid);

  if (category.leaf) {
    leaves.push(category);
    return;
  }

  const children = await loadChildren(category.cid);
  if (!children.length) {
    leaves.push(category);
    return;
  }

  for (const child of children) {
    await appendTrendAutoCollectionLeaves(child, loadChildren, leaves, visited);
  }
}

export async function runTrendAutoCollectionQueue(input: {
  categories: TrendCategoryNode[];
  settings: TrendCollectionSettingsSnapshot;
  collect: (
    payload: TrendProfileInput,
    category: TrendCategoryNode,
    index: number
  ) => Promise<
    | { ok: true; run: TrendAutoCollectionRunRef }
    | { ok: false; code?: string; message?: string }
  >;
  waitForRun?: (
    run: TrendAutoCollectionRunRef,
    category: TrendCategoryNode,
    index: number
  ) => Promise<TrendAutoCollectionRunRef>;
  onResult?: (result: TrendAutoCollectionItemResult, summary: TrendAutoCollectionSummary) => void | Promise<void>;
  onRetry?: (event: TrendAutoCollectionRetryEvent) => void | Promise<void>;
  shouldRetryCollectFailure?: (
    failure: { ok: false; code?: string; message?: string },
    category: TrendCategoryNode,
    index: number,
    attempt: number
  ) => boolean;
  shouldStop?: () => boolean;
  buildName?: (category: TrendCategoryNode, index: number) => string;
  stopOnFirstFailure?: boolean;
  maxAttemptsPerCategory?: number;
  retryDelayMs?: number;
}) {
  const results: TrendAutoCollectionItemResult[] = [];
  const maxAttemptsPerCategory = Math.max(1, Math.floor(Number(input.maxAttemptsPerCategory ?? 1) || 1));
  const retryDelayMs = Math.max(0, Math.floor(Number(input.retryDelayMs ?? 0) || 0));

  for (let index = 0; index < input.categories.length; index += 1) {
    const category = input.categories[index];

    if (input.shouldStop?.()) {
      break;
    }

    const payload = buildTrendCollectionInputForCategory(
      category,
      input.settings,
      input.buildName?.(category, index) ?? category.fullPath
    );
    let collected: Awaited<ReturnType<typeof input.collect>> | null = null;

    for (let attempt = 1; attempt <= maxAttemptsPerCategory; attempt += 1) {
      collected = await input.collect(payload, category, index);

      const shouldRetry =
        !collected.ok && (input.shouldRetryCollectFailure?.(collected, category, index, attempt) ?? true);

      if (collected.ok || !shouldRetry || attempt >= maxAttemptsPerCategory || input.shouldStop?.()) {
        break;
      }

      await input.onRetry?.({
        category,
        index,
        attempt,
        maxAttempts: maxAttemptsPerCategory,
        message: collected.message,
        nextDelayMs: retryDelayMs
      });

      if (retryDelayMs > 0) {
        await sleepTrendAutoCollectionRetry(retryDelayMs);
      }
    }

    if (!collected?.ok) {
      const result: TrendAutoCollectionItemResult = {
        category,
        status: "failed",
        message: collected?.message
      };
      results.push(result);
      await input.onResult?.(result, summarizeTrendAutoCollection(input.categories.length, results, input.shouldStop?.()));
      if (input.stopOnFirstFailure) {
        break;
      }
      continue;
    }

    const run =
      input.waitForRun && (collected.run.status === "queued" || collected.run.status === "running")
        ? await input.waitForRun(collected.run, category, index)
        : collected.run;

    const result: TrendAutoCollectionItemResult = {
      category,
      status: run.status === "cancelled" ? "cancelled" : run.status === "failed" ? "failed" : "completed",
      run
    };
    results.push(result);
    await input.onResult?.(result, summarizeTrendAutoCollection(input.categories.length, results, input.shouldStop?.()));
  }

  return summarizeTrendAutoCollection(input.categories.length, results, input.shouldStop?.());
}

function sleepTrendAutoCollectionRetry(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function summarizeTrendAutoCollection(
  totalCount: number,
  results: TrendAutoCollectionItemResult[],
  stopped?: boolean
): TrendAutoCollectionSummary {
  return {
    status: results.length < totalCount || stopped ? "stopped" : "completed",
    totalCount,
    completedCount: results.filter((result) => result.status === "completed").length,
    failedCount: results.filter((result) => result.status === "failed").length,
    cancelledCount: results.filter((result) => result.status === "cancelled").length,
    results
  };
}

export async function stopTrendAutoCollectionRun(
  activeRunId: string | null | undefined,
  cancelRun: (runId: string) => Promise<unknown>
) {
  if (!activeRunId) {
    return {
      cancelRequested: false as const
    };
  }

  await cancelRun(activeRunId);
  return {
    cancelRequested: true as const,
    runId: activeRunId
  };
}

export function listMonthlyPeriods(startPeriod = TREND_MONTHLY_START_PERIOD, endPeriod = getLatestCollectibleTrendPeriod()) {
  const periods: string[] = [];
  const [startYear, startMonth] = startPeriod.split("-").map((value) => Number(value));
  const [endYear, endMonth] = endPeriod.split("-").map((value) => Number(value));

  let year = startYear;
  let month = startMonth;

  while (year < endYear || (year === endYear && month <= endMonth)) {
    periods.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;

    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return periods;
}

export function serializeTrendFilter<T extends string>(values: T[]) {
  return values.join(",");
}

export function formatTrendMatrixPeriod(period: string) {
  return period;
}

export function normalizeTrendSpreadsheetId(spreadsheetId: string) {
  const trimmed = spreadsheetId.trim();
  if (!trimmed) {
    return "";
  }

  const pathMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (pathMatch?.[1]) {
    return pathMatch[1];
  }

  const queryMatch = trimmed.match(/[?&]id=([a-zA-Z0-9-_]+)/);
  if (queryMatch?.[1]) {
    return queryMatch[1];
  }

  return trimmed;
}

export function buildTrendSheetUrl(spreadsheetId: string) {
  return `https://docs.google.com/spreadsheets/d/${normalizeTrendSpreadsheetId(spreadsheetId)}`;
}
