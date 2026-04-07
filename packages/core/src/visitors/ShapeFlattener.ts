import type { ShapeObject, ShapeArray, ShapeUnion } from '../types/index.js';
import { isPrimitive } from '../types/index.js';
import type { IShapeVisitor } from '../interfaces/index.js';
import { acceptVisitor } from '../interfaces/index.js';

export class ShapeFlattener implements IShapeVisitor<string[]> {
  visitPrimitive(_node: string, path: string): string[] {
    return path ? [path] : [];
  }

  visitObject(node: ShapeObject, path: string): string[] {
    const paths: string[] = [];
    for (const [key, child] of Object.entries(node.fields)) {
      const childPath = path ? `${path}.${key}` : key;
      if (isPrimitive(child)) {
        paths.push(...acceptVisitor(child, this, childPath));
      } else {
        paths.push(childPath);
        paths.push(...acceptVisitor(child, this, childPath));
      }
    }
    return paths;
  }

  visitArray(node: ShapeArray, path: string): string[] {
    return acceptVisitor(node.items, this, `${path}[]`);
  }

  visitUnion(node: ShapeUnion, path: string): string[] {
    const allPaths = new Set<string>();
    for (const variant of node.variants) {
      for (const p of acceptVisitor(variant, this, path)) {
        allPaths.add(p);
      }
    }
    return [...allPaths];
  }
}
