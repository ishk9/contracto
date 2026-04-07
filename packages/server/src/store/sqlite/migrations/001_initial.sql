CREATE TABLE IF NOT EXISTS shapes (
  fingerprint TEXT PRIMARY KEY,
  shape JSON NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sample_aggregates (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  shape_fingerprint TEXT NOT NULL REFERENCES shapes(fingerprint),
  caller TEXT,
  status_code INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  UNIQUE(provider, endpoint, method, shape_fingerprint, caller, status_code)
);

CREATE TABLE IF NOT EXISTS contracts (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  schema JSON NOT NULL,
  sample_count INTEGER NOT NULL DEFAULT 0,
  confidence REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'learning'
    CHECK(status IN ('learning', 'stable', 'drifting')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(provider, endpoint, method)
);

CREATE TABLE IF NOT EXISTS consumer_deps (
  id TEXT PRIMARY KEY,
  consumer TEXT NOT NULL,
  provider TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  fields_accessed JSON NOT NULL,
  sample_count INTEGER NOT NULL DEFAULT 1,
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  UNIQUE(consumer, provider, endpoint, method)
);

CREATE TABLE IF NOT EXISTS drift_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  change_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK(severity IN ('info', 'warning', 'breaking', 'critical')),
  field TEXT NOT NULL,
  details JSON NOT NULL,
  affected_consumers JSON NOT NULL,
  confirmation_count INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending', 'active', 'acknowledged', 'resolved')),
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  resolved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_sample_agg_provider ON sample_aggregates(provider, endpoint, method);
CREATE INDEX IF NOT EXISTS idx_contracts_provider ON contracts(provider, endpoint, method);
CREATE INDEX IF NOT EXISTS idx_consumer_deps_provider ON consumer_deps(provider, endpoint, method);
CREATE INDEX IF NOT EXISTS idx_consumer_deps_consumer ON consumer_deps(consumer);
CREATE INDEX IF NOT EXISTS idx_drift_events_status ON drift_events(status, severity);
CREATE INDEX IF NOT EXISTS idx_drift_events_provider ON drift_events(provider, endpoint, method);
