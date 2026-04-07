# contractcheck — Design Plan

## Overview

A passive cross-service contract drift detector. Learns API contracts from real traffic, builds a dependency graph of which services consume which fields, and alerts when a provider's response shape changes in a way that breaks consumers. No buy-in from individual teams — deploy the SDK, it observes and warns.

---

## Problem Statement

Service A calls Service B's `/users` endpoint. Service B changes the response shape. Service A breaks in prod. OpenAPI specs exist but go stale. Pact.io exists but requires every team to write and maintain consumer-driven contracts — adoption collapses when one team stops.

**What's missing**: a tool that passively observes real traffic, infers what each consumer actually depends on, and alerts when a provider ships a breaking change — with zero contract authoring from developers.

---

## Core Concepts

### Contract

A contract is not a spec file someone writes. It's an **inferred schema** derived from observed production traffic for a specific endpoint, scoped to a specific consumer.

```
Provider: user-service
Endpoint: GET /users/:id
Consumer: order-service
Fields accessed: { id: number, email: string }
Confidence: 99.8% (based on 48,200 samples over 14 days)
```

### Dependency Graph

The central data structure. Maps every provider endpoint to every consumer and the specific fields each consumer reads.

```
user-service  GET /users/:id
│ returns: { id, name, email, role, createdAt }
│
├── order-service reads: { id, email }
├── notif-service reads: { email, name }
└── billing-service reads: { id, role }

Fields:
  id        → 3 consumers (critical)
  email     → 2 consumers (critical)
  name      → 1 consumer
  role      → 1 consumer
  createdAt → 0 consumers (safe to remove)
```

### Drift Event

A detected change in a provider's response shape that violates at least one consumer's contract.

```
type: FIELD_REMOVED
provider: user-service
endpoint: GET /users/:id
field: email
affected_consumers: [order-service, notif-service]
severity: BREAKING
first_seen: 2026-04-06T14:32:00Z
```

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    contractcheck system                      │
│                                                             │
│  ┌─────────────┐    ┌──────────────┐    ┌───────────────┐  │
│  │  Ingestion   │───▶│  Inference    │───▶│  Drift        │  │
│  │  Layer       │    │  Engine       │    │  Detector     │  │
│  └─────────────┘    └──────────────┘    └───────────────┘  │
│        ▲                    │                    │           │
│        │                    ▼                    ▼           │
│  ┌─────────────┐    ┌──────────────┐    ┌───────────────┐  │
│  │  SDK /       │    │  Contract     │    │  Alert        │  │
│  │  Middleware   │    │  Store        │    │  Router       │  │
│  └─────────────┘    └──────────────┘    └───────────────┘  │
│                                                │            │
│                                                ▼            │
│                                         ┌───────────────┐  │
│                                         │  CLI / CI      │  │
│                                         │  Interface     │  │
│                                         └───────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Role |
|---|---|
| **SDK / Middleware** | Installed in each service. Records request/response metadata and field access patterns. Reports to the server. |
| **Ingestion Layer** | Receives traffic samples from SDKs. Normalizes, deduplicates, samples. |
| **Inference Engine** | Builds JSON Schema contracts from observed response samples. Handles required vs optional, union types, enums, nested objects. |
| **Contract Store** | Persistent storage for inferred contracts, dependency graph, drift history. |
| **Drift Detector** | Compares incoming traffic against baseline contracts. Classifies changes by severity. |
| **Alert Router** | Sends notifications to Slack, PagerDuty, GitHub PR comments, CI pipelines. |
| **CLI / CI Interface** | Query contracts, check drift, run pre-merge checks. |

---

## SDK Design

### Provider-Side Middleware

Wraps outgoing responses and samples metadata to the contractcheck server.

```typescript
// Express middleware — user-service
import { contractcheck } from '@contractcheck/express';

app.use(contractcheck.provider({
  service: 'user-service',
  serverUrl: 'https://contractcheck.internal',
  sampleRate: 0.01, // 1% of traffic
  redact: ['password', 'ssn', 'token'],
}));
```

What it sends per sampled request:

```json
{
  "provider": "user-service",
  "endpoint": "GET /users/:id",
  "statusCode": 200,
  "responseShape": {
    "id": "number",
    "name": "string",
    "email": "string",
    "role": "string",
    "createdAt": "string"
  },
  "caller": "order-service",
  "timestamp": "2026-04-06T14:00:00Z"
}
```

The `caller` identity comes from (in priority order):
1. `X-Service-Name` header (if services set it)
2. Service mesh metadata (Istio/Envoy `x-forwarded-client-cert`)
3. User-Agent header
4. Source IP → service mapping (configured)

**Key rule**: the SDK never sends actual field values. Only field names and types. No PII leaves the service boundary.

### Consumer-Side Middleware

Tracks which fields the consumer actually reads from responses. Uses a JavaScript `Proxy` to intercept property access on parsed response bodies.

```typescript
// Express middleware — order-service
import { contractcheck } from '@contractcheck/express';

app.use(contractcheck.consumer({
  service: 'order-service',
  serverUrl: 'https://contractcheck.internal',
}));

// In a route handler
app.get('/orders/:id', async (req, res) => {
  const user = await contractcheck.fetch('http://user-service/users/123');
  // Proxy tracks: order-service accessed user.id and user.email
  const order = buildOrder(user.id, user.email);
  res.json(order);
});
```

What it sends:

```json
{
  "consumer": "order-service",
  "calls": "user-service",
  "endpoint": "GET /users/:id",
  "fieldsAccessed": ["id", "email"],
  "timestamp": "2026-04-06T14:00:00Z"
}
```

### SDK Priorities

| SDK | Framework | Priority |
|---|---|---|
| `@contractcheck/express` | Express.js | P0 — MVP |
| `@contractcheck/fastify` | Fastify | P1 |
| `@contractcheck/nest` | NestJS | P1 |
| `@contractcheck/flask` | Flask (Python) | P2 |
| `@contractcheck/spring` | Spring Boot (Java) | P2 |
| `@contractcheck/generic` | HTTP interceptor (any language) | P1 |

---

## Inference Engine

### Schema Inference from Samples

Given N observed responses for an endpoint, infer a JSON Schema contract.

**Input** (3 observed responses for `GET /users/:id`):

```json
{ "id": 1, "name": "Alice", "email": "a@b.com", "role": "admin" }
{ "id": 2, "name": "Bob", "email": null, "role": "user" }
{ "id": 3, "name": "Carol", "email": "c@d.com", "role": "editor", "lastLogin": "2026-01-01" }
```

**Output** (inferred contract):

```json
{
  "type": "object",
  "properties": {
    "id": { "type": "number", "required": true, "presence": 1.0 },
    "name": { "type": "string", "required": true, "presence": 1.0 },
    "email": { "type": ["string", "null"], "required": true, "presence": 1.0 },
    "role": { "type": "string", "enum": ["admin", "user", "editor"], "required": true, "presence": 1.0 },
    "lastLogin": { "type": "string", "required": false, "presence": 0.33 }
  }
}
```

### Inference Rules

| Aspect | Heuristic |
|---|---|
| **Required vs optional** | Present in ≥95% of samples → required. Below → optional. Configurable threshold. |
| **Nullable** | If a field appears as both a value and `null`, mark as nullable. |
| **Enum detection** | If a string field has ≤20 distinct values across ≥100 samples, treat as enum. |
| **Type inference** | Track all observed types per field. Single type → that type. Multiple → union type. |
| **Nested objects** | Recurse. Apply same rules to nested fields. |
| **Arrays** | Infer item schema from union of all observed array elements. |
| **Polymorphic responses** | Detect discriminator fields (e.g., `type`). Split into per-discriminator schemas. |
| **Confidence** | Require minimum sample count (default: 50) before a contract is considered stable. Below threshold → "learning" state, no drift alerts. |

### Endpoint Parameterization

Raw paths like `/users/123` and `/users/456` must be collapsed to `/users/:id`.

Strategy:
1. Group paths by HTTP method + segment count
2. Identify segments that vary across requests (numeric IDs, UUIDs)
3. Replace variable segments with parameter placeholders
4. Confirm with observed routing patterns

---

## Drift Detection

### Change Classification

| Change Type | Severity | Description |
|---|---|---|
| Field added | **Info** | New field in response. No consumer breaks. |
| Field removed | **Breaking** | Field consumers depend on is gone. |
| Type changed | **Breaking** | Field type differs from baseline (e.g., number → string). |
| Nullable added | **Warning** | Field that was always present now sometimes null. |
| Nullable removed | **Info** | Field that was sometimes null is now always present. |
| Enum value added | **Warning** | New value in an enum field. Consumer switch/if may not handle it. |
| Enum value removed | **Breaking** | Value consumers may depend on is gone. |
| Required → optional | **Breaking** | Field that was always present is now sometimes missing. |
| Optional → required | **Info** | Field now always present. Consumers benefit. |
| Nested shape change | **Breaking** | Sub-object structure changed. |
| Array → object (or vice versa) | **Critical** | Fundamental type change. |
| Status code change | **Warning** | Endpoint returning different status codes than baseline. |

### Detection Flow

```
New traffic sample arrives
  │
  ▼
Match to endpoint (parameterized path + method)
  │
  ▼
Compare response shape against baseline contract
  │
  ├── No diff → discard, update sample count
  │
  └── Diff found
        │
        ▼
      Classify change (table above)
        │
        ▼
      Check affected consumers from dependency graph
        │
        ├── No consumers affected → log as Info
        │
        └── Consumers affected
              │
              ▼
            Create Drift Event
              │
              ▼
            Route alert (Slack, PagerDuty, CI)
```

### Noise Reduction

Avoiding false positives is critical for adoption. Strategies:

1. **Minimum sample window**: don't alert until N new samples confirm the change (default: 10). A single outlier response doesn't trigger.
2. **Grace period**: after a new deployment, allow a configurable warm-up period (default: 5 minutes) before alerting. Catches transient startup behavior.
3. **Consumer-scoped alerts**: only alert if the changed fields are actually consumed. A removed field that nobody reads is Info, not Breaking.
4. **Acknowledged changes**: developers can mark a drift event as "intentional" via CLI or UI, suppressing future alerts for that change.

---

## Server

### API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/ingest/provider` | Receive provider-side traffic samples |
| `POST` | `/ingest/consumer` | Receive consumer-side field access reports |
| `GET` | `/contracts/:service` | List all contracts for a service |
| `GET` | `/contracts/:service/:endpoint` | Get contract for a specific endpoint |
| `GET` | `/graph` | Full dependency graph |
| `GET` | `/graph/:service` | Dependencies for a specific service |
| `GET` | `/drift` | List active drift events |
| `GET` | `/drift/:id` | Drift event detail |
| `POST` | `/drift/:id/acknowledge` | Mark drift as intentional |
| `GET` | `/health` | Server health check |

### Storage

MVP: **SQLite** (single-file, zero-config, sufficient for small-to-medium deployments).

Tables:

```sql
-- Inferred contracts
CREATE TABLE contracts (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  schema JSON NOT NULL,
  sample_count INTEGER DEFAULT 0,
  confidence REAL DEFAULT 0,
  status TEXT DEFAULT 'learning', -- learning | stable | drifting
  created_at DATETIME,
  updated_at DATETIME
);

-- Consumer dependencies
CREATE TABLE consumer_deps (
  id TEXT PRIMARY KEY,
  consumer TEXT NOT NULL,
  provider TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  fields_accessed JSON NOT NULL, -- ["id", "email"]
  sample_count INTEGER DEFAULT 0,
  last_seen DATETIME,
  created_at DATETIME
);

-- Drift events
CREATE TABLE drift_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  change_type TEXT NOT NULL, -- FIELD_REMOVED, TYPE_CHANGED, etc.
  severity TEXT NOT NULL,    -- info, warning, breaking, critical
  details JSON NOT NULL,
  affected_consumers JSON,   -- ["order-service", "notif-service"]
  status TEXT DEFAULT 'active', -- active | acknowledged | resolved
  first_seen DATETIME,
  resolved_at DATETIME
);

-- Raw traffic samples (ring buffer, auto-pruned)
CREATE TABLE samples (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  response_shape JSON NOT NULL,
  caller TEXT,
  created_at DATETIME
);
```

Scale path: swap SQLite for PostgreSQL when sample volume exceeds what a single file handles comfortably (~10M rows).

---

## CLI

### Commands

| Command | Description |
|---|---|
| `contractcheck status` | Show server connection status and summary stats |
| `contractcheck contracts` | List all inferred contracts |
| `contractcheck contracts <service>` | List contracts for a specific service |
| `contractcheck graph` | Show full dependency graph |
| `contractcheck graph <service>` | Show who depends on / is depended on by a service |
| `contractcheck drift` | List active drift events |
| `contractcheck drift <id>` | Show drift event details |
| `contractcheck diff --service <name>` | Compare local code changes against known contracts (CI mode) |
| `contractcheck ack <drift-id>` | Acknowledge a drift event as intentional |

### Output: `contractcheck contracts user-service`

```
contractcheck — user-service contracts

  ENDPOINT                METHOD   FIELDS   CONSUMERS   SAMPLES   STATUS
  /users/:id              GET      5        3           48,200    ● stable
  /users                  GET      3        2           12,100    ● stable
  /users/:id/preferences  GET      8        1           3,400     ● stable
  /users                  POST     –        0           890       ○ learning

  4 contracts  ·  3 stable  ·  1 learning
```

### Output: `contractcheck graph user-service`

```
contractcheck — user-service dependency graph

  user-service provides:
  ─────────────────────────────────────────────────────────

  GET /users/:id
    → order-service    reads { id, email }           48k samples
    → notif-service    reads { email, name }         31k samples
    → billing-service  reads { id, role }            12k samples

  GET /users
    → admin-dashboard  reads { id, name, role }      8k samples
    → search-service   reads { id, name }            4k samples

  user-service consumes:
  ─────────────────────────────────────────────────────────

  auth-service  GET /verify
    reads { userId, valid, scopes }                  52k samples
```

### Output: `contractcheck drift`

```
contractcheck — active drift events

  ID     SEVERITY   PROVIDER        ENDPOINT        CHANGE                AFFECTED        AGE
  d-14   BREAKING   user-service    GET /users/:id  email removed         2 consumers     12m
  d-13   WARNING    payment-svc     POST /charge    new nullable: memo    1 consumer      3h
  d-12   INFO       auth-service    GET /verify     field added: mfa      0 consumers     1d

  3 active events  ·  contractcheck drift <id> for details  ·  contractcheck ack <id> to dismiss
```

### Output: `contractcheck diff --service user-service` (CI mode)

```
contractcheck — pre-merge contract check for user-service

  Comparing local changes against production contracts...

  ⚠ BREAKING: GET /users/:id
    Field removed: "email"
      → order-service depends on this field (48,200 samples, last seen 2m ago)
      → notif-service depends on this field (31,400 samples, last seen 5m ago)

    Field type changed: "id" number → string
      → order-service depends on this field (48,200 samples)
      → billing-service depends on this field (12,000 samples)

  ✓ SAFE: GET /users
    No breaking changes detected.

  ✓ SAFE: POST /users
    No consumers registered.

  Result: FAIL — 2 breaking changes affecting 3 consumers
  Exit code: 1
```

Exit codes for CI integration:

| Code | Meaning |
|---|---|
| 0 | No breaking changes |
| 1 | Breaking changes detected |
| 2 | Warnings only (configurable to fail) |

---

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/contract-check.yml
name: Contract Check
on: [pull_request]

jobs:
  contract-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: contractcheck/action@v1
        with:
          service: user-service
          server-url: ${{ secrets.CONTRACTCHECK_URL }}
          fail-on: breaking  # or: warning, info
```

### Pre-merge Gate

The `contractcheck diff` command runs in CI and:
1. Connects to the contractcheck server
2. Fetches current contracts and consumer dependencies for the service
3. Analyzes the code diff to determine response shape changes (via test execution or OpenAPI diff)
4. Compares against known consumer dependencies
5. Exits non-zero if breaking changes found

---

## Configuration

### Server Config (`contractcheck.server.yml`)

```yaml
storage:
  driver: sqlite             # sqlite | postgres
  path: ./data/contracts.db  # for sqlite

ingestion:
  min_samples_for_stable: 50
  required_presence_threshold: 0.95
  enum_max_cardinality: 20
  sample_retention_days: 30

drift:
  min_confirm_samples: 10    # samples before alerting
  grace_period_seconds: 300  # post-deploy warm-up
  auto_resolve_after_hours: 72

alerts:
  slack:
    webhook_url: https://hooks.slack.com/...
    channel: "#api-contracts"
  pagerduty:
    routing_key: "..."
    severity_threshold: breaking  # only page for breaking changes
```

### SDK Config (per service)

```yaml
# contractcheck.yml in service root
service: user-service
server_url: https://contractcheck.internal
role: provider              # provider | consumer | both
sample_rate: 0.01           # 1% of traffic
redact:
  - password
  - token
  - ssn
  - credit_card
```

---

## Privacy & Security

| Concern | Mitigation |
|---|---|
| PII in response bodies | SDK sends **field names and types only**, never values. Configurable redact list strips sensitive field names from reports entirely. |
| Internal API structure exposure | contractcheck server runs inside the private network. No data leaves the org boundary. |
| Traffic interception | SDK is a middleware, not a proxy. No man-in-the-middle. Traffic flows normally; SDK observes and reports asynchronously. |
| Sampling overhead | Default 1% sample rate. Async reporting via buffered queue. Negligible latency impact (<1ms p99). |

---

## MVP Scope

### Phase 1: Core (weeks 1–3)

Build the foundation without live traffic — operate on recorded samples.

| Deliverable | Description |
|---|---|
| **CLI** | `contractcheck infer` — infer contracts from a directory of JSON request/response pairs |
| **Inference engine** | Schema inference from JSON samples with required/optional/nullable/enum detection |
| **Drift detector** | Compare two sets of samples and report drift with severity classification |
| **Reporter** | Terminal output with colored severity indicators |

Usage in Phase 1:

```bash
# Record some traffic manually (e.g., from logs or test runs)
# Place in samples/user-service/GET_users_id/

contractcheck infer ./samples/
# → outputs inferred contracts

contractcheck diff ./samples-before/ ./samples-after/
# → outputs drift report
```

### Phase 2: Server + SDK (weeks 4–6)

| Deliverable | Description |
|---|---|
| **contractcheck-server** | HTTP server with ingestion, storage, drift detection loop |
| **Express SDK** | Provider + consumer middleware for Express.js |
| **Live drift detection** | Real-time comparison of incoming samples against baseline |
| **CLI connected mode** | CLI queries server for contracts, graph, drift events |

### Phase 3: Integrations (weeks 7–8)

| Deliverable | Description |
|---|---|
| **CI diff command** | `contractcheck diff --service X` queries server and exits non-zero on breaking changes |
| **GitHub Action** | Wrapper action for CI pipelines |
| **Slack alerts** | Webhook-based drift notifications |
| **Dependency graph visualization** | ASCII or HTML graph output |

---

## Tech Stack

| Component | Technology | Rationale |
|---|---|---|
| **CLI** | TypeScript + Node.js | Consistent with SDK language, fast iteration |
| **Server** | TypeScript + Fastify | Lightweight, high-performance HTTP server |
| **Storage** | SQLite (MVP) → PostgreSQL | Zero-config start, clear upgrade path |
| **SDK** | TypeScript | Express middleware first, other frameworks later |
| **Schema format** | JSON Schema (draft 2020-12) | Industry standard, tooling ecosystem |
| **Package manager** | npm | `npx contractcheck`, `npm i @contractcheck/express` |

---

## File Structure

```
contractcheck/
├── docs/
│   └── plan.md
├── packages/
│   ├── cli/                     # CLI tool
│   │   ├── src/
│   │   │   ├── index.ts         # entry point, command routing
│   │   │   ├── commands/
│   │   │   │   ├── infer.ts     # infer contracts from samples
│   │   │   │   ├── diff.ts      # compare and report drift
│   │   │   │   ├── contracts.ts # list/inspect contracts
│   │   │   │   ├── graph.ts     # dependency graph
│   │   │   │   ├── drift.ts     # drift events
│   │   │   │   └── status.ts    # server connection status
│   │   │   ├── renderer.ts      # terminal output formatting
│   │   │   └── types.ts         # shared types
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── core/                    # shared inference + drift logic
│   │   ├── src/
│   │   │   ├── inference.ts     # schema inference engine
│   │   │   ├── drift.ts         # drift detection + classification
│   │   │   ├── parameterizer.ts # endpoint path parameterization
│   │   │   ├── schema.ts        # JSON Schema utilities
│   │   │   └── types.ts         # core types
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── server/                  # contractcheck server
│   │   ├── src/
│   │   │   ├── index.ts         # server entry
│   │   │   ├── routes/          # API route handlers
│   │   │   ├── store.ts         # database layer
│   │   │   ├── ingestion.ts     # traffic sample processing
│   │   │   ├── alerting.ts      # Slack, PagerDuty integration
│   │   │   └── scheduler.ts     # periodic inference + drift checks
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── sdk-express/             # Express.js middleware
│       ├── src/
│       │   ├── index.ts         # public API
│       │   ├── provider.ts      # provider-side middleware
│       │   ├── consumer.ts      # consumer-side middleware + Proxy
│       │   ├── sampler.ts       # sampling logic
│       │   └── reporter.ts      # async reporting to server
│       ├── package.json
│       └── tsconfig.json
├── package.json                 # monorepo root (workspaces)
├── tsconfig.json
└── README.md
```

---

## Open Questions

| # | Question | Leaning |
|---|---|---|
| 1 | How does `contractcheck diff` in CI determine response shape changes from code? | Run the service's test suite with SDK instrumented, capture response shapes. Fall back to OpenAPI diff if available. |
| 2 | Should the server support multi-tenancy (multiple orgs)? | No for MVP. Single-tenant. Add later if open-sourced as a hosted service. |
| 3 | gRPC / GraphQL support? | Out of scope for MVP. REST/JSON first. gRPC is a natural Phase 4 extension (protobuf already has schemas). |
| 4 | How to handle versioned APIs (`/v1/users` vs `/v2/users`)? | Treat as separate endpoints. The parameterizer should not collapse version prefixes. |
| 5 | What if a consumer accesses fields dynamically (e.g., `Object.keys(response)`)? | Proxy-based tracking catches property access regardless of how it's done. `Object.keys` triggers the `ownKeys` trap. |
