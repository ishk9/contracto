import type { ShapeNode, ShapeObject } from '../types/index.js';
import { isShapeObject, isShapeArray, isPrimitive } from '../types/index.js';
import type { IShapeMerger } from '../interfaces/index.js';

export class ShapeMerger implements IShapeMerger {
  merge(nodes: ShapeNode[]): ShapeNode {
    if (nodes.length === 0) return 'unknown';
    if (nodes.length === 1) return nodes[0];

    const primitives = nodes.filter(isPrimitive);
    const objects = nodes.filter(isShapeObject);
    const arrays = nodes.filter(isShapeArray);

    if (objects.length === nodes.length) {
      return this.mergeObjects(objects);
    }

    if (arrays.length === nodes.length) {
      const itemShapes = arrays.map((a) => a.items);
      return { _type: 'array', items: this.merge(itemShapes) };
    }

    if (primitives.length === nodes.length) {
      const unique = [...new Set(primitives)];
      if (unique.length === 1) return unique[0];
      return { _type: 'union', variants: unique };
    }

    const seen = new Set<string>();
    const variants: ShapeNode[] = [];
    for (const node of nodes) {
      const key = JSON.stringify(node);
      if (!seen.has(key)) {
        seen.add(key);
        variants.push(node);
      }
    }
    return variants.length === 1 ? variants[0] : { _type: 'union', variants };
  }

  private mergeObjects(objects: ShapeObject[]): ShapeObject {
    const allKeys = new Set<string>();
    for (const obj of objects) {
      for (const key of Object.keys(obj.fields)) {
        allKeys.add(key);
      }
    }

    const mergedFields: Record<string, ShapeNode> = {};
    for (const key of allKeys) {
      const keyNodes: ShapeNode[] = [];
      for (const obj of objects) {
        if (key in obj.fields) {
          keyNodes.push(obj.fields[key]);
        }
      }
      mergedFields[key] = keyNodes.length === 1 ? keyNodes[0] : this.merge(keyNodes);
    }

    return { _type: 'object', fields: mergedFields };
  }
}
