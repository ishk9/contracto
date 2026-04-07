import type { ShapeObject, ShapeArray, ShapeUnion } from '../types/index.js';
import type { IShapeVisitor } from '../interfaces/index.js';
import { acceptVisitor } from '../interfaces/index.js';

export class ShapeSerializer implements IShapeVisitor<string> {
  visitPrimitive(node: string, _path: string): string {
    return JSON.stringify(node);
  }

  visitObject(node: ShapeObject, _path: string): string {
    const sorted = Object.keys(node.fields).sort();
    const entries = sorted.map(
      (k) => `${JSON.stringify(k)}:${acceptVisitor(node.fields[k], this)}`,
    );
    return `{${entries.join(',')}}`;
  }

  visitArray(node: ShapeArray, _path: string): string {
    return `[${acceptVisitor(node.items, this)}]`;
  }

  visitUnion(node: ShapeUnion, _path: string): string {
    const sorted = node.variants.map((v) => acceptVisitor(v, this)).sort();
    return `(${sorted.join('|')})`;
  }
}
