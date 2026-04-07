export interface IRedactor {
  redact(obj: Record<string, unknown>): Record<string, unknown>;
}
