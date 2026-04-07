import type { InferenceConfig, DriftConfig } from '@contractcheck/core';

export interface StorageConfig {
  readonly driver: 'sqlite' | 'postgres';
  readonly path: string;
  readonly connectionString?: string;
}

export interface IngestionConfig {
  readonly sampleRetentionDays: number;
}

export interface SlackAlertConfig {
  readonly webhookUrl: string;
}

export interface PagerDutyAlertConfig {
  readonly routingKey: string;
  readonly severityThreshold: 'info' | 'warning' | 'breaking' | 'critical';
}

export interface WebhookAlertConfig {
  readonly url: string;
}

export interface AlertConfig {
  readonly slack?: SlackAlertConfig;
  readonly pagerduty?: PagerDutyAlertConfig;
  readonly webhook?: WebhookAlertConfig;
}

export interface ServerConfig {
  readonly port: number;
  readonly storage: StorageConfig;
  readonly inference: InferenceConfig;
  readonly drift: DriftConfig;
  readonly ingestion: IngestionConfig;
  readonly alerts: AlertConfig;
}

export const DEFAULT_SERVER_CONFIG: ServerConfig = {
  port: 7100,
  storage: { driver: 'sqlite', path: './data/contractcheck.db' },
  inference: {
    minSamplesForStable: 50,
    requiredPresenceThreshold: 0.95,
    enumMaxCardinality: 20,
    maxDepth: 10,
  },
  drift: {
    minConfirmSamples: 10,
    gracePeriodSeconds: 300,
    autoResolveAfterHours: 72,
  },
  ingestion: {
    sampleRetentionDays: 30,
  },
  alerts: {},
};
