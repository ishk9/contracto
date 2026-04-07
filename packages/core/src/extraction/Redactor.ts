import type { IRedactor } from '../interfaces/index.js';

export class Redactor implements IRedactor {
  private readonly redactKeys: Set<string>;

  constructor(keys: string[]) {
    this.redactKeys = new Set(keys.map((k) => k.toLowerCase()));
  }

  redact(obj: Record<string, unknown>): Record<string, unknown> {
    return this.redactRecursive(obj);
  }

  private redactRecursive(obj: Record<string, unknown>): Record<string, unknown> {
    const cleaned: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (this.redactKeys.has(key.toLowerCase())) continue;
      if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
        cleaned[key] = this.redactRecursive(val as Record<string, unknown>);
      } else {
        cleaned[key] = val;
      }
    }
    return cleaned;
  }
}
