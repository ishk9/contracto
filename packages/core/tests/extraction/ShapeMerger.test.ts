import { describe, it, expect } from 'vitest';
import { ShapeMerger } from '../../src/extraction/ShapeMerger.js';
import type { ShapeNode } from '../../src/types/index.js';
import { isShapeUnion } from '../../src/types/index.js';

describe('ShapeMerger', () => {
  const merger = new ShapeMerger();

  describe('merge(nodes): ShapeNode', () => {
    it('1. empty array → unknown', () => {
      expect(merger.merge([])).toBe('unknown');
    });

    it('2. single node → unchanged', () => {
      expect(merger.merge(['string'])).toBe('string');
      const obj: ShapeNode = { _type: 'object', fields: { x: 'number' } };
      expect(merger.merge([obj])).toEqual(obj);
    });

    it('3. all same primitives → that primitive', () => {
      expect(merger.merge(['number', 'number'])).toBe('number');
      expect(merger.merge(['string', 'string', 'string'])).toBe('string');
    });

    it('4. different primitives → union', () => {
      const out = merger.merge(['string', 'number']);
      expect(isShapeUnion(out)).toBe(true);
      if (!isShapeUnion(out)) return;
      expect(out.variants).toHaveLength(2);
      expect(out.variants).toEqual(expect.arrayContaining(['string', 'number']));
    });

    it('5. two objects with same keys → merged field shapes', () => {
      const a: ShapeNode = { _type: 'object', fields: { id: 'string', x: 'number' } };
      const b: ShapeNode = { _type: 'object', fields: { id: 'number', y: 'string' } };
      expect(merger.merge([a, b])).toEqual({
        _type: 'object',
        fields: {
          id: { _type: 'union', variants: ['string', 'number'] },
          x: 'number',
          y: 'string',
        },
      });
    });

    it('6. two objects with different keys → object with all keys', () => {
      const a: ShapeNode = { _type: 'object', fields: { a: 'string' } };
      const b: ShapeNode = { _type: 'object', fields: { b: 'number' } };
      expect(merger.merge([a, b])).toEqual({
        _type: 'object',
        fields: { a: 'string', b: 'number' },
      });
    });

    it('7. all arrays → merged array with merged items', () => {
      const a: ShapeNode = { _type: 'array', items: 'string' };
      const b: ShapeNode = { _type: 'array', items: 'number' };
      expect(merger.merge([a, b])).toEqual({
        _type: 'array',
        items: { _type: 'union', variants: ['string', 'number'] },
      });
    });

    it('8. mixed objects and primitives → union', () => {
      const obj: ShapeNode = { _type: 'object', fields: {} };
      const out = merger.merge([obj, 'string']);
      expect(isShapeUnion(out)).toBe(true);
      if (!isShapeUnion(out)) return;
      expect(out.variants).toHaveLength(2);
      expect(out.variants).toEqual(expect.arrayContaining([obj, 'string']));
    });

    it('9. deduplicates identical shapes in heterogeneous union', () => {
      const o: ShapeNode = { _type: 'object', fields: { id: 'number' } };
      const out = merger.merge([o, 'string', o]);
      expect(isShapeUnion(out)).toBe(true);
      if (!isShapeUnion(out)) return;
      expect(out.variants).toHaveLength(2);
      expect(out.variants).toEqual(expect.arrayContaining([o, 'string']));
    });
  });
});
