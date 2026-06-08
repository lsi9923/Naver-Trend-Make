"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  CircleHelp,
  Cloud,
  Clock3,
  ExternalLink,
  Flame,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  LoaderCircle,
  PlugZap,
  Search,
  Settings2,
  ShieldAlert,
  Sparkles,
  Target,
  Trash2
} from "lucide-react";
import {
  TREND_MONTHLY_START_PERIOD,
  TREND_RESULT_COUNT_OPTIONS,
  buildTrendAutoCollectionQueue,
  buildTrendAutoCollectionQueueForRoots,
  buildTrendCollectionInputForCategory,
  createTrendCollectionSettingsSnapshot,
  getLatestCollectibleTrendPeriod,
  getTrendTotalPages,
  listMonthlyPeriods,
  normalizeTrendExcludedTermsForMode,
  runTrendAutoCollectionQueue,
  sliceTrendAutoCollectionQueueFromCategory,
  splitTrendExcludedTermsInput,
  stopTrendAutoCollectionRun,
  type TrendAdminBoard,
  type TrendAgeCode,
  type TrendAnalysisCard,
  type TrendAnalysisHeatmapRow,
  type TrendAnalysisHeroMetric,
  type TrendAnalysisKeyword,
  type TrendAnalysisSeriesPoint,
  type TrendCategoryNode,
  type TrendCollectionSettingsSnapshot,
  type TrendDeviceCode,
  type TrendGenderCode,
  type TrendKeywordDrilldownSeries,
  type TrendKeywordSnapshot,
  type TrendMonthlyExplorer,
  type TrendProfileInput,
  type TrendResultCount,
  type TrendRunDetail
} from "@runacademy/shared";
import { STATIC_TREND_ROOT_CATEGORIES, getStaticTrendCategoryChildren } from "../../../lib/trend-category-fallback";
import styles from "./admin.module.css";

const ENV_API_BASE_URL = normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL ?? "");
const API_BASE_STORAGE_KEY = "hanirum:naver-trend-api-base-url";
const AUTO_COLLECTION_POLL_MS = 1500;
const AUTO_COLLECTION_HEARTBEAT_MS = 5000;
const AUTO_COLLECTION_API_RETRY_ATTEMPTS = 60;
const AUTO_COLLECTION_API_RETRY_DELAY_MS = 3000;

const DEVICE_OPTIONS = [
  ["pc", "PC"],
  ["mo", "모바일"]
] as const;

const GENDER_OPTIONS = [
  ["f", "여성"],
  ["m", "남성"]
] as const;

const AGE_OPTIONS = [
  ["10", "10대"],
  ["20", "20대"],
  ["30", "30대"],
  ["40", "40대"],
  ["50", "50대"],
  ["60", "60대 이상"]
] as const;

type ApiError = {
  ok: false;
  code?: string;
  message?: string;
};

type TrendBoardResponse = ApiError | { ok: true; board: TrendAdminBoard };
type TrendCategoryResponse = ApiError | { ok: true; nodes: TrendCategoryNode[] };
type TrendCollectResponse = ApiError | { ok: true; run: TrendRunDetail; reusedCachedResult?: boolean };
type BestProductCollectResponse =
  | ApiError
  | {
      ok: true;
      collectionStatus: "collected" | "failed" | "empty";
      message?: string;
      items?: Array<{ status: string; categoryName: string; title: string; failureReason?: string }>;
    };
type BestProductStatusResponse =
  | ApiError
  | {
      ok: true;
      ready: boolean;
      credentialStatus: "configured" | "missing" | "trend-analysis-ready";
      source: string;
      outputFileName: string;
      requiredEnvVars: string[];
      aliasEnvVars: string[];
    };
type TrendRunActionResponse = ApiError | { ok: true; run?: TrendRunDetail; deletedRunId?: string };
type TrendRunRetryResponse = ApiError | { ok: true; run: TrendRunDetail };
type TrendRunResponse = ApiError | { ok: true; run: TrendRunDetail };
type TrendRunSettleResult = TrendRunDetail | Pick<TrendRunDetail, "id" | "status">;
type TrendSnapshotPageResponse =
  | ApiError
  | {
      ok: true;
      period: string;
      page: number;
      totalPages: number;
      totalItems: number;
      items: TrendKeywordSnapshot[];
    };

type TrendFormState = {
  category1: string;
  category2: string;
  category3: string;
  devices: TrendDeviceCode[];
  genders: TrendGenderCode[];
  ages: TrendAgeCode[];
  resultCount: TrendResultCount;
  excludeBrandProducts: boolean;
  customExcludedTerms: string;
};

type SnapshotPanelState = {
  period: string;
  page: number;
  totalPages: number;
  totalItems: number;
  items: TrendKeywordSnapshot[];
  loading: boolean;
  error: string | null;
};

type BuilderFeedback = {
  tone: "info" | "success" | "error";
  text: string;
};

type BestProductStatusState = {
  ready: boolean;
  credentialStatus: "configured" | "missing" | "trend-analysis-ready" | "unknown";
  outputFileName: string;
  message: string;
};

type ActionModalState =
  | {
      type: "cancel" | "delete";
      run: TrendRunDetail;
    }
  | null;

type SetupPanel = "settings" | "guide" | null;
type AutoCollectionStartMode = "selected-scope" | "resume-from-selected";

type AutoCollectionState = {
  status: "idle" | "preparing" | "running" | "stopping" | "stopped" | "completed" | "failed";
  queue: TrendCategoryNode[];
  currentIndex: number;
  completedCount: number;
  failedCount: number;
  cancelledCount: number;
  activeRunId: string | null;
  rootPath: string | null;
  message: string;
  settingsPills: string[];
};

const initialForm: TrendFormState = {
  category1: "",
  category2: "",
  category3: "",
  devices: [],
  genders: [],
  ages: [],
  resultCount: 20,
  excludeBrandProducts: false,
  customExcludedTerms: ""
};

const initialAutoCollectionState: AutoCollectionState = {
  status: "idle",
  queue: [],
  currentIndex: -1,
  completedCount: 0,
  failedCount: 0,
  cancelledCount: 0,
  activeRunId: null,
  rootPath: null,
  message: "자동 순회를 시작하면 선택 카테고리의 하위 카테고리를 순서대로 취합합니다.",
  settingsPills: []
};

const initialBestProductStatus: BestProductStatusState = {
  ready: false,
  credentialStatus: "unknown",
  outputFileName: "Naver Trend Maker 10 베스트상품.xlsx",
  message: "트렌드 분석 누적 상태를 확인하는 중입니다."
};

export default function SourcingAdminPage() {
  const [apiBaseUrl, setApiBaseUrl] = useState(() => getInitialApiBaseUrl());
  const [apiBaseUrlDraft, setApiBaseUrlDraft] = useState(() => getInitialApiBaseUrl());
  const [activeSetupPanel, setActiveSetupPanel] = useState<SetupPanel>(() => (getInitialApiBaseUrl() ? null : "settings"));
  const [trendBoard, setTrendBoard] = useState<TrendAdminBoard | null>(null);
  const [currentRun, setCurrentRun] = useState<TrendRunDetail | null>(null);
  const [level1Categories, setLevel1Categories] = useState<TrendCategoryNode[]>([]);
  const [level2Categories, setLevel2Categories] = useState<TrendCategoryNode[]>([]);
  const [level3Categories, setLevel3Categories] = useState<TrendCategoryNode[]>([]);
  const [form, setForm] = useState<TrendFormState>(initialForm);
  const [autoCollection, setAutoCollection] = useState<AutoCollectionState>(initialAutoCollectionState);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [retrySubmitting, setRetrySubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<BuilderFeedback | null>(null);
  const [bestProductStatus, setBestProductStatus] = useState<BestProductStatusState>(initialBestProductStatus);
  const [snapshotPanel, setSnapshotPanel] = useState<SnapshotPanelState | null>(null);
  const [actionModal, setActionModal] = useState<ActionModalState>(null);
  const [selectedPlannerMonth, setSelectedPlannerMonth] = useState("01");
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);
  const [heatmapMode, setHeatmapMode] = useState<"timeline" | "season">("season");
  const [detailLoadingRunId, setDetailLoadingRunId] = useState<string | null>(null);
  const drilldownRef = useRef<HTMLElement | null>(null);
  const autoStopRequestedRef = useRef(false);
  const autoActiveRunIdRef = useRef<string | null>(null);
  const autoExitCancelSentRef = useRef(false);

  const latestCollectiblePeriod = getLatestCollectibleTrendPeriod();
  const analysisPeriods = listMonthlyPeriods(TREND_MONTHLY_START_PERIOD, latestCollectiblePeriod);
  const selectedCategory = useMemo(() => {
    return (
      level3Categories.find((item) => String(item.cid) === form.category3) ??
      level2Categories.find((item) => String(item.cid) === form.category2) ??
      level1Categories.find((item) => String(item.cid) === form.category1) ??
      null
    );
  }, [form.category1, form.category2, form.category3, level1Categories, level2Categories, level3Categories]);

  const apiConfigured = Boolean(apiBaseUrl);
  const apiSourceLabel = apiBaseUrl
    ? apiBaseUrl === ENV_API_BASE_URL
      ? "환경변수 연결"
      : "브라우저 설정 연결"
    : "연결 필요";
  const visibleRun = currentRun ?? trendBoard?.runs[0] ?? null;
  const completedRuns = (trendBoard?.runs ?? []).filter((run) => run.status === "completed" && run.analysisReady);
  const summaryPeriodLabel = `${TREND_MONTHLY_START_PERIOD} ~ ${latestCollectiblePeriod}`;
  const estimatedSecondsPerMonth = form.resultCount === 40 ? 11 : 6;
  const estimatedLeadMinutes = Math.max(1, Math.ceil((analysisPeriods.length * estimatedSecondsPerMonth) / 60));
  const pollingActive = visibleRun?.status === "running" || visibleRun?.status === "queued";
  const autoCollectionActive = autoCollection.status === "preparing" || autoCollection.status === "running" || autoCollection.status === "stopping";
  const autoCollectionTotal = autoCollection.queue.length;
  const autoCollectionHandled = autoCollection.completedCount + autoCollection.failedCount + autoCollection.cancelledCount;
  const autoCollectionCurrentCategory =
    autoCollection.currentIndex >= 0 ? autoCollection.queue[autoCollection.currentIndex] ?? null : null;
  const refreshTitle = pollingActive ? "자동으로 최신 상태를 확인하고 있습니다." : "데이터 취합 상태 연결이 안정적으로 유지되고 있습니다.";
  const refreshHint = refreshing
    ? "새 수집 상태를 가져오는 중입니다."
    : trendBoard?.generatedAt
      ? `마지막 확인 ${formatDateTime(trendBoard.generatedAt)}`
      : "첫 데이터를 기다리는 중입니다.";

  useEffect(() => {
    if (ENV_API_BASE_URL) {
      return;
    }

    const storedUrl = normalizeApiBaseUrl(window.localStorage.getItem(API_BASE_STORAGE_KEY) ?? "");

    if (!storedUrl) {
      return;
    }

    setApiBaseUrl(storedUrl);
    setApiBaseUrlDraft(storedUrl);
    setActiveSetupPanel(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadInitial() {
      setLoading(true);

      if (!apiBaseUrl) {
        setTrendBoard(null);
        setCurrentRun(null);
        setLevel1Categories(STATIC_TREND_ROOT_CATEGORIES);
        setError(null);
        setLoading(false);
        return;
      }

      const [boardResponse, categories] = await Promise.all([
        api<TrendBoardResponse>(apiBaseUrl, "/trends/admin/board"),
        fetchTrendCategories(apiBaseUrl, "0")
      ]);

      if (cancelled) {
        return;
      }

      if (boardResponse.ok) {
        setTrendBoard(boardResponse.board);
        setCurrentRun(pickDefaultVisibleRun(boardResponse.board.runs));
      } else {
        setError(boardResponse.message ?? "데이터 취합 상태를 불러오지 못했습니다.");
      }

      setLevel1Categories(categories);
      setLoading(false);
    }

    void loadInitial();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!trendBoard?.runs.length) {
      return;
    }

    setCurrentRun((previous) => {
      if (!previous) {
        return pickDefaultVisibleRun(trendBoard.runs);
      }

      const matched = trendBoard.runs.find((run) => run.id === previous.id);
      return matched ? mergeRunDetail(previous, matched) : pickDefaultVisibleRun(trendBoard.runs);
    });
  }, [trendBoard]);

  useEffect(() => {
    if (!apiBaseUrl) {
      setBestProductStatus({
        ...initialBestProductStatus,
        credentialStatus: "unknown",
        message: "API 연결 후 베스트상품 수집 상태를 확인합니다."
      });
      return;
    }

    const interval = window.setInterval(() => {
      void refreshBoard(apiBaseUrl, setTrendBoard, setCurrentRun, setRefreshing, setError);
    }, visibleRun?.status === "running" || visibleRun?.status === "queued" ? 5000 : 12000);

    return () => window.clearInterval(interval);
  }, [apiBaseUrl, visibleRun?.status]);

  useEffect(() => {
    if (!apiBaseUrl) {
      return;
    }

    void refreshBestProductStatus(apiBaseUrl, setBestProductStatus);
  }, [apiBaseUrl]);

  useEffect(() => {
    function requestAutoCollectionExitCancel() {
      const activeRunId = autoActiveRunIdRef.current;

      if (!apiBaseUrl || !activeRunId || autoExitCancelSentRef.current) {
        return;
      }

      autoExitCancelSentRef.current = true;
      const cancelUrl = `${apiBaseUrl}/trends/runs/${activeRunId}/cancel`;

      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon(cancelUrl);
      }

      void fetch(cancelUrl, {
        method: "POST",
        keepalive: true
      });
    }

    function stopAutoCollectionOnPageExit() {
      autoStopRequestedRef.current = true;
      requestAutoCollectionExitCancel();
    }

    window.addEventListener("pagehide", stopAutoCollectionOnPageExit);
    window.addEventListener("beforeunload", stopAutoCollectionOnPageExit);
    window.addEventListener("unload", stopAutoCollectionOnPageExit);
    const previousBeforeUnload = window.onbeforeunload;
    window.onbeforeunload = (event) => {
      stopAutoCollectionOnPageExit();

      if (typeof previousBeforeUnload === "function") {
        return previousBeforeUnload.call(window, event);
      }

      return undefined;
    };

    return () => {
      window.removeEventListener("pagehide", stopAutoCollectionOnPageExit);
      window.removeEventListener("beforeunload", stopAutoCollectionOnPageExit);
      window.removeEventListener("unload", stopAutoCollectionOnPageExit);
      window.onbeforeunload = previousBeforeUnload;
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    const activeRunId = autoCollection.activeRunId;

    if (!apiBaseUrl || !autoCollectionActive || !activeRunId) {
      return;
    }

    void sendTrendRunHeartbeat(apiBaseUrl, activeRunId);
    const interval = window.setInterval(() => {
      void sendTrendRunHeartbeat(apiBaseUrl, activeRunId);
    }, AUTO_COLLECTION_HEARTBEAT_MS);

    return () => window.clearInterval(interval);
  }, [apiBaseUrl, autoCollection.activeRunId, autoCollectionActive]);

  useEffect(() => {
    if (!form.category1) {
      setLevel2Categories([]);
      setLevel3Categories([]);
      return;
    }

    let cancelled = false;

    async function loadLevel2() {
      const nodes = await fetchTrendCategories(apiBaseUrl, form.category1);

      if (cancelled) {
        return;
      }

      setLevel2Categories(nodes);
    }

    void loadLevel2();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, form.category1]);

  useEffect(() => {
    if (!form.category2) {
      setLevel3Categories([]);
      return;
    }

    let cancelled = false;

    async function loadLevel3() {
      const nodes = await fetchTrendCategories(apiBaseUrl, form.category2);

      if (cancelled) {
        return;
      }

      setLevel3Categories(nodes);
    }

    void loadLevel3();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, form.category2]);

  useEffect(() => {
    const latestCompletedPeriod = visibleRun?.latestCompletedPeriod;

    if (!latestCompletedPeriod) {
      setSnapshotPanel(null);
      return;
    }

    const nextTotalPages = getTrendTotalPages(visibleRun.profile.resultCount);
    setSnapshotPanel((previous) => {
      if (previous?.period === latestCompletedPeriod && previous.totalPages === nextTotalPages) {
        return previous;
      }

      return {
        period: latestCompletedPeriod,
        page: 1,
        totalPages: nextTotalPages,
        totalItems: visibleRun.profile.resultCount,
        items: visibleRun.snapshotsPreview,
        loading: false,
        error: null
      };
    });

    if (apiBaseUrl) {
      void loadSnapshots(apiBaseUrl, visibleRun, latestCompletedPeriod, 1, setSnapshotPanel);
    }
  }, [apiBaseUrl, visibleRun?.id, visibleRun?.latestCompletedPeriod, visibleRun?.profile.resultCount]);

  function handleSaveApiBaseUrl() {
    const normalizedUrl = normalizeApiBaseUrl(apiBaseUrlDraft);

    if (!normalizedUrl) {
      setError("Cloudflare Worker API 주소를 입력해 주세요. 예: https://your-worker.your-subdomain.workers.dev/v1");
      setFeedback({
        tone: "error",
        text: "API 주소가 비어 있어 저장하지 못했습니다."
      });
      return;
    }

    window.localStorage.setItem(API_BASE_STORAGE_KEY, normalizedUrl);
    setApiBaseUrl(normalizedUrl);
    setApiBaseUrlDraft(normalizedUrl);
    setTrendBoard(null);
    setCurrentRun(null);
    setSnapshotPanel(null);
    setError(null);
    setFeedback({
      tone: "success",
      text: "API 주소를 저장했습니다. 이제 이 브라우저는 해당 Cloudflare Worker를 사용합니다."
    });
  }

  function handleResetApiBaseUrl() {
    window.localStorage.removeItem(API_BASE_STORAGE_KEY);
    const nextUrl = ENV_API_BASE_URL;
    setApiBaseUrl(nextUrl);
    setApiBaseUrlDraft(nextUrl);
    setTrendBoard(null);
    setCurrentRun(null);
    setSnapshotPanel(null);
    setFeedback({
      tone: "info",
      text: nextUrl
        ? "브라우저 설정을 지우고 배포 환경변수의 API 주소로 되돌렸습니다."
        : "API 주소 설정을 지웠습니다. 새 Worker 주소를 입력하면 분석을 시작할 수 있습니다."
    });
  }

  async function handleStartAnalysis() {
    if (!apiBaseUrl) {
      setActiveSetupPanel("settings");
      setError("먼저 Cloudflare Worker API 주소를 설정해 주세요.");
      setFeedback({
        tone: "error",
        text: "공용 API 기본 연결은 제거되었습니다. 본인 Cloudflare Worker 주소를 저장한 뒤 분석을 시작해 주세요."
      });
      return;
    }

    if (!selectedCategory) {
      setError("먼저 1분류, 2분류, 3분류 중 최종 분석 카테고리를 선택해 주세요.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setFeedback({
      tone: "info",
      text: "조건을 저장하고 데이터 취합 후 같은 트렌드 분석 방식으로 후보 누적까지 이어서 실행합니다."
    });

    const settings = createTrendCollectionSettingsSnapshot({
      devices: form.devices,
      genders: form.genders,
      ages: form.ages,
      resultCount: form.resultCount,
      excludeBrandProducts: form.excludeBrandProducts,
      customExcludedTermsInput: form.customExcludedTerms
    });
    const payload = buildTrendCollectionInputForCategory(
      selectedCategory,
      settings,
      buildAnalysisRequestName(selectedCategory.fullPath, settings)
    );
    const response = await startTrendCollectionRequest(apiBaseUrl, payload);

    setSubmitting(false);

    if (!response.ok) {
      setError(response.message ?? "분석 시작에 실패했습니다.");
      setFeedback({
        tone: "error",
        text: response.message ?? "분석 시작에 실패했습니다."
      });
      return;
    }

    setCurrentRun(response.run);
    setTrendBoard((previous) =>
      previous
        ? {
            ...previous,
            generatedAt: new Date().toISOString(),
            runs: [response.run, ...previous.runs.filter((run) => run.id !== response.run.id)].slice(0, 8)
          }
        : {
            generatedAt: new Date().toISOString(),
            metrics: [],
            profiles: [],
            runs: [response.run]
          }
    );
    setFeedback({
      tone: "success",
      text: "데이터 취합을 시작했습니다. 완료되면 트렌드 분석 후보를 바로 누적합니다."
    });

    void collectBestProductsAfterSingleAnalysis(response.run, selectedCategory, settings);
    void refreshBoard(apiBaseUrl, setTrendBoard, setCurrentRun, setRefreshing, setError);
  }

  async function collectBestProductsAfterSingleAnalysis(
    startedRun: TrendRunDetail,
    category: TrendCategoryNode,
    settings: TrendCollectionSettingsSnapshot
  ) {
    const settledRun =
      startedRun.status === "queued" || startedRun.status === "running"
        ? await waitForTrendRunToSettle(apiBaseUrl, startedRun.id)
        : startedRun;

    if (isTrendRunDetail(settledRun)) {
      setCurrentRun((previous) => (previous?.id === settledRun.id ? mergeRunDetail(previous, settledRun) : settledRun));
      setTrendBoard((previous) => upsertRunOnBoard(previous, settledRun));
    }

    if (settledRun.status !== "completed") {
      setFeedback({
        tone: "error",
        text: `${category.name} 데이터 취합이 ${runStatusLabel(settledRun.status)} 상태라 분석 후보 누적은 실행하지 않았습니다.`
      });
      return;
    }

    const bestProductResponse = await collectBestProductsForCategory(apiBaseUrl, category, settings, settledRun.id);

    setFeedback({
      tone: bestProductResponse.ok && bestProductResponse.collectionStatus === "collected" ? "success" : "error",
      text: bestProductResponse.ok
        ? bestProductResponse.collectionStatus === "collected"
          ? `${category.name} 트렌드 분석 후보 ${(bestProductResponse.items ?? []).length}개를 누적하고 전체 순위를 갱신했습니다.`
          : `${category.name} 분석 후보 누적 ${bestProductResponse.collectionStatus === "empty" ? "빈 결과" : "실패"}: ${bestProductResponse.message ?? "원인 확인 필요"}`
        : `${category.name} 분석 후보 누적 API 실패: ${bestProductResponse.message ?? "API 연결 실패"}`
    });

    void refreshBoard(apiBaseUrl, setTrendBoard, setCurrentRun, setRefreshing, setError);
  }

  async function handleStartAutoCollection(mode: AutoCollectionStartMode = "selected-scope") {
    if (!apiBaseUrl) {
      setActiveSetupPanel("settings");
      setError("먼저 Cloudflare Worker API 주소를 설정해 주세요.");
      return;
    }

    if (mode === "resume-from-selected" && !selectedCategory) {
      setError("이어 시작할 카테고리를 먼저 선택해 주세요.");
      setFeedback({
        tone: "error",
        text: "중간부터 자동 시작하려면 1분류, 2분류, 3분류 중 시작할 카테고리를 선택해야 합니다."
      });
      return;
    }

    const settings = createTrendCollectionSettingsSnapshot({
      devices: form.devices,
      genders: form.genders,
      ages: form.ages,
      resultCount: form.resultCount,
      excludeBrandProducts: form.excludeBrandProducts,
      customExcludedTermsInput: form.customExcludedTerms
    });
    const settingsPills = formatSettingsSnapshotPills(settings);

    autoStopRequestedRef.current = false;
    autoActiveRunIdRef.current = null;
    autoExitCancelSentRef.current = false;
    setSubmitting(true);
    setError(null);
    setFeedback({
      tone: "info",
      text: "자동 순회 대상을 확인하고 있습니다."
    });

    const resumeFromSelected = mode === "resume-from-selected" && Boolean(selectedCategory);
    const allRootCategories = level1Categories.length ? level1Categories : STATIC_TREND_ROOT_CATEGORIES;
    const rootCategories = resumeFromSelected ? allRootCategories : selectedCategory ? [selectedCategory] : allRootCategories;
    const rootPath = resumeFromSelected
      ? `전체 카테고리 · ${selectedCategory?.fullPath}부터`
      : selectedCategory?.fullPath ?? "전체 카테고리";

    setAutoCollection({
      ...initialAutoCollectionState,
      status: "preparing",
      rootPath,
      message: resumeFromSelected
        ? `전체 카테고리 큐에서 ${selectedCategory?.fullPath} 위치를 찾는 중입니다.`
        : selectedCategory
          ? `${selectedCategory.fullPath} 하위 카테고리를 불러오는 중입니다.`
          : "선택된 카테고리가 없어 1분류 전체 카테고리를 불러오는 중입니다.",
      settingsPills
    });

    const fullQueue = selectedCategory && !resumeFromSelected
      ? await buildTrendAutoCollectionQueue(selectedCategory, (cid) => fetchTrendCategoriesForAutoQueue(apiBaseUrl, cid))
      : await buildTrendAutoCollectionQueueForRoots(rootCategories, (cid) => fetchTrendCategoriesForAutoQueue(apiBaseUrl, cid));
    const queueStart = resumeFromSelected
      ? sliceTrendAutoCollectionQueueFromCategory(fullQueue, selectedCategory)
      : {
          queue: fullQueue,
          found: true,
          startIndex: 0,
          skippedCount: 0
        };
    const queue = queueStart.queue;

    if (!queue.length) {
      setSubmitting(false);
      const message = resumeFromSelected && !queueStart.found
        ? "선택한 카테고리를 전체 자동순회 큐에서 찾지 못했습니다."
        : "자동 순회할 카테고리를 찾지 못했습니다.";
      setError(message);
      setAutoCollection((current) => ({
        ...current,
        status: "failed",
        message
      }));
      return;
    }

    const resumePrefix = queueStart.skippedCount > 0 ? `${queueStart.skippedCount}개 카테고리를 건너뛰고 ` : "";
    setSubmitting(false);
    setAutoCollection((current) => ({
      ...current,
      status: "running",
      queue,
      currentIndex: 0,
      message: `${resumePrefix}${queue.length}개 카테고리를 순서대로 취합합니다.`
    }));
    setFeedback({
      tone: "info",
      text: `${resumePrefix}${queue.length}개 카테고리 자동 순회를 시작했습니다. 완료된 트렌드 분석 후보를 누적하고 전체 순위를 재정렬합니다.`
    });

    const summary = await runTrendAutoCollectionQueue({
      categories: queue,
      settings,
      stopOnFirstFailure: true,
      maxAttemptsPerCategory: AUTO_COLLECTION_API_RETRY_ATTEMPTS,
      retryDelayMs: AUTO_COLLECTION_API_RETRY_DELAY_MS,
      shouldRetryCollectFailure: (failure) => isRetryableApiResponse(failure),
      shouldStop: () => autoStopRequestedRef.current,
      buildName: (category) => buildAnalysisRequestName(category.fullPath, settings),
      onRetry: async ({ category, index, attempt, maxAttempts, message }) => {
        setAutoCollection((current) => ({
          ...current,
          status: autoStopRequestedRef.current ? "stopping" : "running",
          currentIndex: index,
          activeRunId: null,
          message: `${index + 1}/${queue.length} ${category.fullPath} API 재연결 대기 중 (${attempt}/${maxAttempts})${message ? ` · ${message}` : ""}`
        }));
      },
      collect: async (payload, category, index) => {
        setAutoCollection((current) => ({
          ...current,
          status: autoStopRequestedRef.current ? "stopping" : "running",
          currentIndex: index,
          activeRunId: null,
          message: `${index + 1}/${queue.length} ${category.fullPath} 시작 중`
        }));

        const response = await startTrendCollectionRequest(apiBaseUrl, payload);

        if (!response.ok) {
          return {
            ok: false as const,
            code: response.code,
            message: response.message ?? "카테고리 취합 시작에 실패했습니다."
          };
        }

        autoExitCancelSentRef.current = false;
        autoActiveRunIdRef.current = response.run.id;
        void sendTrendRunHeartbeat(apiBaseUrl, response.run.id);
        setCurrentRun(response.run);
        setTrendBoard((previous) => upsertRunOnBoard(previous, response.run));

        if (autoStopRequestedRef.current) {
          const cancelResponse = await api<TrendRunActionResponse>(apiBaseUrl, `/trends/runs/${response.run.id}/cancel`, {
            method: "POST"
          });
          const cancelledRun = cancelResponse.ok && cancelResponse.run ? cancelResponse.run : { ...response.run, status: "cancelled" as const };

          autoActiveRunIdRef.current = null;
          setCurrentRun(cancelledRun);
          setTrendBoard((previous) => upsertRunOnBoard(previous, cancelledRun));
          setAutoCollection((current) => ({
            ...current,
            status: "stopping",
            activeRunId: null,
            message: `${index + 1}/${queue.length} ${category.fullPath} 중지 요청됨`
          }));

          return {
            ok: true as const,
            run: {
              id: cancelledRun.id,
              status: cancelledRun.status
            }
          };
        }

        setAutoCollection((current) => ({
          ...current,
          activeRunId: response.run.id,
          message: `${index + 1}/${queue.length} ${category.fullPath} 취합 중`
        }));

        return {
          ok: true as const,
          run: response.run
        };
      },
      waitForRun: async (run, category, index) => {
        const finalRun = await waitForTrendRunToSettle(apiBaseUrl, run.id, ({ attempt, maxAttempts, message }) => {
          setAutoCollection((current) => ({
            ...current,
            status: autoStopRequestedRef.current ? "stopping" : "running",
            activeRunId: run.id,
            currentIndex: index,
            message: `${index + 1}/${queue.length} ${category.fullPath} API 재연결 대기 중 (${attempt}/${maxAttempts})${message ? ` · ${message}` : ""}`
          }));
        });
        autoActiveRunIdRef.current = finalRun.status === "queued" || finalRun.status === "running" ? finalRun.id : null;
        return finalRun;
      },
      onResult: async (_result, partialSummary) => {
        setAutoCollection((current) => ({
          ...current,
          completedCount: partialSummary.completedCount,
          failedCount: partialSummary.failedCount,
          cancelledCount: partialSummary.cancelledCount,
          activeRunId: null,
          message:
            _result.status === "failed"
              ? `${_result.category.fullPath} 취합 실패: ${_result.message ?? "API 요청 실패"}`
              : `${partialSummary.completedCount + partialSummary.failedCount + partialSummary.cancelledCount}/${partialSummary.totalCount} 처리됨`
        }));

        if (_result.status !== "completed" || autoStopRequestedRef.current) {
          return;
        }

        const handledCount = partialSummary.completedCount + partialSummary.failedCount + partialSummary.cancelledCount;
        const bestProductResponse = await retryApiOperation(
          () => collectBestProductsForCategory(apiBaseUrl, _result.category, settings, _result.run?.id),
          {
            maxAttempts: AUTO_COLLECTION_API_RETRY_ATTEMPTS,
            delayMs: AUTO_COLLECTION_API_RETRY_DELAY_MS,
            shouldStop: () => autoStopRequestedRef.current,
            onRetry: async ({ attempt, maxAttempts, response }) => {
              setAutoCollection((current) => ({
                ...current,
                message: `${handledCount}/${partialSummary.totalCount} 처리됨 · ${_result.category.name} 분석 후보 누적 API 재연결 대기 중 (${attempt}/${maxAttempts})${response.message ? ` · ${response.message}` : ""}`
              }));
            }
          }
        );

        setAutoCollection((current) => ({
          ...current,
          message: bestProductResponse.ok
            ? bestProductResponse.collectionStatus === "collected"
              ? `${handledCount}/${partialSummary.totalCount} 처리됨 · ${_result.category.name} 트렌드 분석 후보 ${(bestProductResponse.items ?? []).length}개 누적, 전체 순위 갱신`
              : `${handledCount}/${partialSummary.totalCount} 처리됨 · ${_result.category.name} 분석 후보 누적 ${bestProductResponse.collectionStatus === "empty" ? "빈 결과" : "실패"}: ${bestProductResponse.message ?? "원인 확인 필요"}`
            : `${handledCount}/${partialSummary.totalCount} 처리됨 · ${_result.category.name} 분석 후보 누적 API 실패: ${bestProductResponse.message ?? "API 연결 실패"}`
        }));
      }
    });

    autoActiveRunIdRef.current = null;
    const finalStatus =
      summary.failedCount > 0
        ? "failed"
        : summary.status === "completed"
          ? "completed"
          : "stopped";
    setAutoCollection((current) => ({
      ...current,
      status: finalStatus,
      completedCount: summary.completedCount,
      failedCount: summary.failedCount,
      cancelledCount: summary.cancelledCount,
      activeRunId: null,
      message:
        finalStatus === "completed"
          ? `${summary.totalCount}개 카테고리 자동 순회를 완료했습니다.`
          : finalStatus === "failed"
            ? `자동 순회가 중단되었습니다. ${summary.failedCount}개 카테고리에서 취합 실패가 발생했습니다. API 연결과 로그를 확인해 주세요.`
          : `자동 순회를 중지했습니다. ${summary.results.length}/${summary.totalCount}개 카테고리를 처리했습니다.`
    }));
    setFeedback({
      tone: finalStatus === "completed" ? "success" : finalStatus === "failed" ? "error" : "info",
      text:
        finalStatus === "completed"
          ? "자동 카테고리 순회가 완료되었습니다."
          : finalStatus === "failed"
            ? "자동 카테고리 순회가 API 오류로 중단되었습니다. 로컬 API가 켜져 있는지 확인해 주세요."
          : "자동 카테고리 순회를 중지했습니다."
    });

    void refreshBoard(apiBaseUrl, setTrendBoard, setCurrentRun, setRefreshing, setError);
  }

  async function handleStopAutoCollection() {
    autoStopRequestedRef.current = true;
    setAutoCollection((current) => ({
      ...current,
      status: current.status === "idle" ? "idle" : "stopping",
      message: "자동 순회를 중지하는 중입니다. 현재 런을 취소하고 다음 카테고리는 시작하지 않습니다."
    }));

    const stopResult = await stopTrendAutoCollectionRun(autoActiveRunIdRef.current, async (runId) => {
      await api<TrendRunActionResponse>(apiBaseUrl, `/trends/runs/${runId}/cancel`, {
        method: "POST"
      });
    });

    if (stopResult.cancelRequested) {
      autoActiveRunIdRef.current = null;
      setAutoCollection((current) => ({
        ...current,
        activeRunId: null,
        message: "현재 런 취소를 요청했습니다. 다음 카테고리는 시작하지 않습니다."
      }));
      void refreshBoard(apiBaseUrl, setTrendBoard, setCurrentRun, setRefreshing, setError);
    }
  }

  async function handleConfirmAction() {
    if (!actionModal) {
      return;
    }

    if (!apiBaseUrl) {
      setActiveSetupPanel("settings");
      setError("런을 제어하려면 Cloudflare Worker API 주소가 필요합니다.");
      return;
    }

    setActionSubmitting(true);
    setError(null);

    const response = await api<TrendRunActionResponse>(
      apiBaseUrl,
      actionModal.type === "cancel" ? `/trends/runs/${actionModal.run.id}/cancel` : `/trends/runs/${actionModal.run.id}`,
      {
        method: actionModal.type === "cancel" ? "POST" : "DELETE"
      }
    );

    setActionSubmitting(false);

    if (!response.ok) {
      setError(response.message ?? "런 제어 요청을 처리하지 못했습니다.");
      setFeedback({
        tone: "error",
        text: response.message ?? "런 제어 요청을 처리하지 못했습니다."
      });
      return;
    }

    if (actionModal.type === "cancel" && response.run) {
      setCurrentRun(response.run);
      setTrendBoard((previous) =>
        previous
          ? {
              ...previous,
              generatedAt: new Date().toISOString(),
              runs: response.run ? [response.run] : []
            }
          : previous
      );
      setFeedback({
        tone: "success",
        text: "데이터 취합을 중지했습니다. 이미 완료된 월 데이터는 유지됩니다."
      });
    }

    if (actionModal.type === "delete") {
      setCurrentRun(null);
      setSnapshotPanel(null);
      setFeedback({
        tone: "success",
        text: "현재 데이터 취합 런을 삭제했습니다. 이미 완성된 월 캐시는 그대로 유지됩니다."
      });
    }

    setActionModal(null);
    if (apiBaseUrl) {
      void refreshBoard(apiBaseUrl, setTrendBoard, setCurrentRun, setRefreshing, setError);
    }
  }

  async function handleRetryFailures(run: TrendRunDetail) {
    if (!apiBaseUrl) {
      setActiveSetupPanel("settings");
      setError("실패 월을 재시도하려면 API 주소가 필요합니다.");
      return;
    }

    setRetrySubmitting(true);
    setError(null);
    setFeedback({
      tone: "info",
      text: "실패한 월을 다시 대기열에 넣고 천천히 재수집합니다."
    });

    const response = await api<TrendRunRetryResponse>(apiBaseUrl, `/trends/runs/${run.id}/retry-failures`, {
      method: "POST"
    });

    setRetrySubmitting(false);

    if (!response.ok) {
      setError(response.message ?? "실패 월 재시도 요청을 처리하지 못했습니다.");
      setFeedback({
        tone: "error",
        text: response.message ?? "실패 월 재시도 요청을 처리하지 못했습니다."
      });
      return;
    }

    setCurrentRun(response.run);
    setTrendBoard((previous) =>
      previous
        ? {
            ...previous,
            generatedAt: new Date().toISOString(),
            runs: [response.run, ...previous.runs.filter((item) => item.id !== response.run.id)].slice(0, 8)
          }
        : previous
    );
    setFeedback({
      tone: "success",
      text: "실패한 월을 재시도합니다. 네이버 차단을 피하려고 이전보다 천천히 진행됩니다."
    });
    void refreshBoard(apiBaseUrl, setTrendBoard, setCurrentRun, setRefreshing, setError);
  }

  async function handleSelectArchivedRun(run: TrendRunDetail) {
    if (!apiBaseUrl) {
      setActiveSetupPanel("settings");
      setError("완료 작업을 불러오려면 Cloudflare Worker API 주소가 필요합니다.");
      return;
    }

    setCurrentRun(run);
    setFeedback({
      tone: "info",
      text: "완료된 기존 작업 결과를 불러오고 있습니다."
    });

    const response = await api<TrendRunResponse>(apiBaseUrl, `/trends/runs/${run.id}`);

    if (!response.ok) {
      setError(response.message ?? "완료된 기존 작업 결과를 불러오지 못했습니다.");
      return;
    }

    setError(null);
    setCurrentRun(response.run);
    setTrendBoard((previous) =>
      previous
        ? {
            ...previous,
            runs: previous.runs.map((item) => (item.id === response.run.id ? response.run : item))
          }
        : previous
    );
    setFeedback({
      tone: "success",
      text: "완료된 기존 작업 결과를 불러왔습니다."
    });
  }

  const progressPercent = visibleRun ? runProgressPercent(visibleRun.completedTasks, visibleRun.totalTasks) : 0;
  const visibleItems = snapshotPanel?.items ?? visibleRun?.snapshotsPreview ?? [];
  const isRunActive = visibleRun?.status === "running" || visibleRun?.status === "queued";
  const analysisSummary = visibleRun?.analysisSummary;
  const plannerMonths = analysisSummary?.monthlyPlanner ?? [];
  const selectedMonthReport =
    plannerMonths.find((month) => month.month === selectedPlannerMonth) ??
    plannerMonths[0] ??
    null;
  const heatmapRows = analysisSummary?.seasonalityHeatmap ?? [];
  const drilldownSeries = analysisSummary?.keywordDrilldownSeries ?? [];
  const fallbackDrilldownSeries = useMemo(
    () => buildFallbackDrilldownSeries(visibleRun?.analysisCards ?? [], heatmapRows),
    [heatmapRows, visibleRun?.analysisCards]
  );
  const availableDrilldownSeries = useMemo(() => {
    const byKeyword = new Map<string, TrendKeywordDrilldownSeries>();
    [...drilldownSeries, ...fallbackDrilldownSeries].forEach((item) => {
      if (!byKeyword.has(item.keyword)) {
        byKeyword.set(item.keyword, item);
      }
    });
    return Array.from(byKeyword.values());
  }, [drilldownSeries, fallbackDrilldownSeries]);
  const selectedDrilldown =
    availableDrilldownSeries.find((item) => item.keyword === selectedKeyword) ??
    availableDrilldownSeries[0] ??
    null;

  const handleSelectKeyword = useCallback((keyword: string) => {
    setSelectedKeyword(keyword);
    window.requestAnimationFrame(() => {
      drilldownRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
      });
    });
  }, []);

  useEffect(() => {
    if (!plannerMonths.length) {
      return;
    }

    setSelectedPlannerMonth((previous) =>
      plannerMonths.some((month) => month.month === previous) ? previous : plannerMonths[0].month
    );
  }, [plannerMonths]);

  useEffect(() => {
    if (!availableDrilldownSeries.length) {
      return;
    }

    setSelectedKeyword((previous) =>
      availableDrilldownSeries.some((item) => item.keyword === previous) ? previous : availableDrilldownSeries[0].keyword
    );
  }, [availableDrilldownSeries]);

  useEffect(() => {
    const run = visibleRun;

    if (!apiBaseUrl || !run?.analysisReady || run.analysisSummary || detailLoadingRunId === run.id) {
      return;
    }
    const targetRun = run;

    let cancelled = false;

    async function loadRunDetail() {
      setDetailLoadingRunId(targetRun.id);
      const response = await api<TrendRunResponse>(apiBaseUrl, `/trends/runs/${targetRun.id}`);

      if (cancelled) {
        return;
      }

      setDetailLoadingRunId(null);

      if (!response.ok) {
        setError(response.message ?? "완료된 작업 상세를 불러오지 못했습니다.");
        return;
      }

      setError(null);
      setCurrentRun((previous) => (previous?.id === response.run.id ? response.run : previous));
      setTrendBoard((previous) =>
        previous
          ? {
              ...previous,
              runs: previous.runs.map((run) => (run.id === response.run.id ? response.run : run))
            }
          : previous
      );
    }

    void loadRunDetail();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, detailLoadingRunId, visibleRun]);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.headerCopy}>
            <p className={styles.eyebrow}>HANIRUM</p>
            <h1 className={styles.title}>한이룸의 네이버 트렌드 마법사 1.0</h1>
            <p className={styles.description}>
              장기간 월별 인기검색어를 취합해 앞으로 준비해야 할 키워드, 조심해야 할 키워드, 시즌형 수요를
              더 입체적으로 보여줍니다.
            </p>
          </div>

          <div className={styles.headerMeta}>
            <span className={styles.summaryPill}>수집 기간 {summaryPeriodLabel}</span>
            <span className={styles.summaryPill}>기본 수집 20개 · 확장 40개</span>
            <span className={styles.summaryPill}>브랜드 제품 제외 옵션 제공</span>
            <span className={apiConfigured ? `${styles.summaryPill} ${styles.connectedPill}` : `${styles.summaryPill} ${styles.warningPill}`}>
              API {apiSourceLabel}
            </span>
          </div>
        </header>

        <section className={`${styles.surface} ${styles.setupSurface}`}>
          <div className={styles.setupHeader}>
            <div>
              <p className={styles.surfaceEyebrow}>SETUP</p>
              <h2 className={styles.setupTitle}>Cloudflare Worker 연결</h2>
              <p className={styles.surfaceDescription}>
                이 저장소는 각 사용자가 본인 Cloudflare Worker와 D1을 연결해 독립적으로 작업 결과를 관리하도록 설계되었습니다.
              </p>
            </div>
            <div className={styles.setupTabs} role="tablist" aria-label="Cloudflare 설정 메뉴">
              <button
                type="button"
                role="tab"
                aria-selected={activeSetupPanel === "settings"}
                className={activeSetupPanel === "settings" ? `${styles.setupTab} ${styles.setupTabActive}` : styles.setupTab}
                onClick={() => setActiveSetupPanel(activeSetupPanel === "settings" ? null : "settings")}
              >
                <Settings2 size={15} />
                API 설정
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeSetupPanel === "guide"}
                className={activeSetupPanel === "guide" ? `${styles.setupTab} ${styles.setupTabActive}` : styles.setupTab}
                onClick={() => setActiveSetupPanel(activeSetupPanel === "guide" ? null : "guide")}
              >
                <BookOpen size={15} />
                가이드
              </button>
            </div>
          </div>

          {activeSetupPanel === "settings" ? (
            <div className={styles.setupPanel}>
              <div className={styles.connectionCard}>
                <span className={apiConfigured ? `${styles.connectionDot} ${styles.connectionDotReady}` : styles.connectionDot} />
                <div>
                  <strong>{apiConfigured ? "개인 Worker API가 연결되어 있습니다." : "Worker API 주소 설정이 필요합니다."}</strong>
                  <p>
                    {apiConfigured
                      ? `현재 사용 중: ${apiBaseUrl}`
                      : "Cloudflare Worker를 배포한 뒤 /v1이 붙은 API 주소를 입력해 주세요."}
                  </p>
                </div>
              </div>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>NEXT_PUBLIC_API_BASE_URL</span>
                <input
                  className={styles.fieldInput}
                  type="url"
                  value={apiBaseUrlDraft}
                  onChange={(event) => setApiBaseUrlDraft(event.target.value)}
                  placeholder="https://your-worker.your-subdomain.workers.dev/v1"
                  spellCheck={false}
                />
              </label>

              <div className={styles.setupActions}>
                <button className={styles.secondaryButton} type="button" onClick={handleSaveApiBaseUrl}>
                  <PlugZap size={15} />
                  API 주소 저장
                </button>
                <button className={styles.ghostButton} type="button" onClick={handleResetApiBaseUrl}>
                  설정 초기화
                </button>
              </div>
            </div>
          ) : null}

          {activeSetupPanel === "guide" ? (
            <div className={styles.guidePanel}>
              <GuideStep
                number="1"
                title="Cloudflare 가입 및 Wrangler 로그인"
                body="Cloudflare 계정을 만든 뒤 터미널에서 Wrangler에 로그인합니다."
                command={"pnpm install\npnpm wrangler login"}
                link="https://developers.cloudflare.com/workers/wrangler/"
              />
              <GuideStep
                number="2"
                title="D1 데이터베이스 만들기"
                body="트렌드 수집 결과와 분석 작업을 저장할 개인 D1 DB를 만듭니다. 생성 후 표시되는 database_id를 edge-api/wrangler.jsonc에 넣어 주세요."
                command="pnpm wrangler d1 create naver-trend-maker-db"
                link="https://developers.cloudflare.com/d1/get-started/"
              />
              <GuideStep
                number="3"
                title="스키마 적용 후 Worker 배포"
                body="DB 테이블을 만든 뒤 Worker를 배포합니다. 배포가 끝나면 workers.dev 주소를 확인할 수 있습니다."
                command={"pnpm wrangler d1 execute naver-trend-maker-db --remote --file edge-api/schema.sql\npnpm wrangler deploy --config edge-api/wrangler.jsonc"}
                link="https://developers.cloudflare.com/d1/wrangler-commands/"
              />
              <GuideStep
                number="4"
                title="프론트에 API 주소 저장"
                body="배포된 Worker 주소 뒤에 /v1을 붙여 이 화면의 API 설정에 저장합니다. 예: https://naver-trend-maker-api.your-subdomain.workers.dev/v1"
                command="NEXT_PUBLIC_API_BASE_URL=https://your-worker.your-subdomain.workers.dev/v1"
                link="https://developers.cloudflare.com/workers/wrangler/configuration/"
              />
            </div>
          ) : null}
        </section>

        {error ? (
          <div className={`${styles.banner} ${styles.bannerError}`} role="alert">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        ) : null}

        <div className={styles.workspace}>
          <section className={`${styles.surface} ${styles.formSurface}`}>
            <div className={styles.surfaceHeader}>
              <p className={styles.surfaceEyebrow}>INPUT</p>
              <h2 className={styles.surfaceTitle}>트렌드 분석 조건 입력</h2>
              <p className={styles.surfaceDescription}>
                카테고리와 필터를 정하면 바로 데이터 취합과 세일즈 트렌드 분석을 시작합니다.
              </p>
            </div>

            <div className={styles.controlStack}>
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>1분류</span>
                  <select
                    className={styles.fieldInput}
                    value={form.category1}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        category1: event.target.value,
                        category2: "",
                        category3: ""
                      }))
                    }
                  >
                    <option value="">선택</option>
                    {level1Categories.map((category) => (
                      <option key={category.cid} value={category.cid}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>2분류</span>
                  <select
                    className={styles.fieldInput}
                    value={form.category2}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        category2: event.target.value,
                        category3: ""
                      }))
                    }
                    disabled={!form.category1}
                  >
                    <option value="">선택</option>
                    {level2Categories.map((category) => (
                      <option key={category.cid} value={category.cid}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>3분류</span>
                  <select
                    className={styles.fieldInput}
                    value={form.category3}
                    onChange={(event) => setForm((current) => ({ ...current, category3: event.target.value }))}
                    disabled={!form.category2}
                  >
                    <option value="">선택</option>
                    {level3Categories.map((category) => (
                      <option key={category.cid} value={category.cid}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className={styles.optionSection}>
                <div className={styles.optionHeader}>
                  <span className={styles.optionTitle}>분석 개수</span>
                  <span className={styles.optionHint}>20개는 빠르게, 40개는 더 깊게 볼 수 있습니다.</span>
                </div>
                <div className={styles.segmentedRow}>
                  {TREND_RESULT_COUNT_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={form.resultCount === option ? `${styles.segmentedButton} ${styles.segmentedButtonActive}` : styles.segmentedButton}
                      onClick={() => setForm((current) => ({ ...current, resultCount: option }))}
                      aria-pressed={form.resultCount === option}
                    >
                      Top {option}
                    </button>
                  ))}
                </div>
                <p className={styles.inlineHelper}>
                  {form.resultCount === 40
                    ? "40개 분석은 2페이지를 수집하므로 결과가 조금 더 늦어질 수 있습니다."
                    : "20개 분석은 1페이지만 수집해 빠르게 트렌드를 확인할 수 있습니다."}
                </p>
              </div>

              <div className={styles.filterGrid}>
                <FilterGroup
                  title="기기"
                  hint="선택하지 않으면 전체"
                  options={DEVICE_OPTIONS}
                  values={form.devices}
                  onToggle={(value) => setForm((current) => ({ ...current, devices: toggleValue(current.devices, value) }))}
                />
                <FilterGroup
                  title="성별"
                  hint="선택하지 않으면 전체"
                  options={GENDER_OPTIONS}
                  values={form.genders}
                  onToggle={(value) => setForm((current) => ({ ...current, genders: toggleValue(current.genders, value) }))}
                />
                <FilterGroup
                  title="연령"
                  hint="복수 선택 가능"
                  options={AGE_OPTIONS}
                  values={form.ages}
                  onToggle={(value) => setForm((current) => ({ ...current, ages: toggleValue(current.ages, value) }))}
                />
              </div>

              <div className={styles.brandSection}>
                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={form.excludeBrandProducts}
                    onChange={(event) => {
                      const excludeBrandProducts = event.target.checked;
                      setForm((current) => ({
                        ...current,
                        excludeBrandProducts,
                        customExcludedTerms: excludeBrandProducts ? current.customExcludedTerms : ""
                      }));
                    }}
                  />
                  <div>
                    <span className={styles.checkboxTitle}>브랜드 제품 제외</span>
                    <span className={styles.checkboxHint}>
                      브랜드명 중심 키워드를 분석 결과에서 제외해 일반 상품 트렌드에 더 집중합니다.
                    </span>
                  </div>
                </label>

                {form.excludeBrandProducts ? (
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>추가 제외어</span>
                    <input
                      className={styles.fieldInput}
                      type="text"
                      value={form.customExcludedTerms}
                      onChange={(event) => setForm((current) => ({ ...current, customExcludedTerms: event.target.value }))}
                      placeholder="예: 올리비아로렌, 써스데이아일랜드, 특정브랜드"
                    />
                  </label>
                ) : null}
              </div>

              <div className={styles.formSummary}>
                <SummaryCard
                  label="예상 수집 범위"
                  value={summaryPeriodLabel}
                  hint={`${analysisPeriods.length}개월 기준`}
                />
                <SummaryCard
                  label="예상 취합 속도"
                  value={`약 ${estimatedLeadMinutes}분`}
                  hint={form.resultCount === 40 ? "2페이지 수집 기준" : "1페이지 수집 기준"}
                />
              </div>

              <div className={styles.autoPanel} data-testid="auto-collection-panel">
                <div className={styles.autoPanelHeader}>
                  <div>
                    <span className={styles.optionTitle}>자동 카테고리 순회</span>
                    <p className={styles.optionHint}>
                      {autoCollection.rootPath ?? selectedCategory?.fullPath ?? "카테고리 선택 대기"}
                    </p>
                  </div>
                  <span className={`${styles.badge} ${autoCollectionActive ? styles.badgeProgress : styles.badgeStable}`}>
                    {autoCollectionStatusLabel(autoCollection.status)}
                  </span>
                </div>
                <p className={styles.visuallyHidden} id="auto-collection-status" role="status" aria-atomic="true" data-testid="auto-collection-status">
                  {autoCollection.message}
                </p>
                <div
                  className={styles.visuallyHidden}
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={Math.max(autoCollectionTotal, 1)}
                  aria-valuenow={autoCollectionHandled}
                  aria-valuetext={`${autoCollectionHandled}/${autoCollectionTotal} 처리됨${autoCollectionCurrentCategory ? `, 현재 ${autoCollectionCurrentCategory.fullPath}` : ""}`}
                  data-testid="auto-collection-progress"
                />
                <div className={styles.progressGrid}>
                  <ProgressStat
                    label="자동 진행"
                    value={autoCollectionTotal ? `${autoCollectionHandled}/${autoCollectionTotal}` : "0/0"}
                    hint={autoCollectionCurrentCategory?.name ?? "대기"}
                  />
                  <ProgressStat
                    label="완료"
                    value={`${autoCollection.completedCount}건`}
                    hint="완료된 카테고리"
                  />
                  <ProgressStat
                    label="실패/중지"
                    value={`${autoCollection.failedCount + autoCollection.cancelledCount}건`}
                    hint="실패 또는 취소"
                  />
                </div>
                <p className={styles.inlineHelper}>{autoCollection.message}</p>
                <p className={styles.inlineHelper}>
                  분석누적: {bestProductStatus.message} · 엑셀 {bestProductStatus.outputFileName}
                </p>
                <div className={styles.pillRow}>
                  {(autoCollection.settingsPills.length ? autoCollection.settingsPills : formatFormSettingPills(form)).map((label) => (
                    <span key={`auto-${label}`} className={styles.summaryPill}>
                      {label}
                    </span>
                  ))}
                  <span className={styles.summaryPill}>
                    {bestProductStatus.ready ? "트렌드 분석 누적 준비됨" : "트렌드 분석 누적 확인 중"}
                  </span>
                </div>
              </div>

              {feedback ? (
                <div
                  role={feedback.tone === "error" ? "alert" : "status"}
                  aria-live={feedback.tone === "error" ? "assertive" : "polite"}
                  className={
                    feedback.tone === "success"
                      ? `${styles.banner} ${styles.bannerSuccess}`
                      : feedback.tone === "error"
                        ? `${styles.banner} ${styles.bannerError}`
                        : `${styles.banner} ${styles.bannerInfo}`
                  }
                >
                  {feedback.tone === "success" ? <CheckCircle2 size={16} /> : feedback.tone === "error" ? <AlertCircle size={16} /> : <LoaderCircle className={styles.spinningIcon} size={16} />}
                  <span>{feedback.text}</span>
                </div>
              ) : null}

              <div className={styles.actionRow}>
                <button
                  className={styles.primaryButton}
                  type="button"
                  onClick={() => void handleStartAnalysis()}
                  disabled={submitting || autoCollectionActive || !apiConfigured}
                >
                  {submitting && !autoCollectionActive ? (
                    <>
                      <LoaderCircle className={styles.spinningIcon} size={16} />
                      분석 준비 중...
                    </>
                  ) : !apiConfigured ? (
                    <>
                      <Cloud size={16} />
                      API 설정 필요
                    </>
                  ) : (
                    <>
                      <Search size={16} />
                      분석 시작
                    </>
                  )}
                </button>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={() => void handleStartAutoCollection("selected-scope")}
                  disabled={submitting || autoCollectionActive || !apiConfigured}
                  data-testid="auto-collection-start"
                  aria-describedby="auto-collection-status"
                >
                  {autoCollection.status === "preparing" ? <LoaderCircle className={styles.spinningIcon} size={16} /> : <PlayCircle size={16} />}
                  자동 시작
                </button>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={() => void handleStartAutoCollection("resume-from-selected")}
                  disabled={submitting || autoCollectionActive || !apiConfigured || !selectedCategory}
                  data-testid="auto-collection-resume-start"
                  aria-describedby="auto-collection-status"
                  title="전체 자동순회 큐에서 선택한 카테고리 앞부분은 건너뛰고 이후 카테고리부터 시작합니다."
                >
                  <ArrowRight size={16} />
                  여기부터 자동 시작
                </button>
                <button
                  className={`${styles.secondaryButton} ${styles.warningButton}`}
                  type="button"
                  onClick={() => void handleStopAutoCollection()}
                  disabled={!autoCollectionActive}
                  data-testid="auto-collection-stop"
                  aria-describedby="auto-collection-status"
                >
                  {autoCollection.status === "stopping" ? <LoaderCircle className={styles.spinningIcon} size={16} /> : <PauseCircle size={16} />}
                  자동 종료
                </button>
              </div>

              <div className={styles.resultArchive}>
                <div className={styles.resultArchiveHeader}>
                  <div>
                    <p className={styles.surfaceEyebrow}>ARCHIVE</p>
                    <h3 className={styles.resultArchiveTitle}>작업 결과 보기</h3>
                  </div>
                  <span className={styles.summaryPill}>{completedRuns.length}건</span>
                </div>

                {completedRuns.length ? (
                  <div className={styles.resultArchiveList}>
                    {completedRuns.map((run) => (
                      <button
                        key={run.id}
                        type="button"
                        className={run.id === visibleRun?.id ? `${styles.resultArchiveItem} ${styles.resultArchiveItemActive}` : styles.resultArchiveItem}
                        onClick={() => void handleSelectArchivedRun(run)}
                      >
                        <div className={styles.resultArchiveMeta}>
                          <strong>{run.profile.categoryPath}</strong>
                          <span>
                            {run.startPeriod} ~ {run.endPeriod}
                          </span>
                        </div>
                        <div className={styles.resultArchiveDetail}>
                          {formatProfileSettingPills(run.profile).map((label) => (
                            <span key={`${run.id}-${label}`}>{label}</span>
                          ))}
                          <span>{formatDateTime(run.updatedAt)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className={styles.resultArchiveEmpty}>
                    <strong>아직 완료된 작업이 없습니다.</strong>
                    <p>한 번 분석을 완료하면 여기서 다시 바로 불러와 볼 수 있습니다.</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className={`${styles.surface} ${styles.outputSurface}`}>
            <div className={styles.outputHeader}>
              <div>
                <p className={styles.surfaceEyebrow}>RESULT</p>
                <h2 className={styles.surfaceTitle}>데이터 취합</h2>
                <p className={styles.surfaceDescription}>
                  데이터 취합 진행 상황을 확인하고, 네이버에서 받을 수 있는 월 데이터가 정리되면 장기 세일즈 인사이트를 열어봅니다.
                </p>
              </div>
              <div className={styles.outputMeta}>
                {visibleRun ? (
                  <div className={styles.actionRow}>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => setActionModal({ type: "cancel", run: visibleRun })}
                      disabled={!visibleRun.canCancel}
                    >
                      <PauseCircle size={14} />
                      중지
                    </button>
                    <button
                      type="button"
                      className={`${styles.secondaryButton} ${styles.dangerButton}`}
                      onClick={() => setActionModal({ type: "delete", run: visibleRun })}
                      disabled={!visibleRun.canDelete}
                    >
                      <Trash2 size={14} />
                      삭제
                    </button>
                    {visibleRun.status === "failed" ? (
                      <button
                        type="button"
                        className={`${styles.secondaryButton} ${styles.warningButton}`}
                        onClick={() => void handleRetryFailures(visibleRun)}
                        disabled={retrySubmitting}
                      >
                        {retrySubmitting ? <LoaderCircle className={styles.spinningIcon} size={14} /> : <RefreshCw size={14} />}
                        실패 재시도
                      </button>
                    ) : null}
                  </div>
                ) : null}
                <div className={styles.outputStatus} aria-live="polite">
                  <span
                    className={
                      refreshing
                        ? `${styles.statusPulse} ${styles.statusPulseRefreshing}`
                        : pollingActive
                          ? `${styles.statusPulse} ${styles.statusPulseActive}`
                          : styles.statusPulse
                    }
                  />
                  <div className={styles.statusCopy}>
                    <strong className={styles.statusTitle}>{refreshTitle}</strong>
                    <span className={styles.statusHint}>{refreshHint}</span>
                  </div>
                  {refreshing ? <LoaderCircle className={styles.spinningIcon} size={16} /> : null}
                </div>
                {visibleRun ? (
                  <span className={`${styles.badge} ${runBadgeClass(visibleRun.status)}`}>{runStatusLabel(visibleRun.status)}</span>
                ) : (
                  <span className={`${styles.badge} ${styles.badgeMuted}`}>대기</span>
                )}
              </div>
            </div>

            <div className={styles.resultStack}>
              <article className={styles.progressPanel}>
                <div className={styles.progressVisual}>
                  <div className={styles.progressOrb}>
                    <span className={styles.progressOrbCore} />
                    <span className={styles.progressOrbRing} />
                    <span className={styles.progressOrbRingSecondary} />
                  </div>
                  <div className={styles.progressVisualCopy}>
                    <p className={styles.progressEyebrow}>실시간 진행 상태</p>
                    <h3 className={styles.progressTitle}>
                      {visibleRun ? visibleRun.profile.categoryPath : selectedCategory?.fullPath ?? "분석을 시작하면 여기에 진행 상태가 표시됩니다"}
                    </h3>
                    <p className={styles.progressDescription}>
                      {visibleRun
                        ? isRunActive
                          ? "수집 중에는 월 진행 상태만 보여주고, 전체 월이 모두 끝난 뒤 장기 인사이트를 한 번에 생성합니다."
                          : visibleRun.analysisReady
                            ? "데이터 취합이 끝나 장기 세일즈 트렌드 분석을 보여주고 있습니다."
                            : "취합이 멈추었거나 완료되지 않아 장기 인사이트 생성은 잠시 보류된 상태입니다."
                        : "현재는 조건 입력 전입니다. 카테고리와 필터를 정한 뒤 분석을 시작해 주세요."}
                    </p>
                    <div className={styles.pillRow}>
                      <span className={styles.summaryPill}>기준 기간 {summaryPeriodLabel}</span>
                      {(visibleRun ? formatProfileSettingPills(visibleRun.profile) : formatFormSettingPills(form)).map((label) => (
                        <span key={label} className={styles.summaryPill}>
                          {label}
                        </span>
                      ))}
                      {visibleRun ? (
                        <>
                          <span className={styles.summaryPill}>{processingModeLabel(visibleRun.processingMode)}</span>
                          <span className={styles.summaryPill}>캐시 {visibleRun.cacheCompletedTasks ?? 0}개월</span>
                          <span className={styles.summaryPill}>네이버 {visibleRun.naverCompletedTasks ?? 0}개월</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className={styles.progressGrid}>
                  <ProgressStat
                    label="현재 처리 중 월"
                    value={visibleRun?.currentPeriod ?? visibleRun?.latestCompletedPeriod ?? "대기"}
                    hint={visibleRun?.status === "completed" ? "최근 완료 월 기준" : "실시간 수집 포인트"}
                  />
                  <ProgressStat
                    label="완료 월 수"
                    value={visibleRun ? `${visibleRun.completedTasks}/${visibleRun.totalTasks}` : `0/${analysisPeriods.length}`}
                    hint="완료/전체"
                  />
                  <ProgressStat
                    label="현재 페이지"
                    value={
                      visibleRun
                        ? `${visibleRun.currentPage ?? Math.min(getTrendTotalPages(visibleRun.profile.resultCount), 1)}/${getTrendTotalPages(visibleRun.profile.resultCount)}`
                        : `1/${getTrendTotalPages(form.resultCount)}`
                    }
                    hint="월 내부 진행"
                  />
                  <ProgressStat
                    label="남은 예상시간"
                    value={visibleRun ? runEtaLabel(visibleRun) : `${estimatedLeadMinutes}분`}
                    hint={visibleRun?.averageTaskSeconds ? `평균 ${visibleRun.averageTaskSeconds}초/월` : "초기 추정치"}
                  />
                  <ProgressStat
                    label="예상 완료 시각"
                    value={visibleRun?.estimatedCompletionAt ? formatDateTime(visibleRun.estimatedCompletionAt) : "-"}
                    hint="실시간 ETA"
                  />
                  <ProgressStat
                    label="최근 완료 월"
                    value={visibleRun?.latestCompletedPeriod ?? "대기"}
                    hint={visibleRun?.analysisReady ? "취합 완료" : "월별 완료 기준"}
                  />
                  <ProgressStat
                    label="처리 방식"
                    value={visibleRun ? processingModeLabel(visibleRun.processingMode) : "대기"}
                    hint={visibleRun ? processingModeHint(visibleRun.processingMode) : "분석 시작 후 표시"}
                  />
                </div>

                <div className={styles.progressTrack}>
                  <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
                </div>
              </article>

              {visibleRun?.analysisReady && analysisSummary ? (
                <>
                  <section className={styles.heroMetricGrid}>
                    {analysisSummary.heroMetrics.map((metric) => (
                      <HeroMetricCard key={metric.id} metric={metric} />
                    ))}
                  </section>

                  <section className={styles.patternPanel}>
                    <div className={styles.panelHeader}>
                      <div>
                        <p className={styles.panelEyebrow}>PATTERN</p>
                        <h3 className={styles.panelTitle}>장기 패턴 시각화</h3>
                        <p className={styles.surfaceDescription}>
                          {heatmapMode === "season"
                            ? "계절 요약에서는 평균적으로 어느 달에 강한지 압축해서 보고, 시즌 반복 패턴을 빠르게 읽습니다."
                            : "63개월 보기에서는 실제 등장 시점과 지속 구간을 월 단위 타임라인으로 확인합니다."}
                        </p>
                      </div>
                      <div className={styles.pillRow}>
                        <button
                          type="button"
                          className={heatmapMode === "season" ? `${styles.segmentedButton} ${styles.segmentedButtonActive}` : styles.segmentedButton}
                          onClick={() => setHeatmapMode("season")}
                          aria-pressed={heatmapMode === "season"}
                        >
                          계절 요약
                        </button>
                        <button
                          type="button"
                          className={heatmapMode === "timeline" ? `${styles.segmentedButton} ${styles.segmentedButtonActive}` : styles.segmentedButton}
                          onClick={() => setHeatmapMode("timeline")}
                          aria-pressed={heatmapMode === "timeline"}
                        >
                          63개월 보기
                        </button>
                      </div>
                    </div>

                    <div className={styles.patternLayout}>
                      <article className={styles.patternCard}>
                        <SeasonalityHeatmap
                          rows={heatmapRows}
                          mode={heatmapMode}
                          selectedKeyword={selectedDrilldown?.keyword ?? null}
                          onSelect={handleSelectKeyword}
                        />
                      </article>

                      <article ref={drilldownRef} className={styles.patternCard}>
                        <KeywordDrilldownCard detail={selectedDrilldown} onPickMonth={setSelectedPlannerMonth} />
                      </article>
                    </div>
                  </section>

                  <section className={styles.plannerPanel}>
                    <div className={styles.panelHeader}>
                      <div>
                        <p className={styles.panelEyebrow}>PLANNER</p>
                        <h3 className={styles.panelTitle}>월별 준비 / 조심 플래너</h3>
                        <p className={styles.surfaceDescription}>
                          연간 플래너에서 월별 대표 키워드를 먼저 보고, 아래 상세 보드에서 추천과 주의 제품을 함께 비교합니다.
                        </p>
                      </div>
                      <span className={styles.summaryPill}>추천과 주의를 한 화면에서 비교</span>
                    </div>

                    <AnnualPlannerGrid months={plannerMonths} selectedMonth={selectedPlannerMonth} onSelect={setSelectedPlannerMonth} />

                    <MonthExplorerBoard month={selectedMonthReport} />
                  </section>

                  <article className={styles.analysisPanel}>
                    <div className={styles.panelHeader}>
                      <div>
                        <p className={styles.panelEyebrow}>INSIGHT</p>
                        <h3 className={styles.panelTitle}>세일즈 트렌드 분석</h3>
                      </div>
                      <div className={styles.pillRow}>
                        <span className={styles.summaryPill}>실무 추천형 리포트</span>
                        <span className={styles.summaryPill}>
                          {visibleRun?.profile.excludeBrandProducts ? "브랜드 제외 반영" : "원본 키워드 기준"}
                        </span>
                      </div>
                    </div>

                    <ul className={styles.highlightList}>
                      {analysisSummary.highlights.map((highlight) => (
                        <li key={highlight}>{highlight}</li>
                      ))}
                    </ul>

                    <div className={styles.cardGrid}>
                      {visibleRun.analysisCards.map((card) => (
                        <InsightCard key={card.kind} card={card} onSelectKeyword={handleSelectKeyword} onPickMonth={setSelectedPlannerMonth} />
                      ))}
                    </div>
                  </article>
                </>
              ) : (
                <>
                  <div className={styles.analyticsGrid}>
                    <article className={styles.chartPanel}>
                      <div className={styles.panelHeader}>
                        <div>
                          <p className={styles.panelEyebrow}>ANALYSIS LOCK</p>
                          <h3 className={styles.panelTitle}>장기 인사이트 준비 중</h3>
                        </div>
                        <span className={styles.summaryPill}>
                          {visibleRun?.analysisSummary?.observedMonths ?? 0}개월 관측
                        </span>
                      </div>

                      <EmptyPanel
                        title="전체 취합이 끝나면 장기 리포트가 열립니다."
                        copy="수집 중에는 월 진행 상태만 보여주고, 모든 월이 완료되면 스테디 키워드·계절 반복·월별 추천/주의 플래너를 한 번에 생성합니다."
                      />

                      <div className={styles.placeholderStats}>
                        <SummaryCard label="분석 개수" value={`Top ${visibleRun?.profile.resultCount ?? form.resultCount}`} hint="선택한 수집 범위" />
                        <SummaryCard
                          label="브랜드 제외"
                          value={visibleRun?.profile.excludeBrandProducts || form.excludeBrandProducts ? "적용" : "미적용"}
                          hint={visibleRun?.profile.excludeBrandProducts || form.excludeBrandProducts ? "기본 사전 + 추가 제외어" : "원본 키워드 기준"}
                        />
                        <SummaryCard
                          label="인사이트 생성"
                          value={visibleRun?.analysisReady ? "완료" : "대기"}
                          hint={visibleRun?.analysisReady ? "전체 월 완료 기준" : "전체 취합 후 활성화"}
                        />
                      </div>
                    </article>

                    <article className={styles.previewPanel}>
                      <div className={styles.panelHeader}>
                        <div>
                          <p className={styles.panelEyebrow}>PREVIEW</p>
                          <h3 className={styles.panelTitle}>최근 수집 월 미리보기</h3>
                        </div>
                        <span className={styles.summaryPill}>
                          {snapshotPanel ? `${snapshotPanel.page}/${snapshotPanel.totalPages}` : `1/${getTrendTotalPages(form.resultCount)}`}
                        </span>
                      </div>

                      {visibleRun?.latestCompletedPeriod ? (
                        <>
                          <div className={styles.previewToolbar}>
                            <label className={styles.field}>
                              <span className={styles.fieldLabel}>조회 월</span>
                              <select
                                className={styles.fieldInput}
                                value={snapshotPanel?.period ?? visibleRun.latestCompletedPeriod}
                                onChange={(event) => void loadSnapshots(apiBaseUrl, visibleRun, event.target.value, 1, setSnapshotPanel)}
                              >
                                {[...new Set(visibleRun.tasks.filter((task) => task.status === "completed").map((task) => task.period))]
                                  .sort((left, right) => right.localeCompare(left))
                                  .map((period) => (
                                    <option key={period} value={period}>
                                      {period}
                                    </option>
                                  ))}
                              </select>
                            </label>

                            <div className={styles.previewPager}>
                              <button
                                className={styles.secondaryButton}
                                type="button"
                                onClick={() =>
                                  visibleRun && snapshotPanel && apiBaseUrl
                                    ? void loadSnapshots(apiBaseUrl, visibleRun, snapshotPanel.period, snapshotPanel.page - 1, setSnapshotPanel)
                                    : undefined
                                }
                                disabled={!snapshotPanel || snapshotPanel.page <= 1 || snapshotPanel.loading}
                              >
                                <ArrowLeft size={14} />
                                이전
                              </button>
                              <button
                                className={styles.secondaryButton}
                                type="button"
                                onClick={() =>
                                  visibleRun && snapshotPanel && apiBaseUrl
                                    ? void loadSnapshots(apiBaseUrl, visibleRun, snapshotPanel.period, snapshotPanel.page + 1, setSnapshotPanel)
                                    : undefined
                                }
                                disabled={!snapshotPanel || snapshotPanel.page >= snapshotPanel.totalPages || snapshotPanel.loading}
                              >
                                다음
                                <ArrowRight size={14} />
                              </button>
                            </div>
                          </div>

                          {snapshotPanel?.error ? <p className={styles.inlineError}>{snapshotPanel.error}</p> : null}

                          {visibleItems.length ? (
                            <ol className={styles.keywordList}>
                              {visibleItems.map((item) => (
                                <li key={`${item.period}-${item.rank}`} className={styles.keywordItem}>
                                  <span className={styles.keywordRank}>{item.rank}</span>
                                  <div className={styles.keywordCopy}>
                                    <strong>{item.keyword}</strong>
                                    <span>
                                      {item.period} · {item.brandExcluded ? "브랜드 제외어" : "분석 포함"}
                                    </span>
                                  </div>
                                </li>
                              ))}
                            </ol>
                          ) : (
                            <EmptyPanel
                              title="수집 결과를 기다리는 중입니다."
                              copy="첫 월 수집이 끝나면 여기에서 바로 실제 키워드 20개 미리보기를 볼 수 있습니다."
                            />
                          )}
                        </>
                      ) : (
                        <EmptyPanel
                          title="아직 완료된 월이 없습니다."
                          copy="분석이 시작되면 가장 먼저 끝난 월의 인기검색어를 여기서 확인할 수 있습니다."
                        />
                      )}
                    </article>
                  </div>

                  <article className={styles.analysisPanel}>
                    <div className={styles.panelHeader}>
                      <div>
                        <p className={styles.panelEyebrow}>INSIGHT</p>
                        <h3 className={styles.panelTitle}>세일즈 트렌드 분석</h3>
                      </div>
                    </div>

                    <div className={styles.placeholderGrid}>
                      <EmptyPanel
                        title="전체 취합 완료 후 장기 인사이트를 생성합니다."
                        copy="수집 중에는 진행 상태만 보여주고, 완료되면 스테디 키워드·계절 반복 키워드·월별 준비/조심 플래너를 한 번에 생성합니다."
                      />
                    </div>
                  </article>
                </>
              )}
            </div>
          </section>
        </div>

        {actionModal ? (
          <div className={styles.modalOverlay} role="presentation">
            <div className={styles.modalCard} role="dialog" aria-modal="true" aria-labelledby="trend-run-action-title">
              <div className={styles.modalHeader}>
                <p className={styles.surfaceEyebrow}>ACTION</p>
                <h3 id="trend-run-action-title" className={styles.panelTitle}>
                  {actionModal.type === "cancel" ? "데이터 취합을 중지할까요?" : "현재 데이터 취합 런을 삭제할까요?"}
                </h3>
                <p className={styles.surfaceDescription}>
                  {actionModal.type === "cancel"
                    ? "현재 진행 중인 취합을 완전히 취소합니다. 이미 끝난 월 데이터는 그대로 유지됩니다."
                    : "현재 런과 미완료 데이터만 지우고, 이미 완성된 월 캐시는 다음 분석을 위해 남겨둡니다."}
                </p>
              </div>
              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => setActionModal(null)}
                  disabled={actionSubmitting}
                >
                  돌아가기
                </button>
                <button
                  type="button"
                  className={`${styles.secondaryButton} ${actionModal.type === "delete" ? styles.dangerButton : styles.warningButton}`}
                  onClick={() => void handleConfirmAction()}
                  disabled={actionSubmitting}
                >
                  {actionSubmitting ? (
                    <>
                      <LoaderCircle className={styles.spinningIcon} size={14} />
                      처리 중...
                    </>
                  ) : actionModal.type === "cancel" ? (
                    <>
                      <PauseCircle size={14} />
                      중지 확인
                    </>
                  ) : (
                    <>
                      <Trash2 size={14} />
                      삭제 확인
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function FilterGroup<T extends string>({
  title,
  hint,
  options,
  values,
  onToggle
}: {
  title: string;
  hint: string;
  options: readonly (readonly [T, string])[];
  values: T[];
  onToggle: (value: T) => void;
}) {
  return (
    <div className={styles.filterGroup}>
      <div className={styles.optionHeader}>
        <span className={styles.optionTitle}>{title}</span>
        <span className={styles.optionHint}>{hint}</span>
      </div>
      <div className={styles.chipRow}>
        {options.map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={values.includes(value) ? `${styles.chipButton} ${styles.chipButtonActive}` : styles.chipButton}
            onClick={() => onToggle(value)}
            aria-pressed={values.includes(value)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ProgressStat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className={styles.progressStat}>
      <span className={styles.progressStatLabel}>{label}</span>
      <strong className={styles.progressStatValue}>{value}</strong>
      <span className={styles.progressStatHint}>{hint}</span>
    </div>
  );
}

function GuideStep({
  number,
  title,
  body,
  command,
  link
}: {
  number: string;
  title: string;
  body: string;
  command: string;
  link: string;
}) {
  return (
    <article className={styles.guideStep}>
      <div className={styles.guideStepBadge}>{number}</div>
      <div className={styles.guideStepBody}>
        <div className={styles.guideStepHeader}>
          <h3>{title}</h3>
          <a href={link} target="_blank" rel="noreferrer" aria-label={`${title} 공식 문서 열기`}>
            공식 문서
            <ExternalLink size={13} />
          </a>
        </div>
        <p>{body}</p>
        <pre className={styles.commandBlock}>{command}</pre>
      </div>
    </article>
  );
}

function SummaryCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className={styles.summaryCard}>
      <span className={styles.summaryCardLabel}>{label}</span>
      <strong className={styles.summaryCardValue}>{value}</strong>
      <span className={styles.summaryCardHint}>{hint}</span>
    </div>
  );
}

function EmptyPanel({ title, copy }: { title: string; copy: string }) {
  return (
    <div className={styles.emptyPanel}>
      <Sparkles size={18} />
      <div>
        <strong>{title}</strong>
        <p>{copy}</p>
      </div>
    </div>
  );
}

function HeroMetricCard({ metric }: { metric: TrendAnalysisHeroMetric }) {
  return (
    <article className={styles.heroMetricCard}>
      <div className={styles.heroMetricHeader}>
        <span className={styles.heroMetricLabel}>
          {heroMetricIcon(metric.id)}
          {metric.label}
        </span>
        <span className={`${styles.confidenceBadge} ${confidenceBadgeClass(metric.confidenceLabel)}`}>신뢰도 {metric.confidence}</span>
      </div>
      <strong className={styles.heroMetricKeyword}>{metric.keyword}</strong>
      <p className={styles.heroMetricReason}>{metric.rationale}</p>
      <Sparkline points={metric.sparkline} />
      <div className={styles.heroMetricFooter}>
        <span>{metric.monthLabel ?? "장기 관측 기반"}</span>
      </div>
    </article>
  );
}

function InsightCard({
  card,
  onSelectKeyword,
  onPickMonth
}: {
  card: TrendAnalysisCard;
  onSelectKeyword: (keyword: string) => void;
  onPickMonth: (month: string) => void;
}) {
  const icon = cardIcon(card.kind);

  return (
    <article className={styles.insightCard}>
      <div className={styles.insightCardHeader}>
        <div className={styles.insightIcon}>{icon}</div>
        <div>
          <h4 className={styles.insightTitle}>{card.title}</h4>
          <p className={styles.insightDescription}>{card.description}</p>
        </div>
      </div>

      {card.items.length ? (
        <div className={styles.insightItems}>
          {card.items.slice(0, 4).map((item) => (
            <div key={`${card.kind}-${item.keyword}`} className={styles.insightItem}>
              <div className={styles.insightItemHeader}>
                <div>
                  <strong className={styles.keywordHeadline}>{item.keyword}</strong>
                  <p className={styles.keywordRationale}>{item.rationale}</p>
                </div>
                <span className={`${styles.confidenceBadge} ${confidenceBadgeClass(item.confidenceLabel)}`}>
                  신뢰도 {item.confidence}
                </span>
              </div>

              <Sparkline points={item.sparkline} />

              <div className={styles.insightMetaRow}>
                <span>최근 점수 {item.latestScore.toFixed(1)}</span>
                <span>추세 {formatSigned(item.delta)}</span>
                <span>등장 {item.appearanceCount}개월</span>
              </div>

              <div className={styles.dualPillRow}>
                {item.recommendedMonths.length ? (
                  <div className={styles.pillGroup}>
                    <span className={styles.pillCaption}>추천 월</span>
                    <div className={styles.recommendRow}>
                      {item.recommendedMonths.slice(0, 3).map((period) => (
                        <button
                          key={`${item.keyword}-rec-${period}`}
                          type="button"
                          className={styles.summaryPillButton}
                          onClick={() => onPickMonth(parseMonthLabel(period))}
                        >
                          {period}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {item.cautionMonths.length ? (
                  <div className={styles.pillGroup}>
                    <span className={styles.pillCaption}>주의 월</span>
                    <div className={styles.recommendRow}>
                      {item.cautionMonths.slice(0, 3).map((period) => (
                        <button
                          key={`${item.keyword}-caution-${period}`}
                          type="button"
                          className={`${styles.summaryPillButton} ${styles.summaryPillDanger}`}
                          onClick={() => onPickMonth(parseMonthLabel(period))}
                        >
                          {period}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <button type="button" className={styles.inlineLinkButton} onClick={() => onSelectKeyword(item.keyword)}>
                단일 키워드 상세 보기
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className={styles.inlineHelper}>아직 이 유형을 안정적으로 보여줄 만큼의 데이터가 충분하지 않습니다.</p>
      )}
    </article>
  );
}

function SeasonalityHeatmap({
  rows,
  mode,
  selectedKeyword,
  onSelect
}: {
  rows: TrendAnalysisHeatmapRow[];
  mode: "timeline" | "season";
  selectedKeyword: string | null;
  onSelect: (keyword: string) => void;
}) {
  if (!rows.length) {
    return null;
  }

  const cells = rows.flatMap((row) => (mode === "timeline" ? row.periodCells : row.seasonCells));
  const maxValue = Math.max(...cells.map((cell) => cell.value), 1);
  const minValue = Math.min(...cells.map((cell) => cell.value), 0);
  const axisCells = mode === "timeline" ? rows[0]?.periodCells ?? [] : rows[0]?.seasonCells ?? [];
  const gridStyle = {
    gridTemplateColumns: `repeat(${Math.max(axisCells.length, 1)}, minmax(0, 1fr))`
  };
  const timelineMarkers =
    mode === "timeline"
      ? axisCells
          .map((cell, index, list) => {
            const month = cell.label.slice(5, 7);
            const year = Number(cell.label.slice(0, 4));
            const isMarker = (month === "01" && year <= 2025) || index === list.length - 1;
            if (!isMarker) {
              return null;
            }

            return {
              key: cell.key,
              label: month === "01" ? cell.label.slice(0, 4) : cell.label,
              position: list.length <= 1 ? 0 : (index / (list.length - 1)) * 100
            };
          })
          .filter((marker): marker is { key: string; label: string; position: number } => Boolean(marker))
      : [];

  return (
    <div className={mode === "timeline" ? `${styles.heatmapWrap} ${styles.heatmapWrapTimeline}` : styles.heatmapWrap}>
      <div className={mode === "timeline" ? `${styles.heatmapHeader} ${styles.heatmapHeaderTimeline}` : styles.heatmapHeader}>
        <span>핵심 키워드</span>
        {mode === "timeline" ? (
          <div className={styles.timelineScale}>
            <span className={styles.timelineScaleHint}>63개월 타임라인</span>
            <div className={styles.timelineScaleTrack} />
            {timelineMarkers.map((marker) => (
              <span key={marker.key} className={styles.timelineScaleMarker} style={{ left: `${marker.position}%` }}>
                {marker.label}
              </span>
            ))}
          </div>
        ) : (
          <div className={styles.heatmapAxis} style={gridStyle}>
            {axisCells.map((cell) => (
              <span key={cell.key}>{cell.label}</span>
            ))}
          </div>
        )}
      </div>
      <div className={styles.heatmapRows}>
        {rows.map((row) => (
          <button
            key={row.keyword}
            type="button"
            className={
              row.keyword === selectedKeyword
                ? `${styles.heatmapRow} ${mode === "timeline" ? styles.heatmapRowTimeline : ""} ${styles.heatmapRowActive}`
                : `${styles.heatmapRow} ${mode === "timeline" ? styles.heatmapRowTimeline : ""}`
            }
            onClick={() => onSelect(row.keyword)}
          >
            <div className={styles.heatmapLabel}>
              <strong>{row.keyword}</strong>
              <span>{mode === "timeline" ? row.timelineRationale : row.seasonRationale}</span>
              {mode === "timeline" ? (
                <div className={styles.heatmapLabelMeta}>
                  <span className={styles.heatmapMetaBadge}>{row.timelineStats.appearanceCount}개월</span>
                  <span className={styles.heatmapMetaBadge}>{row.timelineStats.peakWindowLabel}</span>
                  <span className={styles.heatmapMetaBadge}>{formatSigned(row.timelineStats.recentDelta)}</span>
                </div>
              ) : null}
            </div>
            <div className={mode === "timeline" ? `${styles.heatmapCells} ${styles.heatmapCellsTimeline}` : styles.heatmapCells} style={gridStyle}>
              {(mode === "timeline" ? row.periodCells : row.seasonCells).map((cell) => (
                <span
                  key={`${row.keyword}-${cell.key}`}
                  className={
                    mode === "timeline"
                      ? `${styles.heatmapCell} ${styles.heatmapTimelineCell} ${cell.label.slice(5, 7) === "01" ? styles.heatmapTimelineCellYear : ""} ${
                          ["04", "07", "10"].includes(cell.label.slice(5, 7)) ? styles.heatmapTimelineCellQuarter : ""
                        }`
                      : styles.heatmapCell
                  }
                  style={{ background: mode === "timeline" ? timelineHeatmapColor(cell.value, maxValue) : heatmapColor(cell.value, minValue, maxValue) }}
                  title={`${row.keyword} · ${cell.label} · 점수 ${cell.value.toFixed(1)}`}
                />
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function KeywordDrilldownCard({
  detail,
  onPickMonth
}: {
  detail: TrendKeywordDrilldownSeries | null;
  onPickMonth: (month: string) => void;
}) {
  if (!detail) {
    return (
      <EmptyPanel
        title="키워드를 선택해 주세요."
        copy="히트맵이나 인사이트 카드에서 키워드를 선택하면 63개월 드릴다운과 계절 요약을 볼 수 있습니다."
      />
    );
  }

  return (
    <div className={styles.drilldownCard}>
      <div className={styles.drilldownHeader}>
        <div>
          <p className={styles.panelEyebrow}>DRILLDOWN</p>
          <h4 className={styles.insightTitle}>{detail.keyword}</h4>
          <p className={styles.keywordRationale}>{detail.rationale}</p>
        </div>
        <span className={`${styles.confidenceBadge} ${confidenceBadgeClass(detail.confidenceLabel)}`}>신뢰도 {detail.confidence}</span>
      </div>

      <div className={styles.drilldownMetricGrid}>
        <MetricBadge label="관측 개월 수" value={`${detail.observationMonths}개월`} />
        <MetricBadge
          label="최근 추세"
          value={formatSigned(detail.recentTrendValue)}
          tone={detail.recentTrendValue > 0 ? "positive" : detail.recentTrendValue < 0 ? "negative" : "neutral"}
          tooltip={detail.recentTrendExplanation}
        />
        <MetricBadge
          label="계절 반복 점수"
          value={`${Math.round(detail.seasonalityScore)}점`}
          scoreTone={detail.seasonalityScoreLabel}
          tooltip={detail.seasonalityExplanation}
        />
        <MetricBadge
          label="최근 유지력"
          value={`${Math.round(detail.recentRetentionValue)}%`}
          tooltip={detail.recentRetentionExplanation}
        />
      </div>

      <div className={styles.drilldownSection}>
        <span className={styles.drilldownLabel}>최근 12개월</span>
        <Sparkline points={detail.recentPoints} />
      </div>

      <div className={styles.drilldownSection}>
        <span className={styles.drilldownLabel}>63개월 누적</span>
        <Sparkline points={detail.points} />
      </div>

      <div className={styles.drilldownSection}>
        <span className={styles.drilldownLabel}>계절 강세 요약</span>
        <SeasonBars points={detail.seasonalityPoints} />
      </div>

      <div className={styles.dualPillRow}>
        <div className={styles.pillGroup}>
          <span className={styles.pillCaption}>추천 월</span>
          <div className={styles.recommendRow}>
            {detail.recommendedMonths.map((month) => (
              <button key={`${detail.keyword}-drill-rec-${month}`} type="button" className={styles.summaryPillButton} onClick={() => onPickMonth(parseMonthLabel(month))}>
                {month}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.pillGroup}>
          <span className={styles.pillCaption}>주의 월</span>
          <div className={styles.recommendRow}>
            {detail.cautionMonths.map((month) => (
              <button
                key={`${detail.keyword}-drill-caution-${month}`}
                type="button"
                className={`${styles.summaryPillButton} ${styles.summaryPillDanger}`}
                onClick={() => onPickMonth(parseMonthLabel(month))}
              >
                {month}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricBadge({
  label,
  value,
  tooltip,
  tone = "neutral",
  scoreTone
}: {
  label: string;
  value: string;
  tooltip?: string;
  tone?: "positive" | "negative" | "neutral";
  scoreTone?: "high" | "medium" | "low";
}) {
  const toneClass =
    scoreTone === "high"
      ? styles.metricBadgeHigh
      : scoreTone === "medium"
        ? styles.metricBadgeMedium
        : scoreTone === "low"
          ? styles.metricBadgeLow
          : tone === "positive"
            ? styles.metricBadgePositive
            : tone === "negative"
              ? styles.metricBadgeNegative
              : "";

  return (
    <div className={`${styles.metricBadge} ${toneClass}`.trim()}>
      <div className={styles.metricBadgeHeader}>
        <span className={styles.metricBadgeTitle}>{label}</span>
        {tooltip ? <TooltipInfo content={tooltip} /> : null}
      </div>
      <strong>{value}</strong>
    </div>
  );
}

function TooltipInfo({ content }: { content: string }) {
  return (
    <span className={styles.tooltipWrap}>
      <button type="button" className={styles.tooltipButton} aria-label={content}>
        <CircleHelp size={14} />
      </button>
      <span className={styles.tooltipBubble} role="tooltip">
        {content}
      </span>
    </span>
  );
}

function AnnualPlannerGrid({
  months,
  selectedMonth,
  onSelect
}: {
  months: TrendMonthlyExplorer[];
  selectedMonth: string;
  onSelect: (month: string) => void;
}) {
  return (
    <div className={styles.plannerGrid}>
      {months.map((month) => (
        <button
          key={month.month}
          type="button"
          className={month.month === selectedMonth ? `${styles.plannerMonthCard} ${styles.plannerMonthCardActive}` : styles.plannerMonthCard}
          onClick={() => onSelect(month.month)}
        >
          <div className={styles.plannerMonthHeader}>
            <strong>{month.label}</strong>
            <span>{month.seasonLabel}</span>
          </div>
          <div className={styles.plannerMonthBody}>
            <div>
              <span className={styles.pillCaption}>추천</span>
              <p>{month.recommendedKeywords[0]?.keyword ?? "준비 키워드 대기"}</p>
            </div>
            <div>
              <span className={styles.pillCaption}>주의</span>
              <p>{month.cautionKeywords[0]?.keyword ?? "보수적 경고 없음"}</p>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function MonthExplorerBoard({ month }: { month: TrendMonthlyExplorer | null }) {
  if (!month) {
    return null;
  }

  return (
    <div className={styles.monthExplorer}>
      <div className={styles.monthExplorerHeader}>
        <div>
          <p className={styles.panelEyebrow}>MONTH DETAIL</p>
          <h3 className={styles.panelTitle}>
            {month.label} 준비 / 조심 보드
          </h3>
          <p className={styles.surfaceDescription}>
            {month.seasonLabel} 기준으로 최근 5년 반복 패턴을 바탕으로 추천과 주의를 같이 보여줍니다.
          </p>
        </div>
        <span className={`${styles.confidenceBadge} ${month.monthConfidence >= 80 ? styles.confidenceHigh : month.monthConfidence >= 58 ? styles.confidenceMedium : styles.confidenceLow}`}>
          월 신뢰도 {month.monthConfidence}
        </span>
      </div>

      <div className={styles.monthTrendStrip}>
        <span className={styles.drilldownLabel}>최근 5년 해당 월 재현성</span>
        <Sparkline points={month.historicalMonthScores} />
      </div>

      <div className={styles.monthExplorerColumns}>
        <MonthKeywordColumn title="준비 추천" tone="recommend" items={month.recommendedKeywords} />
        <MonthKeywordColumn title="조심" tone="caution" items={month.cautionKeywords} />
      </div>
    </div>
  );
}

function MonthKeywordColumn({
  title,
  tone,
  items
}: {
  title: string;
  tone: "recommend" | "caution";
  items: TrendAnalysisCard["items"];
}) {
  return (
    <div className={tone === "recommend" ? styles.monthKeywordColumn : `${styles.monthKeywordColumn} ${styles.monthKeywordColumnDanger}`}>
      <div className={styles.monthKeywordColumnHeader}>
        <strong>{title}</strong>
        <span>{tone === "recommend" ? "앞으로 준비하면 좋은 키워드" : "월별로 보수적으로 봐야 할 키워드"}</span>
      </div>
      {items.length ? (
        <div className={styles.monthKeywordList}>
          {items.map((item) => (
            <div key={`${title}-${item.keyword}`} className={styles.monthKeywordItem}>
              <div className={styles.monthKeywordTop}>
                <strong>{item.keyword}</strong>
                <span className={`${styles.confidenceBadge} ${confidenceBadgeClass(item.confidenceLabel)}`}>{item.confidence}</span>
              </div>
              <p>{item.rationale}</p>
              <Sparkline points={item.sparkline} />
            </div>
          ))}
        </div>
      ) : (
        <p className={styles.monthCellEmpty}>현재 기준으로 강하게 표시할 항목이 아직 없습니다.</p>
      )}
    </div>
  );
}

function SeasonBars({ points }: { points: TrendAnalysisSeriesPoint[] }) {
  if (!points.length) {
    return null;
  }

  const maxValue = Math.max(...points.map((point) => point.value), 1);

  return (
    <div className={styles.seasonBars}>
      {points.map((point) => (
        <div key={point.period} className={styles.seasonBarItem}>
          <span
            className={styles.seasonBar}
            style={{ height: `${Math.max(12, (point.value / maxValue) * 72)}px` }}
            title={`${point.period} ${point.value.toFixed(1)}`}
          />
          <label>{point.period}</label>
        </div>
      ))}
    </div>
  );
}

function Sparkline({ points }: { points: TrendAnalysisSeriesPoint[] }) {
  if (!points.length) {
    return null;
  }

  const width = 240;
  const height = 74;
  const maxValue = Math.max(...points.map((point) => point.value), 1);
  const minValue = Math.min(...points.map((point) => point.value), 0);
  const range = Math.max(maxValue - minValue, 1);

  const path = points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * width;
      const y = height - ((point.value - minValue) / range) * (height - 8) - 4;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg className={styles.sparkline} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={path} className={styles.sparklineShadow} />
      <path d={path} className={styles.sparklinePath} />
    </svg>
  );
}

async function refreshBoard(
  apiBaseUrl: string,
  setTrendBoard: (value: TrendAdminBoard | null) => void,
  setCurrentRun: Dispatch<SetStateAction<TrendRunDetail | null>>,
  setRefreshing: (value: boolean) => void,
  setError: (value: string | null) => void
) {
  if (!apiBaseUrl) {
    return;
  }

  setRefreshing(true);
  const response = await api<TrendBoardResponse>(apiBaseUrl, "/trends/admin/board");
  setRefreshing(false);

  if (!response.ok) {
    setError(response.message ?? "데이터 취합 상태를 새로고침하지 못했습니다.");
    return;
  }

  setError(null);
  setTrendBoard(response.board);
  setCurrentRun((previous) => {
    if (!response.board.runs.length) {
      return null;
    }

    if (!previous) {
      return response.board.runs[0];
    }

    const matched = response.board.runs.find((run) => run.id === previous.id);
    return matched ? mergeRunDetail(previous, matched) : response.board.runs[0];
  });
}

async function startTrendCollectionRequest(apiBaseUrl: string, payload: TrendProfileInput) {
  return api<TrendCollectResponse>(apiBaseUrl, "/trends/collect", {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      forceRefresh: true
    })
  });
}

async function collectBestProductsForCategory(
  apiBaseUrl: string,
  category: TrendCategoryNode,
  settings: TrendCollectionSettingsSnapshot,
  runId?: string
) {
  return api<BestProductCollectResponse>(apiBaseUrl, "/products/best/collect", {
    method: "POST",
    body: JSON.stringify({
      categoryCid: category.cid,
      categoryPath: category.fullPath,
      categoryName: category.name,
      runId,
      limit: Math.min(20, Math.max(10, settings.resultCount)),
      excludeBrandProducts: settings.excludeBrandProducts,
      customExcludedTerms: settings.customExcludedTerms
    })
  });
}

async function refreshBestProductStatus(
  apiBaseUrl: string,
  setBestProductStatus: Dispatch<SetStateAction<BestProductStatusState>>
) {
  const response = await api<BestProductStatusResponse>(apiBaseUrl, "/products/best/status");

  if (!response.ok) {
    setBestProductStatus({
      ...initialBestProductStatus,
      credentialStatus: "unknown",
      message: response.message ?? "분석 누적 상태 확인 실패"
    });
    return;
  }

  setBestProductStatus({
    ready: response.ready,
    credentialStatus: response.credentialStatus,
    outputFileName: response.outputFileName,
    message: response.ready ? "트렌드 분석 누적 준비됨, 완료된 분석 후보 누적 가능" : "트렌드 분석 누적 준비 확인 중"
  });
}

async function retryApiOperation<T extends { ok: boolean; code?: string; message?: string }>(
  operation: () => Promise<T>,
  options: {
    maxAttempts: number;
    delayMs: number;
    shouldStop?: () => boolean;
    onRetry?: (event: { attempt: number; maxAttempts: number; nextDelayMs: number; response: T }) => void | Promise<void>;
  }
) {
  const maxAttempts = Math.max(1, options.maxAttempts);
  const delayMs = Math.max(0, options.delayMs);
  let latestResponse: T | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    latestResponse = await operation();

    if (latestResponse.ok || !isRetryableApiResponse(latestResponse) || attempt >= maxAttempts || options.shouldStop?.()) {
      return latestResponse;
    }

    await options.onRetry?.({
      attempt,
      maxAttempts,
      nextDelayMs: delayMs,
      response: latestResponse
    });

    if (delayMs > 0) {
      await sleep(delayMs);
    }
  }

  return latestResponse!;
}

function isRetryableApiResponse(response: { ok: boolean; code?: string }) {
  if (response.ok) {
    return false;
  }

  return (
    response.code === "NETWORK_ERROR" ||
    response.code === "HTTP_408" ||
    response.code === "HTTP_429" ||
    response.code === "HTTP_500" ||
    response.code === "HTTP_502" ||
    response.code === "HTTP_503" ||
    response.code === "HTTP_504"
  );
}

async function sendTrendRunHeartbeat(apiBaseUrl: string, runId: string) {
  return api<TrendRunActionResponse>(apiBaseUrl, `/trends/runs/${runId}/heartbeat`, {
    method: "POST"
  });
}

async function waitForTrendRunToSettle(
  apiBaseUrl: string,
  runId: string,
  onTransientApiFailure?: (event: { attempt: number; maxAttempts: number; message?: string }) => void | Promise<void>
): Promise<TrendRunSettleResult> {
  let latestRun: TrendRunDetail | null = null;
  let transientApiFailures = 0;

  while (true) {
    await sleep(AUTO_COLLECTION_POLL_MS);
    const heartbeatResponse = await sendTrendRunHeartbeat(apiBaseUrl, runId);

    if (!heartbeatResponse.ok) {
      if (isRetryableApiResponse(heartbeatResponse) && transientApiFailures < AUTO_COLLECTION_API_RETRY_ATTEMPTS) {
        transientApiFailures += 1;
        await onTransientApiFailure?.({
          attempt: transientApiFailures,
          maxAttempts: AUTO_COLLECTION_API_RETRY_ATTEMPTS,
          message: heartbeatResponse.message
        });
        await sleep(AUTO_COLLECTION_API_RETRY_DELAY_MS);
        continue;
      }

      return {
        id: runId,
        status: "failed" as const
      };
    }

    const response = await api<TrendRunResponse>(apiBaseUrl, `/trends/runs/${runId}`);

    if (!response.ok) {
      if (isRetryableApiResponse(response) && transientApiFailures < AUTO_COLLECTION_API_RETRY_ATTEMPTS) {
        transientApiFailures += 1;
        await onTransientApiFailure?.({
          attempt: transientApiFailures,
          maxAttempts: AUTO_COLLECTION_API_RETRY_ATTEMPTS,
          message: response.message
        });
        await sleep(AUTO_COLLECTION_API_RETRY_DELAY_MS);
        continue;
      }

      return {
        id: runId,
        status: "failed" as const
      };
    }

    transientApiFailures = 0;
    latestRun = response.run;

    if (latestRun.status !== "queued" && latestRun.status !== "running") {
      return latestRun;
    }
  }
}

function isTrendRunDetail(run: TrendRunSettleResult): run is TrendRunDetail {
  return "profile" in run && "tasks" in run;
}

function upsertRunOnBoard(previous: TrendAdminBoard | null, run: TrendRunDetail): TrendAdminBoard {
  return previous
    ? {
        ...previous,
        generatedAt: new Date().toISOString(),
        runs: [run, ...previous.runs.filter((item) => item.id !== run.id)].slice(0, 8)
      }
    : {
        generatedAt: new Date().toISOString(),
        metrics: [],
        profiles: [],
        runs: [run]
      };
}

async function fetchTrendCategories(apiBaseUrl: string, cid: string) {
  if (!apiBaseUrl) {
    return cid === "0" ? STATIC_TREND_ROOT_CATEGORIES : getStaticTrendCategoryChildren(Number(cid));
  }

  const response = await api<TrendCategoryResponse>(apiBaseUrl, `/trends/categories/${cid}`);

  if (response.ok && response.nodes.length) {
    return response.nodes;
  }

  return cid === "0" ? STATIC_TREND_ROOT_CATEGORIES : getStaticTrendCategoryChildren(Number(cid));
}

async function fetchTrendCategoriesForAutoQueue(_apiBaseUrl: string, cid: number) {
  return getStaticTrendCategoryChildren(cid);
}

async function loadSnapshots(
  apiBaseUrl: string,
  run: TrendRunDetail,
  period: string,
  page: number,
  setSnapshotPanel: (value: SnapshotPanelState | ((previous: SnapshotPanelState | null) => SnapshotPanelState | null)) => void
) {
  setSnapshotPanel((previous) => ({
    period,
    page: previous?.page ?? 1,
    totalPages: previous?.totalPages ?? getTrendTotalPages(run.profile.resultCount),
    totalItems: previous?.totalItems ?? run.profile.resultCount,
    items: previous?.items ?? run.snapshotsPreview,
    loading: true,
    error: null
  }));

  const response = await api<TrendSnapshotPageResponse>(
    apiBaseUrl,
    `/trends/runs/${run.id}/snapshots?period=${encodeURIComponent(period)}&page=${page}`
  );

  if (!response.ok) {
    setSnapshotPanel((previous) =>
      previous
        ? {
            ...previous,
            loading: false,
            error: response.message ?? "월별 키워드 미리보기를 불러오지 못했습니다."
          }
        : null
    );
    return;
  }

  setSnapshotPanel({
    period: response.period,
    page: response.page,
    totalPages: response.totalPages,
    totalItems: response.totalItems,
    items: response.items,
    loading: false,
    error: null
  });
}

function runProgressPercent(completedTasks: number, totalTasks: number) {
  if (!totalTasks) {
    return 100;
  }

  return Math.min(100, Math.round((completedTasks / totalTasks) * 100));
}

function toggleValue<T extends string>(values: T[], target: T) {
  return values.includes(target) ? values.filter((value) => value !== target) : [...values, target];
}

function buildAnalysisRequestName(
  categoryPath: string,
  form: Pick<TrendFormState, "devices" | "genders" | "ages" | "resultCount" | "excludeBrandProducts">
) {
  const parts = [categoryPath];
  const deviceLabel = formatSelection(form.devices, DEVICE_OPTIONS, "");
  const genderLabel = formatSelection(form.genders, GENDER_OPTIONS, "");
  const ageLabel = formatSelection(form.ages, AGE_OPTIONS, "");

  if (deviceLabel) {
    parts.push(deviceLabel);
  }

  if (genderLabel) {
    parts.push(genderLabel);
  }

  if (ageLabel) {
    parts.push(ageLabel);
  }

  parts.push(`Top${form.resultCount}`);
  if (form.excludeBrandProducts) {
    parts.push("브랜드 제외");
  }

  return parts.join(" · ");
}

function formatProfileSettingPills(profile: TrendRunDetail["profile"]) {
  const labels = [
    `CID ${profile.categoryCid}`,
    `Top ${profile.resultCount}`,
    `기기 ${formatSelection(profile.devices, DEVICE_OPTIONS, "전체")}`,
    `성별 ${formatSelection(profile.genders, GENDER_OPTIONS, "전체")}`,
    `연령 ${formatSelection(profile.ages, AGE_OPTIONS, "전체")}`,
    profile.excludeBrandProducts ? "브랜드 제외" : "원본 키워드"
  ];

  if (profile.excludeBrandProducts && profile.customExcludedTerms.length) {
    labels.push(`제외어 ${profile.customExcludedTerms.join(", ")}`);
  }

  return labels;
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function formatFormSettingPills(form: TrendFormState) {
  const labels = [
    `Top ${form.resultCount}`,
    `기기 ${formatSelection(form.devices, DEVICE_OPTIONS, "전체")}`,
    `성별 ${formatSelection(form.genders, GENDER_OPTIONS, "전체")}`,
    `연령 ${formatSelection(form.ages, AGE_OPTIONS, "전체")}`,
    form.excludeBrandProducts ? "브랜드 제외" : "원본 키워드"
  ];

  const terms = normalizeTrendExcludedTermsForMode(form.excludeBrandProducts, splitTrendExcludedTermsInput(form.customExcludedTerms));
  if (terms.length) {
    labels.push(`제외어 ${terms.join(", ")}`);
  }

  return labels;
}

function formatSettingsSnapshotPills(settings: TrendCollectionSettingsSnapshot) {
  const labels = [
    `Top ${settings.resultCount}`,
    `기기 ${formatSelection(settings.devices, DEVICE_OPTIONS, "전체")}`,
    `성별 ${formatSelection(settings.genders, GENDER_OPTIONS, "전체")}`,
    `연령 ${formatSelection(settings.ages, AGE_OPTIONS, "전체")}`,
    settings.excludeBrandProducts ? "브랜드 제외" : "원본 키워드"
  ];

  if (settings.customExcludedTerms.length) {
    labels.push(`제외어 ${settings.customExcludedTerms.join(", ")}`);
  }

  return labels;
}

function formatSelection<T extends string>(values: readonly T[], options: readonly (readonly [T, string])[], fallback: string) {
  if (!values.length) {
    return fallback;
  }

  const labelMap = new Map(options);
  return values.map((value) => labelMap.get(value) ?? value).join(", ");
}

function runStatusLabel(status: TrendRunDetail["status"]) {
  switch (status) {
    case "running":
      return "수집 중";
    case "queued":
      return "대기";
    case "completed":
      return "완료";
    case "cancelled":
      return "중지됨";
    case "failed":
      return "실패";
    default:
      return status;
  }
}

function autoCollectionStatusLabel(status: AutoCollectionState["status"]) {
  switch (status) {
    case "preparing":
      return "준비";
    case "running":
      return "순회 중";
    case "stopping":
      return "종료 중";
    case "stopped":
      return "중지됨";
    case "completed":
      return "완료";
    case "failed":
      return "실패";
    default:
      return "대기";
  }
}

function runBadgeClass(status: TrendRunDetail["status"]) {
  switch (status) {
    case "completed":
      return styles.badgeStable;
    case "running":
    case "queued":
      return styles.badgeProgress;
    case "cancelled":
      return styles.badgeMuted;
    case "failed":
      return styles.badgeDanger;
    default:
      return styles.badgeMuted;
  }
}

function processingModeLabel(mode?: TrendRunDetail["processingMode"]) {
  switch (mode) {
    case "cache":
      return "캐시 사용 중";
    case "naver":
      return "네이버 수집 중";
    case "reused-report":
      return "리포트 재사용";
    case "idle":
      return "수집 완료";
    default:
      return "대기";
  }
}

function processingModeHint(mode?: TrendRunDetail["processingMode"]) {
  switch (mode) {
    case "cache":
      return "저장된 월 데이터를 즉시 반영";
    case "naver":
      return "누락 월만 순차 수집";
    case "reused-report":
      return "완료 리포트 캐시 반환";
    case "idle":
      return "추가 수집 없음";
    default:
      return "처리 경로 대기";
  }
}

function etaLabel(minutes?: number) {
  if (!minutes) {
    return "계산 중";
  }

  if (minutes < 60) {
    return `${minutes}분`;
  }

  const hours = Math.floor(minutes / 60);
  const remain = minutes % 60;
  return remain ? `${hours}시간 ${remain}분` : `${hours}시간`;
}

function runEtaLabel(run: TrendRunDetail) {
  if (run.status === "completed") {
    return "완료";
  }

  if (run.status === "failed") {
    return "실패 중지";
  }

  if (run.status === "cancelled") {
    return "중지됨";
  }

  return etaLabel(run.etaMinutes);
}

function formatDateTime(value?: string) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function confidenceBadgeClass(label: "high" | "medium" | "low") {
  switch (label) {
    case "high":
      return styles.confidenceHigh;
    case "medium":
      return styles.confidenceMedium;
    default:
      return styles.confidenceLow;
  }
}

function cardIcon(kind: TrendAnalysisCard["kind"]) {
  switch (kind) {
    case "steady":
      return <CheckCircle2 size={18} />;
    case "seasonal":
      return <CalendarClock size={18} />;
    case "monthly":
      return <BarChart3 size={18} />;
    case "event":
      return <Sparkles size={18} />;
    case "recent":
      return <Clock3 size={18} />;
    case "caution":
    default:
      return <ShieldAlert size={18} />;
  }
}

function heroMetricIcon(id: string) {
  switch (id) {
    case "prepare-now":
      return <Target size={14} />;
    case "season-window":
      return <Sparkles size={14} />;
    case "caution-now":
      return <ShieldAlert size={14} />;
    case "steady-anchor":
    default:
      return <Flame size={14} />;
  }
}

function formatSigned(value: number) {
  return value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
}

function parseMonthLabel(value: string) {
  const numeric = value.replace(/[^0-9]/g, "");
  return numeric.padStart(2, "0").slice(0, 2);
}

function heatmapColor(value: number, minValue: number, maxValue: number) {
  const range = Math.max(maxValue - minValue, 1);
  const normalized = Math.max(0, Math.min(1, (value - minValue) / range));
  const alpha = 0.12 + normalized * 0.82;
  return `rgba(41, 69, 93, ${alpha.toFixed(2)})`;
}

function timelineHeatmapColor(value: number, maxValue: number) {
  if (value <= 0) {
    return "rgba(41, 69, 93, 0.08)";
  }

  const normalized = Math.max(0, Math.min(1, value / Math.max(maxValue, 1)));
  const alpha = 0.16 + normalized * 0.42;
  return `rgba(41, 69, 93, ${alpha.toFixed(2)})`;
}

function buildFallbackDrilldownSeries(cards: TrendAnalysisCard[], heatmapRows: TrendAnalysisHeatmapRow[]) {
  const heatmapByKeyword = new Map(heatmapRows.map((row) => [row.keyword, row]));
  const keywordMap = new Map<string, TrendAnalysisKeyword>();

  cards.forEach((card) => {
    card.items.forEach((item) => {
      if (!keywordMap.has(item.keyword)) {
        keywordMap.set(item.keyword, item);
      }
    });
  });

  const allKeywords = Array.from(new Set([...heatmapByKeyword.keys(), ...keywordMap.keys()]));

  return allKeywords.map((keyword) => {
    const item = keywordMap.get(keyword);
    const heatmapRow = heatmapByKeyword.get(keyword);
    const points =
      item?.sparkline ??
      heatmapRow?.periodCells.map((cell) => ({
        period: cell.label,
        value: cell.value
      })) ??
      [];
    const seasonalityPoints =
      heatmapRow?.seasonCells.map((cell) => ({
        period: cell.label,
        value: cell.value
      })) ?? buildSeasonalityPointsFromSparkline(points);
    const observationMonths = item?.appearanceCount ?? heatmapRow?.timelineStats.appearanceCount ?? points.filter((point) => point.value > 0).length;
    const recentTrendValue = item?.delta ?? heatmapRow?.timelineStats.recentDelta ?? deriveRecentTrend(points);
    const recentRetentionValue = roundNumber(
      item ? deriveRecentRetention(item.sparkline) * 100 : deriveRecentRetention(points) * 100,
      1
    );
    const seasonalityScore = roundNumber(deriveSeasonalityScore(points, seasonalityPoints), 0);
    const confidence = item?.confidence ?? heatmapRow?.confidence ?? 0;
    const confidenceLabel = item?.confidenceLabel ?? heatmapRow?.confidenceLabel ?? "low";

    return {
      keyword,
      confidence,
      confidenceLabel,
      rationale: item?.rationale ?? `${keyword}의 최근 흐름과 계절 반복 패턴을 함께 살펴볼 수 있습니다.`,
      observationMonths,
      recentTrendValue,
      seasonalityScore,
      seasonalityScoreLabel: seasonalityScore >= 72 ? "high" : seasonalityScore >= 46 ? "medium" : "low",
      recentRetentionValue,
      recentTrendExplanation: "최근 12개월 평균 점수가 이전 구간 대비 얼마나 좋아졌거나 약해졌는지 보여줍니다.",
      seasonalityExplanation: "같은 시즌에 여러 해 반복 등장했는지, 그리고 한 해 반짝인지 아닌지를 함께 반영한 점수입니다.",
      recentRetentionExplanation: "최근 12개월 중 상위권에 실제로 등장한 달 비율입니다.",
      recommendedMonths: item?.recommendedMonths ?? heatmapRow?.recommendedMonths ?? [],
      cautionMonths: item?.cautionMonths ?? heatmapRow?.cautionMonths ?? [],
      points,
      recentPoints: takeLastPoints(points, 12),
      seasonalityPoints
    } satisfies TrendKeywordDrilldownSeries;
  });
}

function buildSeasonalityPointsFromSparkline(points: TrendAnalysisSeriesPoint[]) {
  const buckets = new Map<string, number[]>();

  points.forEach((point) => {
    const month = point.period.slice(5, 7);
    if (!buckets.has(month)) {
      buckets.set(month, []);
    }
    buckets.get(month)!.push(point.value);
  });

  return Array.from({ length: 12 }, (_, index) => {
    const month = String(index + 1).padStart(2, "0");
    const values = buckets.get(month) ?? [];
    return {
      period: `${index + 1}월`,
      value: roundNumber(averageValue(values), 1)
    };
  });
}

function deriveRecentTrend(points: TrendAnalysisSeriesPoint[]) {
  const recentAverage = averageValue(takeLastPoints(points, 12).map((point) => point.value));
  const previousAverage = averageValue(points.slice(0, Math.max(points.length - 12, 0)).map((point) => point.value));
  return roundNumber(recentAverage - previousAverage, 1);
}

function deriveRecentRetention(points: TrendAnalysisSeriesPoint[]) {
  const recentPoints = takeLastPoints(points, 12);
  if (!recentPoints.length) {
    return 0;
  }

  return recentPoints.filter((point) => point.value > 0).length / recentPoints.length;
}

function deriveSeasonalityScore(points: TrendAnalysisSeriesPoint[], seasonalityPoints: TrendAnalysisSeriesPoint[]) {
  if (!points.length) {
    return 0;
  }

  const monthsPerYear = new Map<string, Set<string>>();
  points.forEach((point) => {
    if (point.value <= 0) {
      return;
    }
    const year = point.period.slice(0, 4);
    const month = point.period.slice(5, 7);
    if (!monthsPerYear.has(month)) {
      monthsPerYear.set(month, new Set());
    }
    monthsPerYear.get(month)!.add(year);
  });

  const observedYears = new Set(points.map((point) => point.period.slice(0, 4))).size || 1;
  const bestRepeatability = Math.max(
    ...Array.from(monthsPerYear.values(), (years) => years.size / observedYears),
    0
  );
  const overallAverage = averageValue(points.map((point) => point.value));
  const peakAverage = Math.max(...seasonalityPoints.map((point) => point.value), 0);
  const concentration = overallAverage > 0 ? peakAverage / overallAverage : 0;
  const observationFactor = Math.min(1, points.filter((point) => point.value > 0).length / 12);

  return Math.max(
    0,
    Math.min(
      100,
      bestRepeatability * 42 + Math.min(concentration, 3) / 3 * 34 + observationFactor * 24
    )
  );
}

function takeLastPoints(points: TrendAnalysisSeriesPoint[], count: number) {
  return points.slice(Math.max(0, points.length - count));
}

function averageValue(values: number[]) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundNumber(value: number, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function mergeRunDetail(previous: TrendRunDetail, next: TrendRunDetail) {
  if (previous.id !== next.id) {
    return next;
  }

  return {
    ...next,
    tasks: next.tasks.length ? next.tasks : previous.tasks,
    snapshotsPreview: next.snapshotsPreview.length ? next.snapshotsPreview : previous.snapshotsPreview,
    confidenceScore: previous.confidenceScore ?? next.confidenceScore,
    analysisSummary: previous.analysisSummary ?? next.analysisSummary,
    analysisCards: previous.analysisCards.length ? previous.analysisCards : next.analysisCards
  };
}

function pickDefaultVisibleRun(runs: TrendRunDetail[]) {
  return (
    runs.find((run) => run.status === "running" || run.status === "queued") ??
    runs.find((run) => run.status === "completed" && run.analysisReady) ??
    runs.find((run) => run.status === "completed") ??
    runs[0] ??
    null
  );
}

function getInitialApiBaseUrl() {
  return ENV_API_BASE_URL;
}

function normalizeApiBaseUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");

  if (!trimmed) {
    return "";
  }

  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}

async function api<T>(apiBaseUrl: string, path: string, init?: RequestInit): Promise<T> {
  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {})
      }
    });
    const text = await response.text();

    if (!response.ok) {
      return {
        ok: false,
        code: `HTTP_${response.status}`,
        message: buildApiErrorMessage(response.status, text)
      } as T;
    }

    return JSON.parse(text) as T;
  } catch (error) {
    return {
      ok: false,
      code: "NETWORK_ERROR",
      message: error instanceof Error ? error.message : "API 연결에 실패했습니다."
    } as T;
  }
}

function buildApiErrorMessage(status: number, responseText: string) {
  const compact = responseText.replace(/\s+/g, " ").trim();

  if (status === 404) {
    return "트렌드 API 경로를 찾지 못했습니다.";
  }

  return `트렌드 API 요청이 실패했습니다. (${status}) ${compact.slice(0, 140)}`;
}
