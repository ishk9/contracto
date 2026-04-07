import type { DriftEvent } from '@contractcheck/core';

export interface IDriftReader {
  getActiveEvents(): DriftEvent[];
  getEvent(id: string): DriftEvent | null;
  getEventsByProvider(provider: string): DriftEvent[];
}

export interface IDriftWriter {
  createEvent(event: DriftEvent): void;
  updateEvent(id: string, updates: Partial<Pick<DriftEvent, 'status' | 'resolvedAt'>>): void;
  incrementConfirmation(id: string): void;
}

export type IDriftStore = IDriftReader & IDriftWriter;
