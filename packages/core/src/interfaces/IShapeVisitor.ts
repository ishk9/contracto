import type { ShapeNode, ShapeObject, ShapeArray, ShapeUnion } from '../types/index.js';
import { isShapeObject, isShapeArray, isShapeUnion } from '../types/index.js';

export interface IShapeVisitor<T> {
  visitPrimitive(node: string, path: string): T;
  visitObject(node: ShapeObject, path: string): T;
  visitArray(node: ShapeArray, path: string): T;
  visitUnion(node: ShapeUnion, path: string): T;
}

export function acceptVisitor<T>(
  node: ShapeNode,
  visitor: IShapeVisitor<T>,
  path: string = '',
): T {
  if (typeof node === 'string') return visitor.visitPrimitive(node, path);
  if (isShapeObject(node)) return visitor.visitObject(node, path);
  if (isShapeArray(node)) return visitor.visitArray(node, path);
  if (isShapeUnion(node)) return visitor.visitUnion(node, path);
  return visitor.visitPrimitive(String(node), path);
}
