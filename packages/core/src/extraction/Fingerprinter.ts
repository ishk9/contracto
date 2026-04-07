import { xxhash64 } from 'hash-wasm';
import type { ShapeNode, ShapeObject, ShapeArray, ShapeUnion } from '../types/index.js';
import { isShapeObject, isShapeArray, isShapeUnion } from '../types/index.js';
import type { IFingerprinter } from '../interfaces/index.js';

export class Fingerprinter implements IFingerprinter {
  async fingerprint(shape: ShapeNode): Promise<string> {
    const canonical = this.canonicalize(shape);
    return xxhash64(canonical);
  }

  private canonicalize(node: ShapeNode): string {
    if (typeof node === 'string') return JSON.stringify(node);

    if (isShapeObject(node)) {
      const sorted = Object.keys(node.fields).sort();
      const entries = sorted.map(
        (k) => `${JSON.stringify(k)}:${this.canonicalize(node.fields[k])}`,
      );
      return `{${entries.join(',')}}`;
    }

    if (isShapeArray(node)) {
      return `[${this.canonicalize(node.items)}]`;
    }

    if (isShapeUnion(node)) {
      const sorted = node.variants.map((v) => this.canonicalize(v)).sort();
      return `(${sorted.join('|')})`;
    }

    return JSON.stringify(node);
  }
}
