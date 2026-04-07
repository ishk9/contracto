import type { DriftEvent } from '@contractcheck/core';

export interface EventMap {
  'sample:ingested': {
    provider: string;
    endpoint: string;
    method: string;
    fingerprint: string;
  };
  'contract:updated': {
    contractId: string;
    provider: string;
    status: string;
  };
  'drift:detected': {
    event: DriftEvent;
  };
  'drift:confirmed': {
    event: DriftEvent;
  };
  'drift:resolved': {
    eventId: string;
  };
}
