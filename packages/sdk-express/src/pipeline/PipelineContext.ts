import type { ShapeNode } from '@contractcheck/core';

export interface PipelineContext {
  rawBody: unknown;
  shape?: ShapeNode;
  fingerprint?: string;
  endpoint: string;
  statusCode: number;
  caller: string | null;
  timestamp: string;
}
