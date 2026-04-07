import { describe, it, expect } from 'vitest';
import { Redactor } from '../../src/extraction/Redactor.js';

describe('Redactor', () => {
  describe('constructor(keys) and redact(obj)', () => {
    it('1. removes top-level redacted keys', () => {
      const r = new Redactor(['password']);
      expect(r.redact({ user: 'alice', password: 'secret' })).toEqual({ user: 'alice' });
    });

    it('2. case-insensitive: Password removed when password is configured', () => {
      const r = new Redactor(['password']);
      expect(r.redact({ Password: 'x', ok: 1 })).toEqual({ ok: 1 });
    });

    it('3. leaves non-redacted keys intact', () => {
      const r = new Redactor(['token']);
      const input = { a: 1, b: 'keep' };
      expect(r.redact(input)).toEqual(input);
    });

    it('4. recursively redacts nested objects', () => {
      const r = new Redactor(['password']);
      expect(
        r.redact({
          outer: { password: 'nope', keep: true },
          safe: 1,
        }),
      ).toEqual({
        outer: { keep: true },
        safe: 1,
      });
    });

    it('5. does not traverse or modify arrays (kept as-is)', () => {
      const r = new Redactor(['password']);
      const arr = [{ password: 'still-here' }];
      const input = { items: arr };
      const out = r.redact(input);
      expect(out.items).toBe(arr);
      expect((out.items as typeof arr)[0]).toEqual({ password: 'still-here' });
    });

    it('6. empty redact list → object unchanged', () => {
      const r = new Redactor([]);
      const input = { password: 'x', a: 1 };
      expect(r.redact(input)).toEqual(input);
    });

    it('7. multiple redact keys together', () => {
      const r = new Redactor(['password', 'secret', 'apiKey']);
      expect(
        r.redact({
          user: 'u',
          password: 'p',
          secret: 's',
          apiKey: 'k',
          public: true,
        }),
      ).toEqual({ user: 'u', public: true });
    });
  });
});
