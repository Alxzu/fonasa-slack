CREATE TABLE IF NOT EXISTS _migrations (
  name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profiles (
  id SERIAL PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  slack_user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  empresa TEXT NOT NULL,
  rut TEXT NOT NULL,
  documento TEXT NOT NULL,
  fecha_nac TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, name)
);

CREATE TABLE IF NOT EXISTS invoice_runs (
  id SERIAL PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  profile_name TEXT NOT NULL,
  triggered_by TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  payment_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  duration_ms INTEGER,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS exchange_rate_logs (
  id SERIAL PRIMARY KEY,
  requested_date TEXT NOT NULL,
  resolved_date TEXT,
  rate NUMERIC,
  attempts INTEGER NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profile_events (
  id SERIAL PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  target_name TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
