export interface InferenceConfig {
  readonly minSamplesForStable: number;
  readonly requiredPresenceThreshold: number;
  readonly enumMaxCardinality: number;
  readonly maxDepth: number;
}

export const DEFAULT_INFERENCE_CONFIG: InferenceConfig = {
  minSamplesForStable: 50,
  requiredPresenceThreshold: 0.95,
  enumMaxCardinality: 20,
  maxDepth: 10,
};

export interface DriftConfig {
  readonly minConfirmSamples: number;
  readonly gracePeriodSeconds: number;
  readonly autoResolveAfterHours: number;
}

export const DEFAULT_DRIFT_CONFIG: DriftConfig = {
  minConfirmSamples: 10,
  gracePeriodSeconds: 300,
  autoResolveAfterHours: 72,
};

export interface TransportConfig {
  readonly type: 'http' | 'sqs' | 'kafka' | 'noop';
  readonly url?: string;
  readonly queueUrl?: string;
  readonly brokers?: readonly string[];
  readonly topic?: string;
  readonly timeout?: number;
}

export interface SDKConfig {
  readonly service: string;
  readonly serverUrl: string;
  readonly role: 'provider' | 'consumer' | 'both';
  readonly sampleRate: number;
  readonly redact: readonly string[];
}
