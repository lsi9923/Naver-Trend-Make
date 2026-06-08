DELETE FROM best_product_items WHERE category_cid = 9090901;
DELETE FROM trend_snapshots WHERE profile_id = 'qa-trend-analysis-profile';
DELETE FROM trend_runs WHERE id = 'qa-trend-analysis-run';
DELETE FROM trend_profiles WHERE id = 'qa-trend-analysis-profile';

INSERT INTO trend_profiles (
  id, slug, name, status, start_period, end_period,
  last_collected_period, last_synced_at, sync_status, latest_run_id,
  created_at, updated_at, category_cid, category_path, category_depth,
  time_unit, devices_json, genders_json, ages_json, spreadsheet_id,
  result_count, exclude_brand_products, custom_excluded_terms_json
) VALUES (
  'qa-trend-analysis-profile',
  'qa-trend-analysis-profile',
  'QA 트렌드 분석 누적',
  'active',
  '2025-07',
  '2026-06',
  '2026-06',
  NULL,
  'idle',
  'qa-trend-analysis-run',
  '2026-06-08T00:00:00.000Z',
  '2026-06-08T00:00:00.000Z',
  9090901,
  '패션의류 > 여성의류 > QA점퍼',
  3,
  'month',
  '[]',
  '[]',
  '[]',
  '',
  20,
  0,
  '[]'
);

INSERT INTO trend_runs (
  id, profile_id, status, requested_by, run_type,
  start_period, end_period, total_tasks, completed_tasks, failed_tasks, total_snapshots,
  sheet_url, started_at, completed_at, cancelled_at, browser_heartbeat_at, force_refresh,
  confidence_score, analysis_summary_json, analysis_cards_json, analysis_cached_at,
  failure_reason, created_at, updated_at
) VALUES (
  'qa-trend-analysis-run',
  'qa-trend-analysis-profile',
  'completed',
  'qa',
  'manual',
  '2025-07',
  '2026-06',
  12,
  12,
  0,
  36,
  NULL,
  '2026-06-08T00:00:00.000Z',
  '2026-06-08T00:10:00.000Z',
  NULL,
  NULL,
  1,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '2026-06-08T00:00:00.000Z',
  '2026-06-08T00:10:00.000Z'
);

WITH periods(period) AS (
  VALUES
    ('2025-07'), ('2025-08'), ('2025-09'), ('2025-10'),
    ('2025-11'), ('2025-12'), ('2026-01'), ('2026-02'),
    ('2026-03'), ('2026-04'), ('2026-05'), ('2026-06')
),
keywords(keyword, rank) AS (
  VALUES
    ('여름점퍼', 1),
    ('크로커다일레이디', 2),
    ('여성바람막이', 3)
)
INSERT INTO trend_snapshots (
  id, profile_id, run_id, task_id, period, rank, keyword, link_id,
  category_cid, category_path, devices_json, genders_json, ages_json,
  collected_at, brand_excluded
)
SELECT
  'qa-snap-' || periods.period || '-' || keywords.rank,
  'qa-trend-analysis-profile',
  'qa-trend-analysis-run',
  'qa-task-' || periods.period,
  periods.period,
  keywords.rank,
  keywords.keyword,
  'qa-link-' || keywords.rank,
  9090901,
  '패션의류 > 여성의류 > QA점퍼',
  '[]',
  '[]',
  '[]',
  '2026-06-08T00:00:00.000Z',
  0
FROM periods CROSS JOIN keywords;
