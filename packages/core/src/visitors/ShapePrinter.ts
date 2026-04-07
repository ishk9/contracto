import type { ShapeObject, ShapeArray, ShapeUnion } from '../types/index.js';
import type { IShapeVisitor } from '../interfaces/index.js';
import { acceptVisitor } from '../interfaces/index.js';

const MAX_FIELDS_SHOWN = 5;

export class ShapePrinter implements IShapeVisitor<string> {
  visitPrimitive(node: string, _path: string): string {
    return node;
  }

  visitObject(node: ShapeObject, _path: string): string {
    const keys = Object.keys(node.fields);
    const shown = keys.slice(0, MAX_FIELDS_SHOWN);
    const parts = shown.map((k) => `${k}: ${acceptVisitor(node.fields[k], this)}`);
    if (keys.length > MAX_FIELDS_SHOWN) {
      parts.push(`... +${keys.length - MAX_FIELDS_SHOWN} more`);
    }
    return `{ ${parts.join(', ')} }`;
  }

  visitArray(node: ShapeArray, _path: string): string {
    return `${acceptVisitor(node.items, this)}[]`;
  }

  visitUnion(node: ShapeUnion, _path: string): string {
    return node.variants.map((v) => acceptVisitor(v, this)).join(' | ');
  }
}
