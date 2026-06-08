CREATE TABLE IF NOT EXISTS trend_profiles (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  start_period TEXT NOT NULL,
  end_period TEXT NOT NULL,
  last_collected_period TEXT,
  last_synced_at TEXT,
  sync_status TEXT NOT NULL,
  latest_run_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  category_cid INTEGER NOT NULL,
  category_path TEXT NOT NULL,
  category_depth INTEGER NOT NULL,
  time_unit TEXT NOT NULL,
  devices_json TEXT NOT NULL,
  genders_json TEXT NOT NULL,
  ages_json TEXT NOT NULL,
  spreadsheet_id TEXT NOT NULL,
  result_count INTEGER NOT NULL DEFAULT 20,
  exclude_brand_products INTEGER NOT NULL DEFAULT 0,
  custom_excluded_terms_json TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS trend_runs (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  status TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  run_type TEXT NOT NULL,
  start_period TEXT NOT NULL,
  end_period TEXT NOT NULL,
  total_tasks INTEGER NOT NULL,
  completed_tasks INTEGER NOT NULL,
  failed_tasks INTEGER NOT NULL,
  total_snapshots INTEGER NOT NULL,
  sheet_url TEXT,
  started_at TEXT,
  completed_at TEXT,
  cancelled_at TEXT,
  browser_heartbeat_at TEXT,
  force_refresh INTEGER NOT NULL DEFAULT 0,
  confidence_score REAL,
  analysis_summary_json TEXT,
  analysis_cards_json TEXT,
  analysis_cached_at TEXT,
  failure_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trend_tasks (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  period TEXT NOT NULL,
  status TEXT NOT NULL,
  completed_pages INTEGER NOT NULL,
  total_pages INTEGER NOT NULL,
  retry_count INTEGER NOT NULL,
  source TEXT,
  started_at TEXT,
  completed_at TEXT,
  failure_reason TEXT,
  failure_snippet TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trend_snapshots (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  period TEXT NOT NULL,
  rank INTEGER NOT NULL,
  keyword TEXT NOT NULL,
  link_id TEXT NOT NULL,
  category_cid INTEGER NOT NULL,
  category_path TEXT NOT NULL,
  devices_json TEXT NOT NULL,
  genders_json TEXT NOT NULL,
  ages_json TEXT NOT NULL,
  collected_at TEXT NOT NULL,
  brand_excluded INTEGER NOT NULL DEFAULT 0,
  UNIQUE(profile_id, period, rank)
);

CREATE INDEX IF NOT EXISTS idx_trend_runs_profile_id ON trend_runs(profile_id);
CREATE INDEX IF NOT EXISTS idx_trend_runs_status ON trend_runs(status);
CREATE INDEX IF NOT EXISTS idx_trend_tasks_run_id ON trend_tasks(run_id);
CREATE INDEX IF NOT EXISTS idx_trend_tasks_profile_id ON trend_tasks(profile_id);
CREATE INDEX IF NOT EXISTS idx_trend_tasks_status ON trend_tasks(status);
CREATE INDEX IF NOT EXISTS idx_trend_tasks_period ON trend_tasks(period);
CREATE INDEX IF NOT EXISTS idx_trend_snapshots_profile_period ON trend_snapshots(profile_id, period);
CREATE INDEX IF NOT EXISTS idx_trend_snapshots_run_id ON trend_snapshots(run_id);

CREATE TABLE IF NOT EXISTS best_product_items (
  id TEXT PRIMARY KEY,
  category_cid INTEGER NOT NULL,
  category_path TEXT NOT NULL,
  category_name TEXT NOT NULL,
  query TEXT NOT NULL,
  trend_period TEXT NOT NULL DEFAULT '',
  trend_keyword TEXT NOT NULL DEFAULT '',
  trend_rank INTEGER NOT NULL DEFAULT 0,
  keyword_score REAL NOT NULL DEFAULT 0,
  keyword_appearance_count INTEGER NOT NULL DEFAULT 0,
  rank INTEGER NOT NULL,
  status TEXT NOT NULL,
  analysis_card_kind TEXT NOT NULL DEFAULT '',
  analysis_card TEXT NOT NULL DEFAULT '',
  analysis_rationale TEXT NOT NULL DEFAULT '',
  analysis_latest_score REAL NOT NULL DEFAULT 0,
  analysis_delta REAL NOT NULL DEFAULT 0,
  analysis_momentum REAL NOT NULL DEFAULT 0,
  analysis_seasonal_index REAL NOT NULL DEFAULT 0,
  analysis_recommended_months_json TEXT NOT NULL DEFAULT '[]',
  analysis_caution_months_json TEXT NOT NULL DEFAULT '[]',
  title TEXT NOT NULL DEFAULT '',
  link TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL DEFAULT '',
  low_price INTEGER,
  mall_name TEXT NOT NULL DEFAULT '',
  brand TEXT NOT NULL DEFAULT '',
  maker TEXT NOT NULL DEFAULT '',
  product_id TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL,
  failure_reason TEXT,
  collected_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(category_cid, query, rank)
);

CREATE INDEX IF NOT EXISTS idx_best_product_items_category ON best_product_items(category_cid, query);
CREATE INDEX IF NOT EXISTS idx_best_product_items_collected_at ON best_product_items(collected_at);
