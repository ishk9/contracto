import { describe, it, expect } from 'vitest';
import { Fingerprinter } from '../../src/extraction/Fingerprinter.js';
import type { ShapeNode } from '../../src/types/index.js';

describe('Fingerprinter', () => {
  const fp = new Fingerprinter();

  describe('fingerprint(shape): Promise<string> (hex hash)', () => {
    it('1. same shape → same hash (deterministic)', async () => {
      const shape: ShapeNode = { _type: 'object', fields: { x: 'string' } };
      const a = await fp.fingerprint(shape);
      const b = await fp.fingerprint(shape);
      expect(a).toBe(b);
      expect(a).toMatch(/^[0-9a-f]+$/i);
    });

    it('2. different shapes → different hashes', async () => {
      const h1 = await fp.fingerprint('string');
      const h2 = await fp.fingerprint('number');
      expect(h1).not.toBe(h2);
    });

    it('3. field order ignored (canonical sorting) → same hash', async () => {
      const a: ShapeNode = {
        _type: 'object',
        fields: { a: 'string', b: 'number' },
      };
      const b: ShapeNode = {
        _type: 'object',
        fields: { b: 'number', a: 'string' },
      };
      expect(await fp.fingerprint(a)).toBe(await fp.fingerprint(b));
    });

    it('4. primitives → consistent hashes', async () => {
      const h = await fp.fingerprint('boolean');
      expect(h).toBe(await fp.fingerprint('boolean'));
      expect(h).toMatch(/^[0-9a-f]+$/i);
    });

    it('5. nested objects → consistent hashes', async () => {
      const s: ShapeNode = {
        _type: 'object',
        fields: {
          u: { _type: 'object', fields: { id: 'number' } },
        },
      };
      expect(await fp.fingerprint(s)).toBe(await fp.fingerprint(s));
    });

    it('6. arrays → consistent hashes', async () => {
      const s: ShapeNode = { _type: 'array', items: 'string' };
      expect(await fp.fingerprint(s)).toBe(await fp.fingerprint(s));
    });

    it('7. union variant order ignored (sorted) → same hash', async () => {
      const u1: ShapeNode = {
        _type: 'union',
        variants: ['string', 'number', 'boolean'],
      };
      const u2: ShapeNode = {
        _type: 'union',
        variants: ['boolean', 'string', 'number'],
      };
      expect(await fp.fingerprint(u1)).toBe(await fp.fingerprint(u2));
    });
  });
});
