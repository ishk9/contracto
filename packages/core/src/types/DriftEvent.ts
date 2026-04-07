export enum DriftChangeType {
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

export type Severity = 'info' | 'warning' | 'breaking' | 'critical';

export type DriftStatus = 'pending' | 'active' | 'acknowledged' | 'resolved';

export interface DriftDetails {
  readonly before: string;
  readonly after: string;
  readonly description: string;
}

export interface ConsumerImpact {
  readonly consumer: string;
  readonly field: string;
  readonly sampleCount: number;
  readonly lastSeen: string;
}

export interface DriftEvent {
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

export interface ConsumerDep {
  readonly consumer: string;
  readonly provider: string;
  readonly endpoint: string;
  readonly method: string;
  readonly fieldsAccessed: readonly string[];
  readonly sampleCount: number;
  readonly firstSeen: string;
  readonly lastSeen: string;
}

export interface DependencyGraph {
  readonly providers: ReadonlyMap<string, ProviderNode>;
}

export interface ProviderNode {
  readonly service: string;
  readonly endpoints: readonly EndpointNode[];
}

export interface EndpointNode {
  readonly endpoint: string;
  readonly method: string;
  readonly consumers: readonly ConsumerDep[];
}
