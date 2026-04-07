# contractcheck — Technical Architecture

## Overview

This document defines the concrete technical decisions, libraries, data structures, algorithms, and protocols that contractcheck uses. Everything here is a **decision**, not a suggestion.

---

## Tech Stack (locked)

| Layer | Choice | Version | Why this, not alternatives |
|---|---|---|---|
| Language | TypeScript | 5.x | Shared across CLI, server, and SDK. One language for the entire codebase. |
| Runtime | Node.js | 22 LTS | Native `fetch`, `setImmediate`, `Proxy`, `structuredClone`. No polyfills needed. |
| Monorepo | npm workspaces | native | No Turborepo/Nx/Lerna overhead. `npm workspaces` handles linking between packages. |
| Server framework | Fastify | 5.x | 3x faster than Express for JSON serialization. Schema-based validation built in. |
| Database | SQLite via `better-sqlite3` | latest | Synchronous reads (no async overhead for queries), WAL mode for concurrent read/write, single-file deployment. No DB server to run. |
| CLI framework | Commander.js | 13.x | Minimal, no magic. Handles subcommands, options, help text. |
| Terminal rendering | `chalk` + `cli-table3` | latest | Colored output and table formatting. |
| Schema format | JSON Schema draft 2020-12 | — | Industry standard. `ajv` for validation if needed. |
| Hashing | `hash-wasm` | latest | xxHash64 via WebAssembly. `xxhash64(data): Promise<string>` — async API. 10x faster than SHA-256, collision resistance sufficient for deduplication (not cryptographic). |
| UUID generation | `crypto.randomUUID()` | native | Node.js built-in. No external dependency. |
| Config loading | `cosmiconfig` | latest | Loads `contractcheck.yml`, `.contractcheckrc`, or `contractcheck` key in `package.json`. Standard config discovery. |
| Testing | Vitest | 3.x | Fast, TypeScript-native, compatible with monorepo workspace setup. |
| Linting | ESLint + Prettier | latest | Standard. No bikeshedding. |
| Build | `tsup` | latest | esbuild-powered bundler. Produces CJS + ESM outputs for SDK, single executable for CLI. |

---

## Design Principles

### SOLID Application

| Principle | How it's applied |
|---|---|
| **Single Responsibility** | Every class owns exactly one reason to change. `ShapeExtractor` extracts shapes. `DriftDetector` detects drift. `AlertRouter` routes alerts. No god classes. |
| **Open/Closed** | New transport backends (SQS, Kafka), alert channels (Slack, PagerDuty, Teams), and storage engines (SQLite, PostgreSQL) are added by implementing an interface — never by modifying existing code. |
| **Liskov Substitution** | `SqliteStore` and `PostgresStore` both implement `IContractStore`. Any code accepting `IContractStore` works identically with either. Same for `ITransportAdapter`, `IAlertChannel`, `IShapeExtractor`. |
| **Interface Segregation** | Consumers of the store don't see write methods they don't need. `IContractReader` (for CLI queries) is separate from `IContractWriter` (for server ingestion). The SDK depends on `ITransportAdapter` (just `send` + `destroy`), not the full server API. |
| **Dependency Inversion** | High-level modules (drift detection, inference) depend on interfaces (`IContractStore`, `IAlertChannel`), not on SQLite or Slack directly. Concrete implementations are injected via factories at startup. |

### Design Patterns Used

| Pattern | Where | Purpose |
|---|---|---|
| **Strategy** | `ITransportAdapter`, `IAlertChannel`, `IStore` | Swap transport/alert/storage implementations without changing callers. |
| **Observer** | `EventBus` in server | Drift detection emits events; alert channels, logger, and metrics subscribe independently. |
| **Repository** | `ContractRepository`, `DriftRepository`, `ConsumerDepRepository`, `SampleRepository` | Encapsulate data access behind a clean interface. Each repository owns one aggregate root. |
| **Factory** | `TransportFactory`, `StoreFactory`, `AlertChannelFactory` | Create correct implementation from config. CLI/server call the factory, never `new SqliteStore()` directly. |
| **Composite** | `ShapeNode` tree | Recursive tree structure — objects contain fields that are themselves `ShapeNode`s. Traversal, diffing, and merging all operate on the composite uniformly. |
| **Visitor** | `ShapeVisitor` interface | Traverse shape trees for different purposes (extraction, diffing, serialization) without modifying the shape data structure. |
| **Template Method** | `BaseMiddleware` | Defines the middleware lifecycle (`sample → extract → buffer → flush`). Subclasses (`ProviderMiddleware`, `ConsumerMiddleware`) override specific steps. |
| **Chain of Responsibility** | SDK processing pipeline | Sampler → Redactor → Extractor → Fingerprinter → Reporter. Each step processes and passes to the next. Steps can be added/removed via config. |
| **Builder** | `DriftEventBuilder`, `ContractSchemaBuilder` | Construct complex immutable objects step-by-step. Prevents partially initialized drift events or schemas. |

---

## Folder Structure

```
contractcheck/
├── package.json                       # workspaces: ["packages/*"]
├── tsconfig.base.json                 # shared compiler options
├── vitest.workspace.ts                # test workspace config
├── .eslintrc.js
├── .prettierrc
│
├── packages/
│   │
│   ├── core/                          # @contractcheck/core — zero external deps, pure logic
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts
│   │   ├── src/
│   │   │   ├── index.ts               # public API barrel export
│   │   │   │
│   │   │   ├── interfaces/            # all abstractions live here
│   │   │   │   ├── IShapeExtractor.ts
│   │   │   │   ├── IShapeMerger.ts
│   │   │   │   ├── ISchemaInferrer.ts
│   │   │   │   ├── IDriftDetector.ts
│   │   │   │   ├── IShapeVisitor.ts
│   │   │   │   ├── IFingerprinter.ts
│   │   │   │   ├── IRedactor.ts
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── types/                 # data structures, enums, value objects
│   │   │   │   ├── ShapeNode.ts       # ShapeNode, ShapeObject, ShapeArray, ShapeUnion
│   │   │   │   ├── ContractSchema.ts  # ContractSchema, FieldSchema, TypeFrequency
│   │   │   │   ├── DriftEvent.ts      # DriftEvent, DriftChangeType, ConsumerImpact, Severity
│   │   │   │   ├── Sample.ts          # ProviderSample, ConsumerAccess, batches
│   │   │   │   ├── Config.ts          # InferenceConfig, DriftConfig thresholds
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── extraction/            # shape extraction from raw JSON
│   │   │   │   ├── ShapeExtractor.ts  # implements IShapeExtractor
│   │   │   │   ├── ShapeMerger.ts     # implements IShapeMerger — merges array item shapes
│   │   │   │   ├── Redactor.ts        # implements IRedactor — strips sensitive field names
│   │   │   │   └── Fingerprinter.ts   # implements IFingerprinter — xxHash on canonical shape
│   │   │   │
│   │   │   ├── inference/             # schema inference from accumulated shapes
│   │   │   │   ├── SchemaInferrer.ts  # implements ISchemaInferrer
│   │   │   │   ├── FieldStatsAccumulator.ts  # incremental field stats tracking
│   │   │   │   ├── EnumDetector.ts    # detects low-cardinality string enums
│   │   │   │   └── ContractSchemaBuilder.ts  # Builder pattern for ContractSchema
│   │   │   │
│   │   │   ├── drift/                 # drift detection + classification
│   │   │   │   ├── DriftDetector.ts   # implements IDriftDetector
│   │   │   │   ├── ShapeDiffer.ts     # recursive shape comparison
│   │   │   │   ├── SeverityClassifier.ts  # maps change type + consumer count → severity
│   │   │   │   └── DriftEventBuilder.ts   # Builder pattern for DriftEvent
│   │   │   │
│   │   │   ├── parameterization/      # endpoint path collapsing
│   │   │   │   ├── EndpointParameterizer.ts
│   │   │   │   └── SegmentClassifier.ts   # numeric, UUID, slug, version detection
│   │   │   │
│   │   │   └── visitors/             # Visitor pattern implementations for ShapeNode
│   │   │       ├── ShapeSerializer.ts     # canonical JSON serialization
│   │   │       ├── ShapeFlattener.ts      # flatten nested shape to dot-path field list
│   │   │       └── ShapePrinter.ts        # human-readable shape summary
│   │   │
│   │   └── tests/
│   │       ├── extraction/
│   │       │   ├── ShapeExtractor.test.ts
│   │       │   ├── ShapeMerger.test.ts
│   │       │   ├── Redactor.test.ts
│   │       │   └── Fingerprinter.test.ts
│   │       ├── inference/
│   │       │   ├── SchemaInferrer.test.ts
│   │       │   ├── FieldStatsAccumulator.test.ts
│   │       │   └── EnumDetector.test.ts
│   │       ├── drift/
│   │       │   ├── DriftDetector.test.ts
│   │       │   ├── ShapeDiffer.test.ts
│   │       │   └── SeverityClassifier.test.ts
│   │       ├── parameterization/
│   │       │   └── EndpointParameterizer.test.ts
│   │       └── property/
│   │           └── ShapeExtractor.property.test.ts  # fast-check fuzzing
│   │
│   ├── server/                        # @contractcheck/server
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts
│   │   ├── src/
│   │   │   ├── index.ts               # server entry — bootstraps DI, starts Fastify
│   │   │   │
│   │   │   ├── interfaces/            # server-specific abstractions
│   │   │   │   ├── IContractStore.ts       # IContractReader + IContractWriter
│   │   │   │   ├── ISampleStore.ts
│   │   │   │   ├── IDriftStore.ts
│   │   │   │   ├── IConsumerDepStore.ts
│   │   │   │   ├── IAlertChannel.ts
│   │   │   │   ├── IScheduler.ts
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── config/
│   │   │   │   ├── ServerConfig.ts         # config type + defaults
│   │   │   │   └── ConfigLoader.ts         # cosmiconfig-based loader
│   │   │   │
│   │   │   ├── container/                  # dependency injection
│   │   │   │   ├── Container.ts            # simple DI container (register + resolve)
│   │   │   │   └── ContainerFactory.ts     # builds the container from config
│   │   │   │
│   │   │   ├── store/                      # Repository pattern — data access
│   │   │   │   ├── sqlite/
│   │   │   │   │   ├── SqliteConnection.ts     # manages DB connection, pragmas, migrations
│   │   │   │   │   ├── SqliteContractStore.ts  # implements IContractStore
│   │   │   │   │   ├── SqliteSampleStore.ts    # implements ISampleStore
│   │   │   │   │   ├── SqliteDriftStore.ts     # implements IDriftStore
│   │   │   │   │   ├── SqliteConsumerDepStore.ts # implements IConsumerDepStore
│   │   │   │   │   └── migrations/
│   │   │   │   │       ├── 001_initial.sql
│   │   │   │   │       └── MigrationRunner.ts
│   │   │   │   ├── postgres/               # future — same interfaces, different impl
│   │   │   │   │   └── (mirrors sqlite/ structure)
│   │   │   │   └── StoreFactory.ts         # Factory — creates correct store from config
│   │   │   │
│   │   │   ├── ingestion/                  # processes incoming SDK batches
│   │   │   │   ├── IngestionService.ts     # orchestrates sample processing
│   │   │   │   ├── BatchValidator.ts       # validates batch structure
│   │   │   │   └── SampleNormalizer.ts     # deduplicates, normalizes timestamps
│   │   │   │
│   │   │   ├── events/                     # Observer pattern — internal event bus
│   │   │   │   ├── EventBus.ts             # typed pub/sub
│   │   │   │   └── EventTypes.ts           # event type definitions
│   │   │   │
│   │   │   ├── alerting/                   # Strategy pattern — alert channels
│   │   │   │   ├── AlertRouter.ts          # routes drift events to registered channels
│   │   │   │   ├── channels/
│   │   │   │   │   ├── SlackChannel.ts     # implements IAlertChannel
│   │   │   │   │   ├── PagerDutyChannel.ts # implements IAlertChannel
│   │   │   │   │   └── WebhookChannel.ts   # implements IAlertChannel (generic)
│   │   │   │   ├── formatters/
│   │   │   │   │   ├── SlackFormatter.ts   # drift event → Slack blocks
│   │   │   │   │   └── PlainTextFormatter.ts
│   │   │   │   └── AlertChannelFactory.ts  # Factory — creates channels from config
│   │   │   │
│   │   │   ├── scheduler/                  # periodic background jobs
│   │   │   │   ├── Scheduler.ts            # implements IScheduler — setInterval-based
│   │   │   │   └── jobs/
│   │   │   │       ├── InferenceJob.ts     # re-infers schemas every 5 min
│   │   │   │       ├── DriftResolutionJob.ts   # auto-resolves stale drift events
│   │   │   │       ├── SamplePruningJob.ts     # deletes old samples
│   │   │   │       └── StaleConsumerJob.ts     # marks stale consumer deps
│   │   │   │
│   │   │   └── routes/                     # Fastify route handlers
│   │   │       ├── ingestRoutes.ts         # POST /ingest/provider, /ingest/consumer
│   │   │       ├── contractRoutes.ts       # GET /contracts/:service
│   │   │       ├── graphRoutes.ts          # GET /graph/:service
│   │   │       ├── driftRoutes.ts          # GET /drift, POST /drift/:id/acknowledge
│   │   │       ├── healthRoutes.ts         # GET /health
│   │   │       └── schemas/               # Fastify JSON Schema for request validation
│   │   │           ├── ingestSchemas.ts
│   │   │           └── querySchemas.ts
│   │   │
│   │   └── tests/
│   │       ├── ingestion/
│   │       │   └── IngestionService.test.ts
│   │       ├── store/
│   │       │   └── SqliteContractStore.test.ts
│   │       ├── alerting/
│   │       │   └── AlertRouter.test.ts
│   │       └── integration/
│   │           └── IngestToDrift.integration.test.ts
│   │
│   ├── cli/                               # contractcheck CLI binary
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts
│   │   ├── bin/
│   │   │   └── contractcheck.ts           # shebang entry point
│   │   ├── src/
│   │   │   ├── index.ts                   # Commander program setup
│   │   │   │
│   │   │   ├── interfaces/
│   │   │   │   ├── IRenderer.ts           # output rendering abstraction
│   │   │   │   └── IApiClient.ts          # server communication abstraction
│   │   │   │
│   │   │   ├── commands/                  # one file per command — SRP
│   │   │   │   ├── InferCommand.ts        # offline inference from sample files
│   │   │   │   ├── DiffCommand.ts         # compare samples or CI diff
│   │   │   │   ├── ContractsCommand.ts    # list/inspect contracts
│   │   │   │   ├── GraphCommand.ts        # dependency graph
│   │   │   │   ├── DriftCommand.ts        # drift events
│   │   │   │   ├── AckCommand.ts          # acknowledge drift
│   │   │   │   └── StatusCommand.ts       # server health
│   │   │   │
│   │   │   ├── api/                       # server communication
│   │   │   │   └── ApiClient.ts           # implements IApiClient — HTTP calls to server
│   │   │   │
│   │   │   └── renderers/                 # Strategy pattern — output formatting
│   │   │       ├── TableRenderer.ts       # implements IRenderer — colored terminal tables
│   │   │       ├── JsonRenderer.ts        # implements IRenderer — raw JSON (for piping)
│   │   │       └── Colors.ts              # chalk color constants
│   │   │
│   │   └── tests/
│   │       └── commands/
│   │           ├── InferCommand.test.ts
│   │           └── DiffCommand.test.ts
│   │
│   └── sdk-express/                       # @contractcheck/express
│       ├── package.json
│       ├── tsconfig.json
│       ├── tsup.config.ts
│       ├── src/
│       │   ├── index.ts                   # public API: contractcheck.provider(), .consumer(), .fetch()
│       │   │
│       │   ├── interfaces/
│       │   │   ├── ITransportAdapter.ts   # abstraction for how data reaches the server
│       │   │   └── IFieldTracker.ts       # abstraction for consumer-side field tracking
│       │   │
│       │   ├── middleware/                # Template Method — base + specific middleware
│       │   │   ├── BaseMiddleware.ts      # abstract: sample → extract → buffer → flush lifecycle
│       │   │   ├── ProviderMiddleware.ts  # extends BaseMiddleware — intercepts res.json()
│       │   │   └── ConsumerMiddleware.ts  # extends BaseMiddleware — wraps outgoing fetch
│       │   │
│       │   ├── tracking/                  # consumer-side field access tracking
│       │   │   ├── ProxyFieldTracker.ts   # implements IFieldTracker — Proxy-based interception
│       │   │   └── TrackedFetch.ts        # contractcheck.fetch() wrapper
│       │   │
│       │   ├── pipeline/                  # Chain of Responsibility — processing steps
│       │   │   ├── PipelineStep.ts        # abstract base
│       │   │   ├── SamplerStep.ts         # decides whether to sample this request
│       │   │   ├── RedactorStep.ts        # strips sensitive fields
│       │   │   ├── ExtractorStep.ts       # extracts shape
│       │   │   ├── FingerprintStep.ts     # hashes shape
│       │   │   └── Pipeline.ts            # composes steps into a chain
│       │   │
│       │   ├── transport/                 # Strategy pattern — how batches reach the server
│       │   │   ├── HttpTransport.ts       # implements ITransportAdapter — default
│       │   │   ├── SqsTransport.ts        # implements ITransportAdapter — high-scale
│       │   │   ├── KafkaTransport.ts      # implements ITransportAdapter — high-scale
│       │   │   ├── NoopTransport.ts       # implements ITransportAdapter — testing
│       │   │   └── TransportFactory.ts    # Factory — creates adapter from config
│       │   │
│       │   └── reporter/                  # buffering + batch dispatch
│       │       └── ShapeReporter.ts       # buffers samples, deduplicates, flushes via transport
│       │
│       └── tests/
│           ├── middleware/
│           │   ├── ProviderMiddleware.test.ts
│           │   └── ConsumerMiddleware.test.ts
│           ├── tracking/
│           │   └── ProxyFieldTracker.test.ts
│           ├── pipeline/
│           │   └── Pipeline.test.ts
│           └── transport/
│               └── HttpTransport.test.ts
```

### Package Dependency Graph

```
sdk-express ──→ core
cli ──────────→ core
server ───────→ core
```

`core` has zero runtime dependencies on the other packages. It exports pure logic only — no I/O, no network, no filesystem. This makes it testable in isolation with zero mocking.

---

## Interface Definitions

### Core Interfaces

```typescript
// IShapeExtractor.ts
interface IShapeExtractor {
  extract(value: unknown): ShapeNode;
}

// IShapeMerger.ts
interface IShapeMerger {
  merge(nodes: ShapeNode[]): ShapeNode;
}

// IFingerprinter.ts
interface IFingerprinter {
  fingerprint(shape: ShapeNode): string;
}

// IRedactor.ts
interface IRedactor {
  redact(obj: Record<string, unknown>): Record<string, unknown>;
}

// ISchemaInferrer.ts
interface ISchemaInferrer {
  infer(shapes: ShapeNode[], config: InferenceConfig): ContractSchema;
  update(existing: ContractSchema, newShapes: ShapeNode[]): ContractSchema;
}

// IDriftDetector.ts
interface IDriftDetector {
  detect(
    baseline: ContractSchema,
    incoming: ShapeNode,
    consumerDeps: ConsumerDep[]
  ): DriftEvent[];
}

// IShapeVisitor.ts — Visitor pattern for shape tree traversal
interface IShapeVisitor<T> {
  visitPrimitive(node: string, path: string): T;
  visitObject(node: ShapeObject, path: string): T;
  visitArray(node: ShapeArray, path: string): T;
  visitUnion(node: ShapeUnion, path: string): T;
}
```

### Server Interfaces — Segregated by Role

```typescript
// IContractStore.ts — split into reader + writer (ISP)
interface IContractReader {
  getContract(provider: string, endpoint: string, method: string): Contract | null;
  listContracts(provider: string): Contract[];
  getAllContracts(): Contract[];
}

interface IContractWriter {
  upsertContract(contract: Contract): void;
  updateStatus(id: string, status: ContractStatus): void;
}

type IContractStore = IContractReader & IContractWriter;

// ISampleStore.ts
interface ISampleReader {
  getShapesByEndpoint(provider: string, endpoint: string, method: string): ShapeAggregate[];
  getShape(fingerprint: string): ShapeNode | null;
}

interface ISampleWriter {
  storeShape(fingerprint: string, shape: ShapeNode): void;
  upsertAggregate(sample: SampleAggregate): void;
  pruneOlderThan(date: Date): number;
}

type ISampleStore = ISampleReader & ISampleWriter;

// IDriftStore.ts
interface IDriftReader {
  getActiveEvents(): DriftEvent[];
  getEvent(id: string): DriftEvent | null;
  getEventsByProvider(provider: string): DriftEvent[];
}

interface IDriftWriter {
  createEvent(event: DriftEvent): void;
  updateEvent(id: string, updates: Partial<DriftEvent>): void;
  incrementConfirmation(id: string): void;
}

type IDriftStore = IDriftReader & IDriftWriter;

// IConsumerDepStore.ts
interface IConsumerDepReader {
  getConsumersOf(provider: string, endpoint: string, method: string): ConsumerDep[];
  getDependenciesOf(consumer: string): ConsumerDep[];
  getFullGraph(): DependencyGraph;
}

interface IConsumerDepWriter {
  upsertDep(dep: ConsumerDep): void;
  markStale(olderThan: Date): number;
}

type IConsumerDepStore = IConsumerDepReader & IConsumerDepWriter;

// IAlertChannel.ts
interface IAlertChannel {
  readonly name: string;
  send(event: DriftEvent): Promise<void>;
}

// IScheduler.ts
interface ISchedulerJob {
  readonly name: string;
  readonly intervalMs: number;
  execute(): Promise<void>;
}

interface IScheduler {
  register(job: ISchedulerJob): void;
  start(): void;
  stop(): void;
}
```

### SDK Interfaces

```typescript
// ITransportAdapter.ts
interface ITransportAdapter {
  send(batch: ProviderBatch | ConsumerBatch): void;
  destroy(): void;
}

// IFieldTracker.ts
interface IFieldTracker {
  wrap<T extends object>(obj: T): T;
  getAccessedFields(): string[];
  reset(): void;
}
```

---

## Data Structures

### Shape Representation

A shape is a recursive type map. Every value in the original JSON is replaced by its type descriptor.

```typescript
// ShapeNode.ts
type ShapeNode =
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | 'undefined'
  | 'unknown'
  | ShapeObject
  | ShapeArray
  | ShapeUnion;

interface ShapeObject {
  readonly _type: 'object';
  readonly fields: Readonly<Record<string, ShapeNode>>;
}

interface ShapeArray {
  readonly _type: 'array';
  readonly items: ShapeNode;
}

interface ShapeUnion {
  readonly _type: 'union';
  readonly variants: readonly ShapeNode[];
}
```

All shape types are `readonly` — shapes are immutable value objects. Once extracted, they are never mutated. New shapes are created via the `ShapeMerger` or `ShapeExtractor`.

Example — input JSON:

```json
{
  "id": 42,
  "name": "Alice",
  "address": { "city": "Berlin", "zip": "10115" },
  "tags": ["vip", "eu"],
  "metadata": null
}
```

Extracted shape:

```json
{
  "_type": "object",
  "fields": {
    "id": "number",
    "name": "string",
    "address": {
      "_type": "object",
      "fields": {
        "city": "string",
        "zip": "string"
      }
    },
    "tags": {
      "_type": "array",
      "items": "string"
    },
    "metadata": "null"
  }
}
```

### Shape Fingerprint

Every shape is hashed using xxHash64 on its canonical JSON representation (keys sorted deterministically). Two structurally identical shapes always produce the same hash, regardless of field order in the original response.

```typescript
// Fingerprinter.ts — implements IFingerprinter
class Fingerprinter implements IFingerprinter {
  private hasher: XXHash;

  constructor(hasher: XXHash) {
    this.hasher = hasher;
  }

  fingerprint(shape: ShapeNode): string {
    const canonical = this.canonicalize(shape);
    return this.hasher.h64(canonical);
  }

  private canonicalize(node: ShapeNode): string {
    if (typeof node === 'string') return JSON.stringify(node);
    if (node._type === 'object') {
      const sorted = Object.keys(node.fields).sort();
      const entries = sorted.map(k =>
        `${JSON.stringify(k)}:${this.canonicalize(node.fields[k])}`
      );
      return `{${entries.join(',')}}`;
    }
    if (node._type === 'array') {
      return `[${this.canonicalize(node.items)}]`;
    }
    if (node._type === 'union') {
      const sorted = node.variants.map(v => this.canonicalize(v)).sort();
      return `(${sorted.join('|')})`;
    }
    return JSON.stringify(node);
  }
}
```

### Inferred Contract Schema

The inference engine produces a richer schema from many shape samples:

```typescript
// ContractSchema.ts
interface ContractSchema {
  readonly _type: 'object';
  readonly fields: Readonly<Record<string, FieldSchema>>;
}

interface FieldSchema {
  readonly types: readonly TypeFrequency[];
  readonly presence: number;           // 0.0–1.0
  readonly required: boolean;
  readonly nullable: boolean;
  readonly enumValues?: readonly string[];
  readonly nested?: ContractSchema;
  readonly arrayItems?: FieldSchema;
  readonly sampleCount: number;
}

interface TypeFrequency {
  readonly type: string;
  readonly count: number;
  readonly percentage: number;
}
```

### Drift Event

```typescript
// DriftEvent.ts
interface DriftEvent {
  readonly id: string;
  readonly provider: string;
  readonly endpoint: string;
  readonly method: string;
  readonly changeType: DriftChangeType;
  readonly severity: Severity;
  readonly field: string;
  readonly details: DriftDetails;
  readonly affectedConsumers: readonly ConsumerImpact[];
  readonly confirmationCount: number;
  readonly status: DriftStatus;
  readonly firstSeen: string;
  readonly lastSeen: string;
  readonly resolvedAt?: string;
}

interface DriftDetails {
  readonly before: string;
  readonly after: string;
  readonly description: string;
}

interface ConsumerImpact {
  readonly consumer: string;
  readonly field: string;
  readonly sampleCount: number;
  readonly lastSeen: string;
}

type Severity = 'info' | 'warning' | 'breaking' | 'critical';
type DriftStatus = 'pending' | 'active' | 'acknowledged' | 'resolved';

enum DriftChangeType {
  FIELD_ADDED = 'FIELD_ADDED',
  FIELD_REMOVED = 'FIELD_REMOVED',
  TYPE_CHANGED = 'TYPE_CHANGED',
  NULLABLE_ADDED = 'NULLABLE_ADDED',
  NULLABLE_REMOVED = 'NULLABLE_REMOVED',
  ENUM_VALUE_ADDED = 'ENUM_VALUE_ADDED',
  ENUM_VALUE_REMOVED = 'ENUM_VALUE_REMOVED',
  REQUIRED_TO_OPTIONAL = 'REQUIRED_TO_OPTIONAL',
  OPTIONAL_TO_REQUIRED = 'OPTIONAL_TO_REQUIRED',
  NESTED_SHAPE_CHANGED = 'NESTED_SHAPE_CHANGED',
  STRUCTURAL_CHANGE = 'STRUCTURAL_CHANGE',
  STATUS_CODE_CHANGED = 'STATUS_CODE_CHANGED',
}
```

### Builder Pattern — DriftEvent Construction

Drift events are complex objects with many required fields. The builder prevents partial construction:

```typescript
// DriftEventBuilder.ts
class DriftEventBuilder {
  private event: Partial<DriftEvent> = {};

  static create(): DriftEventBuilder {
    return new DriftEventBuilder();
  }

  withId(id: string): this { this.event.id = id; return this; }
  withProvider(p: string): this { this.event.provider = p; return this; }
  withEndpoint(e: string): this { this.event.endpoint = e; return this; }
  withMethod(m: string): this { this.event.method = m; return this; }
  withChangeType(t: DriftChangeType): this { this.event.changeType = t; return this; }
  withSeverity(s: Severity): this { this.event.severity = s; return this; }
  withField(f: string): this { this.event.field = f; return this; }
  withDetails(d: DriftDetails): this { this.event.details = d; return this; }
  withConsumers(c: ConsumerImpact[]): this { this.event.affectedConsumers = c; return this; }

  build(): DriftEvent {
    const required = ['id', 'provider', 'endpoint', 'method', 'changeType',
                       'severity', 'field', 'details', 'affectedConsumers'] as const;
    for (const key of required) {
      if (this.event[key] === undefined) {
        throw new Error(`DriftEvent missing required field: ${key}`);
      }
    }

    return {
      ...this.event,
      confirmationCount: 1,
      status: 'pending',
      firstSeen: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
    } as DriftEvent;
  }
}
```

---

## Visitor Pattern — Shape Traversal

The `ShapeNode` tree is traversed for multiple purposes (serialization, diffing, flattening). Instead of adding methods to the data types, use the Visitor pattern:

```typescript
// IShapeVisitor.ts
interface IShapeVisitor<T> {
  visitPrimitive(node: string, path: string): T;
  visitObject(node: ShapeObject, path: string): T;
  visitArray(node: ShapeArray, path: string): T;
  visitUnion(node: ShapeUnion, path: string): T;
}

function acceptVisitor<T>(node: ShapeNode, visitor: IShapeVisitor<T>, path: string = ''): T {
  if (typeof node === 'string') return visitor.visitPrimitive(node, path);
  switch (node._type) {
    case 'object': return visitor.visitObject(node, path);
    case 'array': return visitor.visitArray(node, path);
    case 'union': return visitor.visitUnion(node, path);
  }
}
```

### ShapeFlattener — flattens a shape to dot-path field list

```typescript
// ShapeFlattener.ts
class ShapeFlattener implements IShapeVisitor<string[]> {
  visitPrimitive(node: string, path: string): string[] {
    return path ? [path] : [];
  }

  visitObject(node: ShapeObject, path: string): string[] {
    const paths: string[] = [];
    for (const [key, child] of Object.entries(node.fields)) {
      const childPath = path ? `${path}.${key}` : key;
      paths.push(childPath);
      paths.push(...acceptVisitor(child, this, childPath));
    }
    return paths;
  }

  visitArray(node: ShapeArray, path: string): string[] {
    return acceptVisitor(node.items, this, `${path}[]`);
  }

  visitUnion(node: ShapeUnion, path: string): string[] {
    return node.variants.flatMap(v => acceptVisitor(v, this, path));
  }
}
```

---

## Chain of Responsibility — SDK Processing Pipeline

Each incoming response passes through a chain of processing steps. Steps can be added, removed, or reordered via config:

```typescript
// PipelineStep.ts
abstract class PipelineStep {
  private next: PipelineStep | null = null;

  setNext(step: PipelineStep): PipelineStep {
    this.next = step;
    return step;
  }

  protected passToNext(context: PipelineContext): PipelineContext | null {
    return this.next ? this.next.process(context) : context;
  }

  abstract process(context: PipelineContext): PipelineContext | null;
}

interface PipelineContext {
  rawBody: unknown;
  shape?: ShapeNode;
  fingerprint?: string;
  endpoint: string;
  statusCode: number;
  caller: string | null;
  timestamp: string;
}

// SamplerStep.ts — decides whether to process this request
class SamplerStep extends PipelineStep {
  constructor(private sampleRate: number) { super(); }

  process(context: PipelineContext): PipelineContext | null {
    if (Math.random() > this.sampleRate) return null; // skip
    return this.passToNext(context);
  }
}

// RedactorStep.ts
class RedactorStep extends PipelineStep {
  constructor(private redactor: IRedactor) { super(); }

  process(context: PipelineContext): PipelineContext | null {
    if (typeof context.rawBody === 'object' && context.rawBody !== null) {
      context.rawBody = this.redactor.redact(context.rawBody as Record<string, unknown>);
    }
    return this.passToNext(context);
  }
}

// ExtractorStep.ts
class ExtractorStep extends PipelineStep {
  constructor(private extractor: IShapeExtractor) { super(); }

  process(context: PipelineContext): PipelineContext | null {
    context.shape = this.extractor.extract(context.rawBody);
    return this.passToNext(context);
  }
}

// FingerprintStep.ts
class FingerprintStep extends PipelineStep {
  constructor(private fingerprinter: IFingerprinter) { super(); }

  process(context: PipelineContext): PipelineContext | null {
    if (!context.shape) return null;
    context.fingerprint = this.fingerprinter.fingerprint(context.shape);
    return this.passToNext(context);
  }
}

// Pipeline.ts — composes the chain
class Pipeline {
  private head: PipelineStep;

  constructor(steps: PipelineStep[]) {
    this.head = steps[0];
    for (let i = 0; i < steps.length - 1; i++) {
      steps[i].setNext(steps[i + 1]);
    }
  }

  execute(context: PipelineContext): PipelineContext | null {
    return this.head.process(context);
  }
}
```

Default pipeline: `Sampler → Redactor → Extractor → Fingerprint`. Adding a new step (e.g., a field whitelist filter) means creating a new `PipelineStep` subclass and inserting it — no existing code changes (Open/Closed).

---

## Template Method — SDK Middleware

Both provider and consumer middleware share a lifecycle but differ in what they intercept:

```typescript
// BaseMiddleware.ts
abstract class BaseMiddleware {
  protected pipeline: Pipeline;
  protected reporter: ShapeReporter;

  constructor(pipeline: Pipeline, reporter: ShapeReporter) {
    this.pipeline = pipeline;
    this.reporter = reporter;
  }

  createHandler(): RequestHandler {
    return safeMiddleware((req, res, next) => {
      this.intercept(req, res, next);
    });
  }

  protected abstract intercept(
    req: Request, res: Response, next: NextFunction
  ): void;

  protected reportShape(context: PipelineContext): void {
    const result = this.pipeline.execute(context);
    if (!result || !result.shape || !result.fingerprint) return;

    this.reporter.add({
      endpoint: result.endpoint,
      statusCode: result.statusCode,
      shapeFingerprint: result.fingerprint,
      shape: result.shape,
      caller: result.caller,
      count: 1,
      timestamp: result.timestamp,
    });
  }
}

// ProviderMiddleware.ts — intercepts res.json()
class ProviderMiddleware extends BaseMiddleware {
  protected intercept(req: Request, res: Response, next: NextFunction): void {
    const originalJson = res.json.bind(res);

    res.json = (body: unknown) => {
      setImmediate(() => {
        this.reportShape({
          rawBody: body,
          endpoint: `${req.method} ${req.route?.path || req.path}`,
          statusCode: res.statusCode,
          caller: req.headers['x-service-name'] as string || null,
          timestamp: new Date().toISOString(),
        });
      });
      return originalJson(body);
    };

    next();
  }
}

// ConsumerMiddleware.ts — wraps outgoing fetch calls
class ConsumerMiddleware extends BaseMiddleware {
  protected intercept(req: Request, res: Response, next: NextFunction): void {
    // attach tracked fetch to request context
    (req as any).ccFetch = this.createTrackedFetch();
    next();
  }

  private createTrackedFetch(): typeof fetch {
    // ... returns Proxy-wrapped fetch
  }
}
```

---

## Observer Pattern — Server Event Bus

The server uses a typed event bus to decouple ingestion from drift detection from alerting:

```typescript
// EventTypes.ts
interface EventMap {
  'sample:ingested': { provider: string; endpoint: string; method: string; fingerprint: string };
  'contract:updated': { contractId: string; provider: string; status: string };
  'drift:detected': { event: DriftEvent };
  'drift:confirmed': { event: DriftEvent };
  'drift:resolved': { eventId: string };
}

// EventBus.ts
class EventBus {
  private listeners = new Map<string, Set<Function>>();

  on<K extends keyof EventMap>(event: K, handler: (payload: EventMap[K]) => void): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
  }

  off<K extends keyof EventMap>(event: K, handler: (payload: EventMap[K]) => void): void {
    this.listeners.get(event)?.delete(handler);
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    for (const handler of this.listeners.get(event) || []) {
      try { handler(payload); } catch { /* observer failure never breaks emitter */ }
    }
  }
}
```

**Wiring at startup:**

```typescript
// ContainerFactory.ts
function buildContainer(config: ServerConfig): Container {
  const eventBus = new EventBus();
  const stores = StoreFactory.create(config.storage);
  const alertRouter = AlertChannelFactory.create(config.alerts);

  const driftDetector = new DriftDetector(/* from core */);
  const inferrer = new SchemaInferrer(/* from core */);

  // Observer wiring: ingestion → drift check → alert
  eventBus.on('sample:ingested', async ({ provider, endpoint, method, fingerprint }) => {
    const contract = stores.contracts.getContract(provider, endpoint, method);
    if (!contract || contract.status !== 'stable') return;

    const shape = stores.samples.getShape(fingerprint);
    if (!shape) return;

    const consumers = stores.consumerDeps.getConsumersOf(provider, endpoint, method);
    const events = driftDetector.detect(contract.schema, shape, consumers);

    for (const event of events) {
      stores.drift.createEvent(event);
      eventBus.emit('drift:detected', { event });
    }
  });

  eventBus.on('drift:confirmed', async ({ event }) => {
    await alertRouter.route(event);
  });

  return container;
}
```

This decoupling means:
- Adding a new reaction to drift (e.g., auto-creating a Jira ticket) = new subscriber, zero existing code changes
- Testing ingestion doesn't require alert channels to be configured
- Each subscriber can fail independently without affecting others

---

## Dependency Injection Container

A simple container that wires everything together at startup:

```typescript
// Container.ts
class Container {
  private registry = new Map<string, unknown>();

  register<T>(token: string, instance: T): void {
    this.registry.set(token, instance);
  }

  resolve<T>(token: string): T {
    const instance = this.registry.get(token);
    if (!instance) throw new Error(`No registration for: ${token}`);
    return instance as T;
  }
}

// Tokens.ts — avoids magic strings
const Tokens = {
  EventBus: 'EventBus',
  ContractStore: 'IContractStore',
  SampleStore: 'ISampleStore',
  DriftStore: 'IDriftStore',
  ConsumerDepStore: 'IConsumerDepStore',
  AlertRouter: 'AlertRouter',
  Scheduler: 'IScheduler',
  ShapeExtractor: 'IShapeExtractor',
  SchemaInferrer: 'ISchemaInferrer',
  DriftDetector: 'IDriftDetector',
  Fingerprinter: 'IFingerprinter',
} as const;
```

The `ContainerFactory` reads config and registers the correct implementations:

```typescript
// ContainerFactory.ts
class ContainerFactory {
  static build(config: ServerConfig): Container {
    const container = new Container();

    // Core — pure logic, no DI needed
    container.register(Tokens.ShapeExtractor, new ShapeExtractor());
    container.register(Tokens.Fingerprinter, new Fingerprinter(/* xxhash */));
    container.register(Tokens.SchemaInferrer, new SchemaInferrer());
    container.register(Tokens.DriftDetector, new DriftDetector());

    // Store — Factory decides SQLite vs Postgres based on config
    const stores = StoreFactory.create(config.storage);
    container.register(Tokens.ContractStore, stores.contracts);
    container.register(Tokens.SampleStore, stores.samples);
    container.register(Tokens.DriftStore, stores.drift);
    container.register(Tokens.ConsumerDepStore, stores.consumerDeps);

    // Alerting — Factory creates channels from config
    const alertRouter = new AlertRouter();
    for (const channel of AlertChannelFactory.createAll(config.alerts)) {
      alertRouter.register(channel);
    }
    container.register(Tokens.AlertRouter, alertRouter);

    // Event bus + wiring
    const eventBus = new EventBus();
    container.register(Tokens.EventBus, eventBus);

    // Scheduler
    const scheduler = new Scheduler();
    scheduler.register(new InferenceJob(stores, container.resolve(Tokens.SchemaInferrer)));
    scheduler.register(new DriftResolutionJob(stores.drift));
    scheduler.register(new SamplePruningJob(stores.samples, config.ingestion));
    scheduler.register(new StaleConsumerJob(stores.consumerDeps));
    container.register(Tokens.Scheduler, scheduler);

    return container;
  }
}
```

---

## Factory Pattern — Store, Transport, Alert Channels

### StoreFactory

```typescript
// StoreFactory.ts
class StoreFactory {
  static create(config: StorageConfig): StoreSet {
    switch (config.driver) {
      case 'sqlite': {
        const conn = new SqliteConnection(config.path);
        return {
          contracts: new SqliteContractStore(conn),
          samples: new SqliteSampleStore(conn),
          drift: new SqliteDriftStore(conn),
          consumerDeps: new SqliteConsumerDepStore(conn),
        };
      }
      case 'postgres': {
        const pool = new PostgresPool(config.connectionString);
        return {
          contracts: new PostgresContractStore(pool),
          samples: new PostgresSampleStore(pool),
          drift: new PostgresDriftStore(pool),
          consumerDeps: new PostgresConsumerDepStore(pool),
        };
      }
      default:
        throw new Error(`Unknown storage driver: ${config.driver}`);
    }
  }
}

interface StoreSet {
  contracts: IContractStore;
  samples: ISampleStore;
  drift: IDriftStore;
  consumerDeps: IConsumerDepStore;
}
```

### TransportFactory (SDK-side)

```typescript
// TransportFactory.ts
class TransportFactory {
  static create(config: TransportConfig): ITransportAdapter {
    switch (config.type) {
      case 'http':    return new HttpTransport(config.url, config.timeout);
      case 'sqs':     return new SqsTransport(config.queueUrl);
      case 'kafka':   return new KafkaTransport(config.brokers, config.topic);
      case 'noop':    return new NoopTransport();
      default:
        throw new Error(`Unknown transport: ${config.type}`);
    }
  }
}
```

### AlertChannelFactory

```typescript
// AlertChannelFactory.ts
class AlertChannelFactory {
  static createAll(config: AlertConfig): IAlertChannel[] {
    const channels: IAlertChannel[] = [];

    if (config.slack) {
      channels.push(new SlackChannel(config.slack.webhookUrl, new SlackFormatter()));
    }
    if (config.pagerduty) {
      channels.push(new PagerDutyChannel(
        config.pagerduty.routingKey,
        config.pagerduty.severityThreshold
      ));
    }
    if (config.webhook) {
      channels.push(new WebhookChannel(config.webhook.url, new PlainTextFormatter()));
    }

    return channels;
  }
}
```

---

## Database Schema (SQLite)

### Pragmas (set on connection open)

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -64000;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
```

### Tables

```sql
CREATE TABLE shapes (
  fingerprint TEXT PRIMARY KEY,
  shape JSON NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sample_aggregates (
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

CREATE TABLE contracts (
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

CREATE TABLE consumer_deps (
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

CREATE TABLE drift_events (
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

CREATE INDEX idx_sample_agg_provider ON sample_aggregates(provider, endpoint, method);
CREATE INDEX idx_contracts_provider ON contracts(provider, endpoint, method);
CREATE INDEX idx_consumer_deps_provider ON consumer_deps(provider, endpoint, method);
CREATE INDEX idx_consumer_deps_consumer ON consumer_deps(consumer);
CREATE INDEX idx_drift_events_status ON drift_events(status, severity);
CREATE INDEX idx_drift_events_provider ON drift_events(provider, endpoint, method);
```

### Repository Implementation (example)

```typescript
// SqliteContractStore.ts — implements IContractStore
class SqliteContractStore implements IContractStore {
  private stmts: {
    getOne: Statement;
    listByProvider: Statement;
    getAll: Statement;
    upsert: Statement;
    updateStatus: Statement;
  };

  constructor(private conn: SqliteConnection) {
    this.stmts = {
      getOne: conn.db.prepare(
        'SELECT * FROM contracts WHERE provider = ? AND endpoint = ? AND method = ?'
      ),
      listByProvider: conn.db.prepare(
        'SELECT * FROM contracts WHERE provider = ?'
      ),
      getAll: conn.db.prepare('SELECT * FROM contracts'),
      upsert: conn.db.prepare(`
        INSERT INTO contracts (id, provider, endpoint, method, schema, sample_count, confidence, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        ON CONFLICT(provider, endpoint, method) DO UPDATE SET
          schema = excluded.schema,
          sample_count = excluded.sample_count,
          confidence = excluded.confidence,
          status = excluded.status,
          updated_at = datetime('now')
      `),
      updateStatus: conn.db.prepare(
        'UPDATE contracts SET status = ?, updated_at = datetime(\'now\') WHERE id = ?'
      ),
    };
  }

  getContract(provider: string, endpoint: string, method: string): Contract | null {
    const row = this.stmts.getOne.get(provider, endpoint, method) as ContractRow | undefined;
    return row ? this.toContract(row) : null;
  }

  listContracts(provider: string): Contract[] {
    return (this.stmts.listByProvider.all(provider) as ContractRow[]).map(this.toContract);
  }

  getAllContracts(): Contract[] {
    return (this.stmts.getAll.all() as ContractRow[]).map(this.toContract);
  }

  upsertContract(contract: Contract): void {
    this.stmts.upsert.run(
      contract.id, contract.provider, contract.endpoint, contract.method,
      JSON.stringify(contract.schema), contract.sampleCount, contract.confidence,
      contract.status
    );
  }

  updateStatus(id: string, status: ContractStatus): void {
    this.stmts.updateStatus.run(status, id);
  }

  private toContract(row: ContractRow): Contract {
    return { ...row, schema: JSON.parse(row.schema) };
  }
}
```

### Migration to PostgreSQL

`PostgresContractStore` implements the same `IContractStore` interface with `pg` pool queries instead of `better-sqlite3` prepared statements. The `StoreFactory` returns the correct implementation based on `config.storage.driver`. No other code changes needed (DIP + LSP).

---

## Server Startup Flow

```typescript
// index.ts — server entry
async function main() {
  const config = await ConfigLoader.load();
  const container = ContainerFactory.build(config);

  const app = Fastify({ logger: true });

  // register routes — each route file receives only the interfaces it needs (ISP)
  registerIngestRoutes(app, {
    sampleStore: container.resolve<ISampleStore>(Tokens.SampleStore),
    eventBus: container.resolve<EventBus>(Tokens.EventBus),
  });

  registerContractRoutes(app, {
    contractStore: container.resolve<IContractReader>(Tokens.ContractStore),
  });

  registerGraphRoutes(app, {
    consumerDepStore: container.resolve<IConsumerDepReader>(Tokens.ConsumerDepStore),
    contractStore: container.resolve<IContractReader>(Tokens.ContractStore),
  });

  registerDriftRoutes(app, {
    driftStore: container.resolve<IDriftStore>(Tokens.DriftStore),
  });

  registerHealthRoutes(app);

  // start scheduler
  const scheduler = container.resolve<IScheduler>(Tokens.Scheduler);
  scheduler.start();

  await app.listen({ port: config.port || 7100 });

  process.on('SIGTERM', async () => {
    scheduler.stop();
    await app.close();
  });
}
```

Note how each route group receives **only the interfaces it needs** — `registerContractRoutes` gets `IContractReader`, not the full `IContractStore`. It can't accidentally write to contracts. This is Interface Segregation in practice.

---

## Performance Budget

| Operation | Target | Measured by |
|---|---|---|
| Shape extraction (typical 20-field response) | < 50μs | Benchmark test |
| Shape extraction (200-field nested response) | < 500μs | Benchmark test |
| SDK latency overhead on request | < 1ms p99 | Load test with/without SDK |
| Batch flush (HTTP POST, 100 samples) | < 100ms | Network round-trip |
| Ingestion endpoint (server-side, per batch) | < 10ms | Server metrics |
| Contract inference (10,000 samples) | < 500ms | Benchmark test |
| Drift detection (per incoming shape) | < 1ms | Benchmark test |
| SQLite write (single aggregate upsert) | < 0.5ms | Database benchmark |

### Memory Budget (SDK side)

| Resource | Limit |
|---|---|
| Shape buffer | 10,000 entries max (~2MB) |
| Fingerprint cache | 10,000 entries max (~640KB) |
| Consumer access sets | 1,000 concurrent tracked responses max |
| Total SDK memory overhead | < 5MB |

---

## Error Handling

### SDK Errors

Every SDK operation is wrapped in a top-level try/catch. Any error inside the SDK is caught and silently discarded. The SDK **never throws into user code**.

```typescript
function safeMiddleware(fn: RequestHandler): RequestHandler {
  return (req, res, next) => {
    try {
      fn(req, res, next);
    } catch {
      next();
    }
  };
}
```

### Server Errors

| Error | Behavior |
|---|---|
| Malformed batch from SDK | Return 400. Log. Don't crash. |
| SQLite write failure | Return 500. Log. Retry on next batch. |
| Alert channel failure (Slack down) | Log warning. Don't block ingestion pipeline. Retry on next drift event update. |
| Disk full | Trigger emergency sample pruning. Alert on server health endpoint. |

### Graceful Degradation

If the contractcheck server goes down entirely:
- SDKs continue to function — they drop batches silently
- No new drift detection occurs
- Existing contracts and drift events are persisted in SQLite
- Server restarts and picks up where it left off
- No data loss except for traffic samples during the outage window (acceptable — they're sampled observations)

---

## Deployment

### Development

```bash
git clone https://github.com/org/contractcheck
cd contractcheck
npm install
npm run build
npm run test
npm run dev:server   # starts on localhost:7100
```

### Production (single server)

```bash
npm install -g contractcheck

contractcheck-server --config contractcheck.server.yml

# or via Docker
docker run -v ./data:/data -p 7100:7100 contractcheck/server
```

### Docker Compose (local development with multiple services)

```yaml
services:
  contractcheck:
    image: contractcheck/server
    ports:
      - "7100:7100"
    volumes:
      - contractcheck-data:/data
    environment:
      - CC_STORAGE_PATH=/data/contracts.db

volumes:
  contractcheck-data:
```

| Service | Port |
|---|---|
| contractcheck server | 7100 |
| contractcheck server (metrics) | 7101 |

---

## Testing Strategy

| Layer | What | How |
|---|---|---|
| **core** unit tests | Shape extraction, inference, drift detection | Vitest. Fixed JSON inputs, assert on output shapes/contracts/drift events. Pure logic, zero mocking. |
| **core** property tests | Shape extraction handles any valid JSON | `fast-check` fuzzer. Generate random JSON, verify extraction never throws and always produces valid `ShapeNode`. |
| **server** unit tests | Repository methods, ingestion service | Vitest. Inject in-memory SQLite via `IContractStore` etc. Tests run against real DB but with no filesystem persistence. |
| **server** integration tests | Ingestion → inference → drift → alert pipeline | Spin up Fastify, POST batches, assert on contract/drift state via API. `NoopTransport` + mock `IAlertChannel` verify alert dispatch without external calls. |
| **SDK** unit tests | Pipeline steps, Proxy field tracking | Vitest. Each step tested in isolation. `NoopTransport` verifies reporter output. |
| **SDK** integration tests | Full middleware on a test Express app | Mount middleware, send requests, assert shapes reported match expectations. |
| **E2E** scenario tests | 2 services → SDK → server → drift alert | Docker Compose. Simulate a breaking change, assert alert fires. |

Interfaces make testing trivial — every external dependency (`IContractStore`, `IAlertChannel`, `ITransportAdapter`) is substituted with a test double. No monkey-patching, no module mocking.

---

## Security Considerations

| Vector | Mitigation |
|---|---|
| SDK sends PII | Shape extraction strips values by design. `Redactor` removes sensitive field names. Integration test verifies no value leakage. |
| Malicious SDK sends fake shapes | Server validates batch structure via Fastify JSON Schema. Auth via API key per service (`X-CC-API-Key` header). |
| DoS via high-volume ingestion | Rate limiting per service (default: 100 batches/minute). Configurable. |
| SQLite file access | Server runs with restrictive file permissions (600). Data directory not web-accessible. |
| Shape inspection reveals API structure | Server runs on internal network only. API endpoints require authentication. |

---

## Design Pattern Summary

| Pattern | Files | What it solves |
|---|---|---|
| **Strategy** | `ITransportAdapter` → `HttpTransport`, `SqsTransport`, `KafkaTransport` | Swap data transport without touching SDK logic |
| **Strategy** | `IAlertChannel` → `SlackChannel`, `PagerDutyChannel`, `WebhookChannel` | Add alert destinations without modifying router |
| **Strategy** | `IContractStore` → `SqliteContractStore`, `PostgresContractStore` | Swap storage engine without touching business logic |
| **Strategy** | `IRenderer` → `TableRenderer`, `JsonRenderer` | CLI output format switchable via `--format` flag |
| **Observer** | `EventBus` with `EventMap` | Decouple ingestion → drift → alerting pipeline |
| **Repository** | `SqliteContractStore`, `SqliteSampleStore`, etc. | Encapsulate SQL behind typed interfaces |
| **Factory** | `StoreFactory`, `TransportFactory`, `AlertChannelFactory` | Config-driven object creation, no `new` in business logic |
| **Builder** | `DriftEventBuilder`, `ContractSchemaBuilder` | Safe construction of complex immutable objects |
| **Composite** | `ShapeNode` → `ShapeObject` / `ShapeArray` / `ShapeUnion` | Uniform traversal of recursive type trees |
| **Visitor** | `IShapeVisitor` → `ShapeFlattener`, `ShapeSerializer`, `ShapePrinter` | Multiple traversal algorithms without modifying shape types |
| **Template Method** | `BaseMiddleware` → `ProviderMiddleware`, `ConsumerMiddleware` | Shared middleware lifecycle with customizable interception |
| **Chain of Responsibility** | `PipelineStep` → `SamplerStep`, `RedactorStep`, `ExtractorStep`, `FingerprintStep` | Composable, reorderable processing pipeline |
