import type { DriftEvent } from '@contractcheck/core';

export interface IAlertChannel {
  readonly name: string;
  send(event: DriftEvent): Promise<void>;
}
